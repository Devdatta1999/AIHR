import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  employeeApi,
  hrOnboarding,
  OnboardingDoc,
  Tracker,
} from "../../api/portal";

type Profile = {
  date_of_birth?: string;
  home_address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  tax_id?: string;
  bank_account?: string;
  tshirt_size?: string;
  phone?: string;
};

const PROFILE_FIELDS: { key: keyof Profile; label: string; type?: string }[] = [
  { key: "date_of_birth", label: "Date of birth", type: "date" },
  { key: "phone", label: "Phone number" },
  { key: "home_address", label: "Home address" },
  { key: "emergency_contact_name", label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact phone" },
  { key: "tax_id", label: "Tax ID / SSN / PAN" },
  { key: "bank_account", label: "Bank account (last 4)" },
  { key: "tshirt_size", label: "T-shirt size" },
];

export function EmployeeOnboarding() {
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [docs, setDocs] = useState<OnboardingDoc[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [saved, setSaved] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    employeeApi
      .getOnboarding()
      .then((data) => {
        setTracker(data.tracker);
        setDocs(data.documents || []);
        if (data.tracker?.status === "accepted") setAccepted(true);
      })
      .catch((e) => setError(String(e)));
    employeeApi.me().then((m) => {
      const a = m.applicant || {};
      setProfile({
        date_of_birth: a.date_of_birth || "",
        phone: a.phone || "",
        home_address: a.home_address || "",
        emergency_contact_name: a.emergency_contact_name || "",
        emergency_contact_phone: a.emergency_contact_phone || "",
        tshirt_size: a.tshirt_size || "",
      });
    });
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      await employeeApi.saveProfile(profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await employeeApi.acceptOnboarding();
      setAccepted(true);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!tracker) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <ClipboardCheck className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">
            Onboarding hasn't started yet
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            After you accept your offer, HR will start your onboarding tracker
            and the documents you need to review will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Welcome to Nimbus Labs 👋</h1>
        </div>
        <p className="text-white/90 whitespace-pre-line max-w-2xl">
          {tracker.welcome_message ||
            `We're so excited to have you join us${tracker.job_title ? ` as ${tracker.job_title}` : ""}. ` +
              "Please review the documents below, complete your profile, and accept to confirm your start."}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Documents to review
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">
            No documents attached yet — HR will add them shortly.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div
                key={d.doc_id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{d.title}</p>
                  {d.description && (
                    <p className="text-xs text-gray-500">{d.description}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate">
                    {d.original_name}
                    {d.country ? ` · ${d.country}` : " · Global"}
                  </p>
                </div>
                <a
                  href={hrOnboarding.downloadUrl(d.doc_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Complete your profile
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 grid md:grid-cols-2 gap-4">
          {PROFILE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {f.label}
              </label>
              <input
                type={f.type || "text"}
                value={(profile[f.key] as string) || ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, [f.key]: e.target.value }))
                }
                disabled={accepted}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
              />
            </div>
          ))}
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={busy || accepted}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-60"
            >
              Save profile
            </button>
            {saved && (
              <span className="text-xs text-emerald-700">Saved ✓</span>
            )}
          </div>
        </div>
      </section>

      <section>
        {accepted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              Onboarding accepted — you're now an official Nimbus Labs employee!
            </div>
            <p className="text-sm text-emerald-700 mt-1">
              Welcome aboard. Your new permissions are now active; the Interview
              Kits menu will show anything HR shares with you.
            </p>
          </div>
        ) : (
          <button
            onClick={accept}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            I've reviewed everything — accept and become an employee
          </button>
        )}
      </section>
    </div>
  );
}
