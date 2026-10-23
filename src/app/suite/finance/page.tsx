import type { Metadata } from "next";
import OverviewBoard from "@/suite/finance/components/overview/OverviewBoard";

export const metadata: Metadata = { title: "Overview" };

export default function FinanceOverviewPage() {
  return <OverviewBoard />;
}
