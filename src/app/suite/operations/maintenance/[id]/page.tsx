import type { Metadata } from "next";
import WorkOrderDetail from "@/suite/operations/components/maintenance/WorkOrderDetail";

export const metadata: Metadata = { title: "Work order" };

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkOrderDetail id={id} />;
}
