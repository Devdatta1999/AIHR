// HR-side compensation/payroll API client.

const BASE = "/api";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("nimbus_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
  return res.json();
}

// ---------- types ----------

export type CompensationTiles = {
  active_headcount: number;
  monthly_payroll_target: number;
  avg_base_salary: number;
  released_this_period: number;
  released_gross_this_period: number;
  released_net_this_period: number;
  released_deductions_this_period: number;
  pending_this_period: number;
};

export type TrendPoint = {
  year: number;
  month: number;
  label: string;
  gross: number;
  net: number;
  runs: number;
};

export type DepartmentSlice = {
  department: string;
  headcount: number;
  monthly_payroll: number;
  annual_payroll: number;
};

export type CompensationSummary = {
  period: { year: number; month: number; label: string };
  tiles: CompensationTiles;
  trend: TrendPoint[];
  departments: DepartmentSlice[];
};

export type CompensationEmployee = {
  employee_id: number;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  job_title: string | null;
  employee_level: string | null;
  department_name: string | null;
  location: string | null;
  join_date: string | null;
  base_salary: number | null;
  currency: string;
  bonus_eligible: boolean | null;

  released: boolean;
  payroll_run_id: number | null;
  pay_period_label: string | null;
  monthly_gross: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  released_at: string | null;
};

export type CompensationEmployeesResponse = {
  period: { year: number; month: number };
  employees: CompensationEmployee[];
};

export type LineItem = { label: string; amount: number };

export type Payslip = {
  payroll_run_id: number;
  staff_employee_id: number;
  employee_email: string;
  pay_period_year: number;
  pay_period_month: number;
  pay_period_label: string;
  period_start: string | null;
  period_end: string | null;
  pay_date: string | null;
  currency: string;
  annual_base_salary: number | null;
  monthly_gross: number | null;
  earnings: LineItem[];
  deductions: LineItem[];
  total_earnings: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  ytd_gross: number | null;
  ytd_tax: number | null;
  ytd_net: number | null;
  status: string;
  released_by: string | null;
  released_at: string | null;
  employee?: {
    employee_id: number;
    employee_code: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    job_title: string | null;
    employee_level: string | null;
    department_name: string | null;
    location: string | null;
  };
};

export type BulkReleaseRow = {
  employee_id: number;
  name: string;
  payroll_run_id?: number;
  net_pay?: number;
  reason?: string;
};

export type BulkReleaseResult = {
  period: { year: number; month: number; label: string };
  scope: "all" | "department";
  department: string | null;
  attempted: number;
  released_count: number;
  skipped_count: number;
  failed_count: number;
  released: BulkReleaseRow[];
  skipped: BulkReleaseRow[];
  failed: BulkReleaseRow[];
};

// ---------- API ----------

export const compensationApi = {
  summary: (year: number, month: number) =>
    jsonRequest<CompensationSummary>(
      `/compensation/summary?year=${year}&month=${month}`,
    ),

  listEmployees: (
    year: number,
    month: number,
    opts: { q?: string; department?: string; status?: "released" | "pending" } = {},
  ) => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("month", String(month));
    if (opts.q) p.set("q", opts.q);
    if (opts.department) p.set("department", opts.department);
    if (opts.status) p.set("status", opts.status);
    return jsonRequest<CompensationEmployeesResponse>(
      `/compensation/employees?${p.toString()}`,
    );
  },

  release: (employee_id: number, year: number, month: number) =>
    jsonRequest<Payslip>("/compensation/release", {
      method: "POST",
      body: JSON.stringify({ employee_id, year, month }),
    }),

  releaseBulk: (
    year: number,
    month: number,
    scope: "all" | "department",
    department?: string,
  ) =>
    jsonRequest<BulkReleaseResult>("/compensation/release-bulk", {
      method: "POST",
      body: JSON.stringify({ year, month, scope, department }),
    }),

  getRun: (run_id: number) =>
    jsonRequest<Payslip>(`/compensation/runs/${run_id}`),

  pdfUrl: (run_id: number) => `${BASE}/compensation/runs/${run_id}/pdf`,

  downloadPdf: async (run_id: number) => {
    const res = await fetch(`${BASE}/compensation/runs/${run_id}/pdf`, {
      headers: { ...authHeader() },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.blob();
  },
};
