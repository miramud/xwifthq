import { Suspense } from "react";
import type { Metadata } from "next";
import InvoiceEditor from "@/suite/finance/components/revenue/InvoiceEditor";

export const metadata: Metadata = { title: "New invoice" };

/** `?client=` or `?contract=` starts the invoice for them. */
export default function NewInvoicePage() {
  return (
    <Suspense>
      <InvoiceEditor />
    </Suspense>
  );
}
