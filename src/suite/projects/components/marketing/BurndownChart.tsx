/**
 * A sprint burndown, drawn rather than screenshotted.
 *
 * Two decisions worth keeping:
 *
 * The *actual* series carries `.animate-draw-line`, which pairs with
 * `pathLength="1"` and already sits behind `prefers-reduced-motion` in
 * globals.css. That utility owns `stroke-dasharray`, so it cannot also carry a
 * dash pattern — which is why the *ideal* series is the dashed one and is
 * static. The two series therefore differ by dash and by colour and by a
 * worded legend, so none of the three is doing the job alone.
 *
 * The chart is a `role="img"` with a label that states the shape, because a bag
 * of `<path>` elements tells a screen reader nothing and the figures below it
 * are the fallback a chart always owes.
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
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Burndown · Sprint 14
        </p>
        <p className="tnum label-mono text-neutral-500">
          {START_POINTS} points · {DAYS} days
        </p>
      </div>

      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Sprint burndown. Eighty points at the start, ten working days. The actual line runs above the ideal line from day two to day six, then falls steeply and reaches zero on day ten. Illustrative data.`}
      >
        {/* Grid and y axis */}
        <g aria-hidden="true">
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={BOX.width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#D6E2E1"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="tnum"
                fontSize="8"
                fill="#5C6E6F"
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
              className="tnum"
              fontSize="8"
              fill="#5C6E6F"
            >
              {day}
            </text>
          ))}
        </g>

        {/* Ideal — dashed, static, neutral. */}
        <path
          d={IDEAL_PATH}
          fill="none"
          stroke="#7E9494"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
          aria-hidden="true"
        />

        {/* Actual — solid, sky, drawn in. */}
        <path
          d={ACTUAL_PATH}
          pathLength={1}
          fill="none"
          stroke="#0369A1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line"
          aria-hidden="true"
        />

        <circle cx={x(DAYS)} cy={y(0)} r="3.5" fill="#0369A1" aria-hidden="true" />
      </svg>

      {/* Legend — the dash pattern is repeated here so shape, not only colour,
          tells the two series apart. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <li className="flex items-center gap-2 text-xs text-neutral-600">
          <svg width="26" height="6" viewBox="0 0 26 6" aria-hidden="true">
            <line
              x1="1"
              y1="3"
              x2="25"
              y2="3"
              stroke="#7E9494"
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
              stroke="#0369A1"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          Actual
        </li>
        <li className="tnum ml-auto text-xs text-neutral-500">
          Velocity: 74 points over 3 sprints
        </li>
      </ul>

      <p className="mt-3 border-t border-neutral-200 pt-3 text-xs leading-relaxed text-neutral-500">
        Drawn from task movement, not from a status update. Illustrative figures.
      </p>
    </div>
  );
}
