import { Suspense } from "react";
import type { Metadata } from "next";
import EventEditor from "@/suite/operations/components/my-events/EventEditor";

export const metadata: Metadata = { title: "New event" };

/** A new event, or a draft being finished (`?id=`). */
export default function NewEventPage() {
  return (
    <Suspense>
      <EventEditor />
    </Suspense>
  );
}
