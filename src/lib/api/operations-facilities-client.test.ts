import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, facilities, normaliseGenerators, opsFieldErrors } from "./operations-facilities-client";

/** The facilities client: routes, methods and bodies; the list's meta folded in; generators in one spelling. */

interface Call {
  url: string;
  method: string;
  body: unknown;
}

function stubFetch(reply: unknown = { data: {} }, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("facilities", () => {
  it("reads the sites with the kinds and the spend folded in", async () => {
    const calls = stubFetch({
      data: [{ id: "f1", name: "Head office", tank: 820.5, spaces: 4, lease: null }],
      meta: { kinds: { office: "Office" }, spend: { months: ["2026-10"], facilities: [] } },
    });
    const b = await facilities.list();
    expect(route(calls[0])).toBe("GET /api/operations/facilities");
    expect(b.facilities[0].tank).toBe(820.5);
    expect(b.kinds.office).toBe("Office");
    expect(b.spend.months).toEqual(["2026-10"]);
  });

  it("reads a site and puts its generators' tag numbers in one spelling", async () => {
    const calls = stubFetch({ data: { id: "f1", generators: [{ id: "g1", tag_no: "GEN-001", name: "Perkins 60kVA" }] } });
    const d = await facilities.get("f1");
    expect(route(calls[0])).toBe("GET /api/operations/facilities/f1");
    expect(d.generators).toEqual([{ id: "g1", tagNo: "GEN-001", name: "Perkins 60kVA" }]);
    expect(normaliseGenerators(null)).toEqual([]);
  });

  it("keeps sites and their rooms", async () => {
    const calls = stubFetch({ data: { id: "x" } });
    await facilities.create({ code: "HQ", name: "Head office", ownership: "leased", headcount: 40 });
    await facilities.update("f1", { headcount: 42 });
    await facilities.addSpace("f1", { name: "Board room", kind: "meeting_room", capacity: 12, bookable: true });
    await facilities.updateSpace("s1", { bookable: false });
    expect(calls.map(route)).toEqual([
      "POST /api/operations/facilities",
      "PATCH /api/operations/facilities/f1",
      "POST /api/operations/facilities/f1/spaces",
      "PATCH /api/operations/facilities/spaces/s1",
    ]);
    expect(calls[2].body).toEqual({ name: "Board room", kind: "meeting_room", capacity: 12, bookable: true });
  });

  it("reads bookings for a window and visitors for a day, and checks them in and out", async () => {
    const calls = stubFetch({ data: [] });
    await facilities.bookings({ from: "2026-10-05", to: "2026-10-12" });
    await facilities.visitors("2026-10-06");
    await facilities.visitors();
    await facilities.registerVisitor({ name: "Tunde Bello", company: "Zenith", hostId: "u1", expectedAt: "2026-10-06T10:00:00+01:00" });
    await facilities.checkIn("v1", "B-12");
    await facilities.checkIn("v2");
    await facilities.checkOut("v1");
    expect(calls.map(route)).toEqual([
      "GET /api/operations/facilities/bookings?from=2026-10-05&to=2026-10-12",
      "GET /api/operations/facilities/visitors?on=2026-10-06",
      "GET /api/operations/facilities/visitors",
      "POST /api/operations/facilities/visitors",
      "POST /api/operations/facilities/visitors/v1/check-in",
      "POST /api/operations/facilities/visitors/v2/check-in",
      "POST /api/operations/facilities/visitors/v1/check-out",
    ]);
    expect(calls[4].body).toEqual({ badgeNo: "B-12" });
    expect(calls[5].body).toEqual({});
  });

  it("keeps leases and contracts, and confirms or disputes a month", async () => {
    const calls = stubFetch({ data: [], meta: { services: { cleaning: "Cleaning" } } });
    const c = await facilities.contracts();
    expect(c.services.cleaning).toBe("Cleaning");
    await facilities.leases();
    await facilities.createLease({ facilityId: "f1", startsOn: "2026-01-01", endsOn: "2028-12-31", rent: 12_000_000_00, frequency: "annual", escalationBp: 1000, escalationEveryMonths: 12 });
    await facilities.updateLease("l1", { noticeDays: 90 });
    await facilities.createContract({ vendorId: "v1", service: "cleaning", startsOn: "2026-01-01", endsOn: "2026-12-31", periodAmount: 450_000_00 });
    await facilities.updateContract("c1", { status: "terminated" });
    await facilities.confirm("c1", { period: "2026-09", confirmed: false, rating: 2, notes: "Toilets not cleaned on two Fridays" });
    expect(calls.map(route)).toEqual([
      "GET /api/operations/facilities/contracts",
      "GET /api/operations/facilities/leases",
      "POST /api/operations/facilities/leases",
      "PATCH /api/operations/facilities/leases/l1",
      "POST /api/operations/facilities/contracts",
      "PATCH /api/operations/facilities/contracts/c1",
      "POST /api/operations/facilities/contracts/c1/confirm",
    ]);
    expect(calls[2].body).toMatchObject({ rent: 1_200_000_000, escalationBp: 1000 });
    expect(calls[6].body).toEqual({ period: "2026-09", confirmed: false, rating: 2, notes: "Toilets not cleaned on two Fridays" });
  });

  it("keeps utilities, their bills, and the diesel log; reads the reports and the pickers", async () => {
    const calls = stubFetch({ data: { id: "x", tank: 400 } });
    await facilities.createUtility({ facilityId: "f1", kind: "electricity", accountNo: "0123", billing: "prepaid", unit: "kWh" });
    await facilities.updateUtility("u1", { active: false });
    await facilities.addBill("u1", { month: "2026-09", amount: 380_000_00, units: 1450 });
    const d = await facilities.diesel({ kind: "diesel_used", facilityId: "f1", assetId: "g1", litres: 120, reading: 4310 });
    expect(d.tank).toBe(400);
    await facilities.reports();
    await facilities.options();
    expect(calls.map(route)).toEqual([
      "POST /api/operations/facilities/utilities",
      "PATCH /api/operations/facilities/utilities/u1",
      "POST /api/operations/facilities/utilities/u1/bills",
      "POST /api/operations/facilities/diesel",
      "GET /api/operations/facilities/reports",
      "GET /api/operations/me/options",
    ]);
    expect(calls[2].body).toEqual({ month: "2026-09", amount: 38_000_000, units: 1450 });
    expect(calls[3].body).toEqual({ kind: "diesel_used", facilityId: "f1", assetId: "g1", litres: 120, reading: 4310 });
  });

  it("surfaces Laravel's field errors in camelCase", async () => {
    stubFetch({ message: "The given data was invalid.", errors: { litres: ["The tank holds 80.0 litres by the log."] } }, 422);
    const err = await facilities.diesel({ kind: "diesel_used", facilityId: "f1", litres: 200 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(opsFieldErrors(err)).toEqual({ litres: "The tank holds 80.0 litres by the log." });
  });
});
