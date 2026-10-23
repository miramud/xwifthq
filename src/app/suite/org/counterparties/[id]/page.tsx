import type { Metadata } from "next";
import CounterpartyDetail from "@/suite/org/components/foundations/CounterpartyDetail";

export const metadata: Metadata = { title: "Client or vendor" };

export default async function OrgCounterpartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CounterpartyDetail id={id} />;
}
