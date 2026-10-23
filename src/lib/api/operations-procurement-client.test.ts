import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, camelKey, dutiesRefusal, fundsCode, opsError, opsFieldErrors, procurement } from "./operations-procurement-client";

/** The procurement client: the routes, methods and bodies the API expects, and its refusals read back. */

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
      const body = init.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "(file)"])) : init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      return new Response(status === 204 ? null : JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("procurement client", () => {
  it("reads the overview and the staff's own requests", async () => {
    const calls = stubFetch({ data: [] });
    await procurement.overview();
    await procurement.me.options();
    await procurement.me.list();
    await procurement.me.get("pr-1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/overview",
      "GET /api/operations/me/options",
      "GET /api/operations/me/purchase-requests",
      "GET /api/operations/me/purchase-requests/pr-1",
    ]);
  });

  it("creates, updates, submits (with or without an override) and cancels a request", async () => {
    const calls = stubFetch({ data: { id: "pr-1" } });
    const input = { title: "Laptops", category: "goods_assets", projectId: "p-1", lines: [{ kind: "goods" as const, description: "Laptop", quantity: 4, unit: "each", estUnitPrice: 950_000_00 }] };
    await procurement.me.create(input);
    await procurement.me.update("pr-1", { title: "Laptops (4)" });
    await procurement.me.submit("pr-1");
    await procurement.me.submit("pr-1", "Board approved it on Monday");
    await procurement.me.cancel("pr-1", "No longer needed");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/operations/me/purchase-requests",
      "PATCH /api/operations/me/purchase-requests/pr-1",
      "POST /api/operations/me/purchase-requests/pr-1/submit",
      "POST /api/operations/me/purchase-requests/pr-1/submit",
      "POST /api/operations/me/purchase-requests/pr-1/cancel",
    ]);
    expect(calls[0].body).toEqual(input);
    expect(calls[2].body).toEqual({});
    expect(calls[3].body).toEqual({ overrideReason: "Board approved it on Monday" });
    expect(calls[4].body).toEqual({ reason: "No longer needed" });
  });

  it("keeps the desk's meta and sends RFQs, quotations and the award", async () => {
    const calls = stubFetch({ data: [], meta: { toSource: 1, awardPending: 0, inApproval: 2, categories: {} } });
    const r = await procurement.requests.list();
    expect(r.meta.inApproval).toBe(2);
    await procurement.requests.list("in_approval");
    await procurement.requests.rfq("pr-1", { vendorIds: ["v-1", "v-2"], deadline: "2026-10-20" });
    await procurement.requests.quote("pr-1", { vendorId: "v-1", lines: [{ prLineId: "l-1", unitPrice: 915_000_00, vatRateBp: 750 }] });
    await procurement.requests.award("pr-1", { reason: "Lowest", picks: [{ prLineId: "l-1", quotationId: "q-1" }] });
    await procurement.requests.cancel("pr-1", "Duplicate");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/purchase-requests",
      "GET /api/operations/purchase-requests?status=in_approval",
      "POST /api/operations/purchase-requests/pr-1/rfqs",
      "POST /api/operations/purchase-requests/pr-1/quotations",
      "POST /api/operations/purchase-requests/pr-1/award",
      "POST /api/operations/purchase-requests/pr-1/cancel",
    ]);
    expect(calls[4].body).toEqual({ reason: "Lowest", picks: [{ prLineId: "l-1", quotationId: "q-1" }] });
  });

  it("works an order through its actions, and prints it through the proxy", async () => {
    const calls = stubFetch({ data: { id: "po-1" }, meta: { drafts: 1, open: 2, openValue: 9, triggers: {} } });
    const list = await procurement.orders.list("open");
    expect(list.meta.openValue).toBe(9);
    await procurement.orders.update("po-1", { deliveryDate: "2026-10-30", paymentTerms: [{ label: "Advance", trigger: "on_po", pctBp: 3000 }] });
    await procurement.orders.submit("po-1");
    await procurement.orders.send("po-1");
    await procurement.orders.accept("po-1", "By email");
    await procurement.orders.accept("po-1");
    await procurement.orders.cancel("po-1", "Wrong vendor");
    await procurement.orders.shortClose("po-1", "Model discontinued");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/purchase-orders?status=open",
      "PATCH /api/operations/purchase-orders/po-1",
      "POST /api/operations/purchase-orders/po-1/submit",
      "POST /api/operations/purchase-orders/po-1/send",
      "POST /api/operations/purchase-orders/po-1/accept",
      "POST /api/operations/purchase-orders/po-1/accept",
      "POST /api/operations/purchase-orders/po-1/cancel",
      "POST /api/operations/purchase-orders/po-1/short-close",
    ]);
    expect(calls[4].body).toEqual({ note: "By email" });
    expect(calls[5].body).toEqual({});
    expect(procurement.orders.pdfUrl("po-1")).toBe("/api/operations/purchase-orders/po-1/pdf");
    expect(procurement.receiving.grnPdfUrl("g-1")).toBe("/api/operations/grns/g-1/pdf");
    expect(procurement.receiving.sccPdfUrl("s-1")).toBe("/api/operations/sccs/s-1/pdf");
  });

  it("records and approves GRNs and SCCs, records and rejects invoices", async () => {
    const calls = stubFetch({ data: { id: "x" } });
    await procurement.receiving.desk();
    await procurement.receiving.grn("po-1", { receivedOn: "2026-10-01", lines: [{ poLineId: "pol-1", received: 2, accepted: 2, serials: ["A", "B"] }] });
    await procurement.receiving.approveGrn("grn-1");
    await procurement.receiving.scc("po-2", { rating: 4, lines: [{ poLineId: "pol-9", confirmed: 1 }] });
    await procurement.receiving.approveScc("scc-1");
    await procurement.receiving.invoice("po-1", { invoiceNo: "KB-1", invoiceDate: "2026-10-02", lines: [{ poLineId: "pol-1", quantity: 2, unitPrice: 915_000_00 }] });
    await procurement.receiving.rejectInvoice("inv-1", "Charged five, four arrived");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET /api/operations/receiving",
      "POST /api/operations/purchase-orders/po-1/grns",
      "POST /api/operations/grns/grn-1/approve",
      "POST /api/operations/purchase-orders/po-2/sccs",
      "POST /api/operations/sccs/scc-1/approve",
      "POST /api/operations/purchase-orders/po-1/invoices",
      "POST /api/operations/vendor-invoices/inv-1/reject",
    ]);
    expect(calls[6].body).toEqual({ resolution: "Charged five, four arrived" });
  });

  it("uploads attachments as multipart, and removes them", async () => {
    const calls = stubFetch({ data: { id: "att-1", name: "q.pdf" } });
    await procurement.attachments.upload("pr", "pr-1", new File(["x"], "q.pdf"), "quotation");
    expect(calls[0]).toEqual({ url: "/api/operations/attachments", method: "POST", body: { ownerType: "pr", ownerId: "pr-1", kind: "quotation", file: "(file)" } });
    stubFetch(null, 204);
    await procurement.attachments.remove("att-1");
    expect(procurement.attachments.href("att-1")).toBe("/api/operations/attachments/att-1");
  });

  it("adds, opens and removes files on the person's own request through the me routes", async () => {
    const calls = stubFetch({ data: { id: "pr-1", attachments: [{ id: "att-2" }] } });
    const pr = await procurement.me.attach("pr-1", new File(["x"], "spec.pdf"), "specification");
    await procurement.me.attach("pr-1", new File(["x"], "agenda.pdf"));
    expect(calls[0]).toEqual({ url: "/api/operations/me/purchase-requests/pr-1/attachments", method: "POST", body: { kind: "specification", file: "(file)" } });
    expect(calls[1].body).toEqual({ file: "(file)" });
    expect(pr.attachments).toEqual([{ id: "att-2" }]);
    const del = stubFetch(null, 204);
    await procurement.me.removeFile("att-2");
    expect(del[0]).toMatchObject({ url: "/api/operations/me/attachments/att-2", method: "DELETE" });
    expect(procurement.me.fileHref("att-2")).toBe("/api/operations/me/attachments/att-2");
  });
});

describe("procurement errors", () => {
  it("puts snake_case service keys and camelCase request keys on the same camelCase fields", () => {
    const e = new ApiError("Invalid.", 422, {
      "lines.0.unit_price": ["Enter a price."],
      "paymentTerms.1.trigger": ["Choose what makes this payment due."],
      invoiceNo: ["This invoice is already recorded on the order."],
    });
    expect(opsFieldErrors(e)).toEqual({
      "lines.0.unitPrice": "Enter a price.",
      "paymentTerms.1.trigger": "Choose what makes this payment due.",
      invoiceNo: "This invoice is already recorded on the order.",
    });
    expect(camelKey("delivery_date")).toBe("deliveryDate");
  });

  it("reads the funds refusals a submit can meet, and strips their code for people", () => {
    const short = new ApiError("Invalid.", 422, { funds: ["INSUFFICIENT_PROJECT_FUNDS: the project has 100.00 available and this asks for 200.00."] });
    const none = new ApiError("Invalid.", 422, { funds: ["NO_FUNDS_RELEASED: no funds have been released to this project yet."] });
    expect(fundsCode(short)).toBe("INSUFFICIENT_PROJECT_FUNDS");
    expect(fundsCode(none)).toBe("NO_FUNDS_RELEASED");
    expect(fundsCode(new ApiError("Nope", 422, { title: ["x"] }))).toBeNull();
    expect(opsError(short)).toBe("the project has 100.00 available and this asks for 200.00.");
  });

  it("says a separation-of-duties refusal plainly", () => {
    const e = new ApiError("Invalid.", 422, { duties: ["SOD_VIOLATION: you are the person who raised the order, so you cannot also approve its receipt."] });
    expect(dutiesRefusal(e)).toBe("You are the person who raised the order, so you cannot also approve its receipt.");
    expect(dutiesRefusal(new ApiError("Other", 422, { grn: ["Already approved."] }))).toBeNull();
  });
});
