import type { Metadata } from "next";
import MemosBoard from "@/suite/approvals/components/MemosBoard";

export const metadata: Metadata = { title: "My memos" };

export default function MemosPage() {
  return <MemosBoard />;
}
