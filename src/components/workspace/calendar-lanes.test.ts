import { describe, expect, it } from "vitest";
import { addDays, allocateLanes, dayNumber } from "./calendar-lanes";

const WEEK = "2026-10-05"; // a Monday

const pick = (ps: ReturnType<typeof allocateLanes>) =>
  ps.map((p) => [p.event.id, p.startCol, p.endCol, p.lane, p.continuesLeft, p.continuesRight]);

describe("day maths", () => {
  it("counts days without timezone drift, across month, year and DST", () => {
    expect(dayNumber("2026-10-06") - dayNumber("2026-10-05")).toBe(1);
    expect(dayNumber("2027-01-01") - dayNumber("2026-12-31")).toBe(1);
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-28")).toBe(2);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-05", -5)).toBe("2026-09-30");
  });
});

describe("allocateLanes", () => {
  it("places single and multi-day events by column", () => {
    const out = allocateLanes(
      [
        { id: "a", date: "2026-10-05" },
        { id: "b", date: "2026-10-07", endDate: "2026-10-09" },
      ],
      WEEK,
    );
    expect(pick(out)).toEqual([
      ["a", 0, 0, 0, false, false],
      ["b", 2, 4, 0, false, false],
    ]);
  });

  it("stacks overlaps into the lowest free lane, greedily by start", () => {
    const out = allocateLanes(
      [
        { id: "c", date: "2026-10-08", endDate: "2026-10-10" },
        { id: "a", date: "2026-10-05", endDate: "2026-10-08" },
        { id: "b", date: "2026-10-06" },
        { id: "d", date: "2026-10-09" },
      ],
      WEEK,
    );
    expect(pick(out)).toEqual([
      ["a", 0, 3, 0, false, false],
      ["b", 1, 1, 1, false, false],
      ["c", 3, 5, 1, false, false],
      ["d", 4, 4, 0, false, false],
    ]);
  });

  it("puts the longer event first on a shared start, then orders by id", () => {
    const out = allocateLanes(
      [
        { id: "short", date: "2026-10-05" },
        { id: "long", date: "2026-10-05", endDate: "2026-10-07" },
        { id: "also-short", date: "2026-10-05" },
      ],
      WEEK,
    );
    expect(out.map((p) => [p.event.id, p.lane])).toEqual([
      ["long", 0],
      ["also-short", 1],
      ["short", 2],
    ]);
  });

  it("clips events that cross the week and flags the continuation", () => {
    const out = allocateLanes(
      [
        { id: "from-last-week", date: "2026-09-30", endDate: "2026-10-06" },
        { id: "into-next", date: "2026-10-10", endDate: "2026-10-14" },
        { id: "whole", date: "2026-09-01", endDate: "2026-12-01" },
      ],
      WEEK,
    );
    expect(pick(out)).toEqual([
      ["whole", 0, 6, 0, true, true],
      ["from-last-week", 0, 1, 1, true, false],
      ["into-next", 5, 6, 1, false, true],
    ]);
  });

  it("drops events outside the week", () => {
    expect(
      allocateLanes(
        [
          { id: "before", date: "2026-10-01", endDate: "2026-10-04" },
          { id: "after", date: "2026-10-12" },
        ],
        WEEK,
      ),
    ).toEqual([]);
  });

  it("honours in-month bounds and treats what lies beyond as continuation", () => {
    // Week of 28 Sep 2026; October starts on Thursday (col 3).
    const out = allocateLanes(
      [
        { id: "sept", date: "2026-09-28", endDate: "2026-09-30" },
        { id: "across", date: "2026-09-29", endDate: "2026-10-02" },
      ],
      "2026-09-28",
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(pick(out)).toEqual([["across", 3, 4, 0, true, false]]);
  });

  it("treats an end before the start as one day", () => {
    const [p] = allocateLanes([{ id: "x", date: "2026-10-07", endDate: "2026-10-06" }], WEEK);
    expect([p.startCol, p.endCol]).toEqual([2, 2]);
  });
});
