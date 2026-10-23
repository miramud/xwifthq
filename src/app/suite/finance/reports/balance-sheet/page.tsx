import { Suspense } from "react";
import type { Metadata } from "next";
import BalanceSheetReport from "@/suite/finance/components/reports/BalanceSheetReport";

export const metadata: Metadata = { title: "Financial position" };

export default function BalanceSheetPage() {
  return (
    <Suspense>
      <BalanceSheetReport />
    </Suspense>
  );
}
