import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Code2,
  Database,
  Sparkles,
  Zap,
} from "lucide-react";
import { ChatResponse } from "../../api/analytics";
import { ChartRenderer } from "./ChartRenderer";

export type LocalMessage =
  | { kind: "user"; content: string }
  | { kind: "assistant"; response: ChatResponse }
  | { kind: "pending" }
  | { kind: "error"; message: string };

export function ChatMessage({ msg }: { msg: LocalMessage }) {
  if (msg.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  if (msg.kind === "pending") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-500 inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: "0.3s" }}
          />
          <span className="ml-1 italic">Thinking…</span>
        </div>
      </div>
    );
  }

  if (msg.kind === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>{msg.message}</div>
        </div>
      </div>
    );
  }

  return <AssistantBubble response={msg.response} />;
}

function AssistantBubble({ response }: { response: ChatResponse }) {
  const [showSql, setShowSql] = useState(false);
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {response.cache_hit && (
              <Badge color="green" Icon={Zap}>
                Cache hit · {(response.cache_similarity * 100).toFixed(0)}%
              </Badge>
            )}
            {response.rag_hit && (
              <Badge color="blue" Icon={BookOpen}>
                RAG · {response.rag_sources.length} source
                {response.rag_sources.length === 1 ? "" : "s"}
              </Badge>
            )}
            {!response.cache_hit && !response.rag_hit && !response.error && (
              <Badge color="gray" Icon={Sparkles}>
                Live SQL
              </Badge>
            )}
            {response.error && (
              <Badge color="red" Icon={AlertTriangle}>
                Error
              </Badge>
            )}
          </div>

          {/* Insight */}
          <p className="text-sm text-gray-800 leading-relaxed">
            {response.error ? (
              <span className="text-red-700">{response.error}</span>
            ) : (
              response.answer
            )}
          </p>

          {/* Chart */}
          {!response.error && response.chart && response.chart.type !== "empty" && (
            <div className="mt-4">
              <ChartRenderer chart={response.chart} />
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2 text-[11px]">
            {response.sql && (
              <button
                onClick={() => setShowSql((s) => !s)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <Code2 className="w-3 h-3" />
                {showSql ? "Hide" : "View"} SQL
              </button>
            )}
            {response.rag_sources.length > 0 && (
              <button
                onClick={() => setShowSources((s) => !s)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-gray-600 hover:bg-gray-100"
              >
                <BookOpen className="w-3 h-3" />
                {showSources ? "Hide" : "View"} sources
              </button>
            )}
            {response.row_count > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-gray-500">
                <Database className="w-3 h-3" />
                {response.row_count} row{response.row_count === 1 ? "" : "s"}
              </span>
            )}
            {response.used_model && response.used_model !== "cache" && (
              <span className="ml-auto text-gray-400 truncate" title={response.used_model}>
                {response.used_model.split("/").pop()}
              </span>
            )}
          </div>

          {showSql && response.sql && (
            <pre className="mt-2 bg-slate-900 text-slate-100 text-[11px] leading-relaxed p-3 rounded-lg overflow-auto max-h-60">
              <code>{response.sql}</code>
            </pre>
          )}

          {showSources && response.rag_sources.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-gray-700 bg-blue-50 border border-blue-100 rounded-md p-3">
              {response.rag_sources.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <BookOpen className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>
                    <span className="font-medium">{s.source}</span>
                    {s.section && (
                      <span className="text-gray-500"> — {s.section}</span>
                    )}
                    <span className="text-gray-400"> · score {s.score.toFixed(2)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const COLORS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-gray-50 text-gray-600 border-gray-200",
  red: "bg-red-50 text-red-700 border-red-200",
};

function Badge({
  color,
  Icon,
  children,
}: {
  color: keyof typeof COLORS;
  Icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${COLORS[color]}`}
    >
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}
