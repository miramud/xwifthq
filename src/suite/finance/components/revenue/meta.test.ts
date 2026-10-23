import { describe, expect, it } from "vitest";
import { allocationSummary, bpFromPct, invoiceTotals, lateness, mulBp, payInFullLessWht, pct, rail, whtLeft, type OpenInvoice } from "./meta";
import { invoice } from "./fixtures";

/** The arithmetic has to land on the kobo the API stores. */

describe("invoice totals", () => {
  it("matches INV/2026/0003: VAT per line, retention on the total, WHT on the subtotal", () => {
    const t = invoiceTotals([{ amount: 7_500_000_00, vatRateBp: 750 }], 500, 500);
    expect(t).toEqual({
      subtotal: 7_500_000_00,
      vat: 562_500_00,
      total: 8_062_500_00,
      retention: 403_125_00,
      expectedWht: 375_000_00,
      payNow: 8_062_500_00 - 403_125_00 - 375_000_00,
    });
  });

  it("rounds VAT and retention half up, and WHT down, like the API", () => {
    expect(mulBp(1_01, 750)).toBe(8); // 7.575 → 8
    expect(mulBp(1_00, 750)).toBe(8); // 7.5 → 8
    const t = invoiceTotals([{ amount: 3_33, vatRateBp: 0 }], 0, 500);
    expect(t.expectedWht).toBe(16); // 16.65 → 16
  });

  it("adds lines at their own VAT rates", () => {
    const t = invoiceTotals(
      [
        { amount: 100_00, vatRateBp: 750 },
        { amount: 50_00, vatRateBp: 0 },
      ],
      0,
      0,
    );
    expect(t.vat).toBe(7_50);
    expect(t.total).toBe(157_50);
  });
});

describe("receipt allocation", () => {
  const open = (balances: OpenInvoice["open"] = { trade: 7_659_375_00, retention: 403_125_00, whtTaken: 0 }): OpenInvoice => ({
    invoice: invoice(),
    open: balances,
  });

  it("pays in full less the WHT still expected (5% of the subtotal), leaving retention held", () => {
    expect(whtLeft(open())).toBe(375_000_00);
    expect(payInFullLessWht(open())).toEqual({ invoiceId: "inv-3", cash: 7_659_375_00 - 375_000_00, wht: 375_000_00, retention: 0 });
  });

  it("doesn't take WHT twice when an earlier receipt already deducted it", () => {
    expect(whtLeft(open({ trade: 1_000_00, retention: 0, whtTaken: 300_000_00 }))).toBe(75_000_00);
    const o = open({ trade: 1_000_00, retention: 0, whtTaken: 375_000_00 });
    expect(whtLeft(o)).toBe(0);
    expect(payInFullLessWht(o)).toMatchObject({ cash: 1_000_00, wht: 0 });
  });

  it("counts released retention as cash, keeps WHT apart, and leaves the rest as an advance", () => {
    const s = allocationSummary(
      8_000_000_00,
      [{ invoiceId: "inv-3", cash: 7_284_375_00, wht: 375_000_00, retention: 403_125_00 }],
      { "inv-3": { trade: 7_659_375_00, retention: 403_125_00 } },
      () => "INV/2026/0003",
    );
    expect(s.applied).toBe(7_284_375_00 + 403_125_00);
    expect(s.wht).toBe(375_000_00);
    expect(s.unallocated).toBe(8_000_000_00 - 7_687_500_00);
    expect(s.over).toBe(false);
    expect(s.problems).toEqual([]);
  });

  it("refuses cash and WHT past the trade balance, retention past what is held, and more than came in", () => {
    const s = allocationSummary(
      100_00,
      [{ invoiceId: "inv-3", cash: 90_00, wht: 20_00, retention: 30_00 }],
      { "inv-3": { trade: 100_00, retention: 20_00 } },
      () => "INV/2026/0003",
    );
    expect(s.over).toBe(true);
    expect(s.unallocated).toBe(-20_00);
    expect(s.problems.map((p) => p.field)).toEqual(["cash", "retention"]);
    expect(s.problems[0].message).toBe("INV/2026/0003 has ₦100.00 left to pay (before retention).");
  });
});

describe("contract rail", () => {
  it("splits the value into invoiced, accepted, planned and unscheduled, and says how far over it goes", () => {
    const r = rail(100, [
      { amount: 20, status: "invoiced" },
      { amount: 30, status: "completed" },
      { amount: 10, status: "planned" },
    ]);
    expect(r.segments.map((s) => s.amount)).toEqual([20, 30, 10]);
    expect(r.unscheduled).toBe(40);
    expect(r.over).toBe(0);
    expect(rail(50, [{ amount: 60, status: "planned" }]).over).toBe(10);
  });
});

describe("rates and lateness", () => {
  it("reads percents into basis points within the limit", () => {
    expect(bpFromPct("7.5")).toBe(750);
    expect(bpFromPct("")).toBe(0);
    expect(bpFromPct("51")).toBeNull();
    expect(bpFromPct("100", 10_000)).toBe(10_000);
    expect(bpFromPct("abc")).toBeNull();
    expect(pct(750)).toBe("7.5%");
  });

  it("deepens the hue as an invoice ages", () => {
    expect(lateness(0)).toBeNull();
    expect(lateness(1)).toEqual({ label: "1 day late", hue: "sun" });
    expect(lateness(45)?.hue).toBe("coral");
    expect(lateness(120)?.hue).toBe("rose");
  });
});
