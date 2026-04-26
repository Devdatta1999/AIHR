import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Download,
  FileText,
  Layers,
  Loader2,
  Rocket,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  BulkReleaseResult,
  CompensationEmployee,
  CompensationSummary,
  Payslip,
  compensationApi,
} from "../api/compensation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtMoney(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v == null) return "—";
  if (opts.compact) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  }
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function todayYearMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function CompensationManagement() {
  const init = todayYearMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);

  const [summary, setSummary] = useState<CompensationSummary | null>(null);
  const [employees, setEmployees] = useState<CompensationEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "released" | "pending">("");

  const [releasing, setReleasing] = useState<number | null>(null);
  const [viewSlip, setViewSlip] = useState<Payslip | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Bulk release state
  const [bulkScope, setBulkScope] = useState<"all" | "department" | null>(null);
  const [bulkDept, setBulkDept] = useState<string>("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkReleaseResult | null>(null);

  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [s, e] = await Promise.all([
        compensationApi.summary(year, month),
        compensationApi.listEmployees(year, month, {
          q: q.trim() || undefined,
          department: department || undefined,
          status: statusFilter || undefined,
        }),
      ]);
      setSummary(s);
      setEmployees(e.employees);
    } catch (err: any) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // Debounced re-fetch on filter change.
  useEffect(() => {
    const t = setTimeout(() => refresh(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, department, statusFilter]);

  async function handleRelease(emp: CompensationEmployee) {
    setReleasing(emp.employee_id);
    setError(null);
    try {
      const slip = await compensationApi.release(emp.employee_id, year, month);
      setToast(`Released ${slip.pay_period_label} payslip for ${emp.first_name} ${emp.last_name}`);
      setTimeout(() => setToast(null), 3500);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Release failed");
    } finally {
      setReleasing(null);
    }
  }

  async function runBulkRelease() {
    if (!bulkScope) return;
    if (bulkScope === "department" && !bulkDept) return;
    setBulkRunning(true);
    setError(null);
    try {
      const r = await compensationApi.releaseBulk(
        year,
        month,
        bulkScope,
        bulkScope === "department" ? bulkDept : undefined,
      );
      setBulkResult(r);
      setBulkScope(null);
      const subj =
        r.scope === "department" ? `${r.department} dept` : "all employees";
      setToast(
        `Bulk release for ${subj}: ${r.released_count} released, ${r.skipped_count} skipped, ${r.failed_count} failed`,
      );
      setTimeout(() => setToast(null), 4500);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Bulk release failed");
    } finally {
      setBulkRunning(false);
    }
  }

  async function viewPayslip(run_id: number) {
    try {
      const p = await compensationApi.getRun(run_id);
      setViewSlip(p);
    } catch (err: any) {
      setError(err?.message || "Failed to load payslip");
    }
  }

  async function downloadPdf(run_id: number) {
    try {
      const blob = await compensationApi.downloadPdf(run_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${run_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Download failed");
    }
  }

  const departments = useMemo(() => {
    const set = new Set<string>();
    summary?.departments.forEach((d) => set.add(d.department));
    return Array.from(set).sort();
  }, [summary]);

  const tiles = summary?.tiles;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Compensation</h1>
          <p className="text-sm text-gray-600 mt-1">
            Release payroll, review the roster, and track YTD spend by department.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setBulkScope("all")}
            disabled={loading || bulkRunning}
            className="text-sm font-medium px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-60"
            title={`Release ${periodLabel} payroll for everyone pending`}
          >
            <Rocket className="w-4 h-4" />
            Release all
          </button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <Layers className="w-4 h-4 text-gray-400 ml-2" />
            <select
              value={bulkDept}
              onChange={(e) => setBulkDept(e.target.value)}
              className="px-2 py-2 text-sm bg-white focus:outline-none"
            >
              <option value="">Choose department…</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={() => setBulkScope("department")}
              disabled={!bulkDept || loading || bulkRunning}
              className="text-sm font-medium px-3 py-2 bg-white text-indigo-700 hover:bg-indigo-50 inline-flex items-center gap-1 disabled:opacity-50 border-l border-gray-200"
              title={
                bulkDept
                  ? `Release ${periodLabel} payroll for ${bulkDept}`
                  : "Pick a department first"
              }
            >
              <Send className="w-3.5 h-3.5" />
              Release dept.
            </button>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                const s = shiftMonth(year, month, -1);
                setYear(s.year); setMonth(s.month);
              }}
              className="p-2 hover:bg-gray-50 text-gray-600"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 text-sm font-semibold text-gray-900 min-w-[140px] text-center">
              {periodLabel}
            </div>
            <button
              onClick={() => {
                const s = shiftMonth(year, month, +1);
                setYear(s.year); setMonth(s.month);
              }}
              className="p-2 hover:bg-gray-50 text-gray-600"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {toast && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          label="Active headcount"
          value={tiles ? tiles.active_headcount.toLocaleString() : "—"}
          sub="Eligible for payroll"
          icon={Users}
          gradient="from-indigo-500 to-blue-600"
        />
        <Tile
          label="Monthly payroll target"
          value={tiles ? fmtMoney(tiles.monthly_payroll_target, { compact: true }) : "—"}
          sub="Annual base ÷ 12"
          icon={DollarSign}
          gradient="from-emerald-500 to-teal-600"
        />
        <Tile
          label="Released this period"
          value={tiles ? `${tiles.released_this_period} / ${tiles.active_headcount}` : "—"}
          sub={tiles ? `${tiles.pending_this_period} pending` : ""}
          icon={CheckCircle2}
          gradient="from-amber-500 to-orange-600"
        />
        <Tile
          label="Avg. base salary"
          value={tiles ? fmtMoney(tiles.avg_base_salary, { compact: true }) : "—"}
          sub="Across active roster"
          icon={Briefcase}
          gradient="from-purple-500 to-pink-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Payroll trend (last 6 periods)</h3>
            <span className="text-xs text-gray-500">Released gross vs net</span>
          </div>
          {summary && summary.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => fmtMoney(v)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={2} name="Gross" />
                <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} name="Net" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No releases yet — release a payslip below to populate the trend.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">By department</h3>
            <span className="text-xs text-gray-500">Monthly run-rate</span>
          </div>
          {summary && summary.departments.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={summary.departments.slice(0, 7)}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="department"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={110}
                />
                <Tooltip
                  formatter={(v: number) => fmtMoney(v)}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="monthly_payroll" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No data
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, title or email…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="released">Released</option>
        </select>
        {loading && (
          <div className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </div>
        )}
        <div className="ml-auto text-xs text-gray-500">
          {employees.length} employee{employees.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Roster table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-right">Annual base</th>
                <th className="px-4 py-3 text-right">Monthly gross</th>
                <th className="px-4 py-3 text-right">Net (this period)</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((e) => {
                const monthly = e.base_salary ? e.base_salary / 12 : null;
                return (
                  <tr key={e.employee_id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {e.first_name} {e.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {e.job_title}
                        {e.employee_level && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {e.employee_level}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{e.department_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtMoney(e.base_salary)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmtMoney(monthly)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmtMoney(e.net_pay)}
                    </td>
                    <td className="px-4 py-3">
                      {e.released ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Released
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.released && e.payroll_run_id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => viewPayslip(e.payroll_run_id!)}
                            className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            View
                          </button>
                          <button
                            onClick={() => downloadPdf(e.payroll_run_id!)}
                            className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={releasing === e.employee_id}
                          onClick={() => handleRelease(e)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          {releasing === e.employee_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Release payroll
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    No employees match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip modal */}
      {viewSlip && (
        <PayslipModal
          slip={viewSlip}
          onClose={() => setViewSlip(null)}
          onDownload={() => downloadPdf(viewSlip.payroll_run_id)}
        />
      )}

      {/* Bulk-release confirmation */}
      {bulkScope && (
        <BulkConfirmDialog
          scope={bulkScope}
          department={bulkDept}
          period={periodLabel}
          pendingCount={
            bulkScope === "department"
              ? employees.filter(
                  (e) => !e.released && e.department_name === bulkDept,
                ).length
              : employees.filter((e) => !e.released).length
          }
          running={bulkRunning}
          onCancel={() => setBulkScope(null)}
          onConfirm={runBulkRelease}
        />
      )}

      {/* Bulk-release result summary */}
      {bulkResult && (
        <BulkResultDialog
          result={bulkResult}
          onClose={() => setBulkResult(null)}
        />
      )}
    </div>
  );
}

function Tile({
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

function PayslipModal({
  slip, onClose, onDownload,
}: {
  slip: Payslip;
  onClose: () => void;
  onDownload: () => void;
}) {
  const emp = slip.employee;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Payslip — {slip.pay_period_label}
            </h3>
            <p className="text-xs text-gray-500">
              {emp ? `${emp.first_name} ${emp.last_name} · ${emp.job_title || ""}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <KV label="Pay date" value={slip.pay_date || "—"} />
            <KV label="Period" value={`${slip.period_start || "—"} → ${slip.period_end || "—"}`} />
            <KV label="Annual base" value={fmtMoney(slip.annual_base_salary)} />
            <KV label="Currency" value={slip.currency} />
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 mb-2">
              Earnings
            </div>
            {slip.earnings.map((e, i) => (
              <Row key={i} label={e.label} value={fmtMoney(e.amount)} />
            ))}
            <div className="border-t border-emerald-200 mt-2 pt-2">
              <Row label="Gross earnings" value={fmtMoney(slip.total_earnings)} bold />
            </div>
          </div>

          <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-800 mb-2">
              Deductions
            </div>
            {slip.deductions.map((d, i) => (
              <Row key={i} label={d.label} value={fmtMoney(d.amount)} />
            ))}
            <div className="border-t border-rose-200 mt-2 pt-2">
              <Row label="Total deductions" value={fmtMoney(slip.total_deductions)} bold />
            </div>
          </div>

          <div className="bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between">
            <span className="font-semibold">Net pay (this period)</span>
            <span className="text-xl font-semibold">{fmtMoney(slip.net_pay)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <YtdCard label="YTD gross" value={fmtMoney(slip.ytd_gross)} />
            <YtdCard label="YTD tax" value={fmtMoney(slip.ytd_tax)} />
            <YtdCard label="YTD net" value={fmtMoney(slip.ytd_net)} />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Released by {slip.released_by || "—"}
            {slip.released_at ? ` · ${new Date(slip.released_at).toLocaleString()}` : ""}
          </span>
          <button
            onClick={onDownload}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
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

function BulkConfirmDialog({
  scope, department, period, pendingCount, running, onCancel, onConfirm,
}: {
  scope: "all" | "department";
  department: string;
  period: string;
  pendingCount: number;
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const subject =
    scope === "department" ? `the ${department} department` : "every active employee";
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={running ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Release {period} payroll for {scope === "department" ? department : "all"}?
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              This generates a payslip for {subject} and makes it visible in their portal.
              Anyone already released this period will be skipped.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-2 text-sm">
          <div className="flex items-center justify-between text-gray-700">
            <span>Currently visible &amp; pending</span>
            <span className="font-semibold text-gray-900">{pendingCount}</span>
          </div>
          <div className="text-xs text-gray-500">
            (Backend will recompute the full eligible roster — this number is just a hint
            from the current table view.)
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 flex items-center justify-end gap-2">
          <button
            disabled={running}
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={running}
            onClick={onConfirm}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Releasing…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Confirm release
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkResultDialog({
  result, onClose,
}: {
  result: BulkReleaseResult;
  onClose: () => void;
}) {
  const subj =
    result.scope === "department" ? `${result.department}` : "all employees";
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Bulk release · {result.period.label}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Scope: {subj} · {result.attempted} considered
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <div className="text-xs text-emerald-800">Released</div>
            <div className="text-2xl font-semibold text-emerald-900">
              {result.released_count}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-xs text-amber-800">Skipped</div>
            <div className="text-2xl font-semibold text-amber-900">
              {result.skipped_count}
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
            <div className="text-xs text-rose-800">Failed</div>
            <div className="text-2xl font-semibold text-rose-900">
              {result.failed_count}
            </div>
          </div>
        </div>
        <div className="px-6 pb-4 overflow-y-auto text-sm space-y-3">
          {result.failed.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-1">
                Failed
              </div>
              <ul className="space-y-1">
                {result.failed.slice(0, 20).map((r) => (
                  <li
                    key={r.employee_id}
                    className="text-xs text-rose-900 bg-rose-50/60 border border-rose-200 rounded px-2 py-1"
                  >
                    {r.name} — {r.reason}
                  </li>
                ))}
                {result.failed.length > 20 && (
                  <li className="text-xs text-gray-500">
                    …and {result.failed.length - 20} more.
                  </li>
                )}
              </ul>
            </div>
          )}
          {result.skipped.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
                Skipped (already released)
              </div>
              <div className="text-xs text-gray-600">
                {result.skipped.slice(0, 6).map((r) => r.name).join(", ")}
                {result.skipped.length > 6 && ` …and ${result.skipped.length - 6} more`}
              </div>
            </div>
          )}
          {result.released.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                Released ({result.released.length})
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">
                {result.released.slice(0, 8).map((r) => r.name).join(", ")}
                {result.released.length > 8 && ` …and ${result.released.length - 8} more`}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function YtdCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
