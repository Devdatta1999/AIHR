import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Cpu,
  DollarSign,
} from "lucide-react";
import { DashboardBundle } from "../../api/analytics";

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#a855f7", "#ef4444"];

export function DashboardCharts({ bundle }: { bundle: DashboardBundle | null }) {
  if (!bundle) return null;

  return (
    <div className="space-y-6">
      {/* Hero — full-width area chart */}
      <Card
        title="Joining vs Exits — Last 12 Months"
        subtitle="Hiring momentum and attrition over a rolling year"
        Icon={CalendarDays}
      >
        {bundle.joining_vs_exit_trend.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart
              data={bundle.joining_vs_exit_trend}
              margin={{ top: 12, right: 24, bottom: 8, left: 0 }}
            >
              <defs>
                <linearGradient id="joinedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="exitedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="joined"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#joinedFill)"
              />
              <Area
                type="monotone"
                dataKey="exited"
                stroke="#ef4444"
                strokeWidth={2.5}
                fill="url(#exitedFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Two medium charts side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Headcount by Department"
          subtitle="Active employees grouped by team"
          Icon={Briefcase}
        >
          {bundle.headcount_by_department.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(320, bundle.headcount_by_department.length * 34)}
            >
              <BarChart
                data={bundle.headcount_by_department}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="department"
                  tick={{ fontSize: 12 }}
                  width={140}
                />
                <Tooltip />
                <Bar dataKey="headcount" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card
          title="Work Mode Distribution"
          subtitle="Onsite, hybrid and remote breakdown"
          Icon={ClipboardCheck}
        >
          {bundle.work_mode_mix.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={bundle.work_mode_mix}
                  dataKey="headcount"
                  nameKey="work_mode"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={3}
                  label={(e) => `${e.work_mode} (${e.headcount})`}
                >
                  {bundle.work_mode_mix.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Full-width salary chart */}
      <Card
        title="Average Base Salary by Department"
        subtitle="Compensation benchmarking across teams"
        Icon={DollarSign}
      >
        {bundle.salary_by_department.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={bundle.salary_by_department}
              margin={{ top: 12, right: 24, bottom: 8, left: 12 }}
            >
              <defs>
                <linearGradient id="salaryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="department" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) =>
                  typeof v === "number" ? `$${(v / 1000).toFixed(0)}k` : v
                }
              />
              <Tooltip
                formatter={(v: any) =>
                  typeof v === "number" ? `$${v.toLocaleString()}` : v
                }
              />
              <Bar dataKey="avg_salary" fill="url(#salaryFill)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Full-width top skills */}
      <Card
        title="Top 10 Skills Across the Workforce"
        subtitle="Most common skills held by active employees"
        Icon={Cpu}
      >
        {bundle.top_skills.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer
            width="100%"
            height={Math.max(340, bundle.top_skills.length * 36)}
          >
            <BarChart
              data={bundle.top_skills}
              layout="vertical"
              margin={{ top: 8, right: 24, bottom: 8, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="skill"
                tick={{ fontSize: 12 }}
                width={160}
              />
              <Tooltip />
              <Bar dataKey="employees" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  Icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-xs text-gray-500 italic py-16 text-center">
      No data for the current filters.
    </div>
  );
}
