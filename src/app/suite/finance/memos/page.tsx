import type { Metadata } from "next";
import MemoRegister from "@/suite/finance/components/memos/MemoRegister";

export const metadata: Metadata = { title: "Memo register" };

export default function MemoRegisterPage() {
  return <MemoRegister />;
}
