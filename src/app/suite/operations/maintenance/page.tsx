import type { Metadata } from "next";
import WorkOrderBoard from "@/suite/operations/components/maintenance/WorkOrderBoard";

export const metadata: Metadata = { title: "Maintenance" };

/** Work orders from open to confirmed, with their SLAs and what maintenance costs. */
export default function MaintenancePage() {
  return <WorkOrderBoard />;
}
