"""LangGraph-powered candidate shortlisting agent.

Graph flow:
    fetch_job  -> fetch_applicant  -> evaluate (LLM)  -> persist
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional, TypedDict

import httpx
from langgraph.graph import StateGraph, END

from config import HF_API_TOKEN, HF_MODEL_ID
from services import hiring_service


HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"


class ShortlistState(TypedDict, total=False):
    job_id: int
    applicant_id: int
    job: dict[str, Any]
    applicant: dict[str, Any]
    raw_response: dict[str, Any]
    evaluation: dict[str, Any]
    error: Optional[str]


# ---------- Nodes ----------

def _node_fetch_job(state: ShortlistState) -> ShortlistState:
    job = hiring_service.get_job_posting(state["job_id"])
    if not job:
        return {**state, "error": f"job {state['job_id']} not found"}
    return {**state, "job": job}


def _node_fetch_applicant(state: ShortlistState) -> ShortlistState:
    bundle = hiring_service.fetch_applicant_bundle_for_llm(state["applicant_id"])
    if not bundle:
        return {**state, "error": f"applicant {state['applicant_id']} not found"}
    return {**state, "applicant": bundle}


def _build_prompt(job: dict[str, Any], applicant: dict[str, Any]) -> list[dict[str, str]]:
    jd = {
        "job_title": job.get("job_title"),
        "department": job.get("department"),
        "job_level": job.get("job_level"),
        "min_years_experience": float(job["min_years_experience"])
            if job.get("min_years_experience") is not None else None,
        "preferred_country": job.get("preferred_country"),
        "job_summary": job.get("job_summary"),
        "responsibilities": job.get("responsibilities"),
        "requirements": job.get("requirements"),
        "must_have_skills": job.get("must_have_skills"),
        "good_to_have_skills": job.get("good_to_have_skills"),
        "education_requirement": job.get("education_requirement"),
    }
    system = (
        "You are an expert technical recruiter. Evaluate a candidate against a "
        "job description across six facets: skills, experience, projects, education, "
        "certifications, achievements. Score each facet 0-100 and write one "
        "grounded sentence of reasoning. Then give an overall_score 0-100 "
        "(weighted judgement, not a simple average) and a short summary. "
        "Return ONLY valid JSON matching the schema; no prose outside the JSON."
    )
    schema = {
        "overall_score": "int 0-100",
        "summary": "string",
        "skills": {"score": "int 0-100", "reason": "string"},
        "experience": {"score": "int 0-100", "reason": "string"},
        "projects": {"score": "int 0-100", "reason": "string"},
        "education": {"score": "int 0-100", "reason": "string"},
        "certifications": {"score": "int 0-100", "reason": "string"},
        "achievements": {"score": "int 0-100", "reason": "string"},
    }
    user = (
        "JOB DESCRIPTION:\n"
        f"{json.dumps(jd, default=str, indent=2)}\n\n"
        "CANDIDATE PROFILE:\n"
        f"{json.dumps(applicant, default=str, indent=2)}\n\n"
        "Return JSON in exactly this shape:\n"
        f"{json.dumps(schema, indent=2)}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _call_hf(messages: list[dict[str, str]]) -> dict[str, Any]:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not set in backend/.env")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "model": HF_MODEL_ID,
        "messages": messages,
        "max_tokens": 900,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=60.0) as client:
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
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return {}


def _clamp(v: Any) -> Optional[int]:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, n))


def _normalize(obj: dict[str, Any]) -> dict[str, Any]:
    facets = ("skills", "experience", "projects", "education", "certifications", "achievements")
    out: dict[str, Any] = {
        "overall_score": _clamp(obj.get("overall_score")),
        "summary": obj.get("summary"),
    }
    for f in facets:
        sub = obj.get(f) or {}
        if isinstance(sub, (int, float)):
            out[f] = {"score": _clamp(sub), "reason": None}
        else:
            out[f] = {"score": _clamp(sub.get("score")), "reason": sub.get("reason")}
    return out


def _node_evaluate(state: ShortlistState) -> ShortlistState:
    if state.get("error"):
        return state
    messages = _build_prompt(state["job"], state["applicant"])
    try:
        raw = _call_hf(messages)
    except Exception as e:
        return {**state, "error": f"LLM call failed: {e}"}

    content = ""
    try:
        content = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return {**state, "raw_response": raw, "error": "unexpected LLM response shape"}

    parsed = _extract_json(content)
    if not parsed:
        return {**state, "raw_response": raw, "error": "LLM did not return JSON"}

    return {**state, "raw_response": raw, "evaluation": _normalize(parsed)}


def _node_persist(state: ShortlistState) -> ShortlistState:
    if state.get("error") or not state.get("evaluation"):
        return state
    hiring_service.upsert_evaluation(
        job_id=state["job_id"],
        applicant_id=state["applicant_id"],
        evaluation=state["evaluation"],
        model_id=HF_MODEL_ID,
        raw=state.get("raw_response", {}),
    )
    return state


# ---------- Graph ----------

def _build_graph():
    g = StateGraph(ShortlistState)
    g.add_node("fetch_job", _node_fetch_job)
    g.add_node("fetch_applicant", _node_fetch_applicant)
    g.add_node("evaluate", _node_evaluate)
    g.add_node("persist", _node_persist)
    g.set_entry_point("fetch_job")
    g.add_edge("fetch_job", "fetch_applicant")
    g.add_edge("fetch_applicant", "evaluate")
    g.add_edge("evaluate", "persist")
    g.add_edge("persist", END)
    return g.compile()


_GRAPH = _build_graph()


def score_candidate(job_id: int, applicant_id: int) -> ShortlistState:
    """Run the LangGraph agent for one (job, applicant) pair."""
    return _GRAPH.invoke({"job_id": job_id, "applicant_id": applicant_id})
