import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceiptForm from "./ReceiptForm";
import { candidate, invoice } from "./fixtures";
import { bank } from "../vouchers/fixtures";

/** Money in: a statement line fills the receipt, the money is spread over open invoices, and over-application is refused. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  candidates: vi.fn(),
  banks: vi.fn(),
  counterparties: vi.fn(),
}));
const nav = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      invoices: { ...actual.revenue.invoices, list: api.list, get: api.get },
      receipts: { ...actual.revenue.receipts, create: api.create, candidates: api.candidates },
    },
  };
});
vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.banks } } };
});
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, lookups: { ...actual.orgFoundations.lookups, counterparties: api.counterparties } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/receipts/new",
  useSearchParams: () => nav.params,
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  nav.push.mockReset();
  nav.params = new URLSearchParams();
  api.banks.mockResolvedValue([bank({ id: "bank-1", name: "Main operating account" })]);
  api.counterparties.mockResolvedValue([{ id: "cp-mlsb", code: "MLSB", name: "Meridian Library Services Board", roles: ["client"] }]);
  api.candidates.mockResolvedValue([candidate()]);
  api.list.mockResolvedValue({ invoices: [invoice()], meta: { drafts: 0, outstanding: 0, overdue: 0, invoicedThisYear: 0 } });
});

describe("ReceiptForm", { timeout: 20_000 }, () => {
  it("starts from an invoice: its client, paid in full less WHT, and the amount to match", async () => {
    nav.params = new URLSearchParams("client=cp-mlsb&invoice=inv-3");
    render(<ReceiptForm />);
    // 7,659,375.00 to pay now, less 375,000.00 WHT expected.
    expect(await screen.findAllByDisplayValue("7,284,375.00", {}, { timeout: 3000 })).toHaveLength(2);
    expect(screen.getByLabelText(/^Cash/)).toHaveValue("7,284,375.00");
    expect(screen.getByLabelText(/^WHT deducted/)).toHaveValue("375,000.00");
    expect(screen.getByRole("status")).toHaveTextContent("All of it is applied to invoices.");
    expect(api.list).toHaveBeenCalledWith({ client: "cp-mlsb", status: "open" });
    // The list rows carry their balances: no call per invoice.
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fills account, date and amount from a statement line, and sends it with the allocation", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue({ id: "rct-9", receiptNo: "RCT/2026/0009" });
    render(<ReceiptForm />);
    await user.click(await screen.findByRole("radio", { name: /MERIDIAN LIBRARY SERVICES BOARD/ }));
    expect(screen.getByLabelText(/^Amount received/)).toHaveValue("7,284,375.00");
    expect(screen.getByLabelText(/^Amount received/)).toBeDisabled();
    expect(screen.getByLabelText(/^Received on/)).toHaveValue("2026-10-04");

    // The line named its client, so the client's invoices are on screen.
    await user.click(await screen.findByRole("button", { name: "Pay INV/2026/0003 in full less WHT" }));
    await user.click(screen.getByRole("button", { name: "Record receipt" }));
    expect(api.create).toHaveBeenCalledWith({
      clientId: "cp-mlsb",
      bankAccountId: "bank-1",
      receivedOn: "2026-10-04",
      cash: 7_284_375_00,
      reference: "26BK0104411",
      statementLineId: "sl-1",
      allocations: [{ invoiceId: "inv-3", cash: 7_284_375_00, wht: 375_000_00, retention: 0 }],
    });
    expect(nav.push).toHaveBeenCalledWith("/suite/finance/revenue/receipts/rct-9?notice=recorded");
  });

  it("keeps what is not applied as an advance, and refuses more than came in or more than is owed", async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams("client=cp-mlsb");
    render(<ReceiptForm />);
    const amountBox = screen.getByLabelText(/^Amount received/);
    await user.type(amountBox, "1,000,000");
    const cash = await screen.findByLabelText(/^Cash/);
    await user.type(cash, "400,000");
    expect(screen.getByRole("status")).toHaveTextContent("₦600,000.00 goes to the client's advances");

    await user.clear(cash);
    await user.type(cash, "1,200,000");
    expect(screen.getByRole("status")).toHaveTextContent("₦200,000.00 more than came in is applied");
    expect(screen.getByRole("button", { name: "Record receipt" })).toBeDisabled();

    const panel = screen.getByRole("status").closest("section") as HTMLElement;
    expect(within(panel).getByText("Over-applied")).toBeInTheDocument();

    await user.clear(amountBox);
    await user.type(amountBox, "9,000,000");
    await user.clear(cash);
    await user.type(cash, "8,000,000");
    expect(screen.getByText("INV/2026/0003 has ₦7,659,375.00 left to pay (before retention).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record receipt" }));
    expect(api.create).not.toHaveBeenCalled();
  });
});
