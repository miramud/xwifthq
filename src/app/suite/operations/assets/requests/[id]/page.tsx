import type { Metadata } from "next";
import AssetRequestDetail from "@/suite/operations/components/assets/AssetRequestDetail";

export const metadata: Metadata = { title: "Asset request" };

export default async function AssetRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssetRequestDetail id={id} />;
}
