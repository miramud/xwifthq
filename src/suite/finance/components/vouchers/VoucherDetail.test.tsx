import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/finance-payments-client";
import VoucherDetail from "./VoucherDetail";
import VouchersBoard from "./VouchersBoard";
import { bank, detail, pv } from "./fixtures";

/** The voucher page: where it is, what it says, and what may be done to it by whom. */

const api = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn(), approve: vi.fn(), cancel: vi.fn(), submit: vi.fn(), banks: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-ada", role: "admin", name: "Ada Obi", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return {
    ...actual,
    spend: { ...actual.spend, vouchers: { ...actual.spend.vouchers, get: api.get, list: api.list, approve: api.approve, cancel: api.cancel, submit: api.submit } },
  };
});
vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.banks } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/vouchers",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.user = { id: "u-ada", role: "admin", name: "Ada Obi", organisationId: "o", permissions: [] };
  api.banks.mockResolvedValue([bank()]);
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("VoucherDetail", () => {
  it("reads like the paper voucher: number, amount in words, lines, signatures", async () => {
    api.get.mockResolvedValue(detail());
    render(<VoucherDetail id="pv-3" />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("PV/2026/10/0003");
    expect(screen.getAllByText("Nine hundred and seventy-five thousand naira only").length).toBeGreaterThan(0);
    expect(screen.getByText("Hosting, October to December")).toBeInTheDocument();
    expect(screen.getByText("technical 10%")).toBeInTheDocument();
    const pipeline = screen.getByRole("list", { name: "Where this voucher is" });
    expect(within(pipeline).getByText("Drafted").parentElement).toHaveTextContent("in progress");
    expect(screen.getByRole("link", { name: /Print voucher/ })).toHaveAttribute("href", "/api/finance/vouchers/pv-3/pdf");
    // The preparer may edit and send their own draft.
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/suite/finance/vouchers/pv-3?edit=1");
    expect(screen.getByRole("button", { name: "Send to FCU" })).toBeInTheDocument();
  });

  it("offers a direct approval once the FCU has checked it and no approval process runs, and shows a refusal plainly", async () => {
    const user = userEvent.setup();
    auth.user = { ...auth.user, id: "u-md" };
    api.get.mockResolvedValue(detail({ status: "fcu_checked", approvalId: null }));
    api.approve.mockRejectedValue(new ApiError("Invalid.", 422, { duties: ["SOD_VIOLATION: you are the FCU officer on this document, so you cannot also act as its voucher authoriser."] }));
    render(<VoucherDetail id="pv-3" />);
    await user.click(await screen.findByRole("button", { name: "Approve voucher" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Approve voucher" }));
    expect(api.approve).toHaveBeenCalledWith("pv-3");
    expect(await screen.findByText("you are the FCU officer on this document, so you cannot also act as its voucher authoriser.")).toBeInTheDocument();
    expect(screen.queryByText(/SOD_VIOLATION/)).not.toBeInTheDocument();
    // Not the preparer: no edit.
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("cancels with a reason and says the number stays", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail({ status: "approved", accrualJournalId: "j-1" }));
    api.cancel.mockResolvedValue(
      detail({ status: "cancelled", history: [{ from: "approved", to: "cancelled", by: "Ada Obi", comment: "Duplicate", at: "2026-10-05T10:00:00Z" }] }),
    );
    render(<VoucherDetail id="pv-3" />);
    expect(await screen.findByRole("link", { name: "Open the journal" })).toHaveAttribute("href", "/suite/finance/journals/j-1");
    await user.click(screen.getByRole("button", { name: "Cancel voucher" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("The accrual journal is reversed");
    await user.click(within(dialog).getByRole("button", { name: "Cancel voucher" }));
    expect(within(dialog).getByText("Why it is cancelled is needed.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Why it is cancelled"), "Duplicate");
    await user.click(within(dialog).getByRole("button", { name: "Cancel voucher" }));
    expect(api.cancel).toHaveBeenCalledWith("pv-3", "Duplicate");
    expect(await screen.findByText(/Cancelled by Ada Obi/)).toHaveTextContent("stays in the register");
  });
});

describe("VoucherDetail budget check", () => {
  it("shows the warning the budget check stored when the voucher was sent", async () => {
    api.get.mockResolvedValue(
      detail({
        status: "submitted_to_fcu",
        budgetCheck: {
          result: "warn",
          lines: [{ accountId: "a-6100", account: "6100 Travel", projectId: null, costCentreId: null, budget: 1_000_000_00, actual: 900_000_00, request: 250_000_00, over: 150_000_00, mode: "warn" }],
        },
      }),
    );
    render(<VoucherDetail id="pv-3" />);
    const panel = await screen.findByRole("region", { name: "Budget check" });
    expect(within(panel).getByRole("heading", { name: "Sent over budget" })).toBeInTheDocument();
    const row = within(panel).getByRole("row", { name: /6100 Travel/ });
    expect(row).toHaveTextContent("1,000,000.00");
    expect(row).toHaveTextContent("900,000.00");
    expect(row).toHaveTextContent("250,000.00");
    expect(row).toHaveTextContent("₦150,000.00");
    expect(within(row).getByText("Warn")).toBeInTheDocument();
  });

  it("shows a BLOCK refusal as its own panel, without the machine code", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    api.submit.mockRejectedValue(
      new ApiError("Invalid.", 422, {
        budget: ["BUDGET_EXCEEDED: 6100 Travel would be 150,000.00 over its budget for the year (budget 1,000,000.00, spent 900,000.00, this voucher 250,000.00). Revise the budget or recode the line."],
      }),
    );
    render(<VoucherDetail id="pv-3" />);
    await user.click(await screen.findByRole("button", { name: "Send to FCU" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not sent: over budget");
    expect(alert).toHaveTextContent("6100 Travel would be 150,000.00 over its budget");
    expect(alert).not.toHaveTextContent("BUDGET_EXCEEDED");
  });
});

describe("VouchersBoard", () => {
  it("lists vouchers by number with counts per stage, and searches", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      pv({ id: "a", pvNo: "PV/2026/10/0004", status: "in_approval", payee: "Brightline Supplies", net: 950_000_00 }),
      pv({ id: "b", pvNo: "PV/2026/10/0003", status: "draft" }),
      pv({ id: "c", pvNo: "PV/2026/09/0001", status: "payment_initiated", payee: "Swiftlink Networks", cibReference: "CIB123" }),
    ]);
    render(<VouchersBoard />);
    expect(await screen.findByText("Brightline Supplies")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Drafts\s*1/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Awaiting authorisation/ }));
    expect(screen.queryByText("Swiftlink Networks")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    await user.type(screen.getByLabelText("Search vouchers"), "CIB123");
    expect(screen.getByText("Swiftlink Networks")).toBeInTheDocument();
    expect(screen.queryByText("Brightline Supplies")).not.toBeInTheDocument();
  });
});
