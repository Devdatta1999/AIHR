import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Crown,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import {
  EmployeeSearchResult,
  teamFormationApi,
} from "../../api/teamFormation";

const DEPARTMENTS = [
  "AI/ML",
  "Data Engineering",
  "Design",
  "DevOps & Cloud",
  "HR",
  "IT & Security",
  "Product Management",
  "Quality Assurance",
  "Sales & Operations",
  "Software Engineering",
];

const WORK_MODES = ["Onsite", "Hybrid", "Remote"];

export function ProjectManagerPicker({
  current,
  onPick,
  onClose,
}: {
  current: EmployeeSearchResult | null;
  onPick: (e: EmployeeSearchResult | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [minBandwidth, setMinBandwidth] = useState(50);
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      teamFormationApi
        .searchEmployees({
          q: q.trim() || undefined,
          department: department || undefined,
          work_mode: workMode || undefined,
          min_bandwidth: minBandwidth,
          limit: 25,
        })
        .then((r) => setResults(r.employees))
        .catch((e) => setError(e?.message || "Search failed"))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, department, workMode, minBandwidth]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Add project manager
              </h3>
              <p className="text-[11px] text-gray-500">
                Filter the roster and pick the manager who'll own this project.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* filters */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/60 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, title, or email…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any work mode</option>
              {WORK_MODES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
              <span className="text-[11px] text-gray-500 whitespace-nowrap">
                Min bandwidth
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={minBandwidth}
                onChange={(e) => setMinBandwidth(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs font-medium text-gray-800 w-9 text-right">
                {minBandwidth}%
              </span>
            </div>
          </div>
        </div>

        {/* results */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Searching…
            </div>
          )}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500">
              No employees match the current filters.
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {results.map((e) => {
                const selected = current?.employee_id === e.employee_id;
                return (
                  <button
                    key={e.employee_id}
                    onClick={() => onPick(e)}
                    className={`text-left bg-white rounded-lg border-2 p-3 transition ${
                      selected
                        ? "border-amber-500 ring-2 ring-amber-100"
                        : "border-gray-200 hover:border-amber-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm truncate">
                            {e.first_name} {e.last_name}
                          </span>
                          {e.employee_level && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {e.employee_level}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {e.job_title}
                          {e.department_name && (
                            <span className="text-gray-400"> · {e.department_name}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 inline-flex items-center gap-2">
                          {e.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {e.location}
                              {e.work_mode && ` · ${e.work_mode}`}
                            </span>
                          )}
                        </div>
                      </div>
                      {selected && (
                        <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px]">
                      <span
                        className={`px-1.5 py-0.5 rounded font-medium ${
                          e.bandwidth_percent >= 80
                            ? "bg-emerald-50 text-emerald-700"
                            : e.bandwidth_percent >= 50
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {e.bandwidth_percent}% available
                      </span>
                      <span className="text-gray-500">
                        {e.total_experience_years} yrs
                      </span>
                      {(e.current_project_count ?? 0) > 0 && (
                        <span className="text-gray-500">
                          on {e.current_project_count} project
                          {e.current_project_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-600 truncate">
            {current ? (
              <>
                Selected:{" "}
                <span className="font-medium text-gray-900">
                  {current.first_name} {current.last_name}
                </span>{" "}
                ({current.job_title})
              </>
            ) : (
              "No manager selected yet."
            )}
          </div>
          <div className="flex items-center gap-2">
            {current && (
              <button
                onClick={() => onPick(null)}
                className="text-xs text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded border border-rose-200 hover:bg-rose-50"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
