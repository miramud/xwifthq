import type { Metadata } from "next";
import AccountsBoard from "@/suite/finance/components/accounts/AccountsBoard";

export const metadata: Metadata = { title: "Chart of accounts" };

export default function FinanceAccountsPage() {
  return <AccountsBoard />;
}
