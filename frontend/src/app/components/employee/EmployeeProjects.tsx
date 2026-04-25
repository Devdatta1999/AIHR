import { useEffect, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  Crown,
  FolderKanban,
  Loader2,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import { employeeApi, MyProject, Teammate } from "../../api/portal";

export function EmployeeProjects() {
  const [data, setData] = useState<MyProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    employeeApi
      .listProjects()
      .then((r) => !cancelled && setData(r.projects))
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading projects…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Header />
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 inline-flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          {error}
        </div>
      </div>
    );
  }

  const projects = data || [];
  const active = projects.filter((p) => p.assignment_status === "Active");
  const totalAllocation = active.reduce(
    (s, p) => s + (p.allocation_percent || 0),
    0,
  );
  const teammateSet = new Set<number>();
  active.forEach((p) =>
    p.teammates.forEach((t) => teammateSet.add(t.employee_id)),
  );

  return (
    <div className="space-y-6">
      <Header />

      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat
            icon={FolderKanban}
            label="Active projects"
            value={String(active.length)}
            tone="indigo"
          />
          <Stat
            icon={Users}
            label="Teammates"
            value={String(teammateSet.size)}
            tone="emerald"
          />
          <Stat
            icon={Briefcase}
            label="Allocation"
            value={`${Math.round(totalAllocation)}%`}
            tone="violet"
          />
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <ProjectCard key={p.employee_project_id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">My Projects</h1>
      <p className="text-sm text-gray-600 mt-1">
        Projects you're staffed on, your role, and your teammates.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mb-3">
        <FolderKanban className="w-6 h-6 text-indigo-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">
        No active projects yet
      </h3>
      <p className="text-sm text-gray-600 mt-1 max-w-sm mx-auto">
        When HR staffs you on a project, it'll show up here with your role and
        teammates.
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "violet";
}) {
  const styles = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-teal-600",
    violet: "from-violet-500 to-purple-600",
  }[tone];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${styles} flex items-center justify-center text-white`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[11px] text-gray-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-xl font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function ProjectCard({ project: p }: { project: MyProject }) {
  const [open, setOpen] = useState(p.assignment_status === "Active");

  const statusTone =
    p.assignment_status === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : p.assignment_status === "Planned"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-gray-50 text-gray-600 border-gray-200";

  const priorityTone =
    p.priority === "High" || p.priority === "Critical"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : p.priority === "Medium"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-gray-50 text-gray-600 border-gray-200";

  const fmtDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900">
                {p.project_name}
              </h3>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border ${statusTone}`}
              >
                {p.assignment_status}
              </span>
              {p.priority && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${priorityTone}`}
                >
                  {p.priority} priority
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              You're <span className="font-medium text-gray-900">{p.role_in_project}</span>
              {p.allocation_percent != null && (
                <> at <span className="font-medium text-gray-900">{p.allocation_percent}%</span> allocation</>
              )}
            </p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-200"
          >
            {open ? (
              <>
                Collapse <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Expand <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {p.description && (
          <p className="mt-3 text-sm text-gray-700 leading-relaxed">
            {p.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Meta
            icon={Calendar}
            label="Project window"
            value={`${fmtDate(p.project_start_date)} → ${fmtDate(p.project_end_date)}`}
          />
          <Meta
            icon={Briefcase}
            label="Project status"
            value={p.project_status || "—"}
          />
          {p.manager && (
            <Meta
              icon={Crown}
              label="Project manager"
              value={`${p.manager.first_name || ""} ${p.manager.last_name || ""}`.trim() || "—"}
              sub={p.manager.job_title}
            />
          )}
          <Meta
            icon={Users}
            label="Teammates"
            value={`${p.teammates.length} on this project`}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3 inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Teammates ({p.teammates.length})
          </h4>
          {p.teammates.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              You're the only person currently active on this project.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {p.teammates.map((t) => (
                <TeammateRow key={t.employee_id} t={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-medium text-gray-900 truncate">
          {value}
        </div>
        {sub && (
          <div className="text-[11px] text-gray-500 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

function TeammateRow({ t }: { t: Teammate }) {
  const initials = `${t.first_name?.[0] || ""}${t.last_name?.[0] || ""}`.toUpperCase();
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {t.first_name} {t.last_name}
          </span>
          {t.employee_level && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {t.employee_level}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {t.role_in_project}
          {t.allocation_percent != null && (
            <span className="text-gray-400"> · {t.allocation_percent}%</span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 inline-flex items-center gap-2 flex-wrap">
          {t.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {t.location}
              {t.work_mode && ` · ${t.work_mode}`}
            </span>
          )}
          {t.email && (
            <a
              href={`mailto:${t.email}`}
              className="inline-flex items-center gap-1 hover:text-indigo-700"
            >
              <Mail className="w-3 h-3" />
              {t.email}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
