import { useEffect, useState } from "react";
import { ArrowLeft, Briefcase, MapPin, Users } from "lucide-react";
import { api, Job } from "./api";

type Props = {
  onSelect: (job: Job) => void;
  onBack: () => void;
};

export function JobSelector({ onSelect, onBack }: Props) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Start Hiring
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Select a job posting to open its hiring pipeline.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!jobs && !error && (
        <div className="text-sm text-gray-500">Loading job postings…</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs?.map((job) => (
          <button
            key={job.job_id}
            onClick={() => onSelect(job)}
            className="bg-white rounded-xl p-5 border border-gray-200 text-left hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {job.job_title}
                </h3>
                {job.department && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {job.department}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  job.status === "Open"
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {job.status ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
              {job.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.employment_type && (
                <div className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>{job.employment_type}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {job.applicant_count ?? 0} applicant
                  {job.applicant_count === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-xs text-blue-600 font-medium">
                Open pipeline →
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
