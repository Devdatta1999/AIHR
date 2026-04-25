import { DollarSign, LogOut, TrendingUp, Users } from "lucide-react";
import { DashboardKpis } from "../../api/analytics";

function fmtMoney(v: number): string {
  if (!v) return "$0";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function KpiCards({ kpis }: { kpis: DashboardKpis | null }) {
  const cards = [
    {
      label: "Active Headcount",
      value: kpis ? kpis.headcount.toLocaleString() : "—",
      icon: Users,
      color: "from-indigo-500 to-blue-600",
    },
    {
      label: "Avg. Base Salary",
      value: kpis ? fmtMoney(kpis.avg_base_salary) : "—",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "Annual Attrition",
      value: kpis ? `${kpis.annual_attrition_pct.toFixed(1)}%` : "—",
      icon: LogOut,
      color: "from-orange-500 to-amber-600",
    },
    {
      label: "Avg. Tenure",
      value: kpis ? `${kpis.avg_tenure_years.toFixed(1)} yrs` : "—",
      icon: TrendingUp,
      color: "from-purple-500 to-pink-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-gray-600">{c.label}</p>
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-gray-900">{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}
