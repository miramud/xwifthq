import { Suspense } from "react";
import type { Metadata } from "next";
import JournalsBoard from "@/suite/finance/components/journals/JournalsBoard";

export const metadata: Metadata = { title: "Journals" };

export default function FinanceJournalsPage() {
  return (
    <Suspense>
      <JournalsBoard />
    </Suspense>
  );
}
