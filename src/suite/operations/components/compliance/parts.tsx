"use client";

import { Chip } from "@/components/workspace/kit";
import type { CertificateState } from "@/lib/api/operations-compliance-client";
import { CERT_STATE, stageMeta } from "./labels";

/* Chips every compliance screen shares: a stage, a certificate's standing. Words always, never colour alone. */

export function StageChip({ stage }: { stage: string }) {
  const m = stageMeta(stage);
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

export function CertStateChip({ state }: { state: CertificateState }) {
  const m = CERT_STATE[state];
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

/** Bytes in words: 2.4 MB. */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
