import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/operations-procurement-client";
import OrderDetail from "./OrderDetail";
import { draftLso, poFull } from "./fixtures";

/** An order: its road, the draft's terms checked before it goes for approval, Finance's payments, and closing it. */

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), submit: vi.fn(), shortClose: vi.fn(), revise: vi.fn(), permissions: [] as string[] }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, orders: { ...actual.procurement.orders, get: api.get, update: api.update, submit: api.submit, shortClose: api.shortClose, revise: api.revise } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-halima", role: "user", name: "Halima Yusuf", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/suite/operations/procurement/orders/po-1", useSearchParams: () => new URLSearchParams() }));

const ALL = ["update", "submit", "send", "accept", "cancel", "short_close", "revise"].map((a) => `admin.purchase_orders.${a}`);

beforeEach(() => {
  for (const f of [api.get, api.update, api.submit, api.shortClose, api.revise]) f.mockReset();
  api.permissions = ALL;
});

describe("OrderDetail", () => {
  it("shows where an invoiced order is, its three-way match and what Finance has raised", async () => {
    api.get.mockResolvedValue(poFull());
    render(<OrderDetail id="po-1" />);
    const road = await screen.findByRole("list", { name: "Where this order is" });
    expect(within(road).getByText("Paid").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(road).getByText("Invoiced").closest("li")).toHaveTextContent("(done)");
    // Each step done carries its date: approved, sent, accepted, received (GRN approved), invoiced.
    expect(within(road).getByText("Approved").closest("li")).toHaveTextContent("21 Sep 2026");
    expect(within(road).getByText("Accepted").closest("li")).toHaveTextContent("22 Sep 2026");
    expect(within(road).getByText("Received").closest("li")).toHaveTextContent("29 Sep 2026");
    expect(within(road).getByText("Invoiced").closest("li")).toHaveTextContent("1 Oct 2026");
    expect(screen.getByRole("article", { name: "Invoice KB-INV-90433" })).toHaveTextContent("Matched");
    // On the terms and on the payments from Finance.
    expect(screen.getAllByText("Advance (30%)")).toHaveLength(2);
    expect(screen.getAllByText("MPT/MEMO/PEOP/2026/0001").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Print" })).toHaveAttribute("href", "/api/operations/purchase-orders/po-1/pdf");
    // Each GRN prints as its own note.
    expect(screen.getByRole("link", { name: "Print: MPT/GRN/2026/0001" })).toHaveAttribute("href", "/api/operations/grns/grn-1/pdf");
    // Something is received and paid on it, so it is short-closed, not cancelled.
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Short-close" })).toBeInTheDocument();
  }, 15_000);

  it("says payments wait for Finance when Finance is off", async () => {
    api.get.mockResolvedValue(poFull({ financeOn: false }));
    render(<OrderDetail id="po-1" />);
    expect(await screen.findByText(/payments wait for Finance/)).toBeInTheDocument();
  }, 15_000);

  it("checks a draft's terms add up before saving them, then sends it for approval", async () => {
    const user = userEvent.setup();
    const draft = draftLso();
    api.get.mockResolvedValue(draft);
    api.update.mockResolvedValue(draft);
    api.submit.mockResolvedValue({ ...draft, status: "in_approval", number: "MPT/LSO/2026/0002" });
    render(<OrderDetail id="po-2" />);

    const share = await screen.findByLabelText("Share (%), term 1");
    await user.clear(share);
    await user.type(share, "90");
    expect(screen.getByText("₦19,135.00 short of the order total.")).toBeInTheDocument();
    await user.clear(share);
    await user.type(share, "100");
    expect(screen.getByText("The terms add up to the order.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(api.update).toHaveBeenCalledWith("po-2", {
      deliveryAddress: "Power house, Main Campus",
      deliveryDate: "2026-10-03",
      terms: null,
      paymentTerms: [{ label: "On completion", trigger: "on_completion", pctBp: 10000, amount: null, days: null }],
    });
    expect(api.submit).toHaveBeenCalledWith("po-2");
    expect((await screen.findAllByText(/Sent for approval/)).length).toBeGreaterThan(0);
  }, 15_000);

  it("puts the API's refusal of a term back on that term", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(draftLso());
    api.update.mockRejectedValue(new ApiError("Invalid.", 422, { "paymentTerms.0.trigger": ["Choose what makes this payment due."] }));
    render(<OrderDetail id="po-2" />);
    await user.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Choose what makes this payment due.")).toBeInTheDocument();
  }, 15_000);

  it("short-closes only with a reason, after saying what it does", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(poFull({ status: "partially_received" }));
    api.shortClose.mockResolvedValue(poFull({ status: "short_closed", closingReason: "Model discontinued" }));
    render(<OrderDetail id="po-1" />);
    await user.click(await screen.findByRole("button", { name: "Short-close" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("This can't be undone.");
    await user.click(within(dialog).getByRole("button", { name: "Short-close the order" }));
    expect(within(dialog).getByText("Reason is needed.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Model discontinued");
    await user.click(within(dialog).getByRole("button", { name: "Short-close the order" }));
    expect(api.shortClose).toHaveBeenCalledWith("po-1", "Model discontinued");
    expect(await screen.findByText("Model discontinued")).toBeInTheDocument();
  }, 15_000);

  it("revises an accepted order: not below what was received, with a live new total and a reason", async () => {
    const user = userEvent.setup();
    const po = poFull({
      status: "partially_received",
      lines: [{ id: "pol-1", lineNo: 1, kind: "goods", description: "Laptop", quantity: 4, unit: "each", unitPrice: 1_000_00, vatRateBp: 750, amount: 4_000_00, vat: 300_00, received: 2 }],
      total: 4_300_00,
    });
    api.get.mockResolvedValue(po);
    api.revise.mockResolvedValue({ ...po, revision: 1, total: 3_225_00 });
    render(<OrderDetail id="po-1" />);

    await user.click(await screen.findByRole("button", { name: "Revise order" }));
    const dialog = screen.getByRole("dialog");
    const q = within(dialog).getByLabelText(/Quantity \(each\), line 1/);
    await user.clear(q);
    await user.type(q, "1");
    await user.click(within(dialog).getByRole("button", { name: "Revise order" }));
    expect(within(dialog).getByText(/Not below what has been received \(2\)/)).toBeInTheDocument();
    expect(api.revise).not.toHaveBeenCalled();

    await user.clear(q);
    await user.type(q, "3");
    // 3 × ₦1,000 + 7.5% VAT.
    expect(within(dialog).getAllByText("₦3,225.00").length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole("button", { name: "Revise order" }));
    expect(within(dialog).getByText("Say why the order changes.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Why the order changes/), "One unit no longer needed");
    await user.click(within(dialog).getByRole("button", { name: "Revise order" }));
    expect(api.revise).toHaveBeenCalledWith("po-1", { reason: "One unit no longer needed", lines: [{ id: "pol-1", quantity: 3 }] });
    expect((await screen.findAllByText("Revised. This is now revision 1.")).length).toBeGreaterThan(0);
  }, 15_000);

  it("shows a dearer revision waiting for approval, and offers no other meanwhile", async () => {
    api.get.mockResolvedValue(
      poFull({
        status: "accepted",
        revision: 1,
        pendingRevision: { reason: "Price rise", by: "u-1", at: "2026-10-05T10:00:00Z", lines: {}, header: {}, from: 3_934_500_00, to: 4_100_000_00 },
      }),
    );
    render(<OrderDetail id="po-1" />);
    const banner = await screen.findByText(/Revision 2 awaiting approval/);
    expect(banner.closest("div")).toHaveTextContent("₦3,934,500.00 → ₦4,100,000.00, Price rise");
    expect(screen.queryByRole("button", { name: "Revise order" })).not.toBeInTheDocument();
  }, 15_000);
});

describe("OrderDetail, the vendor", () => {
  it("links the vendor's name to its counterparty page for somebody with the key", async () => {
    api.permissions = [...ALL, "core.counterparties.view"];
    api.get.mockResolvedValue(poFull());
    render(<OrderDetail id="po-1" />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(within(heading).getByRole("link", { name: "Konga Business" })).toHaveAttribute("href", "/suite/org/counterparties/v-konga");
  }, 15_000);

  it("leaves it as text for somebody without", async () => {
    api.get.mockResolvedValue(poFull());
    render(<OrderDetail id="po-1" />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Konga Business");
    expect(within(heading).queryByRole("link")).not.toBeInTheDocument();
  }, 15_000);
});
