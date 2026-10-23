import type { Metadata } from "next";
import FacilitiesDesk from "@/suite/operations/components/facilities/FacilitiesDesk";

export const metadata: Metadata = { title: "Facilities" };

/** Sites, their spend, and the way into leases, contracts, visitors, rooms and reports. */
export default function Page() {
  return <FacilitiesDesk />;
}
