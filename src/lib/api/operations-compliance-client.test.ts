import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, compliance, opsFieldErrors } from "./operations-compliance-client";

/** The compliance client: routes, methods and bodies; the board in one object; reminders in one spelling. */

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
      const body = init.body instanceof FormData ? init.body : init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const route = (c: Call) => `${c.method} ${c.url}`;

describe("compliance", () => {
  it("reads the board with its range and folds the meta into it", async () => {
    const calls = stubFetch({
      data: { obligations: [], occurrences: [], certificates: [], summary: { dueSoon: 1, overdue: 0, expired: 0, expiring: 0, expiredMandatory: [] }, owners: ["Finance"] },
      meta: { categories: { tax: "Tax" }, frequencies: { annual: "Annual" }, from: "2026-10-01", to: "2027-01-31", financeOn: true },
    });
    const b = await compliance.board({ from: "2026-10-01", to: "2027-01-31", ownerRole: "" });
    expect(route(calls[0])).toBe("GET /api/operations/compliance?from=2026-10-01&to=2027-01-31");
    expect(b.summary.dueSoon).toBe(1);
    expect(b.owners).toEqual(["Finance"]);
    expect(b.categories.tax).toBe("Tax");
    expect(b.financeOn).toBe(true);
  });

  it("keeps the register and works an occurrence through to completion", async () => {
    const calls = stubFetch({ data: { id: "x" } });
    await compliance.create({ name: "NITDA registration", category: "sector", frequency: "annual", dueRule: { type: "expiry" }, reminderDays: [60, 30] });
    await compliance.update("o1", { mandatory: false });
    await compliance.start("c1");
    await compliance.submit("c1", { reference: "RRR-123", note: "Filed online" });
    await compliance.complete("c1", { reference: "TCC/2026/1", issuedOn: "2026-01-10", expiresOn: "2026-12-31" });
    await compliance.raiseMemo("c1", 25_000_00);
    await compliance.bidPack();
    expect(calls.map(route)).toEqual([
      "POST /api/operations/compliance",
      "PATCH /api/operations/compliance/obligations/o1",
      "POST /api/operations/compliance/occurrences/c1/start",
      "POST /api/operations/compliance/occurrences/c1/submit",
      "POST /api/operations/compliance/occurrences/c1/complete",
      "POST /api/operations/compliance/occurrences/c1/memo",
      "GET /api/operations/compliance/bid-pack",
    ]);
    expect(calls[0].body).toMatchObject({ dueRule: { type: "expiry" }, reminderDays: [60, 30] });
    expect(calls[3].body).toEqual({ reference: "RRR-123", note: "Filed online" });
    expect(calls[4].body).toEqual({ reference: "TCC/2026/1", issuedOn: "2026-01-10", expiresOn: "2026-12-31" });
    expect(calls[5].body).toEqual({ amount: 2_500_000 });
    expect(compliance.bidPackHref).toBe("/api/operations/compliance/bid-pack/file");
  });

  it("uploads evidence as a file, removes it, and links it for download", async () => {
    const calls = stubFetch({ data: { id: "att-1", name: "receipt.pdf" } });
    const file = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    const saved = await compliance.uploadEvidence("c1", file);
    expect(saved.name).toBe("receipt.pdf");
    expect(route(calls[0])).toBe("POST /api/operations/compliance/occurrences/c1/evidence");
    expect((calls[0].body as FormData).get("file")).toBeInstanceOf(File);
    stubFetch(null, 204);
    await expect(compliance.removeEvidence("c1", "att-1")).resolves.toBeUndefined();
    expect(compliance.evidenceHref("att-1")).toBe("/api/operations/attachments/att-1");
  });

  it("puts the reminders' sent_at into one spelling", async () => {
    stubFetch({ data: { id: "c1", reminders: [{ kind: "t-30", sent_at: "2026-09-01 08:00:00" }, { kind: "overdue", sentAt: "2026-10-02T08:00:00Z" }] } });
    const d = await compliance.occurrence("c1");
    expect(d.reminders).toEqual([
      { kind: "t-30", sentAt: "2026-09-01 08:00:00" },
      { kind: "overdue", sentAt: "2026-10-02T08:00:00Z" },
    ]);
  });

  it("says why completing was refused", async () => {
    stubFetch({ message: "The given data was invalid.", errors: { evidence: ["Attach the evidence first: an obligation is not completed without it."] } }, 422);
    const err = await compliance.complete("c1", {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(opsFieldErrors(err).evidence).toMatch(/Attach the evidence first/);
  });
});
