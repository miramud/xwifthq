import type { Metadata } from "next";
import EventsDesk from "@/suite/operations/components/events/EventsDesk";

export const metadata: Metadata = { title: "Events" };

/** Every event past draft, as a calendar and a list. */
export default function EventsPage() {
  return <EventsDesk />;
}
