import type { Metadata } from "next";
import PortfolioBoard from "@/suite/finance/components/projects/PortfolioBoard";

export const metadata: Metadata = { title: "Project funds" };

export default function FinanceProjectsPage() {
  return <PortfolioBoard />;
}
