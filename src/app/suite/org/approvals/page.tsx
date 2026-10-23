import type { Metadata } from "next";
import ProcessesBoard from "@/suite/org/components/approvals/ProcessesBoard";

export const metadata: Metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  return <ProcessesBoard />;
}
