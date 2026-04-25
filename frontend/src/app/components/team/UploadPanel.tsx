import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { teamFormationApi, SampleFile } from "../../api/teamFormation";

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
  const [samples, setSamples] = useState<SampleFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    teamFormationApi
      .listSamples()
      .then((r) => setSamples(r.samples))
      .catch(() => setSamples([]));
  }, []);

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

  async function downloadSample(file: SampleFile) {
    try {
      const blob = await teamFormationApi.downloadSample(file.file_name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Download failed");
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

      {samples.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-gray-900">
              Sample Project PDFs
            </h4>
            <span className="text-[11px] text-gray-500">
              for demo / testing
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {samples.map((s) => (
              <div
                key={s.file_name}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50/60"
              >
                <div className="text-sm font-medium text-gray-800 truncate">
                  {prettify(s.file_name)}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {(s.size_bytes / 1024).toFixed(0)} KB
                </div>
                <button
                  onClick={() => downloadSample(s)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-md hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            Download one, then drop it back into the panel above to test the
            full flow.
          </p>
        </div>
      )}
    </div>
  );
}

function prettify(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
