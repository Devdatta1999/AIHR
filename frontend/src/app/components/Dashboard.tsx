import {
  Users,
  TrendingUp,
  TrendingDown,
  Briefcase,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const metrics = [
  {
    label: "Total Headcount",
    value: "1,247",
    change: "+12%",
    trend: "up",
    icon: Users,
    color: "blue",
  },
  {
    label: "Active Hiring",
    value: "34",
    change: "+5",
    trend: "up",
    icon: Briefcase,
    color: "green",
  },
  {
    label: "Attrition Rate",
    value: "8.4%",
    change: "-2.1%",
    trend: "down",
    icon: TrendingDown,
    color: "orange",
  },
  {
    label: "Avg. Salary",
    value: "$85K",
    change: "+4.2%",
    trend: "up",
    icon: DollarSign,
    color: "purple",
  },
];

const aiInsights = [
  {
    type: "alert",
    title: "High Attrition Risk Detected",
    description: "Engineering team shows 23% attrition risk in Q2. Consider engagement initiatives.",
    priority: "high",
  },
  {
    type: "success",
    title: "Recruitment Efficiency Up",
    description: "Time-to-hire decreased by 15% this quarter with AI screening.",
    priority: "medium",
  },
  {
    type: "info",
    title: "Team Formation Recommendation",
    description: "5 employees identified for Project Phoenix based on skills match.",
    priority: "medium",
  },
];

const recentTasks = [
  { title: "Review offer letter for John Doe", status: "pending", time: "2 hours ago" },
  { title: "Approve promotion workflow", status: "pending", time: "4 hours ago" },
  { title: "Onboarding checklist: Sarah Chen", status: "completed", time: "Yesterday" },
  { title: "Interview scheduling: 3 candidates", status: "completed", time: "Yesterday" },
];

const hiringPipelineData = [
  { name: "Applied", value: 145 },
  { name: "Screening", value: 67 },
  { name: "Interview", value: 23 },
  { name: "Offer", value: 8 },
];

const headcountTrendData = [
  { month: "Jan", count: 1150 },
  { month: "Feb", count: 1165 },
  { month: "Mar", count: 1180 },
  { month: "Apr", count: 1205 },
  { month: "May", count: 1230 },
  { month: "Jun", count: 1247 },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Welcome back! Here's what's happening with your workforce today.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const colorClasses = {
            blue: "bg-blue-50 text-blue-600",
            green: "bg-green-50 text-green-600",
            orange: "bg-orange-50 text-orange-600",
            purple: "bg-purple-50 text-purple-600",
          };
          return (
            <div
              key={index}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`${colorClasses[metric.color]} rounded-lg p-2.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-sm font-medium ${
                    metric.trend === "up" ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  {metric.change}
                </span>
              </div>
              <p className="text-base text-gray-600 mb-1">{metric.label}</p>
              <p className="text-3xl font-semibold text-gray-900">{metric.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Recent AI Insights</h2>
            </div>
            <div className="space-y-3">
              {aiInsights.map((insight, index) => {
                const priorityColors = {
                  high: "border-l-orange-500 bg-orange-50",
                  medium: "border-l-blue-500 bg-blue-50",
                };
                const iconMap = {
                  alert: AlertTriangle,
                  success: CheckCircle,
                  info: TrendingUp,
                };
                const Icon = iconMap[insight.type];
                return (
                  <div
                    key={index}
                    className={`border-l-4 ${priorityColors[insight.priority]} rounded-lg p-4`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900 mb-1">
                          {insight.title}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Hiring Pipeline</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hiringPipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Headcount Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={headcountTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group">
                <span className="text-sm font-medium text-blue-900">Start Hiring</span>
                <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group">
                <span className="text-sm font-medium text-green-900">Promote Employee</span>
                <ArrowRight className="w-4 h-4 text-green-600 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group">
                <span className="text-sm font-medium text-purple-900">Create Team</span>
                <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Tasks & Alerts */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Tasks & Alerts</h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                2 Pending
              </span>
            </div>
            <div className="space-y-3">
              {recentTasks.map((task, index) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  {task.status === "completed" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.status === "completed" ? "text-gray-500 line-through" : "text-gray-900 font-medium"}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{task.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
