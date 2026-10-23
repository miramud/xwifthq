import type { Metadata } from "next";
import ExitClearanceDetail from "@/suite/operations/components/assets/ExitClearanceDetail";

export const metadata: Metadata = { title: "Exit clearance" };

export default async function ExitClearanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExitClearanceDetail id={id} />;
}
