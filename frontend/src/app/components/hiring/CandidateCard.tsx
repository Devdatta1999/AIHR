import { useDrag } from "react-dnd";
import { useRef } from "react";
import { Mail, Sparkles, Star } from "lucide-react";
import { ApplicantCard } from "./api";

export const CARD_TYPE = "applicant-card";

type Props = {
  applicant: ApplicantCard;
  onClick: (a: ApplicantCard) => void;
};

export function CandidateCard({ applicant, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CARD_TYPE,
      item: { applicant_id: applicant.applicant_id, status: applicant.status },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [applicant.applicant_id, applicant.status],
  );
  drag(ref);

  const score = applicant.overall_score;
  const scoreColor =
    score == null
      ? "text-gray-400"
      : score >= 85
        ? "text-green-600"
        : score >= 70
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <div
      ref={ref}
      onClick={() => onClick(applicant)}
      className={`bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all cursor-pointer select-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm mb-0.5 truncate">
            {applicant.first_name} {applicant.last_name}
          </h4>
          <p className="text-xs text-gray-600 truncate">
            {applicant.job_title ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Star className={`w-3.5 h-3.5 ${scoreColor} fill-current`} />
          <span className={`text-xs font-semibold ${scoreColor}`}>
            {score != null ? score : "—"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <Mail className="w-3 h-3 shrink-0" />
        <span className="truncate">{applicant.email}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {applicant.application_date ?? ""}
        </span>
        <div className="flex items-center gap-1">
          <Sparkles
            className={`w-3 h-3 ${
              applicant.evaluated ? "text-blue-600" : "text-gray-300"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              applicant.evaluated ? "text-blue-600" : "text-gray-400"
            }`}
          >
            {applicant.evaluated ? "AI Scored" : "Not scored"}
          </span>
        </div>
      </div>
    </div>
  );
}
