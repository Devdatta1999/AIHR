// Extra API surface for auth / onboarding / employee portal.
// Reuses the same bearer-token pattern as the hiring API.

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
    throw new Error(`${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.text()) as unknown as T;
}

// ---------- types ----------

export type OnboardingDoc = {
  doc_id: number;
  title: string;
  description?: string | null;
  country?: string | null;
  original_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  uploaded_at?: string;
};

export type ReadyApplicant = {
  applicant_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  country?: string | null;
  job_id: number;
  job_title?: string | null;
  department?: string | null;
  location?: string | null;
  tracker_id?: number | null;
  tracker_status?: string | null;
};

export type Tracker = {
  tracker_id: number;
  applicant_id: number;
  status: string;
  welcome_message?: string | null;
  document_ids: number[];
  created_at?: string;
  updated_at?: string;
  accepted_at?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  country?: string | null;
  job_title?: string | null;
  department?: string | null;
  location?: string | null;
};

export type Employee = {
  employee_id: number;
  applicant_id?: number | null;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string | null;
  department?: string | null;
  location?: string | null;
  country?: string | null;
  start_date?: string | null;
  onboarded_at?: string | null;
};

export type OfferLetter = {
  offer_id: number;
  job_id: number;
  base_salary: number;
  currency: string;
  start_date: string;
  subject: string;
  html_body: string;
  status: string;
  response?: string | null;
  responded_at?: string | null;
  created_at?: string;
  job_title?: string | null;
  department?: string | null;
  location?: string | null;
};

export type EmployeeMe = {
  identity: {
    role: "hr" | "employee";
    email: string;
    name?: string;
    applicant_id?: number | null;
    employee_id?: number | null;
  };
  applicant: any | null;
  employee: any | null;
};

// ---------- HR-side onboarding ----------

export const hrOnboarding = {
  listDocuments: () => request<OnboardingDoc[]>("/onboarding/documents"),
  uploadDocument: async (form: FormData) => {
    const res = await fetch(`${BASE}/onboarding/documents`, {
      method: "POST",
      headers: { ...authHeader() }, // no Content-Type — browser sets boundary
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return (await res.json()) as OnboardingDoc;
  },
  deleteDocument: (id: number) =>
    request<{ ok: boolean }>(`/onboarding/documents/${id}`, {
      method: "DELETE",
    }),
  downloadUrl: (id: number) => `${BASE}/onboarding/documents/${id}/download`,
  listReady: () => request<ReadyApplicant[]>("/onboarding/ready"),
  startTracker: (body: {
    applicant_id: number;
    welcome_message?: string;
    document_ids?: number[];
  }) =>
    request<Tracker>("/onboarding/trackers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getTracker: (applicant_id: number) =>
    request<Tracker>(`/onboarding/trackers/${applicant_id}`),
  listEmployees: () => request<Employee[]>("/onboarding/employees"),
  resetOnboarding: (applicant_id: number) =>
    request<{ ok: boolean; applicant_id: number; status: string }>(
      `/onboarding/reset/${applicant_id}`,
      { method: "POST" },
    ),
};

// ---------- interview kit assign ----------

export const kitAssign = {
  listEmployees: () => request<Employee[]>("/interview-kit/employees"),
  assign: (kit_id: number, employee_email: string, employee_id?: number) =>
    request("/interview-kit/assign", {
      method: "POST",
      body: JSON.stringify({ kit_id, employee_email, employee_id }),
    }),
};

// ---------- employee portal ----------

export const employeeApi = {
  me: () => request<EmployeeMe>("/employee/me"),
  getOffer: () => request<OfferLetter>("/employee/offer"),
  respondOffer: (offer_id: number, response: "accepted" | "rejected", note?: string) =>
    request("/employee/offer/respond", {
      method: "POST",
      body: JSON.stringify({ offer_id, response, note }),
    }),
  getOnboarding: () =>
    request<{ tracker: Tracker | null; documents: OnboardingDoc[] }>(
      "/employee/onboarding",
    ),
  saveProfile: (fields: Record<string, any>) =>
    request("/employee/onboarding/profile", {
      method: "POST",
      body: JSON.stringify(fields),
    }),
  acceptOnboarding: () =>
    request<{ ok: boolean }>("/employee/onboarding/accept", { method: "POST" }),
  listKits: () => request<any[]>("/employee/interview-kits"),
  listUpcomingInterviews: () =>
    request<UpcomingInterview[]>("/employee/interviews/upcoming"),
  listProjects: () =>
    request<{ staff_employee_id: number; projects: MyProject[] }>(
      "/employee/projects",
    ),
  listPayslips: () =>
    request<{ staff_employee_id: number; summary: PayslipSummary; payslips: PortalPayslip[] }>(
      "/employee/payslips",
    ),
  getPayslip: (run_id: number) =>
    request<PortalPayslip>(`/employee/payslips/${run_id}`),
  payslipPdfUrl: (run_id: number) => `${BASE}/employee/payslips/${run_id}/pdf`,
  downloadPayslipPdf: async (run_id: number) => {
    const res = await fetch(`${BASE}/employee/payslips/${run_id}/pdf`, {
      headers: { ...authHeader() },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.blob();
  },
};

export type PayslipLineItem = { label: string; amount: number };

export type PortalPayslip = {
  payroll_run_id: number;
  staff_employee_id: number;
  pay_period_year: number;
  pay_period_month: number;
  pay_period_label: string;
  period_start: string | null;
  period_end: string | null;
  pay_date: string | null;
  currency: string;
  annual_base_salary: number | null;
  monthly_gross: number | null;
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  total_earnings: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  ytd_gross: number | null;
  ytd_tax: number | null;
  ytd_net: number | null;
  status: string;
  released_at: string | null;
};

export type PayslipSummary = {
  ytd_gross: number;
  ytd_tax: number;
  ytd_net: number;
  last_pay_date: string | null;
  last_pay_period_label: string | null;
  count: number;
};

export type ProjectManager = {
  employee_id: number;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
};

export type Teammate = {
  employee_id: number;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  job_title: string;
  employee_level: string | null;
  department_name: string | null;
  email: string | null;
  location: string | null;
  work_mode: string | null;
  role_in_project: string;
  allocation_percent: number | null;
  assignment_status: string;
};

export type MyProject = {
  employee_project_id: number;
  project_id: number;
  role_in_project: string;
  allocation_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  assignment_status: "Active" | "Planned" | "Completed" | string;
  project_name: string;
  description: string | null;
  priority: string | null;
  project_status: "Active" | "Planned" | "Completed" | "On Hold" | string;
  project_start_date: string | null;
  project_end_date: string | null;
  required_bandwidth_percent: number | null;
  manager: ProjectManager | null;
  teammates: Teammate[];
};

export type UpcomingInterview = {
  invite_id: number;
  kind: "screening" | "technical";
  scheduled_at: string;
  duration_minutes: number;
  timezone?: string | null;
  meet_link?: string | null;
  status?: string | null;
  interviewer_emails: string[];
  applicant_id: number;
  candidate_name: string;
  candidate_email: string;
  job_id: number;
  job_title?: string | null;
  department?: string | null;
};
