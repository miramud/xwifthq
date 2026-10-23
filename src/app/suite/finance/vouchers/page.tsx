import { Suspense } from "react";
import type { Metadata } from "next";
import VouchersBoard from "@/suite/finance/components/vouchers/VouchersBoard";

export const metadata: Metadata = { title: "Payment vouchers" };

export default function FinanceVouchersPage() {
  return (
    <Suspense>
      <VouchersBoard />
    </Suspense>
  );
}
