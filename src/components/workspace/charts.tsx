"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CornerDownRight } from "lucide-react";
import { cx } from "./kit";
import { HUE, type Hue } from "./modules";
import {
  conversionRates,
  gappedPath,
  heatBucket,
  heatScale,
  niceScale,
  stackCategories,
  toPct,
  waterfallBars,
} from "./charts-math";

/*
  Workspace charts. Hand-drawn SVG, no charting dependency: every chart here
  is simple enough that owning the markup is cheaper than configuring a
  library, and it keeps each one on the workspace's own palette and texture.

  Every chart carries a sentence for screen readers and a visually hidden table
  of its values, because a chart is a picture and a picture is not data.
*/

const HEX: Record<Hue, string> = {
  blue: "#9638CD",
  coral: "#f2674a",
  mint: "#10b981",
  grape: "#8b5cf6",
  sun: "#f59e0b",
  sky: "#0ea5e9",
  rose: "#ec4899",
  slate: "#64748b",
};

export function hueHex(hue: Hue): string {
  return HEX[hue];
}

function SrTable({ caption, rows }: { caption: string; rows: [string, string | number][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented gauge                                                    */
/* ------------------------------------------------------------------ */

/**
 * A half-ring of rounded ticks, filled up to a value — the gauge on the
 * references' "Financial health" and "Repeat rate" cards. Ticks rather than a
 * smooth arc, so a reader can count roughly how far along something is.
 */
export function SegmentedGauge({
  value,
  max = 100,
  hue = "blue",
  label,
  display,
  caption,
  segments = 36,
  size = 220,
}: {
  value: number;
  max?: number;
  hue?: Hue;
  label: string;
  /** The big figure in the middle; defaults to the percentage. */
  display?: React.ReactNode;
  caption?: React.ReactNode;
  segments?: number;
  size?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const lit = Math.round(pct * segments);
  const cx0 = size / 2;
  const cy0 = size / 2;
  const rOuter = size / 2 - 6;
  const rInner = rOuter - size * 0.12;

  const ticks = Array.from({ length: segments }, (_, i) => {
    // From 180° (left) to 360° (right), across the top.
    const a = Math.PI + (Math.PI * (i + 0.5)) / segments;
    return {
      x1: cx0 + rInner * Math.cos(a),
      y1: cy0 + rInner * Math.sin(a),
      x2: cx0 + rOuter * Math.cos(a),
      y2: cy0 + rOuter * Math.sin(a),
      on: i < lit,
    };
  });

  return (
    <figure className="flex flex-col items-center" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`} aria-hidden>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth={Math.max(4, size / 34)}
            strokeLinecap="round"
            stroke={t.on ? HEX[hue] : "#e2e8f0"}
            opacity={t.on ? 0.45 + 0.55 * ((i + 1) / Math.max(1, lit)) : 1}
          />
        ))}
      </svg>
      <div className="-mt-14 text-center">
        <p className="text-[30px] font-bold leading-none tracking-tight text-neutral-900 tabular-nums">
          {display ?? `${Math.round(pct * 100)}%`}
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs text-neutral-500">{caption}</figcaption>}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Column chart with hatched remainder                                */
/* ------------------------------------------------------------------ */

export interface ColumnDatum {
  label: string;
  value: number;
  /** Optional ceiling for this column (capacity, target); drawn hatched. */
  max?: number;
  hue?: Hue;
}

/**
 * Rounded columns that grow out of a hatched capacity bar, the busiest one
 * picked out with its value in a bubble — the "Daily productivity" and "Task
 * progress" cards in the references. Hover or focus any column for its value.
 */
export function ColumnChart({
  data,
  hue = "blue",
  height = 200,
  format = (v: number) => String(v),
  caption,
  highlight = "max",
}: {
  data: ColumnDatum[];
  hue?: Hue;
  height?: number;
  format?: (v: number) => string;
  caption: string;
  /** Which column to call out: the largest, the last, or none. */
  highlight?: "max" | "last" | "none";
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(1, ...data.map((d) => Math.max(d.value, d.max ?? 0)));
  const called =
    highlight === "none"
      ? -1
      : highlight === "last"
        ? data.length - 1
        : data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -Infinity) ? i : best), 0);
  const shown = active ?? called;

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">No data for this period yet.</p>;
  }

  return (
    <figure>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }} role="img" aria-label={caption}>
        {data.map((d, i) => {
          const cap = d.max ?? top;
          const capH = (cap / top) * 100;
          const valH = cap > 0 ? Math.min(100, (d.value / cap) * 100) : 0;
          const on = i === shown;
          const colHue = d.hue ?? hue;
          return (
            <div
              key={d.label}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {on && (
                <span className="absolute z-10 -translate-y-2 rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white tabular-nums shadow-lg" style={{ bottom: `${capH}%` }}>
                  {format(d.value)}
                </span>
              )}
              <button
                type="button"
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${d.label}: ${format(d.value)}`}
                className="ws-hatch relative flex w-full max-w-[44px] cursor-default flex-col justify-end overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                style={{ height: `${capH}%` }}
              >
                <span
                  className={cx("block w-full rounded-xl transition-[height,opacity] duration-500", on ? "" : "opacity-40")}
                  style={{ height: `${valH}%`, background: HEX[colHue] }}
                />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <span
            key={d.label}
            className={cx(
              "flex-1 truncate text-center text-xs",
              i === shown ? "font-semibold text-neutral-900" : "text-neutral-500",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
      <SrTable caption={caption} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut                                                              */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  label: string;
  value: number;
  hue: Hue;
}

/**
 * A ring of rounded segments with a gap between each, and the total in the
 * middle. Legend beside it, never colour alone — each entry names its share.
 */
export function Donut({
  data,
  total,
  centerLabel,
  size = 180,
  caption,
  legend = "right",
  format = (v: number) => String(v),
}: {
  data: DonutSlice[];
  total?: React.ReactNode;
  centerLabel?: string;
  size?: number;
  caption: string;
  legend?: "right" | "below" | "none";
  /** How a slice's value is written in the legend and the hidden table (money, say). */
  format?: (v: number) => string;
}) {
  const sum = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const r = size / 2 - 12;
  const circ = 2 * Math.PI * r;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 6 : 0;
  let offset = 0;

  const ring = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={caption} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {sum > 0 &&
          data.map((d) => {
            if (d.value <= 0) return null;
            const len = (d.value / sum) * circ;
            const dash = Math.max(0.5, len - gap);
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={HEX[d.hue]}
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">{total ?? sum}</span>
        {centerLabel && <span className="text-[11px] font-medium text-neutral-500">{centerLabel}</span>}
      </div>
    </div>
  );

  return (
    <figure className={cx("flex items-center gap-6", legend === "below" && "flex-col")}>
      {ring}
      {legend !== "none" && (
        <ul className={cx("min-w-0 flex-1 space-y-2.5", legend === "below" && "grid w-full grid-cols-2 gap-2 space-y-0")}>
          {data.map((d) => (
            <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HEX[d.hue] }} aria-hidden />
                <span className="truncate text-neutral-600">{d.label}</span>
              </span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {format(d.value)}
                {sum > 0 && (
                  <span className="ml-1 text-xs font-medium text-neutral-500">
                    {Math.round((d.value / sum) * 100)}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <SrTable caption={caption} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked status bars                                                */
/* ------------------------------------------------------------------ */

/**
 * One labelled bar per status, filled to its share of the whole — Panze's
 * invoice overview. Good for five or so categories, where a donut stops being
 * readable.
 */
export function StatusBars({
  data,
  format = (v: number) => String(v),
  caption,
}: {
  data: { label: string; value: number; hue: Hue; note?: string }[];
  format?: (v: number) => string;
  caption: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-neutral-700">{d.label}</span>
            <span className="text-neutral-500 tabular-nums">
              {d.note && <span className="mr-2">{d.note}</span>}
              <span className="font-semibold text-neutral-900">{format(d.value)}</span>
            </span>
          </div>
          <div className="ws-hatch h-3 overflow-hidden rounded-full">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: HEX[d.hue] }} />
          </div>
        </div>
      ))}
      <SrTable caption={caption} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Area line                                                          */
/* ------------------------------------------------------------------ */

export interface LinePoint {
  label: string;
  value: number;
}

/**
 * A smooth line over a soft fill, optionally against a dashed comparison
 * series — "this month" against "last month". Hover for the values.
 */
export function AreaLine({
  data,
  compare,
  hue = "blue",
  height = 180,
  format = (v: number) => String(v),
  caption,
}: {
  data: LinePoint[];
  compare?: LinePoint[];
  hue?: Hue;
  height?: number;
  format?: (v: number) => string;
  caption: string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const all = [...data, ...(compare ?? [])].map((p) => p.value);
  const hi = Math.max(1, ...all);
  const lo = Math.min(0, ...all);
  const x = (i: number, n: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => height - 8 - ((v - lo) / (hi - lo || 1)) * (height - 24);

  const path = useMemo(() => {
    const pts = (series: LinePoint[]) => series.map((p, i) => [x(i, series.length), y(p.value)] as const);
    const smooth = (p: readonly (readonly [number, number])[]) =>
      p.reduce((d, [px, py], i, arr) => {
        if (i === 0) return `M${px},${py}`;
        const [qx, qy] = arr[i - 1];
        const mx = (qx + px) / 2;
        return `${d} C${mx},${qy} ${mx},${py} ${px},${py}`;
      }, "");
    const main = pts(data);
    return {
      line: smooth(main),
      area: main.length ? `${smooth(main)} L${main[main.length - 1][0]},${height} L${main[0][0]},${height} Z` : "",
      compare: compare ? smooth(pts(compare)) : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, compare, height, hi, lo]);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-500">No data for this period yet.</p>;
  }

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-auto w-full"
          style={{ height }}
          role="img"
          aria-label={caption}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - box.left) / box.width) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={HEX[hue]} stopOpacity="0.22" />
              <stop offset="100%" stopColor={HEX[hue]} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="#eef2f7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path.area} fill={`url(#fill-${id})`} />
          {path.compare && (
            <path d={path.compare} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          )}
          <path d={path.line} fill="none" stroke={HEX[hue]} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {hover != null && (
            <line x1={x(hover, data.length)} x2={x(hover, data.length)} y1="0" y2={height} stroke="#cbd5e1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${(x(hover, data.length) / width) * 100}%` }}
          >
            <p className="font-semibold text-neutral-900">{data[hover].label}</p>
            <p className="tabular-nums text-neutral-700">{format(data[hover].value)}</p>
            {compare?.[hover] && <p className="tabular-nums text-neutral-500">vs {format(compare[hover].value)}</p>}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-500">
        {data
          .filter((_, i) => data.length <= 8 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1)
          .map((p) => (
            <span key={p.label}>{p.label}</span>
          ))}
      </div>
      <SrTable caption={caption} rows={data.map((p) => [p.label, format(p.value)])} />
    </figure>
  );
}

/** A little key for a chart: coloured dots with names. */
export function Legend({ items }: { items: { label: string; hue: Hue; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="h-0 w-4 border-t-2 border-dashed border-neutral-400" aria-hidden />
          ) : (
            <span className={cx("h-2.5 w-2.5 rounded-full", HUE[it.hue].dot)} aria-hidden />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== */
/*  Multi-series primitives                                            */
/*                                                                    */
/*  Column-family charts are drawn as positioned boxes (like           */
/*  ColumnChart) so corners stay round at any width; lines are SVG on  */
/*  a stretched viewBox (like AreaLine). All geometry comes from       */
/*  charts-math.ts. Each one: a y-axis of 3–5 round ticks, a zero      */
/*  baseline, a legend, a hidden table, a focusable mark per category  */
/*  with a value bubble, and an empty state.                           */
/* ================================================================== */

export interface SeriesDef {
  key: string;
  label: string;
  hue: Hue;
  /** Planned / projected: drawn as an outlined, dashed box. */
  dashed?: boolean;
}

export interface CategoryDatum {
  label: string;
  values: Record<string, number>;
}

const defaultFormat = (v: number) => String(v);
const pctText = (f: number) => `${Math.round(f * 100)}%`;
const signed = (v: number, format: (v: number) => string) =>
  v > 0 ? `+${format(v)}` : v < 0 ? `−${format(Math.abs(v))}` : format(0);

function EmptyChart() {
  return <p className="py-10 text-center text-sm text-neutral-500">No data for this period yet.</p>;
}

/** A visually hidden table with a header row — the data behind a multi-series chart. */
function SrMatrix({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h, k) => (
            <th key={k} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((c, k) =>
              k === 0 ? (
                <th key={k} scope="row">
                  {c}
                </th>
              ) : (
                <td key={k}>{c}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Fill for a mark: solid, or an outlined wash for a dashed (planned) series. */
function markFill(hue: Hue, dashed?: boolean): React.CSSProperties {
  return dashed
    ? { background: `color-mix(in oklab, ${HEX[hue]} 20%, transparent)`, border: `2px dashed ${HEX[hue]}` }
    : { background: HEX[hue] };
}

/** Width of the y-axis gutter, from its longest label. */
function axisWidth(labels: string[]): string {
  const longest = Math.max(1, ...labels.map((l) => l.length));
  return `${(longest * 0.62 + 0.75).toFixed(2)}em`;
}

/** Tick labels down the left of a plot. */
function YAxis({ ticks, min, max, format, width }: { ticks: number[]; min: number; max: number; format: (v: number) => string; width: string }) {
  return (
    <div className="relative shrink-0 text-[11px] text-neutral-500 tabular-nums" style={{ width }} aria-hidden>
      {ticks.map((t) => (
        <span key={t} className="absolute right-2 translate-y-1/2 whitespace-nowrap leading-none" style={{ bottom: `${toPct(t, min, max)}%` }}>
          {format(t)}
        </span>
      ))}
    </div>
  );
}

/** Gridlines across a plot, the zero line drawn firmer. */
function Gridlines({ ticks, min, max }: { ticks: number[]; min: number; max: number }) {
  return (
    <>
      {ticks.map((t) => (
        <span
          key={t}
          aria-hidden
          className={cx("pointer-events-none absolute inset-x-0 border-t", t === 0 ? "border-neutral-300" : "border-neutral-100")}
          style={{ bottom: `${toPct(t, min, max)}%` }}
        />
      ))}
    </>
  );
}

/** The dark value bubble, kept inside the plot at the first and last columns. */
function Bubble({ children, bottom, edge }: { children: React.ReactNode; bottom: string; edge: "start" | "mid" | "end" }) {
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute z-20 mb-2 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg",
        edge === "start" ? "left-0" : edge === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
      )}
      style={{ bottom }}
    >
      {children}
    </div>
  );
}

function BubbleRow({ hue, label, value, dashed }: { hue: Hue; label: string; value: string; dashed?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={dashed ? { border: `1.5px dashed ${HEX[hue]}` } : { background: HEX[hue] }} />
      <span className="text-neutral-300">{label}</span>
      <span className="ml-auto pl-3 font-semibold tabular-nums">{value}</span>
    </p>
  );
}

const edgeOf = (i: number, n: number): "start" | "mid" | "end" => (n > 2 && i === 0 ? "start" : n > 2 && i === n - 1 ? "end" : "mid");

const MARK_BUTTON =
  "absolute inset-y-0 left-1/2 w-full -translate-x-1/2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2";

/** The category labels under a column-family chart, on the same grid as the columns. */
function XLabels({ labels, active, gutter }: { labels: string[]; active: number | null; gutter: string }) {
  return (
    <div className="mt-2 grid" style={{ marginLeft: gutter, gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-hidden>
      {labels.map((l, i) => (
        <span key={`${l}-${i}`} className={cx("truncate px-0.5 text-center text-xs", i === active ? "font-semibold text-neutral-900" : "text-neutral-500")} title={l}>
          {l}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked columns                                                    */
/* ------------------------------------------------------------------ */

/**
 * One column per category, its series stacked — positives up from the zero
 * line, negatives down from it. Focus or hover a column for every value in
 * it; `showTotals` writes the net total over each column.
 */
export function StackedColumns({
  data,
  series,
  height = 220,
  format = defaultFormat,
  caption,
  showTotals = false,
  onSelect,
}: {
  data: CategoryDatum[];
  series: SeriesDef[];
  height?: number;
  format?: (v: number) => string;
  caption: string;
  showTotals?: boolean;
  onSelect?: (label: string) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0 || series.length === 0) return <EmptyChart />;

  const stacks = stackCategories(data, series.map((s) => s.key));
  const { min, max, ticks } = niceScale(stacks.flatMap((c) => [c.positive, c.negative]));
  const gutter = axisWidth(ticks.map(format));
  const defOf = new Map(series.map((s) => [s.key, s]));
  const span = max - min || 1;
  const n = stacks.length;
  const val = (i: number, key: string) => format(data[i].values[key] ?? 0);

  return (
    <figure>
      <div className={cx("flex", showTotals && "pt-5")}>
        <YAxis ticks={ticks} min={min} max={max} format={format} width={gutter} />
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label={caption}>
          <Gridlines ticks={ticks} min={min} max={max} />
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {stacks.map((c, i) => {
              const on = active === i;
              const top = toPct(c.positive, min, max);
              const bottom = toPct(c.negative, min, max);
              const above = c.positive > 0 || c.negative === 0;
              return (
                <div
                  key={`${c.label}-${i}`}
                  className="relative px-1 sm:px-1.5"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <button
                    type="button"
                    className={cx(MARK_BUTTON, "max-w-[44px]", onSelect ? "cursor-pointer" : "cursor-default")}
                    aria-label={`${c.label}: ${series.map((s) => `${s.label} ${val(i, s.key)}`).join(", ")}; total ${format(c.total)}`}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={onSelect ? () => onSelect(c.label) : undefined}
                  >
                    {c.segments.map((seg) => {
                      const s = defOf.get(seg.key) as SeriesDef;
                      return (
                        <span
                          key={seg.key}
                          className={cx(
                            "absolute inset-x-0 rounded-md ring-2 ring-white motion-safe:transition-opacity motion-safe:duration-200",
                            active != null && !on && "opacity-40",
                          )}
                          style={{
                            ...markFill(s.hue, s.dashed),
                            bottom: `${toPct(Math.min(seg.from, seg.to), min, max)}%`,
                            height: `${(Math.abs(seg.value) / span) * 100}%`,
                          }}
                        />
                      );
                    })}
                  </button>
                  {showTotals && !on && (
                    <span
                      aria-hidden
                      className={cx(
                        "pointer-events-none absolute inset-x-0 truncate text-center text-[11px] font-semibold text-neutral-700 tabular-nums",
                        above ? "mb-1" : "-mb-5",
                      )}
                      style={{ bottom: `${above ? top : bottom}%` }}
                    >
                      {format(c.total)}
                    </span>
                  )}
                  {on && (
                    <Bubble bottom={`${top}%`} edge={edgeOf(i, n)}>
                      <p className="mb-1 font-semibold">{c.label}</p>
                      {series.map((s) => (
                        <BubbleRow key={s.key} hue={s.hue} dashed={s.dashed} label={s.label} value={val(i, s.key)} />
                      ))}
                      <p className="mt-1 flex justify-between gap-3 border-t border-white/15 pt-1 font-semibold tabular-nums">
                        <span className="text-neutral-300">Total</span>
                        {format(c.total)}
                      </p>
                    </Bubble>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <XLabels labels={stacks.map((c) => c.label)} active={active} gutter={gutter} />
      <div className="mt-3" style={{ marginLeft: gutter }}>
        <Legend items={series} />
      </div>
      <SrMatrix
        caption={caption}
        head={["Category", ...series.map((s) => s.label), "Total"]}
        rows={stacks.map((c, i) => [c.label, ...series.map((s) => val(i, s.key)), format(c.total)])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Grouped columns                                                    */
/* ------------------------------------------------------------------ */

/**
 * Side-by-side columns per category — this year against last, plan against
 * actual. Negatives hang below the zero line. Focus a group for its values.
 */
export function GroupedColumns({
  data,
  series,
  height = 220,
  format = defaultFormat,
  caption,
}: {
  data: CategoryDatum[];
  series: SeriesDef[];
  height?: number;
  format?: (v: number) => string;
  caption: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0 || series.length === 0) return <EmptyChart />;

  const value = (d: CategoryDatum, key: string) => {
    const v = d.values[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  const { min, max, ticks } = niceScale(data.flatMap((d) => series.map((s) => value(d, s.key))));
  const gutter = axisWidth(ticks.map(format));
  const n = data.length;
  const groupMax = series.length * 18 + (series.length - 1) * 3;

  return (
    <figure>
      <div className="flex">
        <YAxis ticks={ticks} min={min} max={max} format={format} width={gutter} />
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label={caption}>
          <Gridlines ticks={ticks} min={min} max={max} />
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {data.map((d, i) => {
              const on = active === i;
              const peak = Math.max(0, ...series.map((s) => value(d, s.key)));
              return (
                <div
                  key={`${d.label}-${i}`}
                  className="relative px-1 sm:px-2"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <button
                    type="button"
                    className={cx(MARK_BUTTON, "flex cursor-default gap-[3px]")}
                    style={{ maxWidth: groupMax }}
                    aria-label={`${d.label}: ${series.map((s) => `${s.label} ${format(value(d, s.key))}`).join(", ")}`}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    {series.map((s) => {
                      const v = value(d, s.key);
                      const lo = toPct(Math.min(0, v), min, max);
                      const hi = toPct(Math.max(0, v), min, max);
                      return (
                        <span key={s.key} className="relative h-full min-w-0 flex-1">
                          <span
                            className={cx(
                              "absolute inset-x-0 motion-safe:transition-opacity motion-safe:duration-200",
                              v >= 0 ? "rounded-t-md" : "rounded-b-md",
                              active != null && !on && "opacity-40",
                            )}
                            style={{ ...markFill(s.hue, s.dashed), bottom: `${lo}%`, height: `${hi - lo}%` }}
                          />
                        </span>
                      );
                    })}
                  </button>
                  {on && (
                    <Bubble bottom={`${toPct(peak, min, max)}%`} edge={edgeOf(i, n)}>
                      <p className="mb-1 font-semibold">{d.label}</p>
                      {series.map((s) => (
                        <BubbleRow key={s.key} hue={s.hue} dashed={s.dashed} label={s.label} value={format(value(d, s.key))} />
                      ))}
                    </Bubble>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <XLabels labels={data.map((d) => d.label)} active={active} gutter={gutter} />
      <div className="mt-3" style={{ marginLeft: gutter }}>
        <Legend items={series} />
      </div>
      <SrMatrix
        caption={caption}
        head={["Category", ...series.map((s) => s.label)]}
        rows={data.map((d) => [d.label, ...series.map((s) => format(value(d, s.key)))])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Waterfall                                                          */
/* ------------------------------------------------------------------ */

export interface WaterfallStep {
  label: string;
  value: number;
  /**
   * `delta` (default) floats from the running total. `total` stands on zero
   * at its own value and resets the running total — opening balance, subtotal.
   */
  kind?: "delta" | "total";
}

/**
 * How a figure got from one total to another: each change floats from where
 * the last left off, joined by a dashed step line. Rises, falls and totals
 * differ by colour *and* by their signed labels and the legend.
 */
export function Waterfall({
  steps,
  height = 220,
  format = defaultFormat,
  caption,
  upHue = "mint",
  downHue = "rose",
  totalHue = "blue",
}: {
  steps: WaterfallStep[];
  height?: number;
  format?: (v: number) => string;
  caption: string;
  upHue?: Hue;
  downHue?: Hue;
  totalHue?: Hue;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (steps.length === 0) return <EmptyChart />;

  const bars = waterfallBars(steps);
  const { min, max, ticks } = niceScale(bars.flatMap((b) => [b.from, b.to]));
  const gutter = axisWidth(ticks.map(format));
  const n = bars.length;
  const labelled = n <= 12;
  type Bar = (typeof bars)[number];
  const hueFor = (b: Bar) => (b.kind === "total" ? totalHue : b.value >= 0 ? upHue : downHue);
  const change = (b: Bar) => (b.kind === "total" ? `Total ${format(b.value)}` : signed(b.value, format));
  const describe = (b: Bar) =>
    b.kind === "total" ? `total ${format(b.value)}` : `${b.value >= 0 ? "up" : "down"} ${format(Math.abs(b.value))}, running total ${format(b.running)}`;

  return (
    <figure>
      <div className={cx("flex", labelled && "pt-5")}>
        <YAxis ticks={ticks} min={min} max={max} format={format} width={gutter} />
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label={caption}>
          <Gridlines ticks={ticks} min={min} max={max} />
          {bars.slice(0, -1).map((b, i) => (
            <span
              key={`join-${i}`}
              aria-hidden
              className="pointer-events-none absolute border-t border-dashed border-neutral-400"
              style={{ left: `${((i + 0.5) / n) * 100}%`, width: `${100 / n}%`, bottom: `${toPct(b.running, min, max)}%` }}
            />
          ))}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {bars.map((b, i) => {
              const on = active === i;
              const lo = toPct(Math.min(b.from, b.to), min, max);
              const hi = toPct(Math.max(b.from, b.to), min, max);
              return (
                <div
                  key={`${b.label}-${i}`}
                  className="relative px-1 sm:px-1.5"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <button
                    type="button"
                    className={cx(MARK_BUTTON, "max-w-[44px] cursor-default")}
                    aria-label={`${b.label}: ${describe(b)}`}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  >
                    <span
                      className={cx("absolute inset-x-0 rounded-md motion-safe:transition-opacity motion-safe:duration-200", active != null && !on && "opacity-40")}
                      style={{ background: HEX[hueFor(b)], bottom: `${lo}%`, height: `max(2px, ${hi - lo}%)` }}
                    />
                  </button>
                  {labelled && !on && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 mb-1 truncate text-center text-[11px] font-semibold text-neutral-700 tabular-nums"
                      style={{ bottom: `${hi}%` }}
                    >
                      {b.kind === "total" ? format(b.value) : signed(b.value, format)}
                    </span>
                  )}
                  {on && (
                    <Bubble bottom={`${hi}%`} edge={edgeOf(i, n)}>
                      <p className="font-semibold">{b.label}</p>
                      <p className="tabular-nums">{change(b)}</p>
                      {b.kind !== "total" && <p className="text-neutral-300 tabular-nums">Running total {format(b.running)}</p>}
                    </Bubble>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <XLabels labels={bars.map((b) => b.label)} active={active} gutter={gutter} />
      <div className="mt-3" style={{ marginLeft: gutter }}>
        <Legend
          items={[
            { label: "Increase", hue: upHue },
            { label: "Decrease", hue: downHue },
            { label: "Total", hue: totalHue },
          ]}
        />
      </div>
      <SrMatrix caption={caption} head={["Step", "Change", "Running total"]} rows={bars.map((b) => [b.label, change(b), format(b.running)])} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Multi-line                                                         */
/* ------------------------------------------------------------------ */

export interface LineSeries {
  key: string;
  label: string;
  hue: Hue;
  /** One per label; `null` leaves a gap in the line. */
  values: (number | null)[];
  dashed?: boolean;
  /** A soft fill under the line. */
  area?: boolean;
}

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * Several series against one axis — planned value, earned value and actual
 * cost on an S-curve, say. `null` breaks a line rather than dragging it to
 * zero. A `marker` ("Today") draws a rule, and everything after it is
 * hatched: the part of the chart that has not happened yet. One tab stop;
 * arrow keys move between points.
 */
export function MultiLine({
  labels,
  series,
  height = 220,
  format = defaultFormat,
  caption,
  marker,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  format?: (v: number) => string;
  caption: string;
  marker?: { index: number; label: string };
}) {
  const uid = safeId(useId());
  const [active, setActive] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = labels.length;
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (n === 0 || !series.some((s) => s.values.slice(0, n).some(isNum))) return <EmptyChart />;

  const W = 600;
  const { min, max, ticks } = niceScale(series.flatMap((s) => s.values.slice(0, n)));
  const gutter = axisWidth(ticks.map(format));
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const xp = (i: number) => (x(i) / W) * 100;
  const y = (v: number) => height - (toPct(v, min, max) / 100) * height;
  const baseY = y(Math.max(min, Math.min(max, 0)));
  const paths = series.map((s) => ({ s, g: gappedPath(s.values.slice(0, n), x, y, baseY), grad: `ml-${uid}-${safeId(s.key)}` }));
  const strip = n <= 1 ? 100 : 100 / (n - 1);
  const focusIndex = active ?? 0;
  const markerAt = marker && marker.index >= 0 && marker.index < n ? xp(marker.index) : null;
  const valueText = (v: number | null | undefined) => (isNum(v) ? format(v) : "no data");
  const shownLabel = (i: number) => n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;

  const move = (to: number) => {
    const k = Math.max(0, Math.min(n - 1, to));
    setActive(k);
    refs.current[k]?.focus();
  };

  return (
    <figure>
      <div className={cx("flex", markerAt != null && "pt-3")}>
        <YAxis ticks={ticks} min={min} max={max} format={format} width={gutter} />
        <div className="relative min-w-0 flex-1" style={{ height }} role="group" aria-label={caption}>
          {markerAt != null && (
            <span aria-hidden className="ws-hatch pointer-events-none absolute inset-y-0 right-0 rounded-r-lg opacity-70" style={{ left: `${markerAt}%` }} />
          )}
          <Gridlines ticks={ticks} min={min} max={max} />
          <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <defs>
              {paths.map(({ s, grad }) =>
                s.area ? (
                  <linearGradient key={s.key} id={grad} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={HEX[s.hue]} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={HEX[s.hue]} stopOpacity="0" />
                  </linearGradient>
                ) : null,
              )}
            </defs>
            {paths.map(({ s, g, grad }) => (s.area ? g.areas.map((d, k) => <path key={`${s.key}-a${k}`} d={d} fill={`url(#${grad})`} />) : null))}
            {paths.map(({ s, g }) =>
              g.line ? (
                <path
                  key={s.key}
                  d={g.line}
                  fill="none"
                  stroke={HEX[s.hue]}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? "6 5" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
            {active != null && (
              <line x1={x(active)} x2={x(active)} y1="0" y2={height} stroke="currentColor" className="text-neutral-300" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {markerAt != null && (
            <>
              <span aria-hidden className="pointer-events-none absolute inset-y-0 border-l-2 border-neutral-700" style={{ left: `${markerAt}%` }} />
              <span
                aria-hidden
                className={cx(
                  "pointer-events-none absolute -top-3 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white",
                  markerAt > 85 ? "-translate-x-full" : markerAt < 15 ? "" : "-translate-x-1/2",
                )}
                style={{ left: `${markerAt}%` }}
              >
                {marker?.label}
              </span>
            </>
          )}
          {/* Lone points between gaps, and the hover dots: HTML, so they stay round. */}
          {paths.flatMap(({ s, g }) =>
            g.isolated.map((p) => (
              <span
                key={`${s.key}-iso-${p.i}`}
                aria-hidden
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full"
                style={{ left: `${xp(p.i)}%`, bottom: `${toPct(s.values[p.i] as number, min, max)}%`, background: HEX[s.hue] }}
              />
            )),
          )}
          {active != null &&
            series.map((s) => {
              const v = s.values[active];
              if (!isNum(v)) return null;
              return (
                <span
                  key={`${s.key}-dot`}
                  aria-hidden
                  className="pointer-events-none absolute z-10 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${xp(active)}%`, bottom: `${toPct(v, min, max)}%`, background: HEX[s.hue] }}
                />
              );
            })}
          {labels.map((l, i) => {
            const left = Math.max(0, xp(i) - strip / 2);
            const right = Math.min(100, xp(i) + strip / 2);
            return (
              <button
                key={`${l}-${i}`}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                tabIndex={i === focusIndex ? 0 : -1}
                className="absolute inset-y-0 cursor-default rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
                style={{ left: `${left}%`, width: `${right - left}%` }}
                aria-label={`${l}: ${series.map((s) => `${s.label} ${valueText(s.values[i])}`).join(", ")}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => {
                  const to =
                    e.key === "ArrowRight" || e.key === "ArrowDown"
                      ? i + 1
                      : e.key === "ArrowLeft" || e.key === "ArrowUp"
                        ? i - 1
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? n - 1
                            : null;
                  if (to == null) return;
                  e.preventDefault();
                  move(to);
                }}
              />
            );
          })}
          {active != null && (
            <div
              aria-hidden
              className={cx(
                "pointer-events-none absolute top-3 z-20 whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg",
                xp(active) > 60 ? "-ml-3 -translate-x-full" : "ml-3",
              )}
              style={{ left: `${xp(active)}%` }}
            >
              <p className="mb-1 font-semibold">{labels[active]}</p>
              {series.map((s) => (
                <BubbleRow key={s.key} hue={s.hue} dashed={s.dashed} label={s.label} value={valueText(s.values[active])} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="relative mt-2 h-4 text-xs text-neutral-500" style={{ marginLeft: gutter }} aria-hidden>
        {labels.map((l, i) =>
          shownLabel(i) ? (
            <span
              key={`${l}-${i}`}
              className={cx(
                "absolute whitespace-nowrap",
                i === active && "font-semibold text-neutral-900",
                n > 1 && i === 0 ? "" : n > 1 && i === n - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${xp(i)}%` }}
            >
              {l}
            </span>
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5" style={{ marginLeft: gutter }}>
        <Legend items={series} />
        {markerAt != null && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span aria-hidden className="ws-hatch h-2.5 w-4 rounded-sm" />
            After {marker?.label.toLowerCase()}
          </span>
        )}
      </div>
      <SrMatrix
        caption={marker && markerAt != null ? `${caption} (${marker.label}: ${labels[marker.index]})` : caption}
        head={["Point", ...series.map((s) => s.label)]}
        rows={labels.map((l, i) => [l, ...series.map((s) => valueText(s.values[i]))])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline                                                          */
/* ------------------------------------------------------------------ */

/**
 * A word-sized trend for a table cell or stat card. Not interactive: its
 * label and last value are its accessible name, and `showLast` puts the
 * same figure beside it in text.
 */
export function Sparkline({
  values,
  hue = "blue",
  width = 96,
  height = 28,
  label,
  baseline,
  showLast = false,
  format = defaultFormat,
}: {
  values: number[];
  hue?: Hue;
  width?: number;
  height?: number;
  label: string;
  /** A reference level (target, zero), drawn as a dashed rule. */
  baseline?: number;
  showLast?: boolean;
  format?: (v: number) => string;
}) {
  const vs = values.filter((v) => Number.isFinite(v));
  if (vs.length === 0) {
    return (
      <span role="img" aria-label={`${label}: no data`} className="inline-block text-xs text-neutral-500">
        -
      </span>
    );
  }
  const pad = 3;
  const all = baseline != null && Number.isFinite(baseline) ? [...vs, baseline] : vs;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const y = (v: number) => pad + (1 - (hi === lo ? 0.5 : (v - lo) / (hi - lo))) * (height - pad * 2);
  const x = (i: number) => (vs.length <= 1 ? width / 2 : pad + (i / (vs.length - 1)) * (width - pad * 2));
  const g = gappedPath(vs, x, y, height);
  const last = vs[vs.length - 1];

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${format(last)}`} className="shrink-0 overflow-visible">
        {baseline != null && Number.isFinite(baseline) && (
          <line x1={0} x2={width} y1={y(baseline)} y2={y(baseline)} stroke="currentColor" className="text-neutral-300" strokeDasharray="3 3" />
        )}
        {g.line && <path d={g.line} fill="none" stroke={HEX[hue]} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
        {(showLast || vs.length === 1) && <circle cx={x(vs.length - 1)} cy={y(last)} r={2.5} fill={HEX[hue]} />}
      </svg>
      {showLast && (
        <span aria-hidden className="text-xs font-semibold text-neutral-900 tabular-nums">
          {format(last)}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Heatmap                                                            */
/* ------------------------------------------------------------------ */

export interface HeatCell {
  row: string;
  col: string;
  /** `null` (or no cell at all) is "no data", drawn hatched. */
  value: number | null;
}

/** How much of the hue each of the five steps mixes into white. */
const HEAT_MIX = [10, 26, 44, 64, 85];

/**
 * Rows × columns of tinted cells, five steps deep, each carrying its figure.
 * Missing cells are hatched, never pale — "no data" is not "low". One tab
 * stop; arrow keys walk the grid, and the line underneath reads out the cell.
 */
export function Heatmap({
  rows,
  cols,
  cells,
  hue = "blue",
  format = defaultFormat,
  caption,
  onSelect,
}: {
  rows: string[];
  cols: string[];
  cells: HeatCell[];
  hue?: Hue;
  format?: (v: number) => string;
  caption: string;
  onSelect?: (c: HeatCell) => void;
}) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());
  if (rows.length === 0 || cols.length === 0) return <EmptyChart />;

  const key = (r: string, c: string) => `${r}\u0000${c}`;
  const byKey = new Map(cells.map((c) => [key(c.row, c.col), c]));
  const cellAt = (r: number, c: number): HeatCell => byKey.get(key(rows[r], cols[c])) ?? { row: rows[r], col: cols[c], value: null };
  const all = rows.flatMap((_, r) => cols.map((__, c) => cellAt(r, c).value));
  const scale = heatScale(all, HEAT_MIX.length);
  const anyValue = all.some((v) => v != null);
  const anyNull = all.some((v) => v == null);
  const tab = active ?? { r: 0, c: 0 };
  const describe = (cell: HeatCell) => `${cell.row}, ${cell.col}: ${cell.value == null ? "no data" : format(cell.value)}`;
  const fill = (b: number): React.CSSProperties => ({ background: `color-mix(in oklab, ${HEX[hue]} ${HEAT_MIX[b]}%, white)` });
  const ARROWS: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(rows.length - 1, r));
    const nc = Math.max(0, Math.min(cols.length - 1, c));
    setActive({ r: nr, c: nc });
    refs.current.get(`${nr}:${nc}`)?.focus();
  };

  return (
    <figure>
      <div className="overflow-x-auto p-1">
        <div
          role="group"
          aria-label={caption}
          className="grid min-w-max gap-1"
          style={{ gridTemplateColumns: `minmax(4.5rem, max-content) repeat(${cols.length}, minmax(2.75rem, 1fr))` }}
        >
          <span aria-hidden />
          {cols.map((c, k) => (
            <span
              key={`h-${c}-${k}`}
              aria-hidden
              className={cx("truncate px-0.5 text-center text-[11px]", active?.c === k ? "font-semibold text-neutral-900" : "text-neutral-500")}
              title={c}
            >
              {c}
            </span>
          ))}
          {rows.map((row, r) => (
            <div key={`r-${row}-${r}`} className="contents">
              <span
                aria-hidden
                className={cx("flex items-center truncate pr-2 text-xs", active?.r === r ? "font-semibold text-neutral-900" : "text-neutral-600")}
                title={row}
              >
                {row}
              </span>
              {cols.map((col, c) => {
                const cell = cellAt(r, c);
                const b = heatBucket(cell.value, scale);
                return (
                  <button
                    key={`${row}-${col}-${c}`}
                    ref={(el) => {
                      if (el) refs.current.set(`${r}:${c}`, el);
                      else refs.current.delete(`${r}:${c}`);
                    }}
                    type="button"
                    tabIndex={tab.r === r && tab.c === c ? 0 : -1}
                    aria-label={describe(cell)}
                    data-bucket={b}
                    className={cx(
                      "flex h-9 min-w-0 items-center justify-center rounded-md px-0.5 text-[11px] tabular-nums outline-none",
                      "focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1",
                      b < 0 ? "ws-hatch font-medium text-neutral-500" : "font-semibold text-neutral-900",
                      onSelect ? "cursor-pointer hover:ring-2 hover:ring-neutral-300" : "cursor-default",
                    )}
                    style={b < 0 ? undefined : fill(b)}
                    onMouseEnter={() => setActive({ r, c })}
                    onFocus={() => setActive({ r, c })}
                    onClick={onSelect ? () => onSelect(cell) : undefined}
                    onKeyDown={(e) => {
                      const d = ARROWS[e.key];
                      const to: [number, number] | null = d ? [r + d[0], c + d[1]] : e.key === "Home" ? [r, 0] : e.key === "End" ? [r, cols.length - 1] : null;
                      if (!to) return;
                      e.preventDefault();
                      move(to[0], to[1]);
                    }}
                  >
                    <span className="truncate" aria-hidden>
                      {cell.value == null ? "-" : format(cell.value)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 min-h-[1.25rem] text-xs text-neutral-600 tabular-nums" aria-hidden>
        {active ? describe(cellAt(active.r, active.c)) : " "}
      </p>
      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-600 tabular-nums" aria-label="Colour scale">
        {anyValue &&
          HEAT_MIX.map((_, b) => (
            <li key={b} className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-5 rounded-sm" style={fill(b)} />
              {format(scale.edges[b])} to {format(scale.edges[b + 1])}
            </li>
          ))}
        {anyNull && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="ws-hatch h-3 w-5 rounded-sm" />
            No data
          </li>
        )}
      </ul>
      <SrMatrix
        caption={caption}
        head={["", ...cols]}
        rows={rows.map((row, r) => [
          row,
          ...cols.map((_, c) => {
            const v = cellAt(r, c).value;
            return v == null ? "No data" : format(v);
          }),
        ])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnel                                                             */
/* ------------------------------------------------------------------ */

export interface FunnelStage {
  label: string;
  value: number;
  hue?: Hue;
}

/**
 * Stages narrowing from the first — applicants to hires, leads to wins. Each
 * bar is centred in a hatched track as wide as the largest stage, so the
 * hatch is exactly who dropped out. Every stage carries its figure and its
 * share of the first; `showConversion` adds the step-to-step rate.
 */
export function Funnel({
  stages,
  format = defaultFormat,
  caption,
  showConversion = true,
}: {
  stages: FunnelStage[];
  format?: (v: number) => string;
  caption: string;
  showConversion?: boolean;
}) {
  if (stages.length === 0) return <EmptyChart />;
  const values = stages.map((s) => Math.max(0, Number.isFinite(s.value) ? s.value : 0));
  const top = Math.max(...values);
  const first = values[0];
  const rates = conversionRates(values);
  const ofFirst = (v: number) => (first > 0 ? pctText(v / first) : "-");

  return (
    <figure>
      <ol className="space-y-1" aria-label={caption}>
        {stages.map((s, k) => {
          const v = values[k];
          const rate = rates[k];
          return (
            <li key={`${s.label}-${k}`}>
              {showConversion && k > 0 && (
                <p className="flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-neutral-500 tabular-nums">
                  <CornerDownRight size={12} aria-hidden />
                  {rate == null ? `None to convert from ${stages[k - 1].label}` : `${pctText(rate)} of ${stages[k - 1].label}`}
                </p>
              )}
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-neutral-700">{s.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-neutral-900">{format(v)}</span>
                  {k > 0 && <span className="ml-1.5 text-xs font-medium text-neutral-500">{ofFirst(v)}</span>}
                </span>
              </div>
              <div className="ws-hatch flex h-7 justify-center overflow-hidden rounded-lg">
                <div className="h-full rounded-lg" style={{ width: `${top > 0 ? (v / top) * 100 : 0}%`, background: HEX[s.hue ?? "blue"] }} />
              </div>
            </li>
          );
        })}
      </ol>
      <SrMatrix
        caption={caption}
        head={["Stage", "Count", "Share of first stage", "Share of previous stage"]}
        rows={stages.map((s, k) => [s.label, format(values[k]), ofFirst(values[k]), rates[k] == null ? "-" : pctText(rates[k] as number)])}
      />
    </figure>
  );
}
