import type { Metadata } from "next";
import ClientsBoard from "@/suite/finance/components/revenue/ClientsBoard";

export const metadata: Metadata = { title: "Clients" };

export default function FinanceClientsPage() {
  return <ClientsBoard />;
}
