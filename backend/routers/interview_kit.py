from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_conn
from models.schemas import InterviewKit, InterviewKitRequest
from services import hiring_service, interview_kit_agent, onboarding as ob

router = APIRouter()


class AssignKitBody(BaseModel):
    kit_id: int
    # Either is enough; email is preferred (it links across employees.employees
    # and applicants.employees regardless of which schema the picker came from).
    employee_email: str | None = None
    employee_id: int | None = None


@router.get("/jobs")
def list_open_jobs():
    """All job postings (frontend filters on status if needed)."""
    return hiring_service.list_job_postings()


@router.get("/jobs/{job_id}/kit", response_model=InterviewKit)
def get_kit(job_id: int):
    kit = interview_kit_agent.get_latest_kit(job_id)
    if not kit:
        raise HTTPException(404, f"no kit for job {job_id}")
    return kit


@router.post("/generate", response_model=InterviewKit)
def generate(body: InterviewKitRequest):
    job = hiring_service.get_job_posting(body.job_id)
    if not job:
        raise HTTPException(404, f"job {body.job_id} not found")

    state = interview_kit_agent.generate_kit(body.job_id)
    if state.get("error"):
        raise HTTPException(500, state["error"])

    kit = interview_kit_agent.get_latest_kit(body.job_id)
    if not kit:
        raise HTTPException(500, "kit generated but not retrievable")
    return kit


@router.get("/employees")
def list_employees():
    return ob.list_employees()


@router.post("/assign")
def assign_kit(body: AssignKitBody):
    email = (body.employee_email or "").strip().lower() or None
    if not email and not body.employee_id:
        raise HTTPException(400, "employee_email or employee_id required")

    with get_conn() as conn:
        if not email:
            # Resolve email from one of the two employee tables.
            for table in ("applicants.employees", "employees.employees"):
                r = conn.execute(
                    f"SELECT email FROM {table} WHERE employee_id = %s",
                    (body.employee_id,),
                ).fetchone()
                if r and r.get("email"):
                    email = r["email"].lower()
                    break
            if not email:
                raise HTTPException(404, f"employee {body.employee_id} not found")

        row = conn.execute(
            """
            INSERT INTO applicants.interview_kit_assignments
              (kit_id, employee_email, employee_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (kit_id, employee_email) DO UPDATE
              SET assigned_at = NOW(),
                  employee_id = COALESCE(EXCLUDED.employee_id,
                                         applicants.interview_kit_assignments.employee_id)
            RETURNING assignment_id, kit_id, employee_id, employee_email, assigned_at
            """,
            (body.kit_id, email, body.employee_id),
        ).fetchone()
        conn.commit()
    if row.get("assigned_at"):
        row["assigned_at"] = row["assigned_at"].isoformat()
    return row
