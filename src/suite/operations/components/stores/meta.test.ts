import { describe, expect, it } from "vitest";
import { countSummary, defaultIssue, deskOrder, hasShortfall, impliedUnitCost, levelOf, lineVariance, remaining, valueByCategory } from "./meta";
import { monthSeries, spanStart } from "./ConsumptionReport";
import { totalAfterEach } from "./StockLedgerDrawer";
import { issueProblem } from "./RequisitionDetail";
import { requisition, stockDesk } from "./fixtures";

/** The stores' arithmetic: levels, what to issue, count variances, and the report's months. */

describe("levels", () => {
  it("puts the reorder tick in the middle and says where the item stands", () => {
    expect(levelOf({ onHand: 30, reorderLevel: 20, critical: false, belowReorder: false })).toEqual({ state: "healthy", pct: 75, tickPct: 50 });
    expect(levelOf({ onHand: 22, reorderLevel: 20, critical: false, belowReorder: false }).state).toBe("near");
    expect(levelOf({ onHand: 15, reorderLevel: 20, critical: false, belowReorder: true }).state).toBe("below");
    expect(levelOf({ onHand: 2, reorderLevel: 4, critical: true, belowReorder: true }).state).toBe("critical");
    expect(levelOf({ onHand: 0, reorderLevel: 4, critical: false, belowReorder: true }).state).toBe("out");
    expect(levelOf({ onHand: 5, reorderLevel: 0, critical: false, belowReorder: false }).state).toBe("untracked");
  });

  it("adds stock value up by category, biggest first", () => {
    const d = stockDesk();
    expect(valueByCategory(d.items, d.categories)).toEqual([
      { key: "toner", label: "Toner and ink", value: 190_000_00 },
      { key: "refreshments", label: "Refreshments", value: 96_000_00 },
      { key: "stationery", label: "Stationery", value: 67_500_00 },
    ]);
  });
});

describe("issuing", () => {
  it("offers the rest of a line, or what the store has if that is less", () => {
    expect(defaultIssue({ quantity: 10, issued: 0, inStore: 12 })).toBe(10);
    expect(defaultIssue({ quantity: 3, issued: 0, inStore: 2 })).toBe(2);
    expect(defaultIssue({ quantity: 3, issued: 1, inStore: 5 })).toBe(2);
    expect(defaultIssue({ quantity: 3, issued: 3, inStore: 5 })).toBe(0);
    expect(remaining({ quantity: 2.5, issued: 1.25 })).toBe(1.25);
  });

  it("refuses more than is left or more than the store holds", () => {
    const line = requisition().lines[1];
    expect(issueProblem(line, "")).toBeNull();
    expect(issueProblem(line, "2")).toBeNull();
    expect(issueProblem(line, "x")).toBe("Issue a number, like 2 or 0.5.");
    expect(issueProblem(line, "4")).toBe("Only 3 cartridge is left to issue.");
    expect(issueProblem(line, "3")).toBe("The store holds only 2 cartridge.");
  });

  it("takes approved and part-issued requisitions first, oldest first", () => {
    const rows = [
      requisition({ id: "a", status: "issued", createdAt: "2026-10-04" }),
      requisition({ id: "b", status: "approved", createdAt: "2026-10-03" }),
      requisition({ id: "c", status: "partly_issued", createdAt: "2026-10-01" }),
      requisition({ id: "d", status: "approved", createdAt: "2026-10-01" }),
      requisition({ id: "e", status: "in_approval", createdAt: "2026-10-05" }),
    ];
    expect(deskOrder(rows).map((r) => r.id)).toEqual(["d", "b", "c", "e", "a"]);
    expect(hasShortfall(requisition())).toBe(true);
  });
});

describe("counts", () => {
  it("works out each line's variance and the sheet's totals as typed", () => {
    expect(lineVariance(12, 10, 4_500_00)).toEqual({ qty: -2, value: -9_000_00 });
    expect(lineVariance(12, null, 4_500_00)).toBeNull();
    const lines = [
      { id: "a", systemQty: 12 },
      { id: "b", systemQty: 2 },
      { id: "c", systemQty: 30 },
    ];
    const cost: Record<string, number> = { a: 4_500_00, b: 95_000_00, c: 3_200_00 };
    expect(countSummary(lines, { a: 10, b: 3, c: null }, (id) => cost[id])).toEqual({ counted: 2, total: 3, net: 86_000_00, gross: 104_000_00, short: 1, over: 1 });
    expect(impliedUnitCost({ variance: -2, varianceValue: -9_000_00 })).toBe(4_500_00);
  });
});

describe("the ledger and the report", () => {
  it("adds every store's last balance after each movement, oldest first", () => {
    const rows = [
      { store: "Main store", balanceAfter: 9, at: "3" },
      { store: "ICT store", balanceAfter: 3, at: "2" },
      { store: "Main store", balanceAfter: 12, at: "1" },
    ];
    expect(totalAfterEach(rows).map((r) => r.total)).toEqual([12, 15, 12]);
  });

  it("fills the months with nothing issued, and starts a span on the first of the month", () => {
    expect(monthSeries([{ month: "2026-08", value: 5 }], "2026-07-01", "2026-10-06")).toEqual([
      { month: "2026-07", value: 0 },
      { month: "2026-08", value: 5 },
      { month: "2026-09", value: 0 },
      { month: "2026-10", value: 0 },
    ]);
    expect(spanStart(6, new Date(2026, 9, 6))).toBe("2026-05-01");
    expect(spanStart(3, new Date(2026, 1, 10))).toBe("2025-12-01");
  });
});
