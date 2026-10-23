"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { amount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { BANKS, importStatus, isProcessing } from "./labels";
import type { BankCode } from "@/lib/api/finance-banking-client";

/* Small pieces every banking screen uses. */

const BANK_HUE: Record<BankCode, Hue> = {
  uba: "coral",
  zenith: "rose",
  gtbank: "sun",
  access: "sky",
  firstbank: "blue",
  taj: "grape",
  other: "slate",
};

/** A bank's monogram on its own wash: UBA, ZB, GT… - the bank's name is beside it, never the tile alone. */
export function BankMark({ code, size = 40 }: { code: BankCode; size?: number }) {
  const label = BANKS[code] ?? code;
  const mono = code === "uba" ? "UBA" : code === "gtbank" ? "GT" : code === "firstbank" ? "FB" : code === "taj" ? "TAJ" : label.slice(0, 2).toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * (mono.length > 2 ? 0.26 : 0.34)) }}
      className={cx("inline-flex shrink-0 items-center justify-center rounded-xl font-bold tracking-tight", HUE[BANK_HUE[code] ?? "slate"].soft)}
    >
      {mono}
    </span>
  );
}

/** Money with tabular figures; negatives in the error colour *and* with a minus sign. */
export function Money({ value, currency = "NGN", className, signed = false }: { value: number | null | undefined; currency?: string; className?: string; signed?: boolean }) {
  const negative = (value ?? 0) < 0;
  const text = amount(value, currency as CurrencyCode);
  return (
    <span className={cx("tabular-nums whitespace-nowrap", negative && "text-error-700", className)}>
      {signed && value != null && value > 0 ? "+" : ""}
      {text}
    </span>
  );
}

export function ImportStatusChip({ status }: { status: string }) {
  const s = importStatus(status);
  const Icon = s.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", HUE[s.hue].soft)}>
      <Icon size={12} aria-hidden className={isProcessing(status) ? "animate-spin motion-reduce:animate-none" : undefined} />
      {s.label}
    </span>
  );
}

/** Every check ran and none failed. */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <Chip hue="mint" icon={BadgeCheck} className="!px-2 !py-0.5 !text-[11px]">
      Verified
    </Chip>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-neutral-500" role="status">
      <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </span>
  );
}

/** A label over a figure: the statement header's opening / withdrawals / deposits / closing. */
export function Figure({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "in" | "out" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className={cx("mt-1 text-lg font-bold tracking-tight tabular-nums", tone === "in" ? "text-mint-700" : tone === "out" ? "text-coral-700" : "text-neutral-900")}>
        {children}
      </dd>
    </div>
  );
}
