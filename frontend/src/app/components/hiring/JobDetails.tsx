import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  GraduationCap,
  Globe,
  Clock,
  CheckCircle2,
  Sparkles,
  Users,
  Calendar,
} from "lucide-react";
import { api, Job } from "./api";

type Props = {
  job: Job;
  onStart: (job: Job) => void;
  onBack: () => void;
};

export function JobDetails({ job: initialJob, onStart, onBack }: Props) {
  const [job, setJob] = useState<Record<string, any> | null>(initialJob);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getJob(initialJob.job_id)
      .then((full) => setJob(full as unknown as Record<string, any>))
      .catch((e) => setError(String(e)));
  }, [initialJob.job_id]);

  const splitList = (text: string | null | undefined) =>
    text
      ? text
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mt-1"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                {job?.job_title ?? "Job Details"}
              </h1>
              {job?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    job.status === "Open"
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {job.status}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {job?.department ?? "—"}
              {job?.job_level && <> · {job.job_level}</>}
            </p>
          </div>
        </div>
        <button
          onClick={() => onStart(initialJob)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Sparkles className="w-4 h-4" />
          Start Hiring
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!job ? (
        <div className="text-sm text-gray-500">Loading job details…</div>
      ) : (
        <>
          {/* Meta row */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Meta
                icon={<MapPin className="w-4 h-4" />}
                label="Location"
                value={job.location ?? "—"}
              />
              <Meta
                icon={<Briefcase className="w-4 h-4" />}
                label="Employment Type"
                value={job.employment_type ?? "—"}
              />
              <Meta
                icon={<Clock className="w-4 h-4" />}
                label="Min. Experience"
                value={
                  job.min_years_experience != null
                    ? `${job.min_years_experience} yrs`
                    : "—"
                }
              />
              <Meta
                icon={<Globe className="w-4 h-4" />}
                label="Preferred Country"
                value={job.preferred_country ?? "—"}
              />
              <Meta
                icon={<GraduationCap className="w-4 h-4" />}
                label="Education"
                value={job.education_requirement ?? "—"}
              />
              <Meta
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Work Authorization"
                value={
                  job.work_authorization_required
                    ? "Required"
                    : "Not required"
                }
              />
              <Meta
                icon={<Users className="w-4 h-4" />}
                label="Applicants"
                value={`${initialJob.applicant_count ?? 0}`}
              />
              <Meta
                icon={<Calendar className="w-4 h-4" />}
                label="Posted"
                value={
                  job.created_at
                    ? new Date(job.created_at).toLocaleDateString()
                    : "—"
                }
              />
            </div>
          </div>

          {/* Summary */}
          {job.job_summary && (
            <Section title="About the role">
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {job.job_summary}
              </p>
            </Section>
          )}

          {/* Responsibilities */}
          {job.responsibilities && (
            <Section title="Responsibilities">
              <Bullets text={job.responsibilities} />
            </Section>
          )}

          {/* Requirements */}
          {job.requirements && (
            <Section title="Requirements">
              <Bullets text={job.requirements} />
            </Section>
          )}

          {/* Skills */}
          {(job.must_have_skills || job.good_to_have_skills) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {job.must_have_skills && (
                <Section title="Must-have skills">
                  <div className="flex flex-wrap gap-2">
                    {splitList(job.must_have_skills).map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
              {job.good_to_have_skills && (
                <Section title="Good-to-have skills">
                  <div className="flex flex-wrap gap-2">
                    {splitList(job.good_to_have_skills).map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Bottom CTA */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onStart(initialJob)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Sparkles className="w-4 h-4" />
              Start Hiring
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ text }: { text: string }) {
  // Support either comma-separated, newline-separated, or prefix "-" bullets.
  const items = text
    .split(/\n|\r/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (items.length <= 1) {
    return (
      <p className="text-sm text-gray-700 whitespace-pre-line">{text}</p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <span className="text-blue-500 mt-0.5">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
