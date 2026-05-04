import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  FolderKanban,
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "../auth/AuthContext";
import {
  dashboardApi,
  type DashboardSummary,
  type AIInsight,
  type AttentionItem,
  type ActivityItem,
} from "../api/dashboard";

// ============================================================
// Helpers
// ============================================================

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Working late";
}

function firstName(full?: string | null): string {
  if (!full) return "there";
  return full.split(" ")[0];
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtMoney(n: number): string {
  return `$${fmtCompact(n)}`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const DEPT_COLORS = [
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
];

// ============================================================
// Reusable bits
// ============================================================

function KPITile({
  label,
  value,
  caption,
  Icon,
  accent,
  trend,
  trendData,
}: {
  label: string;
  value: string | number;
  caption?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  accent: "indigo" | "emerald" | "violet" | "amber" | "rose" | "sky";
  trend?: { delta: number; label?: string };
  trendData?: number[];
}) {
  const accents: Record<
    typeof accent,
    { iconBg: string; iconColor: string; chart: string; gradFrom: string; gradTo: string }
  > = {
    indigo: {
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      chart: "#6366f1",
      gradFrom: "from-indigo-500/10",
      gradTo: "to-transparent",
    },
    emerald: {
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      chart: "#10b981",
      gradFrom: "from-emerald-500/10",
      gradTo: "to-transparent",
    },
    violet: {
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      chart: "#8b5cf6",
      gradFrom: "from-violet-500/10",
      gradTo: "to-transparent",
    },
    amber: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      chart: "#f59e0b",
      gradFrom: "from-amber-500/10",
      gradTo: "to-transparent",
    },
    rose: {
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      chart: "#f43f5e",
      gradFrom: "from-rose-500/10",
      gradTo: "to-transparent",
    },
    sky: {
      iconBg: "bg-sky-50",
      iconColor: "text-sky-600",
      chart: "#0ea5e9",
      gradFrom: "from-sky-500/10",
      gradTo: "to-transparent",
    },
  };
  const a = accents[accent];

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl p-5 border border-gray-200/80 hover:shadow-lg hover:shadow-gray-200/60 hover:-translate-y-0.5 transition-all duration-200">
      <div className={`absolute -top-12 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${a.gradFrom} ${a.gradTo}`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`${a.iconBg} ${a.iconColor} rounded-xl p-2.5`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <span
              className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
                trend.delta >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              <ArrowUpRight
                className={`w-3.5 h-3.5 ${trend.delta < 0 ? "rotate-90" : ""}`}
              />
              {trend.delta >= 0 ? "+" : ""}
              {trend.delta}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-semibold text-gray-900 tracking-tight">{value}</p>
        {caption && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{caption}</p>
        )}

        {trendData && trendData.length > 1 && (
          <div className="mt-3 -mx-1 -mb-1 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData.map((v, i) => ({ i, v }))}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={a.chart} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={a.chart} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={a.chart}
                  strokeWidth={1.75}
                  fill={`url(#spark-${accent})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const sevMap: Record<
    AIInsight["severity"],
    { ring: string; chip: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    info: {
      ring: "border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 to-white",
      chip: "bg-indigo-100 text-indigo-700",
      icon: TrendingUp,
    },
    warn: {
      ring: "border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-white",
      chip: "bg-amber-100 text-amber-700",
      icon: AlertTriangle,
    },
    success: {
      ring: "border-emerald-200/70 bg-gradient-to-br from-emerald-50/60 to-white",
      chip: "bg-emerald-100 text-emerald-700",
      icon: CheckCircle2,
    },
  };
  const s = sevMap[insight.severity];
  const Icon = s.icon;
  return (
    <div className={`rounded-xl border ${s.ring} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 inline-flex w-7 h-7 rounded-lg items-center justify-center ${s.chip}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{insight.title}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{insight.body}</p>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const sev = item.severity === "warn" ? "amber" : item.severity === "success" ? "emerald" : "indigo";
  const map: Record<string, { dot: string; cta: string }> = {
    amber: { dot: "bg-amber-500", cta: "text-amber-700 hover:text-amber-900" },
    emerald: { dot: "bg-emerald-500", cta: "text-emerald-700 hover:text-emerald-900" },
    indigo: { dot: "bg-indigo-500", cta: "text-indigo-700 hover:text-indigo-900" },
  };
  return (
    <Link
      to={item.cta_path}
      className="group flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className={`shrink-0 w-2 h-2 rounded-full mt-2 ${map[sev].dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-snug">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
        )}
      </div>
      <span className={`text-xs font-medium inline-flex items-center gap-1 ${map[sev].cta}`}>
        {item.cta_label}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const map: Record<
    ActivityItem["kind"],
    { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
  > = {
    hire: { Icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-50" },
    payroll: { Icon: DollarSign, color: "text-violet-600", bg: "bg-violet-50" },
    hr_query: { Icon: MessageCircleQuestion, color: "text-indigo-600", bg: "bg-indigo-50" },
  };
  const m = map[item.kind];
  const Icon = m.Icon;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`shrink-0 inline-flex w-8 h-8 rounded-lg items-center justify-center ${m.bg} ${m.color}`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-snug truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
        )}
      </div>
      <span className="text-xs text-gray-400 shrink-0">{fmtRelative(item.at)}</span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg">
      {label && <div className="text-gray-300 mb-0.5">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="font-medium">
            {formatter ? formatter(p.value) : p.value}
          </span>
          {p.name && <span className="text-gray-300">{p.name}</span>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main page
// ============================================================

export function Dashboard() {
  const { identity } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await dashboardApi.summary();
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const headcountSparkline = useMemo(
    () => data?.headcount_trend.slice(-6).map((p) => p.headcount) || [],
    [data],
  );
  const payrollSparkline = useMemo(
    () => data?.payroll_trend.map((p) => p.gross) || [],
    [data],
  );

  // ============================================================
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-sm text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading dashboard…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { tiles, period, attention, activity, insights } = data;

  return (
    <div className="space-y-6">
      {/* ============================ HERO ============================ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-7 md:p-9 shadow-xl shadow-indigo-500/20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-fuchsia-300/20 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left: greeting */}
          <div className="lg:col-span-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{period.label} · Live</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {greeting(new Date())}, {firstName(identity?.name || "HR Admin")}.
            </h1>
            <p className="text-white/80 mt-2 text-sm md:text-base max-w-xl leading-relaxed">
              Here's your daily briefing for Nimbus Labs — the headline insight is
              ready below, plus the things that need your attention today.
            </p>

            <div className="mt-5">
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-700 hover:bg-white/90 transition-colors text-sm font-semibold shadow-sm"
              >
                <BarChart3 className="w-4 h-4" />
                Open analytics
              </Link>
            </div>
          </div>

          {/* Right: featured AI insight card (glassmorphism on the gradient) */}
          <div className="lg:col-span-2">
            {insights.length > 0 ? (
              <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-5 shadow-lg shadow-black/5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 mb-3">
                  <span className="inline-flex w-6 h-6 rounded-md items-center justify-center bg-white/20">
                    <Bot className="w-3.5 h-3.5" />
                  </span>
                  Today's headline
                </div>
                <p className="text-base font-semibold leading-snug mb-1.5">
                  {insights[0].title}
                </p>
                <p className="text-sm text-white/85 leading-relaxed">
                  {insights[0].body}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5">
                <p className="text-sm text-white/85">
                  No flags from the AI agent today — everything looks healthy.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* ============================ KPI TILES ============================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          label="Active headcount"
          value={tiles.active_headcount.toLocaleString()}
          caption={
            tiles.joined_this_month > 0
              ? `${tiles.joined_this_month} new hire${tiles.joined_this_month !== 1 ? "s" : ""} this month`
              : "No new hires this month"
          }
          Icon={Users}
          accent="indigo"
          trend={{
            delta: tiles.headcount_delta_vs_last_month,
            label: "vs last mo",
          }}
          trendData={headcountSparkline}
        />
        <KPITile
          label="Open positions"
          value={tiles.open_jobs}
          caption={`${tiles.pipeline_in_flight} candidates in pipeline`}
          Icon={Briefcase}
          accent="emerald"
        />
        <KPITile
          label="Active projects"
          value={tiles.active_projects}
          caption={`${tiles.planned_projects} more in planning`}
          Icon={FolderKanban}
          accent="violet"
        />
        <KPITile
          label="Monthly payroll"
          value={fmtMoney(tiles.monthly_payroll_target)}
          caption={
            tiles.pending_payroll_count > 0
              ? `${tiles.pending_payroll_count} payslip${tiles.pending_payroll_count !== 1 ? "s" : ""} pending`
              : "Fully released for this period"
          }
          Icon={DollarSign}
          accent="amber"
          trendData={payrollSparkline}
        />
      </div>

      {/* ============================ ROW: Headcount + Departments ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Headcount trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Trailing 12 months · active employees
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
              <BarChart3 className="w-3.5 h-3.5" />
              {data.headcount_trend.at(-1)?.headcount || 0} active
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={data.headcount_trend}
              margin={{ top: 12, right: 24, left: 12, bottom: 28 }}
            >
              <defs>
                <linearGradient id="hc-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#8b5cf6" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="hc-stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 6"
                stroke="#eef2f7"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                label={{
                  value: "Month",
                  position: "insideBottom",
                  offset: -16,
                  style: { fill: "#6b7280", fontSize: 12, fontWeight: 500 },
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={56}
                domain={["dataMin - 8", "dataMax + 8"]}
                label={{
                  value: "Active employees",
                  angle: -90,
                  position: "insideLeft",
                  offset: 8,
                  style: {
                    fill: "#6b7280",
                    fontSize: 12,
                    fontWeight: 500,
                    textAnchor: "middle",
                  },
                }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#c7d2fe", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="headcount"
                name="Headcount"
                stroke="url(#hc-stroke)"
                strokeWidth={3}
                fill="url(#hc-area)"
                dot={{ fill: "#6366f1", stroke: "white", strokeWidth: 2, r: 4.5 }}
                activeDot={{ r: 7, fill: "#6366f1", stroke: "white", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">Department mix</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active employees by team</p>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.department_headcount}
                  dataKey="headcount"
                  nameKey="department"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="white"
                  strokeWidth={2}
                >
                  {data.department_headcount.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-semibold text-gray-900">
                {data.department_headcount.reduce((s, d) => s + d.headcount, 0)}
              </p>
              <p className="text-xs text-gray-500">total</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {data.department_headcount.map((d, i) => (
              <div key={d.department} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                />
                <span className="text-gray-700 truncate">{d.department}</span>
                <span className="text-gray-400 ml-auto">{d.headcount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================ ROW: Hiring funnel + AI Insights ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Hiring funnel</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                In-flight candidates by stage
              </p>
            </div>
            <Link
              to="/hiring"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              Open Hiring
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {data.hiring_funnel.length === 0 ? (
            <div className="text-sm text-gray-500 py-12 text-center">
              No active candidates in the pipeline.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, data.hiring_funnel.length * 48 + 40)}>
              <BarChart
                data={data.hiring_funnel}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 28 }}
              >
                <defs>
                  <linearGradient id="bar-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Candidates",
                    position: "insideBottom",
                    offset: -16,
                    style: { fill: "#6b7280", fontSize: 12, fontWeight: 500 },
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fontSize: 12, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                  label={{
                    value: "Pipeline stage",
                    angle: -90,
                    position: "insideLeft",
                    offset: -2,
                    style: {
                      fill: "#6b7280",
                      fontSize: 12,
                      fontWeight: 500,
                      textAnchor: "middle",
                    },
                  }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                <Bar
                  dataKey="count"
                  fill="url(#bar-grad)"
                  radius={[0, 6, 6, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex w-7 h-7 rounded-lg items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Bot className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">AI insights</h2>
              <p className="text-xs text-gray-500 leading-tight">
                Heuristics from this morning's data
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {insights.length === 0 ? (
              <p className="text-sm text-gray-500">All clear — nothing flagged.</p>
            ) : (
              insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
            )}
          </div>
        </div>
      </div>

      {/* ============================ ROW: Activity + Attention ============================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Recent activity</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Hires, payroll releases, HR queries
              </p>
            </div>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">No recent activity.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((a, i) => (
                <ActivityRow key={i} item={a} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200/80 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Needs your attention</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Things that should clear by end of day
              </p>
            </div>
            {attention.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" />
                {attention.length}
              </span>
            )}
          </div>

          {attention.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-900">All caught up.</p>
              <p className="text-xs text-emerald-700 mt-1">
                No pending payslips, open tickets, or stale candidates.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 -mx-2">
              {attention.map((a, i) => (
                <AttentionRow key={i} item={a} />
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2.5">
              Quick actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/hiring"
                className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
              >
                <span className="text-sm font-medium inline-flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Start hiring
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/compensation"
                className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
              >
                <span className="text-sm font-medium inline-flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Release payroll
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/team-formation"
                className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
              >
                <span className="text-sm font-medium inline-flex items-center gap-2">
                  <FolderKanban className="w-4 h-4" />
                  Form a team
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/hr-queries"
                className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
              >
                <span className="text-sm font-medium inline-flex items-center gap-2">
                  <MessageCircleQuestion className="w-4 h-4" />
                  HR queries
                </span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* footer hint */}
      <div className="flex items-center justify-center text-xs text-gray-400 gap-1.5 pt-2">
        <Clock className="w-3 h-3" />
        Updated {fmtRelative(new Date().toISOString())} · Click Refresh for live data
      </div>
    </div>
  );
}
