import { CircleCheck, Lock } from "lucide-react";

/**
 * A trial-balance fragment: the page's proof that it can be trusted with money.
 *
 * The figures balance. Debits and credits both total 66,276,000, which is the
 * whole difference between an illustration of a ledger and a decorative table
 * of plausible digits. Anyone who checks should find it ties.
 *
 * Money columns are right-aligned and carry `.tnum`, so the digits stack on the
 * column rather than shuffling by a pixel per glyph. The drawing sits in an
 * `.xw-frame` (white on a soft purple glow), and the "In balance" pill is the
 * one purple fill: it marks the result, not the furniture around it.
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
  { code: "1000", account: "Cash and bank", debit: "18,420,000", credit: "-" },
  {
    code: "1200",
    account: "Trade receivables",
    debit: "9,145,500",
    credit: "-",
  },
  {
    code: "1600",
    account: "Fixed assets, net",
    debit: "26,300,000",
    credit: "-",
  },
  {
    code: "5200",
    account: "Payroll (HRM journal)",
    debit: "12,410,500",
    credit: "-",
  },
  { code: "2000", account: "Trade payables", debit: "-", credit: "7,865,250" },
  { code: "3000", account: "Share capital", debit: "-", credit: "20,000,000" },
  { code: "4000", account: "Revenue", debit: "-", credit: "38,410,750" },
];

const TOTAL = "66,276,000";

export function TrialBalanceMock() {
  return (
    <div
      role="img"
      aria-label="Illustrative trial balance for March 2026: seven accounts across debit and credit columns, including a payroll line posted from HRM. Both columns total 66,276,000 and the period is in balance."
      className="xw-frame overflow-hidden p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-neutral-500">Finance</p>
          <p className="font-heading text-sm font-bold text-neutral-900">
            Trial balance
          </p>
        </div>
        <span className="tnum shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Mar 2026 · NGN
        </span>
      </div>

      {/*
        The account code is the first thing to go below `sm`, and the money
        columns narrow with a smaller figure size rather than the columns
        themselves narrowing: two nine-digit totals in a 64px column collide,
        and a trial balance whose debits touch its credits is worse than no
        trial balance at all. The right-alignment is what has to survive.
      */}
      <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-neutral-50 px-2.5 py-2 text-[10px] font-medium text-neutral-500 sm:gap-2">
        <span className="hidden w-10 shrink-0 sm:block">Code</span>
        <span className="min-w-0 flex-1">Account</span>
        <span className="w-[4.5rem] shrink-0 text-right sm:w-24">Debit</span>
        <span className="w-[4.5rem] shrink-0 text-right sm:w-24">Credit</span>
      </div>

      <div className="divide-y divide-neutral-100 px-2.5">
        {LINES.map((line) => (
          <div
            key={line.code}
            className="flex items-center gap-1.5 py-2 text-[13px] sm:gap-2"
          >
            <span className="tnum hidden w-10 shrink-0 text-[11px] text-neutral-400 sm:block">
              {line.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-neutral-700">
              {line.account}
            </span>
            <span
              className={`tnum w-[4.5rem] shrink-0 text-right text-[11px] sm:w-24 sm:text-[13px] ${
                line.debit === "-" ? "text-neutral-400" : "text-neutral-900"
              }`}
            >
              {line.debit}
            </span>
            <span
              className={`tnum w-[4.5rem] shrink-0 text-right text-[11px] sm:w-24 sm:text-[13px] ${
                line.credit === "-" ? "text-neutral-400" : "text-neutral-900"
              }`}
            >
              {line.credit}
            </span>
          </div>
        ))}
      </div>

      {/* The rule above the totals is the accountant's rule, drawn in ink. */}
      <div className="mx-2.5 flex items-center gap-1.5 border-t-2 border-neutral-900 py-2.5 text-[13px] font-semibold sm:gap-2">
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white">
          <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
          In balance
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600">
          <Lock className="h-3.5 w-3.5 text-accent-600" aria-hidden="true" />
          Feb locked
        </span>
      </div>
    </div>
  );
}
