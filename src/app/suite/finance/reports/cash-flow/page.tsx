import { Suspense } from "react";
import type { Metadata } from "next";
import CashFlowReport from "@/suite/finance/components/reports/CashFlowReport";

export const metadata: Metadata = { title: "Cash flow" };

export default function CashFlowPage() {
  return (
    <Suspense>
      <CashFlowReport />
    </Suspense>
  );
}
