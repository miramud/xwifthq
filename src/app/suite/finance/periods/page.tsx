import type { Metadata } from "next";
import PeriodsBoard from "@/suite/finance/components/periods/PeriodsBoard";

export const metadata: Metadata = { title: "Periods and close" };

export default function FinancePeriodsPage() {
  return <PeriodsBoard />;
}
