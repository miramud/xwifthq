import type { Metadata } from "next";
import NumberingBoard from "@/suite/org/components/foundations/NumberingBoard";

export const metadata: Metadata = { title: "Reference numbering" };

export default function OrgNumberingPage() {
  return <NumberingBoard />;
}
