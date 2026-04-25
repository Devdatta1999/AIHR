// HR Analytics API client. Same bearer-token + /api proxy pattern as
// the rest of the frontend.

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
  return res.json();
}

// ---------- types ----------

export type FilterOptions = {
  departments: string[];
  locations: string[];
  employment_types: string[];
  work_modes: string[];
};

export type DashboardFilters = {
  department?: string;
  location?: string;
  employment_type?: string;
  work_mode?: string;
};

export type DashboardKpis = {
  headcount: number;
  avg_base_salary: number;
  avg_tenure_years: number;
  annual_attrition_pct: number;
};

export type DashboardBundle = {
  kpis: DashboardKpis;
  headcount_by_department: { department: string; headcount: number }[];
  joining_vs_exit_trend: { month: string; joined: number; exited: number }[];
  work_mode_mix: { work_mode: string; headcount: number }[];
  top_skills: { skill: string; employees: number }[];
  salary_by_department: {
    department: string;
    avg_salary: number;
    headcount: number;
  }[];
};

export type ChartSpec = {
  type:
    | "bar"
    | "line"
    | "pie"
    | "kpi"
    | "kpi_grid"
    | "table"
    | "empty";
  data: Record<string, any>[];
  x_key?: string;
  y_keys?: string[];
  name_key?: string;
  value_key?: string;
  columns?: string[];
  label?: string;
  value?: any;
};

export type RagSource = {
  source: string | null;
  section: string | null;
  score: number;
};

export type ChatResponse = {
  session_id: string;
  question: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
  chart: ChartSpec;
  cache_hit: boolean;
  cache_similarity: number;
  rag_hit: boolean;
  rag_sources: RagSource[];
  used_model: string;
  error: string | null;
  run_log: { node: string; at: string; [k: string]: any }[];
};

export type ChatSessionSummary = {
  session_id: string;
  started_at: string | null;
  last_at: string | null;
  turns: number;
};

// ---------- API ----------

function qs(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const analyticsApi = {
  getFilters: () => request<FilterOptions>("/analytics/filters"),
  getDashboard: (filters: DashboardFilters) =>
    request<DashboardBundle>(`/analytics/dashboard${qs(filters as any)}`),
  chat: (question: string, session_id?: string) =>
    request<ChatResponse>("/analytics/chat", {
      method: "POST",
      body: JSON.stringify({ question, session_id }),
    }),
  listSessions: () => request<ChatSessionSummary[]>("/analytics/chat/sessions"),
  getSession: (session_id: string) =>
    request<{ session_id: string; messages: any[] }>(
      `/analytics/chat/sessions/${session_id}`,
    ),
  clearCache: () =>
    request<{ ok: boolean }>("/analytics/cache/clear", { method: "POST" }),
};
