import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import {
  hrQueriesApi,
  type HRTicket,
  type TicketPriority,
  type TicketStatus,
} from "../../api/hrQueries";

const CATEGORIES = [
  "Work Policy",
  "Leave Policy",
  "Benefits",
  "Compensation",
  "Learning & Development",
  "Other",
];

function formatTimestamp(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusPill(status: TicketStatus) {
  const map: Record<TicketStatus, { cls: string; label: string; Icon: typeof Clock }> = {
    open: { cls: "bg-orange-100 text-orange-700", label: "Open", Icon: AlertCircle },
    in_progress: { cls: "bg-blue-100 text-blue-700", label: "In progress", Icon: Clock },
    resolved: { cls: "bg-green-100 text-green-700", label: "Resolved", Icon: CheckCircle },
  };
  const { cls, label, Icon } = map[status];
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

export function EmployeeAskHR() {
  const [tickets, setTickets] = useState<HRTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("Work Policy");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await hrQueriesApi.listMine();
      setTickets(r.tickets);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function submit() {
    if (question.trim().length < 5) {
      setError("Please enter a more complete question (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await hrQueriesApi.createMine(question.trim(), category, priority);
      setQuestion("");
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3500);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ask HR</h1>
          <p className="text-sm text-gray-600 mt-1">
            Raise a question for People Operations. We respond within 1 business day.
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 bg-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {justSubmitted && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Your question was submitted. HR will respond shortly.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Raise a ticket */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 border border-gray-200 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircleQuestion className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Raise a question</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Question</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={5}
                  placeholder="e.g. How many sick leaves am I entitled to per year?"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit question
              </button>
            </div>
          </div>
        </div>

        {/* Existing tickets */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 px-1">My questions</h2>

          {loading ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-sm text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading your tickets…
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
              <MessageCircleQuestion className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                You haven't raised any questions yet. Use the form on the left to ask HR
                anything.
              </p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.query_id}
                className="bg-white rounded-xl p-5 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                      TKT-{String(t.query_id).padStart(3, "0")}
                    </span>
                    <span>•</span>
                    <span>{formatTimestamp(t.created_at)}</span>
                    {t.category && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                          {t.category}
                        </span>
                      </>
                    )}
                  </div>
                  {statusPill(t.status)}
                </div>

                <p className="text-sm font-medium text-gray-900 mb-3">
                  {t.question}
                </p>

                {t.status === "resolved" && t.hr_response ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-700" />
                      <span className="text-xs font-medium text-green-800">
                        HR Response
                        {t.resolution_kind === "ai" && (
                          <span className="ml-2 inline-flex items-center gap-1 text-blue-700 font-normal">
                            <Sparkles className="w-3 h-3" /> AI-grounded
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {t.hr_response}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Resolved {formatTimestamp(t.resolved_at)}
                      {t.resolved_by ? ` by ${t.resolved_by}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    HR is reviewing your question. You'll see the response here once it's
                    answered.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
