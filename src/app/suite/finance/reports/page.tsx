import type { Metadata } from "next";
import ReportsHub from "@/suite/finance/components/reports/ReportsHub";

export const metadata: Metadata = { title: "Financial statements" };

export default function FinanceReportsPage() {
  return <ReportsHub />;
}
