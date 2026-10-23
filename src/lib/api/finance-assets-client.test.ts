import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fixedAssets, gainOrLoss, monthsLeft, parseRate, rateText } from "./finance-assets-client";

/** The fixed-assets client: paths, methods and bodies as `FixedAssetController` takes them. */

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

describe("fixed assets client", () => {
  it("reads the overview with its filters, a book and a month's preview", async () => {
    const calls = stubFetch();
    await fixedAssets.overview();
    await fixedAssets.overview({ status: "active", classId: "c-ict" });
    await fixedAssets.get("b-1");
    await fixedAssets.preview("2026-09");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/finance/fixed-assets",
      "GET /api/finance/fixed-assets?status=active&classId=c-ict",
      "GET /api/finance/fixed-assets/b-1",
      "GET /api/finance/fixed-assets/depreciation/2026-09",
    ]);
  });

  it("books by hand, edits a class, runs a month and disposes", async () => {
    const calls = stubFetch({ data: { id: "x" } });
    await fixedAssets.book({ classKey: "ict", description: "Dell server", tag: "FA-0001", cost: 4_500_000_00, residual: 0, capitalisedOn: "2026-01-15" });
    await fixedAssets.updateClass("c-ict", { rateBp: 3333, expenseAccountId: "a-6100" });
    await fixedAssets.run("2026-09");
    await fixedAssets.dispose("b-1", { on: "2026-10-01", proceeds: 50_000_00, reason: "Sold to staff" });

    expect(calls[0]).toEqual({
      url: "/api/finance/fixed-assets",
      method: "POST",
      body: { classKey: "ict", description: "Dell server", tag: "FA-0001", cost: 4_500_000_00, residual: 0, capitalisedOn: "2026-01-15" },
    });
    expect(calls[1]).toEqual({ url: "/api/finance/fixed-assets/classes/c-ict", method: "PATCH", body: { rateBp: 3333, expenseAccountId: "a-6100" } });
    expect(calls[2]).toEqual({ url: "/api/finance/fixed-assets/depreciation/2026-09", method: "POST", body: {} });
    expect(calls[3]).toEqual({ url: "/api/finance/fixed-assets/b-1/dispose", method: "POST", body: { on: "2026-10-01", proceeds: 50_000_00, reason: "Sold to staff" } });
  });

  it("passes the API's refusal through", async () => {
    stubFetch({ message: "This asset is on the Operations register: dispose of it there, with the MD's approval." }, 422);
    const e = await fixedAssets.dispose("b-1", { on: "2026-10-01", proceeds: 0, reason: "Scrapped" }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).message).toMatch(/Operations register/);
  });
});

describe("fixed assets arithmetic", () => {
  it("writes and reads rates in basis points", () => {
    expect(rateText(2500)).toBe("25%");
    expect(rateText(1250)).toBe("12.5%");
    expect(rateText(3333)).toBe("33.33%");
    expect(parseRate("25")).toBe(2500);
    expect(parseRate("12.5%")).toBe(1250);
    expect(parseRate("101")).toBeNull();
    expect(parseRate("abc")).toBeNull();
  });

  it("works out gain or loss and the months left", () => {
    expect(gainOrLoss(50_000_00, 120_000_00)).toBe(-70_000_00);
    expect(gainOrLoss(150_000_00, 120_000_00)).toBe(30_000_00);
    expect(monthsLeft({ cost: 1_200_00, residual: 0, accumulated: 300_00, monthly: 100_00, status: "active" })).toBe(9);
    expect(monthsLeft({ cost: 1_200_00, residual: 0, accumulated: 1_200_00, monthly: 0, status: "fully_depreciated" })).toBeNull();
  });
});
