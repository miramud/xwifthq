import { describe, expect, it } from "vitest";
import { bpFromPct, lineFigures, memoRoom, pct, pipeline, signatures, sumFigures, tableRate, whtOn } from "./meta";
import { amountInWords, integerWords } from "./words";

/** The voucher arithmetic must agree with the API to the kobo. */

describe("withholding tax", () => {
  it("is on the amount before VAT, half up to the kobo", () => {
    // ₦1,000,000.00 at 10% technical services.
    expect(whtOn(100_000_000, 1000)).toBe(10_000_000);
    // 333.33 at 5% = 16.6665 → 16.67
    expect(whtOn(33_333, 500)).toBe(1_667);
    expect(whtOn(0, 500)).toBe(0);
    expect(whtOn(10_000, 0)).toBe(0);
  });

  it("nets gross plus VAT less WHT, and draws gross plus VAT on the memo", () => {
    const a = lineFigures(100_000_000, 7_500_000, 1000);
    expect(a).toEqual({ gross: 100_000_000, vat: 7_500_000, rateBp: 1000, wht: 10_000_000, net: 97_500_000 });
    const t = sumFigures([a, lineFigures(20_000_000, 0, 500)]);
    expect(t).toEqual({ gross: 120_000_000, vat: 7_500_000, wht: 11_000_000, net: 116_500_000, draw: 127_500_000 });
  });

  it("looks up the table rate by class and payee kind", () => {
    const rates = [
      { code: "consultancy", label: "Consultancy", payeeKind: "company" as const, rateBp: 1000 },
      { code: "consultancy", label: "Consultancy", payeeKind: "individual" as const, rateBp: 500 },
    ];
    expect(tableRate(rates, "consultancy", "company")).toBe(1000);
    expect(tableRate(rates, "consultancy", "individual")).toBe(500);
    expect(tableRate(rates, "none", "company")).toBe(0);
    expect(tableRate(rates, "rent", "company")).toBeNull();
  });

  it("reads and writes rates as percentages", () => {
    expect(pct(500)).toBe("5%");
    expect(pct(250)).toBe("2.5%");
    expect(pct(1000)).toBe("10%");
    expect(bpFromPct("7.5")).toBe(750);
    expect(bpFromPct("10%")).toBe(1000);
    expect(bpFromPct("abc")).toBeNull();
    expect(bpFromPct("101")).toBeNull();
  });
});

describe("memo room", () => {
  it("is the approved amount less every other live voucher on the memo", () => {
    const memo = {
      approvedAmount: 50_000_000,
      amount: 60_000_000,
      vouchers: [
        { id: "a", status: "approved" as const, amount: 20_000_000 },
        { id: "b", status: "cancelled" as const, amount: 10_000_000 },
        { id: "c", status: "draft" as const, amount: 5_000_000 },
      ],
    };
    expect(memoRoom(memo)).toBe(25_000_000);
    // Editing voucher c: its own draw doesn't count against it.
    expect(memoRoom(memo, "c")).toBe(30_000_000);
  });
});

describe("pipeline", () => {
  it("marks each stage done, current or to come", () => {
    expect(pipeline("draft")).toEqual(["current", "todo", "todo", "todo", "todo", "todo"]);
    expect(pipeline("in_approval")).toEqual(["done", "done", "current", "todo", "todo", "todo"]);
    expect(pipeline("payment_initiated")).toEqual(["done", "done", "done", "done", "done", "current"]);
    expect(pipeline("paid_confirmed")).toEqual(["done", "done", "done", "done", "done", "done"]);
    expect(pipeline("cancelled")).toBeNull();
  });

  it("finds each signature in the history", () => {
    const sigs = signatures(
      [
        { from: null, to: "draft", by: "Ada", comment: null, at: "2026-10-01T09:00:00Z" },
        { from: "draft", to: "submitted_to_fcu", by: "Ada", comment: null, at: "2026-10-01T10:00:00Z" },
        { from: "submitted_to_fcu", to: "fcu_checked", by: "Bola", comment: null, at: "2026-10-02T10:00:00Z" },
        { from: "in_approval", to: "approved", by: null, comment: null, at: "2026-10-03T10:00:00Z" },
      ],
      "Ada",
    );
    expect(sigs.map((s) => [s.label, s.by, s.signed])).toEqual([
      ["Prepared", "Ada", true],
      ["FCU checked", "Bola", true],
      ["Authorised", "The approval process", true],
      ["Paid", null, false],
      ["Confirmed", null, false],
    ]);
  });
});

describe("amount in words", () => {
  it("writes naira and kobo the way a voucher does", () => {
    expect(integerWords(0)).toBe("zero");
    expect(integerWords(105)).toBe("one hundred and five");
    expect(integerWords(1_000_005)).toBe("one million and five");
    expect(integerWords(250_000)).toBe("two hundred and fifty thousand");
    expect(amountInWords(193_000_000_00)).toBe("One hundred and ninety-three million naira only");
    expect(amountInWords(2_350_050_50)).toBe("Two million, three hundred and fifty thousand and fifty naira and fifty kobo only");
    expect(amountInWords(2_350_500_00)).toBe("Two million, three hundred and fifty thousand, five hundred naira only");
    expect(amountInWords(1)).toBe("Zero naira and one kobo only");
  });
});
