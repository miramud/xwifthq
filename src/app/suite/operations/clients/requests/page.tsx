import type { Metadata } from "next";
import ClientPaymentsBoard from "@/suite/operations/components/clients/ClientPaymentsBoard";

export const metadata: Metadata = { title: "Client payments" };

/** Payment requests put to clients, their stages and the chase. */
export default function ClientPaymentsPage() {
  return <ClientPaymentsBoard />;
}
