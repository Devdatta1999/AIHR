import { useEffect, useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import { TeamSummary, teamFormationApi } from "../../api/teamFormation";

export function SavedTeamsList({
  refreshKey,
  onCreate,
  onOpen,
}: {
  refreshKey: number;
  onCreate: () => void;
  onOpen: (teamId: number) => void;
}) {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    teamFormationApi
      .listTeams()
      .then((r) => !cancelled && setTeams(r.teams))
      .catch((e) => !cancelled && setError(e?.message || "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Saved teams</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Teams you've assembled from project requirements.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New team from PDF
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading teams…
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {!loading && teams.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            No teams yet
          </h3>
          <p className="text-sm text-gray-600 mt-1 max-w-sm mx-auto">
            Upload a project requirements PDF and let the agent assemble the
            right team.
          </p>
          <button
            onClick={onCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Start a new team
          </button>
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((t) => (
            <button
              key={t.team_id}
              onClick={() => onOpen(t.team_id)}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {t.team_name}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {t.member_count} members
                </span>
              </div>
              <p className="text-xs text-gray-600 truncate">
                {t.project_name}
              </p>
              {t.project_summary && (
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                  {t.project_summary}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-2">
                Created {new Date(t.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
