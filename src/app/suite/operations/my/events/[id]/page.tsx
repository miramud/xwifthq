import type { Metadata } from "next";
import MyEventDetail from "@/suite/operations/components/my-events/MyEventDetail";

export const metadata: Metadata = { title: "Event" };

export default async function MyEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyEventDetail id={id} />;
}
