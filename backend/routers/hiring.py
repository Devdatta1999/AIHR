from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from fastapi import APIRouter, HTTPException

from config import DEFAULT_EMPLOYEE_PASSWORD, GOOGLE_ORGANIZER_EMAIL, PORTAL_URL
from models.schemas import (
    InvitationRequest,
    InvitationResult,
    OfferLetterPreview,
    OfferLetterPreviewRequest,
    OfferLetterResult,
    OfferLetterSendRequest,
    ShortlistRequest,
    ShortlistResult,
    StatusUpdate,
)
from services import ai_agent, auth as auth_svc, google_calendar, hiring_service, offer_letter

router = APIRouter()


@router.get("/jobs")
def list_jobs():
    return hiring_service.list_job_postings()


@router.get("/jobs/{job_id}")
def get_job(job_id: int):
    job = hiring_service.get_job_posting(job_id)
    if not job:
        raise HTTPException(404, f"job {job_id} not found")
    return job


@router.get("/jobs/{job_id}/applicants")
def list_applicants(job_id: int):
    return hiring_service.list_applicants_for_job(job_id)


@router.get("/applicants/{applicant_id}")
def get_applicant(applicant_id: int):
    detail = hiring_service.get_applicant_detail(applicant_id)
    if not detail:
        raise HTTPException(404, f"applicant {applicant_id} not found")
    return detail


@router.patch("/applicants/{applicant_id}/status")
def patch_status(applicant_id: int, body: StatusUpdate):
    row = hiring_service.update_applicant_status(applicant_id, body.status)
    if not row:
        raise HTTPException(400, f"invalid status '{body.status}'")
    return row


@router.post("/shortlist", response_model=ShortlistResult)
def shortlist(body: ShortlistRequest):
    """SQL pre-filter, then run the LangGraph agent over the survivors."""
    job = hiring_service.get_job_posting(body.job_id)
    if not job:
        raise HTTPException(404, f"job {body.job_id} not found")

    filtered = hiring_service.prefilter_applicants(
        job_id=body.job_id,
        min_experience=body.min_experience,
        country=body.country,
        require_work_auth=body.require_work_auth,
        notice_period_max_days=body.notice_period_max_days,
    )
    # Only score applicants still in Applied/Under Review.
    to_score = [
        a for a in filtered
        if a["status"] in ("Applied", "Under Review")
    ]
    if body.limit:
        to_score = to_score[: body.limit]

    evaluated = 0
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(ai_agent.score_candidate, body.job_id, a["applicant_id"]): a
            for a in to_score
        }
        for fut in as_completed(futures):
            state = fut.result()
            if state.get("error"):
                errors.append(
                    f"applicant {state.get('applicant_id')}: {state['error']}"
                )
            else:
                evaluated += 1

    promoted = hiring_service.promote_top_to_shortlisted(body.job_id, limit=20)
    rejected = hiring_service.reject_remaining_applied(body.job_id)

    top = hiring_service.list_applicants_for_job(body.job_id)[:20]
    for r in top:
        if r.get("application_date") and not isinstance(r["application_date"], str):
            r["application_date"] = r["application_date"].isoformat()

    return {
        "job_id": body.job_id,
        "filtered_count": len(filtered),
        "evaluated_count": evaluated,
        "promoted_count": promoted,
        "rejected_count": rejected,
        "top_candidates": top,
        **({"errors": errors} if errors else {}),
    }


@router.post("/invitations", response_model=list[InvitationResult])
def send_invitations(body: InvitationRequest):
    """Creates a Google Calendar event with a Meet link for each selected
    candidate. Google auto-emails each attendee the invite."""
    job = hiring_service.get_job_posting(body.job_id)
    if not job:
        raise HTTPException(404, f"job {body.job_id} not found")

    try:
        scheduled_at = datetime.fromisoformat(body.scheduled_at)
    except ValueError:
        raise HTTPException(400, f"invalid scheduled_at: {body.scheduled_at!r}")

    applicants = hiring_service.get_applicants_basic(body.applicant_ids)
    if not applicants:
        raise HTTPException(404, "no applicants found for the given ids")

    interviewers = [
        e.strip().lower()
        for e in (body.interviewer_emails or [])
        if e and e.strip()
    ]

    results: list[InvitationResult] = []
    for a in applicants:
        name = f"{a['first_name']} {a['last_name']}"
        out = google_calendar.send_interview_invite(
            candidate_email=a["email"],
            candidate_name=name,
            job_title=job["job_title"],
            scheduled_at=scheduled_at,
            duration_minutes=body.duration_minutes,
            kind=body.kind,
            timezone=body.timezone or "UTC",
            interviewer_emails=interviewers,
        )
        error = out.get("error")
        hiring_service.record_invitation(
            applicant_id=a["applicant_id"],
            job_id=body.job_id,
            kind=body.kind,
            scheduled_at=scheduled_at,
            duration_minutes=body.duration_minutes,
            timezone=body.timezone,
            meet_link=out.get("meet_link"),
            calendar_event_id=out.get("event_id"),
            organizer_email=GOOGLE_ORGANIZER_EMAIL or None,
            status="Failed" if error else "Scheduled",
            error_message=error,
            interviewer_emails=interviewers,
        )
        # Fire-and-forget notification emails to each interviewer employee.
        # Failures here don't fail the invite — the portal still shows them.
        if not error and out.get("meet_link"):
            for i_email in interviewers:
                try:
                    google_calendar.send_interviewer_notification(
                        interviewer_email=i_email,
                        candidate_name=name,
                        candidate_email=a["email"],
                        job_title=job["job_title"],
                        kind=body.kind,
                        scheduled_at=scheduled_at,
                        duration_minutes=body.duration_minutes,
                        meet_link=out.get("meet_link") or "",
                        portal_url=PORTAL_URL,
                    )
                except Exception:
                    pass
        results.append(
            InvitationResult(
                applicant_id=a["applicant_id"],
                email=a["email"],
                status="failed" if error else "sent",
                meet_link=out.get("meet_link"),
                event_id=out.get("event_id"),
                error=error,
                interviewer_emails=interviewers or None,
            )
        )
    return results


@router.post("/offer-letters/preview", response_model=OfferLetterPreview)
def preview_offer_letter(body: OfferLetterPreviewRequest):
    """Renders the offer-letter HTML + subject for HR to preview/edit."""
    job = hiring_service.get_job_posting(body.job_id)
    if not job:
        raise HTTPException(404, f"job {body.job_id} not found")
    applicants = hiring_service.get_applicants_basic([body.applicant_id])
    if not applicants:
        raise HTTPException(404, f"applicant {body.applicant_id} not found")
    a = applicants[0]
    name = f"{a['first_name']} {a['last_name']}"
    subject, html = offer_letter.render_offer_letter(
        candidate_name=name,
        candidate_email=a["email"],
        job_title=job["job_title"],
        location=job.get("location"),
        employment_type=job.get("employment_type"),
        base_salary=body.base_salary,
        currency=body.currency,
        start_date=body.start_date,
        expiry_days=body.expiry_days,
        organizer_email=GOOGLE_ORGANIZER_EMAIL or "",
        portal_url=PORTAL_URL,
        portal_password=DEFAULT_EMPLOYEE_PASSWORD,
    )
    return OfferLetterPreview(
        applicant_id=body.applicant_id,
        job_id=body.job_id,
        candidate_email=a["email"],
        candidate_name=name,
        subject=subject,
        html=html,
    )


@router.post("/offer-letters/send", response_model=OfferLetterResult)
def send_offer_letter(body: OfferLetterSendRequest):
    """Sends the (possibly HR-edited) offer letter as a branded email and
    updates the applicant's status to 'Offered'."""
    applicants = hiring_service.get_applicants_basic([body.applicant_id])
    if not applicants:
        raise HTTPException(404, f"applicant {body.applicant_id} not found")
    a = applicants[0]
    name = f"{a['first_name']} {a['last_name']}"

    text_body = offer_letter.html_to_text(
        body.html,
        fallback_intro=f"Offer of Employment at {a.get('job_title') or ''}",
    )

    error = google_calendar.send_raw_email(
        to_email=a["email"],
        to_name=name,
        subject=body.subject,
        html_body=body.html,
        text_body=text_body,
    )

    offer_letter.record_offer_letter(
        applicant_id=body.applicant_id,
        job_id=body.job_id,
        base_salary=body.base_salary,
        currency=body.currency,
        start_date=body.start_date,
        subject=body.subject,
        html_body=body.html,
        status="failed" if error else "sent",
        error_message=error,
    )

    if not error:
        hiring_service.update_applicant_status(body.applicant_id, "Offered")
        # Provision a portal password so the candidate can log in and
        # respond to the offer. (Only the candidate we just sent to gets one.)
        auth_svc.set_applicant_password(body.applicant_id, DEFAULT_EMPLOYEE_PASSWORD)

    return OfferLetterResult(
        applicant_id=body.applicant_id,
        email=a["email"],
        status="failed" if error else "sent",
        error=error,
    )


@router.post("/applicants/{applicant_id}/evaluate")
def evaluate_one(applicant_id: int, job_id: int):
    """Force-run the agent for a single applicant (useful for detail-page refresh)."""
    state = ai_agent.score_candidate(job_id, applicant_id)
    if state.get("error"):
        raise HTTPException(500, state["error"])
    return state.get("evaluation", {})
