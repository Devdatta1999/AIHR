import { useEffect, useMemo, useState } from "react";
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  ChevronLeft,
  Eye,
} from "lucide-react";
import { api, ApplicantCard, OfferLetterPreview } from "./api";

type Props = {
  jobId: number;
  jobTitle: string;
  candidates: ApplicantCard[];
  onClose: () => void;
  onSent?: () => void;
};

const CURRENCIES = [
  { code: "USD", label: "USD ($)" },
  { code: "INR", label: "INR (₹)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "GBP", label: "GBP (£)" },
  { code: "CAD", label: "CAD (C$)" },
];

function defaultStartDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Step = "form" | "preview" | "done";

export function SendOfferLetterModal({
  jobId,
  jobTitle,
  candidates,
  onClose,
  onSent,
}: Props) {
  const [step, setStep] = useState<Step>("form");

  const [applicantId, setApplicantId] = useState<number | null>(
    candidates[0]?.applicant_id ?? null,
  );
  const [baseSalary, setBaseSalary] = useState<string>("120000");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [expiryDays, setExpiryDays] = useState(7);

  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OfferLetterPreview | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.applicant_id === applicantId) || null,
    [candidates, applicantId],
  );

  async function loadPreview() {
    if (!applicantId) return;
    const amount = parseFloat(baseSalary);
    if (!isFinite(amount) || amount <= 0) {
      setError("Please enter a valid base salary.");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const p = await api.previewOfferLetter({
        applicant_id: applicantId,
        job_id: jobId,
        base_salary: amount,
        currency,
        start_date: startDate,
        expiry_days: expiryDays,
      });
      setPreview(p);
      setStep("preview");
    } catch (e) {
      setError(String(e));
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    if (!preview || !applicantId) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.sendOfferLetter({
        applicant_id: applicantId,
        job_id: jobId,
        base_salary: parseFloat(baseSalary),
        currency,
        start_date: startDate,
        subject: preview.subject,
        html: preview.html,
      });
      if (res.status === "failed") {
        setError(res.error || "Send failed.");
      } else {
        setStep("done");
        onSent?.();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  // When changing the salary/date in the form, clear any stale preview.
  useEffect(() => {
    setPreview(null);
  }, [applicantId, baseSalary, currency, startDate, expiryDays]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {step === "done" ? "Offer sent" : "Generate offer letter"}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                {step === "form"
                  ? `Fill in the terms for ${jobTitle}`
                  : step === "preview"
                    ? `Preview — ${jobTitle}`
                    : `Sent to ${preview?.candidate_email}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {step === "form" && (
            <div className="p-6 space-y-5">
              {/* Candidate */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Candidate
                </label>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {candidates.length === 0 && (
                    <div className="p-4 text-sm text-gray-500 italic">
                      No candidates in the offer stage.
                    </div>
                  )}
                  {candidates.map((c) => (
                    <label
                      key={c.applicant_id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="offer-candidate"
                        checked={applicantId === c.applicant_id}
                        onChange={() => setApplicantId(c.applicant_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {c.email}
                        </div>
                      </div>
                      {c.overall_score != null && (
                        <span className="text-xs text-blue-600 font-medium">
                          {c.overall_score}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Salary + Currency */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Base salary (annual)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start date + expiry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Joining date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Accept within (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={expiryDays}
                    onChange={(e) =>
                      setExpiryDays(
                        Math.max(1, parseInt(e.target.value || "7", 10)),
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "preview" && preview && (
            <div className="p-6 space-y-4">
              {/* To + Subject */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 w-16">To</span>
                  <span className="text-gray-900 font-medium">
                    {preview.candidate_name}{" "}
                    <span className="text-gray-500 font-normal">
                      &lt;{preview.candidate_email}&gt;
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm w-16">Subject</span>
                  <input
                    type="text"
                    value={preview.subject}
                    onChange={(e) =>
                      setPreview({ ...preview, subject: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Preview of the email the candidate will receive.
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <iframe
                  title="Offer letter preview"
                  srcDoc={preview.html}
                  className="w-full h-[500px] bg-white"
                  sandbox=""
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "done" && preview && (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-lg font-semibold text-gray-900">
                Offer letter sent
              </div>
              <div className="text-sm text-gray-600">
                {preview.candidate_name} ({preview.candidate_email}) will
                receive the offer letter by email. Their status is now{" "}
                <b>Offered</b>.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex items-center justify-between gap-2 shrink-0">
          {step === "preview" ? (
            <button
              onClick={() => setStep("form")}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              {step === "done" ? "Done" : "Cancel"}
            </button>
            {step === "form" && (
              <button
                onClick={loadPreview}
                disabled={previewing || !applicantId || candidates.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
              >
                {previewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {previewing ? "Generating…" : "Preview offer letter"}
              </button>
            )}
            {step === "preview" && (
              <button
                onClick={send}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? "Sending…" : "Send offer letter"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
