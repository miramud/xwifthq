import type { Metadata } from "next";
import OccurrenceDetail from "@/suite/operations/components/compliance/OccurrenceDetail";

export const metadata: Metadata = { title: "Compliance item" };

export default async function ComplianceItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OccurrenceDetail id={id} />;
}
