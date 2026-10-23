import { Suspense } from "react";
import type { Metadata } from "next";
import ReceiptDetail from "@/suite/finance/components/revenue/ReceiptDetail";

export const metadata: Metadata = { title: "Receipt" };

export default async function FinanceReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ReceiptDetail id={id} />
    </Suspense>
  );
}
