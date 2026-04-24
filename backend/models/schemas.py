from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


PipelineStatus = Literal["Applied", "Shortlisted", "Interview In Progress", "Hired"]


class JobPosting(BaseModel):
    job_id: int
    job_title: str
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    status: Optional[str] = None
    job_level: Optional[str] = None
    min_years_experience: Optional[float] = None
    preferred_country: Optional[str] = None
    applicant_count: Optional[int] = 0


class ApplicantCard(BaseModel):
    applicant_id: int
    first_name: str
    last_name: str
    email: str
    status: str
    application_date: Optional[str] = None
    total_years_experience: Optional[float] = None
    country: Optional[str] = None
    job_title: Optional[str] = None
    overall_score: Optional[int] = None
    evaluated: bool = False


class EvaluationFacet(BaseModel):
    score: Optional[int] = None
    reason: Optional[str] = None


class ApplicantEvaluation(BaseModel):
    applicant_id: int
    job_id: int
    overall_score: Optional[int] = None
    skills: EvaluationFacet = Field(default_factory=EvaluationFacet)
    experience: EvaluationFacet = Field(default_factory=EvaluationFacet)
    projects: EvaluationFacet = Field(default_factory=EvaluationFacet)
    education: EvaluationFacet = Field(default_factory=EvaluationFacet)
    certifications: EvaluationFacet = Field(default_factory=EvaluationFacet)
    achievements: EvaluationFacet = Field(default_factory=EvaluationFacet)
    summary: Optional[str] = None
    model_id: Optional[str] = None


class ApplicantDetail(BaseModel):
    applicant: dict[str, Any]
    education: list[dict[str, Any]]
    work_experience: list[dict[str, Any]]
    projects: list[dict[str, Any]]
    certifications: list[dict[str, Any]]
    achievements: list[dict[str, Any]]
    skills: list[dict[str, Any]]
    job: Optional[dict[str, Any]] = None
    evaluation: Optional[ApplicantEvaluation] = None


class StatusUpdate(BaseModel):
    status: str


class ShortlistRequest(BaseModel):
    job_id: int
    min_experience: Optional[float] = None
    country: Optional[str] = None
    require_work_auth: Optional[bool] = None
    notice_period_max_days: Optional[int] = None
    limit: Optional[int] = 50


class ShortlistResult(BaseModel):
    job_id: int
    filtered_count: int
    evaluated_count: int
    top_candidates: list[ApplicantCard]


InviteKind = Literal["screening", "technical"]


class InvitationRequest(BaseModel):
    job_id: int
    applicant_ids: list[int] = Field(min_length=1)
    kind: InviteKind
    scheduled_at: str  # ISO 8601; may include offset, e.g. "2026-04-25T10:00:00-07:00"
    duration_minutes: int = 30
    timezone: Optional[str] = None  # e.g. "America/Los_Angeles"
    # Optional: employees to loop in as interviewers. They'll be added to the
    # calendar event as attendees and notified via the Employee Portal.
    interviewer_emails: Optional[list[str]] = None


class InvitationResult(BaseModel):
    applicant_id: int
    email: str
    status: str
    meet_link: Optional[str] = None
    event_id: Optional[str] = None
    error: Optional[str] = None
    interviewer_emails: Optional[list[str]] = None


# --- Offer letters -----------------------------------------------------------


class OfferLetterPreviewRequest(BaseModel):
    applicant_id: int
    job_id: int
    base_salary: float
    currency: str = "USD"
    start_date: str  # ISO "YYYY-MM-DD"
    expiry_days: int = 7


class OfferLetterPreview(BaseModel):
    applicant_id: int
    job_id: int
    candidate_email: str
    candidate_name: str
    subject: str
    html: str


class OfferLetterSendRequest(BaseModel):
    applicant_id: int
    job_id: int
    base_salary: float
    currency: str = "USD"
    start_date: str
    subject: str
    html: str


class OfferLetterResult(BaseModel):
    applicant_id: int
    email: str
    status: str  # "sent" | "failed"
    error: Optional[str] = None


# --- Interview kits ---------------------------------------------------------


class BehavioralQuestion(BaseModel):
    question: str
    signal: Optional[str] = None
    good_answer: Optional[str] = None
    follow_up: Optional[str] = None


class TechnicalQuestion(BaseModel):
    question: str
    skill: Optional[str] = None
    difficulty: Optional[str] = None
    signal: Optional[str] = None
    good_answer: Optional[str] = None
    follow_up: Optional[str] = None


class InterviewKit(BaseModel):
    kit_id: Optional[int] = None
    job_id: int
    model_id: Optional[str] = None
    behavioral: dict[str, list[BehavioralQuestion]] = Field(default_factory=dict)
    technical: list[TechnicalQuestion] = Field(default_factory=list)
    overall_notes: Optional[str] = None
    rag_sources: list[dict[str, Any]] = Field(default_factory=list)
    web_sources: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "ready"
    error_message: Optional[str] = None
    created_at: Optional[str] = None


class InterviewKitRequest(BaseModel):
    job_id: int
