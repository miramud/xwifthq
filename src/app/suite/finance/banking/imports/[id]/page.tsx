import type { Metadata } from "next";
import StatementImportDetail from "@/suite/finance/components/statements/StatementImportDetail";

export const metadata: Metadata = { title: "Bank statement" };

/** The approval engine links here (`StatementPostingProcess::link`). */
export default async function FinanceStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StatementImportDetail id={id} />;
}
