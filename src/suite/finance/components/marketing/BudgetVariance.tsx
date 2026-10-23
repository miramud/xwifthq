import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * Budget against actual, by cost centre.
 *
 * Two rules shape this chart. The first: variance is never carried by colour.
 * Every figure gets a sign, an arrow glyph and the word "over" or "under", so
 * the chart survives a monochrome print and a red-green colour deficiency
 * without losing its meaning.
 *
 * The second: gold is the *actual* series and hatched neutral is the budget.
 * The two series therefore differ by fill pattern as well as by value, which
 * is the same reason — and it means the gold is doing what gold is for on this
 * brand, marking the number the reader came for.
 *
 * The bars reuse `.animate-grow-up` from globals.css, which already sets
 * `transform-box: fill-box` for SVG and already disables itself under
 * `prefers-reduced-motion`.
 */

interface Centre {
  name: string;
  budget: number;
  actual: number;
  variance: string;
  direction: "over" | "under";
}

/** Millions of naira. Illustrative — the shape is the point, not the figures. */
const CENTRES: readonly Centre[] = [
  {
    name: "Facilities",
    budget: 4.8,
    actual: 5.6,
    variance: "+0.80",
    direction: "over",
  },
  {
    name: "Training",
    budget: 3.2,
    actual: 2.4,
    variance: "-0.80",
    direction: "under",
  },
  { name: "Fleet", budget: 2.6, actual: 2.9, variance: "+0.30", direction: "over" },
  { name: "IT", budget: 5.4, actual: 5.1, variance: "-0.30", direction: "under" },
];

/** Headroom above the tallest bar so a bar never touches the chart's ceiling. */
const SCALE_MAX = 6.4;
const PLOT_HEIGHT = 84;

function barHeight(value: number) {
  return Math.round((value / SCALE_MAX) * PLOT_HEIGHT * 10) / 10;
}

export function BudgetVariance() {
  return (
    <div
      role="img"
      aria-label="Illustrative budget against actual for four cost centres, in millions of naira. Facilities: budget 4.8, actual 5.6, variance plus 0.80 over. Training: budget 3.2, actual 2.4, variance minus 0.80 under. Fleet: budget 2.6, actual 2.9, variance plus 0.30 over. IT: budget 5.4, actual 5.1, variance minus 0.30 under."
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Budget against actual
        </p>
        <p className="label-mono tnum text-neutral-500">Q1 2026 · NGN m</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="label-mono flex items-center gap-2 text-neutral-500">
          <svg
            className="h-3 w-3.5 shrink-0"
            viewBox="0 0 14 12"
            aria-hidden="true"
          >
            <rect
              width="14"
              height="12"
              rx="1.5"
              fill="url(#budget-legend-hatch)"
              stroke="#b7c7c6"
            />
            <defs>
              <pattern
                id="budget-legend-hatch"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="4" height="4" fill="#ffffff" />
                <line x1="0" y1="0" x2="0" y2="4" stroke="#b7c7c6" strokeWidth="1.6" />
              </pattern>
            </defs>
          </svg>
          Budget
        </span>
        <span className="label-mono flex items-center gap-2 text-neutral-500">
          <span
            className="h-3 w-3.5 shrink-0 rounded-[2px] bg-accent-500"
            aria-hidden="true"
          />
          Actual
        </span>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {CENTRES.map((centre, index) => {
          const Direction = centre.direction === "over" ? ArrowUp : ArrowDown;
          const hatchId = `budget-hatch-${centre.name.toLowerCase()}`;

          return (
            <li key={centre.name} className="min-w-0">
              <svg
                className="h-24 w-full"
                viewBox="0 0 56 96"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <pattern
                    id={hatchId}
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="4" height="4" fill="#f7faf9" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="4"
                      stroke="#b7c7c6"
                      strokeWidth="1.6"
                    />
                  </pattern>
                </defs>

                {/* Baseline — the rule the bars actually stand on. */}
                <line
                  x1="0"
                  y1="88"
                  x2="56"
                  y2="88"
                  stroke="#d6e2e1"
                  strokeWidth="1"
                />

                <rect
                  className="animate-grow-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                  x="8"
                  y={88 - barHeight(centre.budget)}
                  width="17"
                  height={barHeight(centre.budget)}
                  rx="2"
                  fill={`url(#${hatchId})`}
                  stroke="#b7c7c6"
                  strokeWidth="1"
                />
                <rect
                  className="animate-grow-up"
                  style={{ animationDelay: `${index * 80 + 40}ms` }}
                  x="31"
                  y={88 - barHeight(centre.actual)}
                  width="17"
                  height={barHeight(centre.actual)}
                  rx="2"
                  fill="#e6a532"
                  stroke="#b7801b"
                />
              </svg>

              <p className="mt-2 truncate font-heading text-sm font-semibold text-neutral-900">
                {centre.name}
              </p>
              <p className="tnum label-mono mt-1 text-neutral-500">
                {centre.budget.toFixed(1)} → {centre.actual.toFixed(1)}
              </p>
              <p className="tnum mt-1.5 flex items-center gap-1 text-xs font-semibold text-neutral-900">
                <Direction className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {centre.variance}
                <span className="font-normal text-neutral-500">
                  {centre.direction}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Variance lands with the budget holder who can act on it, not with the
        accountant who reported it. Payroll cost arrives from HRM already split
        the same way.
      </p>
    </div>
  );
}
