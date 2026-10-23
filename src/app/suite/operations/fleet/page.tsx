import type { Metadata } from "next";
import FleetBoard from "@/suite/operations/components/fleet/FleetBoard";

export const metadata: Metadata = { title: "Fleet" };

/** Vehicles, their papers and fuel efficiency, and the pool bookings to decide. */
export default function FleetPage() {
  return <FleetBoard />;
}
