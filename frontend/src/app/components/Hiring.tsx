import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Job } from "./hiring/api";
import { JobSelector } from "./hiring/JobSelector";
import { JobDetails } from "./hiring/JobDetails";
import { Pipeline } from "./hiring/Pipeline";

type View = "landing" | "select" | "details" | "pipeline";

export function Hiring() {
  const [view, setView] = useState<View>("landing");
  const [job, setJob] = useState<Job | null>(null);

  if (view === "select") {
    return (
      <JobSelector
        onSelect={(j) => {
          setJob(j);
          setView("details");
        }}
        onBack={() => setView("landing")}
      />
    );
  }

  if (view === "details" && job) {
    return (
      <JobDetails
        job={job}
        onStart={(j) => {
          setJob(j);
          setView("pipeline");
        }}
        onBack={() => setView("select")}
      />
    );
  }

  if (view === "pipeline" && job) {
    return <Pipeline job={job} onBack={() => setView("details")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Hiring Pipeline
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered candidate screening and interview management.
          </p>
        </div>
        <button
          onClick={() => setView("select")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Start Hiring
        </button>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-sm mb-4">
          <Sparkles className="w-7 h-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Ready to review candidates?
        </h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
          Click <b>Start Hiring</b> to pick an open job posting. The AI agent
          scores its applicants against the job description so you can
          shortlist, interview, and offer faster.
        </p>
        <button
          onClick={() => setView("select")}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Start Hiring
        </button>
      </div>
    </div>
  );
}
