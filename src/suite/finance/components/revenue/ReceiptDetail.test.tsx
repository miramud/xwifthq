import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/finance-revenue-client";
import ReceiptDetail from "./ReceiptDetail";
import { invoice, receipt } from "./fixtures";

/** One receipt: the advance it holds applied to open invoices, allocations made from it, and who voided it. */

const api = vi.hoisted(() => ({ get: vi.fn(), apply: vi.fn(), invoices: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      receipts: { ...actual.revenue.receipts, get: api.get, applyAdvance: api.apply },
      invoices: { ...actual.revenue.invoices, list: api.invoices },
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/receipts/rct-4",
  useSearchParams: () => new URLSearchParams(),
}));

/** RCT/2026/0004: 5M in, 3.5M applied on the day, 1.5M held as the advance. */
const held = () =>
  receipt({
    id: "rct-4",
    receiptNo: "RCT/2026/0004",
    cash: 5_000_000_00,
    wht: 0,
    whtCreditNote: null,
    unallocated: 1_500_000_00,
    allocations: [{ invoiceId: "inv-2", invoiceNo: "INV/2026/0002", cash: 3_500_000_00, wht: 0, retention: 0, fromAdvance: false, appliedOn: null, journalId: null }],
  });

const openInvoice = () => invoice({ id: "inv-3", invoiceNo: "INV/2026/0003", open: { trade: 1_000_000_00, retention: 403_125_00, whtTaken: 0 } });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.user = { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] };
  api.invoices.mockResolvedValue({ invoices: [openInvoice()], meta: {} });
});

describe("ReceiptDetail", () => {
  it("applies the advance held to an open invoice, cash and retention released", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(held());
    api.apply.mockResolvedValue({
      ...held(),
      unallocated: 96_875_00,
      allocations: [
        ...held().allocations,
        { invoiceId: "inv-3", invoiceNo: "INV/2026/0003", cash: 1_000_000_00, wht: 0, retention: 403_125_00, fromAdvance: true, appliedOn: "2026-10-06", journalId: "jr-20" },
      ],
    });
    render(<ReceiptDetail id="rct-4" />);
    expect(await screen.findByText("Held as an advance")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply the advance" }));

    const dialog = await screen.findByRole("dialog");
    expect(api.invoices).toHaveBeenCalledWith({ client: "cp-mlsb", status: "open" });
    await user.click(await within(dialog).findByRole("button", { name: "Fill what is due now on INV/2026/0003" }));
    expect(within(dialog).getByLabelText("Cash, INV/2026/0003")).toHaveValue("1,000,000.00");
    await user.type(within(dialog).getByLabelText("Retention released (optional), INV/2026/0003"), "403125");
    expect(within(dialog).getByRole("status")).toHaveTextContent("₦96,875.00 stays held for a later invoice.");

    await user.click(within(dialog).getByRole("button", { name: "Apply the advance" }));
    expect(api.apply).toHaveBeenCalledWith("rct-4", { date: expect.any(String), allocations: [{ invoiceId: "inv-3", cash: 1_000_000_00, retention: 403_125_00 }] });
    expect((await screen.findAllByText("Advance applied. ₦96,875.00 is still held.")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/From the advance on 6 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Journal for the advance applied to INV\/2026\/0003/ })).toHaveAttribute("href", "/suite/finance/journals/jr-20");
  });

  it("downloads the official receipt", async () => {
    api.get.mockResolvedValue(held());
    render(<ReceiptDetail id="rct-4" />);
    expect(await screen.findByRole("link", { name: /Download receipt/ })).toHaveAttribute("href", "/api/finance/receipts/rct-4/pdf");
  });

  it("refuses more than the advance holds, before calling the API", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(held());
    api.invoices.mockResolvedValue({ invoices: [invoice({ id: "inv-3", invoiceNo: "INV/2026/0003", open: { trade: 5_000_000_00, retention: 0 } })], meta: {} });
    render(<ReceiptDetail id="rct-4" />);
    await user.click(await screen.findByRole("button", { name: "Apply the advance" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(await within(dialog).findByLabelText("Cash, INV/2026/0003"), "2000000");
    expect(within(dialog).getByRole("status")).toHaveTextContent("₦500,000.00 more than the advance holds.");
    expect(within(dialog).getByRole("button", { name: "Apply the advance" })).toBeDisabled();
    expect(api.apply).not.toHaveBeenCalled();
  });

  it("puts the API's refusal on the invoice's row", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(held());
    api.apply.mockRejectedValue(new ApiError("Invalid.", 422, { "allocations.0.cash": ["INV/2026/0003 has 1,000,000.00 left to pay."] }));
    render(<ReceiptDetail id="rct-4" />);
    await user.click(await screen.findByRole("button", { name: "Apply the advance" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(await within(dialog).findByLabelText("Cash, INV/2026/0003"), "100");
    await user.click(within(dialog).getByRole("button", { name: "Apply the advance" }));
    expect(await within(dialog).findByText("INV/2026/0003 has 1,000,000.00 left to pay.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Cash, INV/2026/0003")).toHaveAttribute("aria-invalid", "true");
  });

  it("offers the action only with the permission to apply advances", async () => {
    auth.user = { id: "u-2", role: "user", name: "Viewer", organisationId: "o", permissions: ["finance.receipts.view"] };
    api.get.mockResolvedValue(held());
    render(<ReceiptDetail id="rct-4" />);
    expect(await screen.findByText("Held as an advance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply the advance" })).not.toBeInTheDocument();
  });

  it("says who voided it, when, and why", async () => {
    api.get.mockResolvedValue(receipt({ status: "void", voidedAt: "2026-10-06T10:12:00+01:00", voidedBy: "Ngozi Eze", voidReason: "Keyed twice" }));
    render(<ReceiptDetail id="rct-2" />);
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent("Voided by Ngozi Eze on 6 Oct 2026");
    expect(note).toHaveTextContent("Reason: Keyed twice");
    expect(screen.queryByRole("button", { name: "Apply the advance" })).not.toBeInTheDocument();
  });
});
