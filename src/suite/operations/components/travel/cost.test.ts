import { describe, expect, it } from "vitest";
import { leadTime, tripCost, tripDays } from "./cost";
import { RATES } from "./fixtures";

/** The trip cost preview mirrors `TravelRequests::cost`: DTA a day, hotel a night, the taxi both ways. */

const abuja = {
  rates: RATES,
  destinationClass: "local_tier1",
  departsOn: "2026-10-13",
  returnsOn: "2026-10-15",
  legs: [{ mode: "air" }, { mode: "air" }],
  travellers: [
    { userId: "u-efe", grade: "senior" },
    { userId: "u-yusuf", grade: "officer" },
  ],
  flightsEstimate: 36_000_000,
};

describe("tripCost", () => {
  it("costs the demo's Abuja trip to the kobo the API stored", () => {
    const c = tripCost(abuja);
    expect(c.days).toBe(3);
    expect(c.nights).toBe(2);
    expect(c.air).toBe(true);
    expect(c.travellers.map((t) => [t.dta, t.hotel, t.taxi, t.total])).toEqual([
      [9_750_000, 11_700_000, 3_000_000, 24_450_000],
      [7_500_000, 9_000_000, 3_000_000, 19_500_000],
    ]);
    expect(c.advance).toBe(43_950_000);
    expect(c.estimate).toBe(79_950_000);
    expect(c.overPolicy).toBe(false);
  });

  it("drops the airport taxi for a local trip by road, and keeps it abroad whatever the legs", () => {
    expect(tripCost({ ...abuja, legs: [{ mode: "road" }] }).travellers[0].taxi).toBe(0);
    expect(tripCost({ ...abuja, legs: [] }).air).toBe(false);
    const accra = tripCost({ ...abuja, destinationClass: "intl_africa", legs: [{ mode: "road" }], travellers: [{ userId: "u", grade: "officer" }] });
    expect(accra.air).toBe(true);
    expect(accra.travellers[0].taxi).toBe(8_000_000);
  });

  it("charges a one-day trip DTA for the day and no hotel", () => {
    const c = tripCost({ ...abuja, returnsOn: "2026-10-13", travellers: [{ userId: "u", grade: "officer" }] });
    expect([c.days, c.nights]).toEqual([1, 0]);
    expect(c.travellers[0].dta).toBe(2_500_000);
    expect(c.travellers[0].hotel).toBe(0);
  });

  it("flags a hand-set DTA or hotel above policy, and not one below", () => {
    const over = tripCost({ ...abuja, travellers: [{ userId: "u", grade: "officer", hotel: 12_000_000 }] });
    expect(over.overPolicy).toBe(true);
    expect(over.travellers[0]).toMatchObject({ hotel: 12_000_000, policyHotel: 9_000_000, hotelOver: true, dtaOver: false, over: true });
    expect(over.travellers[0].total).toBe(7_500_000 + 12_000_000 + 3_000_000);

    const under = tripCost({ ...abuja, travellers: [{ userId: "u", grade: "officer", dta: 5_000_000, hotel: null }] });
    expect(under.overPolicy).toBe(false);
    expect(under.travellers[0].dta).toBe(5_000_000);
    expect(under.travellers[0].hotel).toBe(9_000_000);
  });

  it("says when a grade has no rate for the destination", () => {
    const c = tripCost({ ...abuja, destinationClass: "intl_africa", travellers: [{ userId: "u", grade: "senior" }] });
    expect(c.missingRate).toBe(true);
    expect(c.travellers[0].rate).toBeNull();
  });

  it("counts no days until both dates are set the right way round", () => {
    expect(tripDays("", "2026-10-15")).toBe(0);
    expect(tripDays("2026-10-15", "2026-10-13")).toBe(0);
    expect(tripDays("2026-09-30", "2026-10-02")).toBe(3);
  });
});

describe("leadTime", () => {
  it("wants 7 days' notice at home and 21 abroad", () => {
    expect(leadTime("2026-10-13", "local_tier1", "2026-10-06")).toEqual({ lead: 7, daysAway: 7, late: false, international: false });
    expect(leadTime("2026-10-12", "local_tier1", "2026-10-06")?.late).toBe(true);
    expect(leadTime("2026-10-20", "intl_africa", "2026-10-06")).toMatchObject({ lead: 21, daysAway: 14, late: true, international: true });
    expect(leadTime("2026-10-27", "intl_europe", "2026-10-06")?.late).toBe(false);
  });

  it("waits for a departure date", () => {
    expect(leadTime("", "local_tier1", "2026-10-06")).toBeNull();
  });
});
