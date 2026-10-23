import { describe, expect, it } from "vitest";
import { accounting, amount, day, monthLabel, parseAmount } from "./format";

describe("finance money formatting", () => {
  it("always shows two decimals", () => {
    expect(amount(123450000)).toBe("₦1,234,500.00");
    expect(amount(5, "USD")).toBe("$0.05");
    expect(amount(-23205375)).toBe("-₦232,053.75");
    expect(amount(null)).toBe("—");
  });

  it("brackets negatives in statement columns", () => {
    expect(accounting(-100000)).toBe("(1,000.00)");
    expect(accounting(100000)).toBe("1,000.00");
    expect(accounting(0, true)).toBe("–");
  });

  it("reads typed amounts as exact minor units", () => {
    expect(parseAmount("1,234.5")).toBe(123450);
    expect(parseAmount("₦232,053.75")).toBe(23205375);
    expect(parseAmount("0.1")).toBe(10);
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("formats dates and months", () => {
    expect(day("2026-09-03")).toBe("3 Sep 2026");
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-09", true)).toBe("Sep 2026");
  });
});
