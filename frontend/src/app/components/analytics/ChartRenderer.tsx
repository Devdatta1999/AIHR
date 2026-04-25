// Renders a backend-provided chart spec using Recharts. Handles bar / line /
// pie / kpi / kpi_grid / table / empty.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartSpec } from "../../api/analytics";

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
  "#a855f7", "#84cc16", "#f97316", "#14b8a6", "#ec4899",
];

function fmt(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1000) return v.toLocaleString();
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  return String(v);
}

export function ChartRenderer({ chart }: { chart: ChartSpec }) {
  if (!chart || chart.type === "empty" || !chart.data?.length) {
    return (
      <div className="text-xs text-gray-500 italic py-6 text-center">
        No data to chart.
      </div>
    );
  }

  if (chart.type === "kpi") {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
        <p className="text-xs text-indigo-700 uppercase tracking-wider font-semibold">
          {chart.label}
        </p>
        <p className="text-3xl font-semibold text-gray-900 mt-1">
          {fmt(chart.value)}
        </p>
      </div>
    );
  }

  if (chart.type === "kpi_grid") {
    const row = chart.data[0] || {};
    const entries = Object.entries(row);
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              {k.replaceAll("_", " ")}
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">
              {fmt(v)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (chart.type === "bar") {
    const x = chart.x_key!;
    const ys = chart.y_keys || [];
    return (
      <ResponsiveContainer width="100%" height={Math.max(220, chart.data.length * 28)}>
        <BarChart
          data={chart.data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey={x}
            tick={{ fontSize: 11 }}
            width={130}
          />
          <Tooltip />
          {ys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {ys.map((y, i) => (
            <Bar
              key={y}
              dataKey={y}
              fill={PALETTE[i % PALETTE.length]}
              radius={[0, 4, 4, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "line") {
    const x = chart.x_key!;
    const ys = chart.y_keys || [];
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={x} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {ys.map((y, i) => (
            <Line
              key={y}
              type="monotone"
              dataKey={y}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "pie") {
    const nameKey = chart.name_key!;
    const valueKey = chart.value_key!;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chart.data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={3}
            label={(entry) => entry[nameKey]}
          >
            {chart.data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // table fallback
  const cols = chart.columns || Object.keys(chart.data[0] || {});
  return (
    <div className="overflow-auto max-h-80 border border-gray-200 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.data.map((r, i) => (
            <tr key={i} className="even:bg-gray-50/50">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 text-gray-800 border-b border-gray-100">
                  {fmt(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
