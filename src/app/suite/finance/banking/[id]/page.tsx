import type { Metadata } from "next";
import BankAccountDetail from "@/suite/finance/components/banking/BankAccountDetail";

export const metadata: Metadata = { title: "Bank account" };

export default async function FinanceBankAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BankAccountDetail id={id} />;
}
