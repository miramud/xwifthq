import type { Metadata } from "next";
import RecurringJournalEditor from "@/suite/finance/components/journals/recurring/RecurringJournalEditor";

export const metadata: Metadata = { title: "New recurring journal" };

export default function NewRecurringJournalPage() {
  return <RecurringJournalEditor />;
}
