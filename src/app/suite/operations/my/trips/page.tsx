import type { Metadata } from "next";
import MyTripsBoard from "@/suite/operations/components/my-trips/MyTripsBoard";

export const metadata: Metadata = { title: "My trips" };

/** Everybody's own trips: planned, travelling on, and finished. */
export default function MyTripsPage() {
  return <MyTripsBoard />;
}
