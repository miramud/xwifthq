import type { Metadata } from "next";
import CashForecastBoard from "@/suite/finance/components/cash-forecast/CashForecastBoard";

export const metadata: Metadata = { title: "Cash forecast" };

/** Thirteen weeks of cash: what comes in, what goes out, and the lowest point. */
export default function CashForecastPage() {
  return <CashForecastBoard />;
}
