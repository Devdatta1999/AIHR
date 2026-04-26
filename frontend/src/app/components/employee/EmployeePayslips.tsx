import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PayslipSummary, PortalPayslip, employeeApi } from "../../api/portal";

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function EmployeePayslips() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PayslipSummary | null>(null);
  const [payslips, setPayslips] = useState<PortalPayslip[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await employeeApi.listPayslips();
      setSummary(r.summary);
      setPayslips(r.payslips);
      setOpen(r.payslips[0]?.payroll_run_id ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDownload(p: PortalPayslip) {
    setDownloading(p.payroll_run_id);
    try {
      const blob = await employeeApi.downloadPayslipPdf(p.payroll_run_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${p.pay_period_year}-${String(p.pay_period_month).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading payslips…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        {error}
      </div>
    );
  }

  // Build a simple last-6 net trend (or as many as we have).
  const trend = [...payslips]
    .slice(0, 6)
    .reverse()
    .map((p) => ({
      label: p.pay_period_label.replace(/(\w+) (\d{4})/, (_, m, y) => `${m.slice(0, 3)} ${y.slice(-2)}`),
      gross: p.monthly_gross || 0,
      net: p.net_pay || 0,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payslips</h1>
        <p className="text-sm text-gray-600 mt-1">
          Your pay history, year-to-date totals, and downloadable payslip PDFs.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="YTD gross"
          value={fmtMoney(summary?.ytd_gross)}
          icon={Wallet}
          gradient="from-emerald-500 to-teal-600"
        />
        <Stat
          label="YTD tax withheld"
          value={fmtMoney(summary?.ytd_tax)}
          icon={Scale}
          gradient="from-rose-500 to-orange-500"
        />
        <Stat
          label="YTD net"
          value={fmtMoney(summary?.ytd_net)}
          icon={TrendingUp}
          gradient="from-indigo-500 to-blue-600"
        />
        <Stat
          label="Last pay date"
          value={summary?.last_pay_date || "—"}
          sub={summary?.last_pay_period_label || undefined}
          icon={Receipt}
          gradient="from-purple-500 to-pink-600"
        />
      </div>

      {/* Trend chart */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              Recent pay (last {trend.length} {trend.length === 1 ? "period" : "periods"})
            </h3>
            <span className="text-xs text-gray-500">Gross vs net</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="gross" fill="#6366f1" radius={[4, 4, 0, 0]} name="Gross" />
              <Bar dataKey="net" fill="#10b981" radius={[4, 4, 0, 0]} name="Net" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payslip list */}
      {payslips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">No payslips yet</h3>
          <p className="text-sm text-gray-600 mt-1">
            Once HR releases payroll, your payslips will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => {
            const isOpen = open === p.payroll_run_id;
            return (
              <div
                key={p.payroll_run_id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : p.payroll_run_id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/60 text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">
                      {p.pay_period_label}
                    </div>
                    <div className="text-xs text-gray-500">
                      Paid on {p.pay_date || "—"} · Gross {fmtMoney(p.monthly_gross)}
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-gray-500">Net</div>
                    <div className="font-semibold text-gray-900">
                      {fmtMoney(p.net_pay)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(p);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 inline-flex items-center gap-1.5"
                  >
                    {downloading === p.payroll_run_id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    PDF
                  </button>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <Card title="Earnings" tone="emerald">
                        {p.earnings.map((e, i) => (
                          <Row key={i} label={e.label} value={fmtMoney(e.amount)} />
                        ))}
                        <Divider />
                        <Row label="Gross earnings" value={fmtMoney(p.total_earnings)} bold />
                      </Card>
                      <Card title="Deductions" tone="rose">
                        {p.deductions.map((d, i) => (
                          <Row key={i} label={d.label} value={fmtMoney(d.amount)} />
                        ))}
                        <Divider />
                        <Row label="Total deductions" value={fmtMoney(p.total_deductions)} bold />
                      </Card>
                    </div>

                    <div className="mt-4 bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between">
                      <span className="font-semibold">Net pay (this period)</span>
                      <span className="text-xl font-semibold">{fmtMoney(p.net_pay)}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <Mini label="YTD gross" value={fmtMoney(p.ytd_gross)} />
                      <Mini label="YTD tax" value={fmtMoney(p.ytd_tax)} />
                      <Mini label="YTD net" value={fmtMoney(p.ytd_net)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  gradient: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-600">{label}</p>
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Card({
  title, tone, children,
}: {
  title: string;
  tone: "emerald" | "rose";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
      : "bg-rose-50/60 border-rose-200 text-rose-800";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-700"}>{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-800"}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-200/70 my-2" />;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
