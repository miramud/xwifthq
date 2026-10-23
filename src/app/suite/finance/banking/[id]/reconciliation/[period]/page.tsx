import type { Metadata } from "next";
import ReconciliationBoard from "@/suite/finance/components/reconciliation/ReconciliationBoard";

export const metadata: Metadata = { title: "Bank reconciliation" };

export default async function FinanceReconciliationPage({ params }: { params: Promise<{ id: string; period: string }> }) {
  const { id, period } = await params;
  return <ReconciliationBoard accountId={id} period={period} />;
}
