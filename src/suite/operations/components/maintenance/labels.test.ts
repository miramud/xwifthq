import { describe, expect, it } from "vitest";
import { hoursBetween, slaClock, spanText } from "./labels";
import { frequencyText, mondayOf, usageProgress } from "./PlansDesk";
import { overThreshold } from "./MaintenanceReports";

/** The SLA clock, meters, plan wording and the replacement rule. */

const at = (s: string) => Date.parse(s);

describe("spanText", () => {
  it("says spans the way people do", () => {
    expect(spanText(45 * 60_000)).toBe("45m");
    expect(spanText(200 * 60_000)).toBe("3h 20m");
    expect(spanText(20 * 3_600_000)).toBe("20h");
    expect(spanText(72 * 3_600_000)).toBe("3 days");
  });
});

describe("slaClock", () => {
  const w = { status: "open", createdAt: "2026-10-06T00:00:00Z", dueAt: "2026-10-07T00:00:00Z", completedAt: null };

  it("counts down while open, and turns amber in the last quarter", () => {
    expect(slaClock(w, at("2026-10-06T06:00:00Z"))).toMatchObject({ label: "18h left", hue: "mint", overdue: false, used: 0.25 });
    expect(slaClock(w, at("2026-10-06T20:00:00Z"))).toMatchObject({ label: "4h left", hue: "sun" });
  });

  it("says how long overdue once the time is gone", () => {
    expect(slaClock(w, at("2026-10-07T02:30:00Z"))).toMatchObject({ label: "Overdue by 2h 30m", hue: "rose", overdue: true, figure: "2h 30m", note: "overdue" });
  });

  it("says met or missed once done, and nothing for no SLA", () => {
    expect(slaClock({ ...w, status: "completed", completedAt: "2026-10-06T10:00:00Z" })).toMatchObject({ label: "SLA met", hue: "mint" });
    expect(slaClock({ ...w, status: "confirmed", completedAt: "2026-10-08T00:00:00Z" })).toMatchObject({ label: "SLA missed by 24h", hue: "rose", overdue: false });
    expect(slaClock({ ...w, dueAt: null }).label).toBe("No SLA");
  });
});

describe("downtime", () => {
  it("runs to now until the work is done", () => {
    expect(hoursBetween("2026-10-06T00:00:00Z", "2026-10-06T05:30:00Z")).toBe(5.5);
    expect(hoursBetween("2026-10-06T00:00:00Z", null, at("2026-10-06T02:00:00Z"))).toBe(2);
    expect(hoursBetween(null, null)).toBeNull();
  });
});

describe("plans", () => {
  it("words how often a plan runs", () => {
    expect(frequencyText({ everyMonths: 3, everyUsage: 250, usageUnit: "hours" })).toBe("Every 3 months or 250 hours, whichever comes first");
    expect(frequencyText({ everyMonths: 1, everyUsage: null, usageUnit: null })).toBe("Every 1 month");
    expect(frequencyText({ everyMonths: null, everyUsage: 5000, usageUnit: "km" })).toBe("Every 5,000 km");
  });

  it("measures a meter against the plan's limit", () => {
    expect(usageProgress(100, 250)).toEqual({ pct: 40, hue: "mint", left: 150 });
    expect(usageProgress(200, 250).hue).toBe("sun");
    expect(usageProgress(260, 250)).toMatchObject({ hue: "rose", left: 0 });
  });

  it("starts the timeline on a Monday", () => {
    expect(mondayOf("2026-10-06")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
  });
});

describe("replacement threshold", () => {
  it("flags an asset whose year of repairs passes the share of its cost", () => {
    expect(overThreshold({ cost: 100, last12Cost: 51 }, 50)).toBe(true);
    expect(overThreshold({ cost: 100, last12Cost: 50 }, 50)).toBe(false);
    expect(overThreshold({ cost: null, last12Cost: 999 }, 50)).toBe(false);
  });
});
