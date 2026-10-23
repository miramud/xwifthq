import { Suspense } from "react";
import type { Metadata } from "next";
import InvoicesBoard from "@/suite/finance/components/revenue/InvoicesBoard";

export const metadata: Metadata = { title: "Invoices" };

/** `?status=draft|open|overdue|paid|void` opens a tab. */
export default function FinanceInvoicesPage() {
  return (
    <Suspense>
      <InvoicesBoard />
    </Suspense>
  );
}
