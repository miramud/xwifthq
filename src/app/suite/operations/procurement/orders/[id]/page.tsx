import type { Metadata } from "next";
import OrderDetail from "@/suite/operations/components/procurement/OrderDetail";

export const metadata: Metadata = { title: "Purchase order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}
