import { useState } from "react";
import { Job } from "./hiring/api";
import { KitJobPicker } from "./interviewkit/KitJobPicker";
import { KitView } from "./interviewkit/KitView";

export function InterviewKit() {
  const [job, setJob] = useState<Job | null>(null);

  if (job) {
    return <KitView job={job} onBack={() => setJob(null)} />;
  }
  return <KitJobPicker onSelect={setJob} />;
}
