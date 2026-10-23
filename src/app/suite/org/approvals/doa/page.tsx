import type { Metadata } from "next";
import DoaBoard from "@/suite/org/components/approvals/DoaBoard";

export const metadata: Metadata = { title: "Delegation of authority" };

export default function DoaPage() {
  return <DoaBoard />;
}
