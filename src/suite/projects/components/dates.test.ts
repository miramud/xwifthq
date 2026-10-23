import { describe, it, expect, vi, afterEach } from "vitest";
import { isoDate, today } from "./dates";

/**
 * The date helpers, and the bug they exist to stop.
 *
 * `new Date().toISOString().slice(0, 10)` is today *in UTC*, while an
 * `<input type="date">` reads and writes local dates. The two disagree by a
 * day for most of the world for part of every day — and in **opposite
 * directions** either side of Greenwich, which is what makes it so easy to
 * test one hemisphere and ship the other broken.
 *
 * These tests pin both sides by moving the clock to the hours where the two
 * readings differ.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("isoDate", () => {
  it("formats from local parts", () => {
    expect(isoDate(new Date(2027, 0, 6))).toBe("2027-01-06");
  });

  it("pads single-digit months and days", () => {
    expect(isoDate(new Date(2027, 8, 7))).toBe("2027-09-07");
  });

  /**
   * The case that breaks `toISOString()` east of Greenwich: just after local
   * midnight, UTC is still on yesterday.
   */
  it("gives today, not yesterday, in the small hours east of Greenwich", () => {
    const justAfterMidnight = new Date(2027, 0, 6, 0, 30);

    expect(isoDate(justAfterMidnight)).toBe("2027-01-06");

    /* What the old code would have produced, for contrast. */
    if (justAfterMidnight.getTimezoneOffset() < 0) {
      expect(justAfterMidnight.toISOString().slice(0, 10)).toBe("2027-01-05");
    }
  });

  /**
   * And the mirror, west of Greenwich: late evening is already tomorrow in
   * UTC, so the old code would offer a date that has not happened.
   */
  it("gives today, not tomorrow, late in the evening west of Greenwich", () => {
    const lateEvening = new Date(2027, 0, 5, 23, 30);

    expect(isoDate(lateEvening)).toBe("2027-01-05");

    if (lateEvening.getTimezoneOffset() > 0) {
      expect(lateEvening.toISOString().slice(0, 10)).toBe("2027-01-06");
    }
  });

  it("rolls the year at the last moment of December", () => {
    expect(isoDate(new Date(2027, 11, 31, 23, 59))).toBe("2027-12-31");
  });
});

describe("today", () => {
  it("follows the local clock", () => {
    vi.setSystemTime(new Date(2027, 2, 9, 14, 0));

    expect(today()).toBe("2027-03-09");
  });

  it("is still today half an hour after midnight", () => {
    vi.setSystemTime(new Date(2027, 2, 9, 0, 30));

    expect(today()).toBe("2027-03-09");
  });
});
