import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyReport from "./CompanyReport";
import { presetOf, presetRange } from "./PeriodPicker";
import type { CompanyReport as Report } from "@/lib/api/finance-company-report-client";

/** The company report: every section renders, the request register filters and marks uncounted rows, the period goes in the address. */

const get = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: new URLSearchParams() }));
const auth = vi.hoisted(() => ({ user: { id: "u1", organisationId: "o1", role: "admin", permissions: [] as string[] } as unknown }));

vi.mock("@/lib/api/finance-company-report-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-company-report-client")>();
  return { ...actual, companyReport: { ...actual.companyReport, get } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/reports/company",
  useSearchParams: () => search.value,
}));

const sec = (rows: [string, string, number][]) => ({ rows: rows.map(([code, name, amount]) => ({ code, name, group: null, amount })), total: rows.reduce((s, r) => s + r[2], 0) });
const flow = { rows: [{ label: "Receipts from clients", amount: 500_000_00 }], inflows: 500_000_00, outflows: 0, total: 500_000_00 };
const empty = { rows: [], inflows: 0, outflows: 0, total: 0 };

const report = (): Report => ({
  organisation: "Rightclick Ltd",
  from: "2026-01-01",
  to: "2026-10-09",
  periodLabel: "Financial year to date",
  currency: "NGN",
  headline: {
    income: 900_000_00, costs: 600_000_00, netSurplus: 300_000_00, marginBp: 3333, openingCash: 100_000_00, closingCash: 600_000_00, netCashFlow: 500_000_00,
    receivable: 200_000_00, overdue: 50_000_00, payable: 80_000_00, advancesOut: 20_000_00, committed: 40_000_00, totalAssets: 1_000_000_00,
    totalLiabilities: 300_000_00, totalEquity: 700_000_00, paidOut: 500_000_00, requests: 3, requesters: 2, projects: 1, projectsRed: 1,
  },
  income: {
    revenue: sec([["4100", "Consulting fees", 900_000_00]]), costOfRevenue: sec([]), grossSurplus: 900_000_00, expenses: sec([["6100", "Salaries", 600_000_00]]),
    operatingSurplus: 300_000_00, otherIncome: sec([]), otherExpenses: sec([]), netSurplus: 300_000_00,
    monthly: [
      { month: "2026-01", label: "Jan", income: 400_000_00, directCosts: 0, expenses: 300_000_00, surplus: 100_000_00 },
      { month: "2026-02", label: "Feb", income: 500_000_00, directCosts: 0, expenses: 300_000_00, surplus: 200_000_00 },
    ],
  },
  position: {
    asAt: "2026-10-09", currentAssets: sec([["1110", "Main account", 600_000_00]]), nonCurrentAssets: sec([["1500", "Equipment", 400_000_00]]), totalAssets: 1_000_000_00,
    currentLiabilities: sec([["2100", "Payables", 300_000_00]]), nonCurrentLiabilities: sec([]), totalLiabilities: 300_000_00, equity: sec([["3100", "Reserves", 400_000_00]]),
    unclosedSurplus: 300_000_00, totalEquity: 700_000_00, balanced: true,
  },
  cashFlow: { openingCash: 100_000_00, operating: flow, investing: empty, financing: empty, netChange: 500_000_00, closingCash: 600_000_00 },
  banks: [{ code: "1110", name: "Main account", currency: "NGN", balance: 600_000_00, currencyBalance: null }],
  budget: null,
  portfolio: {
    totals: { contractValue: 2_000_000_00, bac: 1_000_000_00, released: 500_000_00, committed: 40_000_00, spent: 1_200_000_00, available: -200_000_00, invoiced: 900_000_00, collected: 700_000_00, projectedProfit: 600_000_00, red: 1, amber: 0, stale: 0 },
    projects: [
      {
        id: "p1", name: "Payroll rollout", code: "PRJ-01", client: "Acme", contractValue: 2_000_000_00, bac: 1_000_000_00, hasBudget: true, released: 500_000_00, committed: 40_000_00,
        spent: 1_200_000_00, available: -200_000_00, invoiced: 900_000_00, collected: 700_000_00, projectedProfit: 600_000_00, status: "red",
        reasons: [{ dimension: "Cost", status: "red", reason: "Spend is 120% of budget" }], categories: [{ category: "travel", label: "Travel", budget: 100_000_00, budgetToDate: 80_000_00, spent: 120_000_00 }],
        cpi: 0.83, spi: 1.02, pctBp: 6000,
      },
    ],
  },
  spend: {
    byCategory: [{ label: "Travel", count: 2, amount: 120_000_00, wht: 0 }], byCostCentre: [], byProject: [], byAccount: [],
    byPayee: [{ label: "Air Peace", count: 1, amount: 120_000_00, wht: 0, net: 120_000_00 }], byPreparer: [{ label: "Ada Obi", count: 2, amount: 120_000_00 }],
    vouchers: [{ pvNo: "PV-001", date: "2026-03-02", payee: "Air Peace", narration: "Flights", gross: 120_000_00, vat: 0, wht: 0, net: 120_000_00, status: "paid", preparedBy: "Ada Obi" }],
  },
  registers: { requisitions: { label: "Requisitions", count: 3, live: 1, estimated: 150_000_00, approved: 120_000_00, actual: 100_000_00 } },
  requests: [
    { register: "requisitions", registerLabel: "Requisitions", id: "r1", reference: "REQ-001", title: "Laptops for QA", raisedOn: "2026-02-01", status: "approved", statusLabel: "Approved", requesterId: "u2", requester: "Musa Bello", department: "Engineering", projectId: "p1", project: "Payroll rollout", costCentre: null, category: "Equipment", currency: "NGN", estimated: 100_000_00, approved: 100_000_00, actual: 90_000_00, live: false, partOf: null, inTotals: true, note: null },
    { register: "requisitions", registerLabel: "Requisitions", id: "r2", reference: "REQ-002", title: "Laptop bags", raisedOn: "2026-02-02", status: "approved", statusLabel: "Approved", requesterId: "u2", requester: "Musa Bello", department: "Engineering", projectId: null, project: null, costCentre: null, category: null, currency: "NGN", estimated: 5_000_00, approved: 5_000_00, actual: null, live: false, partOf: "REQ-001", inTotals: false, note: null },
    { register: "requisitions", registerLabel: "Requisitions", id: "r3", reference: "REQ-003", title: "Office chairs", raisedOn: "2026-03-01", status: "pending", statusLabel: "Pending", requesterId: "u3", requester: "Ada Obi", department: "Operations", projectId: null, project: null, costCentre: "Admin", category: null, currency: "NGN", estimated: 50_000_00, approved: null, actual: null, live: true, partOf: null, inTotals: true, note: null },
  ],
  requesters: [
    { name: "Musa Bello", department: "Engineering", requests: 2, live: 0, byRegister: { Requisitions: 2 }, estimated: 100_000_00, approved: 100_000_00, actual: 90_000_00 },
    { name: "Ada Obi", department: "Operations", requests: 1, live: 1, byRegister: { Requisitions: 1 }, estimated: 50_000_00, approved: 0, actual: 0 },
  ],
  departments: [{ name: "Engineering", requests: 2, live: 0, byRegister: { Requisitions: 2 }, estimated: 100_000_00, approved: 100_000_00, actual: 90_000_00 }],
  receivables: { asOf: "2026-10-09", totals: { current: 150_000_00, d30: 0, d60: 0, d90: 0, over90: 50_000_00, retention: 0, total: 200_000_00 }, clients: [{ client: "Acme", current: 150_000_00, d30: 0, d60: 0, d90: 0, over90: 50_000_00, retention: 0, total: 200_000_00, invoices: [] }] },
  payables: [], advances: [], commitments: [],
  tax: { vat: 0, whtWithheld: 0, remitted: 0, byCode: [] },
  assets: { count: 0, cost: 0, accumulated: 0, nbv: 0, byClass: [] },
  labour: { allocated: 0, bench: 0, hours: 0, byProject: [] },
  approvals: { byProcess: [], byApprover: [] },
});

beforeEach(() => {
  get.mockReset();
  replace.mockReset();
  search.value = new URLSearchParams();
  get.mockResolvedValue(report());
});

describe("Company report", () => {
  it("renders all twelve sections with the sentence on the cover", async () => {
    render(<CompanyReport />);
    expect(await screen.findByRole("heading", { level: 1, name: "Rightclick Ltd" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Report sections" });
    expect(within(nav).getAllByRole("link")).toHaveLength(12);
    for (const name of ["Headline", "Income statement", "Financial position", "Budget vs actual", "Approvals"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText("No approved budget covers this period")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Print \/ PDF/ })).toHaveAttribute("href", "/api/finance/reports/company/pdf");
    expect(screen.getByRole("link", { name: /Download Excel/ })).toHaveAttribute("href", "/api/finance/reports/company/xlsx");
  });

  it("marks a request that is part of another as not counted, and leaves it out of the totals", async () => {
    render(<CompanyReport />);
    const table = await screen.findByRole("table", { name: "Every request raised in the period" });
    expect(within(table).getByText("Part of REQ-001")).toBeInTheDocument();
    expect(within(table).getAllByText("Not counted in totals")).toHaveLength(1);
    // Estimated: 100,000 + 50,000 counted; the 5,000 bag request is not.
    const foot = table.querySelector("tfoot")!;
    expect(within(foot as HTMLElement).getByText("150,000.00")).toBeInTheDocument();
  });

  it("filters the request register by department", async () => {
    const user = userEvent.setup();
    render(<CompanyReport />);
    const table = await screen.findByRole("table", { name: "Every request raised in the period" });
    await user.selectOptions(screen.getByLabelText("Department"), "Operations");
    expect(within(table).queryByText("Laptops for QA")).not.toBeInTheDocument();
    expect(within(table).getByText("Office chairs")).toBeInTheDocument();
  });

  it("opens a project row to show its categories and reasons", async () => {
    const user = userEvent.setup();
    render(<CompanyReport />);
    await user.click(await screen.findByRole("button", { name: /Payroll rollout/ }));
    expect(screen.getByText("Spend is 120% of budget")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Payroll rollout: budget and spend by category" })).toBeInTheDocument();
  });

  it("writes a preset period into the address", async () => {
    const user = userEvent.setup();
    render(<CompanyReport />);
    await screen.findByRole("heading", { level: 1, name: "Rightclick Ltd" });
    await user.click(screen.getByRole("radio", { name: "Last month" }));
    const r = presetRange("lastMonth")!;
    expect(replace).toHaveBeenCalledWith(`/suite/finance/reports/company?from=${r.from}&to=${r.to}`, { scroll: false });
  });

  it("tells somebody without Finance reports that the report is not theirs", () => {
    auth.user = { id: "u9", organisationId: "o1", role: "user", permissions: [] };
    render(<CompanyReport />);
    expect(screen.getByText("This report is for Finance report holders")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    auth.user = { id: "u1", organisationId: "o1", role: "admin", permissions: [] };
  });
});

describe("Period presets", () => {
  const today = new Date(2026, 9, 9); // 9 Oct 2026
  it("works the ranges out from today", () => {
    expect(presetRange("month", today)).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(presetRange("lastMonth", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("quarter", today)).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(presetRange("ytd", today)).toEqual({ from: "2026-01-01", to: "2026-10-09" });
    expect(presetRange("last12", today)).toEqual({ from: "2025-10-10", to: "2026-10-09" });
  });
  it("recognises a preset in the address, and anything else as custom", () => {
    expect(presetOf(undefined, undefined, today)).toBe("fy");
    expect(presetOf("2026-09-01", "2026-09-30", today)).toBe("lastMonth");
    expect(presetOf("2026-02-03", "2026-05-01", today)).toBe("custom");
  });
});
