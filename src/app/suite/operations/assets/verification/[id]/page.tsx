import type { Metadata } from "next";
import VerificationDetail from "@/suite/operations/components/assets/VerificationDetail";

export const metadata: Metadata = { title: "Verification" };

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VerificationDetail id={id} />;
}
