"""HR-side onboarding endpoints: document library + tracker controls."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services import auth as auth_svc
from services import onboarding as ob

router = APIRouter()


def _hr(identity=Depends(auth_svc.current_identity)):
    auth_svc.require_hr(identity)
    return identity


# ---------- document library ----------

@router.get("/documents")
def list_documents(country: Optional[str] = None, _=Depends(_hr)):
    return ob.list_documents(country=country)


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    country: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    _=Depends(_hr),
):
    content = await file.read()
    if not content:
        raise HTTPException(400, "empty file")
    return ob.save_document(
        title=title,
        description=description,
        country=country,
        original_name=file.filename or "upload.bin",
        mime_type=file.content_type,
        content=content,
    )


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, _=Depends(_hr)):
    ok = ob.delete_document(doc_id)
    if not ok:
        raise HTTPException(404, f"document {doc_id} not found")
    return {"ok": True}


@router.get("/documents/{doc_id}/download")
def download_document(doc_id: int, identity=Depends(auth_svc.current_identity)):
    # Allowed for HR + the employee whose tracker includes this doc.
    result = ob.document_path(doc_id)
    if not result:
        raise HTTPException(404, "document not found")
    path, doc = result
    return FileResponse(
        path,
        media_type=doc.get("mime_type") or "application/octet-stream",
        filename=doc.get("original_name"),
    )


# ---------- queue + trackers ----------

@router.get("/ready")
def list_ready(_=Depends(_hr)):
    return ob.list_ready_applicants()


class StartTrackerBody(BaseModel):
    applicant_id: int
    welcome_message: Optional[str] = None
    document_ids: Optional[list[int]] = None  # override auto-selection


@router.post("/trackers")
def start_tracker(body: StartTrackerBody, _=Depends(_hr)):
    try:
        return ob.start_tracker(
            body.applicant_id,
            welcome_message=body.welcome_message,
            document_ids=body.document_ids,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/trackers/{applicant_id}")
def get_tracker(applicant_id: int, _=Depends(_hr)):
    tracker = ob.get_tracker(applicant_id)
    if not tracker:
        raise HTTPException(404, f"no tracker for applicant {applicant_id}")
    return tracker


@router.get("/employees")
def list_employees(_=Depends(_hr)):
    return ob.list_employees()


@router.post("/reset/{applicant_id}")
def reset_onboarding(applicant_id: int, _=Depends(_hr)):
    """Roll the applicant back to 'Offered' (clears tracker + employee row,
    re-pends the offer letter). Useful for re-running the demo end-to-end."""
    try:
        return ob.reset_onboarding(applicant_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
