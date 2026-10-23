import { describe, it, expect } from "vitest";
import { formatMoney, formatMoneyCompact, majorText, parseMajor } from "@/lib/money";

/** Minor units + currency in, the right symbol and scale out (26 Sep 2026). */
describe("money", () => {
  it("formats naira from kobo", () => {
    expect(formatMoney(250_000_000, "NGN")).toBe("₦2,500,000");
    expect(formatMoney(1_999, "NGN")).toBe("₦19.99");
  });

  it("formats dollars from cents", () => {
    expect(formatMoney(1_050_000, "USD")).toBe("$10,500");
    expect(formatMoney(300_050, "USD")).toBe("$3,000.50");
  });

  it("reads missing amounts as a dash", () => {
    expect(formatMoney(null, "USD")).toBe("-");
    expect(formatMoney(undefined)).toBe("-");
  });

  it("compacts large figures", () => {
    expect(formatMoneyCompact(250_000_000, "NGN")).toBe("₦2.5M");
    expect(formatMoneyCompact(1_050_000, "USD")).toBe("$10.5K");
    expect(formatMoneyCompact(500_000_000, "NGN")).toBe("₦5M");
  });

  it("round-trips typed major units", () => {
    expect(parseMajor("2,500,000")).toBe(250_000_000);
    expect(parseMajor("$10,500.5")).toBe(1_050_050);
    expect(parseMajor("")).toBeNull();
    expect(parseMajor("12.345")).toBe("invalid");
    expect(parseMajor("-4")).toBe("invalid");
    expect(majorText(1_050_050)).toBe("10500.50");
    expect(majorText(250_000_000)).toBe("2500000");
  });
});
