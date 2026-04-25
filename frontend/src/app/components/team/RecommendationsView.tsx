import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Candidate,
  CreateTeamPayload,
  ProjectRole,
  RecommendationsResponse,
  teamFormationApi,
} from "../../api/teamFormation";

type Selection = Record<string, number[]>; // role designation -> employee_ids

export function RecommendationsView({
  runId,
  onBack,
  onSaved,
}: {
  runId: number;
  onBack: () => void;
  onSaved: (teamId: number) => void;
}) {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    teamFormationApi
      .getRecommendations(runId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.project_name && !teamName) setTeamName(d.project_name);
      })
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const rolesByDesignation = useMemo(() => {
    const map: Record<string, ProjectRole> = {};
    (data?.requirements?.roles || []).forEach((r) => {
      map[r.designation] = r;
    });
    return map;
  }, [data]);

  function toggle(roleKey: string, employeeId: number, headcount: number) {
    setSelection((sel) => {
      const cur = sel[roleKey] || [];
      if (cur.includes(employeeId)) {
        return { ...sel, [roleKey]: cur.filter((id) => id !== employeeId) };
      }
      if (cur.length >= headcount) return sel; // cap at headcount
      return { ...sel, [roleKey]: [...cur, employeeId] };
    });
  }

  const totalSelected = Object.values(selection).reduce(
    (s, arr) => s + arr.length,
    0,
  );
  const totalHeadcount = (data?.requirements?.roles || []).reduce(
    (s, r) => s + (r.headcount || 0),
    0,
  );

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const members: CreateTeamPayload["members"] = [];
      for (const [roleKey, ids] of Object.entries(selection)) {
        const role = rolesByDesignation[roleKey];
        const candidates = data.recommendations[roleKey] || [];
        for (const eid of ids) {
          const c = candidates.find((x) => x.employee.employee_id === eid);
          members.push({
            employee_id: eid,
            role_designation: roleKey,
            fit_score: c?.evaluation.overall_score ?? null,
            allocation_percent: role?.allocation_percent ?? null,
          });
        }
      }
      if (members.length === 0) {
        setError("Select at least one team member.");
        return;
      }
      const team = await teamFormationApi.createTeam({
        team_name: teamName.trim(),
        project_name: data.project_name,
        project_summary: data.project_summary || undefined,
        run_id: runId,
        requirements: data.requirements,
        members,
      });
      onSaved(team.team_id);
    } catch (e: any) {
      setError(e?.message || "Failed to save team");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading recommendations…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const roleKeys = Object.keys(data.recommendations);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            AI team recommendations
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Pick the best fit per role. Selections are capped at the headcount
            you set.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Users className="w-3.5 h-3.5" />
            {totalSelected} / {totalHeadcount} seats filled
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Team name (saved as)
            </label>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Phoenix Customer Portal"
            />
          </div>
          <div className="flex justify-end">
            <button
              disabled={saving || totalSelected === 0 || teamName.trim().length < 2}
              onClick={save}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg shadow-sm hover:shadow-md disabled:opacity-60 text-sm font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving team…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save team
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {roleKeys.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
          No recommendations yet. Try generating again from the previous step.
        </div>
      )}

      <div className="space-y-6">
        {roleKeys.map((roleKey) => {
          const role = rolesByDesignation[roleKey];
          const candidates = data.recommendations[roleKey] || [];
          const picked = selection[roleKey] || [];
          const hc = role?.headcount || 1;
          return (
            <div key={roleKey}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {roleKey}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {role?.must_have_skills?.slice(0, 4).join(", ") ||
                      "no must-have skills"}{" "}
                    · need {hc}
                  </p>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    picked.length === hc
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                >
                  {picked.length} / {hc} selected
                </span>
              </div>
              {candidates.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
                  No matching candidates were found in the pool.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {candidates.map((c) => (
                    <CandidateCard
                      key={c.employee.employee_id}
                      candidate={c}
                      selected={picked.includes(c.employee.employee_id)}
                      disabled={
                        !picked.includes(c.employee.employee_id) &&
                        picked.length >= hc
                      }
                      onToggle={() =>
                        toggle(roleKey, c.employee.employee_id, hc)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  disabled,
  onToggle,
}: {
  candidate: Candidate;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { employee, evaluation } = candidate;
  const score = evaluation.overall_score ?? 0;
  const scoreColor =
    score >= 85
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 70
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-rose-50 text-rose-700 border-rose-200";

  const bw = employee.bandwidth_percent || 0;
  const bwColor =
    bw >= 80 ? "bg-emerald-500" : bw >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-all p-4 ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-100"
          : disabled
            ? "border-gray-200 opacity-60"
            : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 text-sm truncate">
              {employee.first_name} {employee.last_name}
            </h4>
            {employee.employee_code && (
              <span className="text-[10px] text-gray-400 font-mono">
                {employee.employee_code}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {employee.job_title}
            {employee.employee_level && ` · ${employee.employee_level}`}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 inline-flex items-center gap-1">
            {employee.location && (
              <>
                <MapPin className="w-3 h-3" />
                {employee.location}
                {employee.work_mode && ` · ${employee.work_mode}`}
              </>
            )}
            {!employee.location && employee.department_name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border ${scoreColor}`}
          >
            <Sparkles className="w-3 h-3" />
            {score}
          </span>
          <span className="text-[10px] text-gray-500">
            {employee.total_experience_years} yrs
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
          <span>Bandwidth</span>
          <span className="font-medium">{bw}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${bwColor}`} style={{ width: `${bw}%` }} />
        </div>
      </div>

      {evaluation.summary && (
        <p className="mt-3 text-xs text-gray-700 leading-relaxed line-clamp-3">
          {evaluation.summary}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onToggle}
          disabled={disabled}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg border transition ${
            selected
              ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
              : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40"
          } disabled:cursor-not-allowed`}
        >
          {selected ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Selected
            </>
          ) : (
            "Add to team"
          )}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 px-2 py-2"
        >
          {open ? (
            <>
              Hide <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Why <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <FacetRow label="Skills" facet={evaluation.skills} />
          <FacetRow label="Availability" facet={evaluation.availability} />
          <FacetRow label="Experience" facet={evaluation.experience} />
          <FacetRow label="Projects" facet={evaluation.projects} />
          <FacetRow
            label="Certifications"
            facet={evaluation.certifications}
          />
        </div>
      )}
    </div>
  );
}

function FacetRow({
  label,
  facet,
}: {
  label: string;
  facet: { score: number | null; reason: string };
}) {
  const score = facet.score ?? 0;
  const tone =
    score >= 80
      ? "bg-emerald-50 text-emerald-700"
      : score >= 60
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <div className="border border-gray-100 rounded-lg p-2 bg-gray-50/40">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`px-1.5 py-0.5 rounded ${tone} font-semibold`}>
          {score}
        </span>
      </div>
      {facet.reason && (
        <p className="text-gray-600 leading-snug">{facet.reason}</p>
      )}
    </div>
  );
}
