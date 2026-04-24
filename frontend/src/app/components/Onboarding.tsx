import { useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  Download,
  FileText,
  Globe,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  hrOnboarding,
  OnboardingDoc,
  ReadyApplicant,
  Tracker,
} from "../api/portal";

export function Onboarding() {
  const [ready, setReady] = useState<ReadyApplicant[]>([]);
  const [docs, setDocs] = useState<OnboardingDoc[]>([]);
  const [selected, setSelected] = useState<ReadyApplicant | null>(null);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [welcome, setWelcome] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    hrOnboarding.listReady().then(setReady).catch((e) => setError(String(e)));
    hrOnboarding.listDocuments().then(setDocs).catch(() => {});
  };
  useEffect(load, []);

  const openApplicant = async (a: ReadyApplicant) => {
    setSelected(a);
    setTracker(null);
    setWelcome(
      `Hi ${a.first_name}, we're thrilled to welcome you to Nimbus Labs` +
        `${a.job_title ? ` as our next ${a.job_title}` : ""}! ` +
        `The documents below are tailored for ${a.country || "your region"}. ` +
        "Please review them, fill in the profile questions, and accept to " +
        "officially join the team.",
    );
    try {
      const t = await hrOnboarding.getTracker(a.applicant_id);
      setTracker(t);
      if (t.welcome_message) setWelcome(t.welcome_message);
    } catch {
      // no tracker yet — fine
    }
  };

  const startTracker = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const t = await hrOnboarding.startTracker({
        applicant_id: selected.applicant_id,
        welcome_message: welcome,
      });
      setTracker(t);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const resetOnboarding = async () => {
    if (!selected) return;
    if (
      !confirm(
        `Reset onboarding for ${selected.first_name} ${selected.last_name}?\n\n` +
          "This deletes their employee record + tracker and re-pends their offer letter " +
          "so they can re-accept it from the portal. Use this to re-run the demo end-to-end.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await hrOnboarding.resetOnboarding(selected.applicant_id);
      setTracker(null);
      setSelected(null);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-600 mt-1">
            Welcome new hires: manage documents, start trackers, watch them
            become employees.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg p-3">
          {error}
        </div>
      )}

      <DocumentLibrary docs={docs} onChange={load} />

      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            Ready for onboarding
          </h2>
          {ready.length === 0 && (
            <p className="text-xs text-gray-500">
              Nobody is ready yet — when candidates accept their offer, they
              show up here.
            </p>
          )}
          {ready.map((a) => (
            <button
              key={a.applicant_id}
              onClick={() => openApplicant(a)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected?.applicant_id === a.applicant_id
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {a.first_name} {a.last_name}
                </p>
                <StatusPill status={a.tracker_status || a.status} />
              </div>
              <p className="text-xs text-gray-500 truncate">{a.email}</p>
              <p className="text-xs text-gray-500">
                {a.job_title} · {a.country || "—"}
              </p>
            </button>
          ))}
        </div>

        <div>
          {!selected && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
              <User className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900">
                Pick a candidate to start onboarding
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Selecting someone loads their docs by country and a
                pre-filled welcome note.
              </p>
            </div>
          )}
          {selected && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selected.first_name} {selected.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selected.job_title} · {selected.department}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selected.email} · {selected.country || "—"}
                    </p>
                  </div>
                  <StatusPill status={tracker?.status || selected.status} />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Welcome message
                </h4>
                <textarea
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  className="w-full min-h-[100px] border border-gray-200 rounded-lg p-3 text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Documents auto-selected by country:{" "}
                  <b>
                    {
                      docs.filter(
                        (d) =>
                          !d.country ||
                          (selected.country &&
                            d.country?.toLowerCase() ===
                              selected.country.toLowerCase()),
                      ).length
                    }
                  </b>{" "}
                  match (global + {selected.country}).
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startTracker}
                  disabled={busy}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {tracker ? "Resend documents" : "Start onboarding tracker"}
                </button>
                <button
                  onClick={resetOnboarding}
                  disabled={busy}
                  title="Roll this person back to 'Offered' so the demo flow can be re-run."
                  className="flex items-center gap-2 bg-white border border-red-200 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-50 disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset onboarding
                </button>
              </div>

              {tracker && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Tracker state
                  </h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>
                      Status: <b>{tracker.status}</b>
                    </li>
                    <li>Documents sent: {tracker.document_ids?.length || 0}</li>
                    {tracker.accepted_at && (
                      <li>
                        Accepted:{" "}
                        {new Date(tracker.accepted_at).toLocaleString()}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "accepted" || status === "Active Employee"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Ready for Onboarding"
        ? "bg-blue-50 text-blue-700"
        : status === "Onboarding" || status === "documents_sent"
          ? "bg-amber-50 text-amber-700"
          : "bg-gray-100 text-gray-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>{status}</span>;
}

function DocumentLibrary({
  docs,
  onChange,
}: {
  docs: OnboardingDoc[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Select a file");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    if (country) fd.append("country", country);
    if (description) fd.append("description", description);
    try {
      await hrOnboarding.uploadDocument(fd);
      setOpen(false);
      setTitle("");
      setCountry("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Document library ({docs.length})
          </h2>
          <p className="text-xs text-gray-500">
            Upload once; auto-assigned to new hires by country.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Upload
        </button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          className="grid md:grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3"
        >
          <input
            placeholder="Title (e.g. Form W-4)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            placeholder="Country (empty = global)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            placeholder="Short description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="md:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            type="file"
            ref={fileRef}
            className="md:col-span-2 text-sm"
            required
          />
          {error && (
            <p className="md:col-span-2 text-xs text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="md:col-span-2 flex items-center justify-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload document
          </button>
        </form>
      )}

      {docs.length === 0 ? (
        <p className="text-xs text-gray-500">
          No documents yet — upload welcome packets, tax forms, country-specific
          paperwork.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-2">
          {docs.map((d) => (
            <div
              key={d.doc_id}
              className="border border-gray-200 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {d.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  <Globe className="inline w-3 h-3 mr-1" />
                  {d.country || "Global"} · {d.original_name}
                </p>
              </div>
              <a
                href={hrOnboarding.downloadUrl(d.doc_id)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-xs flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={async () => {
                  if (!confirm("Delete this document?")) return;
                  await hrOnboarding.deleteDocument(d.doc_id);
                  onChange();
                }}
                className="text-red-500 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
