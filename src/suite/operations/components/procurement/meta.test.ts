import { describe, expect, it } from "vitest";
import { checkTerms, overLowest, parsePct, picksTotal, poRoad, poStepDates, prEstimate, prRoad, readSheet, receiptProblem, serialProblem, splitSerials, termAmount } from "./meta";
import { comparison, poFull } from "./fixtures";

describe("the comparison sheet", () => {
  it("finds the lowest on each line, ranks vendors by total and builds the cheapest award", () => {
    const s = readSheet(comparison());
    expect([...(s.lowestOn.get("l-1") ?? [])]).toEqual(["q-konga"]);
    expect([...(s.lowestOn.get("l-2") ?? [])]).toEqual(["q-zenith"]);
    expect(s.ranked.map((v) => v.vendor)).toEqual(["Konga Business", "Zenith Office Supplies Ltd", "Swiftlink Networks Ltd"]);
    expect(s.bestTotal).toBe(3_934_500_00);
    expect(s.lowestPicks).toEqual([
      { prLineId: "l-1", quotationId: "q-konga" },
      { prLineId: "l-2", quotationId: "q-zenith" },
    ]);
    // Konga's laptops plus Zenith's bags, VAT included.
    expect(s.lowestPicksTotal).toBe(3_660_000_00 + 274_500_00 + 50_000_00 + 3_750_00);
  });

  it("shares the lowest between vendors who tie", () => {
    const c = comparison();
    c.lines[0].prices[1] = { ...c.lines[0].prices[1]!, amount: 3_660_000_00 };
    expect([...(readSheet(c).lowestOn.get("l-1") ?? [])].sort()).toEqual(["q-konga", "q-zenith"]);
  });

  it("prices a split award and says how far over the lowest a total is", () => {
    expect(picksTotal(comparison(), { "l-1": "q-swift", "l-2": "q-zenith" })).toBe(3_960_000_00 + 297_000_00 + 53_750_00);
    expect(overLowest(4_257_000_00, 3_934_500_00)).toBe("+8.2%");
    expect(overLowest(3_934_500_00, 3_934_500_00)).toBeNull();
  });
});

describe("estimates", () => {
  it("adds up quantity × unit price, rounding each line like the API", () => {
    expect(prEstimate([{ quantity: 4, estUnitPrice: 950_000_00 }, { quantity: 2.5, estUnitPrice: 333 }])).toBe(3_800_000_00 + 833);
  });
});

describe("payment terms", () => {
  it("takes a share of the total rounded down, or a fixed amount", () => {
    expect(termAmount({ pctBp: 3000, amount: null }, 3_934_500_00)).toBe(1_180_350_00);
    expect(termAmount({ pctBp: 3333, amount: null }, 100)).toBe(33);
    expect(termAmount({ pctBp: null, amount: 50_000_00 }, 3_934_500_00)).toBe(50_000_00);
  });

  it("checks the terms add up to the order, within ₦1", () => {
    expect(checkTerms([{ pctBp: 3000 }, { pctBp: 7000 }], 3_934_500_00)).toMatchObject({ ok: true, gap: 0 });
    expect(checkTerms([{ pctBp: 3000 }, { pctBp: 6000 }], 1_000_00)).toMatchObject({ ok: false, gap: 100_00 });
    expect(checkTerms([{ pctBp: 5000 }, { amount: 600_00 }], 1_000_00)).toMatchObject({ ok: false, gap: -100_00 });
    expect(checkTerms([{ pctBp: 3333 }, { pctBp: 3333 }, { pctBp: 3334 }], 100_01).ok).toBe(true);
    expect(checkTerms([], 100).ok).toBe(false);
  });

  it("reads a typed share as basis points", () => {
    expect(parsePct("30")).toBe(3000);
    expect(parsePct("12.5%")).toBe(1250);
    expect(parsePct("0")).toBeNull();
    expect(parsePct("101")).toBeNull();
    expect(parsePct("abc")).toBeNull();
  });
});

describe("receiving", () => {
  it("wants one serial per item accepted, when serials are given", () => {
    expect(serialProblem(4, [])).toBeNull();
    expect(serialProblem(4, ["A", "B", "C", "D"])).toBeNull();
    expect(serialProblem(4, ["A", "B", "C"])).toBe("3 serials for 4 accepted: give one for each item accepted.");
    expect(serialProblem(2, ["A", "A"])).toBe("A is entered twice.");
    expect(serialProblem(0, ["A"])).toBe("Nothing is accepted, so no serials are needed.");
    expect(splitSerials("A1\n A2 ,A3\n\n")).toEqual(["A1", "A2", "A3"]);
  });

  it("refuses more accepted and rejected than arrived, or more than is outstanding", () => {
    expect(receiptProblem(4, 3, 2, 4)).toBe("Accepted and rejected together are more than arrived.");
    expect(receiptProblem(6, 6, 0, 4)).toBe("Only 4 more can be accepted on this line.");
    expect(receiptProblem(4, 3, 1, 4)).toBeNull();
  });
});

describe("roads", () => {
  it("follows a request to ordered, and stops it where it was rejected", () => {
    expect(prRoad("award_pending")).toMatchObject({ done: 3, stopped: false });
    expect(prRoad("rejected")).toMatchObject({ done: 1, stopped: true });
  });

  it("follows an order to paid, and stops a short-closed one where it got to", () => {
    expect(poRoad({ status: "draft" }).done).toBe(0);
    expect(poRoad({ status: "sent" }).done).toBe(4);
    expect(poRoad({ status: "invoiced" }).done).toBe(7);
    expect(poRoad({ status: "paid" }).done).toBe(8);
    expect(poRoad({ ...poFull(), status: "short_closed" })).toMatchObject({ done: 7, stopped: true });
    expect(poRoad({ status: "cancelled", sentAt: null, acceptedAt: null, lines: [], invoices: [] })).toMatchObject({ done: 3, stopped: true });
  });
});

describe("order step dates", () => {
  it("dates each step from the order, its last approved receipt and its first matched invoice", () => {
    expect(poStepDates(poFull())).toEqual([
      "2026-09-21T10:00:00+00:00",
      null,
      "2026-09-21T15:00:00+00:00",
      "2026-09-22T09:00:00+00:00",
      "2026-09-22T09:00:00+00:00",
      "2026-09-29T13:00:00+00:00",
      "2026-10-01T10:00:00+00:00",
      null,
    ]);
  });
});
