import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Sparkles } from "lucide-react";
import {
  analyticsApi,
  DashboardBundle,
  DashboardFilters,
  FilterOptions,
} from "../api/analytics";
import { FilterBar } from "./analytics/FilterBar";
import { KpiCards } from "./analytics/KpiCards";
import { DashboardCharts } from "./analytics/DashboardCharts";
import { Chatbot } from "./analytics/Chatbot";

export function HRAnalytics() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Filter options — load once.
  useEffect(() => {
    analyticsApi
      .getFilters()
      .then(setOptions)
      .catch((e) => setError(String(e)));
  }, []);

  // Dashboard bundle — refetch whenever filters change.
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyticsApi
      .getDashboard(filters)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">HR Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Live workforce metrics — and an agentic chatbot that turns natural
            language into SQL, charts, and insights.
          </p>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-indigo-700 hover:to-purple-700 text-sm font-medium"
        >
          <MessageSquareText className="w-4 h-4" />
          Open AI Chatbot
          <Sparkles className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        options={options}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({})}
      />

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards kpis={bundle?.kpis || null} />

      {/* Charts */}
      {loading && !bundle ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-96 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
            <div className="h-72 bg-gray-50 rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-6 h-80 animate-pulse"
              >
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
                <div className="h-60 bg-gray-50 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-96 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
            <div className="h-72 bg-gray-50 rounded" />
          </div>
        </div>
      ) : (
        <DashboardCharts bundle={bundle} />
      )}

      {/* Chatbot drawer */}
      <Chatbot open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
