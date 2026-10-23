import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, camelKey, revenue, revenueError, revenueFieldErrors } from "./finance-revenue-client";

/** The revenue client: the routes, methods and bodies the API expects, and errors put back on camelCase fields. */

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

describe("revenue client", () => {
  it("reads the contract register with its billing types", async () => {
    stubFetch({ data: [{ id: "ct-1" }], meta: { billingTypes: { milestone: "Milestones" }, progressMethods: {}, organisation: "o" } });
    const r = await revenue.contracts.list();
    expect(r.contracts).toEqual([{ id: "ct-1" }]);
    expect(r.meta.billingTypes.milestone).toBe("Milestones");
  });

  it("puts a project's contract and posts milestone actions", async () => {
    const calls = stubFetch({ data: { id: "x", status: "draft" } });
    await revenue.contracts.save("proj-1", { clientId: "cp-1", title: "Portal", value: 100_00, milestones: [{ name: "Go-live", amount: 100_00 }] });
    await revenue.contracts.completeMilestone("ms-1", "2026-10-06");
    await revenue.contracts.completeMilestone("ms-2");
    await revenue.contracts.invoiceMilestone("ms-1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "PUT /api/finance/projects/proj-1/contract",
      "POST /api/finance/contract-milestones/ms-1/complete",
      "POST /api/finance/contract-milestones/ms-2/complete",
      "POST /api/finance/contract-milestones/ms-1/invoice",
    ]);
    expect(calls[0].body).toEqual({ clientId: "cp-1", title: "Portal", value: 100_00, milestones: [{ name: "Go-live", amount: 100_00 }] });
    expect(calls[1].body).toEqual({ on: "2026-10-06" });
    expect(calls[2].body).toEqual({});
  });

  it("filters invoices by status and client, and keeps the meta strip", async () => {
    const calls = stubFetch({ data: [], meta: { drafts: 2, outstanding: 5, overdue: 1, invoicedThisYear: 9 } });
    const r = await revenue.invoices.list({ status: "open", client: "cp-1", q: "" });
    expect(calls[0].url).toBe("/api/finance/invoices?status=open&client=cp-1");
    expect(r.meta.drafts).toBe(2);
  });

  it("issues, voids and deletes invoices on their own routes", async () => {
    const calls = stubFetch({ data: { id: "inv-1", status: "issued" } });
    await revenue.invoices.issue("inv-1", "2026-10-06");
    await revenue.invoices.issue("inv-1");
    await revenue.invoices.void("inv-1", "Keyed twice");
    await revenue.invoices.remove("inv-1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/finance/invoices/inv-1/issue",
      "POST /api/finance/invoices/inv-1/issue",
      "POST /api/finance/invoices/inv-1/void",
      "DELETE /api/finance/invoices/inv-1",
    ]);
    expect(calls[0].body).toEqual({ date: "2026-10-06" });
    expect(calls[1].body).toEqual({});
    expect(calls[2].body).toEqual({ reason: "Keyed twice" });
    expect(revenue.invoices.pdfUrl("inv-1")).toBe("/api/finance/invoices/inv-1/pdf");
  });

  it("asks for statement candidates by bank account, and reads the WHT register's totals", async () => {
    const calls = stubFetch({ data: [], meta: { expected: 550_000_00, received: 0 } });
    await revenue.receipts.candidates("bank-1");
    await revenue.receipts.candidates();
    const reg = await revenue.receipts.whtRegister();
    expect(calls[0].url).toBe("/api/finance/receipts/candidates?bankAccount=bank-1");
    expect(calls[1].url).toBe("/api/finance/receipts/candidates");
    expect(reg).toEqual({ rows: [], expected: 550_000_00, received: 0 });
  });

  it("records receipts and credit notes, and ages receivables as at a date", async () => {
    const calls = stubFetch({ data: { id: "rct-1" } });
    await revenue.receipts.create({ clientId: "cp-1", bankAccountId: "bank-1", receivedOn: "2026-10-06", cash: 10_00, allocations: [{ invoiceId: "inv-1", cash: 10_00 }] });
    await revenue.receipts.creditNote("rct-1", "WHT/CN/77");
    await revenue.receivables.aged("2026-09-30");
    await revenue.receivables.statement("cp-1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/finance/receipts",
      "POST /api/finance/receipts/rct-1/credit-note",
      "GET /api/finance/receivables/aged?asOf=2026-09-30",
      "GET /api/finance/clients/cp-1/statement",
    ]);
    expect(calls[1].body).toEqual({ reference: "WHT/CN/77" });
  });

  it("lists clients, narrows a statement by dates, and builds the PDF links", async () => {
    const calls = stubFetch({ data: [] });
    await revenue.clients.list();
    await revenue.receivables.statement("cp-1", { from: "2026-09-01", to: "2026-09-30" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET /api/finance/clients", "GET /api/finance/clients/cp-1/statement?from=2026-09-01&to=2026-09-30"]);
    expect(revenue.receipts.pdfUrl("rct-1")).toBe("/api/finance/receipts/rct-1/pdf");
    expect(revenue.receivables.statementPdfUrl("cp-1")).toBe("/api/finance/clients/cp-1/statement/pdf");
    expect(revenue.receivables.statementPdfUrl("cp-1", { from: "2026-09-01" })).toBe("/api/finance/clients/cp-1/statement/pdf?from=2026-09-01");
  });
});

describe("client advances", () => {
  it("applies a held advance to invoices and returns the receipt", async () => {
    const calls = stubFetch({ data: { id: "rct-4", unallocated: 0 } });
    const r = await revenue.receipts.applyAdvance("rct-4", { date: "2026-10-06", allocations: [{ invoiceId: "inv-3", cash: 1_000_00, retention: 500_00 }] });
    expect(calls[0]).toEqual({
      url: "/api/finance/receipts/rct-4/apply",
      method: "POST",
      body: { date: "2026-10-06", allocations: [{ invoiceId: "inv-3", cash: 1_000_00, retention: 500_00 }] },
    });
    expect(r).toEqual({ id: "rct-4", unallocated: 0 });
  });

  it("lists the advances held with their total, for one client or all", async () => {
    const calls = stubFetch({ data: [{ receiptId: "rct-4", held: 1_500_000_00 }], meta: { total: 1_500_000_00 } });
    const all = await revenue.receivables.advances();
    await revenue.receivables.advances("cp-1");
    expect(calls.map((c) => c.url)).toEqual(["/api/finance/receivables/advances", "/api/finance/receivables/advances?client=cp-1"]);
    expect(all.total).toBe(1_500_000_00);
    expect(all.rows).toHaveLength(1);
  });
});

describe("revenue errors", () => {
  it("puts snake_case service keys and camelCase request keys on the same camelCase fields", () => {
    const e = new ApiError("Invalid.", 422, {
      bank_account_id: ["Choose the account the money came into."],
      "allocations.0.cash": ["Invoice INV/2026/0003 has 10.00 left to pay (before retention)."],
      "lines.1.account_id": ["Choose the revenue account this line earns."],
      clientId: ["The client id field is required."],
    });
    expect(revenueFieldErrors(e)).toEqual({
      bankAccountId: "Choose the account the money came into.",
      "allocations.0.cash": "Invoice INV/2026/0003 has 10.00 left to pay (before retention).",
      "lines.1.accountId": "Choose the revenue account this line earns.",
      clientId: "The client id field is required.",
    });
    expect(camelKey("statement_line_id")).toBe("statementLineId");
  });

  it("takes any machine code off the message", () => {
    expect(revenueError(new ApiError("PERIOD_CLOSED: September is closed.", 422))).toBe("September is closed.");
  });
});
