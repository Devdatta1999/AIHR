"""LangGraph agent that generates an interview-question kit for one job.

Flow:
    fetch_job -> retrieve_company_context (Qdrant RAG) -> web_research (Tavily)
      -> generate_kit (LLM, structured JSON) -> persist (Postgres)

Persists a row in `applicants.interview_kits` with the kit, rag sources,
web sources, and a compact run log so runs are reproducible / debuggable.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Optional, TypedDict

import httpx
from langgraph.graph import END, StateGraph
from psycopg.types.json import Json

from config import HF_API_TOKEN, HF_MODEL_ID
from db import get_conn
from services import hiring_service, rag, web_search

HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"


class KitState(TypedDict, total=False):
    job_id: int
    job: dict[str, Any]
    rag_hits: list[dict[str, Any]]
    web_hits: list[dict[str, Any]]
    kit: dict[str, Any]
    run_log: list[dict[str, Any]]
    error: Optional[str]


# ---------- helpers ----------

def _log(state: KitState, node: str, **fields: Any) -> list[dict[str, Any]]:
    entry = {"node": node, "at": datetime.now(timezone.utc).isoformat(), **fields}
    return [*state.get("run_log", []), entry]


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


def _call_hf(messages: list[dict[str, str]], max_tokens: int = 1600) -> dict[str, Any]:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not set in backend/.env")
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {
        "model": HF_MODEL_ID,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    with httpx.Client(timeout=90.0) as client:
        r = client.post(HF_CHAT_URL, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


# ---------- nodes ----------

def _node_fetch_job(state: KitState) -> KitState:
    job = hiring_service.get_job_posting(state["job_id"])
    if not job:
        return {**state, "error": f"job {state['job_id']} not found"}
    return {
        **state,
        "job": job,
        "run_log": _log(state, "fetch_job", job_title=job.get("job_title")),
    }


def _node_retrieve_context(state: KitState) -> KitState:
    if state.get("error"):
        return state
    job = state["job"]
    queries = [
        "company mission values leadership principles",
        "interview bar culture fit leadership signals",
        "tech stack engineering approach projects",
        f"{job.get('job_title') or ''} {job.get('department') or ''} role expectations",
    ]
    hits = rag.search_multi(queries, k_per_query=3, k_total=8)
    return {
        **state,
        "rag_hits": hits,
        "run_log": _log(state, "retrieve_context", hits=len(hits)),
    }


def _node_web_research(state: KitState) -> KitState:
    if state.get("error"):
        return state
    job = state["job"]
    title = job.get("job_title") or ""
    skills = job.get("must_have_skills") or ""
    query = f"{title} interview questions {skills}".strip()
    results = web_search.search(query, max_results=4)
    return {
        **state,
        "web_hits": results,
        "run_log": _log(state, "web_research", query=query, hits=len(results)),
    }


def _build_messages(state: KitState) -> list[dict[str, str]]:
    job = state["job"]
    jd = {
        "job_title": job.get("job_title"),
        "department": job.get("department"),
        "job_level": job.get("job_level"),
        "min_years_experience": float(job["min_years_experience"])
            if job.get("min_years_experience") is not None else None,
        "job_summary": job.get("job_summary"),
        "responsibilities": job.get("responsibilities"),
        "requirements": job.get("requirements"),
        "must_have_skills": job.get("must_have_skills"),
        "good_to_have_skills": job.get("good_to_have_skills"),
    }
    rag_ctx = rag.format_context(state.get("rag_hits", []))
    web_ctx = web_search.format_results(state.get("web_hits", []))

    system = (
        "You are a senior hiring manager at the company. Design an interview "
        "kit for one open role. Ground every behavioral question in the "
        "COMPANY CONTEXT (mission, values, leadership principles, interview "
        "bar). Ground technical questions in the JOB DESCRIPTION and, where "
        "useful, the WEB CONTEXT. For each question include: (a) the question "
        "text, (b) 1-2 lines on the signal you are probing, (c) one 'good "
        "answer looks like' cue, (d) one follow-up. Return ONLY valid JSON."
    )

    schema = {
        "behavioral": {
            "culture_fit": [
                {"question": "string", "signal": "string", "good_answer": "string", "follow_up": "string"}
            ],
            "leadership": [
                {"question": "string", "signal": "string", "good_answer": "string", "follow_up": "string"}
            ],
            "situational": [
                {"question": "string", "signal": "string", "good_answer": "string", "follow_up": "string"}
            ],
        },
        "technical": [
            {"question": "string", "skill": "string", "difficulty": "easy|medium|hard",
             "signal": "string", "good_answer": "string", "follow_up": "string"}
        ],
        "overall_notes": "string (3-4 sentences: role-specific calibration guidance)",
    }

    user = (
        "JOB DESCRIPTION:\n"
        f"{json.dumps(jd, default=str, indent=2)}\n\n"
        "COMPANY CONTEXT (retrieved from internal docs):\n"
        f"{rag_ctx}\n\n"
        "WEB CONTEXT (public interview resources):\n"
        f"{web_ctx}\n\n"
        "Produce exactly: 2 culture_fit, 2 leadership, 2 situational behavioral "
        "questions, and 5 technical questions (mix of difficulty, covering the "
        "must-have skills). Return JSON in this exact shape:\n"
        f"{json.dumps(schema, indent=2)}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _normalize_kit(obj: dict[str, Any]) -> dict[str, Any]:
    beh = obj.get("behavioral") or {}
    out = {
        "behavioral": {
            "culture_fit": beh.get("culture_fit") or [],
            "leadership": beh.get("leadership") or [],
            "situational": beh.get("situational") or [],
        },
        "technical": obj.get("technical") or [],
        "overall_notes": obj.get("overall_notes") or "",
    }
    return out


def _node_generate(state: KitState) -> KitState:
    if state.get("error"):
        return state
    messages = _build_messages(state)
    try:
        raw = _call_hf(messages)
    except Exception as e:
        return {**state, "error": f"LLM call failed: {e}",
                "run_log": _log(state, "generate", error=str(e))}

    try:
        content = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return {**state, "error": "unexpected LLM response shape",
                "run_log": _log(state, "generate", error="bad shape")}

    parsed = _extract_json(content)
    if not parsed:
        return {**state, "error": "LLM did not return JSON",
                "run_log": _log(state, "generate", error="no json")}

    kit = _normalize_kit(parsed)
    return {
        **state,
        "kit": kit,
        "run_log": _log(
            state,
            "generate",
            behavioral_counts={k: len(v) for k, v in kit["behavioral"].items()},
            technical_count=len(kit["technical"]),
        ),
    }


def _node_persist(state: KitState) -> KitState:
    if state.get("error") or not state.get("kit"):
        _record_run(state, status="failed")
        return state
    _record_run(state, status="ready")
    return {**state, "run_log": _log(state, "persist", status="ready")}


def _record_run(state: KitState, status: str) -> None:
    rag_sources = [
        {"source": h.get("source"), "section": h.get("section"), "score": h.get("_score")}
        for h in state.get("rag_hits", [])
    ]
    web_sources = [
        {"title": h.get("title"), "url": h.get("url")}
        for h in state.get("web_hits", [])
    ]
    sql = """
        INSERT INTO applicants.interview_kits
            (job_id, model_id, behavioral, technical, overall_notes,
             rag_sources, web_sources, run_log, status, error_message)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING kit_id
    """
    kit = state.get("kit") or {"behavioral": {}, "technical": []}
    with get_conn() as conn:
        conn.execute(
            sql,
            (
                state["job_id"],
                HF_MODEL_ID,
                Json(kit.get("behavioral") or {}),
                Json(kit.get("technical") or []),
                kit.get("overall_notes") or None,
                Json(rag_sources),
                Json(web_sources),
                Json(state.get("run_log", [])),
                status,
                state.get("error"),
            ),
        )
        conn.commit()


# ---------- graph ----------

def _build_graph():
    g = StateGraph(KitState)
    g.add_node("fetch_job", _node_fetch_job)
    g.add_node("retrieve_context", _node_retrieve_context)
    g.add_node("web_research", _node_web_research)
    g.add_node("generate", _node_generate)
    g.add_node("persist", _node_persist)
    g.set_entry_point("fetch_job")
    g.add_edge("fetch_job", "retrieve_context")
    g.add_edge("retrieve_context", "web_research")
    g.add_edge("web_research", "generate")
    g.add_edge("generate", "persist")
    g.add_edge("persist", END)
    return g.compile()


_GRAPH = _build_graph()


def generate_kit(job_id: int) -> KitState:
    return _GRAPH.invoke({"job_id": job_id, "run_log": []})


# ---------- DB read-side ----------

def get_latest_kit(job_id: int) -> Optional[dict[str, Any]]:
    sql = """
        SELECT kit_id, job_id, model_id, behavioral, technical, overall_notes,
               rag_sources, web_sources, status, error_message, created_at
        FROM applicants.interview_kits
        WHERE job_id = %s AND status = 'ready'
        ORDER BY created_at DESC
        LIMIT 1
    """
    with get_conn() as conn:
        row = conn.execute(sql, (job_id,)).fetchone()
    if row and row.get("created_at"):
        row["created_at"] = row["created_at"].isoformat()
    return row
