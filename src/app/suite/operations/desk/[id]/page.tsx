import type { Metadata } from "next";
import TicketDetail from "@/suite/operations/components/desk/TicketDetail";

export const metadata: Metadata = { title: "Ticket" };

/** A ticket: the conversation, assignment, status and the record it became. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetail id={id} />;
}
