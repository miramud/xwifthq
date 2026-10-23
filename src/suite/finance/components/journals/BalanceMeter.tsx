"use client";

import { CheckCircle2, Scale } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { accounting } from "@/suite/finance/lib/format";

/**
 * Debits and credits as two arms of one beam, meeting in the middle. Each arm
 * grows outwards from the centre in proportion to its side; when they match
 * the beam turns green and says "Balanced", otherwise it names the side that
 * is short and by how much. Words carry the state; the colour only agrees.
 */
export function BalanceMeter({ debits, credits, currency }: { debits: number; credits: number; currency?: string }) {
  const max = Math.max(debits, credits, 1);
  const diff = debits - credits;
  const balanced = diff === 0 && debits > 0;
  const empty = debits === 0 && credits === 0;
  const prefix = currency ? `${currency} ` : "";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-4 text-xs text-neutral-500">
        <span>
          Debits <span className="ml-1 text-sm font-bold tabular-nums text-neutral-900">{prefix}{accounting(debits)}</span>
        </span>
        <span className="text-right">
          <span className="mr-1 text-sm font-bold tabular-nums text-neutral-900">{prefix}{accounting(credits)}</span> Credits
        </span>
      </div>
      <div className="relative mt-2 flex h-2.5 items-center" aria-hidden>
        <div className="ws-hatch flex h-full flex-1 justify-end overflow-hidden rounded-l-full">
          <span
            className={cx("h-full rounded-l-full transition-[width] duration-300", balanced ? "bg-mint-500" : "bg-primary-500")}
            style={{ width: `${(debits / max) * 100}%` }}
          />
        </div>
        <span className={cx("z-10 mx-0.5 h-4 w-1 rounded-full", balanced ? "bg-mint-600" : "bg-neutral-400")} />
        <div className="ws-hatch flex h-full flex-1 overflow-hidden rounded-r-full">
          <span
            className={cx("h-full rounded-r-full transition-[width] duration-300", balanced ? "bg-mint-500" : "bg-grape-500")}
            style={{ width: `${(credits / max) * 100}%` }}
          />
        </div>
      </div>
      <p role="status" aria-live="polite" className={cx("mt-2 flex items-center gap-1.5 text-sm font-semibold", balanced ? "text-mint-700" : empty ? "text-neutral-500" : "text-sun-700")}>
        {balanced ? <CheckCircle2 size={15} aria-hidden /> : <Scale size={15} aria-hidden />}
        {balanced
          ? "Balanced"
          : empty
            ? "Enter the amounts"
            : `Out by ${prefix}${accounting(Math.abs(diff))}: ${diff > 0 ? "credits" : "debits"} are short`}
      </p>
    </div>
  );
}
