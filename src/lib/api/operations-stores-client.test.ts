import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, stores } from "./operations-stores-client";

/** The stores client: paths, methods and bodies as `StoreController` and `MyEquipmentController` take them. */

function stubFetch(body: unknown = { data: {} }, status = 200) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("stores client", () => {
  it("reads the desk, the ledger, reorder suggestions and consumption", async () => {
    const calls = stubFetch({ data: [] });
    await stores.desk();
    await stores.movements();
    await stores.movements({ itemId: "i-1" });
    await stores.movements({ itemId: "i-1", storeId: "s-1" });
    await stores.reorder();
    await stores.consumption();
    await stores.consumption({ from: "2026-05-01", to: "2026-10-06" });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/stores",
      "GET /api/operations/stores/movements",
      "GET /api/operations/stores/movements?itemId=i-1",
      "GET /api/operations/stores/movements?itemId=i-1&storeId=s-1",
      "GET /api/operations/stores/reorder",
      "GET /api/operations/stores/consumption",
      "GET /api/operations/stores/consumption?from=2026-05-01&to=2026-10-06",
    ]);
  });

  it("keeps the item master and the stores", async () => {
    const calls = stubFetch({ data: { id: "x" } });
    await stores.createItem({ code: "STA-001", name: "A4 paper", category: "stationery", unit: "ream", reorderLevel: 20, reorderQty: 50, critical: false });
    await stores.updateItem("i-1", { reorderLevel: 30 });
    await stores.createStore({ name: "Main store", location: "Admin block" });
    await stores.updateStore("s-1", { active: false });

    expect(calls[0]).toEqual({
      url: "/api/operations/stores/items",
      method: "POST",
      body: { code: "STA-001", name: "A4 paper", category: "stationery", unit: "ream", reorderLevel: 20, reorderQty: 50, critical: false },
    });
    expect(calls[1]).toEqual({ url: "/api/operations/stores/items/i-1", method: "PATCH", body: { reorderLevel: 30 } });
    expect(calls[2]).toEqual({ url: "/api/operations/stores", method: "POST", body: { name: "Main store", location: "Admin block" } });
    expect(calls[3]).toEqual({ url: "/api/operations/stores/s-1", method: "PATCH", body: { active: false } });
  });

  it("receives, transfers and drafts a restock request", async () => {
    const calls = stubFetch({ data: { id: "pr-7" } });
    await stores.receive({ storeId: "s-1", itemId: "i-1", quantity: 12.5, unitCost: 450_000 });
    await stores.transfer({ fromStoreId: "s-1", toStoreId: "s-2", itemId: "i-1", quantity: 3 });
    const pr = await stores.draftReorder([{ itemId: "i-1", quantity: 50 }]);
    await stores.draftReorder([{ itemId: "i-1", quantity: 50 }], "cc-1");

    expect(calls[0]).toEqual({ url: "/api/operations/stores/receipts", method: "POST", body: { storeId: "s-1", itemId: "i-1", quantity: 12.5, unitCost: 450_000 } });
    expect(calls[1]).toEqual({ url: "/api/operations/stores/transfers", method: "POST", body: { fromStoreId: "s-1", toStoreId: "s-2", itemId: "i-1", quantity: 3 } });
    expect(calls[2]).toEqual({ url: "/api/operations/stores/reorder", method: "POST", body: { lines: [{ itemId: "i-1", quantity: 50 }] } });
    expect(calls[3].body).toEqual({ lines: [{ itemId: "i-1", quantity: 50 }], costCentreId: "cc-1" });
    expect(pr.id).toBe("pr-7");
  });

  it("issues a requisition and buys the shortfall", async () => {
    const calls = stubFetch({ data: {} });
    await stores.requisitions.list();
    await stores.requisitions.list("approved");
    await stores.requisitions.get("rq-1");
    await stores.requisitions.issue("rq-1", { "rl-1": 2, "rl-2": 0.5 });
    await stores.requisitions.shortfall("rq-1");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/requisitions",
      "GET /api/operations/requisitions?status=approved",
      "GET /api/operations/requisitions/rq-1",
      "POST /api/operations/requisitions/rq-1/issue",
      "POST /api/operations/requisitions/rq-1/shortfall",
    ]);
    expect(calls[3].body).toEqual({ lines: { "rl-1": 2, "rl-2": 0.5 } });
  });

  it("starts, records, submits and decides a stock count", async () => {
    const calls = stubFetch({ data: {} });
    await stores.counts.list();
    await stores.counts.start({ storeId: "s-1", kind: "cycle" });
    await stores.counts.get("c-1");
    await stores.counts.record("c-1", { "cl-1": 4, "cl-2": null });
    await stores.counts.record("c-1", { "cl-1": 4 }, true);
    await stores.counts.decide("c-1", true);
    await stores.counts.decide("c-1", false, "Recount the toner shelf");

    expect(calls[1]).toEqual({ url: "/api/operations/stock-counts", method: "POST", body: { storeId: "s-1", kind: "cycle" } });
    expect(calls[2].url).toBe("/api/operations/stock-counts/c-1");
    expect(calls[3]).toEqual({ url: "/api/operations/stock-counts/c-1/lines", method: "POST", body: { lines: { "cl-1": 4, "cl-2": null } } });
    expect(calls[4].body).toEqual({ lines: { "cl-1": 4 }, submit: true });
    expect(calls[5]).toEqual({ url: "/api/operations/stock-counts/c-1/approve", method: "POST", body: { approve: true } });
    expect(calls[6].body).toEqual({ approve: false, note: "Recount the toner shelf" });
  });

  it("serves the staff side from operations/me", async () => {
    const calls = stubFetch({ data: { categories: [{ id: "ac-1", name: "Laptops" }] } });
    await stores.me.catalogue();
    await stores.me.requisitions();
    await stores.me.createRequisition({ storeId: "s-1", purpose: "Exam week", projectId: null, costCentreId: "cc-1", lines: [{ itemId: "i-1", quantity: 2 }] });
    await stores.me.acknowledge("siv-1");
    await stores.me.requisition("irq-1");
    const cats = await stores.me.assetCategories();

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/me/stores",
      "GET /api/operations/me/requisitions",
      "POST /api/operations/me/requisitions",
      "POST /api/operations/me/issues/siv-1/acknowledge",
      "GET /api/operations/me/requisitions/irq-1",
      "GET /api/operations/me/assets",
    ]);
    expect(calls[2].body).toEqual({ storeId: "s-1", purpose: "Exam week", projectId: null, costCentreId: "cc-1", lines: [{ itemId: "i-1", quantity: 2 }] });
    expect(cats).toEqual([{ id: "ac-1", name: "Laptops" }]);
    expect(stores.me.issuePdfUrl("siv-1")).toBe("/api/operations/me/issues/siv-1/pdf");
    expect(stores.requisitions.issuePdfUrl("siv-1")).toBe("/api/operations/issues/siv-1/pdf");
  });

  it("refuses with the API's status and message", async () => {
    stubFetch({ message: "SOD_VIOLATION: who counted cannot approve the count." }, 422);
    const e = await stores.counts.decide("c-1", true).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(422);
  });
});
