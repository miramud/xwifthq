import type { Metadata } from "next";
import RecurringJournalsBoard from "@/suite/finance/components/journals/recurring/RecurringJournalsBoard";

export const metadata: Metadata = { title: "Recurring journals" };

export default function RecurringJournalsPage() {
  return <RecurringJournalsBoard />;
}
