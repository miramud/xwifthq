import { describe, expect, it } from "vitest";
import type { ContractFull, Lease } from "@/lib/api/operations-facilities-client";
import { addMonthsYmd, contractMonths, expiryStage, leftText, localIso, monthsBetween, rentOn, rentSchedule, tankLevels } from "./labels";

/** The arithmetic the facilities screens draw from. */

const lease = (over: Partial<Lease> = {}): Lease => ({
  id: "l1",
  facilityId: "f1",
  facility: "Head office",
  landlordId: null,
  landlord: "Adeyemi Estates",
  reference: "LSE/HQ",
  startsOn: "2025-01-01",
  endsOn: "2027-12-31",
  rent: 1_000_000_00,
  frequency: "annual",
  serviceCharge: 50_000_00,
  escalationBp: 1000,
  escalationEveryMonths: 12,
  noticeDays: 90,
  nextDueOn: "2027-01-01",
  nextAmount: 1_260_000_00,
  memoLeadDays: 14,
  status: "active",
  daysLeft: 451,
  documentId: null,
  notes: null,
  payments: [
    { dueOn: "2025-01-01", amount: 1_050_000_00, memoId: "m1", memo: { reference: "PM-1", status: "paid", amount: 1_050_000_00, paid: 1_050_000_00, type: "rent" } },
    { dueOn: "2026-01-01", amount: 1_150_000_00, memoId: "m2", memo: { reference: "PM-2", status: "approved", amount: 1_150_000_00, paid: 0, type: "rent" } },
  ],
  ...over,
});

describe("dates", () => {
  it("adds months without overflowing the month's end, and counts whole months", () => {
    expect(addMonthsYmd("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsYmd("2026-11-15", 3)).toBe("2027-02-15");
    expect(monthsBetween("2025-01-01", "2027-01-01")).toBe(24);
    expect(monthsBetween("2025-01-15", "2025-02-14")).toBe(0);
  });

  it("says days left the way a person thinks of them", () => {
    expect(leftText(-3)).toBe("Ended 3 days ago");
    expect(leftText(0)).toBe("Ends today");
    expect(leftText(45)).toBe("45 days left");
    expect(leftText(200)).toBe("7 months left");
    expect(expiryStage(25).hue).toBe("rose");
    expect(expiryStage(80).hue).toBe("coral");
    expect(expiryStage(110).hue).toBe("sun");
    expect(expiryStage(400).label).toBe("Running");
  });

  it("writes a local time with this browser's offset", () => {
    expect(localIso("2026-10-07", "10:00")).toMatch(/^2026-10-07T10:00:00[+-]\d{2}:\d{2}$/);
  });
});

describe("leases", () => {
  it("escalates rent the way the API does: compounded every N months, service charge on top", () => {
    const l = lease();
    expect(rentOn(l, "2025-01-01")).toBe(1_050_000_00);
    expect(rentOn(l, "2026-01-01")).toBe(1_150_000_00);
    expect(rentOn(l, "2027-01-01")).toBe(1_260_000_00);
    expect(rentOn({ ...l, escalationBp: 0 }, "2027-01-01")).toBe(1_050_000_00);
  });

  it("runs the schedule from what was raised to the end of the term, marking each step up", () => {
    const s = rentSchedule(lease());
    expect(s.map((x) => [x.dueOn, x.state, x.stepUp])).toEqual([
      ["2025-01-01", "raised", false],
      ["2026-01-01", "raised", true],
      ["2027-01-01", "upcoming", true],
    ]);
    expect(s[0].memoStatus).toBe("paid");
  });
});

describe("contracts", () => {
  it("gives each of the last twelve months where the contract stands", () => {
    const c = {
      startsOn: "2026-03-01",
      endsOn: "2027-02-28",
      confirmations: [
        { period: "2026-07", status: "confirmed" },
        { period: "2026-08", status: "disputed" },
      ],
      toConfirm: ["2026-10", "2026-09"],
    } as unknown as ContractFull;
    const m = contractMonths(c, "2026-10-06");
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: "2025-11", state: "not_started" });
    expect(m.find((x) => x.month === "2026-07")?.state).toBe("confirmed");
    expect(m.find((x) => x.month === "2026-08")?.state).toBe("disputed");
    expect(m.find((x) => x.month === "2026-09")?.state).toBe("to_confirm");
    expect(m[11]).toEqual({ month: "2026-10", state: "to_confirm" });
  });
});

describe("diesel", () => {
  it("rebuilds the tank's level after each day from today's level backwards", () => {
    const levels = tankLevels(
      [
        { id: "3", kind: "diesel_used", enteredOn: "2026-10-03", litres: 150, amount: 0, reading: 1210, generator: "GEN-1" },
        { id: "2", kind: "diesel_used", enteredOn: "2026-10-02", litres: 100, amount: 0, reading: 1200, generator: "GEN-1" },
        { id: "1", kind: "diesel_in", enteredOn: "2026-10-01", litres: 1000, amount: 1_100_000_00, reading: null, generator: null },
      ],
      950,
    );
    expect(levels).toEqual([
      { date: "2026-10-01", level: 1200 },
      { date: "2026-10-02", level: 1100 },
      { date: "2026-10-03", level: 950 },
    ]);
  });
});
