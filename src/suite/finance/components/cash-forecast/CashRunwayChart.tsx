"use client";

import { useState } from "react";
import { cx } from "@/components/workspace/kit";
import { Legend, hueHex } from "@/components/workspace/charts";
import { niceScale, toPct } from "@/components/workspace/charts-math";
import type { ForecastWeek } from "@/lib/api/finance-budgets-client";
import { weekRange } from "./meta";

/*
  The thirteen weeks as a runway. Money in rises above the line and money out
  hangs below it (left axis); the cash left at the end of each week is the
  line across the top (right axis), with the banks' low-balance threshold as a
  dashed rule on the same scale. A week that closes below the threshold, or
  below zero, is washed rose and says so in words. Each week is a button: it
  opens that week's items in the table below.
*/

export function CashRunwayChart({
  weeks,
  threshold,
  format,
  height = 300,
  selected,
  onSelect,
}: {
  weeks: ForecastWeek[];
  threshold: number;
  format: (v: number) => string;
  height?: number;
  selected?: number | null;
  onSelect?: (week: number) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (weeks.length === 0) return <p className="py-10 text-center text-sm text-neutral-500">Nothing to forecast yet.</p>;

  const n = weeks.length;
  const flows = niceScale([...weeks.map((w) => w.inflows), ...weeks.map((w) => -w.outflows)]);
  const cashValues = [...weeks.map((w) => w.closing), weeks[0].opening, ...(threshold > 0 ? [threshold] : [])];
  const cash = niceScale(cashValues, { includeZero: Math.min(...cashValues) < 0 });
  const zero = toPct(0, flows.min, flows.max);
  const gutter = `${(Math.max(1, ...flows.ticks.map((t) => format(t).length)) * 0.62 + 0.75).toFixed(2)}em`;
  const rgutter = `${(Math.max(1, ...cash.ticks.map((t) => format(t).length)) * 0.62 + 0.75).toFixed(2)}em`;
  const xPct = (i: number) => ((i + 0.5) / n) * 100;
  const yCash = (v: number) => 100 - toPct(v, cash.min, cash.max);
  const line = weeks.map((w, i) => `${xPct(i).toFixed(3)},${yCash(w.closing).toFixed(3)}`).join(" ");
  const flag = (w: ForecastWeek) => (w.negative ? "Below zero" : w.low ? "Below threshold" : null);

  return (
    <figure>
      <div className="flex pt-6">
        <div className="relative shrink-0 text-[11px] tabular-nums text-neutral-500" style={{ width: gutter }} aria-hidden>
          {flows.ticks.map((t) => (
            <span key={t} className="absolute right-2 translate-y-1/2 whitespace-nowrap leading-none" style={{ bottom: `${toPct(t, flows.min, flows.max)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label="Thirteen-week cash forecast">
          {flows.ticks.map((t) => (
            <span key={t} aria-hidden className={cx("pointer-events-none absolute inset-x-0 border-t", t === 0 ? "border-neutral-300" : "border-neutral-100")} style={{ bottom: `${toPct(t, flows.min, flows.max)}%` }} />
          ))}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {weeks.map((w, i) => {
              const on = active === i;
              const picked = selected === i;
              const warn = flag(w);
              const inH = toPct(w.inflows, flows.min, flows.max) - zero;
              const outB = toPct(-w.outflows, flows.min, flows.max);
              return (
                <div key={w.week} className="relative px-0.5 sm:px-1" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                  {warn && <span aria-hidden className={cx("absolute inset-y-0 inset-x-0.5 rounded-lg", w.negative ? "bg-rose-100/80" : "bg-rose-50")} />}
                  {picked && <span aria-hidden className="absolute inset-y-0 inset-x-0.5 rounded-lg ring-2 ring-primary-300" />}
                  <button
                    type="button"
                    onClick={() => onSelect?.(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-pressed={onSelect ? picked : undefined}
                    aria-label={`Week ${w.week}, ${weekRange(w.from, w.to)}: in ${format(w.inflows)}, out ${format(w.outflows)}, closing cash ${format(w.closing)}${warn ? `, ${warn.toLowerCase()}` : ""}`}
                    className={cx("absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-400", onSelect ? "cursor-pointer" : "cursor-default")}
                  >
                    <span
                      className={cx("absolute left-1/2 w-[62%] max-w-[26px] -translate-x-1/2 rounded-t-md bg-mint-500 motion-safe:transition-opacity", active != null && !on && "opacity-40")}
                      style={{ bottom: `${zero}%`, height: `${Math.max(0, inH)}%` }}
                    />
                    <span
                      className={cx("absolute left-1/2 w-[62%] max-w-[26px] -translate-x-1/2 rounded-b-md bg-coral-500 motion-safe:transition-opacity", active != null && !on && "opacity-40")}
                      style={{ bottom: `${outB}%`, height: `${Math.max(0, zero - outB)}%` }}
                    />
                  </button>
                  {warn && (
                    <span aria-hidden className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      {w.negative ? "< 0" : "Low"}
                    </span>
                  )}
                  {on && (
                    <div
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute top-2 z-20 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg",
                        i < 2 ? "left-0" : i > n - 3 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                    >
                      <p className="mb-1 font-semibold">
                        Week {w.week} · {weekRange(w.from, w.to)}
                      </p>
                      <Tip hue="mint" label="In" value={format(w.inflows)} />
                      <Tip hue="coral" label="Out" value={format(w.outflows)} />
                      <Tip hue="blue" label="Closing cash" value={format(w.closing)} />
                      {warn && <p className="mt-1 font-semibold text-rose-100">{warn}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {threshold > 0 && (
              <line x1={0} x2={100} y1={yCash(threshold)} y2={yCash(threshold)} stroke={hueHex("rose")} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            )}
            <polyline points={line} fill="none" stroke={hueHex("blue")} strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {weeks.map((w, i) => (
            <span
              key={`dot-${w.week}`}
              aria-hidden
              className={cx("pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm", active === i && "h-3.5 w-3.5")}
              style={{ left: `${xPct(i)}%`, bottom: `${100 - yCash(w.closing)}%`, background: hueHex(w.low || w.negative ? "rose" : "blue") }}
            />
          ))}
        </div>
        <div className="relative shrink-0 text-[11px] tabular-nums text-primary-700" style={{ width: rgutter }} aria-hidden>
          {cash.ticks.map((t) => (
            <span key={t} className="absolute left-2 translate-y-1/2 whitespace-nowrap leading-none" style={{ bottom: `${toPct(t, cash.min, cash.max)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 grid" style={{ marginLeft: gutter, marginRight: rgutter, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
        {weeks.map((w, i) => (
          <span key={w.week} className={cx("truncate px-0.5 text-center text-[11px]", i === active || selected === i ? "font-semibold text-neutral-900" : "text-neutral-500")} title={weekRange(w.from, w.to)}>
            W{w.week}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginLeft: gutter }}>
        <Legend
          items={[
            { label: "Money in (left)", hue: "mint" },
            { label: "Money out (left)", hue: "coral" },
            { label: "Closing cash (right)", hue: "blue" },
            ...(threshold > 0 ? [{ label: "Low-balance threshold", hue: "rose" as const, dashed: true }] : []),
          ]}
        />
      </div>
      <table className="sr-only">
        <caption>Thirteen-week cash forecast by week</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Opening</th>
            <th scope="col">In</th>
            <th scope="col">Out</th>
            <th scope="col">Closing</th>
            <th scope="col">Flag</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week}>
              <th scope="row">
                Week {w.week}, {weekRange(w.from, w.to)}
              </th>
              <td>{format(w.opening)}</td>
              <td>{format(w.inflows)}</td>
              <td>{format(w.outflows)}</td>
              <td>{format(w.closing)}</td>
              <td>{flag(w) ?? "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Tip({ hue, label, value }: { hue: "mint" | "coral" | "blue"; label: string; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: hueHex(hue) }} />
      <span className="text-neutral-300">{label}</span>
      <span className="ml-auto pl-3 font-semibold tabular-nums">{value}</span>
    </p>
  );
}
