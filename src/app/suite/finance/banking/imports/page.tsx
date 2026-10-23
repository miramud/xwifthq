import type { Metadata } from "next";
import StatementsBoard from "@/suite/finance/components/statements/StatementsBoard";

export const metadata: Metadata = { title: "Bank statements" };

export default async function FinanceStatementsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; account?: string | string[] }> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <StatementsBoard initialStatus={one(sp.status)} initialAccount={one(sp.account)} />;
}
