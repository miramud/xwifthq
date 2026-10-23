import type { Metadata } from "next";
import RulesBoard from "@/suite/finance/components/rules/RulesBoard";

export const metadata: Metadata = { title: "Statement rules" };

export default function FinanceBankRulesPage() {
  return <RulesBoard />;
}
