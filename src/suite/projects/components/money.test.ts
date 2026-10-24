import { describe, it, expect } from "vitest";
import { duration, hours, money, moneyRounded, rate, toMajor, toMinor } from "./money";

/**
 * Rendering money.
 *
 * Minor units in, string out, and nothing here does arithmetic on a total , 
 * dividing by a hundred is the last thing that happens to a figure so that no
 * screen invents its own rounding.
 */
describe("money", () => {
  it("renders cents and kobo with the right symbol", () => {
    expect(money(2000, "USD")).toBe("$20.00");
    expect(money(158050, "NGN")).toBe("₦1,580.50");
  });

  /**
   * `$20` and `$20.00` in the same column read as different precisions of the
   * same number. In a cost report they are the same number.
   */
  it("keeps the decimals on a whole amount", () => {
    expect(money(2000, "USD")).toBe("$20.00");
    expect(money(100, "USD")).toBe("$1.00");
  });

  it("marks a negative amount without a hyphen that reads as a dash", () => {
    expect(money(-2500, "USD")).toBe("−$25.00");
  });

  /** An unknown currency is named rather than rendered with a wrong symbol. */
  it("names a currency it has no symbol for", () => {
    expect(money(1000, "GBP")).toBe("GBP 10.00");
  });

  /**
   * A headline figure is rounded; a per-row figure is not. A column of rounded
   * rows that does not add up to its own total is worse than a long number.
   */
  it("rounds only for a headline", () => {
    expect(moneyRounded(4138261700, "NGN")).toBe("₦41,382,617");
    expect(money(4138261700, "NGN")).toBe("₦41,382,617.00");
  });

  it("gives a rate its unit, because a rate and an amount look the same", () => {
    expect(rate(2000, "USD")).toBe("$20.00/h");
  });

  /** A timesheet is read at a glance; trailing zeros are noise. */
  it("renders hours the way somebody writes them", () => {
    expect(hours(1.5)).toBe("1.5h");
    expect(hours(2)).toBe("2h");
    expect(hours(0.25)).toBe("0.25h");
    expect(hours(137.75)).toBe("137.75h");
  });

  /** Exact duration for one row; `hours()` for a total. */
  it("renders a single duration in hours and minutes", () => {
    expect(duration(90)).toBe("1h 30m");
    expect(duration(60)).toBe("1h");
    expect(duration(45)).toBe("45m");
    expect(duration(125)).toBe("2h 5m");
  });

  /**
   * A form has to round-trip exactly, or a rate typed as 20.5 comes back as
   * 20.499999 and somebody re-saves a different number than they read.
   */
  it("round-trips a form field exactly", () => {
    expect(toMajor(2050)).toBe("20.5");
    expect(toMinor("20.5")).toBe(2050);
    expect(toMinor(toMajor(2050))).toBe(2050);
    expect(toMajor(2000)).toBe("20");
    expect(toMinor("20")).toBe(2000);
  });

  /** A browser number input will hand back a float with a tail on it. */
  it("rounds a float the browser invented", () => {
    expect(toMinor(20.499999999)).toBe(2050);
    expect(toMinor("not a number")).toBe(0);
  });
});
