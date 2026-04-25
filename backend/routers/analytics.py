"""HR Analytics endpoints — dashboard data + LangGraph chatbot."""
from __future__ import annotations

import logging
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from services import analytics_agent, analytics_service, semantic_cache
from services import auth as auth_svc
from services.analytics_service import Filters

router = APIRouter()
log = logging.getLogger(__name__)


def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


# ---------- dashboard ----------

@router.get("/filters")
def get_filters(_=Depends(_hr)):
    """Distinct values for filter dropdowns."""
    return analytics_service.filter_options()


@router.get("/dashboard")
def get_dashboard(
    department: Optional[str] = None,
    location: Optional[str] = None,
    employment_type: Optional[str] = None,
    work_mode: Optional[str] = None,
    _=Depends(_hr),
):
    """All KPIs + charts for the pre-loaded dashboard, in one shot."""
    filters = Filters(
        department=department,
        location=location,
        employment_type=employment_type,
        work_mode=work_mode,
    )
    return analytics_service.dashboard_bundle(filters)


# ---------- chatbot ----------

class ChatBody(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: Optional[str] = None


@router.post("/chat")
def post_chat(body: ChatBody, _=Depends(_hr)):
    q = body.question.strip()
    if not q:
        raise HTTPException(400, "question is required")
    try:
        return analytics_agent.answer(q, session_id=body.session_id)
    except Exception as e:
        # Surface the underlying failure in the chat bubble instead of a
        # generic 500 — much easier to debug during demos.
        log.exception("analytics agent failed")
        return {
            "session_id": body.session_id or "",
            "question": q,
            "answer": "",
            "sql": "",
            "columns": [],
            "rows": [],
            "row_count": 0,
            "chart": {"type": "empty"},
            "cache_hit": False,
            "cache_similarity": 0.0,
            "rag_hit": False,
            "rag_sources": [],
            "used_model": "",
            "error": f"{type(e).__name__}: {e}",
            "run_log": [{"node": "router", "error": traceback.format_exc()[-800:]}],
        }


@router.get("/chat/sessions")
def list_chat_sessions(_=Depends(_hr)):
    return analytics_agent.list_sessions(limit=30)


@router.get("/chat/sessions/{session_id}")
def get_chat_session(session_id: str, _=Depends(_hr)):
    msgs = analytics_agent.session_messages(session_id)
    if not msgs:
        raise HTTPException(404, "session not found")
    return {"session_id": session_id, "messages": msgs}


@router.post("/cache/clear")
def clear_cache(_=Depends(_hr)):
    """Demo helper — drop the semantic cache so the next question always
    hits the LLM. Useful when showing the cache-hit demo."""
    ok = semantic_cache.clear()
    return {"ok": ok}
