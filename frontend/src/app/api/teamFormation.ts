// Team Formation API client.
// Mirrors the bearer-token + /api proxy pattern used elsewhere.

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

// ---------------- types ----------------

export type ProjectRole = {
  designation: string;
  department?: string | null;
  level?: string | null;
  headcount: number;
  allocation_percent: number;
  min_experience_years?: number | null;
  must_have_skills: string[];
  good_to_have_skills: string[];
  responsibilities?: string | null;
};

export type ParsedRequirements = {
  project_name: string;
  project_summary: string;
  duration_months?: number | null;
  priority?: string | null;
  domain?: string | null;
  roles: ProjectRole[];
};

export type Run = {
  run_id: number;
  project_name: string;
  project_summary?: string | null;
  file_name?: string | null;
  parsed_requirements: ParsedRequirements;
  parser_model_id?: string | null;
  status: "parsed" | "recommended" | "team_created" | string;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
};

export type CandidateEmployee = {
  employee_id: number;
  employee_code?: string | null;
  first_name: string;
  last_name: string;
  job_title: string;
  employee_level?: string | null;
  department_name?: string | null;
  location?: string | null;
  work_mode?: string | null;
  bandwidth_percent: number;
  total_experience_years: number;
  current_project_count?: number | null;
};

export type FacetScore = { score: number | null; reason: string };

export type Evaluation = {
  overall_score: number | null;
  summary: string;
  skills: FacetScore;
  availability: FacetScore;
  experience: FacetScore;
  projects: FacetScore;
  certifications: FacetScore;
};

export type Candidate = { employee: CandidateEmployee; evaluation: Evaluation };

export type RecommendationsByRole = Record<string, Candidate[]>;

export type RecommendationsResponse = {
  run_id: number;
  project_name: string;
  project_summary?: string | null;
  requirements: ParsedRequirements;
  recommendations: RecommendationsByRole;
  error?: string;
  trace_tail?: string;
};

export type SampleFile = {
  file_name: string;
  size_bytes: number;
  download_url: string;
};

export type TeamSummary = {
  team_id: number;
  team_name: string;
  project_name: string;
  project_summary?: string | null;
  status: string;
  member_count: number;
  created_at: string;
};

export type TeamMemberDetail = {
  team_member_id: number;
  role_designation: string;
  fit_score?: number | null;
  allocation_percent?: number | null;
  added_at: string;
  employee_id: number;
  employee_code?: string | null;
  first_name: string;
  last_name: string;
  job_title: string;
  employee_level?: string | null;
  department_name?: string | null;
  location?: string | null;
  work_mode?: string | null;
  bandwidth_percent: number;
  total_experience_years: number;
  email?: string | null;
};

export type TeamDetail = {
  team_id: number;
  team_name: string;
  project_name: string;
  project_summary?: string | null;
  run_id?: number | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  members: TeamMemberDetail[];
};

export type CreateTeamPayload = {
  team_name: string;
  project_name?: string;
  project_summary?: string;
  run_id?: number;
  members: {
    employee_id: number;
    role_designation: string;
    fit_score?: number | null;
    allocation_percent?: number | null;
  }[];
  requirements?: ParsedRequirements;
};

// ---------------- API ----------------

export const teamFormationApi = {
  listSamples: () =>
    jsonRequest<{ samples: SampleFile[] }>("/team-formation/samples"),

  parsePdf: async (file: File): Promise<{ run: Run; requirements: ParsedRequirements }> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/team-formation/parse`, {
      method: "POST",
      headers: { ...authHeader() },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
  },

  getRun: (runId: number) => jsonRequest<Run>(`/team-formation/runs/${runId}`),

  updateRequirements: (runId: number, requirements: ParsedRequirements) =>
    jsonRequest<{ run: Run }>(`/team-formation/runs/${runId}/requirements`, {
      method: "PUT",
      body: JSON.stringify({ requirements }),
    }),

  recommend: (runId: number) =>
    jsonRequest<RecommendationsResponse>(
      `/team-formation/runs/${runId}/recommend`,
      { method: "POST" }
    ),

  getRecommendations: (runId: number) =>
    jsonRequest<RecommendationsResponse>(
      `/team-formation/runs/${runId}/recommendations`
    ),

  createTeam: (payload: CreateTeamPayload) =>
    jsonRequest<TeamDetail>("/team-formation/teams", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listTeams: () =>
    jsonRequest<{ teams: TeamSummary[] }>("/team-formation/teams"),

  getTeam: (teamId: number) =>
    jsonRequest<TeamDetail>(`/team-formation/teams/${teamId}`),

  // Authenticated download for a sample PDF (server requires bearer).
  downloadSample: async (fileName: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/team-formation/samples/${fileName}`, {
      headers: { ...authHeader() },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.blob();
  },
};
