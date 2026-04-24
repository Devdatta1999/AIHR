import { useEffect, useState } from "react";
import { ClipboardList, Sparkles } from "lucide-react";
import { employeeApi } from "../../api/portal";

type Kit = {
  kit_id: number;
  job_id: number;
  job_title?: string;
  department?: string;
  assigned_at?: string;
  created_at?: string;
  model_id?: string;
  overall_notes?: string;
  behavioral: Record<string, any[]>;
  technical: any[];
};

export function EmployeeKits() {
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [active, setActive] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    employeeApi
      .listKits()
      .then((ks) => {
        setKits(ks);
        if (ks.length) setActive(ks[0]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
        {error}
      </div>
    );
  if (!kits) return <div className="text-sm text-gray-500">Loading…</div>;

  if (kits.length === 0) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <ClipboardList className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">
            No interview kits shared with you yet
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            HR can assign an AI-generated kit to you from the Interview Kit
            page. Once they do, it'll show up here for you to prep with.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Interview Kits</h1>
        <p className="text-sm text-gray-600 mt-1">
          Kits HR has assigned to you. Use the sidebar to switch between jobs.
        </p>
      </div>
      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-2">
          {kits.map((k) => (
            <button
              key={k.kit_id}
              onClick={() => setActive(k)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                active?.kit_id === k.kit_id
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-medium text-gray-900">
                {k.job_title || `Job #${k.job_id}`}
              </p>
              <p className="text-xs text-gray-500">{k.department ?? "—"}</p>
              {k.assigned_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Assigned {new Date(k.assigned_at).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>
        {active && <KitRender kit={active} />}
      </div>
    </div>
  );
}

function KitRender({ kit }: { kit: Kit }) {
  return (
    <div className="space-y-5">
      {kit.overall_notes && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-indigo-900">
              Calibration notes
            </h3>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {kit.overall_notes}
          </p>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-gray-900 mb-2">Behavioral</h3>
        {Object.entries(kit.behavioral || {}).map(([cat, qs]) => (
          <div
            key={cat}
            className="bg-white rounded-xl border border-gray-200 p-4 mb-3"
          >
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {cat.replace(/_/g, " ")}
            </p>
            <ul className="space-y-2">
              {(qs as any[]).map((q, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-gray-900">{q.question}</p>
                  {q.signal && (
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">Signal:</span> {q.signal}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-2">Technical</h3>
        <div className="space-y-2">
          {(kit.technical || []).map((q: any, i: number) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-sm font-medium text-gray-900">
                {i + 1}. {q.question}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                {q.skill && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded">
                    {q.skill}
                  </span>
                )}
                {q.difficulty && (
                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                    {q.difficulty}
                  </span>
                )}
              </div>
              {q.signal && (
                <p className="text-xs text-gray-600 mt-2">
                  <span className="font-semibold">Signal:</span> {q.signal}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
