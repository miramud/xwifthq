import { Suspense } from "react";
import type { Metadata } from "next";
import TripEditor from "@/suite/operations/components/my-trips/TripEditor";

export const metadata: Metadata = { title: "New trip" };

/** A new trip, or a draft being finished (`?id=`). */
export default function NewTripPage() {
  return (
    <Suspense>
      <TripEditor />
    </Suspense>
  );
}
