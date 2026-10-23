"use client";

import type { Rag } from "@/lib/api/finance-payments-client";
import { Chip } from "@/components/workspace/kit";
import { RAG } from "./meta";

/** Red, Amber, Green or No budget: the word and an icon on its wash, never colour alone. */
export function RagChip({ status }: { status: Rag }) {
  const m = RAG[status] ?? RAG.grey;
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}
