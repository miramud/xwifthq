import type { Metadata } from "next";
import RoomBookings from "@/suite/operations/components/facilities/RoomBookings";

export const metadata: Metadata = { title: "Room bookings" };

/** The week's room bookings across every site. */
export default function Page() {
  return <RoomBookings />;
}
