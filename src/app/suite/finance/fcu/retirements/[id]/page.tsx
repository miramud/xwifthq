import type { Metadata } from "next";
import { FcuRetirementReview } from "@/suite/finance/components/fcu/FcuReviews";

export const metadata: Metadata = { title: "Vet a retirement" };

/** Loads by the retirement's id, so the link works after it leaves the queue. */
export default async function FcuRetirementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FcuRetirementReview id={id} />;
}
