export type Job = {
  job_id: number;
  job_title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  status?: string;
  job_level?: string;
  min_years_experience?: number;
  preferred_country?: string;
  applicant_count?: number;
};

export type ApplicantCard = {
  applicant_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  application_date?: string;
  total_years_experience?: number;
  country?: string;
  job_title?: string;
  overall_score?: number | null;
  evaluated?: boolean;
};

export type Facet = { score?: number | null; reason?: string | null };

export type Evaluation = {
  applicant_id: number;
  job_id: number;
  overall_score?: number | null;
  summary?: string | null;
  skills_score?: number | null;
  skills_reason?: string | null;
  experience_score?: number | null;
  experience_reason?: string | null;
  projects_score?: number | null;
  projects_reason?: string | null;
  education_score?: number | null;
  education_reason?: string | null;
  certifications_score?: number | null;
  certifications_reason?: string | null;
  achievements_score?: number | null;
  achievements_reason?: string | null;
  model_id?: string | null;
};

export type ApplicantDetail = {
  applicant: Record<string, any>;
  job: Record<string, any> | null;
  education: Record<string, any>[];
  work_experience: Record<string, any>[];
  projects: Record<string, any>[];
  certifications: Record<string, any>[];
  achievements: Record<string, any>[];
  skills: Record<string, any>[];
  evaluation: Evaluation | null;
};

export type ShortlistRequest = {
  job_id: number;
  min_experience?: number;
  country?: string;
  require_work_auth?: boolean;
  notice_period_max_days?: number;
  limit?: number;
};

export type ShortlistResult = {
  job_id: number;
  filtered_count: number;
  evaluated_count: number;
  top_candidates: ApplicantCard[];
};

const BASE = "/api";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("nimbus_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export type InvitationRequest = {
  job_id: number;
  applicant_ids: number[];
  kind: "screening" | "technical";
  scheduled_at: string; // ISO with offset
  duration_minutes: number;
  timezone?: string;
  interviewer_emails?: string[];
};

export type InvitationResult = {
  applicant_id: number;
  email: string;
  status: "sent" | "failed";
  meet_link?: string | null;
  event_id?: string | null;
  error?: string | null;
  interviewer_emails?: string[] | null;
};

export type OfferLetterPreviewRequest = {
  applicant_id: number;
  job_id: number;
  base_salary: number;
  currency: string;
  start_date: string; // YYYY-MM-DD
  expiry_days?: number;
};

export type OfferLetterPreview = {
  applicant_id: number;
  job_id: number;
  candidate_email: string;
  candidate_name: string;
  subject: string;
  html: string;
};

export type OfferLetterSendRequest = {
  applicant_id: number;
  job_id: number;
  base_salary: number;
  currency: string;
  start_date: string;
  subject: string;
  html: string;
};

export type OfferLetterResult = {
  applicant_id: number;
  email: string;
  status: "sent" | "failed";
  error?: string | null;
};

export type BehavioralQuestion = {
  question: string;
  signal?: string | null;
  good_answer?: string | null;
  follow_up?: string | null;
};

export type TechnicalQuestion = BehavioralQuestion & {
  skill?: string | null;
  difficulty?: string | null;
};

export type InterviewKit = {
  kit_id?: number | null;
  job_id: number;
  model_id?: string | null;
  behavioral: Record<string, BehavioralQuestion[]>;
  technical: TechnicalQuestion[];
  overall_notes?: string | null;
  rag_sources: { source?: string; section?: string; score?: number }[];
  web_sources: { title?: string; url?: string }[];
  status: string;
  error_message?: string | null;
  created_at?: string | null;
};

export const api = {
  listJobs: () => request<Job[]>("/hiring/jobs"),
  getJob: (id: number) => request<Job>(`/hiring/jobs/${id}`),
  listApplicants: (jobId: number) =>
    request<ApplicantCard[]>(`/hiring/jobs/${jobId}/applicants`),
  getApplicant: (id: number) =>
    request<ApplicantDetail>(`/hiring/applicants/${id}`),
  updateStatus: (id: number, status: string) =>
    request<{ applicant_id: number; status: string }>(
      `/hiring/applicants/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
  shortlist: (req: ShortlistRequest) =>
    request<ShortlistResult>("/hiring/shortlist", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  evaluateOne: (applicantId: number, jobId: number) =>
    request<any>(
      `/hiring/applicants/${applicantId}/evaluate?job_id=${jobId}`,
      { method: "POST" },
    ),
  sendInvitations: (req: InvitationRequest) =>
    request<InvitationResult[]>("/hiring/invitations", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  previewOfferLetter: (req: OfferLetterPreviewRequest) =>
    request<OfferLetterPreview>("/hiring/offer-letters/preview", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  sendOfferLetter: (req: OfferLetterSendRequest) =>
    request<OfferLetterResult>("/hiring/offer-letters/send", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  listKitJobs: () => request<Job[]>("/interview-kit/jobs"),
  getKit: (jobId: number) =>
    request<InterviewKit>(`/interview-kit/jobs/${jobId}/kit`),
  generateKit: (jobId: number) =>
    request<InterviewKit>("/interview-kit/generate", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId }),
    }),
};

// Pipeline column <-> DB status mapping.
// The "rejected" column is the dumping ground for candidates not moving
// forward; new applicants (Applied / Under Review) also render there until
// the AI shortlist runs and decides who advances.
export const COLUMN_STATUS: Record<string, string> = {
  rejected: "Rejected",
  screening: "Shortlisted",
  interview: "Interview In Progress",
  offer: "Hired",
};

export function statusToColumn(status: string): string {
  switch (status) {
    case "Applied":
    case "Under Review":
    case "Rejected":
    case "Withdrawn":
      return "rejected";
    case "Shortlisted":
      return "screening";
    case "Interview In Progress":
    case "Interview Scheduled":
      return "interview";
    case "Hired":
    case "Offered":
      return "offer";
    default:
      return "rejected";
  }
}
