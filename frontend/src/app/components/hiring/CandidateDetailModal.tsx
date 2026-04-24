import { useEffect, useState } from "react";
import {
  X,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  FolderKanban,
  Trophy,
  Sparkles,
  Loader2,
} from "lucide-react";
import { api, ApplicantDetail, Evaluation } from "./api";

type Props = {
  applicantId: number;
  onClose: () => void;
};

const FACETS: {
  key: keyof Evaluation & string;
  reasonKey: keyof Evaluation & string;
  label: string;
}[] = [
  { key: "skills_score", reasonKey: "skills_reason", label: "Skills" },
  { key: "experience_score", reasonKey: "experience_reason", label: "Experience" },
  { key: "projects_score", reasonKey: "projects_reason", label: "Projects" },
  { key: "education_score", reasonKey: "education_reason", label: "Education" },
  {
    key: "certifications_score",
    reasonKey: "certifications_reason",
    label: "Certifications",
  },
  {
    key: "achievements_score",
    reasonKey: "achievements_reason",
    label: "Achievements",
  },
];

function scoreColor(s?: number | null) {
  if (s == null) return "text-gray-400";
  if (s >= 85) return "text-green-600";
  if (s >= 70) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(s?: number | null) {
  if (s == null) return "bg-gray-100";
  if (s >= 85) return "bg-green-500";
  if (s >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

export function CandidateDetailModal({ applicantId, onClose }: Props) {
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reEvaluating, setReEvaluating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getApplicant(applicantId)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  async function rerunEvaluation() {
    if (!detail?.applicant.job_id) return;
    setReEvaluating(true);
    try {
      await api.evaluateOne(applicantId, detail.applicant.job_id);
      const fresh = await api.getApplicant(applicantId);
      setDetail(fresh);
    } catch (e) {
      setError(String(e));
    } finally {
      setReEvaluating(false);
    }
  }

  const a = detail?.applicant;
  const ev = detail?.evaluation ?? null;
  const overall = ev?.overall_score ?? null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0">
            {a ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  {a.first_name} {a.last_name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {detail?.job?.job_title ?? "—"} · Applied{" "}
                  {a.application_date
                    ? new Date(a.application_date).toLocaleDateString()
                    : "—"}
                </p>
              </>
            ) : (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {error && (
          <div className="m-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        {detail && (
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {/* AI evaluation */}
            <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">
                    AI Evaluation
                  </h3>
                </div>
                <button
                  onClick={rerunEvaluation}
                  disabled={reEvaluating}
                  className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
                >
                  {reEvaluating && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {ev ? "Re-evaluate" : "Run evaluation"}
                </button>
              </div>

              {ev ? (
                <>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide">
                        Overall
                      </div>
                      <div
                        className={`text-4xl font-bold ${scoreColor(overall)}`}
                      >
                        {overall ?? "—"}
                      </div>
                    </div>
                    {ev.summary && (
                      <p className="text-sm text-gray-700 flex-1">
                        {ev.summary}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FACETS.map((f) => {
                      const s = ev[f.key] as number | null | undefined;
                      const r = ev[f.reasonKey] as string | null | undefined;
                      return (
                        <div
                          key={f.key}
                          className="bg-white rounded-lg p-3 border border-gray-100"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-900">
                              {f.label}
                            </span>
                            <span
                              className={`text-sm font-semibold ${scoreColor(s)}`}
                            >
                              {s ?? "—"}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full ${scoreBg(s)}`}
                              style={{ width: `${s ?? 0}%` }}
                            />
                          </div>
                          {r && (
                            <p className="text-xs text-gray-600">{r}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {ev.model_id && (
                    <p className="text-xs text-gray-500 mt-3">
                      Model: {ev.model_id}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  No AI evaluation yet for this candidate.
                </p>
              )}
            </section>

            {/* Contact */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {a?.email && (
                <Info icon={<Mail className="w-4 h-4" />} label="Email">
                  {a.email}
                </Info>
              )}
              {a?.phone && (
                <Info icon={<Phone className="w-4 h-4" />} label="Phone">
                  {a.phone}
                </Info>
              )}
              {(a?.city || a?.country) && (
                <Info icon={<MapPin className="w-4 h-4" />} label="Location">
                  {[a?.city, a?.state, a?.country].filter(Boolean).join(", ")}
                </Info>
              )}
              {a?.total_years_experience != null && (
                <Info
                  icon={<Briefcase className="w-4 h-4" />}
                  label="Experience"
                >
                  {a.total_years_experience} yrs
                </Info>
              )}
              {a?.linkedin_url && (
                <LinkInfo
                  icon={<Linkedin className="w-4 h-4" />}
                  label="LinkedIn"
                  href={a.linkedin_url}
                />
              )}
              {a?.github_url && (
                <LinkInfo
                  icon={<Github className="w-4 h-4" />}
                  label="GitHub"
                  href={a.github_url}
                />
              )}
              {a?.portfolio_url && (
                <LinkInfo
                  icon={<Globe className="w-4 h-4" />}
                  label="Portfolio"
                  href={a.portfolio_url}
                />
              )}
            </section>

            {/* Skills */}
            {detail.skills.length > 0 && (
              <Section title="Skills" icon={<Sparkles className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-2">
                  {detail.skills.map((s) => (
                    <span
                      key={s.applicant_skill_id}
                      className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                    >
                      {s.skill_name}
                      {s.proficiency_level && ` · ${s.proficiency_level}`}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Work experience */}
            {detail.work_experience.length > 0 && (
              <Section
                title="Work Experience"
                icon={<Briefcase className="w-4 h-4" />}
              >
                <div className="space-y-3">
                  {detail.work_experience.map((w) => (
                    <div
                      key={w.experience_id}
                      className="border-l-2 border-blue-200 pl-3"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {w.job_title}
                      </div>
                      <div className="text-xs text-gray-600">
                        {w.company_name}
                        {w.start_date && (
                          <>
                            {" "}· {w.start_date}
                            {" – "}
                            {w.is_current ? "Present" : w.end_date ?? ""}
                          </>
                        )}
                      </div>
                      {w.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {w.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Education */}
            {detail.education.length > 0 && (
              <Section
                title="Education"
                icon={<GraduationCap className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  {detail.education.map((e) => (
                    <div key={e.education_id}>
                      <div className="font-medium text-gray-900 text-sm">
                        {e.degree}
                        {e.field_of_study && ` in ${e.field_of_study}`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {e.institution_name}
                        {e.start_year && ` · ${e.start_year}–${e.end_year ?? ""}`}
                        {e.grade_gpa && ` · ${e.grade_gpa}`}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Projects */}
            {detail.projects.length > 0 && (
              <Section
                title="Projects"
                icon={<FolderKanban className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  {detail.projects.map((p) => (
                    <div key={p.project_id}>
                      <div className="font-medium text-gray-900 text-sm">
                        {p.project_title}
                        {p.project_type && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({p.project_type})
                          </span>
                        )}
                      </div>
                      {p.technologies_used && (
                        <div className="text-xs text-gray-600">
                          Tech: {p.technologies_used}
                        </div>
                      )}
                      {p.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {p.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Certifications */}
            {detail.certifications.length > 0 && (
              <Section title="Certifications" icon={<Award className="w-4 h-4" />}>
                <div className="space-y-1">
                  {detail.certifications.map((c) => (
                    <div key={c.certification_id} className="text-sm">
                      <span className="font-medium text-gray-900">
                        {c.certification_name}
                      </span>
                      {c.issuing_organization && (
                        <span className="text-gray-600">
                          {" "}· {c.issuing_organization}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Achievements */}
            {detail.achievements.length > 0 && (
              <Section title="Achievements" icon={<Trophy className="w-4 h-4" />}>
                <div className="space-y-1">
                  {detail.achievements.map((ach) => (
                    <div key={ach.achievement_id} className="text-sm">
                      <span className="font-medium text-gray-900">
                        {ach.title}
                      </span>
                      {ach.issuer_or_organization && (
                        <span className="text-gray-600">
                          {" "}· {ach.issuer_or_organization}
                        </span>
                      )}
                      {ach.description && (
                        <p className="text-xs text-gray-600">
                          {ach.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-gray-900">{children}</div>
      </div>
    </div>
  );
}

function LinkInfo({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-xs"
        >
          {href}
        </a>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-blue-600">{icon}</div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}
