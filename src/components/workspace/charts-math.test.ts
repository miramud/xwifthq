import { describe, expect, it } from "vitest";
import {
  conversionRates,
  gappedPath,
  heatBucket,
  heatScale,
  lineRuns,
  niceScale,
  niceStep,
  stackCategories,
  toPct,
  waterfallBars,
} from "./charts-math";

describe("niceStep", () => {
  it("rounds to 1 / 2 / 2.5 / 5 × 10ⁿ", () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(10, 4)).toBe(2.5);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(37, 4)).toBe(10);
    expect(niceStep(0.9, 4)).toBe(0.25);
    expect(niceStep(0, 4)).toBe(1);
  });
});

describe("niceScale", () => {
  it("covers the data on round ticks, from zero", () => {
    const s = niceScale([12, 87, 40]);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(87);
    expect(s.ticks[0]).toBe(0);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
    expect(s.ticks.length).toBeLessThanOrEqual(5);
  });

  it("puts negatives below a zero baseline", () => {
    const s = niceScale([-30, 70]);
    expect(s.min).toBeLessThanOrEqual(-30);
    expect(s.max).toBeGreaterThanOrEqual(70);
    expect(s.ticks).toContain(0);
    expect(s.ticks.length).toBeLessThanOrEqual(5);
  });

  it("handles all-negative data", () => {
    const s = niceScale([-5, -12]);
    expect(s.max).toBe(0);
    expect(s.min).toBeLessThanOrEqual(-12);
  });

  it("gives an empty or all-zero series a unit axis", () => {
    expect(niceScale([]).ticks.length).toBeGreaterThanOrEqual(3);
    expect(niceScale([0, 0]).max).toBeGreaterThan(0);
  });

  it("ignores nulls and non-finite values", () => {
    const s = niceScale([null, 4, Number.NaN, undefined, 9]);
    expect(s.max).toBeGreaterThanOrEqual(9);
  });

  it("can leave zero out", () => {
    const s = niceScale([100, 120], { includeZero: false });
    expect(s.min).toBeGreaterThan(0);
    expect(s.min).toBeLessThanOrEqual(100);
    expect(s.max).toBeGreaterThanOrEqual(120);
  });

  it("keeps float noise out of ticks", () => {
    const s = niceScale([0.3]);
    s.ticks.forEach((t) => expect(String(t).length).toBeLessThan(8));
  });

  it("returns 3–5 ticks across many ranges", () => {
    for (const hi of [1, 3, 7, 9.5, 11, 49, 51, 99, 101, 999, 1234, 87000]) {
      for (const lo of [0, -hi / 3, -hi]) {
        const s = niceScale([lo, hi]);
        expect(s.ticks.length).toBeGreaterThanOrEqual(3);
        expect(s.ticks.length).toBeLessThanOrEqual(5);
        expect(s.min).toBeLessThanOrEqual(lo);
        expect(s.max).toBeGreaterThanOrEqual(hi);
      }
    }
  });
});

describe("toPct", () => {
  it("maps and clamps", () => {
    expect(toPct(50, 0, 100)).toBe(50);
    expect(toPct(0, -50, 50)).toBe(50);
    expect(toPct(200, 0, 100)).toBe(100);
    expect(toPct(5, 5, 5)).toBe(0);
  });
});

describe("stackCategories", () => {
  it("stacks positives up and negatives down from zero", () => {
    const [c] = stackCategories([{ label: "Q1", values: { a: 10, b: -4, c: 5, d: -2 } }], ["a", "b", "c", "d"]);
    expect(c.segments).toEqual([
      { key: "a", value: 10, from: 0, to: 10 },
      { key: "b", value: -4, from: 0, to: -4 },
      { key: "c", value: 5, from: 10, to: 15 },
      { key: "d", value: -2, from: -4, to: -6 },
    ]);
    expect(c.positive).toBe(15);
    expect(c.negative).toBe(-6);
    expect(c.total).toBe(9);
  });

  it("skips zero and missing values", () => {
    const [c] = stackCategories([{ label: "x", values: { a: 0 } }], ["a", "b"]);
    expect(c.segments).toEqual([]);
    expect(c.total).toBe(0);
  });
});

describe("waterfallBars", () => {
  it("carries a running total through deltas and resets on totals", () => {
    const bars = waterfallBars([
      { label: "Opening", value: 100, kind: "total" },
      { label: "Sales", value: 40 },
      { label: "Costs", value: -70 },
      { label: "Closing", value: 70, kind: "total" },
      { label: "Refund", value: -90 },
    ]);
    expect(bars.map((b) => [b.from, b.to])).toEqual([
      [0, 100],
      [100, 140],
      [140, 70],
      [0, 70],
      [70, -20],
    ]);
    expect(bars[4].running).toBe(-20);
    expect(bars[1].kind).toBe("delta");
  });

  it("is empty for no steps", () => {
    expect(waterfallBars([])).toEqual([]);
  });
});

describe("lineRuns and gappedPath", () => {
  it("splits on nulls", () => {
    expect(lineRuns([1, 2, null, 4, null, null, 6, 7]).map((r) => r.map((p) => p.i))).toEqual([[0, 1], [3], [6, 7]]);
  });

  it("draws one subpath per run and keeps lone points as dots", () => {
    const g = gappedPath([1, 2, null, 4, null, 6, 7], (i) => i * 10, (v) => 100 - v, 100);
    expect(g.line.match(/M/g)?.length).toBe(2);
    expect(g.areas).toHaveLength(2);
    expect(g.areas[0]).toMatch(/Z$/);
    expect(g.isolated).toEqual([{ i: 3, x: 30, y: 96 }]);
  });

  it("is empty for all-null", () => {
    const g = gappedPath([null, null], (i) => i, (v) => v, 0);
    expect(g.line).toBe("");
    expect(g.areas).toEqual([]);
  });
});

describe("heatScale / heatBucket", () => {
  it("buckets equal intervals and flags nulls", () => {
    const s = heatScale([0, 10, null, 5], 5);
    expect(s.edges).toEqual([0, 2, 4, 6, 8, 10]);
    expect(heatBucket(0, s)).toBe(0);
    expect(heatBucket(5, s)).toBe(2);
    expect(heatBucket(10, s)).toBe(4);
    expect(heatBucket(null, s)).toBe(-1);
  });

  it("copes with a flat or empty scale", () => {
    const flat = heatScale([3, 3]);
    expect(heatBucket(3, flat)).toBe(4);
    expect(heatBucket(0, heatScale([0]))).toBe(0);
    expect(heatScale([]).edges.every((e) => e === 0)).toBe(true);
  });

  it("handles negatives", () => {
    const s = heatScale([-10, 10], 4);
    expect(heatBucket(-10, s)).toBe(0);
    expect(heatBucket(0, s)).toBe(2);
  });
});

describe("conversionRates", () => {
  it("is each stage over the previous", () => {
    expect(conversionRates([200, 100, 25, 0, 5])).toEqual([null, 0.5, 0.25, 0, null]);
  });
});
