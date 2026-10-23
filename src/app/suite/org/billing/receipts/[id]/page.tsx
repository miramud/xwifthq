import type { Metadata } from "next";
import { ReceiptView } from "@/suite/org/components/billing/ReceiptView";

export const metadata: Metadata = {
  title: "Receipt",
};

/** One payment as a printable receipt. See `ReceiptView`. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptView id={id} />;
}
