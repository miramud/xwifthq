import type { Metadata } from "next";
import ContractsBoard from "@/suite/finance/components/revenue/ContractsBoard";

export const metadata: Metadata = { title: "Contracts" };

export default function FinanceContractsPage() {
  return <ContractsBoard />;
}
