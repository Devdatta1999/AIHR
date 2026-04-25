"""HR Team Formation router.

Flow exposed to the frontend:

    POST /team-formation/parse      multipart PDF upload -> parsed requirements + run_id
    GET  /team-formation/runs/{id}  fetch one run + parsed requirements
    PUT  /team-formation/runs/{id}/requirements   HR-edited requirements before recommend
    POST /team-formation/runs/{id}/recommend      run the agent for all roles
    GET  /team-formation/runs/{id}/recommendations    fetch the latest persisted evaluations
    POST /team-formation/teams      save a confirmed team
    GET  /team-formation/teams      list saved teams
    GET  /team-formation/teams/{id} fetch one team with members
    GET  /team-formation/samples    list downloadable sample PDFs
    GET  /team-formation/samples/{file}  stream a sample PDF
"""
from __future__ import annotations

import logging
import re
import traceback
from pathlib import Path
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from services import auth as auth_svc
from services import team_formation_agent as agent
from services import team_formation_service as svc

router = APIRouter()
log = logging.getLogger(__name__)

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "data" / "sample_project_requirements"

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB


def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


def _email(identity: dict[str, Any]) -> Optional[str]:
    return (identity or {}).get("email")


# ============================================================
# Sample PDFs (download)
# ============================================================

@router.get("/samples")
def list_samples(_=Depends(_hr)):
    """List downloadable sample PDFs (for demo / testing)."""
    if not SAMPLE_DIR.exists():
        return {"samples": []}
    items = []
    for p in sorted(SAMPLE_DIR.glob("*.pdf")):
        items.append({
            "file_name": p.name,
            "size_bytes": p.stat().st_size,
            "download_url": f"/team-formation/samples/{p.name}",
        })
    return {"samples": items}


@router.get("/samples/{file_name}")
def download_sample(file_name: str, _=Depends(_hr)):
    # Anti-traversal — only allow exact filenames in the directory.
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.pdf", file_name):
        raise HTTPException(400, "invalid file name")
    path = SAMPLE_DIR / file_name
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "sample not found")
    return FileResponse(path, media_type="application/pdf", filename=file_name)


# ============================================================
# Parse a project requirements PDF
# ============================================================

@router.post("/parse")
async def parse_requirements(
    file: UploadFile = File(...),
    identity=Depends(_hr),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(400, "Uploaded file is empty")
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(400, f"PDF exceeds {MAX_PDF_BYTES // (1024*1024)} MB limit")

    try:
        result = agent.parse_project_pdf(pdf_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        log.exception("PDF parsing failed")
        raise HTTPException(500, f"Parser error: {e}")

    parsed = result["parsed"]
    run = svc.create_run(
        project_name=parsed.get("project_name") or "Untitled Project",
        project_summary=parsed.get("project_summary"),
        file_name=file.filename,
        raw_text=result.get("raw_text"),
        parsed_requirements=parsed,
        parser_model_id=(result.get("raw_response") or {}).get("model"),
        created_by=_email(identity),
    )
    return {"run": run, "requirements": parsed}


@router.get("/runs/{run_id}")
def get_run(run_id: int, _=Depends(_hr)):
    run = svc.get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    return run


@router.get("/runs")
def list_runs(_=Depends(_hr)):
    return {"runs": svc.list_runs()}


class RequirementsBody(BaseModel):
    requirements: dict[str, Any] = Field(..., description="Edited parsed_requirements JSON")


@router.put("/runs/{run_id}/requirements")
def update_requirements(run_id: int, body: RequirementsBody, _=Depends(_hr)):
    if not svc.get_run(run_id):
        raise HTTPException(404, "run not found")
    svc.update_run_requirements(run_id, body.requirements)
    return {"run": svc.get_run(run_id)}


# ============================================================
# Generate AI recommendations
# ============================================================

@router.post("/runs/{run_id}/recommend")
def generate_recommendations(run_id: int, _=Depends(_hr)):
    if not svc.get_run(run_id):
        raise HTTPException(404, "run not found")
    try:
        return agent.recommend_team(run_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        log.exception("team recommendation failed")
        # Surface a structured error so the UI can show it instead of a bare 500.
        return {
            "run_id": run_id,
            "error": f"{type(e).__name__}: {e}",
            "recommendations": {},
            "trace_tail": traceback.format_exc()[-600:],
        }


@router.get("/runs/{run_id}/recommendations")
def fetch_persisted_recommendations(run_id: int, _=Depends(_hr)):
    """Return whatever evaluations are already persisted for this run.

    Useful if the page reloads after recommend() — no need to re-run the LLM.
    """
    run = svc.get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")
    evals = svc.evaluations_for_run(run_id)

    grouped: dict[str, list[dict[str, Any]]] = {}
    for ev in evals:
        role = ev.get("role_designation") or "Unknown"
        grouped.setdefault(role, []).append({
            "employee": {
                "employee_id": ev["employee_id"],
                "employee_code": ev.get("employee_code"),
                "first_name": ev.get("first_name"),
                "last_name": ev.get("last_name"),
                "job_title": ev.get("job_title"),
                "employee_level": ev.get("employee_level"),
                "department_name": ev.get("department_name"),
                "location": ev.get("location"),
                "work_mode": ev.get("work_mode"),
                "bandwidth_percent": ev.get("bandwidth_percent"),
                "total_experience_years": ev.get("total_experience_years"),
                "current_project_count": ev.get("current_project_count"),
            },
            "evaluation": {
                "overall_score": ev.get("overall_score"),
                "summary": ev.get("summary"),
                "skills":         {"score": ev.get("skills_score"),         "reason": (ev.get("reasons") or {}).get("skills",         {}).get("reason")},
                "availability":   {"score": ev.get("availability_score"),   "reason": (ev.get("reasons") or {}).get("availability",   {}).get("reason")},
                "experience":     {"score": ev.get("experience_score"),     "reason": (ev.get("reasons") or {}).get("experience",     {}).get("reason")},
                "projects":       {"score": ev.get("projects_score"),       "reason": (ev.get("reasons") or {}).get("projects",       {}).get("reason")},
                "certifications": {"score": ev.get("certifications_score"), "reason": (ev.get("reasons") or {}).get("certifications", {}).get("reason")},
            },
        })

    # Stable ordering by score desc.
    for role in grouped:
        grouped[role].sort(key=lambda r: (r["evaluation"].get("overall_score") or 0), reverse=True)

    return {
        "run_id": run_id,
        "project_name": run.get("project_name"),
        "project_summary": run.get("project_summary"),
        "requirements": run.get("parsed_requirements") or {},
        "recommendations": grouped,
    }


# ============================================================
# Save / list / fetch teams
# ============================================================

class TeamMemberIn(BaseModel):
    employee_id: int
    role_designation: str
    fit_score: Optional[int] = None
    allocation_percent: Optional[float] = None


class CreateTeamBody(BaseModel):
    team_name: str = Field(..., min_length=2)
    project_name: Optional[str] = None
    project_summary: Optional[str] = None
    run_id: Optional[int] = None
    members: list[TeamMemberIn] = Field(..., min_length=1)
    requirements: Optional[dict[str, Any]] = None


@router.post("/teams")
def create_team(body: CreateTeamBody, identity=Depends(_hr)):
    project_name = body.project_name or body.team_name
    requirements = body.requirements
    if body.run_id and not requirements:
        run = svc.get_run(body.run_id)
        if run:
            requirements = run.get("parsed_requirements")
    try:
        team = svc.create_team(
            team_name=body.team_name.strip(),
            project_name=project_name.strip(),
            project_summary=body.project_summary,
            run_id=body.run_id,
            requirements=requirements,
            members=[m.model_dump() for m in body.members],
            created_by=_email(identity),
        )
    except Exception as e:
        msg = str(e)
        if "team_name" in msg.lower() and ("unique" in msg.lower() or "duplicate" in msg.lower()):
            raise HTTPException(409, "A team with this name already exists.")
        log.exception("team creation failed")
        raise HTTPException(500, f"Team creation failed: {e}")

    return svc.get_team(team["team_id"])


@router.get("/teams")
def list_teams(_=Depends(_hr)):
    return {"teams": svc.list_teams()}


@router.get("/teams/{team_id}")
def get_team(team_id: int, _=Depends(_hr)):
    t = svc.get_team(team_id)
    if not t:
        raise HTTPException(404, "team not found")
    return t
