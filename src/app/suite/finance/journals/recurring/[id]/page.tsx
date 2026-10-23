import { Suspense } from "react";
import type { Metadata } from "next";
import RecurringJournalDetail from "@/suite/finance/components/journals/recurring/RecurringJournalDetail";

export const metadata: Metadata = { title: "Recurring journal" };

export default async function RecurringJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <RecurringJournalDetail id={id} />
    </Suspense>
  );
}
