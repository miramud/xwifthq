import type { Metadata } from "next";
import FixedAssetDetail from "@/suite/finance/components/fixed-assets/FixedAssetDetail";

export const metadata: Metadata = { title: "Fixed asset" };

export default async function FixedAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FixedAssetDetail key={id} id={id} />;
}
