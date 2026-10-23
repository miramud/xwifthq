import { describe, expect, it } from "vitest";
import { dueRuleText, dueText, monthTicks, nextOpen, percentAt, reminderText, ribbonWindow, sortOffsets, stageToEvent, windowAround } from "./labels";
import { stepIndex } from "./OccurrenceDetail";
import { occurrence } from "./fixtures";

/** The arithmetic and words behind the compliance screens. */

describe("compliance labels", () => {
  it("says how a due date is worked out", () => {
    expect(dueRuleText({ type: "day_of_month", day: 10, offsetMonths: 1 }, "monthly")).toBe("Day 10 of the following month");
    expect(dueRuleText({ type: "annual_date", month: 6, day: 30 })).toBe("30 June each year");
    expect(dueRuleText({ type: "after_fy_end", months: 6 })).toBe("6 months after the year end");
    expect(dueRuleText({ type: "expiry" })).toBe("When the certificate expires");
    expect(dueRuleText(null, "on_change")).toBe("Whenever something changes");
  });

  it("counts the days to or past a due date", () => {
    expect(dueText("2026-10-06", "2026-10-06")).toBe("Due today");
    expect(dueText("2026-10-07", "2026-10-06")).toBe("Due in 1 day");
    expect(dueText("2026-06-30", "2026-10-06")).toBe("98 days late");
    expect(dueText("2026-06-30", "2026-10-06", "completed")).toBe("Done");
  });

  it("maps stages onto the calendar's statuses and the stepper", () => {
    expect(stageToEvent("overdue")).toBe("overdue");
    expect(stageToEvent("submitted")).toBe("due");
    expect(stageToEvent("completed")).toBe("done");
    expect(stepIndex("overdue", "open")).toBe(1);
    expect(stepIndex("overdue", "in_progress")).toBe(2);
    expect(stepIndex("submitted", "submitted")).toBe(3);
  });

  it("finds each obligation's next open occurrence, late ones first", () => {
    const next = nextOpen([
      occurrence({ id: "a", obligationId: "o1", dueOn: "2026-11-10", stage: "upcoming" }),
      occurrence({ id: "b", obligationId: "o1", dueOn: "2026-09-10", stage: "overdue" }),
      occurrence({ id: "c", obligationId: "o2", dueOn: "2026-08-10", stage: "completed" }),
    ]);
    expect(next.get("o1")?.id).toBe("b");
    expect(next.has("o2")).toBe(false);
  });

  it("names reminders and keeps offsets furthest first", () => {
    expect(reminderText("t-30")).toBe("30 days before");
    expect(reminderText("t-1")).toBe("1 day before");
    expect(reminderText("overdue")).toBe("Overdue notice");
    expect(sortOffsets([7, 60, 7, 0, 400, 30])).toEqual([60, 30, 7]);
  });

  it("lays certificates on one time axis around today", () => {
    const w = ribbonWindow([{ issuedOn: "2025-08-01", expiresOn: "2026-07-31" }], "2026-10-06");
    expect(w.start <= "2025-08-01").toBe(true);
    expect(w.end >= "2027-10-06").toBe(true);
    expect(percentAt(w.start, w)).toBe(0);
    expect(percentAt(w.end, w)).toBe(100);
    expect(percentAt("2030-01-01", w)).toBe(100);
    expect(monthTicks(w).every((t) => ["Jan", "Apr", "Jul", "Oct"].includes(t.label.slice(0, 3)))).toBe(true);
    expect(windowAround(2026, 9)).toEqual({ from: "2026-04-01", to: "2027-10-31" });
  });
});
