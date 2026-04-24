"""Employee-portal endpoints: offer, onboarding, interview kits."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_conn
from services import auth as auth_svc
from services import onboarding as ob

router = APIRouter()


def _identity(identity=Depends(auth_svc.current_identity)):
    return auth_svc.require_employee(identity)


def _applicant_id(identity: dict[str, Any]) -> int:
    aid = identity.get("applicant_id")
    if not aid:
        raise HTTPException(400, "no applicant linked to this employee login")
    return aid


# ---------- profile ----------

@router.get("/me")
def me(identity=Depends(_identity)):
    aid = identity.get("applicant_id")
    with get_conn() as conn:
        applicant = None
        if aid:
            applicant = conn.execute(
                """
                SELECT a.applicant_id, a.first_name, a.last_name, a.email,
                       a.phone, a.country, a.city, a.state, a.status,
                       a.total_years_experience, a.date_of_birth,
                       a.home_address, a.emergency_contact_name,
                       a.emergency_contact_phone, a.tshirt_size,
                       j.job_id, j.job_title, j.department, j.location,
                       j.employment_type
                FROM applicants.applicants a
                LEFT JOIN applicants.job_postings j ON j.job_id = a.job_id
                WHERE a.applicant_id = %s
                """,
                (aid,),
            ).fetchone()
        employee = conn.execute(
            """
            SELECT employee_id, job_title, department, location, country,
                   employment_type, start_date, onboarded_at
            FROM applicants.employees
            WHERE email = %s
            """,
            (identity["email"],),
        ).fetchone()
    if applicant and applicant.get("date_of_birth"):
        applicant["date_of_birth"] = applicant["date_of_birth"].isoformat()
    if employee:
        for k in ("start_date", "onboarded_at"):
            if employee.get(k):
                employee[k] = employee[k].isoformat()
    return {"identity": identity, "applicant": applicant, "employee": employee}


# ---------- offer ----------

@router.get("/offer")
def get_offer(identity=Depends(_identity)):
    aid = _applicant_id(identity)
    sql = """
        SELECT o.offer_id, o.job_id, o.base_salary, o.currency, o.start_date,
               o.subject, o.html_body, o.status, o.response, o.responded_at,
               o.created_at,
               j.job_title, j.department, j.location
        FROM applicants.offer_letters o
        LEFT JOIN applicants.job_postings j ON j.job_id = o.job_id
        WHERE o.applicant_id = %s AND o.status = 'sent'
        ORDER BY o.created_at DESC LIMIT 1
    """
    with get_conn() as conn:
        row = conn.execute(sql, (aid,)).fetchone()
    if not row:
        raise HTTPException(404, "no offer letter on file")
    for k in ("start_date", "responded_at", "created_at"):
        if row.get(k):
            row[k] = row[k].isoformat()
    row["base_salary"] = float(row["base_salary"]) if row.get("base_salary") is not None else None
    return row


class OfferResponse(BaseModel):
    offer_id: int
    response: str  # 'accepted' | 'rejected'
    note: Optional[str] = None


@router.post("/offer/respond")
def respond_offer(body: OfferResponse, identity=Depends(_identity)):
    if body.response not in ("accepted", "rejected"):
        raise HTTPException(400, "response must be 'accepted' or 'rejected'")
    aid = _applicant_id(identity)

    with get_conn() as conn:
        offer = conn.execute(
            "SELECT offer_id, applicant_id FROM applicants.offer_letters WHERE offer_id = %s",
            (body.offer_id,),
        ).fetchone()
        if not offer or offer["applicant_id"] != aid:
            raise HTTPException(404, "offer not found")
        conn.execute(
            """
            UPDATE applicants.offer_letters
            SET response = %s, responded_at = NOW(), response_note = %s
            WHERE offer_id = %s
            """,
            (body.response, body.note, body.offer_id),
        )
        new_status = "Ready for Onboarding" if body.response == "accepted" else "Offer Declined"
        conn.execute(
            "UPDATE applicants.applicants SET status = %s, updated_at = NOW() WHERE applicant_id = %s",
            (new_status, aid),
        )
        conn.commit()
    return {"ok": True, "status": new_status}


# ---------- onboarding ----------

@router.get("/onboarding")
def get_onboarding(identity=Depends(_identity)):
    aid = _applicant_id(identity)
    tracker = ob.get_tracker(aid)
    if not tracker:
        return {"tracker": None, "documents": []}
    doc_ids = tracker.get("document_ids") or []
    documents: list[dict[str, Any]] = []
    for did in doc_ids:
        d = ob.get_document(int(did))
        if d:
            documents.append({
                "doc_id": d["doc_id"],
                "title": d["title"],
                "description": d.get("description"),
                "country": d.get("country"),
                "original_name": d.get("original_name"),
                "mime_type": d.get("mime_type"),
                "size_bytes": d.get("size_bytes"),
            })
    return {"tracker": tracker, "documents": documents}


class ProfileBody(BaseModel):
    date_of_birth: Optional[str] = None
    home_address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    tax_id: Optional[str] = None
    bank_account: Optional[str] = None
    tshirt_size: Optional[str] = None
    phone: Optional[str] = None


@router.post("/onboarding/profile")
def save_profile(body: ProfileBody, identity=Depends(_identity)):
    aid = _applicant_id(identity)
    ob.update_profile(aid, body.model_dump(exclude_none=True))
    return {"ok": True}


@router.post("/onboarding/accept")
def accept_onboarding(identity=Depends(_identity)):
    aid = _applicant_id(identity)
    tracker = ob.get_tracker(aid)
    if not tracker:
        raise HTTPException(404, "no onboarding tracker yet")
    employee = ob.accept_onboarding(aid)
    return {"ok": True, "employee": employee}


# ---------- upcoming interviews (as interviewer) ----------

@router.get("/interviews/upcoming")
def list_upcoming_interviews(identity=Depends(_identity)):
    """Interviews the signed-in employee is slotted as an interviewer on.
    Upcoming = scheduled_at >= now(). Sorted ascending."""
    email = (identity.get("email") or "").lower()
    sql = """
        SELECT i.invite_id, i.kind, i.scheduled_at, i.duration_minutes,
               i.timezone, i.meet_link, i.status, i.interviewer_emails,
               a.applicant_id, a.first_name, a.last_name, a.email AS candidate_email,
               j.job_id, j.job_title, j.department
        FROM applicants.interview_invitations i
        JOIN applicants.applicants a ON a.applicant_id = i.applicant_id
        LEFT JOIN applicants.job_postings j ON j.job_id = i.job_id
        WHERE %s = ANY(i.interviewer_emails)
          AND i.scheduled_at >= NOW() - INTERVAL '2 hours'
          AND (i.status IS NULL OR i.status <> 'Failed')
        ORDER BY i.scheduled_at ASC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (email,)).fetchall()
    for r in rows:
        if r.get("scheduled_at"):
            r["scheduled_at"] = r["scheduled_at"].isoformat()
        r["candidate_name"] = f"{r.pop('first_name', '')} {r.pop('last_name', '')}".strip()
    return rows


# ---------- interview kits ----------

@router.get("/interview-kits")
def list_kits(identity=Depends(_identity)):
    email = (identity.get("email") or "").lower()
    sql = """
        SELECT k.kit_id, k.job_id, k.model_id, k.behavioral, k.technical,
               k.overall_notes, k.created_at,
               j.job_title, j.department,
               ka.assigned_at
        FROM applicants.interview_kit_assignments ka
        JOIN applicants.interview_kits k ON k.kit_id = ka.kit_id
        LEFT JOIN applicants.job_postings j ON j.job_id = k.job_id
        WHERE LOWER(ka.employee_email) = %s
        ORDER BY ka.assigned_at DESC
    """
    with get_conn() as conn:
        rows = conn.execute(sql, (email,)).fetchall()
    for r in rows:
        for k in ("created_at", "assigned_at"):
            if r.get(k):
                r[k] = r[k].isoformat()
    return rows
