import type { Metadata } from "next";
import SourcingDetail from "@/suite/operations/components/procurement/SourcingDetail";

export const metadata: Metadata = { title: "Sourcing" };

export default async function SourcingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SourcingDetail id={id} />;
}
