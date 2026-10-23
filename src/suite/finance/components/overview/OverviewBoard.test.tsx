import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Period } from "@/lib/api/finance-ledger-client";
import OverviewBoard from "./OverviewBoard";

/** The morning view: bank against book, the months, what is waiting, and blocks hidden from people who can't see them. */

const api = vi.hoisted(() => ({
  incomeStatement: vi.fn(),
  balanceSheet: vi.fn(),
  ledger: vi.fn(),
  periods: vi.fn(),
  journals: vi.fn(),
  request: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-request")>();
  return { ...actual, financeRequest: api.request };
});

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return {
    ...actual,
    ledger: {
      ...actual.ledger,
      reports: { ...actual.ledger.reports, incomeStatement: api.incomeStatement, balanceSheet: api.balanceSheet, ledger: api.ledger },
      periods: { ...actual.ledger.periods, list: api.periods },
      journals: { ...actual.ledger.journals, list: api.journals },
    },
  };
});

vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

const empty = { rows: [], total: 0 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  replace.mockReset();
  auth.user = { id: "u", role: "admin", name: "Bursar", organisationId: "o", permissions: [] };
  api.incomeStatement.mockResolvedValue({
    from: "2026-01-01",
    to: "2026-10-06",
    currency: "NGN",
    revenue: { rows: [{ accountId: "f", code: "4100", name: "Tuition", group: "Revenue", amount: 900_000_000_00 }], total: 900_000_000_00 },
    costOfRevenue: empty,
    grossSurplus: 900_000_000_00,
    expenses: {
      rows: [
        { accountId: "s", code: "5100", name: "Academic staff salaries", group: "Staff costs", amount: 400_000_000_00 },
        { accountId: "u", code: "6100", name: "Electricity", group: "Utilities", amount: 50_000_000_00 },
      ],
      total: 450_000_000_00,
    },
    operatingSurplus: 450_000_000_00,
    otherIncome: empty,
    otherExpenses: empty,
    netSurplus: 450_000_000_00,
    monthly: [{ month: "2026-01", label: "Jan 2026", income: 100_000_000_00, directCosts: 0, expenses: 50_000_000_00, surplus: 50_000_000_00 }],
  });
  api.balanceSheet.mockResolvedValue({
    asAt: "2026-10-06",
    currency: "NGN",
    currentAssets: empty,
    nonCurrentAssets: empty,
    totalAssets: 1_000_000_000_00,
    currentLiabilities: empty,
    nonCurrentLiabilities: empty,
    totalLiabilities: 200_000_000_00,
    equity: empty,
    unclosedSurplus: 450_000_000_00,
    totalEquity: 800_000_000_00,
    balanced: true,
  });
  api.periods.mockResolvedValue(
    MONTHS.map(
      (m, i): Period => ({
        id: `p${i}`,
        key: `2026-${String(i + 1).padStart(2, "0")}`,
        label: `${m} 2026`,
        startsOn: "",
        endsOn: "",
        status: i < 7 ? "locked" : i === 7 ? "soft_closed" : "open",
        posted: 10,
        postedTotal: 0,
        drafts: i === 8 ? 1 : 0,
        pending: 0,
        changedAt: null,
        reopenReason: null,
      }),
    ),
  );
  api.journals.mockImplementation(({ status }: { status: string }) =>
    Promise.resolve(status === "pending_approval" ? [{ id: "j1", total: 2_500_000_00 }, { id: "j2", total: 500_000_00 }] : []),
  );
  api.ledger.mockResolvedValue({ opening: 0, closing: 0, lines: [], currency: "NGN" });
  api.request.mockImplementation((path: string) =>
    Promise.resolve(
      path === "bank-accounts"
        ? {
            data: [
              { id: "b1", name: "Main operating account", number: "****4421", currency: "NGN", glAccount: { id: "g1", code: "1110", name: "Main" }, bookBalance: 120_000_000_00, bankBalance: 119_500_000_00, bankBalanceDate: "2026-09-30", lastReconciled: "2026-08-31", unreconciledCount: 3, unreconciledValue: 0, lowBalanceThreshold: null },
              { id: "b2", name: "TETFund projects account", number: "****0098", currency: "NGN", glAccount: null, bookBalance: 5_000_000_00, bankBalance: 5_000_000_00, bankBalanceDate: "2026-09-30", lastReconciled: "2026-09-30", unreconciledCount: 0, unreconciledValue: 0, lowBalanceThreshold: 10_000_000_00 },
            ],
          }
        : { data: [{ id: "s1", bankAccount: "Main operating account", fileName: "sept.pdf", periodFrom: "2026-09-01", periodTo: "2026-09-30", lineCount: 212 }] },
    ),
  );
});

describe("OverviewBoard", () => {
  it("puts bank against book, flags the low balance, and lists what is waiting", async () => {
    render(<OverviewBoard today={new Date(2026, 9, 6)} />);

    const main = (await screen.findByText("Main operating account", { selector: "span.block.truncate.text-sm.font-semibold" })).closest("a") as HTMLElement;
    expect(within(main).getByText("Bank differs by ₦500,000.00")).toBeInTheDocument();
    expect(screen.getByText("Below the ₦10M floor")).toBeInTheDocument();

    expect(screen.getByText("2 journals awaiting approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review Main operating account statement/ })).toHaveAttribute("href", "/suite/finance/banking/imports/s1");
    expect(screen.getByText("Main operating account: 1 month to reconcile")).toBeInTheDocument();
    expect(screen.getByText("Sep 2026 is still open")).toBeInTheDocument();

    expect(screen.getByRole("list", { name: "Accounting months" })).toHaveTextContent("This month");
    expect(await screen.findByText("Expenditure by group")).toBeInTheDocument();
    expect(screen.getAllByText("Balanced").length).toBeGreaterThan(0);
  });

  it("shows a finance viewer the ledger but not the banks", async () => {
    auth.user = { id: "v", role: "user", name: "Viewer", organisationId: "o", permissions: ["finance.reports.trial_balance", "finance.journals.view", "finance.periods.view"] };
    render(<OverviewBoard today={new Date(2026, 9, 6)} />);
    expect(await screen.findByText("Total assets")).toBeInTheDocument();
    expect(screen.queryByText("Cash position")).not.toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "New journal" })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves the months out for somebody who keys journals or runs month-end without periods", async () => {
    auth.user = { id: "c", role: "user", name: "Clerk", organisationId: "o", permissions: ["finance.journals.view", "finance.period_end.close_year"] };
    render(<OverviewBoard today={new Date(2026, 9, 6)} />);
    expect(await screen.findByText("2 journals awaiting approval")).toBeInTheDocument();
    expect(api.periods).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "Accounting months" })).not.toBeInTheDocument();
  });

  it("sends somebody with none of its features to their own requests", () => {
    auth.user = { id: "s", role: "user", name: "Staff", organisationId: "o", permissions: ["finance.fcu.queues"] };
    render(<OverviewBoard today={new Date(2026, 9, 6)} />);
    expect(replace).toHaveBeenCalledWith("/suite/finance/requests");
    expect(screen.getByRole("status")).toHaveTextContent("Opening your requests");
    expect(api.request).not.toHaveBeenCalled();
    expect(api.incomeStatement).not.toHaveBeenCalled();
  });
});
