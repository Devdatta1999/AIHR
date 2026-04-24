import { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ArrowLeft, Briefcase, Loader2, MapPin, Sparkles, Users } from "lucide-react";
import {
  api,
  ApplicantCard as ApplicantCardT,
  COLUMN_STATUS,
  Job,
  statusToColumn,
} from "./api";
import { PipelineColumn } from "./PipelineColumn";
import { CandidateDetailModal } from "./CandidateDetailModal";
import { SendInvitationModal } from "./SendInvitationModal";
import { SendOfferLetterModal } from "./SendOfferLetterModal";

const COLUMNS = [
  { id: "rejected", title: "Rejected" },
  { id: "screening", title: "Screening" },
  { id: "interview", title: "Interview" },
  { id: "offer", title: "Offer" },
];

type Props = { job: Job; onBack: () => void };

export function Pipeline({ job, onBack }: Props) {
  const [applicants, setApplicants] = useState<ApplicantCardT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [shortlisting, setShortlisting] = useState(false);
  const [inviteKind, setInviteKind] = useState<"screening" | "technical" | null>(
    null,
  );
  const [offerOpen, setOfferOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await api.listApplicants(job.job_id);
      setApplicants(rows);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.job_id]);

  const grouped = useMemo(() => {
    const g: Record<string, ApplicantCardT[]> = {
      rejected: [],
      screening: [],
      interview: [],
      offer: [],
    };
    for (const a of applicants) {
      g[statusToColumn(a.status)].push(a);
    }
    return g;
  }, [applicants]);

  async function handleDrop(applicantId: number, toColumn: string) {
    const newStatus = COLUMN_STATUS[toColumn];
    const prev = applicants;
    setApplicants((arr) =>
      arr.map((a) =>
        a.applicant_id === applicantId ? { ...a, status: newStatus } : a,
      ),
    );
    try {
      await api.updateStatus(applicantId, newStatus);
    } catch (e) {
      setError(String(e));
      setApplicants(prev);
    }
  }

  async function runShortlist() {
    setShortlisting(true);
    try {
      await api.shortlist({
        job_id: job.job_id,
        min_experience: job.min_years_experience ?? undefined,
        country: job.preferred_country ?? undefined,
        limit: 50,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setShortlisting(false);
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Hiring Pipeline
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                  <Briefcase className="w-3.5 h-3.5" />
                  {job.job_title}
                </span>
                {job.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </span>
                )}
                {job.job_level && <span>{job.job_level}</span>}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md">
                  <Users className="w-3.5 h-3.5" />
                  Total applicants: {applicants.length}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={runShortlist}
            disabled={shortlisting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {shortlisting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {shortlisting ? "Running AI agent…" : "Run AI Shortlist"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading applicants…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <PipelineColumn
                key={col.id}
                columnId={col.id}
                title={col.title}
                applicants={grouped[col.id]}
                onDrop={handleDrop}
                onCardClick={(a) => setOpenId(a.applicant_id)}
                onSendInvite={
                  col.id === "screening"
                    ? () => setInviteKind("screening")
                    : col.id === "interview"
                      ? () => setInviteKind("technical")
                      : undefined
                }
                onGenerateOffer={
                  col.id === "offer" ? () => setOfferOpen(true) : undefined
                }
              />
            ))}
          </div>
        )}

        {openId != null && (
          <CandidateDetailModal
            applicantId={openId}
            onClose={() => setOpenId(null)}
          />
        )}

        {inviteKind && (
          <SendInvitationModal
            jobId={job.job_id}
            jobTitle={job.job_title}
            kind={inviteKind}
            candidates={
              grouped[inviteKind === "screening" ? "screening" : "interview"]
            }
            onClose={() => setInviteKind(null)}
          />
        )}

        {offerOpen && (
          <SendOfferLetterModal
            jobId={job.job_id}
            jobTitle={job.job_title}
            candidates={grouped["offer"]}
            onClose={() => setOfferOpen(false)}
            onSent={refresh}
          />
        )}
      </div>
    </DndProvider>
  );
}
