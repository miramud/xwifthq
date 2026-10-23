import { afterEach, describe, expect, it, vi } from "vitest";
import { fleet } from "./operations-fleet-client";

/** The fleet client: routes, methods and bodies; the board's papers and unregistered vehicles in one spelling. */

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
      return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("fleet", () => {
  it("reads the board, with the papers from meta and unregistered vehicles camelCased", async () => {
    const calls = stubFetch({
      data: { vehicles: [], efficiency: [], bookings: [], unregistered: [{ id: "a9", tag_no: "MPT/VEH/0009", name: "Toyota Hilux" }] },
      meta: { papers: { licence: "Vehicle licence" } },
    });
    const b = await fleet.board();
    expect(route(calls[0])).toBe("GET /api/operations/fleet");
    expect(b.unregistered).toEqual([{ id: "a9", tagNo: "MPT/VEH/0009", name: "Toyota Hilux" }]);
    expect(b.papers).toEqual({ licence: "Vehicle licence" });
  });

  it("adds a vehicle, its papers, trips and fuel, and decides a booking", async () => {
    const calls = stubFetch({ data: { id: "v1" } });
    await fleet.create({ assetId: "a9", registrationNo: "ABC-123-XY", pool: true, papers: ["licence", "insurance"] });
    await fleet.get("v1");
    await fleet.update("v1", { driverId: "u1" });
    await fleet.addPaper("v1", "hackney");
    await fleet.addTrip("v1", { purpose: "Site visit", projectId: "p1", startOdometer: 1000, endOdometer: 1042 });
    await fleet.addFuel("v1", { litres: 40, amount: 3_400_000, paidVia: "card" });
    await fleet.decide("b1", true, "u2");
    await fleet.decide("b2", false);
    expect(calls.map(route)).toEqual([
      "POST /api/operations/fleet",
      "GET /api/operations/fleet/v1",
      "PATCH /api/operations/fleet/v1",
      "POST /api/operations/fleet/v1/papers",
      "POST /api/operations/fleet/v1/trips",
      "POST /api/operations/fleet/v1/fuel",
      "POST /api/operations/fleet/bookings/b1/decide",
      "POST /api/operations/fleet/bookings/b2/decide",
    ]);
    expect(calls[3].body).toEqual({ kind: "hackney" });
    expect(calls[6].body).toEqual({ approve: true, driverId: "u2" });
    expect(calls[7].body).toEqual({ approve: false });
  });
});
