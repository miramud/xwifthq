import type { Metadata } from "next";
import JobTitlesBoard from "@/suite/org/components/job-titles/JobTitlesBoard";

export const metadata: Metadata = { title: "Job titles" };

export default function JobTitlesPage() {
  return <JobTitlesBoard />;
}
