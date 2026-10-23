import { describe, expect, it } from "vitest";
import { csvAmount, csvDate, csvName, toCsv } from "./csv";

describe("csv", () => {
  it("quotes what needs quoting and leaves the rest", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", null, 3], ["line\nbreak"]])).toBe('a,"say ""hi""","x,y",,3\r\n"line\nbreak"');
  });
  it("writes money in major units and dates as ISO", () => {
    expect(csvAmount(123450)).toBe("1234.50");
    expect(csvAmount(null)).toBe("");
    expect(csvDate("2026-10-07T09:30:00Z")).toBe("2026-10-07");
    expect(csvDate(null)).toBe("");
    expect(csvName("vouchers", "", "paid", null)).toBe("vouchers_paid.csv");
  });
});
