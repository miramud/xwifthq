import type { Metadata } from "next";
import LabourRunDetail from "@/suite/finance/components/labour/LabourRunDetail";

export const metadata: Metadata = { title: "Labour run" };

export default async function FinanceLabourRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LabourRunDetail id={id} />;
}
