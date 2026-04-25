import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Loader2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  ParsedRequirements,
  ProjectRole,
  Run,
  teamFormationApi,
} from "../../api/teamFormation";

export function RequirementsReview({
  run,
  onBack,
  onRecommended,
}: {
  run: Run;
  onBack: () => void;
  onRecommended: (runId: number) => void;
}) {
  const [reqs, setReqs] = useState<ParsedRequirements>(run.parsed_requirements);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchRole(idx: number, patch: Partial<ProjectRole>) {
    setReqs((r) => ({
      ...r,
      roles: r.roles.map((role, i) => (i === idx ? { ...role, ...patch } : role)),
    }));
  }

  function removeRole(idx: number) {
    setReqs((r) => ({ ...r, roles: r.roles.filter((_, i) => i !== idx) }));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await teamFormationApi.updateRequirements(run.run_id, reqs);
      const res = await teamFormationApi.recommend(run.run_id);
      if (res.error) {
        setError(res.error);
        return;
      }
      onRecommended(run.run_id);
    } catch (e: any) {
      setError(e?.message || "Failed to generate recommendations");
    } finally {
      setBusy(false);
    }
  }

  const totalHeadcount = reqs.roles.reduce((s, r) => s + (r.headcount || 0), 0);

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
            Review parsed requirements
          </h2>
          <p className="text-sm text-gray-600 mt-0.5">
            The agent extracted the spec below. Tweak headcount, allocation, or
            skills if needed before generating recommendations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Users className="w-3.5 h-3.5" />
            {totalHeadcount} seats · {reqs.roles.length} roles
          </span>
          <button
            disabled={busy || reqs.roles.length === 0}
            onClick={generate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-sm hover:shadow-md disabled:opacity-60 text-sm font-medium"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scoring candidates…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Recommendations
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Project name
            </label>
            <input
              value={reqs.project_name}
              onChange={(e) => setReqs({ ...reqs, project_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Duration (months)
            </label>
            <input
              type="number"
              value={reqs.duration_months ?? ""}
              onChange={(e) =>
                setReqs({
                  ...reqs,
                  duration_months: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Project summary
            </label>
            <textarea
              rows={2}
              value={reqs.project_summary}
              onChange={(e) => setReqs({ ...reqs, project_summary: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-indigo-600" />
          Roles requested
        </h3>
        {reqs.roles.map((role, i) => (
          <RoleEditor
            key={i}
            role={role}
            onChange={(patch) => patchRole(i, patch)}
            onRemove={() => removeRole(i)}
          />
        ))}
      </div>
    </div>
  );
}

function RoleEditor({
  role,
  onChange,
  onRemove,
}: {
  role: ProjectRole;
  onChange: (patch: Partial<ProjectRole>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <input
              value={role.designation}
              onChange={(e) => onChange({ designation: e.target.value })}
              className="font-semibold text-gray-900 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
            />
            <p className="text-[11px] text-gray-500">
              {role.department || "—"} · {role.level || "any level"}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          title="Remove role"
          className="text-gray-400 hover:text-red-600 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <NumberField
          label="Headcount"
          value={role.headcount}
          onChange={(v) => onChange({ headcount: Math.max(1, v) })}
        />
        <NumberField
          label="Allocation %"
          value={role.allocation_percent}
          onChange={(v) => onChange({ allocation_percent: Math.max(1, Math.min(100, v)) })}
        />
        <NumberField
          label="Min experience"
          value={role.min_experience_years || 0}
          onChange={(v) => onChange({ min_experience_years: Math.max(0, v) })}
          suffix="yrs"
        />
        <TextField
          label="Department"
          value={role.department || ""}
          onChange={(v) => onChange({ department: v })}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <TagField
          label="Must-have skills"
          values={role.must_have_skills}
          onChange={(v) => onChange({ must_have_skills: v })}
          accent="indigo"
        />
        <TagField
          label="Good-to-have skills"
          values={role.good_to_have_skills}
          onChange={(v) => onChange({ good_to_have_skills: v })}
          accent="gray"
        />
      </div>

      {role.responsibilities && (
        <p className="mt-3 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
          <span className="font-medium text-gray-700">Responsibilities:</span>{" "}
          {role.responsibilities}
        </p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {suffix && <span className="text-[11px] text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function TagField({
  label,
  values,
  onChange,
  accent,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  accent: "indigo" | "gray";
}) {
  const [draft, setDraft] = useState("");
  const colors =
    accent === "indigo"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-1 block">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {values.length === 0 && (
          <span className="text-[11px] text-gray-400 italic">none</span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${colors}`}
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-gray-500 hover:text-gray-800"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a skill…"
          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={add}
          className="px-2.5 py-1.5 text-xs bg-gray-100 text-gray-700 rounded border border-gray-200 hover:bg-gray-200"
        >
          Add
        </button>
      </div>
    </div>
  );
}
