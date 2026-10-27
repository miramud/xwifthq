import { describe, expect, it } from "vitest";
import {
  BANDS,
  MODULE_COUNTS,
  bandFor,
  careYearly,
  cloudRate,
  cloudYearly,
  formatPrice,
  onboardingFor,
  ownBreakEvenYears,
  ownLicence,
  ownTotal,
  rentToOwnPayment,
} from "./price-book";

/**
 * Every expectation here is a figure printed in the Pricing & Go-To-Market
 * Strategy (23 Oct 2026): the price tables in Section 6 and the worked
 * examples in 6.10 and Section 4. If one of these fails, the page no longer
 * says what the paper says.
 */
describe("price book", () => {
  const band = (key: string) => BANDS.find((b) => b.key === key)!;

  it("prices Cloud per employee at the paper's module shares", () => {
    expect(MODULE_COUNTS.map((m) => cloudRate("NG", m))).toEqual([330_000, 570_000, 740_000, 860_000, 950_000]);
    expect(MODULE_COUNTS.map((m) => cloudRate("AFR", m))).toEqual([300, 510, 660, 770, 850]);
    expect(MODULE_COUNTS.map((m) => cloudRate("INT", m))).toEqual([560, 960, 1_250, 1_440, 1_600]);
  });

  it("prices Own by band and module count", () => {
    const naira = (key: string) => MODULE_COUNTS.map((m) => ownLicence(band(key), "NG", m) / 100);
    expect(naira("starter")).toEqual([1_600_000, 2_700_000, 3_500_000, 4_100_000, 4_500_000]);
    expect(naira("growth")).toEqual([4_400_000, 7_500_000, 9_800_000, 11_300_000, 12_500_000]);
    expect(naira("business")).toEqual([12_300_000, 21_000_000, 27_300_000, 31_500_000, 35_000_000]);
    expect(naira("enterprise")).toEqual([24_500_000, 42_000_000, 54_600_000, 63_000_000, 70_000_000]);

    expect(BANDS.map((b) => ownLicence(b, "AFR", 1) / 100)).toEqual([1_400, 4_000, 11_200, 22_400]);
    expect(BANDS.map((b) => ownLicence(b, "INT", 1) / 100)).toEqual([2_800, 7_700, 21_000, 42_000]);
  });

  it("finds the band for a headcount", () => {
    expect(bandFor(25)?.key).toBe("starter");
    expect(bandFor(26)?.key).toBe("growth");
    expect(bandFor(300)?.key).toBe("business");
    expect(bandFor(1000)?.key).toBe("enterprise");
    expect(bandFor(1001)).toBeNull();
  });

  it("bills an 18-person agency on three Cloud modules ₦1,598,400 a year", () => {
    expect(cloudYearly("NG", 3, 18)).toBe(159_840_000);
    expect(onboardingFor(18).label).toBe("Quick Start");
  });

  it("prices a 60-person NGO on four modules: Growth licence ₦11.3m, or Cloud about ₦5.9m a year", () => {
    expect(ownLicence(bandFor(60)!, "NG", 4)).toBe(1_130_000_000);
    expect(cloudYearly("NG", 4, 60)).toBe(588_240_000);
  });

  it("prices a 220-staff polytechnic on the full suite with graduated volume", () => {
    // 50 × ₦9,500 + 150 × ₦6,650 + 20 × ₦4,750 a month
    expect(cloudYearly("NG", 5, 220)).toBe(1_881_000_000);
    const licence = ownLicence(bandFor(220)!, "NG", 5);
    expect(licence).toBe(3_500_000_000);
    expect(careYearly(licence)).toBe(700_000_000);
    expect(ownTotal(licence, 5)).toBe(6_300_000_000);
  });

  it("prices an 80-person London consultancy on the International list at $10,650 a year", () => {
    expect(cloudYearly("INT", 3, 80)).toBe(1_065_000);
  });

  it("matches the five-year comparison at 50 employees", () => {
    expect(cloudYearly("NG", 5, 50)! * 5).toBe(2_850_000_000);
    expect(ownTotal(ownLicence(bandFor(50)!, "NG", 5), 5)).toBe(2_250_000_000);
    // "Owning beats renting after about three years for a 50-person company ... about two and a half at 200."
    expect(ownBreakEvenYears(1_250_000_000, cloudYearly("NG", 5, 50)!)).toBeCloseTo(3.1, 1);
    expect(ownBreakEvenYears(3_500_000_000, cloudYearly("NG", 5, 200)!)).toBeCloseTo(2.6, 1);
  });

  it("bills fewer than ten employees as ten, and quotes above 500", () => {
    expect(cloudYearly("NG", 5, 4)).toBe(cloudYearly("NG", 5, 10));
    expect(cloudYearly("NG", 5, 501)).toBeNull();
  });

  it("spreads a rent-to-own licence over 12 payments at +8%", () => {
    // Hope Health: ₦9.61m after the NGO discount; the paper rounds the ₦864,900 payment to ₦864,000.
    expect(rentToOwnPayment(961_000_000, 12, 8)).toBe(86_490_000);
  });

  it("formats naira whole and dollar rates with cents", () => {
    expect(formatPrice(950_000, "NG")).toBe("₦9,500");
    expect(formatPrice(850, "AFR", { cents: true })).toBe("$8.50");
    expect(formatPrice(2_200_000, "INT")).toBe("$22,000");
  });
});
