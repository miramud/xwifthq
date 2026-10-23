import { FINANCE_DATA } from "@/lib/suite-data";

/**
 * Cash in against cash out, eight months.
 *
 * **Why the axis labels are HTML and only the geometry is SVG.** Text inside a
 * `viewBox` scales with the box, so a chart that reads well at 900px renders
 * 5px type at 320px. Keeping the months and the naira scale in the document
 * means they are real text at every width, and the SVG can scale freely
 * underneath them.
 *
 * **Why two series are derived here.** `FINANCE_DATA.cashflow` is one series,
 * and its September value is the cash position on the KPI row to the decimal
 * (126 against ₦126.4M), so this reads it as the running cash balance and
 * derives the two flows that produce it: in each month `in − out` is exactly
 * the step from one balance to the next. Nothing is invented that the fixture
 * then contradicts — the hidden table below prints all four columns so a
 * reader can check the arithmetic rather than take it on trust.
 *
 * **Colour is the last thing carrying the distinction, not the first.** The
 * two series differ by dash pattern and by marker shape before they differ by
 * hue, and the gold is `accent-600` rather than the brand `accent-500`: a 2px
 * hairline is a graphical object judged at 3:1, and Summit Gold on white is
 * 1.9:1. The registry's raw hex is calibrated for large bar fills, which is
 * not what this is.
 */

/** accent-600. See the note above on why this is not accent-500. */
const GOLD_LINE = "#b7801b";
/** neutral-700 — 8.9:1 on white, and legible as a dashed hairline. */
const SLATE_LINE = "#34464a";

interface FlowMonth {
  label: string;
  /** ₦ millions. */
  in: number;
  out: number;
}

const FLOWS: readonly FlowMonth[] = [
  { label: "Feb", in: 55, out: 47 },
  { label: "Mar", in: 61, out: 53 },
  { label: "Apr", in: 44, out: 57 },
  { label: "May", in: 72, out: 50 },
  { label: "Jun", in: 66, out: 53 },
  { label: "Jul", in: 49, out: 56 },
  { label: "Aug", in: 74, out: 53 },
  { label: "Sep", in: 63, out: 55 },
];

/** The fixture's own series, read as the closing balance for each month. */
const CLOSING = FINANCE_DATA.cashflow;

const MAX = 80;
const TICKS = [80, 60, 40, 20, 0] as const;

const VB_WIDTH = 720;
const VB_HEIGHT = 200;
const BAND = VB_WIDTH / FLOWS.length;

/** Points sit at band centres so the HTML month labels line up with them. */
const x = (index: number) => index * BAND + BAND / 2;
const y = (value: number) => VB_HEIGHT - (value / MAX) * VB_HEIGHT;

const path = (key: "in" | "out") =>
  FLOWS.map((m, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(m[key])}`).join(" ");

const latest = FLOWS[FLOWS.length - 1];
const latestNet = latest.in - latest.out;
const latestClosing = CLOSING[CLOSING.length - 1];

export function CashFlowChart() {
  return (
    <figure className="m-0">
      <div className="flex items-stretch gap-2">
        {/* naira scale — real text, so it stays 10px at every viewport */}
        <div className="relative w-8 shrink-0" aria-hidden="true">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[10px] text-neutral-500 tnum"
              style={{ top: `${100 - (tick / MAX) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
            className="block h-auto w-full overflow-visible"
            role="img"
            aria-label="Cash in against cash out, February to September, in naira millions. Cash in swings between 44 and 74 a month; cash out holds between 47 and 57. Cash in exceeds cash out in six of the eight months."
          >
            {TICKS.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={VB_WIDTH}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#d6e2e1"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Cash out first, so the gold series reads on top of it. */}
            <path
              d={path("out")}
              fill="none"
              stroke={SLATE_LINE}
              strokeWidth={2}
              strokeDasharray="7 5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {/*
              Only the solid series animates: `.animate-draw-line` works by
              setting `stroke-dasharray: 1`, which would flatten the dashes
              that tell the two series apart. A static dashed line is honest;
              a dashed line that has to stop being dashed to animate is not.
            */}
            <path
              d={path("in")}
              pathLength={1}
              fill="none"
              stroke={GOLD_LINE}
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="animate-draw-line"
            />

            {FLOWS.map((month, index) => (
              <rect
                key={`out-${month.label}`}
                x={x(index) - 4}
                y={y(month.out) - 4}
                width={8}
                height={8}
                fill="#ffffff"
                stroke={SLATE_LINE}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {FLOWS.map((month, index) => (
              <circle
                key={`in-${month.label}`}
                cx={x(index)}
                cy={y(month.in)}
                r={4.5}
                fill="#ffffff"
                stroke={GOLD_LINE}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      </div>

      {/*
        Outside the flex row, not inside it: the naira scale is positioned as a
        percentage of the row's height, so anything else in that row would push
        the gridline labels out of line with the gridlines. `pl-10` is the
        scale column plus its gap.
      */}
      <div className="mt-2 flex pl-10" aria-hidden="true">
        {FLOWS.map((month) => (
          <span
            key={month.label}
            className="flex-1 text-center text-[10px] text-neutral-500"
          >
            {month.label}
          </span>
        ))}
      </div>

      {/* legend — shape and dash first, hue second */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-3 text-xs">
        <span className="inline-flex items-center gap-2 text-neutral-700">
          <svg width="26" height="10" aria-hidden="true" className="shrink-0">
            <line
              x1="1"
              y1="5"
              x2="25"
              y2="5"
              stroke={GOLD_LINE}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="13" cy="5" r="3.5" fill="#ffffff" stroke={GOLD_LINE} strokeWidth="2" />
          </svg>
          Cash in
        </span>
        <span className="inline-flex items-center gap-2 text-neutral-700">
          <svg width="26" height="10" aria-hidden="true" className="shrink-0">
            <line
              x1="1"
              y1="5"
              x2="25"
              y2="5"
              stroke={SLATE_LINE}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            <rect x="9.5" y="1.5" width="7" height="7" fill="#ffffff" stroke={SLATE_LINE} strokeWidth="2" />
          </svg>
          Cash out
        </span>
        <span className="text-neutral-500">
          Naira millions ·{" "}
          <span className="tnum">
            {latestNet > 0 ? "+" : ""}
            {latestNet}
          </span>{" "}
          net in September, closing at{" "}
          <span className="tnum font-semibold text-neutral-900">
            ₦{latestClosing.value}m
          </span>
        </span>
      </div>

      {/*
        A chart a screen reader cannot read is not made accessible by an alt
        text. The values themselves, as a table, with the closing balance the
        two flows reconcile to.
      */}
      <table className="sr-only">
        <caption>
          Monthly cash flow in naira millions: cash in, cash out, net movement
          and closing cash balance.
        </caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Cash in</th>
            <th scope="col">Cash out</th>
            <th scope="col">Net movement</th>
            <th scope="col">Closing cash</th>
          </tr>
        </thead>
        <tbody>
          {FLOWS.map((month, index) => (
            <tr key={month.label}>
              <th scope="row">{month.label}</th>
              <td>{month.in}</td>
              <td>{month.out}</td>
              <td>
                {month.in - month.out > 0 ? "+" : ""}
                {month.in - month.out}
              </td>
              <td>{CLOSING[index].value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="sr-only">
        Cash in and cash out are illustrative monthly flows; the closing balance
        is the module fixture.
      </figcaption>
    </figure>
  );
}
