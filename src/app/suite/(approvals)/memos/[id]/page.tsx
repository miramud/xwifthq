import type { Metadata } from "next";
import MemoEditor from "@/suite/approvals/components/MemoEditor";

export const metadata: Metadata = { title: "Memo" };

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoEditor id={id} />;
}
