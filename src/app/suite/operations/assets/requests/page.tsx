import type { Metadata } from "next";
import AssetRequestsDesk from "@/suite/operations/components/assets/AssetRequestsDesk";

export const metadata: Metadata = { title: "Asset requests" };

/** Requests to fulfil, and gate passes out and back. */
export default function AssetRequestsDeskPage() {
  return <AssetRequestsDesk />;
}
