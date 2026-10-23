import type { Metadata } from "next";
import TravelDeskBoard from "@/suite/operations/components/travel/TravelDeskBoard";

export const metadata: Metadata = { title: "Travel desk" };

/** Every trip past draft: the calendar, bookings to make, changes to carry out, what changes cost. */
export default function TravelDeskPage() {
  return <TravelDeskBoard />;
}
