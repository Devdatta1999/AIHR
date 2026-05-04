"""HR Queries service — policy-grounded LLM answers + ticket persistence.

RAG path:
    1. Embed the question with the same model used for the policy KB.
    2. Top-k search against Qdrant collection `hr_policy_knowledge`.
    3. Compose a strict system prompt that tells the LLM to answer ONLY from
       the retrieved policy chunks; if the answer isn't in the policy, say
       so explicitly. We use HF_ANALYTICS_MODEL_ID (Llama 3.3 70B) because
       it follows grounding instructions much better than the 8B for
       policy-style Q&A.

If Qdrant is unreachable or returns nothing, we still call the LLM but with
an empty-context prompt that asks it to apologize and route the user to
People Operations rather than guess. Safer than hallucinating policy.
"""
from __future__ import annotations

import datetime as _dt
import json
import logging
from typing import Any, Optional

import httpx
from psycopg.types.json import Json
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

from config import (
    EMBEDDING_MODEL,
    HF_ANALYTICS_MODEL_ID,
    HF_API_TOKEN,
    QDRANT_URL,
)
from db import get_conn

log = logging.getLogger(__name__)

HR_POLICY_COLLECTION = "hr_policy_knowledge"
HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"

# Soft floor — questions worded loosely still hit. The LLM decides whether to
# actually use a chunk, and the fallback message handles the empty case.
MIN_SCORE = 0.25
TOP_K = 6


# ============================================================
# RAG — retrieval
# ============================================================

_model: Optional[SentenceTransformer] = None
_client: Optional[QdrantClient] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def _get_client() -> Optional[QdrantClient]:
    global _client
    if _client is None:
        try:
            _client = QdrantClient(url=QDRANT_URL, timeout=5.0)
        except Exception:
            _client = None
    return _client


def search_policy(query: str, k: int = TOP_K) -> list[dict[str, Any]]:
    """Return top-k policy chunks for `query`, each `{source, section, content, _score}`."""
    if not query.strip():
        return []
    client = _get_client()
    if client is None:
        return []
    try:
        existing = {c.name for c in client.get_collections().collections}
        if HR_POLICY_COLLECTION not in existing:
            log.warning("Qdrant collection %s not found", HR_POLICY_COLLECTION)
            return []
        vec = _get_model().encode([query], normalize_embeddings=True)[0].tolist()
        hits = client.search(
            collection_name=HR_POLICY_COLLECTION,
            query_vector=vec,
            limit=k,
            with_payload=True,
        )
    except Exception:
        log.exception("HR policy search failed")
        return []

    out: list[dict[str, Any]] = []
    for h in hits:
        if (h.score or 0.0) < MIN_SCORE:
            continue
        payload = dict(h.payload or {})
        payload["_score"] = float(h.score)
        out.append(payload)
    return out


def hits_summary(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compact list of citations for the API response & DB column."""
    return [
        {
            "source": h.get("source"),
            "section": h.get("section"),
            "score": round(float(h.get("_score", 0.0)), 3),
        }
        for h in hits
    ]


def _format_context(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return "(no policy excerpt retrieved)"
    parts = []
    for i, h in enumerate(hits, 1):
        section = h.get("section", "?")
        content = h.get("content", "")
        parts.append(f"[{i}] (Section: {section})\n{content}")
    return "\n\n---\n\n".join(parts)


# ============================================================
# LLM — grounded answer
# ============================================================

SYSTEM_PROMPT = """You are an HR policy assistant for Nimbus Labs.

Answer the employee's question using ONLY the policy excerpts provided in the \
context block. Do not invent numbers, durations, eligibility rules, or contact \
methods that are not stated in the excerpts.

Rules:
- If the answer IS in the excerpts: respond in 2-4 short sentences. State the \
specific numbers/durations from the policy. End with a one-line citation in \
parentheses like: (See Section 3.1 — Annual sick leave entitlement).
- If the answer is NOT in the excerpts: reply with exactly one sentence saying \
you couldn't find this in the current HR handbook and recommend the employee \
email people-ops@nimbuslabs.example for clarification. Do not guess.
- Plain prose only — no markdown headers, no bullet lists, no preamble like \
"Based on the policy" or "According to the excerpts".
- Address the employee in second person ("you", "your")."""


def _call_llm(question: str, context_block: str) -> str:
    if not HF_API_TOKEN:
        raise RuntimeError("HF_API_TOKEN is not set in backend/.env")

    user_prompt = (
        f"EMPLOYEE QUESTION:\n{question.strip()}\n\n"
        f"POLICY EXCERPTS:\n{context_block}"
    )
    payload = {
        "model": HF_ANALYTICS_MODEL_ID,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 350,
        "temperature": 0.1,
    }
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    with httpx.Client(timeout=90.0) as client:
        r = client.post(HF_CHAT_URL, headers=headers, json=payload)
        r.raise_for_status()
        body = r.json()
    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        log.error("Unexpected LLM response shape: %s", json.dumps(body)[:400])
        return (
            "I couldn't generate an answer right now. Please email "
            "people-ops@nimbuslabs.example for a quick reply."
        )


def generate_ai_answer(question: str) -> dict[str, Any]:
    """Run the full RAG → LLM pipeline. Returns `{answer, sources}`."""
    hits = search_policy(question)
    context = _format_context(hits)
    answer = _call_llm(question, context)
    return {"answer": answer, "sources": hits_summary(hits)}


# ============================================================
# Persistence — tickets
# ============================================================

def _row_to_dict(r: dict[str, Any]) -> dict[str, Any]:
    """Normalize a hr_queries row for JSON output (timestamps, JSON cols)."""
    out = dict(r)
    for k in ("created_at", "updated_at", "ai_generated_at", "resolved_at"):
        v = out.get(k)
        if isinstance(v, _dt.datetime):
            out[k] = v.isoformat()
    return out


def list_open_count_by_status() -> dict[str, int]:
    """Tile counts for the HR dashboard."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT status, COUNT(*)::int AS n
               FROM applicants.hr_queries
               GROUP BY status"""
        ).fetchall()
        today_resolved = conn.execute(
            """SELECT COUNT(*)::int AS n
               FROM applicants.hr_queries
               WHERE status = 'resolved'
                 AND resolved_at::date = CURRENT_DATE"""
        ).fetchone()
    by_status = {r["status"]: r["n"] for r in rows}
    return {
        "open": by_status.get("open", 0),
        "in_progress": by_status.get("in_progress", 0),
        "resolved": by_status.get("resolved", 0),
        "resolved_today": (today_resolved or {}).get("n", 0),
    }


def list_tickets(
    *,
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    conds: list[str] = []
    params: list[Any] = []
    if status and status != "all":
        conds.append("status = %s")
        params.append(status)
    if category and category != "All Categories":
        conds.append("category = %s")
        params.append(category)
    if q:
        conds.append("(question ILIKE %s OR employee_name ILIKE %s)")
        like = f"%{q.strip()}%"
        params.extend([like, like])

    where = (" WHERE " + " AND ".join(conds)) if conds else ""
    sql = f"""
        SELECT * FROM applicants.hr_queries
        {where}
        ORDER BY (status = 'resolved'), created_at DESC
        LIMIT %s
    """
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [_row_to_dict(r) for r in rows]


def list_tickets_for_employee(email: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT * FROM applicants.hr_queries
               WHERE LOWER(employee_email) = LOWER(%s)
               ORDER BY created_at DESC""",
            (email,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_ticket(query_id: int) -> Optional[dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM applicants.hr_queries WHERE query_id = %s",
            (query_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def create_ticket(
    *,
    applicant_id: Optional[int],
    staff_employee_id: Optional[int],
    employee_email: str,
    employee_name: str,
    employee_role: Optional[str],
    question: str,
    category: Optional[str],
    priority: str,
) -> dict[str, Any]:
    if priority not in ("low", "medium", "high"):
        priority = "medium"
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO applicants.hr_queries
                 (applicant_id, staff_employee_id, employee_email, employee_name,
                  employee_role, question, category, priority, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'open')
               RETURNING *""",
            (
                applicant_id, staff_employee_id, employee_email, employee_name,
                employee_role, question.strip(), category, priority,
            ),
        ).fetchone()
        conn.commit()
    return _row_to_dict(row)


def attach_ai_suggestion(
    query_id: int, *, answer: str, sources: list[dict[str, Any]]
) -> dict[str, Any]:
    """Cache the AI answer on the ticket and flip status → in_progress."""
    with get_conn() as conn:
        row = conn.execute(
            """UPDATE applicants.hr_queries
                  SET ai_suggestion = %s,
                      ai_sources = %s,
                      ai_generated_at = NOW(),
                      status = CASE WHEN status = 'open' THEN 'in_progress'
                                    ELSE status END,
                      updated_at = NOW()
                WHERE query_id = %s
            RETURNING *""",
            (answer, Json(sources), query_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise ValueError("ticket not found")
    return _row_to_dict(row)


def resolve_ticket(
    query_id: int,
    *,
    response_text: str,
    resolution_kind: str,
    resolved_by: Optional[str],
) -> dict[str, Any]:
    if resolution_kind not in ("ai", "edited", "manual"):
        raise ValueError("resolution_kind must be ai | edited | manual")
    if not response_text.strip():
        raise ValueError("response_text is required")
    with get_conn() as conn:
        row = conn.execute(
            """UPDATE applicants.hr_queries
                  SET hr_response = %s,
                      resolution_kind = %s,
                      resolved_by = %s,
                      resolved_at = NOW(),
                      status = 'resolved',
                      updated_at = NOW()
                WHERE query_id = %s
            RETURNING *""",
            (response_text.strip(), resolution_kind, resolved_by, query_id),
        ).fetchone()
        conn.commit()
    if not row:
        raise ValueError("ticket not found")
    return _row_to_dict(row)
