"""HR Queries router — both HR-side and employee-side endpoints.

HR endpoints (require role=hr):
    GET  /hr-queries/                  list tickets (filterable)
    GET  /hr-queries/{id}              fetch one ticket
    POST /hr-queries/{id}/ai-suggest   run RAG → LLM and cache the answer
    POST /hr-queries/{id}/resolve      send a final response (ai|edited|manual)

Employee endpoints (require role=employee):
    POST /hr-queries/mine              raise a new ticket
    GET  /hr-queries/mine              list this employee's own tickets
                                       (resolved tickets carry hr_response)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import get_conn
from services import auth as auth_svc
from services import hr_queries as hq

router = APIRouter()
log = logging.getLogger(__name__)


# ---------- auth deps ----------

def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


def _employee(identity=Depends(auth_svc.current_identity)):
    return auth_svc.require_employee(identity)


# ============================================================
# HR-side: list / read / AI-suggest / resolve
# ============================================================

@router.get("/")
def list_tickets(
    status: Optional[str] = Query(None, description="open | in_progress | resolved | all"),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    _=Depends(_hr),
):
    tickets = hq.list_tickets(status=status, category=category, q=q, limit=limit)
    counts = hq.list_open_count_by_status()
    return {"tickets": tickets, "counts": counts}


@router.get("/{query_id:int}")
def get_ticket(query_id: int, _=Depends(_hr)):
    t = hq.get_ticket(query_id)
    if not t:
        raise HTTPException(404, "ticket not found")
    return t


@router.post("/{query_id:int}/ai-suggest")
def ai_suggest(query_id: int, _=Depends(_hr)):
    """Run RAG + LLM and cache the suggestion on the ticket.

    Returns the updated ticket so the UI can render the AI answer + sources.
    Re-running is allowed (overwrites the cached suggestion) so HR can
    refresh the answer if they re-edit the policy.
    """
    t = hq.get_ticket(query_id)
    if not t:
        raise HTTPException(404, "ticket not found")
    try:
        result = hq.generate_ai_answer(t["question"])
    except Exception as e:
        log.exception("AI suggest failed for ticket %s", query_id)
        raise HTTPException(502, f"AI generation failed: {e}")
    return hq.attach_ai_suggestion(
        query_id, answer=result["answer"], sources=result["sources"]
    )


class ResolveBody(BaseModel):
    response_text: str = Field(..., min_length=1)
    resolution_kind: str  # "ai" | "edited" | "manual"


@router.post("/{query_id:int}/resolve")
def resolve(query_id: int, body: ResolveBody, identity=Depends(_hr)):
    try:
        return hq.resolve_ticket(
            query_id,
            response_text=body.response_text,
            resolution_kind=body.resolution_kind,
            resolved_by=identity.get("email"),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ============================================================
# Employee-side: create / list mine
# ============================================================

class CreateTicketBody(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    category: Optional[str] = None
    priority: str = "medium"  # low | medium | high


def _employee_snapshot(identity: dict[str, Any]) -> dict[str, Any]:
    """Look up name + role for the signed-in employee at submit time.

    We snapshot these into the ticket so the HR list shows useful labels even
    if the employee record changes later.
    """
    email = identity.get("email")
    aid = identity.get("applicant_id")
    snapshot = {
        "applicant_id": aid,
        "staff_employee_id": None,
        "employee_email": email,
        "employee_name": identity.get("name") or email or "Employee",
        "employee_role": None,
    }
    with get_conn() as conn:
        emp = conn.execute(
            """SELECT first_name, last_name, job_title, department, staff_employee_id
                 FROM applicants.employees
                WHERE LOWER(email) = LOWER(%s)""",
            (email,),
        ).fetchone()
        if emp:
            snapshot["employee_name"] = (
                f"{emp.get('first_name') or ''} {emp.get('last_name') or ''}".strip()
                or snapshot["employee_name"]
            )
            snapshot["employee_role"] = emp.get("job_title")
            snapshot["staff_employee_id"] = emp.get("staff_employee_id")
            return snapshot

        # Fall back to applicant row if portal user hasn't been bridged.
        if aid:
            ap = conn.execute(
                """SELECT a.first_name, a.last_name, j.job_title
                     FROM applicants.applicants a
                LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
                    WHERE a.applicant_id = %s""",
                (aid,),
            ).fetchone()
            if ap:
                snapshot["employee_name"] = (
                    f"{ap.get('first_name') or ''} {ap.get('last_name') or ''}".strip()
                    or snapshot["employee_name"]
                )
                snapshot["employee_role"] = ap.get("job_title")
    return snapshot


@router.post("/mine")
def create_my_ticket(body: CreateTicketBody, identity=Depends(_employee)):
    snap = _employee_snapshot(identity)
    return hq.create_ticket(
        applicant_id=snap["applicant_id"],
        staff_employee_id=snap["staff_employee_id"],
        employee_email=snap["employee_email"],
        employee_name=snap["employee_name"],
        employee_role=snap["employee_role"],
        question=body.question,
        category=body.category,
        priority=body.priority,
    )


@router.get("/mine")
def list_my_tickets(identity=Depends(_employee)):
    email = identity.get("email")
    if not email:
        raise HTTPException(400, "no email on token")
    return {"tickets": hq.list_tickets_for_employee(email)}
