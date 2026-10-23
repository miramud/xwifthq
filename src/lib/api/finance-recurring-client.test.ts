import { afterEach, describe, expect, it, vi } from "vitest";
import { recurring } from "./finance-recurring-client";
import { banking } from "./finance-banking-client";

/** Recurring journals and the reconciliation report: paths, methods and bodies as the controllers take them. */

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

describe("recurring journals client", () => {
  it("lists, reads, creates, changes, pauses, resumes and deletes templates", async () => {
    const calls = stubFetch({ data: { id: "rj-1" } });
    await recurring.list();
    await recurring.get("rj-1");
    await recurring.create({ name: "Rent", frequency: "monthly", dayOfMonth: 31, startDate: "2026-01-01", lines: [] });
    await recurring.update("rj-1", { name: "Office rent" });
    await recurring.pause("rj-1");
    await recurring.resume("rj-1");
    await recurring.journals("rj-1");
    await recurring.remove("rj-1");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/finance/recurring-journals",
      "GET /api/finance/recurring-journals/rj-1",
      "POST /api/finance/recurring-journals",
      "PATCH /api/finance/recurring-journals/rj-1",
      "POST /api/finance/recurring-journals/rj-1/pause",
      "POST /api/finance/recurring-journals/rj-1/resume",
      "GET /api/finance/recurring-journals/rj-1/journals",
      "DELETE /api/finance/recurring-journals/rj-1",
    ]);
    expect(calls[2].body).toMatchObject({ name: "Rent", dayOfMonth: 31 });
  });

  it("runs the next occurrence, or a named one again", async () => {
    const calls = stubFetch({ data: { run: {}, template: {} } });
    await recurring.run("rj-1");
    await recurring.run("rj-1", "2026-09-30");
    expect(calls.map((c) => [c.url, c.body])).toEqual([
      ["/api/finance/recurring-journals/rj-1/run", {}],
      ["/api/finance/recurring-journals/rj-1/run", { occurrenceDate: "2026-09-30" }],
    ]);
  });
});

describe("reconciliation report and reopen", () => {
  it("reopens with a reason, reads the history, and links the downloads", async () => {
    const calls = stubFetch({ data: [] });
    await banking.reconciliations.reopen("ba-1", "2026-09", "Wrong line");
    await banking.reconciliations.history("ba-1", "2026-09");

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/finance/bank-accounts/ba-1/reconciliations/2026-09/reopen",
      "GET /api/finance/bank-accounts/ba-1/reconciliations/2026-09/history",
    ]);
    expect(calls[0].body).toEqual({ reason: "Wrong line" });
    expect(banking.reconciliations.pdfUrl("ba-1", "2026-09")).toBe("/api/finance/bank-accounts/ba-1/reconciliations/2026-09/pdf");
    expect(banking.reconciliations.csvUrl("ba-1", "2026-09")).toBe("/api/finance/bank-accounts/ba-1/reconciliations/2026-09/csv");
  });
});
