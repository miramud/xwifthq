import { Suspense } from "react";
import type { Metadata } from "next";
import JournalDetailView from "@/suite/finance/components/journals/JournalDetailView";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <JournalDetailView id={id} />
    </Suspense>
  );
}
