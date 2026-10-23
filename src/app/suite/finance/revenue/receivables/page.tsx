import { Suspense } from "react";
import type { Metadata } from "next";
import ReceivablesBoard from "@/suite/finance/components/revenue/ReceivablesBoard";

export const metadata: Metadata = { title: "Receivables" };

/** `?tab=wht` opens the WHT credit-note register. */
export default function FinanceReceivablesPage() {
  return (
    <Suspense>
      <ReceivablesBoard />
    </Suspense>
  );
}
