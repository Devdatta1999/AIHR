import { useEffect, useState } from "react";
import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { employeeApi, OfferLetter } from "../../api/portal";

export function EmployeeOffer() {
  const [offer, setOffer] = useState<OfferLetter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  const load = () => {
    employeeApi
      .getOffer()
      .then((o) => {
        setOffer(o);
        if (o.response === "accepted" || o.response === "rejected") {
          setDone(o.response);
        }
      })
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (response: "accepted" | "rejected") => {
    if (!offer) return;
    setBusy(true);
    try {
      await employeeApi.respondOffer(offer.offer_id, response);
      setDone(response);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !offer) {
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="No offer letter yet"
          blurb="Once HR sends you the offer, it'll appear here for you to review."
        />
      </div>
    );
  }
  if (!offer) return <div className="text-sm text-gray-500">Loading…</div>;

  const alreadyResponded = offer.response === "accepted" || offer.response === "rejected";
  const finalState = done || (alreadyResponded ? offer.response : null);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Your Offer Letter</h1>
        <p className="text-sm text-gray-600 mt-1">
          Review the offer and let us know — accepting moves you into onboarding.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-800">
            {offer.subject}
          </span>
        </div>
        <iframe
          title="offer-letter"
          srcDoc={offer.html_body}
          sandbox=""
          className="w-full h-[540px] bg-white"
        />
      </div>

      {finalState === "accepted" && (
        <ResponseBanner kind="accepted" />
      )}
      {finalState === "rejected" && (
        <ResponseBanner kind="rejected" />
      )}

      {!finalState && (
        <div className="flex gap-3">
          <button
            onClick={() => respond("accepted")}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            Accept offer
          </button>
          <button
            onClick={() => respond("rejected")}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 py-3 rounded-xl font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            <XCircle className="w-5 h-5" />
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ResponseBanner({ kind }: { kind: "accepted" | "rejected" }) {
  if (kind === "accepted") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          Offer accepted
        </div>
        <p className="text-sm text-emerald-700 mt-1">
          Your status is now <b>Ready for Onboarding</b>. HR will start your
          onboarding tracker shortly — check the Onboarding tab.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
      <div className="flex items-center gap-2 text-red-800 font-semibold">
        <XCircle className="w-5 h-5" />
        Offer declined
      </div>
      <p className="text-sm text-red-700 mt-1">
        Thanks for letting us know. If this was a mistake, please reach out to HR.
      </p>
    </div>
  );
}

function EmptyState({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
      <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{blurb}</p>
    </div>
  );
}
