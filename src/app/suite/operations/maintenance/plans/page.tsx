import type { Metadata } from "next";
import PlansDesk from "@/suite/operations/components/maintenance/PlansDesk";

export const metadata: Metadata = { title: "Maintenance plans" };

/** Preventive plans: the next twelve weeks of servicing and the meters counting toward it. */
export default function MaintenancePlansPage() {
  return <PlansDesk />;
}
