import type { Metadata } from "next";
import ClientPaymentDetail from "@/suite/operations/components/clients/ClientPaymentDetail";

export const metadata: Metadata = { title: "Client payment request" };

export default async function ClientPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientPaymentDetail id={id} />;
}
