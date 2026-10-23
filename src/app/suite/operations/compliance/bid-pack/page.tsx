import type { Metadata } from "next";
import BidPack from "@/suite/operations/components/compliance/BidPack";

export const metadata: Metadata = { title: "Bid-readiness pack" };

/** The certificates a tender asks for, in one download. */
export default function BidPackPage() {
  return <BidPack />;
}
