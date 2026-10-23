import { Suspense } from "react";
import type { Metadata } from "next";
import TrialBalanceReport from "@/suite/finance/components/reports/TrialBalanceReport";

export const metadata: Metadata = { title: "Trial balance" };

export default function TrialBalancePage() {
  return (
    <Suspense>
      <TrialBalanceReport />
    </Suspense>
  );
}
