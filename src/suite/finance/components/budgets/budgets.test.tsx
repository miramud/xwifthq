import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BudgetDetail as Detail, BudgetSummary, BudgetsIndex, VarianceRow } from "@/lib/api/finance-budgets-client";
import BudgetsBoard from "./BudgetsBoard";
import BudgetDetail from "./BudgetDetail";
import { headlineVersion, inPreparation, signedPct } from "./meta";

/** Company budgets: the years and versions, the controls, budget against actual and the line grid. */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), get: vi.fn(), saveRow: vi.fn(), refreshRevenue: vi.fn(), submit: vi.fn(), setControl: vi.fn(), check: vi.fn() }));
const ledgerApi = vi.hoisted(() => ({ list: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-budgets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-budgets-client")>();
  return { ...actual, budgets: api };
});
vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, accounts: { ...actual.ledger.accounts, list: ledgerApi.list } } };
});
vi.mock("@/suite/finance/components/revenue/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/suite/finance/components/revenue/ui")>();
  return { ...actual, useProjectOptions: () => ({ status: "ready", items: [{ value: "p-portal", label: "Student Portal Rebuild" }] }) };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/budgets",
  useSearchParams: () => nav.params,
}));

const M = 1_000_000_00;
const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

const summary = (over: Partial<BudgetSummary> = {}): BudgetSummary => ({
  id: "b-orig",
  fiscalYear: 2026,
  name: "Budget 2026",
  version: "ORIGINAL",
  versionNo: 0,
  status: "approved",
  currency: "NGN",
  approvalId: null,
  approvedAt: "2026-01-20T09:00:00Z",
  totals: { income: 900 * M, expense: 700 * M, net: 200 * M },
  createdBy: "Adaeze",
  ...over,
});

const index = (over: Partial<BudgetsIndex> = {}): BudgetsIndex => ({
  currentYear: 2026,
  budgets: [summary({ id: "b-rev1", version: "REVISED_1", versionNo: 1, status: "draft", approvedAt: null, totals: { income: 950 * M, expense: 720 * M, net: 230 * M } }), summary()],
  controls: [{ accountId: "a-6100", code: "6100", name: "Travel", mode: "warn" }],
  ...over,
});

const vrow = (over: Partial<VarianceRow>): VarianceRow => ({
  accountId: "a-4000",
  code: "4000",
  name: "Implementation fees",
  type: "revenue",
  income: true,
  budget: Array(12).fill(75 * M),
  actual: [80 * M, 70 * M, 90 * M, ...Array(9).fill(0)],
  budgetYtd: 225 * M,
  actualYtd: 240 * M,
  varianceYtd: 15 * M,
  variancePct: 6.7,
  budgetYear: 900 * M,
  actualYear: 240 * M,
  ...over,
});

const detail = (over: Partial<Detail> = {}): Detail => ({
  ...summary({ id: "b-rev1", version: "REVISED_1", versionNo: 1, status: "draft", approvedAt: null }),
  months,
  rows: [
    { accountId: "a-4000", code: "4000", name: "Implementation fees", type: "revenue", projectId: "p-portal", costCentreId: null, source: "contracts", months: Object.fromEntries(months.map((m) => [m, 75 * M])), total: 900 * M },
    { accountId: "a-6100", code: "6100", name: "Travel", type: "expense", projectId: null, costCentreId: "cc-ops", source: "manual", months: Object.fromEntries(months.map((m) => [m, 5 * M])), total: 60 * M },
  ],
  versusActual: {
    months,
    ytdMonths: 3,
    rows: [vrow({}), vrow({ accountId: "a-6100", code: "6100", name: "Travel", type: "expense", income: false, budget: Array(12).fill(5 * M), actual: [6 * M, 7 * M, 5 * M, ...Array(9).fill(0)], budgetYtd: 15 * M, actualYtd: 18 * M, varianceYtd: -3 * M, variancePct: 20, budgetYear: 60 * M, actualYear: 18 * M })],
    totals: {
      incomeBudgetYtd: 225 * M,
      incomeActualYtd: 240 * M,
      expenseBudgetYtd: 15 * M,
      expenseActualYtd: 18 * M,
      incomeBudgetYear: 900 * M,
      expenseBudgetYear: 60 * M,
      monthlyIncomeBudget: Array(12).fill(75 * M),
      monthlyIncomeActual: [80 * M, 70 * M, 90 * M, ...Array(9).fill(0)],
      monthlyExpenseBudget: Array(12).fill(5 * M),
      monthlyExpenseActual: [6 * M, 7 * M, 5 * M, ...Array(9).fill(0)],
    },
  },
  projects: [{ id: "p-portal", name: "Student Portal Rebuild", code: "SPR" }],
  costCentres: [{ id: "cc-ops", code: "OPS", name: "Operations" }],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  ledgerApi.list.mockReset();
  nav.push.mockReset();
  nav.params = new URLSearchParams();
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
  ledgerApi.list.mockResolvedValue({ accounts: [], templates: [], systemKeys: [] });
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("BudgetsBoard", () => {
  it("lines up the year's versions, marks the one in force, and opens the draft", async () => {
    api.list.mockResolvedValue(index());
    render(<BudgetsBoard />);
    const line = await screen.findByRole("list", { name: "FY2026 budget versions" });
    const items = within(line).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Original");
    expect(items[0]).toHaveTextContent("In force");
    expect(items[1]).toHaveTextContent("Revision 1");
    expect(items[1]).toHaveTextContent("Draft");
    // A version is being prepared: the action opens it rather than starting another.
    expect(screen.getByRole("link", { name: "Open the draft" })).toHaveAttribute("href", "/suite/finance/budgets/b-rev1");
    expect(screen.queryByRole("button", { name: "Start a revision" })).not.toBeInTheDocument();
  });

  it("starts a revision only after confirming, then opens its lines", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(index({ budgets: [summary()] }));
    api.create.mockResolvedValue(summary({ id: "b-new", status: "draft", version: "REVISED_1", versionNo: 1 }));
    render(<BudgetsBoard />);
    await user.click(await screen.findByRole("button", { name: "Start a revision" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("stays in force until the revision is approved");
    await user.click(within(dialog).getByRole("button", { name: "Start a revision" }));
    expect(api.create).toHaveBeenCalledWith({ fiscalYear: 2026 });
    expect(nav.push).toHaveBeenCalledWith("/suite/finance/budgets/b-new?tab=lines");
  });

  it("takes a control off only after confirming", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(index());
    api.setControl.mockResolvedValue({ accountId: "a-6100", mode: "off" });
    render(<BudgetsBoard />);
    const group = await screen.findByRole("radiogroup", { name: "Control on 6100 Travel" });
    await user.click(within(group).getByRole("radio", { name: "Off" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Take control off" }));
    expect(api.setControl).toHaveBeenCalledWith("a-6100", "off");
    expect(await screen.findByRole("status")).toHaveTextContent("6100 Travel is no longer checked against the budget.");
  });
});

describe("BudgetDetail", () => {
  it("reads budget against actual the favourable way: income over is good, expense over is not", async () => {
    api.get.mockResolvedValue(detail());
    render(<BudgetDetail id="b-rev1" />);
    expect(await screen.findByText(/3 closed months, to the end of March 2026/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Budget against actual by account, year to date" });
    const fees = within(table).getByRole("row", { name: /Implementation fees/ });
    expect(fees).toHaveTextContent("favourable");
    expect(fees).toHaveTextContent("+6.7%");
    const travel = within(table).getByRole("row", { name: /Travel/ });
    expect(travel).toHaveTextContent("unfavourable");
    expect(travel).toHaveTextContent("+20%");
    // Months not yet closed say so in the heat map.
    expect(screen.getByRole("button", { name: /6100 Travel, April 2026: not closed yet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /6100 Travel, January 2026: .* unfavourable by/ })).toBeInTheDocument();
  });

  it("filters by cost centre through the API", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    render(<BudgetDetail id="b-rev1" />);
    await screen.findByText(/closed months/);
    await user.click(screen.getByRole("combobox", { name: "Cost centre" }));
    await user.click(await screen.findByRole("option", { name: /OPS Operations/ }));
    expect(api.get).toHaveBeenLastCalledWith("b-rev1", { projectId: null, costCentreId: "cc-ops" });
  });

  it("keeps contract revenue read-only and edits a typed line in place, spread evenly", async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams("tab=lines");
    api.get.mockResolvedValue(detail());
    api.saveRow.mockResolvedValue(summary({ status: "draft" }));
    render(<BudgetDetail id="b-rev1" />);
    const grid = await screen.findByRole("table", { name: "Budget lines by month, FY2026" });
    const fees = within(grid).getByRole("row", { name: /Implementation fees/ });
    expect(fees).toHaveTextContent("From the contract register");
    expect(within(fees).queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();

    await user.click(within(grid).getByRole("button", { name: "Edit 6100 Travel, OPS Operations" }));
    const year = screen.getByLabelText("The year");
    await user.clear(year);
    await user.type(year, "120,000,000");
    await user.click(screen.getByRole("button", { name: "Spread evenly" }));
    expect(screen.getByLabelText("6100 Travel, June 2026")).toHaveValue("10000000.00");
    await user.click(screen.getByRole("button", { name: "Save line" }));
    expect(api.saveRow).toHaveBeenCalledWith("b-rev1", {
      accountId: "a-6100",
      projectId: null,
      costCentreId: "cc-ops",
      months: Object.fromEntries(months.map((m) => [m, 10 * M])),
    });
  });

  it("sends a draft for approval after confirming, and links the approval", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(detail()).mockResolvedValue(detail({ status: "pending_approval", approvalId: "ap-9" }));
    api.submit.mockResolvedValue(summary({ id: "b-rev1", status: "pending_approval", approvalId: "ap-9" }));
    render(<BudgetDetail id="b-rev1" />);
    await user.click(await screen.findByRole("button", { name: "Send for approval" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Send for approval" }));
    expect(api.submit).toHaveBeenCalledWith("b-rev1");
    expect(await screen.findByRole("link", { name: "Open the approval" })).toHaveAttribute("href", "/suite/approvals/ap-9");
    expect(screen.queryByRole("button", { name: "Send for approval" })).not.toBeInTheDocument();
  });
});

describe("budget meta", () => {
  it("picks the version that counts and the one being prepared", () => {
    const vs = [summary(), summary({ id: "d", versionNo: 1, status: "draft" })];
    expect(headlineVersion(vs)?.id).toBe("b-orig");
    expect(headlineVersion([summary({ status: "rejected" }), summary({ id: "n", versionNo: 1, status: "draft" })])?.id).toBe("n");
    expect(inPreparation(vs)?.id).toBe("d");
    expect(signedPct(-3)).toBe("−3%");
    expect(signedPct(null)).toBe("—");
  });
});
