import { Suspense } from "react";
import type { Metadata } from "next";
import MyRequisitionDetail from "@/suite/operations/components/my-requisitions/MyRequisitionDetail";

export const metadata: Metadata = { title: "Requisition" };

export default async function MyRequisitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <MyRequisitionDetail id={id} />
    </Suspense>
  );
}
