import type { Metadata } from "next";
import FixedAssetsBoard from "@/suite/finance/components/fixed-assets/FixedAssetsBoard";

export const metadata: Metadata = { title: "Fixed assets" };

/** Asset classes, the books, the monthly depreciation run and its forecast. */
export default function FixedAssetsPage() {
  return <FixedAssetsBoard />;
}
