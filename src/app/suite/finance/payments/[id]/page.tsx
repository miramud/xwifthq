import { Suspense } from "react";
import type { Metadata } from "next";
import ScheduleDetail from "@/suite/finance/components/payments/ScheduleDetail";

export const metadata: Metadata = { title: "Payment schedule" };

export default async function FinancePaymentSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ScheduleDetail id={id} />
    </Suspense>
  );
}
