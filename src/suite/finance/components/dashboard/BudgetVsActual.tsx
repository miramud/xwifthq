"use client";

import { CircleAlert, CircleCheck, PiggyBank } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { IconTile } from "@/suite/lms/components/ui/ws";
import { FINANCE_DATA, naira } from "@/lib/suite-data";

/**
 * Budget against actual, by cost centre.
 *
 * Both bars are scaled against the largest figure on the whole card rather
 * than each against its own budget, so two things stay true at once: rows are
 * comparable to each other, and a cost centre that has spent more than its
 * budget draws a longer actual bar than its budget bar. Normalising each row
 * to its own budget would cap every bar at full width and hide the one
 * overspend on this card, which is the only row anyone is looking for.
 *
 * The bars are `aria-hidden` because every figure they encode is written next
 * to them as text. Variance carries a sign, a word and a glyph; the colour is
 * the fourth signal, not the first.
 */

const rows = FINANCE_DATA.budgets;

/** The widest thing on the card, so an overspend can draw past its budget. */
const SCALE = rows.reduce((max, row) => Math.max(max, row.budget, row.spent), 0);

const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);

const width = (value: number) => `${(value / SCALE) * 100}%`;

export function BudgetVsActual() {
  return (
    <div>
      <ul className="space-y-1">
        {rows.map((row) => {
          const variance = row.budget - row.spent;
          const over = variance < 0;
          const VarianceIcon = over ? CircleAlert : CircleCheck;

          return (
            <li key={row.id} className="rounded-2xl px-2 py-3">
              <div className="flex items-center gap-3">
                <IconTile icon={PiggyBank} hue={over ? "rose" : "blue"} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{row.name}</p>
                  <p className="text-xs text-neutral-500">Owner · {row.owner}</p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  <span className="font-bold tabular-nums text-neutral-900">{row.percent}%</span> used
                </p>
              </div>

              <div className="mt-3 space-y-1.5 pl-[50px]" aria-hidden="true">
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] font-medium text-neutral-500">Budget</span>
                  <span className="ws-hatch h-2.5 flex-1 rounded-full">
                    <span className="block h-full rounded-full bg-neutral-300" style={{ width: width(row.budget) }} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] font-medium text-neutral-500">Actual</span>
                  <span className="ws-hatch h-2.5 flex-1 rounded-full">
                    <span className="flex h-full overflow-hidden rounded-full" style={{ width: width(row.spent) }}>
                      <span
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
                        style={{ width: `${(Math.min(row.spent, row.budget) / row.spent) * 100}%` }}
                      />
                      {over && <span className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${(-variance / row.spent) * 100}%` }} />}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-[50px] text-xs">
                <span className="text-neutral-500">
                  <span className="tabular-nums">{naira(row.spent)}</span> of <span className="tabular-nums">{naira(row.budget)}</span>
                </span>
                <span
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold",
                    over ? "bg-rose-50 text-rose-700" : "bg-mint-50 text-mint-700",
                  )}
                >
                  <VarianceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tabular-nums">
                    {over ? "-" : "+"}
                    {naira(Math.abs(variance))}
                  </span>
                  {over ? "over" : "under"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary-50 px-4 py-3">
          <dt className="text-xs font-medium text-primary-700">Total budget</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">{naira(totalBudget)}</dd>
        </div>
        <div className="rounded-2xl bg-sky-50 px-4 py-3">
          <dt className="text-xs font-medium text-sky-700">Total spent</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">{naira(totalSpent)}</dd>
        </div>
        <div className="rounded-2xl bg-mint-50 px-4 py-3">
          <dt className="text-xs font-medium text-mint-700">Variance</dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900">+{naira(totalBudget - totalSpent)} under</dd>
        </div>
      </dl>
    </div>
  );
}
