import { Suspense } from "react";
import type { Metadata } from "next";
import VoucherDetail from "@/suite/finance/components/vouchers/VoucherDetail";

export const metadata: Metadata = { title: "Payment voucher" };

/** The approval engine links authorisers here. `?edit=1` opens a draft for changes. */
export default async function FinanceVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <VoucherDetail id={id} />
    </Suspense>
  );
}
