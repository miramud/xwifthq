import type { Metadata } from "next";
import AssetDetail from "@/suite/operations/components/assets/AssetDetail";

export const metadata: Metadata = { title: "Asset" };

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetDetail id={id} />;
}
