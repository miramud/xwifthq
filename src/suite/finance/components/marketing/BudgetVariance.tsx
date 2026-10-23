import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * Budget against actual, by cost centre.
 *
 * Two rules shape this chart. The first: variance is never carried by colour.
 * Every figure gets a sign, an arrow glyph and the word "over" or "under", so
 * the chart survives a monochrome print and a red-green colour deficiency
 * without losing its meaning.
 *
 * The second: solid purple is the actual series and hatched grey is the
 * budget. The two series differ by fill pattern as well as by value, for the
 * same reason, and the purple marks the number the reader came for.
 *
 * The bars reuse `.animate-grow-up` from globals.css, which already sets
 * `transform-box: fill-box` for SVG and already disables itself under
 * `prefers-reduced-motion`. Fills and strokes use Tailwind's `fill-*` and
 * `stroke-*` utilities, so the chart follows the colour tokens.
 */

interface Centre {
  name: string;
  budget: number;
  actual: number;
  variance: string;
  direction: "over" | "under";
}

/** Millions of naira. Illustrative: the shape is the point, not the figures. */
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
      className="xw-frame p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <p className="text-[11px] text-neutral-500">Cost centres</p>
          <p className="font-heading text-sm font-bold text-neutral-900">
            Budget against actual
          </p>
        </div>
        <span className="tnum rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Q1 2026 · NGN m
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
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
              className="stroke-neutral-300"
            />
            <defs>
              <pattern
                id="budget-legend-hatch"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="4" height="4" className="fill-white" />
                <line x1="0" y1="0" x2="0" y2="4" className="stroke-neutral-300" strokeWidth="1.6" />
              </pattern>
            </defs>
          </svg>
          Budget
        </span>
        <span className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
          <span
            className="h-3 w-3.5 shrink-0 rounded-[3px] bg-primary-600"
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
                    <rect width="4" height="4" className="fill-neutral-50" />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="4"
                      className="stroke-neutral-300"
                      strokeWidth="1.6"
                    />
                  </pattern>
                </defs>

                {/* Baseline: the rule the bars actually stand on. */}
                <line
                  x1="0"
                  y1="88"
                  x2="56"
                  y2="88"
                  className="stroke-neutral-200"
                  strokeWidth="1"
                />

                <rect
                  style={{ animationDelay: `${index * 80}ms` }}
                  x="8"
                  y={88 - barHeight(centre.budget)}
                  width="17"
                  height={barHeight(centre.budget)}
                  rx="3"
                  fill={`url(#${hatchId})`}
                  className="animate-grow-up stroke-neutral-300"
                  strokeWidth="1"
                />
                <rect
                  style={{ animationDelay: `${index * 80 + 40}ms` }}
                  x="31"
                  y={88 - barHeight(centre.actual)}
                  width="17"
                  height={barHeight(centre.actual)}
                  rx="3"
                  className="animate-grow-up fill-primary-600 stroke-primary-700"
                />
              </svg>

              <p className="mt-2 truncate font-heading text-sm font-semibold text-neutral-900">
                {centre.name}
              </p>
              <p className="tnum mt-1 text-[11px] text-neutral-500">
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

      <p className="mt-5 rounded-2xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
        Variance lands with the budget holder who can act on it, not the
        accountant who reported it. Payroll cost arrives from HRM already split
        the same way.
      </p>
    </div>
  );
}
