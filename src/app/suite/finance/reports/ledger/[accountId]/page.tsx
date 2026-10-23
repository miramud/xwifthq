import { Suspense } from "react";
import type { Metadata } from "next";
import AccountLedgerReport from "@/suite/finance/components/reports/AccountLedgerReport";

export const metadata: Metadata = { title: "Account ledger" };

export default async function AccountLedgerPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return (
    <Suspense>
      <AccountLedgerReport accountId={accountId} />
    </Suspense>
  );
}
