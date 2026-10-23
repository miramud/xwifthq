import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BankAccountDetail, { rangeFor } from "./BankAccountDetail";
import { account, summary } from "./fixtures";
import { monthKey, shiftMonth } from "./labels";
import type { StatementAnalysis } from "@/lib/api/finance-banking-client";

/** One bank account: statements, the 12-month reconciliation strip, and the analysis range. */

const api = vi.hoisted(() => ({ get: vi.fn(), analysis: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, ...api } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Me" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/banking/ba-1",
  useSearchParams: () => new URLSearchParams(),
}));

const analysis: StatementAnalysis = {
  account: { id: "ba-1", name: "UBA operating account", bank: "UBA", number: "•••• 4421", currency: "NGN", type: "current" },
  summary: { opening: 100_000_000_00, inflows: 15_000_000_00, outflows: 40_000_000_00, closing: 75_000_000_00, lines: 3, from: "2026-09-01", to: "2026-09-30", checks: [], posted: 0, unposted: 3 },
  inflowsBySource: [{ label: "Receipts from clients and others", amount: 15_000_000_00, count: 1, top: [] }],
  outflowsByCategory: [{ label: "Operating payments", amount: 40_000_000_00, count: 2 }],
  outflowsByProject: [],
  bankCharges: { total: 5_375_00, byType: [{ label: "SMS alerts", amount: 400_00 }, { label: "Stamp duty", amount: 0 }], percentOfTurnover: 0.01, monthly: [], audit: [{ month: "2026-09", maintenance: 100_00, vatCharged: 20_00, vatExpected: 8_00, message: "VAT on maintenance is not 7.5% of the charge." }] },
  topPayees: [{ name: "ADEX VENTURES LTD", amount: 30_000_000_00, count: 1 }],
  topPayers: [],
  balance: { daily: [{ date: "2026-09-01", balance: 90_000_000_00 }, { date: "2026-09-30", balance: 75_000_000_00 }], min: 75_000_000_00, max: 90_000_000_00, average: 82_500_000_00, daysBelowThreshold: 0, daysOverdrawn: 0 },
  cashConversion: { receivedFromOthers: 15_000_000_00, movedToOwnAccounts: 0, spentDirectly: 40_000_000_00 },
  anomalies: [{ type: "round_sum", severity: "info", message: "1 round-sum payment(s) of ₦1m or more.", lineIds: ["ln-1"] }],
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.analysis.mockResolvedValue(analysis);
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("BankAccountDetail", () => {
  it("anchors the analysis on the latest statement month", () => {
    expect(rangeFor("latest", "2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(rangeFor("quarter", "2026-02")).toEqual({ from: "2025-12-01", to: "2026-02-28" });
    expect(rangeFor("year", "2026-09")).toEqual({ from: "2025-10-01", to: "2026-09-30" });
  });

  it("shows statements, the reconciliation strip and the analysis", async () => {
    const user = userEvent.setup();
    const last = shiftMonth(monthKey(new Date()), -1);
    api.get.mockResolvedValue({
      ...account({ lowBalanceThreshold: 80_000_000_00 }),
      imports: [summary()],
      reconciliations: [{ periodKey: last, status: "approved", difference: 0, statementClosing: 1, glClosing: 1 }],
    });
    render(<BankAccountDetail id="ba-1" />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("UBA operating account");
    expect(screen.getByRole("link", { name: /1 Sep 2026 – 30 Sep 2026/ })).toHaveAttribute("href", "/suite/finance/banking/imports/imp-1");

    const strip = screen.getByRole("list", { name: "Reconciliation by month" });
    const months = within(strip).getAllByRole("link");
    expect(months).toHaveLength(12);
    expect(months[10]).toHaveAccessibleName(/: Approved$/);
    expect(months[10]).toHaveAttribute("href", `/suite/finance/banking/ba-1/reconciliation/${last}`);
    expect(months[0]).toHaveAccessibleName(/: Not reconciled$/);

    await waitFor(() => expect(api.analysis).toHaveBeenCalledWith("ba-1", "2026-09-01", "2026-09-30"));
    expect(await screen.findByText("ADEX VENTURES LTD")).toBeInTheDocument();
    expect(screen.getByText(/VAT on maintenance is not 7.5%/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Daily closing balance/ })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "3 months" }));
    await waitFor(() => expect(api.analysis).toHaveBeenLastCalledWith("ba-1", "2026-07-01", "2026-09-30"));
  });

  it("edits the account's details, with column headings for a CSV export", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue({ ...account(), imports: [], reconciliations: [] });
    api.update.mockResolvedValue(account());
    render(<BankAccountDetail id="ba-1" />);

    await user.click(await screen.findByRole("button", { name: "Edit account" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("Account name");
    await user.clear(name);
    await user.type(name, "UBA main account");
    // Column headings only matter for CSV and Excel exports.
    expect(within(dialog).queryByLabelText("Narration")).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Statement format"));
    await user.click(await screen.findByRole("option", { name: /CSV export/ }));
    await user.type(within(dialog).getByLabelText("Narration"), "Remarks");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0][0]).toBe("ba-1");
    expect(api.update.mock.calls[0][1]).toMatchObject({ name: "UBA main account", statementTemplate: "csv", columnMapping: { narration: "Remarks" } });
    expect((await screen.findAllByText("Account details saved.")).length).toBeGreaterThan(0);
  });

  it("closes the account after asking", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ ...account(), imports: [], reconciliations: [] }).mockResolvedValue({ ...account({ status: "closed" }), imports: [], reconciliations: [] });
    api.update.mockResolvedValue(account({ status: "closed" }));
    render(<BankAccountDetail id="ba-1" />);

    await user.click(await screen.findByRole("button", { name: "Close account" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Close account" }));
    expect(api.update).toHaveBeenCalledWith("ba-1", { status: "closed" });
    expect(await screen.findByRole("button", { name: "Reopen account" })).toBeInTheDocument();
  });
});
