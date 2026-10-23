import type { Metadata } from "next";
import LabourBoard from "@/suite/finance/components/labour/LabourBoard";

export const metadata: Metadata = { title: "Labour costing" };

export default function FinanceLabourPage() {
  return <LabourBoard />;
}
