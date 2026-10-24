/*
  Pure geometry for the workspace charts. No React, no DOM: every function
  here takes numbers and returns numbers (or path strings), so the charts in
  charts.tsx stay about markup and these stay testable on their own.

  Conventions: values live in "value space"; a chart turns them into percent
  of its plot box with `toPct`, measured from the bottom (or the left).
*/

/* ------------------------------------------------------------------ */
/*  Scales and ticks                                                   */
/* ------------------------------------------------------------------ */

export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

const finite = (vs: readonly (number | null | undefined)[]) =>
  vs.filter((v): v is number => typeof v === "number" && Number.isFinite(v));

/** Strip float noise (0.1 + 0.2) from a computed tick. */
const clean = (v: number) => {
  const r = Number(v.toPrecision(12));
  return Object.is(r, -0) ? 0 : r;
};

/** The smallest 1 / 2 / 2.5 / 5 × 10ⁿ step that covers `range` in `count` intervals. */
export function niceStep(range: number, count: number): number {
  if (!(range > 0) || !(count > 0)) return 1;
  const raw = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/**
 * A rounded axis that covers every value, 3 to 5 ticks on round numbers.
 * Zero is always inside the domain unless `includeZero` is false, so bars
 * have a baseline and negatives hang below it.
 */
export function niceScale(
  values: readonly (number | null | undefined)[],
  { includeZero = true }: { includeZero?: boolean } = {},
): NiceScale {
  const vs = finite(values);
  let lo = vs.length ? Math.min(...vs) : 0;
  let hi = vs.length ? Math.max(...vs) : 0;
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    if (lo === 0) hi = 1;
    else if (lo > 0) {
      lo = includeZero ? 0 : lo - Math.abs(lo) * 0.5;
      hi = hi + Math.abs(hi) * (includeZero ? 0 : 0.5);
    } else {
      hi = includeZero ? 0 : hi + Math.abs(hi) * 0.5;
      lo = lo - Math.abs(lo) * (includeZero ? 0 : 0.5);
    }
  }

  for (const target of [4, 3, 2]) {
    const step = niceStep(hi - lo, target);
    const min = clean(Math.floor(lo / step) * step);
    const max = clean(Math.ceil(hi / step) * step);
    const n = Math.round((max - min) / step);
    if (n + 1 <= 5) {
      let ticks = Array.from({ length: n + 1 }, (_, i) => clean(min + i * step));
      let s = step;
      // Too sparse (0 and 1 alone): halve the step until there are three.
      while (ticks.length < 3) {
        s = s / 2;
        const m = Math.round((max - min) / s);
        ticks = Array.from({ length: m + 1 }, (_, i) => clean(min + i * s));
      }
      return { min, max, step: clean(s), ticks };
    }
  }
  // Unreachable in practice: a two-interval step always fits in five ticks.
  return { min: lo, max: hi, step: hi - lo, ticks: [lo, hi] };
}

/** Where `v` sits in [min, max], as 0 to 100. Clamped. */
export function toPct(v: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

/* ------------------------------------------------------------------ */
/*  Stacks                                                             */
/* ------------------------------------------------------------------ */

export interface StackSegment {
  key: string;
  value: number;
  /** Value-space extent of the segment; `from` is nearer zero. */
  from: number;
  to: number;
}

export interface StackedCategory {
  label: string;
  segments: StackSegment[];
  /** Sum of the positive values, the top of the column. */
  positive: number;
  /** Sum of the negative values, the bottom of the column. */
  negative: number;
  /** Net total. */
  total: number;
}

/**
 * Stack each category's series. Positives build up from zero, negatives build
 * down from zero, each in series order, so a negative never hides behind a
 * positive. Zero and missing values make no segment.
 */
export function stackCategories(
  data: readonly { label: string; values: Record<string, number> }[],
  keys: readonly string[],
): StackedCategory[] {
  return data.map((d) => {
    let up = 0;
    let down = 0;
    const segments: StackSegment[] = [];
    for (const key of keys) {
      const v = d.values[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v === 0) continue;
      if (v > 0) {
        segments.push({ key, value: v, from: up, to: up + v });
        up += v;
      } else {
        segments.push({ key, value: v, from: down, to: down + v });
        down += v;
      }
    }
    return { label: d.label, segments, positive: up, negative: down, total: clean(up + down) };
  });
}

/* ------------------------------------------------------------------ */
/*  Waterfall                                                          */
/* ------------------------------------------------------------------ */

export interface WaterfallBar {
  label: string;
  kind: "delta" | "total";
  value: number;
  /** Value-space extent; for a delta `from` is the running total before it. */
  from: number;
  to: number;
  /** The running total after this step. */
  running: number;
}

/**
 * Running totals for a waterfall. A `delta` floats from the running total to
 * running + value. A `total` stands on zero at its own value and resets the
 * running total to it, an opening balance, a subtotal, a closing figure.
 */
export function waterfallBars(
  steps: readonly { label: string; value: number; kind?: "delta" | "total" }[],
): WaterfallBar[] {
  let running = 0;
  return steps.map((s) => {
    const kind = s.kind ?? "delta";
    const value = Number.isFinite(s.value) ? s.value : 0;
    if (kind === "total") {
      running = value;
      return { label: s.label, kind, value, from: 0, to: value, running };
    }
    const from = running;
    running = clean(running + value);
    return { label: s.label, kind, value, from, to: running, running };
  });
}

/* ------------------------------------------------------------------ */
/*  Lines with gaps                                                    */
/* ------------------------------------------------------------------ */

export interface LinePt {
  i: number;
  x: number;
  y: number;
}

/** Split a series into runs of consecutive non-null points. */
export function lineRuns(values: readonly (number | null | undefined)[]): { i: number; v: number }[][] {
  const runs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  values.forEach((v, i) => {
    if (typeof v === "number" && Number.isFinite(v)) cur.push({ i, v });
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  });
  if (cur.length) runs.push(cur);
  return runs;
}

/** A smooth path through points (midpoint cubic, as AreaLine draws). */
export function smoothPath(pts: readonly { x: number; y: number }[]): string {
  return pts.reduce((d, p, k) => {
    if (k === 0) return `M${r(p.x)},${r(p.y)}`;
    const q = pts[k - 1];
    const mx = r((q.x + p.x) / 2);
    return `${d} C${mx},${r(q.y)} ${mx},${r(p.y)} ${r(p.x)},${r(p.y)}`;
  }, "");
}

const r = (v: number) => Math.round(v * 100) / 100;

export interface GappedPath {
  /** One path string with a `M` per run, null values break the line. */
  line: string;
  /** One closed area per run, down to `baseY`. */
  areas: string[];
  /** Points with no neighbour on either side: drawn as dots, or they vanish. */
  isolated: LinePt[];
}

/**
 * The line (and optional area) for a series with gaps. `x(i)` and `y(v)` map
 * index and value into the chart's own coordinate box.
 */
export function gappedPath(
  values: readonly (number | null | undefined)[],
  x: (i: number) => number,
  y: (v: number) => number,
  baseY: number,
): GappedPath {
  const runs = lineRuns(values).map((run) => run.map(({ i, v }) => ({ i, x: x(i), y: y(v) })));
  const lines: string[] = [];
  const areas: string[] = [];
  const isolated: LinePt[] = [];
  for (const run of runs) {
    if (run.length === 1) {
      isolated.push(run[0]);
      continue;
    }
    const d = smoothPath(run);
    lines.push(d);
    areas.push(`${d} L${r(run[run.length - 1].x)},${r(baseY)} L${r(run[0].x)},${r(baseY)} Z`);
  }
  return { line: lines.join(" "), areas, isolated };
}

/* ------------------------------------------------------------------ */
/*  Heat buckets                                                       */
/* ------------------------------------------------------------------ */

export interface HeatScale {
  min: number;
  max: number;
  /** `buckets + 1` boundaries from min to max. */
  edges: number[];
  buckets: number;
}

/** Equal-interval buckets across the non-null values. */
export function heatScale(values: readonly (number | null | undefined)[], buckets = 5): HeatScale {
  const vs = finite(values);
  const min = vs.length ? Math.min(...vs) : 0;
  const max = vs.length ? Math.max(...vs) : 0;
  const n = Math.max(1, Math.floor(buckets));
  const edges = Array.from({ length: n + 1 }, (_, k) => clean(min + ((max - min) * k) / n));
  return { min, max, edges, buckets: n };
}

/** 0 (palest) to buckets − 1 (deepest); −1 for a missing value. */
export function heatBucket(v: number | null | undefined, scale: HeatScale): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return -1;
  const { min, max, buckets } = scale;
  if (max === min) return v === 0 ? 0 : buckets - 1;
  const k = Math.floor(((v - min) / (max - min)) * buckets);
  return Math.max(0, Math.min(buckets - 1, k));
}

/* ------------------------------------------------------------------ */
/*  Funnel                                                             */
/* ------------------------------------------------------------------ */

/** Each stage as a share of the one before; null for the first, or after a zero. */
export function conversionRates(values: readonly number[]): (number | null)[] {
  return values.map((v, k) => (k === 0 || !(values[k - 1] > 0) ? null : v / values[k - 1]));
}
