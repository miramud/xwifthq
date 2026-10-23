import { Suspense } from "react";
import type { Metadata } from "next";
import PaymentsBoard from "@/suite/finance/components/payments/PaymentsBoard";

export const metadata: Metadata = { title: "Payments" };

export default function FinancePaymentsPage() {
  return (
    <Suspense>
      <PaymentsBoard />
    </Suspense>
  );
}
