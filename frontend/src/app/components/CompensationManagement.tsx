import {
  DollarSign,
  TrendingUp,
  FileText,
  Mail,
  Sparkles,
  BarChart3,
  CheckCircle,
  Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const salaryOverview = [
  { label: "Total Payroll", value: "$8.4M", change: "+12%", trend: "up" },
  { label: "Avg. Salary", value: "$85K", change: "+4.2%", trend: "up" },
  { label: "Pending Reviews", value: "23", change: "5 urgent", trend: "neutral" },
  { label: "Budget Utilization", value: "87%", change: "Within limit", trend: "up" },
];

const recentPromotions = [
  {
    name: "Sarah Chen",
    from: "Senior Developer",
    to: "Lead Developer",
    salary: "$95K → $115K",
    status: "approved",
    date: "2026-03-15",
  },
  {
    name: "Michael Roberts",
    from: "Product Manager",
    to: "Senior PM",
    salary: "$90K → $105K",
    status: "pending",
    date: "2026-03-18",
  },
  {
    name: "Emily Zhang",
    from: "UX Designer",
    to: "Senior Designer",
    salary: "$80K → $95K",
    status: "approved",
    date: "2026-03-12",
  },
];

const benchmarkData = [
  { role: "Developer", company: 82, market: 85 },
  { role: "Designer", company: 78, market: 80 },
  { role: "PM", company: 92, market: 88 },
  { role: "Engineer", company: 88, market: 90 },
  { role: "Analyst", company: 75, market: 77 },
];

const automatedLetters = [
  {
    type: "Offer Letter",
    recipient: "John Doe - Senior Developer",
    status: "generated",
    action: "Review & Send",
  },
  {
    type: "Promotion Letter",
    recipient: "Sarah Chen - Lead Developer",
    status: "sent",
    action: "View",
  },
  {
    type: "Increment Letter",
    recipient: "Team (24 employees)",
    status: "draft",
    action: "Generate",
  },
];

export function CompensationManagement() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Compensation Management
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage salaries, promotions, and automated offer letter generation
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <FileText className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {/* Salary Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {salaryOverview.map((item, index) => {
          const colorClasses = {
            up: "text-green-600",
            down: "text-orange-600",
            neutral: "text-gray-600",
          };
          return (
            <div
              key={index}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <DollarSign className="w-8 h-8 text-green-600 bg-green-50 rounded-lg p-1.5" />
                <span className={`text-xs font-medium ${colorClasses[item.trend]}`}>
                  {item.change}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{item.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Promotion & Increment Workflow */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Promotion & Increment Workflow
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentPromotions.map((promo, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      {promo.status === "approved" ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <h3 className="font-medium text-gray-900">{promo.name}</h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {promo.from} → {promo.to}
                        </p>
                        <p className="text-sm font-medium text-green-600 mt-1">
                          {promo.salary}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${
                        promo.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {promo.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">{promo.date}</span>
                    {promo.status === "pending" && (
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Review Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Review Integration */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">
                Performance Review Integration
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-semibold text-green-700">42</p>
                <p className="text-xs text-gray-600 mt-1">Exceeds Expectations</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-2xl font-semibold text-blue-700">156</p>
                <p className="text-xs text-gray-600 mt-1">Meets Expectations</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-2xl font-semibold text-orange-700">12</p>
                <p className="text-xs text-gray-600 mt-1">Needs Improvement</p>
              </div>
            </div>
            <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Run Compensation Analysis
            </button>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* AI Letter Generation */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">
                AI Letter Generator
              </h2>
            </div>
            <div className="space-y-3">
              {automatedLetters.map((letter, index) => (
                <div
                  key={index}
                  className="p-3 bg-white rounded-lg border border-blue-200"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">
                        {letter.type}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">
                        {letter.recipient}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        letter.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : letter.status === "generated"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {letter.status}
                    </span>
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {letter.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Generate New Letter
            </button>
          </div>

          {/* Email Dispatch */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-900">
                Automated Email Dispatch
              </h2>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    Scheduled Emails
                  </span>
                  <span className="text-lg font-semibold text-purple-700">18</span>
                </div>
                <p className="text-xs text-gray-600">
                  Promotion and increment letters
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    Sent Today
                  </span>
                  <span className="text-lg font-semibold text-green-700">12</span>
                </div>
                <p className="text-xs text-gray-600">100% delivery rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compensation Benchmarking */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-700" />
          <h2 className="font-semibold text-gray-900">
            Compensation Benchmarking Insights
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={benchmarkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="role" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="company" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Company Avg ($K)" />
            <Bar dataKey="market" fill="#10b981" radius={[8, 8, 0, 0]} name="Market Avg ($K)" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                AI Insight: Competitive Positioning
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your Product Manager salaries are 4.5% above market average, while
                Designer compensation is slightly below market. Consider
                adjustments during next review cycle to maintain competitive edge.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
