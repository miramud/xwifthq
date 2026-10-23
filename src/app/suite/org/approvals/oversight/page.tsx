import type { Metadata } from "next";
import OversightBoard from "@/suite/org/components/approvals/OversightBoard";

export const metadata: Metadata = { title: "Approvals oversight" };

export default function OversightPage() {
  return <OversightBoard />;
}
