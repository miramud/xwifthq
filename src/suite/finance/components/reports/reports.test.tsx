import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrialBalanceReport from "./TrialBalanceReport";
import BalanceSheetReport from "./BalanceSheetReport";
import CashFlowReport from "./CashFlowReport";
import { toCsv } from "./shared";

/** The statements: totals and the balanced check, filters in the address, CSV, and the cash bridge. */

const api = vi.hoisted(() => ({ trialBalance: vi.fn(), balanceSheet: vi.fn(), cashFlow: vi.fn() }));
const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, reports: { ...actual.ledger.reports, ...api } } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/reports/trial-balance",
  useSearchParams: () => search.value,
}));

const section = (rows: [string, string, number, string | null][]) => ({
  rows: rows.map(([code, name, amount, group]) => ({ accountId: code, code, name, amount, group })),
  total: rows.reduce((s, r) => s + r[2], 0),
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  replace.mockReset();
  search.value = new URLSearchParams();
  api.trialBalance.mockResolvedValue({
    rows: [
      { accountId: "bank", code: "1110", name: "Main operating account", type: "asset", openingDebit: 100_000_000, openingCredit: 0, debit: 50_000_000, credit: 20_000_000, closingDebit: 130_000_000, closingCredit: 0 },
      { accountId: "fees", code: "4100", name: "Tuition and academic fees", type: "revenue", openingDebit: 0, openingCredit: 100_000_000, debit: 20_000_000, credit: 50_000_000, closingDebit: 0, closingCredit: 130_000_000 },
    ],
    totals: { openingDebit: 100_000_000, openingCredit: 100_000_000, debit: 70_000_000, credit: 70_000_000, closingDebit: 130_000_000, closingCredit: 130_000_000 },
    balanced: true,
    currency: "NGN",
  });
});

describe("Trial balance", () => {
  it("lists balances by family with totals, says it balances, and links each account to its ledger", async () => {
    search.value = new URLSearchParams("from=2026-01-01&to=2026-08-31");
    render(<TrialBalanceReport />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Assets")).toBeInTheDocument();
    expect(within(table).getByText("Income")).toBeInTheDocument();
    expect(within(table).getAllByText("1,300,000.00")).toHaveLength(4);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Main operating account" })).toHaveAttribute(
      "href",
      "/suite/finance/reports/ledger/bank?from=2026-01-01&to=2026-08-31",
    );
    expect(api.trialBalance).toHaveBeenCalledWith(expect.objectContaining({ from: "2026-01-01", to: "2026-08-31" }));
  });

  it("writes a date change into the address, so the report can be linked", async () => {
    const user = userEvent.setup();
    render(<TrialBalanceReport />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("radio", { name: "With movements" }));
    expect(screen.getByRole("columnheader", { name: "Opening Dr" })).toBeInTheDocument();
    const to = screen.getByLabelText("To");
    await user.type(to, "2026-06-30");
    expect(replace).toHaveBeenLastCalledWith("/suite/finance/reports/trial-balance?to=2026-06-30", { scroll: false });
  });

  it("says by how much it is out when it does not balance", async () => {
    api.trialBalance.mockResolvedValueOnce({
      rows: [],
      totals: { openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 100_00, closingCredit: 50_00 },
      balanced: false,
      currency: "NGN",
    });
    render(<TrialBalanceReport />);
    expect(await screen.findByText("Out by ₦50.00")).toBeInTheDocument();
  });

  it("quotes CSV cells that need it", () => {
    expect(toCsv([["Code", "Account"], ["4100", 'Fees, "tuition"']])).toBe('Code,Account\r\n4100,"Fees, ""tuition"""');
  });
});

describe("Financial position", () => {
  it("shows the unclosed surplus inside net assets and the two sides meeting", async () => {
    api.balanceSheet.mockResolvedValue({
      asAt: "2026-10-05",
      currency: "NGN",
      currentAssets: section([["1110", "Main operating account", 500_000_00, "Cash and bank"], ["1120", "Fees collection account", 300_000_00, "Cash and bank"]]),
      nonCurrentAssets: section([]),
      totalAssets: 800_000_00,
      currentLiabilities: section([["2110", "Trade payables", 200_000_00, "Payables"]]),
      nonCurrentLiabilities: section([]),
      totalLiabilities: 200_000_00,
      equity: section([["3010", "Accumulated surplus", 450_000_00, "Net assets and reserves"]]),
      unclosedSurplus: 150_000_00,
      totalEquity: 600_000_00,
      balanced: true,
    });
    render(<BalanceSheetReport />);
    expect(await screen.findByText("Surplus for the year, not yet closed")).toBeInTheDocument();
    expect(screen.getByText("Cash and bank")).toBeInTheDocument();
    expect(screen.getAllByText("800,000.00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });
});

describe("Cash flow", () => {
  it("bridges opening to closing cash through the three activities", async () => {
    api.cashFlow.mockResolvedValue({
      from: "2026-01-01",
      to: "2026-10-05",
      currency: "NGN",
      openingCash: 1_000_000_00,
      operating: { rows: [{ label: "Tuition", amount: 600_000_00 }, { label: "Staff costs", amount: -400_000_00 }], inflows: 600_000_00, outflows: 400_000_00, total: 200_000_00 },
      investing: { rows: [{ label: "ICT equipment", amount: -50_000_00 }], inflows: 0, outflows: 50_000_00, total: -50_000_00 },
      financing: { rows: [], inflows: 0, outflows: 0, total: 0 },
      netChange: 150_000_00,
      closingCash: 1_150_000_00,
    });
    render(<CashFlowReport />);
    expect(await screen.findByText("Net cash from operating activities")).toBeInTheDocument();
    expect(screen.getByText("(400,000.00)")).toBeInTheDocument();
    expect(screen.getByText("No cash moved")).toBeInTheDocument();
    expect(screen.getByText("Net increase in cash")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Cash from opening to closing balance" })).toBeInTheDocument();
  });
});
