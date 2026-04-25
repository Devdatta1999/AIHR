import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { analyticsApi } from "../../api/analytics";
import { ChatMessage, LocalMessage } from "./ChatMessage";

const SUGGESTIONS = [
  { label: "How many employees are in Engineering?", group: "Headcount" },
  { label: "Average salary by department", group: "Compensation" },
  { label: "Top 10 highest paid employees", group: "Compensation" },
  { label: "Which managers have the most direct reports?", group: "Org" },
  { label: "What is our bench strength?", group: "Custom KPI" },
  { label: "Show compa-ratio by department", group: "Custom KPI" },
  { label: "Group employees by tenure bucket", group: "Custom KPI" },
  { label: "What's the annual attrition rate?", group: "Custom KPI" },
];

export function Chatbot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { kind: "user", content: q }, { kind: "pending" }]);
    setBusy(true);
    try {
      const res = await analyticsApi.chat(q, sessionId);
      setSessionId(res.session_id);
      setMessages((m) => {
        const next = m.slice(0, -1);
        next.push({ kind: "assistant", response: res });
        return next;
      });
    } catch (e: any) {
      setMessages((m) => {
        const next = m.slice(0, -1);
        next.push({ kind: "error", message: e?.message || "Request failed" });
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function newSession() {
    setMessages([]);
    setSessionId(undefined);
  }

  async function clearCache() {
    setClearingCache(true);
    try {
      await analyticsApi.clearCache();
    } finally {
      setClearingCache(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
        {/* Header */}
        <header className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  HR Analytics Chatbot
                </h2>
                <p className="text-[11px] text-gray-500">
                  NL → SQL · semantic cache · RAG
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/60 text-gray-500"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <button
              onClick={newSession}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" />
              New chat
            </button>
            <button
              onClick={clearCache}
              disabled={clearingCache}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title="Clears the Qdrant semantic cache (demo helper)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${clearingCache ? "animate-spin" : ""}`} />
              Clear cache
            </button>
            {sessionId && (
              <span className="ml-auto text-gray-500 truncate" title={sessionId}>
                session {sessionId.slice(0, 8)}…
              </span>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/40">
          {messages.length === 0 ? (
            <Welcome onPick={(q) => send(q)} />
          ) : (
            messages.map((m, i) => <ChatMessage key={i} msg={m} />)
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask anything about your workforce…"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </aside>
    </>
  );
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  const groups = SUGGESTIONS.reduce<Record<string, string[]>>((acc, s) => {
    (acc[s.group] ||= []).push(s.label);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Welcome</h3>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed">
          Ask any HR question in natural language. The agent translates it to
          SQL against the <code className="bg-white px-1 py-0.5 rounded">employees</code>{" "}
          schema, picks the best chart, and explains the result. Repeated or
          paraphrased questions are served from the semantic cache; custom
          Nimbus Labs KPIs are answered using the RAG knowledge base.
        </p>
      </div>

      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {group}
          </p>
          <div className="space-y-1.5">
            {items.map((q) => (
              <button
                key={q}
                onClick={() => onPick(q)}
                className="w-full text-left text-xs px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors flex items-center justify-between group"
              >
                <span className="text-gray-700">{q}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
