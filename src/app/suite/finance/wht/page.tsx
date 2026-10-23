import type { Metadata } from "next";
import WhtBoard from "@/suite/finance/components/wht/WhtBoard";

export const metadata: Metadata = { title: "Withholding tax" };

/** WHT deducted from suppliers: monthly remittance and supplier certificates. */
export default function WhtPage() {
  return <WhtBoard />;
}
