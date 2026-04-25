"""Team Formation agents — PDF parser + LangGraph candidate scorer.

Two pieces, both LLM-backed:

1. `parse_project_pdf(pdf_bytes, file_name) -> {project_name, project_summary,
       duration_months, roles: [...]}`
   One-shot LLM call (PDF text in, structured JSON out). HR can edit the
   result before the recommendation step.

2. `recommend_team(run_id) -> {role_designation: [evaluation, ...]}`
   LangGraph flow per (role, candidate) pair:
       fetch_role_pool -> for each candidate: fetch_profile -> score -> persist
   Mirrors `services/ai_agent.py` for the resume-shortlist feature.

The scoring LLM evaluates 5 facets relevant to internal team formation:
    skills, availability, experience, projects, certifications
plus an overall_score and a 1-line summary.
"""
from __future__ import annotations

import io
import json
import re
import time
from typing import Any, Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph
from pypdf import PdfReader

from config import HF_API_TOKEN, HF_MODEL_ID
from services import team_formation_service as tfs


HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"
PARSER_MAX_TOKENS = 1400
SCORER_MAX_TOKENS = 700
TOP_PER_ROLE = 6  # how many candidates we score with the LLM per role
SCORER_INTER_CALL_DELAY = 0.8  # seconds between LLM calls — stays under HF Router burst cap
SCORER_RETRY_BACKOFF = (2.0, 5.0, 12.0)  # 402/429 retries — total ~19s of cool-down


# ============================================================
# 0. Shared helpers
# ============================================================

def _call_hf(messages: list[dict[str, str]], max_tokens: int, temperature: float = 0.2) -> dict[str, Any]:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not set in backend/.env")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "model": HF_MODEL_ID,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=90.0) as client:
        r = client.post(HF_CHAT_URL, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


def _extract_json(text: str) -> dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return {}
    return {}


def _clamp(v: Any) -> Optional[int]:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, n))


# ============================================================
# 1. PDF parser
# ============================================================

def _pdf_to_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    parts: list[str] = []
    for p in reader.pages:
        try:
            t = p.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(t)
    return "\n\n".join(parts).strip()


_PARSER_SYSTEM = """\
You are a resource-planning assistant. You receive the raw text of a "Project
Requirements" document and must extract the team composition the project needs.

Return ONLY a JSON object — no prose. Schema:

{
  "project_name": "string (e.g. 'Project Phoenix' — keep the project codename)",
  "project_summary": "string — 1-3 sentences describing the project",
  "duration_months": number | null,
  "priority": "string | null  (e.g. 'High')",
  "domain": "string | null",
  "roles": [
    {
      "designation": "string — the job title HR will hire for (e.g. 'Senior Software Engineer')",
      "department": "string | null — e.g. 'Software Engineering', 'Quality Assurance'",
      "headcount": number,
      "level": "string | null — e.g. 'L4', 'L3 / L4'",
      "allocation_percent": number — 0..100, default 100 if unspecified,
      "min_experience_years": number | null,
      "must_have_skills": ["string", ...],
      "good_to_have_skills": ["string", ...],
      "responsibilities": "string | null"
    }
  ]
}

RULES
=====
- One entry per *distinct* role. If the doc says "2 × Senior Engineer", set
  designation='Senior Software Engineer' and headcount=2 (do not duplicate).
- Normalize designation to a clean canonical title.
- If a role gives a level range like "L3 / L4", keep the original string in `level`.
- Skills must be a JSON array of strings, not a comma-separated string.
- If a field is missing, use null (or [] for skill arrays). Never invent data.
- Keep responsibilities to 1-2 sentences; do not pad.
"""


def parse_project_pdf(pdf_bytes: bytes, file_name: Optional[str] = None) -> dict[str, Any]:
    """Extract structured project requirements from an uploaded PDF.

    Returns the parsed JSON dict + the raw extracted text (so the router can
    persist it as audit). Raises on hard failure so the caller can return 4xx.
    """
    text = _pdf_to_text(pdf_bytes)
    if not text:
        raise ValueError("Could not extract any text from the uploaded PDF")

    # Cap to keep the prompt within the model's window. PDFs in this feature
    # are short (1-3 pages); 12k chars is plenty.
    text = text[:12000]

    user = (
        "PROJECT REQUIREMENTS DOCUMENT (raw text):\n"
        f"{text}\n\n"
        "Return ONLY the JSON object described in the system prompt."
    )
    raw = _call_hf(
        messages=[
            {"role": "system", "content": _PARSER_SYSTEM},
            {"role": "user", "content": user},
        ],
        max_tokens=PARSER_MAX_TOKENS,
        temperature=0.1,
    )
    content = ""
    try:
        content = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise ValueError("LLM returned an unexpected response shape")

    parsed = _extract_json(content)
    if not parsed or not isinstance(parsed.get("roles"), list) or not parsed["roles"]:
        raise ValueError("LLM did not extract any roles from the document")

    # Sanity-fill defaults so downstream code can rely on shape.
    for role in parsed["roles"]:
        role["designation"] = (role.get("designation") or "").strip() or "Engineer"
        try:
            role["headcount"] = int(role.get("headcount") or 1)
        except (TypeError, ValueError):
            role["headcount"] = 1
        try:
            role["allocation_percent"] = float(role.get("allocation_percent") or 100)
        except (TypeError, ValueError):
            role["allocation_percent"] = 100.0
        role["must_have_skills"] = list(role.get("must_have_skills") or [])
        role["good_to_have_skills"] = list(role.get("good_to_have_skills") or [])

    parsed.setdefault("project_name", "Untitled Project")
    parsed.setdefault("project_summary", "")
    return {"parsed": parsed, "raw_text": text, "raw_response": raw}


# ============================================================
# 2. LangGraph scoring agent
# ============================================================

class ScoreState(TypedDict, total=False):
    run_id: int
    role: dict[str, Any]                  # one role from parsed_requirements.roles
    project_summary: str
    candidates: list[dict[str, Any]]      # SQL-prefiltered employees
    scored: list[dict[str, Any]]          # final list returned to caller
    error: Optional[str]


_SCORER_SYSTEM = """\
You are an expert technical recruiter and resource planner at Nimbus Labs.
You evaluate one INTERNAL employee against ONE specific project role and
return a structured fit score.

Score each of the five facets 0-100, with a one-sentence reason grounded in
the candidate data. Then give an overall_score (weighted judgement) and a
short summary.

FACETS
======
- skills:         match between candidate skills (and proficiency) and the role's
                  must-have / good-to-have skills.
- availability:   does the candidate have enough free bandwidth for the
                  requested allocation? Higher bandwidth_percent is better
                  (100 = fully free; lower means already committed elsewhere).
                  If bandwidth_percent < requested allocation_percent, score low.
- experience:     does total_experience_years and employee_level match the role's
                  seniority and min_experience_years?
- projects:       relevance of past project history (project names, role,
                  status). Reward similar domain or scale.
- certifications: relevant industry certifications. If none, give a neutral
                  score (~55) — do not penalize harshly.

OUTPUT
======
Return ONLY a JSON object in this exact shape:
{
  "overall_score": 0-100,
  "summary": "one short sentence — why this person is or is not a strong fit",
  "skills":         {"score": 0-100, "reason": "string"},
  "availability":   {"score": 0-100, "reason": "string"},
  "experience":     {"score": 0-100, "reason": "string"},
  "projects":       {"score": 0-100, "reason": "string"},
  "certifications": {"score": 0-100, "reason": "string"}
}

RULES
=====
- Be specific in reasons (mention real skill names or project names from data).
- Do not invent skills, projects, or certifications.
- Keep each reason to one sentence (max ~25 words).
"""


def _build_scorer_prompt(role: dict[str, Any], project_summary: str, profile: dict[str, Any]) -> list[dict[str, str]]:
    role_block = {
        "designation": role.get("designation"),
        "department": role.get("department"),
        "level": role.get("level"),
        "headcount": role.get("headcount"),
        "allocation_percent_required": role.get("allocation_percent"),
        "min_experience_years": role.get("min_experience_years"),
        "must_have_skills": role.get("must_have_skills") or [],
        "good_to_have_skills": role.get("good_to_have_skills") or [],
        "responsibilities": role.get("responsibilities"),
    }
    user = (
        f"PROJECT SUMMARY:\n{project_summary or '(not provided)'}\n\n"
        f"REQUIRED ROLE:\n{json.dumps(role_block, indent=2, default=str)}\n\n"
        f"CANDIDATE PROFILE (internal employee):\n"
        f"{json.dumps(profile, indent=2, default=str)}\n\n"
        "Return ONLY the JSON object specified in the system prompt."
    )
    return [
        {"role": "system", "content": _SCORER_SYSTEM},
        {"role": "user", "content": user},
    ]


def _normalize_score(obj: dict[str, Any]) -> dict[str, Any]:
    facets = ("skills", "availability", "experience", "projects", "certifications")
    out: dict[str, Any] = {
        "overall_score": _clamp(obj.get("overall_score")),
        "summary": (obj.get("summary") or "").strip(),
    }
    for f in facets:
        sub = obj.get(f) or {}
        if isinstance(sub, (int, float)):
            out[f] = {"score": _clamp(sub), "reason": ""}
        else:
            out[f] = {
                "score": _clamp(sub.get("score")),
                "reason": (sub.get("reason") or "").strip(),
            }
    return out


# ----- nodes -----

def _node_fetch_pool(state: ScoreState) -> ScoreState:
    role = state["role"]
    pool = tfs.candidate_pool_for_role(role, pool_limit=TOP_PER_ROLE * 3)
    if not pool:
        return {**state, "candidates": [], "scored": [], "error": "no candidates matched the SQL filter"}
    # Cap how many we ask the LLM about — the SQL pre-filter has already
    # ordered by best availability + experience.
    return {**state, "candidates": pool[:TOP_PER_ROLE], "scored": []}


def _score_with_retry(messages: list[dict[str, str]]) -> dict[str, Any]:
    """Call HF Router, backing off on 402/429 (per-minute burst cap)."""
    last_exc: Optional[Exception] = None
    for delay in (0.0, *SCORER_RETRY_BACKOFF):
        if delay:
            time.sleep(delay)
        try:
            return _call_hf(messages, max_tokens=SCORER_MAX_TOKENS, temperature=0.2)
        except httpx.HTTPStatusError as e:
            last_exc = e
            if e.response.status_code not in (402, 429):
                raise
    if last_exc:
        raise last_exc
    raise RuntimeError("scoring retry loop exited without a result")


def _node_score_all(state: ScoreState) -> ScoreState:
    role = state["role"]
    project_summary = state.get("project_summary") or ""
    scored: list[dict[str, Any]] = []

    for idx, cand in enumerate(state.get("candidates", [])):
        if idx > 0:
            time.sleep(SCORER_INTER_CALL_DELAY)
        emp_id = int(cand["employee_id"])
        bundle = tfs.fetch_employee_profile_bundle(emp_id)
        if not bundle:
            continue

        # Compose the LLM input — pruning fields that don't help scoring keeps the prompt small.
        profile = {
            "name": f"{cand.get('first_name','')} {cand.get('last_name','')}".strip(),
            "employee_code": cand.get("employee_code"),
            "job_title": cand.get("job_title"),
            "employee_level": cand.get("employee_level"),
            "department": cand.get("department_name"),
            "location": cand.get("location"),
            "work_mode": cand.get("work_mode"),
            "total_experience_years": cand.get("total_experience_years"),
            "company_experience_years": cand.get("company_experience_years"),
            "bandwidth_percent": cand.get("bandwidth_percent"),
            "current_project_count": cand.get("current_project_count"),
            "skills": [
                {
                    "name": s.get("skill_name"),
                    "level": s.get("proficiency_level"),
                    "years": s.get("years_of_experience"),
                    "primary": s.get("is_primary_skill"),
                }
                for s in bundle.get("skills", [])
            ],
            "certifications": [
                {"name": c.get("certification_name"), "issuer": c.get("issuing_organization"),
                 "status": c.get("status")}
                for c in bundle.get("certifications", [])
            ],
            "achievements": [
                {"title": a.get("title"), "category": a.get("category")}
                for a in bundle.get("achievements", [])
            ],
            "past_projects": [
                {"project_name": p.get("project_name"),
                 "role_in_project": p.get("role_in_project"),
                 "assignment_status": p.get("assignment_status"),
                 "allocation_percent": p.get("allocation_percent")}
                for p in bundle.get("projects", [])
            ],
            "education": bundle.get("education", []),
        }

        messages = _build_scorer_prompt(role, project_summary, profile)
        try:
            raw = _score_with_retry(messages)
            content = raw["choices"][0]["message"]["content"]
            parsed = _extract_json(content)
            if not parsed:
                continue
            ev = _normalize_score(parsed)
        except Exception as e:
            # Skip this candidate but continue the role.
            ev = {
                "overall_score": None,
                "summary": f"(scoring failed: {e})",
                "skills": {"score": None, "reason": ""},
                "availability": {"score": None, "reason": ""},
                "experience": {"score": None, "reason": ""},
                "projects": {"score": None, "reason": ""},
                "certifications": {"score": None, "reason": ""},
            }
            raw = {}

        # Persist immediately so a partial run is still useful.
        try:
            tfs.upsert_evaluation(
                run_id=state["run_id"],
                role_designation=role["designation"],
                employee_id=emp_id,
                overall_score=ev.get("overall_score"),
                skills_score=ev["skills"].get("score"),
                availability_score=ev["availability"].get("score"),
                experience_score=ev["experience"].get("score"),
                projects_score=ev["projects"].get("score"),
                certifications_score=ev["certifications"].get("score"),
                summary=ev.get("summary"),
                reasons={k: ev[k] for k in ("skills", "availability", "experience", "projects", "certifications")},
                available_bandwidth_percent=cand.get("bandwidth_percent"),
                model_id=HF_MODEL_ID,
                raw_response=raw or {},
            )
        except Exception:
            # DB write failure shouldn't kill the whole run; the in-memory
            # `scored` list is still returned to the caller.
            pass

        scored.append({
            "employee": cand,
            "evaluation": ev,
        })

    scored.sort(key=lambda r: (r["evaluation"].get("overall_score") or 0), reverse=True)
    return {**state, "scored": scored}


# ----- graph -----

def _build_graph():
    g = StateGraph(ScoreState)
    g.add_node("fetch_pool", _node_fetch_pool)
    g.add_node("score_all", _node_score_all)
    g.set_entry_point("fetch_pool")
    g.add_edge("fetch_pool", "score_all")
    g.add_edge("score_all", END)
    return g.compile()


_GRAPH = _build_graph()


# ----- public API -----

def recommend_team(run_id: int) -> dict[str, Any]:
    """Run the agent for every requested role and return per-role recommendations."""
    run = tfs.get_run(run_id)
    if not run:
        raise ValueError(f"run {run_id} not found")
    parsed = run.get("parsed_requirements") or {}
    roles: list[dict[str, Any]] = list(parsed.get("roles") or [])
    if not roles:
        raise ValueError("no roles in parsed requirements")

    project_summary = parsed.get("project_summary") or run.get("project_summary") or ""
    out: dict[str, list[dict[str, Any]]] = {}

    for role in roles:
        state: ScoreState = {
            "run_id": run_id,
            "role": role,
            "project_summary": project_summary,
        }
        final = _GRAPH.invoke(state)
        out[role.get("designation", "Unknown role")] = final.get("scored") or []

    tfs.update_run_status(run_id, "recommended")
    return {
        "run_id": run_id,
        "project_name": run.get("project_name"),
        "project_summary": project_summary,
        "requirements": parsed,
        "recommendations": out,
    }
