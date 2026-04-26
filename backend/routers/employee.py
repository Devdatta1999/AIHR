"""Employee-portal endpoints: offer, onboarding, interview kits, payslips."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from db import get_conn
from services import auth as auth_svc
from services import onboarding as ob
from services import payroll as pr
from services.payslip_pdf import render_payslip_pdf

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

# ---------- my projects ----------

def _staff_employee_id(identity: dict[str, Any]) -> int:
    """Resolve the canonical HR roster id for the signed-in portal user."""
    email = (identity.get("email") or "").lower()
    with get_conn() as conn:
        row = conn.execute(
            "SELECT staff_employee_id FROM applicants.employees WHERE LOWER(email) = %s",
            (email,),
        ).fetchone()
    sid = (row or {}).get("staff_employee_id")
    if not sid:
        raise HTTPException(404, "no staff record linked to this account yet")
    return int(sid)


@router.get("/projects")
def list_my_projects(identity=Depends(_identity)):
    """Active and recent projects for the signed-in employee, with teammates."""
    sid = _staff_employee_id(identity)
    sql_assignments = """
        SELECT ep.employee_project_id, ep.project_id, ep.role_in_project,
               ep.allocation_percent, ep.start_date, ep.end_date,
               ep.assignment_status,
               p.project_name, p.description, p.priority, p.project_status,
               p.start_date AS project_start_date,
               p.end_date   AS project_end_date,
               p.required_bandwidth_percent,
               mgr.employee_id AS manager_employee_id,
               mgr.first_name  AS manager_first_name,
               mgr.last_name   AS manager_last_name,
               mgr.job_title   AS manager_job_title,
               mgr.email       AS manager_email
        FROM employees.employee_projects ep
        JOIN employees.projects p ON p.project_id = ep.project_id
        LEFT JOIN employees.employees mgr ON mgr.employee_id = p.project_manager_id
        WHERE ep.employee_id = %s
          AND ep.assignment_status IN ('Active', 'Planned', 'Completed')
        ORDER BY
            CASE ep.assignment_status WHEN 'Active' THEN 0 WHEN 'Planned' THEN 1 ELSE 2 END,
            COALESCE(ep.start_date, p.start_date) DESC
    """
    sql_teammates = """
        SELECT ep.project_id, ep.role_in_project, ep.allocation_percent,
               ep.assignment_status,
               e.employee_id, e.employee_code, e.first_name, e.last_name,
               e.job_title, e.employee_level, e.department_name,
               e.email, e.location, e.work_mode
        FROM employees.employee_projects ep
        JOIN employees.employees e ON e.employee_id = ep.employee_id
        WHERE ep.project_id = ANY(%s)
          AND ep.employee_id <> %s
          AND ep.assignment_status = 'Active'
        ORDER BY ep.project_id, e.first_name
    """
    with get_conn() as conn:
        assignments = conn.execute(sql_assignments, (sid,)).fetchall()
        project_ids = [a["project_id"] for a in assignments]
        teammates = (
            conn.execute(sql_teammates, (project_ids, sid)).fetchall()
            if project_ids else []
        )

    by_project: dict[int, list[dict[str, Any]]] = {}
    for t in teammates:
        pid = t.pop("project_id")
        by_project.setdefault(pid, []).append(t)

    projects: list[dict[str, Any]] = []
    for a in assignments:
        for k in ("start_date", "end_date", "project_start_date", "project_end_date"):
            if a.get(k):
                a[k] = a[k].isoformat()
        if a.get("allocation_percent") is not None:
            a["allocation_percent"] = float(a["allocation_percent"])
        if a.get("required_bandwidth_percent") is not None:
            a["required_bandwidth_percent"] = float(a["required_bandwidth_percent"])
        manager = None
        if a.get("manager_employee_id"):
            manager = {
                "employee_id": a.pop("manager_employee_id"),
                "first_name": a.pop("manager_first_name", None),
                "last_name": a.pop("manager_last_name", None),
                "job_title": a.pop("manager_job_title", None),
                "email": a.pop("manager_email", None),
            }
        else:
            for k in ("manager_employee_id", "manager_first_name",
                      "manager_last_name", "manager_job_title", "manager_email"):
                a.pop(k, None)
        a["manager"] = manager
        a["teammates"] = by_project.get(a["project_id"], [])
        projects.append(a)

    return {"staff_employee_id": sid, "projects": projects}


# ---------- payslips ----------

@router.get("/payslips")
def list_my_payslips(identity=Depends(_identity)):
    """All released payslips for the signed-in employee, newest first.

    Also returns a small summary block (YTD + last pay date) so the portal
    can render its top stats without a second round trip.
    """
    sid = _staff_employee_id(identity)
    payslips = pr.list_payslips_for_employee(sid)

    summary: dict[str, Any] = {
        "ytd_gross": 0.0,
        "ytd_tax": 0.0,
        "ytd_net": 0.0,
        "last_pay_date": None,
        "last_pay_period_label": None,
        "count": len(payslips),
    }
    if payslips:
        # Take YTD from the most recent run within the latest year.
        latest_year = payslips[0]["pay_period_year"]
        for p in payslips:
            if p["pay_period_year"] == latest_year:
                summary["ytd_gross"] = p.get("ytd_gross") or 0.0
                summary["ytd_tax"] = p.get("ytd_tax") or 0.0
                summary["ytd_net"] = p.get("ytd_net") or 0.0
                summary["last_pay_date"] = p.get("pay_date")
                summary["last_pay_period_label"] = p.get("pay_period_label")
                break
    return {
        "staff_employee_id": sid,
        "summary": summary,
        "payslips": payslips,
    }


@router.get("/payslips/{run_id}")
def get_my_payslip(run_id: int, identity=Depends(_identity)):
    sid = _staff_employee_id(identity)
    p = pr.get_payslip(run_id)
    if not p or p["staff_employee_id"] != sid:
        raise HTTPException(404, "payslip not found")
    return p


@router.get("/payslips/{run_id}/pdf")
def download_my_payslip(run_id: int, identity=Depends(_identity)):
    sid = _staff_employee_id(identity)
    p = pr.get_payslip(run_id)
    if not p or p["staff_employee_id"] != sid:
        raise HTTPException(404, "payslip not found")
    with get_conn() as conn:
        emp = conn.execute(
            """
            SELECT employee_id, employee_code, first_name, last_name, email,
                   job_title, department_name, location
            FROM employees.employees WHERE employee_id = %s
            """,
            (sid,),
        ).fetchone()
    pdf_bytes = render_payslip_pdf(p, employee=dict(emp) if emp else None)
    fname = f"payslip-{p['pay_period_year']}-{p['pay_period_month']:02d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


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
