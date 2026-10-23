import { CircleCheck, Lock } from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * A trial-balance fragment — the page's proof that it can be trusted with money.
 *
 * The figures balance. Debits and credits both total 66,276,000, which took
 * thirty seconds to arrange and is the whole difference between an illustration
 * of a ledger and a decorative table of plausible digits. Anyone who checks
 * should find it ties.
 *
 * Money columns are right-aligned and carry `.tnum`, so the digits stack on the
 * column rather than shuffling by a pixel per glyph. The totals row is the one
 * solid-gold moment on the page: Ink on `accent-500`, never white.
 *
 * `role="img"` with a summary, because a screen reader working through fourteen
 * invented figures learns less than the one sentence the label carries.
 */

interface Line {
  code: string;
  account: string;
  debit: string;
  credit: string;
}

const LINES: readonly Line[] = [
  { code: "1000", account: "Cash and bank", debit: "18,420,000", credit: "—" },
  {
    code: "1200",
    account: "Trade receivables",
    debit: "9,145,500",
    credit: "—",
  },
  {
    code: "1600",
    account: "Fixed assets — net",
    debit: "26,300,000",
    credit: "—",
  },
  {
    code: "5200",
    account: "Payroll — HRM journal",
    debit: "12,410,500",
    credit: "—",
  },
  { code: "2000", account: "Trade payables", debit: "—", credit: "7,865,250" },
  { code: "3000", account: "Share capital", debit: "—", credit: "20,000,000" },
  { code: "4000", account: "Revenue", debit: "—", credit: "38,410,750" },
];

const TOTAL = "66,276,000";

export function TrialBalanceMock() {
  return (
    <div
      role="img"
      aria-label="Illustrative trial balance for March 2026: seven accounts across debit and credit columns, including a payroll line posted from HRM. Both columns total 66,276,000 and the period is in balance."
    >
      <MockFrame label="finance / trial balance" hue="accent">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-sm font-semibold text-neutral-900">
            Trial balance
          </p>
          <p className="label-mono tnum text-neutral-500">Mar 2026 · NGN</p>
        </div>

        {/*
          The account code is the first thing to go below `sm`, and the money
          columns narrow with a smaller figure size rather than the columns
          themselves narrowing: two nine-digit totals in a 64px column collide,
          and a trial balance whose debits touch its credits is worse than no
          trial balance at all. The right-alignment is what has to survive.
        */}
        <div className="mt-4 flex items-center gap-1.5 border-b border-neutral-200 pb-2 sm:gap-2">
          <span className="label-mono hidden w-10 shrink-0 text-neutral-500 sm:block">
            Code
          </span>
          <span className="label-mono min-w-0 flex-1 text-neutral-500">
            Account
          </span>
          <span className="label-mono w-[4.5rem] shrink-0 text-right text-neutral-500 sm:w-24">
            Debit
          </span>
          <span className="label-mono w-[4.5rem] shrink-0 text-right text-neutral-500 sm:w-24">
            Credit
          </span>
        </div>

        <div className="divide-y divide-neutral-100">
          {LINES.map((line) => (
            <div
              key={line.code}
              className="flex items-center gap-1.5 py-2 text-[13px] sm:gap-2"
            >
              <span className="tnum label-mono hidden w-10 shrink-0 text-neutral-500 sm:block">
                {line.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-neutral-700">
                {line.account}
              </span>
              <span
                className={`tnum w-[4.5rem] shrink-0 text-right text-[11px] sm:w-24 sm:text-[13px] ${
                  line.debit === "—" ? "text-neutral-500" : "text-neutral-900"
                }`}
              >
                {line.debit}
              </span>
              <span
                className={`tnum w-[4.5rem] shrink-0 text-right text-[11px] sm:w-24 sm:text-[13px] ${
                  line.credit === "—" ? "text-neutral-500" : "text-neutral-900"
                }`}
              >
                {line.credit}
              </span>
            </div>
          ))}
        </div>

        {/* The rule above the totals is the accountant's rule, drawn in Ink. */}
        <div className="flex items-center gap-1.5 border-t-2 border-neutral-900 py-2.5 text-[13px] font-semibold sm:gap-2">
          <span className="hidden w-10 shrink-0 sm:block" />
          <span className="min-w-0 flex-1 text-neutral-900">Total</span>
          <span className="tnum w-[4.5rem] shrink-0 text-right text-[11px] text-neutral-900 sm:w-24 sm:text-[13px]">
            {TOTAL}
          </span>
          <span className="tnum w-[4.5rem] shrink-0 text-right text-[11px] text-neutral-900 sm:w-24 sm:text-[13px]">
            {TOTAL}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/*
            Solid Summit Gold, Ink label. This is the only fill on the page that
            gets the full brand gold, and it is reserved for the moment the
            ledger ties — gold is the reward colour, so it marks the result and
            not the furniture around it.
          */}
          <span className="label-mono inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-neutral-900">
            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
            In balance
          </span>
          <span className="label-mono inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-neutral-500">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Feb locked
          </span>
        </div>
      </MockFrame>
    </div>
  );
}
