import { Suspense } from "react";
import type { Metadata } from "next";
import MyPurchaseRequestDetail from "@/suite/operations/components/my-requests/MyPurchaseRequestDetail";

export const metadata: Metadata = { title: "Purchase request" };

export default async function MyPurchaseRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <MyPurchaseRequestDetail id={id} />
    </Suspense>
  );
}
