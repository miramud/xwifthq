import type { Metadata } from "next";
import MyBookings from "@/suite/operations/components/my-bookings/MyBookings";

export const metadata: Metadata = { title: "Book a room or vehicle" };

/** Book a meeting room or a pool vehicle; drivers log trips. */
export default function Page() {
  return <MyBookings />;
}
