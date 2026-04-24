import { useEffect, useState } from "react";
import { CalendarDays, Clock, User, Video, Briefcase } from "lucide-react";
import { employeeApi, UpcomingInterview } from "../../api/portal";

export function EmployeeInterviews() {
  const [rows, setRows] = useState<UpcomingInterview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    employeeApi
      .listUpcomingInterviews()
      .then(setRows)
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
        {error}
      </div>
    );
  if (!rows) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Upcoming Interviews
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Candidates you've been assigned to interview. Meeting links join via
          Google Meet.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <CalendarDays className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">
            No upcoming interviews
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            When HR loops you in as an interviewer, the event shows up here
            with the Meet link.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <InterviewCard key={r.invite_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewCard({ row }: { row: UpcomingInterview }) {
  const d = new Date(row.scheduled_at);
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const kindLabel =
    row.kind === "screening" ? "Initial Screening" : "Technical Interview";
  const kindColor =
    row.kind === "screening"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : "bg-indigo-50 text-indigo-700 border-indigo-100";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div
            className={`inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${kindColor} mb-2`}
          >
            {kindLabel}
          </div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            {row.candidate_name || row.candidate_email}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{row.candidate_email}</p>

          <div className="flex items-center gap-4 mt-3 text-sm text-gray-700 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span>{row.job_title ?? "—"}</span>
              {row.department && (
                <span className="text-gray-400">· {row.department}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                {timeStr} · {row.duration_minutes} min
              </span>
            </div>
          </div>
        </div>

        {row.meet_link && (
          <a
            href={row.meet_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Video className="w-4 h-4" />
            Join Meet
          </a>
        )}
      </div>
    </div>
  );
}
