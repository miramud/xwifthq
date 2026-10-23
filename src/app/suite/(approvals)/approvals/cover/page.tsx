import type { Metadata } from "next";
import MyCoverBoard from "@/suite/approvals/components/MyCoverBoard";

export const metadata: Metadata = { title: "My cover" };

export default function MyCoverPage() {
  return <MyCoverBoard />;
}
