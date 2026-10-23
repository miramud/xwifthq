import type { Metadata } from "next";
import ReceiptsBoard from "@/suite/finance/components/revenue/ReceiptsBoard";

export const metadata: Metadata = { title: "Receipts" };

export default function FinanceReceiptsPage() {
  return <ReceiptsBoard />;
}
