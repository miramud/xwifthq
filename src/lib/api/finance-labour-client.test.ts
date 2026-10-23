import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, blockerList, labour, overridable } from "./finance-labour-client";

/** The labour client: paths, methods and bodies as `LabourController` takes them. */

function stubFetch(body: unknown = { data: null }, status = 200) {
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

describe("labour client", () => {
  it("reads the overview, a run, and a month's preview with and without a method", async () => {
    const calls = stubFetch({ data: {} });
    await labour.overview();
    await labour.run("run-1");
    await labour.preview("2026-08");
    await labour.preview("2026-08", "proportional");
    await labour.people("2026-08", "standard_hours");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/finance/labour",
      "GET /api/finance/labour/runs/run-1",
      "GET /api/finance/labour/2026-08",
      "GET /api/finance/labour/2026-08?method=proportional",
      "GET /api/finance/labour/2026-08/people?method=standard_hours",
    ]);
  });

  it("saves settings, charges provisional labour and posts a month with its override", async () => {
    const calls = stubFetch({ data: { id: "r" } });
    await labour.configure({ standardHours: 168 });
    await labour.provisional("2026-10-06");
    await labour.provisional();
    await labour.post("2026-08", { method: "standard_hours", overrideReason: "Snagging agreed with the client" });

    expect(calls[0]).toEqual({ url: "/api/finance/labour/settings", method: "PATCH", body: { standardHours: 168 } });
    expect(calls[1]).toEqual({ url: "/api/finance/labour/provisional", method: "POST", body: { asOf: "2026-10-06" } });
    expect(calls[2].body).toEqual({});
    expect(calls[3]).toEqual({ url: "/api/finance/labour/2026-08/post", method: "POST", body: { method: "standard_hours", overrideReason: "Snagging agreed with the client" } });
  });

  it("passes a nothing-to-charge null straight through", async () => {
    stubFetch({ data: null });
    await expect(labour.provisional()).resolves.toBeNull();
  });

  it("refuses with the API's status, so the people route's 403 can be told apart", async () => {
    stubFetch({ message: "This action is unauthorized." }, 403);
    const e = await labour.people("2026-08").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(403);
  });

  it("lets only a closed-project blocker be overridden", () => {
    const closed = "Hours were logged on a closed project. Reopen it, move the hours, or post with a Finance override.";
    const payroll = "There is no approved payroll for August 2026 yet.";
    expect(overridable({ blockers: [closed] })).toBe(true);
    expect(overridable({ blockers: [closed, payroll] })).toBe(false);
    expect(overridable({ blockers: [payroll] })).toBe(false);
    expect(overridable({ blockers: [] })).toBe(false);
  });

  it("trusts the API's overridable flag over the sentences when it is sent", () => {
    const closed = "Hours were logged on a closed project. Reopen it, move the hours, or post with a Finance override.";
    const payroll = "There is no approved payroll for August 2026 yet.";
    // Reworded sentences no longer fool it: the flag decides.
    expect(overridable({ blockers: ["Somebody logged time on a finished project."], overridable: true })).toBe(true);
    expect(overridable({ blockers: [closed], overridable: false })).toBe(false);
    expect(overridable({ blockers: [closed, payroll], overridable: false })).toBe(false);
  });

  it("pairs each blocker with its code, in order", () => {
    expect(blockerList({ blockers: ["a", "b"], blockerCodes: ["no_payroll", "closed_project"] })).toEqual([
      { text: "a", code: "no_payroll" },
      { text: "b", code: "closed_project" },
    ]);
    expect(blockerList({ blockers: ["a"] })).toEqual([{ text: "a", code: null }]);
  });
});
