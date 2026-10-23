import { Suspense } from "react";
import type { Metadata } from "next";
import IncomeStatementReport from "@/suite/finance/components/reports/IncomeStatementReport";

export const metadata: Metadata = { title: "Income statement" };

export default function IncomeStatementPage() {
  return (
    <Suspense>
      <IncomeStatementReport />
    </Suspense>
  );
}
