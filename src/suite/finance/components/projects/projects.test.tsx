import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectFunds, ProjectFundsDetail as Detail, ProjectKpis } from "@/lib/api/finance-payments-client";
import PortfolioBoard, { sortProjects } from "./PortfolioBoard";
import ProjectFundsDetail from "./ProjectFundsDetail";
import { fundsSegments } from "./FundsBar";
import { byRisk, headline, monthRange } from "./meta";
import { indexBand, marginBp, reportsProgress, sCurve, trend } from "./earned-value";

/** The MD's portfolio and one project's money, on the seeded Meridian Polytechnic figures. */

const api = vi.hoisted(() => ({
  portfolio: vi.fn(),
  project: vi.fn(),
  draftBudget: vi.fn(),
  submitBudget: vi.fn(),
  requestRelease: vi.fn(),
  revokeRelease: vi.fn(),
  kpis: vi.fn(),
  reportProgress: vi.fn(),
  labour: vi.fn(),
  acknowledgeAlert: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: "u-md", role: "admin", name: "MD", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return { ...actual, spend: { ...actual.spend, funds: api } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/projects",
  useSearchParams: () => new URLSearchParams(),
}));

const M = 1_000_000_00; // ₦1m in kobo

/** Earned value as `ProjectKpis` sends it: the Student Portal, PM-reported at 62%, no contract. */
const kpis = (over: Partial<ProjectKpis> = {}): ProjectKpis => ({
  asOf: "2026-10-06",
  contractValue: 0,
  bac: 420 * M,
  pv: 302.1 * M,
  ev: 260.4 * M,
  ac: 197.6 * M,
  acNonLabour: 193 * M,
  acLabour: 4.6 * M,
  acLabourProvisional: 1.8 * M,
  pctBp: 6200,
  progress: { pctBp: 6200, method: "pm_reported", asOf: "2026-10-01", stale: false, detail: "Reported 1 Oct by Efe Omoregie." },
  cpi: 1.318,
  spi: 0.862,
  eac: 318.7 * M,
  eacMethod: "cpi",
  projectedProfit: null,
  projectedMarginBp: null,
  targetMarginBp: null,
  progressProfit: null,
  recognisedProfit: -4.6 * M,
  invoiced: 0,
  revenueRecognised: 193 * M,
  collected: 0,
  receivable: 0,
  overdue: 0,
  maxDaysOverdue: 0,
  cashPosition: -195.8 * M,
  released: 250 * M,
  committed: 3.2 * M,
  available: 53.8 * M,
  hasContract: false,
  ...over,
});

const portal: ProjectFunds = {
  id: "p-1",
  name: "Student Portal Rebuild",
  code: "SPR",
  client: "Meridian Polytechnic",
  projectStatus: "active",
  contractValue: 480 * M,
  bac: 420 * M,
  budgetToDate: 230 * M,
  released: 250 * M,
  committed: 20 * M,
  spent: 193 * M,
  available: 37 * M,
  spentThisMonth: 12 * M,
  unplanned: 0.4 * M,
  categories: [
    { category: "hardware", label: "Hardware", budget: 120 * M, budgetToDate: 80 * M, spent: 70 * M },
    { category: "licences", label: "Licences and tokens", budget: 60 * M, budgetToDate: 30 * M, spent: 28 * M },
  ],
  status: "amber",
  reasons: [
    { dimension: "funds", status: "green", reason: "₦37.0M available of ₦250.0M released." },
    { dimension: "budget", status: "green", reason: "Every category within its budget to date." },
    { dimension: "discipline", status: "amber", reason: "₦0.4M of spend has no approved request behind it." },
  ],
  hasBudget: true,
  pctBp: 6200,
  cpi: 1.318,
  spi: 0.862,
  ev: 260.4 * M,
  pv: 302.1 * M,
  eac: 318.7 * M,
  progressProfit: null,
  projectedProfit: null,
  projectedMarginBp: null,
  invoiced: 0,
  collected: 0,
  receivable: 0,
  overdue: 0,
  labourProvisional: 1.8 * M,
  kpis: kpis(),
};

const scholarship: ProjectFunds = {
  ...portal,
  id: "p-2",
  name: "Scholarship Board Portal",
  code: "SBP",
  contractValue: 95 * M,
  bac: 80 * M,
  released: 15 * M,
  committed: 0,
  spent: 2 * M,
  available: 13 * M,
  spentThisMonth: 2 * M,
  unplanned: 0,
  status: "green",
  reasons: [{ dimension: "funds", status: "green", reason: "₦13.0M available of ₦15.0M released." }],
  pctBp: 1315,
  cpi: 29.455,
  spi: 0.22,
  progressProfit: 12.2 * M,
  projectedProfit: 40.9 * M,
  projectedMarginBp: 4302,
  invoiced: 12.5 * M,
  collected: 12.5 * M,
};

const kiosk: ProjectFunds = {
  ...portal,
  id: "p-3",
  name: "Library Self-Service Kiosk",
  code: "LSK",
  status: "stale",
  reasons: [{ dimension: "progress", status: "stale", reason: "Stale data: progress is more than 14 days old, so earned value can't be trusted. Ask the project manager for an update." }],
  pctBp: 4000,
  cpi: null,
  spi: 0.9,
  overdue: 3 * M,
};

const detail = (over: Partial<Detail> = {}): Detail => ({
  ...portal,
  budget: {
    id: "b-1",
    version: 1,
    bac: 420 * M,
    contractValue: 480 * M,
    targetMarginBp: 1250,
    approvedAt: "2026-07-01T09:00:00Z",
    rebaselineReason: null,
    lines: [
      { category: "hardware", month: "2026-08", amount: 60 * M },
      { category: "hardware", month: "2026-09", amount: 60 * M },
    ],
  },
  drafts: [],
  curve: [
    { month: "2026-08", planned: 100 * M, actual: 90 * M, cumulativePlanned: 100 * M, cumulativeActual: 90 * M },
    { month: "2026-09", planned: 130 * M, actual: 103 * M, cumulativePlanned: 230 * M, cumulativeActual: 193 * M },
  ],
  releases: [
    { id: "r-1", tranche: 1, amount: 250 * M, revoked: 0, scope: "non_labour", status: "approved", requestedBy: "Bursar", approvedAt: "2026-07-02T09:00:00Z", conditions: null, approvalId: null },
  ],
  commitments: [{ id: "c-1", source: "memo", sourceId: "memo-7", reference: "PM/2026/10/0007", title: "Cloud hosting", amount: 20 * M, consumed: 0, outstanding: 20 * M, category: "licences", expiresAt: "2026-12-31" }],
  transactions: [{ journalId: "j-9", journalNo: "JV/2026/09/0042", date: "2026-09-20", source: "payment_voucher", sourceId: "pv-1", account: "6420 IT services", narration: "Swiftlink: fibre", amount: 15 * M }],
  categories_catalogue: { labour: "Labour", hardware: "Hardware", licences: "Licences and tokens", travel: "Travel" },
  history: [
    { asOf: "2026-08-10", status: "red", pv: 223.5 * M, ev: 50.4 * M, ac: 162 * M, pctBp: 1200, progressProfit: null, recognisedProfit: 0, projectedProfit: null, cashPosition: -162 * M, collected: 0, invoiced: 0 },
    { asOf: "2026-07-27", status: "red", pv: 204.6 * M, ev: 0, ac: 162 * M, pctBp: 0, progressProfit: null, recognisedProfit: 0, projectedProfit: null, cashPosition: -162 * M, collected: 0, invoiced: 0 },
  ],
  contract: null,
  invoices: [],
  alerts: [
    { id: "al-1", dimension: "schedule", severity: "amber", message: "Slightly behind: ₦260.4M done against ₦302.1M planned (SPI 0.86).", raisedAt: "2026-10-06T03:31:59+00:00", acknowledgedBy: null, acknowledgedAt: null },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.labour.mockResolvedValue({ allocated: 275 * M, provisional: 1.8 * M, months: [{ month: "2026-08", allocated: 275 * M, provisional: 0, hours: 404 }, { month: "2026-09", allocated: 0, provisional: 1.8 * M, hours: 272.5 }], people: null, seesPeople: false });
});

describe("funds pipe", () => {
  it("splits the budget into spent, committed, available and not yet released", () => {
    const s = fundsSegments({ bac: 400, released: 200, committed: 50, spent: 100, available: 50 });
    expect(s).toMatchObject({ spent: 25, committed: 12.5, available: 12.5, over: 0, unreleased: 50, releasedAt: 50 });
  });

  it("runs overdrawn spend past the release", () => {
    const s = fundsSegments({ bac: 100, released: 50, committed: 10, spent: 60, available: -20 });
    expect(s.spent + s.committed).toBe(50);
    expect(s.over).toBe(20);
    expect(s.unreleased).toBe(30);
  });

  it("names the worst reason and walks the months", () => {
    expect(headline(portal)).toBe("₦0.4M of spend has no approved request behind it.");
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});

describe("PortfolioBoard", () => {
  it("leads with what is available, flags amber with its reason, and filters by status", async () => {
    const user = userEvent.setup();
    api.portfolio.mockResolvedValue({
      totals: {
        contractValue: 575 * M,
        bac: 500 * M,
        released: 265 * M,
        committed: 20 * M,
        spent: 195 * M,
        available: 50 * M,
        spentThisMonth: 14 * M,
        unplanned: 0.4 * M,
        invoiced: 12.5 * M,
        collected: 12.5 * M,
        receivable: 0,
        overdue: 0,
        projectedProfit: 40.9 * M,
        profitContractValue: 95 * M,
        red: 0,
        amber: 1,
        stale: 0,
      },
      projects: [scholarship, portal],
    });
    render(<PortfolioBoard />);
    expect((await screen.findAllByText("₦50M"))[0]).toBeInTheDocument();
    const attention = screen.getByText("Needs attention").closest("section")!;
    expect(within(attention).getByText("Student Portal Rebuild")).toBeInTheDocument();
    expect(within(attention).getByText("₦0.4M of spend has no approved request behind it.")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Budget ₦420M; released ₦250M; spent ₦193M/ }).length).toBeGreaterThan(0);

    const table = screen.getByRole("table", { name: /Every project/ });
    // Worst first.
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Student Portal Rebuild");
    expect(rows[1]).toHaveTextContent("Amber");

    await user.click(screen.getByRole("radio", { name: "Green 1" }));
    expect(within(table).queryByText("Student Portal Rebuild")).not.toBeInTheDocument();
    expect(within(table).getByText("Scholarship Board Portal")).toBeInTheDocument();
  });
});

describe("ProjectFundsDetail", () => {
  it("shows the waterfall, the S-curve, each dimension's reason, and links commitments and journals", async () => {
    api.project.mockResolvedValue(detail());
    render(<ProjectFundsDetail id="p-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Student Portal Rebuild" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Funds waterfall for Student Portal Rebuild" })).toBeInTheDocument();
    expect(screen.getByText("Cumulative planned and actual spend for Student Portal Rebuild")).toBeInTheDocument();
    expect(screen.getByText("Spend discipline · Amber")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PM/2026/10/0007" })).toHaveAttribute("href", "/suite/finance/memos/memo-7");
    expect(screen.getByRole("link", { name: "JV/2026/09/0042" })).toHaveAttribute("href", "/suite/finance/journals/j-9");
  });

  it("requests a fund release with an amount and scope", async () => {
    const user = userEvent.setup();
    api.project.mockResolvedValue(detail());
    api.requestRelease.mockResolvedValue({ id: "r-2", tranche: 2, status: "requested" });
    render(<ProjectFundsDetail id="p-1" />);
    await user.click(await screen.findByRole("button", { name: "Request a release" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Request release" }));
    expect(within(dialog).getByText(/Enter the amount to release/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Amount (₦)"), "50,000,000");
    await user.click(within(dialog).getByRole("radio", { name: "All, labour included" }));
    await user.click(within(dialog).getByRole("button", { name: "Request release" }));
    expect(api.requestRelease).toHaveBeenCalledWith("p-1", { amount: 50 * M, scope: "all", conditions: null });
    expect((await screen.findAllByText("Release 2 of ₦50,000,000.00 sent to the MD for approval.")).length).toBeGreaterThan(0);
  });

  it("rebaselines the budget by category and month, and needs a reason", async () => {
    const user = userEvent.setup();
    api.project.mockResolvedValue(detail());
    api.draftBudget.mockResolvedValue({ id: "b-2", version: 2, status: "draft", bac: 0 });
    api.submitBudget.mockResolvedValue({ id: "b-2", status: "pending_approval" });
    render(<ProjectFundsDetail id="p-1" />);
    await user.click(await screen.findByRole("button", { name: "Rebaseline budget" }));
    const cell = screen.getByLabelText("Hardware, September 2026");
    expect(cell).toHaveValue("60,000,000.00");
    await user.clear(cell);
    await user.type(cell, "75,000,000");
    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(screen.getByText("Say why the project is being rebaselined.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Why the project is being rebaselined/), "Client added the mobile app");
    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(api.draftBudget).toHaveBeenCalledWith("p-1", {
      contractValue: 480 * M,
      currency: "NGN",
      targetMarginBp: 1250,
      reason: "Client added the mobile app",
      lines: [
        { category: "hardware", month: "2026-08-01", amount: 60 * M },
        { category: "hardware", month: "2026-09-01", amount: 75 * M },
      ],
    });
    expect(api.submitBudget).toHaveBeenCalledWith("b-2");
    expect((await screen.findAllByText("Budget v2 sent for approval.")).length).toBeGreaterThan(0);
  });
});

describe("earned value", () => {
  it("colours CPI and SPI by the PRD thresholds", () => {
    expect(indexBand(1.32)).toBe("green");
    expect(indexBand(0.95)).toBe("green");
    expect(indexBand(0.949)).toBe("amber");
    expect(indexBand(0.85)).toBe("amber");
    expect(indexBand(0.849)).toBe("red");
    expect(indexBand(null)).toBeNull();
  });

  it("maps the weekly snapshots to the S-curve, oldest first, with today's live figures last", () => {
    const d = detail();
    const c = sCurve(d.history, d.kpis);
    expect(c.labels).toEqual(["27 Jul", "10 Aug", "6 Oct"]);
    expect(c.pv).toEqual([204.6 * M, 223.5 * M, 302.1 * M]);
    expect(c.ev).toEqual([0, 50.4 * M, 260.4 * M]);
    expect(c.ac).toEqual([162 * M, 162 * M, 197.6 * M]);
    expect(c.todayIndex).toBe(2);
    // A snapshot taken today gives way to the live figures.
    const again = sCurve([...d.history, { ...d.history[0], asOf: "2026-10-06", pv: 1 }], d.kpis);
    expect(again.pv).toEqual([204.6 * M, 223.5 * M, 302.1 * M]);
  });

  it("trends a profit view and drops the weeks it was unknown", () => {
    const d = detail();
    expect(trend(d.history, d.kpis, "cashPosition")).toEqual([-162 * M, -162 * M, -195.8 * M]);
    expect(trend(d.history, d.kpis, "progressProfit")).toEqual([]);
  });

  it("works out margins, who may report progress, and puts stale between amber and green", () => {
    expect(marginBp(40.9 * M, 95 * M)).toBe(4305);
    expect(marginBp(5, 0)).toBeNull();
    expect(reportsProgress(kpis())).toBe(true);
    expect(reportsProgress(kpis({ hasContract: true, progress: { pctBp: 1315, method: "milestone_weighted", asOf: null, stale: false, detail: "" } }))).toBe(false);
    expect([scholarship, kiosk, portal].sort(byRisk).map((p) => p.status)).toEqual(["amber", "stale", "green"]);
  });

  it("sorts by an index with the projects that have none last, either way", () => {
    expect(sortProjects([kiosk, portal, scholarship], "cpi", "desc").map((p) => p.code)).toEqual(["SBP", "SPR", "LSK"]);
    expect(sortProjects([kiosk, portal, scholarship], "cpi", "asc").map((p) => p.code)).toEqual(["SPR", "SBP", "LSK"]);
  });
});

describe("PortfolioBoard, earned value", () => {
  it("adds collections and projected profit, shows % complete, CPI and SPI, and flags stale data", async () => {
    const user = userEvent.setup();
    api.portfolio.mockResolvedValue({
      totals: {
        contractValue: 575 * M,
        bac: 500 * M,
        released: 265 * M,
        committed: 20 * M,
        spent: 195 * M,
        available: 50 * M,
        spentThisMonth: 14 * M,
        unplanned: 0,
        invoiced: 12.5 * M,
        collected: 10 * M,
        receivable: 2.5 * M,
        overdue: 3 * M,
        projectedProfit: 40.9 * M,
        profitContractValue: 95 * M,
        red: 0,
        amber: 1,
        stale: 1,
      },
      projects: [scholarship, portal, kiosk],
    });
    render(<PortfolioBoard />);
    expect(await screen.findByText("Collected to date")).toBeInTheDocument();
    expect(screen.getByText("80% of ₦12.5M invoiced")).toBeInTheDocument();
    expect(screen.getByText("₦3M overdue")).toBeInTheDocument();
    expect(screen.getByText(/^43\.\d% margin on ₦95M of contracts$/)).toBeInTheDocument();

    const table = screen.getByRole("table", { name: /earned value/ });
    const row = within(table).getByText("Student Portal Rebuild").closest("tr")!;
    expect(within(row).getByRole("img", { name: "62% complete" })).toBeInTheDocument();
    expect(within(row).getByText("1.32").closest("[data-band]")).toHaveAttribute("data-band", "green");
    expect(within(row).getByText("0.86").closest("[data-band]")).toHaveAttribute("data-band", "amber");
    const kioskRow = within(table).getByText("Library Self-Service Kiosk").closest("tr")!;
    expect(within(kioskRow).getByText("Stale data")).toBeInTheDocument();
    expect(within(kioskRow).getByText("CPI not known yet")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Stale 1" }));
    expect(within(table).queryByText("Student Portal Rebuild")).not.toBeInTheDocument();
    expect(within(table).getByText("Library Self-Service Kiosk")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Funds" }));
    expect(screen.getByRole("table", { name: /funds and status/ })).toBeInTheDocument();
  });
});

describe("ProjectFundsDetail, earned value", () => {
  it("leads with the S-curve, says how EAC was projected, and acknowledges an alert", async () => {
    const user = userEvent.setup();
    api.project.mockResolvedValue(detail());
    api.acknowledgeAlert.mockResolvedValue({ id: "al-1", acknowledgedAt: "2026-10-06T09:00:00Z" });
    render(<ProjectFundsDetail id="p-1" />);
    expect(await screen.findByRole("group", { name: /S-curve for Student Portal Rebuild/ })).toBeInTheDocument();
    expect(screen.getByText("Projected from cost efficiency so far")).toBeInTheDocument();
    expect(screen.getByText("Progress profit")).toBeInTheDocument();
    expect(screen.getByText("Cash position")).toBeInTheDocument();
    expect(await screen.findByText(/Includes ₦1,800,000.00 of provisional labour/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(api.acknowledgeAlert).toHaveBeenCalledWith("al-1");
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
  });

  it("offers to set up the contract when there is none, and lets the PM report progress", async () => {
    const user = userEvent.setup();
    api.project.mockResolvedValue(detail());
    api.reportProgress.mockResolvedValue({ id: "s-1", pctBp: 6550, asOf: "2026-10-06" });
    render(<ProjectFundsDetail id="p-1" />);
    expect(await screen.findByRole("link", { name: "Set up the contract" })).toHaveAttribute("href", "/suite/finance/revenue/contracts/p-1");
    expect(screen.getByText("Reported 1 Oct by Efe Omoregie.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Report progress" }));
    expect(screen.getByText("Enter how complete the project is, from 0 to 100.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Percent complete"), "65.5");
    await user.click(screen.getByRole("button", { name: "Report progress" }));
    expect(api.reportProgress).toHaveBeenCalledWith("p-1", { pct: 65.5, asOf: null });
    expect((await screen.findAllByText("Progress reported: 66% complete as of 6 Oct 2026.")).length).toBeGreaterThan(0);
  });

  it("walks contract value to invoiced to collected, links invoices, and greys out stale progress", async () => {
    api.project.mockResolvedValue(
      detail({
        status: "stale",
        kpis: kpis({ hasContract: true, contractValue: 95 * M, invoiced: 12.5 * M, collected: 0, receivable: 12.5 * M, overdue: 12.5 * M, progress: { pctBp: 6200, method: "pm_reported", asOf: "2026-09-01", stale: true, detail: "Reported 1 Sep by Efe Omoregie." } }),
        contract: { id: "c-1", title: "Scholarship portal", reference: "ESSB/ICT/2026/014", client: "Eastgate State Scholarship Board", clientId: "cl-1", value: 95 * M, currency: "NGN", billingType: "milestone", progressMethod: "pm_reported", startsOn: "2026-08-20", endsOn: "2027-01-04" },
        invoices: [{ id: "inv-1", invoiceNo: "INV/2026/0001", date: "2026-08-24", dueOn: "2026-09-07", subtotal: 12.5 * M, total: 12.5 * M, settled: 0, outstanding: 12.5 * M, status: "sent", currency: "NGN", daysLate: 29 }],
        alerts: [],
      }),
    );
    render(<ProjectFundsDetail id="p-1" />);
    expect(await screen.findByRole("link", { name: "INV/2026/0001" })).toHaveAttribute("href", "/suite/finance/revenue/invoices/inv-1");
    expect(screen.getByRole("link", { name: "Contract" })).toHaveAttribute("href", "/suite/finance/revenue/contracts/p-1");
    expect(screen.getByText("29 days late")).toBeInTheDocument();
    expect(screen.getByText(/1 invoice is overdue, the oldest by 29 days/)).toBeInTheDocument();
    expect(screen.getByText(/earned value can't be trusted until progress is reported again/)).toBeInTheDocument();
  });
});
