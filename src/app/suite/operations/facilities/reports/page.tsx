import type { Metadata } from "next";
import FacilityReports from "@/suite/operations/components/facilities/FacilityReports";

export const metadata: Metadata = { title: "Utilities and diesel" };

/** Twelve months of utilities and diesel, cost per head, and generator efficiency. */
export default function Page() {
  return <FacilityReports />;
}
