import type { Metadata } from "next";
import JournalEditor from "@/suite/finance/components/journals/JournalEditor";

export const metadata: Metadata = { title: "Edit journal" };

export default async function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalEditor journalId={id} />;
}
