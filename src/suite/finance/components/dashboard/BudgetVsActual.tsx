import { CircleAlert, CircleCheck } from "lucide-react";
import { FINANCE_DATA, naira } from "@/lib/suite-data";

/**
 * Budget against actual, by cost centre.
 *
 * Both bars are scaled against the largest figure on the whole card rather
 * than each against its own budget, so two things stay true at once: rows are
 * comparable to each other, and a cost centre that has spent more than its
 * budget draws a longer actual bar than its budget bar. Normalising each row
 * to its own budget would cap every bar at full width and make the one
 * overspend on this card invisible — which is the only row anyone is looking
 * for.
 *
 * The bars are `aria-hidden` because every figure they encode is written next
 * to them as text. Variance carries a sign, a word and a glyph; the colour is
 * the fourth signal, not the first.
 *
 * Summit Gold fills the actual bar and carries no text on it. That is the
 * whole permitted use of `accent-500`: a fill. Every word on this card is ink
 * or slate, and the one control is teal.
 */

const rows = FINANCE_DATA.budgets;

/** The widest thing on the card, so an overspend can draw past its budget. */
const SCALE = rows.reduce(
  (max, row) => Math.max(max, row.budget, row.spent),
  0,
);

const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0);
const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);

const width = (value: number) => `${(value / SCALE) * 100}%`;

export function BudgetVsActual() {
  return (
    <div>
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => {
          const variance = row.budget - row.spent;
          const over = variance < 0;
          const VarianceIcon = over ? CircleAlert : CircleCheck;

          return (
            <li key={row.id} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {row.name}
                </p>
                <p className="shrink-0 text-xs text-neutral-500">
                  <span className="tnum font-semibold text-neutral-900">
                    {row.percent}%
                  </span>{" "}
                  used
                </p>
              </div>
              <p className="text-[11px] text-neutral-500">Owner · {row.owner}</p>

              <div className="mt-2.5 space-y-1.5" aria-hidden="true">
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">
                    Budget
                  </span>
                  <span className="h-2.5 flex-1 rounded-full bg-neutral-100">
                    <span
                      className="block h-full rounded-full bg-neutral-300"
                      style={{ width: width(row.budget) }}
                    />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">
                    Actual
                  </span>
                  <span className="h-2.5 flex-1 rounded-full bg-neutral-100">
                    <span
                      className="flex h-full overflow-hidden rounded-full"
                      style={{ width: width(row.spent) }}
                    >
                      <span
                        className="h-full bg-accent-500"
                        style={{
                          width: `${(Math.min(row.spent, row.budget) / row.spent) * 100}%`,
                        }}
                      />
                      {over && (
                        <span
                          className="h-full bg-error-500"
                          style={{
                            width: `${(-variance / row.spent) * 100}%`,
                          }}
                        />
                      )}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <span className="text-neutral-500">
                  <span className="tnum">{naira(row.spent)}</span> of{" "}
                  <span className="tnum">{naira(row.budget)}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    over ? "text-error-600" : "text-neutral-700"
                  }`}
                >
                  <VarianceIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="tnum">
                    {over ? "−" : "+"}
                    {naira(Math.abs(variance))}
                  </span>
                  {over ? "over" : "under"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-neutral-200 pt-3 text-xs">
        <div className="flex items-baseline gap-2">
          <dt className="text-neutral-500">Total budget</dt>
          <dd className="font-semibold text-neutral-900 tnum">
            {naira(totalBudget)}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-neutral-500">Total spent</dt>
          <dd className="font-semibold text-neutral-900 tnum">
            {naira(totalSpent)}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-neutral-500">Variance</dt>
          <dd className="font-semibold text-neutral-900 tnum">
            +{naira(totalBudget - totalSpent)} under
          </dd>
        </div>
      </dl>
    </div>
  );
}
