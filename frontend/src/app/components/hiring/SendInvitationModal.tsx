import { useEffect, useMemo, useState } from "react";
import {
  X,
  Send,
  Video,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import {
  api,
  ApplicantCard,
  InvitationResult,
} from "./api";
import { Employee, kitAssign } from "../../api/portal";

type Props = {
  jobId: number;
  jobTitle: string;
  kind: "screening" | "technical";
  candidates: ApplicantCard[];
  onClose: () => void;
};

function defaultSlot() {
  // Tomorrow 10:00 local.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function SendInvitationModal({
  jobId,
  jobTitle,
  kind,
  candidates,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(candidates.map((c) => c.applicant_id)),
  );
  const [when, setWhen] = useState<string>(defaultSlot());
  const [duration, setDuration] = useState(30);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InvitationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Interviewer picker (optional).
  const [interviewerPickerOpen, setInterviewerPickerOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [employeesErr, setEmployeesErr] = useState<string | null>(null);
  const [interviewerEmails, setInterviewerEmails] = useState<Set<string>>(
    new Set(),
  );
  const [empQuery, setEmpQuery] = useState("");
  const [empDept, setEmpDept] = useState("");
  const [empLoc, setEmpLoc] = useState("");
  const [empSeniority, setEmpSeniority] = useState("");

  useEffect(() => {
    if (!interviewerPickerOpen || employees) return;
    kitAssign
      .listEmployees()
      .then(setEmployees)
      .catch((e) => setEmployeesErr(String(e)));
  }, [interviewerPickerOpen, employees]);

  const seniorityMatch = (title: string | null | undefined): string => {
    const t = (title || "").toLowerCase();
    if (/(chief|vp|vice president|head of|director)/.test(t)) return "Leadership";
    if (/(principal|staff|architect)/.test(t)) return "Principal/Staff";
    if (/(senior|sr\.|lead|manager)/.test(t)) return "Senior";
    if (/(junior|jr\.|associate|intern|trainee)/.test(t)) return "Junior";
    return "Mid-level";
  };
  const departments = Array.from(
    new Set((employees || []).map((e) => e.department).filter(Boolean) as string[]),
  ).sort();
  const locations = Array.from(
    new Set((employees || []).map((e) => e.location).filter(Boolean) as string[]),
  ).sort();
  const filteredEmployees = (employees || []).filter((e) => {
    if (empDept && e.department !== empDept) return false;
    if (empLoc && e.location !== empLoc) return false;
    if (empSeniority && seniorityMatch(e.job_title) !== empSeniority) return false;
    if (!empQuery.trim()) return true;
    const q = empQuery.toLowerCase();
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.job_title || "").toLowerCase().includes(q) ||
      (e.department || "").toLowerCase().includes(q)
    );
  });
  const toggleInterviewer = (email: string) =>
    setInterviewerEmails((prev) => {
      const next = new Set(prev);
      const k = email.toLowerCase();
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const selectedInterviewers = Array.from(interviewerEmails)
    .map((em) => employees?.find((e) => e.email.toLowerCase() === em))
    .filter(Boolean) as Employee[];

  const title =
    kind === "screening"
      ? "Schedule screening calls"
      : "Schedule technical interviews";
  const subtitle =
    kind === "screening"
      ? "Sends a Google Meet invite from our Talent team."
      : "Sends a Google Meet invite from our Engineering team.";

  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    try {
      // `when` is a local datetime string "YYYY-MM-DDTHH:mm". Build an ISO
      // with the browser's timezone offset so the backend treats it as
      // local time in `tz`.
      const local = new Date(when);
      const offsetMin = -local.getTimezoneOffset();
      const sign = offsetMin >= 0 ? "+" : "-";
      const abs = Math.abs(offsetMin);
      const pad = (n: number) => String(n).padStart(2, "0");
      const isoWithOffset = `${when}:00${sign}${pad(Math.floor(abs / 60))}:${pad(
        abs % 60,
      )}`;

      const res = await api.sendInvitations({
        job_id: jobId,
        applicant_ids: [...selected],
        kind,
        scheduled_at: isoWithOffset,
        duration_minutes: duration,
        timezone: tz,
        interviewer_emails:
          interviewerEmails.size > 0 ? [...interviewerEmails] : undefined,
      });
      setResults(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {subtitle} · {jobTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {!results && (
            <>
              {/* When */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Timezone: {tz}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>

              {/* Candidates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">
                    Candidates ({selected.size} / {candidates.length})
                  </label>
                  <button
                    onClick={() =>
                      setSelected(
                        selected.size === candidates.length
                          ? new Set()
                          : new Set(candidates.map((c) => c.applicant_id)),
                      )
                    }
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {selected.size === candidates.length
                      ? "Clear all"
                      : "Select all"}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {candidates.length === 0 && (
                    <div className="p-4 text-sm text-gray-500 italic">
                      No candidates in this stage.
                    </div>
                  )}
                  {candidates.map((c) => (
                    <label
                      key={c.applicant_id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.applicant_id)}
                        onChange={() => toggle(c.applicant_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {c.email}
                        </div>
                      </div>
                      {c.overall_score != null && (
                        <span className="text-xs text-blue-600 font-medium">
                          {c.overall_score}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Interviewers (optional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Employee interviewers ({selectedInterviewers.length})
                    <span className="ml-1 text-gray-400 font-normal">
                      · optional
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setInterviewerPickerOpen((v) => !v)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {interviewerPickerOpen ? "Hide picker" : "Add interviewers"}
                  </button>
                </div>

                {selectedInterviewers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedInterviewers.map((e) => (
                      <span
                        key={e.email}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full border border-indigo-100"
                      >
                        {e.first_name} {e.last_name}
                        <button
                          type="button"
                          onClick={() => toggleInterviewer(e.email)}
                          className="text-indigo-500 hover:text-indigo-700"
                          aria-label="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {interviewerPickerOpen && (
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <input
                      value={empQuery}
                      onChange={(e) => setEmpQuery(e.target.value)}
                      placeholder="Search name, email, role, or team…"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={empDept}
                        onChange={(e) => setEmpDept(e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All departments</option>
                        {departments.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={empLoc}
                        onChange={(e) => setEmpLoc(e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All locations</option>
                        {locations.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select
                        value={empSeniority}
                        onChange={(e) => setEmpSeniority(e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All seniority</option>
                        <option value="Junior">Junior</option>
                        <option value="Mid-level">Mid-level</option>
                        <option value="Senior">Senior</option>
                        <option value="Principal/Staff">Principal / Staff</option>
                        <option value="Leadership">Leadership</option>
                      </select>
                    </div>
                    <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                      {employeesErr && (
                        <div className="p-3 text-xs text-red-600">
                          {employeesErr}
                        </div>
                      )}
                      {!employees && !employeesErr && (
                        <div className="p-3 text-xs text-gray-500">
                          Loading employees…
                        </div>
                      )}
                      {employees && filteredEmployees.length === 0 && (
                        <div className="p-3 text-xs text-gray-500">
                          No matches.
                        </div>
                      )}
                      {filteredEmployees.slice(0, 50).map((e) => {
                        const checked = interviewerEmails.has(
                          e.email.toLowerCase(),
                        );
                        return (
                          <label
                            key={`${e.employee_id}-${e.email}`}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleInterviewer(e.email)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {e.first_name} {e.last_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {e.job_title ?? "—"}
                                {e.department ? ` · ${e.department}` : ""} ·{" "}
                                {e.email}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                      {filteredEmployees.length > 50 && (
                        <div className="px-3 py-2 text-xs text-gray-400 text-center">
                          Showing 50 of {filteredEmployees.length} — refine to
                          narrow.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Invitations sent
              </h3>
              {results.map((r) => (
                <div
                  key={r.applicant_id}
                  className={`rounded-lg border p-3 ${
                    r.status === "sent"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {r.status === "sent" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {r.email}
                      </div>
                      {r.meet_link && (
                        <a
                          href={r.meet_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <Video className="w-3 h-3" />
                          {r.meet_link}
                        </a>
                      )}
                      {r.error && (
                        <div className="text-xs text-red-700 mt-1">
                          {r.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            {results ? "Done" : "Cancel"}
          </button>
          {!results && (
            <button
              onClick={send}
              disabled={sending || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending
                ? "Sending…"
                : `Send ${selected.size} invite${selected.size === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
