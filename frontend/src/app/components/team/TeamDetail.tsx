import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { TeamDetail as TeamDetailType, teamFormationApi } from "../../api/teamFormation";

export function TeamDetail({
  teamId,
  onBack,
}: {
  teamId: number;
  onBack: () => void;
}) {
  const [team, setTeam] = useState<TeamDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    teamFormationApi
      .getTeam(teamId)
      .then((t) => !cancelled && setTeam(t))
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading team…
      </div>
    );
  }
  if (error || !team) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        {error || "Team not found"}
      </div>
    );
  }

  const grouped: Record<string, typeof team.members> = {};
  for (const m of team.members) {
    (grouped[m.role_designation] ||= []).push(m);
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={onBack}
          className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to teams
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {team.team_name}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {team.project_name}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Users className="w-3.5 h-3.5" />
            {team.members.length} members
          </span>
        </div>
        {team.project_summary && (
          <p className="mt-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
            {team.project_summary}
          </p>
        )}
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([role, members]) => (
          <div key={role}>
            <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2 mb-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              {role}
              <span className="text-[11px] text-gray-500 font-normal">
                · {members.length} member{members.length === 1 ? "" : "s"}
              </span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {members.map((m) => (
                <div
                  key={m.team_member_id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                          {m.first_name} {m.last_name}
                        </h4>
                        {m.employee_code && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {m.employee_code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {m.job_title}
                        {m.employee_level && ` · ${m.employee_level}`}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 inline-flex items-center gap-1 flex-wrap">
                        {m.location && (
                          <>
                            <MapPin className="w-3 h-3" />
                            {m.location}
                            {m.work_mode && ` · ${m.work_mode}`}
                          </>
                        )}
                        {m.email && (
                          <>
                            <Mail className="w-3 h-3 ml-2" />
                            {m.email}
                          </>
                        )}
                      </p>
                    </div>
                    {m.fit_score != null && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-3 h-3" />
                        {m.fit_score}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <Stat
                      label="Allocation"
                      value={
                        m.allocation_percent != null
                          ? `${m.allocation_percent}%`
                          : "—"
                      }
                    />
                    <Stat
                      label="Bandwidth"
                      value={`${m.bandwidth_percent ?? 0}%`}
                    />
                    <Stat
                      label="Experience"
                      value={`${m.total_experience_years ?? 0} yrs`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="text-xs font-semibold text-gray-800">{value}</div>
    </div>
  );
}
