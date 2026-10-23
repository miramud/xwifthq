import type { Metadata } from "next";
import { FcuMemoReview } from "@/suite/finance/components/fcu/FcuReviews";

export const metadata: Metadata = { title: "Vet a memo" };

export default async function FcuMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FcuMemoReview id={id} />;
}
