import type { Metadata } from "next";
import MyAssets from "@/suite/operations/components/my-assets/MyAssets";

export const metadata: Metadata = { title: "My assets" };

/** Everybody's own equipment, handovers to sign, and requests. */
export default function MyAssetsPage() {
  return <MyAssets />;
}
