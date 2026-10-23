import type { Metadata } from "next";
import CountSheet from "@/suite/operations/components/stores/CountSheet";

export const metadata: Metadata = { title: "Stock count" };

export default async function CountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CountSheet key={id} id={id} />;
}
