import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { teamFormationApi } from "../../api/teamFormation";

export function UploadPanel({
  onParsed,
  busy,
  setBusy,
}: {
  onParsed: (runId: number) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await teamFormationApi.parsePdf(file);
      onParsed(res.run.run_id);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          drag
            ? "border-indigo-400 bg-indigo-50/60"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-white" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Upload Project Requirements PDF
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
          Drop a PDF describing the project, required roles, headcount, and
          must-have skills. The agent will extract the spec and you can review
          before generating recommendations.
        </p>
        <button
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm font-medium"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Choose PDF
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        {error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 inline-block">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
