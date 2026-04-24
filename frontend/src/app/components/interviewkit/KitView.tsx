import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  api,
  BehavioralQuestion,
  InterviewKit,
  Job,
  TechnicalQuestion,
} from "../hiring/api";
import { Employee, kitAssign } from "../../api/portal";

type Props = {
  job: Job;
  onBack: () => void;
};

const SECTION_META: Record<
  string,
  { label: string; blurb: string; icon: React.ComponentType<any> }
> = {
  culture_fit: {
    label: "Culture Fit",
    blurb: "Candor, trust, outcome ownership.",
    icon: Users,
  },
  leadership: {
    label: "Leadership",
    blurb: "Bias for action, raise the bar, systems thinking.",
    icon: Sparkles,
  },
  situational: {
    label: "Situational Judgment",
    blurb: "Realistic scenarios, tradeoffs, pressure.",
    icon: Lightbulb,
  },
};

export function KitView({ job, onBack }: Props) {
  const [kit, setKit] = useState<InterviewKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await api.getKit(job.job_id);
      setKit(existing);
    } catch {
      setKit(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [job.job_id]);

  const regenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const fresh = await api.generateKit(job.job_id);
      setKit(fresh);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {job.job_title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {job.department} · {job.location ?? "—"} ·{" "}
              {job.employment_type ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {kit?.kit_id && (
            <SendToEmployee kitId={kit.kit_id} />
          )}
          <button
            onClick={regenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {kit ? "Regenerate" : "Generate kit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading kit…</div>
      )}

      {!loading && !kit && !generating && !error && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Brain className="w-8 h-8 text-blue-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">
            No interview kit yet for this role
          </h3>
          <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
            The agent pulls from company values, leadership principles, the JD,
            and public web signals to assemble behavioral + technical
            questions.
          </p>
          <button
            onClick={regenerate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate interview kit
          </button>
        </div>
      )}

      {generating && !kit && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <RefreshCw className="w-6 h-6 text-blue-500 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-gray-600">
            Agent is retrieving context + drafting questions — this can take up
            to a minute.
          </p>
        </div>
      )}

      {kit && (
        <>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">
                Calibration notes
              </h3>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {kit.overall_notes ??
                "Use the signals column to calibrate. A 'no hire' from any interviewer is a no-hire unless the bar-raiser overrides."}
            </p>
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
              {kit.model_id && <span>Model: {kit.model_id}</span>}
              {kit.created_at && (
                <span>Generated: {new Date(kit.created_at).toLocaleString()}</span>
              )}
            </div>
          </div>

          <Section title="Behavioral questions">
            {Object.entries(kit.behavioral).map(([key, qs]) => (
              <SubSection
                key={key}
                meta={SECTION_META[key] ?? { label: key, blurb: "", icon: Users }}
                questions={qs}
              />
            ))}
          </Section>

          <Section title="Technical questions">
            <div className="space-y-3">
              {kit.technical.map((q, i) => (
                <TechCard key={i} q={q} index={i + 1} />
              ))}
            </div>
          </Section>

          <Sources rag={kit.rag_sources ?? []} web={kit.web_sources ?? []} />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function SubSection({
  meta,
  questions,
}: {
  meta: { label: string; blurb: string; icon: React.ComponentType<any> };
  questions: BehavioralQuestion[];
}) {
  const Icon = meta.icon;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{meta.label}</h3>
          <p className="text-xs text-gray-500">{meta.blurb}</p>
        </div>
      </div>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionCard key={i} q={q} />
        ))}
        {questions.length === 0 && (
          <p className="text-xs text-gray-400">No questions generated.</p>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q }: { q: BehavioralQuestion }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <p className="text-sm font-medium text-gray-900">{q.question}</p>
      {q.signal && (
        <p className="text-xs text-gray-600 mt-1">
          <span className="font-semibold text-gray-700">Signal:</span> {q.signal}
        </p>
      )}
      {q.good_answer && (
        <p className="text-xs text-green-700 mt-1">
          <span className="font-semibold">Good answer:</span> {q.good_answer}
        </p>
      )}
      {q.follow_up && (
        <p className="text-xs text-blue-700 mt-1">
          <span className="font-semibold">Follow-up:</span> {q.follow_up}
        </p>
      )}
    </div>
  );
}

function TechCard({ q, index }: { q: TechnicalQuestion; index: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            {index}. {q.question}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            {q.skill && (
              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {q.skill}
              </span>
            )}
            {q.difficulty && (
              <span
                className={`px-2 py-0.5 rounded ${
                  q.difficulty === "hard"
                    ? "bg-red-50 text-red-700"
                    : q.difficulty === "medium"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {q.difficulty}
              </span>
            )}
          </div>
        </div>
        <Zap className="w-4 h-4 text-blue-500 shrink-0" />
      </div>
      {q.signal && (
        <p className="text-xs text-gray-600 mt-2">
          <span className="font-semibold text-gray-700">Signal:</span> {q.signal}
        </p>
      )}
      {q.good_answer && (
        <p className="text-xs text-green-700 mt-1">
          <span className="font-semibold">Good answer:</span> {q.good_answer}
        </p>
      )}
      {q.follow_up && (
        <p className="text-xs text-blue-700 mt-1">
          <span className="font-semibold">Follow-up:</span> {q.follow_up}
        </p>
      )}
    </div>
  );
}

function SendToEmployee({ kitId }: { kitId: number }) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [pickedEmail, setPickedEmail] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [seniority, setSeniority] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || employees) return;
    kitAssign
      .listEmployees()
      .then((es) => {
        setEmployees(es);
        if (es.length === 1) {
          setPickedEmail(es[0].email);
          setPickedId(es[0].employee_id);
        }
      })
      .catch((e) => setErr(String(e)));
  }, [open, employees]);

  const departments = Array.from(
    new Set((employees || []).map((e) => e.department).filter(Boolean) as string[]),
  ).sort();
  const locations = Array.from(
    new Set((employees || []).map((e) => e.location).filter(Boolean) as string[]),
  ).sort();

  const seniorityMatch = (title: string | null | undefined): string => {
    const t = (title || "").toLowerCase();
    if (/(chief|vp|vice president|head of|director)/.test(t)) return "Leadership";
    if (/(principal|staff|architect)/.test(t)) return "Principal/Staff";
    if (/(senior|sr\.|lead|manager)/.test(t)) return "Senior";
    if (/(junior|jr\.|associate|intern|trainee)/.test(t)) return "Junior";
    return "Mid-level";
  };

  const filtered = (employees || []).filter((e) => {
    if (department && e.department !== department) return false;
    if (location && e.location !== location) return false;
    if (seniority && seniorityMatch(e.job_title) !== seniority) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.job_title || "").toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q)
    );
  });

  const clearFilters = () => {
    setQuery("");
    setDepartment("");
    setLocation("");
    setSeniority("");
  };

  const send = async () => {
    if (!pickedEmail) return;
    setBusy(true);
    setErr(null);
    try {
      await kitAssign.assign(kitId, pickedEmail, pickedId);
      const emp = employees?.find((e) => e.email === pickedEmail);
      setDone(emp ? `${emp.first_name} ${emp.last_name}` : pickedEmail);
      setTimeout(() => {
        setOpen(false);
        setDone(null);
        setPickedEmail(null);
        setPickedId(undefined);
        setQuery("");
      }, 1400);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <Send className="w-4 h-4" />
        Send to employee
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Share interview kit
                </h3>
                <p className="text-xs text-gray-500">
                  Pick any team member — they'll see this kit in their portal.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-5 pt-4 space-y-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, role, or team…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All locations</option>
                  {locations.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">All seniority</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid-level">Mid-level</option>
                  <option value="Senior">Senior</option>
                  <option value="Principal/Staff">Principal / Staff</option>
                  <option value="Leadership">Leadership</option>
                </select>
              </div>
              {employees && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {filtered.length} of {employees.length} employees
                  </span>
                  {(query || department || location || seniority) && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-emerald-700 hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 max-h-[420px] overflow-y-auto">
              {done ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Shared with {done}.
                </div>
              ) : !employees ? (
                <p className="text-sm text-gray-500">Loading employees…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-500">No matches.</p>
              ) : (
                <div className="space-y-2">
                  {filtered.slice(0, 50).map((e) => (
                    <label
                      key={`${e.employee_id}-${e.email}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        pickedEmail === e.email
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={pickedEmail === e.email}
                        onChange={() => {
                          setPickedEmail(e.email);
                          setPickedId(e.employee_id);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {e.first_name} {e.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {e.job_title ?? "—"}
                          {e.department ? ` · ${e.department}` : ""} · {e.email}
                        </p>
                      </div>
                    </label>
                  ))}
                  {filtered.length > 50 && (
                    <p className="text-xs text-gray-400 text-center pt-2">
                      Showing 50 of {filtered.length} — refine search to narrow.
                    </p>
                  )}
                </div>
              )}

              {err && (
                <p className="text-xs text-red-600 mt-3">{err}</p>
              )}
            </div>

            {!done && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={!pickedEmail || busy}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send kit"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Sources({
  rag,
  web,
}: {
  rag: { source?: string; section?: string; score?: number }[];
  web: { title?: string; url?: string }[];
}) {
  if (rag.length === 0 && web.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Sources used</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">
            Internal (RAG)
          </p>
          <ul className="space-y-1">
            {rag.map((s, i) => (
              <li key={i} className="text-xs text-gray-700">
                · {s.source} — {s.section}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Web</p>
          <ul className="space-y-1">
            {web.map((s, i) => (
              <li key={i} className="text-xs text-blue-600 truncate">
                ·{" "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
