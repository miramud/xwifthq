import { Suspense } from "react";
import type { Metadata } from "next";
import ReceiptForm from "@/suite/finance/components/revenue/ReceiptForm";

export const metadata: Metadata = { title: "Record a receipt" };

/** `?client=&invoice=` starts with that client and that invoice paid in full less WHT. */
export default function NewReceiptPage() {
  return (
    <Suspense>
      <ReceiptForm />
    </Suspense>
  );
}
