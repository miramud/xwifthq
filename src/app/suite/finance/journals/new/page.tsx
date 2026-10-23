import type { Metadata } from "next";
import JournalEditor from "@/suite/finance/components/journals/JournalEditor";

export const metadata: Metadata = { title: "New journal" };

export default function NewJournalPage() {
  return <JournalEditor />;
}
