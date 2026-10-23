import type { Metadata } from "next";
import MemoEditor from "@/suite/approvals/components/MemoEditor";

export const metadata: Metadata = { title: "New memo" };

export default function NewMemoPage() {
  return <MemoEditor />;
}
