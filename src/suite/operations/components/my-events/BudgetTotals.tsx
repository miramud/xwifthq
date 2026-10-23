"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount } from "@/suite/finance/lib/format";
import type { BudgetSummary } from "../events/budget";

/**
 * The budget's total as the lines are typed, and contingency against its
 * cap: a bar that fills towards the cap and turns rose past it, with the
 * figures in words.
 */
export default function BudgetTotals({ summary, capPct = 10 }: { summary: BudgetSummary; capPct?: number }) {
  const s = summary;
  const fill = s.cap > 0 ? Math.min(100, (s.contingency / s.cap) * 100) : s.contingency > 0 ? 100 : 0;
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-neutral-600">Total budget</span>
        <Money value={s.total} className="text-2xl font-bold tracking-tight text-neutral-900" />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 text-xs text-neutral-500">
          <span>
            Contingency <Money value={s.contingency} className="ml-1 text-sm font-semibold text-neutral-900" />
          </span>
          <span className="tabular-nums">
            cap {capPct}% of the rest: <Money value={s.cap} className="font-semibold text-neutral-700" />
          </span>
        </div>
        <div
          className="ws-hatch mt-2 h-2.5 overflow-hidden rounded-full"
          role="meter"
          aria-label="Contingency against its cap"
          aria-valuemin={0}
          aria-valuemax={s.cap}
          aria-valuenow={Math.min(s.contingency, s.cap)}
          aria-valuetext={`${amount(s.contingency)} of ${amount(s.cap)}`}
        >
          <span className={cx("block h-full rounded-full", s.overCap ? "bg-rose-500" : "bg-sun-500")} style={{ width: `${fill}%` }} />
        </div>
        {s.overCap ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-rose-700">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            Contingency is {amount(s.contingency - s.cap)} over its cap. Lower it to {amount(s.cap)} or less.
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck size={13} aria-hidden />
            Contingency is capped at {capPct}% of the other lines and paid as an advance.
          </p>
        )}
      </div>
    </div>
  );
}
