import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Run, teamFormationApi } from "../api/teamFormation";
import { UploadPanel } from "./team/UploadPanel";
import { RequirementsReview } from "./team/RequirementsReview";
import { RecommendationsView } from "./team/RecommendationsView";
import { SavedTeamsList } from "./team/SavedTeamsList";
import { TeamDetail } from "./team/TeamDetail";

type View =
  | { kind: "list" }
  | { kind: "upload" }
  | { kind: "review"; runId: number }
  | { kind: "recommend"; runId: number }
  | { kind: "team"; teamId: number };

export function TeamFormation() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (view.kind !== "review") {
      setRun(null);
      return;
    }
    let cancelled = false;
    setLoadingRun(true);
    teamFormationApi
      .getRun(view.runId)
      .then((r) => !cancelled && setRun(r))
      .finally(() => !cancelled && setLoadingRun(false));
    return () => {
      cancelled = true;
    };
  }, [view]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team Formation</h1>
        <p className="text-sm text-gray-600 mt-1">
          Upload a project requirements PDF and let the agent assemble the
          right team from your bench.
        </p>
      </div>

      {view.kind === "list" && (
        <SavedTeamsList
          refreshKey={refreshKey}
          onCreate={() => setView({ kind: "upload" })}
          onOpen={(teamId) => setView({ kind: "team", teamId })}
        />
      )}

      {view.kind === "upload" && (
        <div className="space-y-4">
          <button
            onClick={() => setView({ kind: "list" })}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ← Back to teams
          </button>
          <UploadPanel
            busy={busy}
            setBusy={setBusy}
            onParsed={(runId) => setView({ kind: "review", runId })}
          />
        </div>
      )}

      {view.kind === "review" && (
        <>
          {loadingRun || !run ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading parsed requirements…
            </div>
          ) : (
            <RequirementsReview
              run={run}
              onBack={() => setView({ kind: "upload" })}
              onRecommended={(runId) =>
                setView({ kind: "recommend", runId })
              }
            />
          )}
        </>
      )}

      {view.kind === "recommend" && (
        <RecommendationsView
          runId={view.runId}
          onBack={() => setView({ kind: "review", runId: view.runId })}
          onSaved={(teamId) => {
            setRefreshKey((k) => k + 1);
            setView({ kind: "team", teamId });
          }}
        />
      )}

      {view.kind === "team" && (
        <TeamDetail
          teamId={view.teamId}
          onBack={() => setView({ kind: "list" })}
        />
      )}
    </div>
  );
}
