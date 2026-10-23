import type { Metadata } from "next";
import MyEventsBoard from "@/suite/operations/components/my-events/MyEventsBoard";

export const metadata: Metadata = { title: "My events" };

/** Events this person leads or created. */
export default function MyEventsPage() {
  return <MyEventsBoard />;
}
