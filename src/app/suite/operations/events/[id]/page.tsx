import type { Metadata } from "next";
import DeskEventDetail from "@/suite/operations/components/events/DeskEventDetail";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeskEventDetail id={id} />;
}
