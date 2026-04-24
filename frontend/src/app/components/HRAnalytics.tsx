import { TrendingUp, TrendingDown, Users, Target, Sparkles, Send } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";

const performanceData = [
  { month: "Jan", performance: 82, engagement: 75 },
  { month: "Feb", performance: 85, engagement: 78 },
  { month: "Mar", performance: 83, engagement: 80 },
  { month: "Apr", performance: 87, engagement: 82 },
  { month: "May", performance: 89, engagement: 85 },
  { month: "Jun", performance: 91, engagement: 87 },
];

const attritionData = [
  { department: "Engineering", risk: 23, count: 28 },
  { department: "Sales", risk: 15, count: 12 },
  { department: "Marketing", risk: 10, count: 8 },
  { department: "Product", risk: 8, count: 5 },
  { department: "HR", risk: 5, count: 3 },
];

const workforceTrend = [
  { name: "Full-time", value: 892, color: "#3b82f6" },
  { name: "Contract", value: 234, color: "#8b5cf6" },
  { name: "Part-time", value: 121, color: "#10b981" },
];

const engagementMetrics = [
  { label: "Overall Engagement", value: 87, change: "+5%", trend: "up" },
  { label: "Job Satisfaction", value: 82, change: "+3%", trend: "up" },
  { label: "Work-Life Balance", value: 79, change: "-2%", trend: "down" },
  { label: "Career Growth", value: 85, change: "+7%", trend: "up" },
];

export function HRAnalytics() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">HR Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">
          AI-powered insights into workforce performance and trends
        </p>
      </div>

      {/* AI Query Input */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Ask HR AI</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Use natural language to query your workforce data and get instant insights
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What's the attrition rate in Engineering?"
            className="flex-1 px-4 py-3 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Send className="w-4 h-4" />
            Ask
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setQuery("Show me high performers in Q2")}
            className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 transition-colors"
          >
            Show me high performers in Q2
          </button>
          <button
            onClick={() => setQuery("What's the gender diversity ratio?")}
            className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 transition-colors"
          >
            What's the gender diversity ratio?
          </button>
          <button
            onClick={() => setQuery("Predict next quarter attrition")}
            className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 transition-colors"
          >
            Predict next quarter attrition
          </button>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {engagementMetrics.map((metric, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm text-gray-600">{metric.label}</p>
              <span
                className={`text-xs font-medium ${
                  metric.trend === "up" ? "text-green-600" : "text-orange-600"
                }`}
              >
                {metric.change}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-3xl font-semibold text-gray-900">{metric.value}</p>
              <span className="text-sm text-gray-500 mb-1">/ 100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  metric.trend === "up" ? "bg-green-500" : "bg-orange-500"
                }`}
                style={{ width: `${metric.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance & Engagement Trends */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Performance & Engagement</h2>
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="performance"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                name="Performance Score"
              />
              <Line
                type="monotone"
                dataKey="engagement"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                name="Engagement Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Workforce Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Workforce Distribution</h2>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={workforceTrend}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {workforceTrend.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {workforceTrend.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attrition Prediction */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-orange-600" />
          <h2 className="font-semibold text-gray-900">
            AI Attrition Risk Prediction
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={attritionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="department" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="risk"
              fill="#f97316"
              radius={[8, 8, 0, 0]}
              name="Risk Score %"
            />
            <Bar
              dataKey="count"
              fill="#3b82f6"
              radius={[8, 8, 0, 0]}
              name="At-Risk Employees"
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start gap-3">
            <TrendingDown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                High Risk Alert: Engineering Department
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                AI analysis indicates 23% attrition risk in the Engineering team.
                Recommend: engagement initiatives, retention bonuses, and career
                development programs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
