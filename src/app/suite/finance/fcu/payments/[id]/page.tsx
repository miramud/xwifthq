import type { Metadata } from "next";
import PaymentConfirm from "@/suite/finance/components/fcu/PaymentConfirm";

export const metadata: Metadata = { title: "Confirm a payment" };

/** `id` is the payment voucher's. */
export default async function FcuPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentConfirm id={id} />;
}
