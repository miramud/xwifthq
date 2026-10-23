import { describe, expect, it } from "vitest";
import { bookVsBank, canRetryImport, isMonthKey, monthRange, monthsEnding, pipelineStage, shiftMonth } from "./labels";
import { totalsByCurrency } from "./BankAccountsBoard";
import { account } from "./fixtures";

describe("banking labels and logic", () => {
  it("places an import on the pipeline", () => {
    expect(pipelineStage({ status: "parsing" })).toEqual({ done: 1, failed: false });
    expect(pipelineStage({ status: "failed_validation" })).toEqual({ done: 1, failed: true });
    expect(pipelineStage({ status: "ready_for_review" }, 3)).toEqual({ done: 2, failed: false });
    expect(pipelineStage({ status: "ready_for_review" }, 0)).toEqual({ done: 3, failed: false });
    expect(pipelineStage({ status: "submitted" })).toEqual({ done: 4, failed: false });
    expect(pipelineStage({ status: "posted" })).toEqual({ done: 5, failed: false });
  });

  it("offers a run again for a failed import, or one stuck on the queue for 15 minutes", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(canRetryImport({ status: "failed_validation", uploadedAt: "2026-10-07T11:59:00Z" }, now)).toBe(true);
    expect(canRetryImport({ status: "parsing", uploadedAt: "2026-10-07T11:50:00Z" }, now)).toBe(false);
    expect(canRetryImport({ status: "uploaded", uploadedAt: "2026-10-07T11:40:00Z" }, now)).toBe(true);
    expect(canRetryImport({ status: "ready_for_review", uploadedAt: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });

  it("counts months across a year end", () => {
    expect(monthsEnding("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsEnding("2026-10")).toHaveLength(12);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("sept")).toBe(false);
  });

  it("compares book with bank only when a statement is in", () => {
    expect(bookVsBank(100, 80)).toBe(20);
    expect(bookVsBank(100, null)).toBeNull();
  });

  it("totals cash by currency, naira first, leaving closed accounts out", () => {
    const t = totalsByCurrency([
      account({ id: "a", currency: "USD", bookBalance: 5_00, bankBalance: 4_00 }),
      account({ id: "b", bookBalance: 10_00, bankBalance: null }),
      account({ id: "c", bookBalance: 20_00, bankBalance: 20_00 }),
      account({ id: "d", status: "closed", bookBalance: 999_00 }),
    ]);
    expect(t.map((x) => x.currency)).toEqual(["NGN", "USD"]);
    expect(t[0]).toMatchObject({ accounts: 2, book: 30_00, bank: 20_00, withStatement: 1 });
  });
});
