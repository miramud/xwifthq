import type { Metadata } from "next";
import { Suspense } from "react";
import BudgetDetail from "@/suite/finance/components/budgets/BudgetDetail";

export const metadata: Metadata = { title: "Budget" };

/** One budget version: against actual, and its lines. */
export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <BudgetDetail key={id} id={id} />
    </Suspense>
  );
}
