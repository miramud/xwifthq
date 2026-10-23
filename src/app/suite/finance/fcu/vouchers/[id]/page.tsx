import type { Metadata } from "next";
import { FcuVoucherReview } from "@/suite/finance/components/fcu/FcuReviews";

export const metadata: Metadata = { title: "Pre-audit a voucher" };

export default async function FcuVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FcuVoucherReview id={id} />;
}
