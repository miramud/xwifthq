import { HUE } from "@/lib/products";

/**
 * A sprint burndown, drawn rather than screenshotted, inside the white
 * `.xw-frame` every hand-drawn mock on the public site sits in.
 *
 * Two decisions worth keeping:
 *
 * The *actual* series carries `.animate-draw-line`, which pairs with
 * `pathLength="1"` and already sits behind `prefers-reduced-motion` in
 * globals.css. That utility owns `stroke-dasharray`, so it cannot also carry a
 * dash pattern. That is why the *ideal* series is the dashed one and is
 * static. The two series differ by dash, by colour (brand purple against a
 * soft grey) and by a worded legend, so none of the three does the job alone.
 *
 * The chart is a `role="img"` with a label that states the shape, because a bag
 * of `<path>` elements tells a screen reader nothing and the figures below it
 * are the fallback a chart always owes. The module's sky hue appears only on
 * the small sprint dot in the header.
 */

const DAYS = 10;
const START_POINTS = 80;

/** Points remaining at the end of each day. Illustrative. */
const ACTUAL = [80, 76, 72, 66, 62, 58, 45, 34, 19, 8, 0];

const PAD = { left: 30, right: 10, top: 12, bottom: 22 };
const BOX = { width: 320, height: 170 };
const PLOT = {
  width: BOX.width - PAD.left - PAD.right,
  height: BOX.height - PAD.top - PAD.bottom,
};

function x(day: number) {
  return PAD.left + (day / DAYS) * PLOT.width;
}

function y(points: number) {
  return PAD.top + (1 - points / START_POINTS) * PLOT.height;
}

const ACTUAL_PATH = ACTUAL.map(
  (points, day) => `${day === 0 ? "M" : "L"}${x(day).toFixed(1)} ${y(points).toFixed(1)}`,
).join(" ");

const IDEAL_PATH = `M${x(0)} ${y(START_POINTS)} L${x(DAYS)} ${y(0)}`;

const Y_TICKS = [0, 20, 40, 60, 80];

export function BurndownChart() {
  return (
    <div className="xw-frame p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 font-heading text-sm font-semibold text-neutral-900">
          <span className={`h-2 w-2 shrink-0 rounded-full ${HUE.info.rule}`} aria-hidden="true" />
          Sprint 14 burndown
        </p>
        <p className="tnum rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
          {START_POINTS} points · {DAYS} days
        </p>
      </div>

      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Sprint burndown. Eighty points at the start, ten working days. The actual line runs above the ideal line from day two to day six, then falls steeply and reaches zero on day ten. Illustrative data.`}
      >
        {/* Grid and axes */}
        <g aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={BOX.width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-neutral-200"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="tnum fill-neutral-500"
                fontSize="8"
              >
                {tick}
              </text>
            </g>
          ))}

          {[0, 2, 4, 6, 8, 10].map((day) => (
            <text
              key={day}
              x={x(day)}
              y={BOX.height - 7}
              textAnchor="middle"
              className="tnum fill-neutral-500"
              fontSize="8"
            >
              {day}
            </text>
          ))}
        </g>

        {/* Ideal: dashed, static, soft grey. */}
        <path
          d={IDEAL_PATH}
          fill="none"
          className="stroke-neutral-400"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
          aria-hidden="true"
        />

        {/* Actual: solid brand purple, drawn in. */}
        <path
          d={ACTUAL_PATH}
          pathLength={1}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line stroke-primary-600"
          aria-hidden="true"
        />

        <circle cx={x(DAYS)} cy={y(0)} r="3.5" className="fill-primary-600" aria-hidden="true" />
      </svg>

      {/* Legend: the dash pattern is repeated here so shape, not only colour,
          tells the two series apart. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="flex items-center gap-2 text-xs text-neutral-600">
          <svg width="26" height="6" viewBox="0 0 26 6" aria-hidden="true">
            <line
              x1="1"
              y1="3"
              x2="25"
              y2="3"
              className="stroke-neutral-400"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          </svg>
          Ideal
        </li>
        <li className="flex items-center gap-2 text-xs text-neutral-600">
          <svg width="26" height="6" viewBox="0 0 26 6" aria-hidden="true">
            <line
              x1="1"
              y1="3"
              x2="25"
              y2="3"
              className="stroke-primary-600"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          Actual
        </li>
        <li className="tnum text-xs text-neutral-500 sm:ml-auto">
          Velocity: 74 points over 3 sprints
        </li>
      </ul>

      <p className="mt-4 rounded-xl bg-neutral-100 px-3.5 py-2.5 text-xs leading-relaxed text-neutral-600">
        Drawn from how tasks actually moved, not from status updates. Figures are
        illustrative.
      </p>
    </div>
  );
}
