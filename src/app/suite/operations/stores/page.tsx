import type { Metadata } from "next";
import StockDesk from "@/suite/operations/components/stores/StockDesk";

export const metadata: Metadata = { title: "Stock" };

/** Consumables in the stores: stock on hand, value, reorder and the stores themselves. */
export default function StockPage() {
  return <StockDesk />;
}
