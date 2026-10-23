import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, assetRequests, assets, exitClearances, gatePasses, myAssets, normaliseBook, opsFieldErrors, verifications } from "./operations-assets-client";

/** The assets client: routes, methods and bodies, Finance's book in one spelling, and errors on camelCase fields. */

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

describe("assets", () => {
  it("reads the register with its filters and works an asset through its life", async () => {
    const calls = stubFetch({ data: { id: "a1", book: null }, meta: { total: 3 } });
    const list = await assets.list({ status: "in_store", categoryId: "c1", q: "" });
    await assets.get("a1");
    await assets.create({ categoryId: "c1", name: "Dell Latitude 5440", cost: 95_000_000 });
    await assets.update("a1", { location: "Abuja office" });
    await assets.tag("a1");
    await assets.tag("a1", "Store room 2");
    await assets.allocate("a1", { toUserId: "u1", accessories: "Charger, bag", condition: "new" });
    await assets.transfer("a1", { projectId: "p1" });
    await assets.returnToStore("a1", { condition: "fair" });
    await assets.setStatus("a1", "lost", "Left in a taxi on 3 Oct.");
    await assets.setStatus("a1", "back");
    expect(list.meta.total).toBe(3);
    expect(calls.map(route)).toEqual([
      "GET /api/operations/assets?status=in_store&categoryId=c1",
      "GET /api/operations/assets/a1",
      "POST /api/operations/assets",
      "PATCH /api/operations/assets/a1",
      "POST /api/operations/assets/a1/tag",
      "POST /api/operations/assets/a1/tag",
      "POST /api/operations/assets/a1/allocate",
      "POST /api/operations/assets/a1/transfer",
      "POST /api/operations/assets/a1/return",
      "POST /api/operations/assets/a1/status",
      "POST /api/operations/assets/a1/status",
    ]);
    expect(calls[4].body).toEqual({});
    expect(calls[5].body).toEqual({ location: "Store room 2" });
    expect(calls[6].body).toEqual({ toUserId: "u1", accessories: "Charger, bag", condition: "new" });
    expect(calls[9].body).toEqual({ status: "lost", note: "Left in a taxi on 3 Oct." });
    expect(calls[10].body).toEqual({ status: "back" });
  });

  it("puts Finance's snake_case book into one spelling", async () => {
    stubFetch({ data: { id: "a1", book: { cost: 100, accumulated: 25, nbv: 75, rate_bp: 2500, status: "active", capitalised_on: "2026-01-02", class: "ICT equipment", gain_loss: null } } });
    const a = await assets.get("a1");
    expect(a.book).toEqual({ cost: 100, accumulated: 25, nbv: 75, rateBp: 2500, status: "active", capitalisedOn: "2026-01-02", class: "ICT equipment", gainLoss: null });
    expect(normaliseBook(null)).toBeNull();
    expect(normaliseBook({ cost: 1, accumulated: 0, nbv: 1, rateBp: 1000 })?.rateBp).toBe(1000);
  });

  it("keeps categories and kits, and removes a kit", async () => {
    const calls = stubFetch({ data: [] });
    await assets.categories();
    await assets.createCategory({ code: "LAP", name: "Laptops", kind: "capital", assetClass: "ict" });
    await assets.updateCategory("c1", { active: false });
    await assets.kits();
    await assets.createKit({ name: "Engineer", jobTitleIds: ["j1"], items: [{ categoryId: "c1", quantity: 1 }] });
    await assets.updateKit("k1", { name: "Engineer", jobTitleIds: [], items: [{ categoryId: "c1", quantity: 2 }] });
    await assets.options();
    expect(calls.map(route)).toEqual([
      "GET /api/operations/assets/categories",
      "POST /api/operations/assets/categories",
      "PATCH /api/operations/assets/categories/c1",
      "GET /api/operations/assets/kits",
      "POST /api/operations/assets/kits",
      "PATCH /api/operations/assets/kits/k1",
      "GET /api/operations/me/options",
    ]);
    const del = stubFetch(null, 204);
    await expect(assets.deleteKit("k1")).resolves.toBeUndefined();
    expect(del.map(route)).toEqual(["DELETE /api/operations/assets/kits/k1"]);
  });
});

describe("asset requests and gate passes", () => {
  it("lists with the desk's meta, fulfils, converts and cancels", async () => {
    const calls = stubFetch({ data: [], meta: { kinds: { allocation: "New allocation" }, toFulfil: 2 } });
    const r = await assetRequests.list({ status: "approved" });
    await assetRequests.get("r1");
    await assetRequests.create({ kind: "disposal", assetId: "a1", disposalMethod: "sale", proceeds: 5_000_000, reason: "Screen cracked" });
    await assetRequests.submit("r1");
    await assetRequests.fulfil("r1", { assetIds: ["a1", "a2"], accessories: "Charger" });
    await assetRequests.convert("r1");
    await assetRequests.cancel("r1");
    expect(r.meta.toFulfil).toBe(2);
    expect(calls.map(route)).toEqual([
      "GET /api/operations/asset-requests?status=approved",
      "GET /api/operations/asset-requests/r1",
      "POST /api/operations/asset-requests",
      "POST /api/operations/asset-requests/r1/submit",
      "POST /api/operations/asset-requests/r1/fulfil",
      "POST /api/operations/asset-requests/r1/convert",
      "POST /api/operations/asset-requests/r1/cancel",
    ]);
    expect(calls[4].body).toEqual({ assetIds: ["a1", "a2"], accessories: "Charger" });
  });

  it("reads open passes, the printable pass, and checks one in", async () => {
    const calls = stubFetch({ data: [] });
    await gatePasses.list();
    await gatePasses.list(true);
    await gatePasses.get("g1");
    await gatePasses.checkIn("g1", "good");
    await gatePasses.checkIn("g1");
    expect(calls.map(route)).toEqual([
      "GET /api/operations/gate-passes",
      "GET /api/operations/gate-passes?open=1",
      "GET /api/operations/gate-passes/g1",
      "POST /api/operations/gate-passes/g1/check-in",
      "POST /api/operations/gate-passes/g1/check-in",
    ]);
    expect(calls[3].body).toEqual({ condition: "good" });
    expect(calls[4].body).toEqual({});
  });
});

describe("verification and exit clearance", () => {
  it("opens a campaign, records what was found, filters by result, and closes it", async () => {
    const calls = stubFetch({ data: { id: "v1" } });
    await verifications.list();
    await verifications.open({ name: "Q4 count", startsOn: "2026-10-06", endsOn: "2026-10-20" });
    await verifications.get("v1");
    await verifications.get("v1", "missing");
    await verifications.record("v1", "i1", { found: true, foundLocation: "Lagos office", condition: "good" });
    await verifications.close("v1");
    expect(calls.map(route)).toEqual([
      "GET /api/operations/verifications",
      "POST /api/operations/verifications",
      "GET /api/operations/verifications/v1",
      "GET /api/operations/verifications/v1?result=missing",
      "POST /api/operations/verifications/v1/items/i1",
      "POST /api/operations/verifications/v1/close",
    ]);
  });

  it("settles items and signs off a clearance", async () => {
    const calls = stubFetch({ data: { id: "x1" } });
    await exitClearances.list();
    await exitClearances.list("open");
    await exitClearances.get("x1");
    await exitClearances.open({ userId: "u1", leavingOn: "2026-10-31" });
    await exitClearances.decide("x1", "i1", { status: "deduct", value: 12_000_000, note: "Lost phone" });
    await exitClearances.sign("x1", "hod");
    expect(calls.map(route)).toEqual([
      "GET /api/operations/exit-clearances",
      "GET /api/operations/exit-clearances?status=open",
      "GET /api/operations/exit-clearances/x1",
      "POST /api/operations/exit-clearances",
      "POST /api/operations/exit-clearances/x1/items/i1",
      "POST /api/operations/exit-clearances/x1/sign",
    ]);
    expect(calls[5].body).toEqual({ area: "hod" });
  });
});

describe("my assets", () => {
  it("reads what I hold, signs a handover, confirms by tag, and asks for things", async () => {
    const calls = stubFetch({ data: [], meta: { kinds: { replacement: "Replacement" } } });
    await myAssets.get();
    await myAssets.acknowledge("m1");
    await myAssets.verify("MPT/LAP/0001");
    await myAssets.verify("a1", "fair");
    const mine = await myAssets.requests();
    await myAssets.request({ kind: "take_out", assetId: "a1", returnBy: "2026-10-10", toLocation: "Client site" });
    await myAssets.cancel("r1");
    await myAssets.show("r1");
    expect(mine.kinds).toEqual({ replacement: "Replacement" });
    expect(calls.map(route)).toEqual([
      "GET /api/operations/me/assets",
      "POST /api/operations/me/handovers/m1/acknowledge",
      "POST /api/operations/me/assets/verify",
      "POST /api/operations/me/assets/verify",
      "GET /api/operations/me/asset-requests",
      "POST /api/operations/me/asset-requests",
      "POST /api/operations/me/asset-requests/r1/cancel",
      "GET /api/operations/me/asset-requests/r1",
    ]);
    expect(calls[2].body).toEqual({ asset: "MPT/LAP/0001" });
    expect(calls[3].body).toEqual({ asset: "a1", condition: "fair" });
  });

  it("points every printable at its PDF, the desk's and my own", () => {
    expect(assets.movementPdfUrl("m1")).toBe("/api/operations/assets/movements/m1/pdf");
    expect(gatePasses.pdfUrl("g1")).toBe("/api/operations/gate-passes/g1/pdf");
    expect(myAssets.handoverPdfUrl("m1")).toBe("/api/operations/me/handovers/m1/pdf");
    expect(myAssets.gatePassPdfUrl("g1")).toBe("/api/operations/me/gate-passes/g1/pdf");
  });

  it("puts a refusal back on its camelCase field", async () => {
    stubFetch({ message: "Invalid.", errors: { returnBy: ["Say when it comes back."] } }, 422);
    const err = await myAssets.request({ kind: "take_out", assetId: "a1" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(opsFieldErrors(err)).toEqual({ returnBy: "Say when it comes back." });
  });
});
