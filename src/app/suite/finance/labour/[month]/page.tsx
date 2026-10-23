import type { Metadata } from "next";
import LabourMonth from "@/suite/finance/components/labour/LabourMonth";

export const metadata: Metadata = { title: "Labour costing" };

/** `month` is `YYYY-MM`; anything else gets a plain "that isn't a month". */
export default async function FinanceLabourMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  return <LabourMonth key={month} month={month} />;
}
