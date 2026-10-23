import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, maintenance, opsFieldErrors } from "./operations-maintenance-client";

/** The maintenance client: routes, methods and bodies, and errors read back on camelCase fields. */

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

describe("maintenance", () => {
  it("lists work orders with their filters and the board's summary", async () => {
    const calls = stubFetch({ data: [{ id: "w1" }], meta: { slaBreached: 2 } });
    const r = await maintenance.list({ status: "open", kind: "", assetId: "a1" });
    expect(r.workOrders).toEqual([{ id: "w1" }]);
    expect(r.meta.slaBreached).toBe(2);
    expect(route(calls[0])).toBe("GET /api/operations/maintenance?status=open&assetId=a1");
  });

  it("works a work order through its life", async () => {
    const calls = stubFetch({ data: { id: "w1" } });
    await maintenance.create({ assetId: "a1", title: "Screen flickers", priority: "high" });
    await maintenance.get("w1");
    await maintenance.update("w1", { diagnosis: "Loose ribbon", labourCost: 1_500_000 });
    await maintenance.assign("w1", { assigneeId: "u1", vendorId: null });
    await maintenance.start("w1");
    await maintenance.warranty("w1", "submitted", "Dell case 4411");
    await maintenance.warranty("w1", "not_applicable");
    await maintenance.addPart("w1", { source: "store", itemId: "i1", storeId: "s1", quantity: 2 });
    await maintenance.purchase("w1", 4_000_000);
    await maintenance.purchase("w1");
    await maintenance.complete("w1", "Replaced the ribbon", 1250);
    await maintenance.complete("w1", "Replaced the ribbon");
    await maintenance.confirm("w1");
    await maintenance.cancel("w1", "Raised twice");
    expect(calls.map(route)).toEqual([
      "POST /api/operations/maintenance",
      "GET /api/operations/maintenance/w1",
      "PATCH /api/operations/maintenance/w1",
      "POST /api/operations/maintenance/w1/assign",
      "POST /api/operations/maintenance/w1/start",
      "POST /api/operations/maintenance/w1/warranty",
      "POST /api/operations/maintenance/w1/warranty",
      "POST /api/operations/maintenance/w1/parts",
      "POST /api/operations/maintenance/w1/purchase",
      "POST /api/operations/maintenance/w1/purchase",
      "POST /api/operations/maintenance/w1/complete",
      "POST /api/operations/maintenance/w1/complete",
      "POST /api/operations/maintenance/w1/confirm",
      "POST /api/operations/maintenance/w1/cancel",
    ]);
    expect(calls[0].body).toEqual({ assetId: "a1", title: "Screen flickers", priority: "high" });
    expect(calls[5].body).toEqual({ outcome: "submitted", note: "Dell case 4411" });
    expect(calls[6].body).toEqual({ outcome: "not_applicable" });
    expect(calls[8].body).toEqual({ serviceEstimate: 4_000_000 });
    expect(calls[9].body).toEqual({});
    expect(calls[10].body).toEqual({ resolution: "Replaced the ribbon", usageAt: 1250 });
    expect(calls[11].body).toEqual({ resolution: "Replaced the ribbon" });
    expect(calls[13].body).toEqual({ reason: "Raised twice" });
  });

  it("reads and saves plans, readings, claims and the cost report", async () => {
    const calls = stubFetch({ data: [] });
    await maintenance.plans();
    await maintenance.createPlan({ name: "Generator service", assetId: "a1", everyUsage: 250, usageUnit: "hours" });
    await maintenance.updatePlan("p1", { active: false });
    await maintenance.readings("a1");
    await maintenance.addReading("a1", { reading: 1250, unit: "hours" });
    await maintenance.addReading("a1", { reading: 1300, unit: "hours", readOn: "2026-10-05" });
    await maintenance.claims();
    await maintenance.createClaim({ kind: "accident", incidentOn: "2026-10-01", incidentReport: "Rear-ended at Berger" });
    await maintenance.updateClaim("c1", { status: "settled", amountSettled: 50_000_000 });
    await maintenance.reports(40);
    await maintenance.reports();
    expect(calls.map(route)).toEqual([
      "GET /api/operations/maintenance/plans",
      "POST /api/operations/maintenance/plans",
      "PATCH /api/operations/maintenance/plans/p1",
      "GET /api/operations/assets/a1/readings",
      "POST /api/operations/assets/a1/readings",
      "POST /api/operations/assets/a1/readings",
      "GET /api/operations/maintenance/claims",
      "POST /api/operations/maintenance/claims",
      "PATCH /api/operations/maintenance/claims/c1",
      "GET /api/operations/maintenance/reports?threshold=40",
      "GET /api/operations/maintenance/reports",
    ]);
    expect(calls[4].body).toEqual({ reading: 1250, unit: "hours" });
    expect(calls[5].body).toEqual({ reading: 1300, unit: "hours", readOn: "2026-10-05" });
  });

  it("reads the facilities as id and name only", async () => {
    stubFetch({ data: [{ id: "f1", name: "Head office", spaces: 4 }] });
    expect(await maintenance.facilities()).toEqual([{ id: "f1", name: "Head office" }]);
  });

  it("throws the API's message with its fields camelCased", async () => {
    stubFetch({ message: "The given data was invalid.", errors: { warranty_claim: ["MPT/GEN/0002 is under warranty until 1 Jan 2027."] } }, 422);
    const err = await maintenance.update("w1", { vendorCost: 100 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(opsFieldErrors(err)).toEqual({ warrantyClaim: "MPT/GEN/0002 is under warranty until 1 Jan 2027." });
  });
});
