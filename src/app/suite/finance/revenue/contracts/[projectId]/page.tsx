import type { Metadata } from "next";
import ContractEditor from "@/suite/finance/components/revenue/ContractEditor";

export const metadata: Metadata = { title: "Contract" };

/** A project's contract: set up when it has none, replaced in full when it has. */
export default async function FinanceContractPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ContractEditor projectId={projectId} />;
}
