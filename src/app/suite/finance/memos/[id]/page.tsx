import type { Metadata } from "next";
import MemoDetailView from "@/suite/finance/components/memos/MemoDetailView";

export const metadata: Metadata = { title: "Memo" };

/** The approval engine links payment memos here (`PaymentMemoProcess`); a requester without Finance access is sent to their own view. */
export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoDetailView id={id} />;
}
