import { useDrop } from "react-dnd";
import { useRef } from "react";
import { FileText, Send } from "lucide-react";
import { ApplicantCard as ApplicantCardT, COLUMN_STATUS } from "./api";
import { CARD_TYPE, CandidateCard } from "./CandidateCard";

type Props = {
  columnId: string;
  title: string;
  applicants: ApplicantCardT[];
  onDrop: (applicantId: number, toColumn: string) => void;
  onCardClick: (a: ApplicantCardT) => void;
  onSendInvite?: () => void;
  onGenerateOffer?: () => void;
};

export function PipelineColumn({
  columnId,
  title,
  applicants,
  onDrop,
  onCardClick,
  onSendInvite,
  onGenerateOffer,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: CARD_TYPE,
      drop: (item: { applicant_id: number; status: string }) => {
        onDrop(item.applicant_id, columnId);
      },
      canDrop: (item: { status: string }) =>
        COLUMN_STATUS[columnId] !== item.status,
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [columnId, onDrop],
  );
  drop(ref);

  return (
    <div
      ref={ref}
      className={`rounded-xl p-4 border transition-colors flex flex-col min-h-[400px] ${
        isOver && canDrop
          ? "bg-blue-50 border-blue-300"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="bg-white text-gray-700 text-xs font-medium px-2 py-1 rounded-full border border-gray-200">
          {applicants.length}
        </span>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {applicants.map((a) => (
          <CandidateCard
            key={a.applicant_id}
            applicant={a}
            onClick={onCardClick}
          />
        ))}
        {applicants.length === 0 && (
          <div className="text-xs text-gray-400 italic text-center py-6">
            {columnId === "rejected"
              ? "No candidates"
              : "Drop candidates here"}
          </div>
        )}
      </div>
      {onSendInvite && (
        <button
          onClick={onSendInvite}
          disabled={applicants.length === 0}
          className="mt-3 shrink-0 flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 disabled:hover:border-gray-200 text-sm font-medium transition-colors"
        >
          <Send className="w-4 h-4" />
          Send Invitation
        </button>
      )}
      {onGenerateOffer && (
        <button
          onClick={onGenerateOffer}
          disabled={applicants.length === 0}
          className="mt-3 shrink-0 flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-700 disabled:hover:border-gray-200 text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" />
          Generate Offer Letter
        </button>
      )}
    </div>
  );
}
