// HR Queries API — used by both HR portal and Employee portal.

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

export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high";
export type ResolutionKind = "ai" | "edited" | "manual";

export type AISource = {
  source: string | null;
  section: string | null;
  score: number;
};

export type HRTicket = {
  query_id: number;
  applicant_id: number | null;
  staff_employee_id: number | null;
  employee_email: string;
  employee_name: string;
  employee_role: string | null;
  question: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;

  ai_suggestion: string | null;
  ai_sources: AISource[] | null;
  ai_generated_at: string | null;

  hr_response: string | null;
  resolved_by: string | null;
  resolution_kind: ResolutionKind | null;
  resolved_at: string | null;

  created_at: string;
  updated_at: string;
};

export type HRListCounts = {
  open: number;
  in_progress: number;
  resolved: number;
  resolved_today: number;
};

export type HRTicketList = {
  tickets: HRTicket[];
  counts: HRListCounts;
};

export type EmployeeTicketList = {
  tickets: HRTicket[];
};

// ---------- API ----------

export const hrQueriesApi = {
  // HR side
  list: (
    opts: { status?: string; category?: string; q?: string; limit?: number } = {},
  ) => {
    const p = new URLSearchParams();
    if (opts.status) p.set("status", opts.status);
    if (opts.category) p.set("category", opts.category);
    if (opts.q) p.set("q", opts.q);
    if (opts.limit) p.set("limit", String(opts.limit));
    const qs = p.toString();
    return jsonRequest<HRTicketList>(`/hr-queries/${qs ? `?${qs}` : ""}`);
  },

  get: (queryId: number) => jsonRequest<HRTicket>(`/hr-queries/${queryId}`),

  aiSuggest: (queryId: number) =>
    jsonRequest<HRTicket>(`/hr-queries/${queryId}/ai-suggest`, {
      method: "POST",
    }),

  resolve: (
    queryId: number,
    response_text: string,
    resolution_kind: ResolutionKind,
  ) =>
    jsonRequest<HRTicket>(`/hr-queries/${queryId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ response_text, resolution_kind }),
    }),

  // Employee side
  createMine: (
    question: string,
    category?: string,
    priority: TicketPriority = "medium",
  ) =>
    jsonRequest<HRTicket>(`/hr-queries/mine`, {
      method: "POST",
      body: JSON.stringify({ question, category, priority }),
    }),

  listMine: () => jsonRequest<EmployeeTicketList>(`/hr-queries/mine`),
};
