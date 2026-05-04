// HR landing dashboard API client.

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

export type DashboardTiles = {
  active_headcount: number;
  joined_this_month: number;
  headcount_delta_vs_last_month: number;

  open_jobs: number;
  pipeline_in_flight: number;

  active_projects: number;
  planned_projects: number;

  monthly_payroll_target: number;
  released_this_period: number;
  released_gross_this_period: number;

  hr_open: number;
  hr_in_progress: number;
  hr_resolved_today: number;

  pending_payroll_count: number;
};

export type HeadcountPoint = {
  month: string;
  year: number;
  month_num: number;
  headcount: number;
};

export type PayrollPoint = {
  label: string;
  year: number;
  month: number;
  gross: number;
  net: number;
  runs: number;
};

export type FunnelStage = { stage: string; count: number };

export type DepartmentSlice = {
  department: string;
  headcount: number;
  annual: number;
};

export type ProjectStatusSlice = { status: string; count: number };

export type AttentionItem = {
  kind: string;
  title: string;
  subtitle?: string | null;
  cta_label: string;
  cta_path: string;
  severity: "info" | "warn" | "success";
};

export type ActivityItem = {
  kind: "hire" | "payroll" | "hr_query";
  title: string;
  subtitle?: string | null;
  at: string | null;
};

export type AIInsight = {
  kind: string;
  severity: "info" | "warn" | "success";
  title: string;
  body: string;
};

export type DashboardSummary = {
  period: { year: number; month: number; label: string };
  tiles: DashboardTiles;
  headcount_trend: HeadcountPoint[];
  payroll_trend: PayrollPoint[];
  hiring_funnel: FunnelStage[];
  department_headcount: DepartmentSlice[];
  project_status: ProjectStatusSlice[];
  attention: AttentionItem[];
  activity: ActivityItem[];
  insights: AIInsight[];
};

export const dashboardApi = {
  summary: (year?: number, month?: number) => {
    const p = new URLSearchParams();
    if (year) p.set("year", String(year));
    if (month) p.set("month", String(month));
    const qs = p.toString();
    return jsonRequest<DashboardSummary>(
      `/dashboard/summary${qs ? `?${qs}` : ""}`,
    );
  },
};
