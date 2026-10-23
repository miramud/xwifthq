import type { Metadata } from "next";
import OperationsOverview from "@/suite/operations/components/overview/OperationsOverview";

export const metadata: Metadata = { title: "Overview" };

/** What is waiting where across procurement, travel, events and client payments. */
export default function OperationsOverviewPage() {
  return <OperationsOverview />;
}
