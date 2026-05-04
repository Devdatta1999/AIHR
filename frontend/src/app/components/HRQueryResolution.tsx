import {
  MessageCircleQuestion,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Search,
  Send,
  Bot,
  UserCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  hrQueriesApi,
  type HRTicket,
  type HRListCounts,
  type TicketStatus,
  type TicketPriority,
} from "../api/hrQueries";

const CATEGORIES = [
  "All Categories",
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
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
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

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusIcon(status: TicketStatus) {
  switch (status) {
    case "open":
      return <AlertCircle className="w-4 h-4 text-orange-600" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-blue-600" />;
    case "resolved":
      return <CheckCircle className="w-4 h-4 text-green-600" />;
  }
}

function getStatusColor(status: TicketStatus) {
  switch (status) {
    case "open":
      return "bg-orange-100 text-orange-700";
    case "in_progress":
      return "bg-blue-100 text-blue-700";
    case "resolved":
      return "bg-green-100 text-green-700";
  }
}

function getPriorityColor(priority: TicketPriority) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(s: TicketStatus): string {
  return s === "in_progress" ? "in progress" : s;
}

export function HRQueryResolution() {
  const [tickets, setTickets] = useState<HRTicket[]>([]);
  const [counts, setCounts] = useState<HRListCounts>({
    open: 0,
    in_progress: 0,
    resolved: 0,
    resolved_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAIAnswer, setShowAIAnswer] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [resolveBusy, setResolveBusy] = useState(false);
  const [manualResponse, setManualResponse] = useState("");

  const selected = useMemo(
    () => tickets.find((t) => t.query_id === selectedId) || null,
    [tickets, selectedId],
  );

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await hrQueriesApi.list({ limit: 200 });
      setTickets(r.tickets);
      setCounts(r.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterCategory !== "All Categories" && t.category !== filterCategory)
        return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.question.toLowerCase().includes(q) &&
          !t.employee_name.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tickets, filterCategory, filterStatus, search]);

  const stats = [
    { label: "Open Tickets", value: counts.open, color: "orange" as const },
    { label: "In Progress", value: counts.in_progress, color: "blue" as const },
    { label: "Resolved Today", value: counts.resolved_today, color: "green" as const },
    { label: "Total Resolved", value: counts.resolved, color: "purple" as const },
  ];

  function selectTicket(t: HRTicket, mode: "ai" | "manual") {
    setSelectedId(t.query_id);
    setShowAIAnswer(mode === "ai");
    setManualResponse("");
  }

  async function runAISuggest(t: HRTicket) {
    setAiBusy(true);
    setError(null);
    try {
      const updated = await hrQueriesApi.aiSuggest(t.query_id);
      setTickets((cur) =>
        cur.map((x) => (x.query_id === updated.query_id ? updated : x)),
      );
      setSelectedId(updated.query_id);
      setShowAIAnswer(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function sendResolution(
    t: HRTicket,
    text: string,
    kind: "ai" | "edited" | "manual",
  ) {
    if (!text.trim()) {
      setError("Response text is required");
      return;
    }
    setResolveBusy(true);
    setError(null);
    try {
      const updated = await hrQueriesApi.resolve(t.query_id, text, kind);
      setTickets((cur) =>
        cur.map((x) => (x.query_id === updated.query_id ? updated : x)),
      );
      // Refresh counts to keep tiles accurate.
      const r = await hrQueriesApi.list({ limit: 200 });
      setCounts(r.counts);
      setManualResponse("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolveBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">HR Query Resolution</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage employee questions with AI-powered policy retrieval
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700"
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const colorClasses = {
            orange: "bg-orange-50 text-orange-600",
            blue: "bg-blue-50 text-blue-600",
            green: "bg-green-50 text-green-600",
            purple: "bg-purple-50 text-purple-600",
          };
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <div
                className={`inline-block mt-2 px-2 py-1 rounded ${colorClasses[stat.color]}`}
              >
                <span className="text-xs font-medium">Active</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tickets…"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as TicketStatus | "all")
                }
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200 min-h-[200px]">
            {loading ? (
              <div className="p-12 text-center text-sm text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading tickets…
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500">
                No tickets match the current filters.
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.query_id}
                  className={`p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedId === ticket.query_id
                      ? "bg-blue-50 border-l-4 border-l-blue-500"
                      : ""
                  }`}
                  onClick={() => setSelectedId(ticket.query_id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {initials(ticket.employee_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">
                            {ticket.employee_name}
                          </h3>
                          {ticket.employee_role && (
                            <span className="text-xs text-gray-500">
                              • {ticket.employee_role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>TKT-{String(ticket.query_id).padStart(3, "0")}</span>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{formatTimestamp(ticket.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${getPriorityColor(ticket.priority)}`}
                      >
                        {ticket.priority}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(ticket.status)} flex items-center gap-1`}
                      >
                        {getStatusIcon(ticket.status)}
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-900 mb-3 font-medium">
                    {ticket.question}
                  </p>

                  <div className="flex items-center justify-between">
                    {ticket.category ? (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {ticket.category}
                      </span>
                    ) : (
                      <span />
                    )}
                    {ticket.status !== "resolved" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTicket(ticket, "manual");
                          }}
                          className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                        >
                          <UserCircle className="w-3.5 h-3.5 inline mr-1" />
                          Answer Manually
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTicket(ticket, "ai");
                            if (!ticket.ai_suggestion) runAISuggest(ticket);
                          }}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                          Resolve using AI
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-gray-700" />
                  <h2 className="font-semibold text-gray-900">Ticket Details</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ticket ID</p>
                    <p className="text-sm font-medium text-gray-900">
                      TKT-{String(selected.query_id).padStart(3, "0")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Employee</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selected.employee_name}
                    </p>
                    {selected.employee_role && (
                      <p className="text-xs text-gray-600">{selected.employee_role}</p>
                    )}
                  </div>
                  {selected.category && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Category</p>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                        {selected.category}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selected.status)}`}
                    >
                      {statusLabel(selected.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* RESOLVED — show the final answer */}
              {selected.status === "resolved" && selected.hr_response && (
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-700" />
                    <h3 className="font-semibold text-gray-900">Sent to Employee</h3>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-green-200 mb-3">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {selected.hr_response}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    Resolved by {selected.resolved_by || "HR"} (
                    {selected.resolution_kind === "ai"
                      ? "AI answer"
                      : selected.resolution_kind === "edited"
                        ? "edited AI"
                        : "manual"}
                    ) — {formatTimestamp(selected.resolved_at)}
                  </p>
                </div>
              )}

              {/* OPEN/IN_PROGRESS + showAIAnswer — show AI suggestion */}
              {selected.status !== "resolved" && showAIAnswer && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">AI-Generated Answer</h3>
                  </div>

                  {aiBusy ? (
                    <div className="p-6 bg-white rounded-lg border border-blue-200 mb-4 text-center text-sm text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Retrieving policy and generating answer…
                    </div>
                  ) : selected.ai_suggestion ? (
                    <>
                      <div className="p-4 bg-white rounded-lg border border-blue-200 mb-3">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {selected.ai_suggestion}
                        </p>
                      </div>
                      {selected.ai_sources && selected.ai_sources.length > 0 && (
                        <div className="text-xs text-blue-700 mb-4">
                          <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                          Grounded on:{" "}
                          {selected.ai_sources
                            .slice(0, 3)
                            .map((s) => s.section || s.source || "—")
                            .join(", ")}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          disabled={resolveBusy}
                          onClick={() =>
                            sendResolution(
                              selected,
                              selected.ai_suggestion || "",
                              "ai",
                            )
                          }
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60"
                        >
                          {resolveBusy ? (
                            <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
                          ) : (
                            <Send className="w-4 h-4 inline mr-1" />
                          )}
                          Send AI Answer
                        </button>
                        <button
                          onClick={() => {
                            setManualResponse(selected.ai_suggestion || "");
                            setShowAIAnswer(false);
                          }}
                          className="flex-1 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                        >
                          Edit & Send
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => runAISuggest(selected)}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Generate AI Answer
                    </button>
                  )}
                </div>
              )}

              {/* OPEN/IN_PROGRESS + manual mode */}
              {selected.status !== "resolved" && !showAIAnswer && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Your Response</h3>
                    {selected.ai_suggestion && (
                      <button
                        onClick={() => setShowAIAnswer(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        View AI Suggestion
                      </button>
                    )}
                  </div>
                  <textarea
                    value={manualResponse}
                    onChange={(e) => setManualResponse(e.target.value)}
                    placeholder="Type your response here…"
                    rows={8}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <button
                    disabled={resolveBusy || !manualResponse.trim()}
                    onClick={() =>
                      sendResolution(
                        selected,
                        manualResponse,
                        // If the textarea was prefilled from AI suggestion, this is "edited";
                        // otherwise pure "manual". We can't perfectly distinguish without
                        // tracking edits, so call it "edited" if there's a cached AI answer.
                        selected.ai_suggestion ? "edited" : "manual",
                      )
                    }
                    className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-60"
                  >
                    {resolveBusy ? (
                      <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
                    ) : (
                      <Send className="w-4 h-4 inline mr-1" />
                    )}
                    Send Response & Resolve
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
              <MessageCircleQuestion className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Select a ticket to view details and respond
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
