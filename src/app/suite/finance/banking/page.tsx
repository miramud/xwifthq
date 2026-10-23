import type { Metadata } from "next";
import BankAccountsBoard from "@/suite/finance/components/banking/BankAccountsBoard";

export const metadata: Metadata = { title: "Bank accounts" };

export default function FinanceBankingPage() {
  return <BankAccountsBoard />;
}
