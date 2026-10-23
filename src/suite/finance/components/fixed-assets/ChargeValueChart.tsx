"use client";

import { useState } from "react";
import { cx } from "@/components/workspace/kit";
import { Legend, hueHex } from "@/components/workspace/charts";
import { niceScale, toPct } from "@/components/workspace/charts-math";

/*
  Depreciation's two numbers on one picture: the month's charge as columns
  (left axis) and the net book value it leaves as a line (right axis). The
  charge is small and steady, the value large and falling, so each gets its
  own scale; both axes are labelled and the legend names them. Columns after
  `marker` are the forecast and are drawn hatched-outlined.
*/

export interface ChargeValuePoint {
  label: string;
  charge: number;
  nbv: number;
}

export function ChargeValueChart({
  data,
  format,
  caption,
  height = 240,
  marker,
  chargeLabel = "Depreciation charge",
  valueLabel = "Net book value",
}: {
  data: ChargeValuePoint[];
  format: (v: number) => string;
  caption: string;
  height?: number;
  /** Index from which the columns are a forecast. */
  marker?: number;
  chargeLabel?: string;
  valueLabel?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">No data for this period yet.</p>;

  const left = niceScale(data.map((d) => d.charge));
  const right = niceScale(data.map((d) => d.nbv));
  const n = data.length;
  const gutter = `${(Math.max(1, ...left.ticks.map((t) => format(t).length)) * 0.62 + 0.75).toFixed(2)}em`;
  const rgutter = `${(Math.max(1, ...right.ticks.map((t) => format(t).length)) * 0.62 + 0.75).toFixed(2)}em`;
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yPct = (v: number) => 100 - toPct(v, right.min, right.max);
  const line = data.map((d, i) => `${xPct(i).toFixed(3)},${yPct(d.nbv).toFixed(3)}`).join(" ");
  const forecast = (i: number) => marker != null && i >= marker;

  return (
    <figure>
      <div className="flex pt-2">
        <div className="relative shrink-0 text-[11px] tabular-nums text-neutral-500" style={{ width: gutter }} aria-hidden>
          {left.ticks.map((t) => (
            <span key={t} className="absolute right-2 translate-y-1/2 whitespace-nowrap leading-none" style={{ bottom: `${toPct(t, left.min, left.max)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label={caption}>
          {left.ticks.map((t) => (
            <span key={t} aria-hidden className={cx("pointer-events-none absolute inset-x-0 border-t", t === 0 ? "border-neutral-300" : "border-neutral-100")} style={{ bottom: `${toPct(t, left.min, left.max)}%` }} />
          ))}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {data.map((d, i) => {
              const on = active === i;
              const h = toPct(d.charge, left.min, left.max) - toPct(0, left.min, left.max);
              return (
                <div key={`${d.label}-${i}`} className="relative px-1 sm:px-1.5" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                  <button
                    type="button"
                    className="absolute inset-y-0 left-1/2 w-full max-w-[40px] -translate-x-1/2 cursor-default rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
                    aria-label={`${d.label}${forecast(i) ? " (forecast)" : ""}: ${chargeLabel} ${format(d.charge)}, ${valueLabel} ${format(d.nbv)}`}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    <span
                      className={cx(
                        "absolute inset-x-0 rounded-md motion-safe:transition-opacity motion-safe:duration-200",
                        forecast(i) ? "border-2 border-dashed border-primary-400 bg-primary-50" : "bg-primary-500",
                        active != null && !on && "opacity-40",
                      )}
                      style={{ bottom: `${toPct(0, left.min, left.max)}%`, height: `${Math.max(0, h)}%` }}
                    />
                  </button>
                  {on && (
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute z-20 mb-2 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg",
                        n > 2 && i === 0 ? "left-0" : n > 2 && i === n - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                      style={{ bottom: `${Math.max(toPct(d.charge, left.min, left.max), 100 - yPct(d.nbv))}%` }}
                    >
                      <p className="mb-1 font-semibold">
                        {d.label}
                        {forecast(i) ? " · forecast" : ""}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: hueHex("blue") }} />
                        <span className="text-neutral-300">{chargeLabel}</span>
                        <span className="ml-auto pl-3 font-semibold tabular-nums">{format(d.charge)}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: hueHex("coral") }} />
                        <span className="text-neutral-300">{valueLabel}</span>
                        <span className="ml-auto pl-3 font-semibold tabular-nums">{format(d.nbv)}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points={line} fill="none" stroke={hueHex("coral")} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {data.map((d, i) => (
            <span
              key={`dot-${i}`}
              aria-hidden
              className={cx("pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm", active === i && "h-3.5 w-3.5")}
              style={{ left: `${xPct(i)}%`, bottom: `${100 - yPct(d.nbv)}%`, background: hueHex("coral") }}
            />
          ))}
        </div>
        <div className="relative shrink-0 text-[11px] tabular-nums text-coral-700" style={{ width: rgutter }} aria-hidden>
          {right.ticks.map((t) => (
            <span key={t} className="absolute left-2 translate-y-1/2 whitespace-nowrap leading-none" style={{ bottom: `${toPct(t, right.min, right.max)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 grid" style={{ marginLeft: gutter, marginRight: rgutter, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d, i) => (
          <span key={`${d.label}-${i}`} className={cx("truncate px-0.5 text-center text-xs", i === active ? "font-semibold text-neutral-900" : "text-neutral-500")} title={d.label}>
            {d.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginLeft: gutter }}>
        <Legend
          items={[
            { label: `${chargeLabel} (left)`, hue: "blue" },
            ...(marker != null && marker < n ? [{ label: "Forecast charge", hue: "blue" as const, dashed: true }] : []),
            { label: `${valueLabel} (right)`, hue: "coral" },
          ]}
        />
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{chargeLabel}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <th scope="row">
                {d.label}
                {forecast(i) ? " (forecast)" : ""}
              </th>
              <td>{format(d.charge)}</td>
              <td>{format(d.nbv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
