import { Suspense } from "react";
import type { Metadata } from "next";
import MyAssetRequestDetail from "@/suite/operations/components/my-assets/MyAssetRequestDetail";

export const metadata: Metadata = { title: "Asset request" };

export default async function MyAssetRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <MyAssetRequestDetail id={id} />
    </Suspense>
  );
}
