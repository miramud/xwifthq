import type { Metadata } from "next";
import BudgetsBoard from "@/suite/finance/components/budgets/BudgetsBoard";

export const metadata: Metadata = { title: "Budgets" };

/** Each fiscal year's budget versions, the year-on-year picture and the budget controls. */
export default function BudgetsPage() {
  return <BudgetsBoard />;
}
