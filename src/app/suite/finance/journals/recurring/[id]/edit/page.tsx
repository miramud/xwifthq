import type { Metadata } from "next";
import RecurringJournalEditor from "@/suite/finance/components/journals/recurring/RecurringJournalEditor";

export const metadata: Metadata = { title: "Edit recurring journal" };

export default async function EditRecurringJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecurringJournalEditor templateId={id} />;
}
