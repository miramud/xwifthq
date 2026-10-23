import type { Metadata } from "next";
import MaintenanceReports from "@/suite/operations/components/maintenance/MaintenanceReports";

export const metadata: Metadata = { title: "Maintenance reports" };

/** Cost per asset against what it cost to buy, the replacement threshold, and downtime. */
export default function MaintenanceReportsPage() {
  return <MaintenanceReports />;
}
