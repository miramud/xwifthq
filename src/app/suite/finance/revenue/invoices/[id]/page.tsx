import { Suspense } from "react";
import type { Metadata } from "next";
import InvoiceDetail from "@/suite/finance/components/revenue/InvoiceDetail";

export const metadata: Metadata = { title: "Invoice" };

/** An issued invoice, or a draft open for editing. */
export default async function FinanceInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <InvoiceDetail id={id} />
    </Suspense>
  );
}
