import type { Metadata } from "next";
import ClientStatement from "@/suite/finance/components/revenue/ClientStatement";

export const metadata: Metadata = { title: "Client statement" };

export default async function FinanceClientStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientStatement clientId={id} />;
}
