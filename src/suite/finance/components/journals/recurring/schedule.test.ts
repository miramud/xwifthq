import { describe, expect, it } from "vitest";
import { occurrence, scheduleLabel, upcoming } from "./schedule";

/** The schedule as the API counts it (`RecurringJournals::occurrence`). */

describe("recurring schedule", () => {
  it("puts a day the month lacks on its last day, without dragging later months back", () => {
    expect([0, 1, 2, 3].map((n) => occurrence("2026-01-01", "monthly", 31, n))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect([0, 1].map((n) => occurrence("2028-02-10", "monthly", 30, n))).toEqual(["2028-02-29", "2028-03-30"]);
  });

  it("starts in the start month, or a step later when the day has passed", () => {
    expect(occurrence("2026-01-01", "monthly", 15, 0)).toBe("2026-01-15");
    expect(occurrence("2026-01-20", "monthly", 15, 0)).toBe("2026-02-15");
    expect([0, 1].map((n) => occurrence("2026-01-15", "quarterly", 10, n))).toEqual(["2026-04-10", "2026-07-10"]);
    expect([0, 1].map((n) => occurrence("2026-12-01", "annual", 31, n))).toEqual(["2026-12-31", "2027-12-31"]);
  });

  it("stops at the end date or the number of occurrences", () => {
    expect(upcoming({ startDate: "2026-01-01", frequency: "monthly", dayOfMonth: 15, endDate: "2026-03-14" })).toEqual(["2026-01-15", "2026-02-15"]);
    expect(upcoming({ startDate: "2026-01-01", frequency: "monthly", dayOfMonth: 15, maxOccurrences: 3 }, 6, 1)).toEqual(["2026-02-15", "2026-03-15"]);
    expect(upcoming({ startDate: "", frequency: "monthly", dayOfMonth: 15 })).toEqual([]);
  });

  it("says the schedule in words", () => {
    expect(scheduleLabel("monthly", 15)).toBe("Monthly on the 15th");
    expect(scheduleLabel("quarterly", 31)).toBe("Quarterly on the last day");
    expect(scheduleLabel("annual", 1)).toBe("Annually on the 1st");
    expect(scheduleLabel("monthly", 22)).toBe("Monthly on the 22nd");
    expect(scheduleLabel("monthly", 12)).toBe("Monthly on the 12th");
  });
});
