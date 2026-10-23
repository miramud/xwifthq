import type { Metadata } from "next";
import ConsumptionReport from "@/suite/operations/components/stores/ConsumptionReport";

export const metadata: Metadata = { title: "Consumption" };

/** What the stores issued by month and item, and anything drawn faster than usual. */
export default function ConsumptionPage() {
  return <ConsumptionReport />;
}
