import type { Metadata } from "next";
import { BackLink } from "@/suite/lms/components/ui/ws";
import { DecisionView } from "@/suite/approvals/components/DecisionView";

export const metadata: Metadata = { title: "Request" };

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <BackLink href="/suite/approvals" label="All approvals" />
      <DecisionView id={id} />
    </div>
  );
}
