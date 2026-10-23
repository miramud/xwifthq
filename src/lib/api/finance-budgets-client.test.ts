import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  budgets,
  cashForecast,
  checkQuery,
  cumulative,
  favourable,
  isBudgetExceeded,
  itemsByKind,
  kindTotals,
  monthVariance,
  operationsCompliance,
  spreadAnnual,
  versionText,
  type ForecastItem,
} from "./finance-budgets-client";

/** Budgets and the cash forecast: paths, methods and bodies as `BudgetController` and `CashForecastController` take them. */

function stubFetch(body: unknown = { data: {} }, status = 200) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("budgets client", () => {
  it("reads the years, a budget with its filters, and starts one", async () => {
    const calls = stubFetch({ data: { id: "b-1" } });
    await budgets.list();
    await budgets.get("b-1");
    await budgets.get("b-1", { costCentreId: "cc-ops", projectId: null });
    await budgets.create({ fiscalYear: 2026 });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/finance/budgets",
      "GET /api/finance/budgets/b-1",
      "GET /api/finance/budgets/b-1?costCentreId=cc-ops",
      "POST /api/finance/budgets",
    ]);
    expect(calls[3].body).toEqual({ fiscalYear: 2026 });
  });

  it("saves a row, refreshes revenue, submits and sets a control", async () => {
    const calls = stubFetch({ data: { id: "b-1" } });
    await budgets.saveRow("b-1", { accountId: "a-6100", costCentreId: "cc-ops", months: { "2026-01": 100_00 } });
    await budgets.refreshRevenue("b-1");
    await budgets.submit("b-1");
    await budgets.setControl("a-6100", "block");
    await budgets.setControl("a-6100", "off");

    expect(calls[0]).toEqual({ url: "/api/finance/budgets/b-1/rows", method: "PUT", body: { accountId: "a-6100", costCentreId: "cc-ops", months: { "2026-01": 100_00 } } });
    expect(calls[1]).toEqual({ url: "/api/finance/budgets/b-1/revenue", method: "POST", body: {} });
    expect(calls[2]).toEqual({ url: "/api/finance/budgets/b-1/submit", method: "POST", body: {} });
    expect(calls[3]).toEqual({ url: "/api/finance/budgets/controls", method: "PUT", body: { accountId: "a-6100", mode: "block" } });
    expect(calls[4].body).toEqual({ accountId: "a-6100", mode: "off" });
  });

  it("asks the check with Laravel's array query", async () => {
    const calls = stubFetch({ data: { result: "ok", lines: [] } });
    const r = await budgets.check([{ accountId: "a-1", projectId: "p-1", amount: 500_00 }, { accountId: "a-2", amount: 12.4 }]);
    expect(r.result).toBe("ok");
    const url = new URL(calls[0].url, "http://x");
    expect(url.pathname).toBe("/api/finance/budgets/check");
    expect(url.searchParams.get("lines[0][accountId]")).toBe("a-1");
    expect(url.searchParams.get("lines[0][projectId]")).toBe("p-1");
    expect(url.searchParams.get("lines[0][amount]")).toBe("50000");
    expect(url.searchParams.get("lines[1][amount]")).toBe("12");
    expect(url.searchParams.has("lines[1][projectId]")).toBe(false);
    expect(checkQuery([], "2026-10-06")).toBe("on=2026-10-06");
  });

  it("passes the API's refusal through", async () => {
    stubFetch({ message: "Only a draft budget changes. Start a revision instead.", errors: { budget: ["Only a draft budget changes. Start a revision instead."] } }, 422);
    const e = await budgets.saveRow("b-1", { accountId: "a", months: {} }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(422);
  });
});

describe("cash forecast client", () => {
  it("reads the forecast and keeps recurring items and settings", async () => {
    const calls = stubFetch({ data: { id: "r-1" } });
    const item = { name: "Office rent", direction: "out" as const, amount: 2_500_000_00, frequency: "quarterly" as const, nextOn: "2026-11-01" };
    await cashForecast.get();
    await cashForecast.addItem(item);
    await cashForecast.updateItem("r-1", { ...item, active: false });
    await cashForecast.updateSettings({ overdueCollectionPct: 40, pipelinePct: 75 });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/finance/cash-forecast",
      "POST /api/finance/cash-forecast/items",
      "PATCH /api/finance/cash-forecast/items/r-1",
      "PATCH /api/finance/cash-forecast/settings",
    ]);
    expect(calls[2].body).toEqual({ ...item, active: false });
    expect(calls[3].body).toEqual({ overdueCollectionPct: 40, pipelinePct: 75 });
  });

  it("removes an item", async () => {
    const calls = stubFetch(null, 204);
    await cashForecast.removeItem("r-1");
    expect(calls[0]).toEqual({ url: "/api/finance/cash-forecast/items/r-1", method: "DELETE", body: undefined });
  });
});

describe("operations compliance", () => {
  it("reads the summary from the Operations overview", async () => {
    const calls = stubFetch({ data: { compliance: { dueSoon: 3, overdue: 1, expired: 2, expiring: 1, expiredMandatory: ["Tax clearance certificate"], next: [] } } });
    expect(await operationsCompliance()).toEqual({ dueSoon: 3, overdue: 1, expired: 2, expiring: 1, expiredMandatory: ["Tax clearance certificate"] });
    expect(calls[0].url).toBe("/api/operations/overview");
  });

  it("is null when Operations is off, refused or down", async () => {
    stubFetch({ message: "Not found." }, 404);
    expect(await operationsCompliance()).toBeNull();
    stubFetch({ message: "Forbidden." }, 403);
    expect(await operationsCompliance()).toBeNull();
    stubFetch({ data: { procurement: {} } });
    expect(await operationsCompliance()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await operationsCompliance()).toBeNull();
  });
});

describe("budget arithmetic", () => {
  it("names versions in words", () => {
    expect(versionText("ORIGINAL")).toBe("Original");
    expect(versionText("REVISED_2")).toBe("Revision 2");
  });

  it("spreads an annual figure so the year adds up to the kobo", () => {
    const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
    const s = spreadAnnual(1_000_00, months);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(1_000_00);
    expect(s["2026-01"]).toBe(8334);
    expect(s["2026-12"]).toBe(8333);
    expect(spreadAnnual(12_000_00, months)["2026-06"]).toBe(1_000_00);
    expect(spreadAnnual(5, [])).toEqual({});
  });

  it("reads variance the favourable way on both sides", () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
    expect(favourable({ varianceYtd: 0 })).toBe(true);
    expect(favourable({ varianceYtd: -1 })).toBe(false);
    expect(monthVariance({ income: true, budget: [100], actual: [130] }, 0)).toBe(30);
    expect(monthVariance({ income: false, budget: [100], actual: [130] }, 0)).toBe(-30);
  });

  it("spots the budget refusal", () => {
    expect(isBudgetExceeded("BUDGET_EXCEEDED: 6100 Travel would be 50.00 over")).toBe(true);
    expect(isBudgetExceeded("SOD_VIOLATION: no")).toBe(false);
    expect(isBudgetExceeded(null)).toBe(false);
  });

  it("groups a week's items by kind", () => {
    const item = (o: Partial<ForecastItem>): ForecastItem => ({ kind: "receipts", direction: "in", amount: 100, on: "2026-10-06", week: 0, label: "x", reference: null, link: null, late: false, ...o });
    const items = [item({}), item({ kind: "payroll", direction: "out", amount: 40 }), item({ amount: 50 }), item({ week: 1, kind: "memos", direction: "out" })];
    expect(itemsByKind(items, 0).map((g) => [g.kind, g.total, g.items.length])).toEqual([
      ["receipts", 150, 2],
      ["payroll", -40, 1],
    ]);
    expect(kindTotals(items)).toMatchObject({ receipts: 150, payroll: -40, memos: -100, pipeline: 0 });
  });
});
