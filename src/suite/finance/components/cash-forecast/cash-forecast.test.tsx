import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CashForecast, ForecastWeek } from "@/lib/api/finance-budgets-client";
import CashForecastBoard from "./CashForecastBoard";
import { ComplianceFlag } from "../projects/ComplianceFlag";
import { dayShort, weekRange } from "./meta";

/** The 13-week cash forecast, and the MD's compliance flag. */

const api = vi.hoisted(() => ({ get: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn(), updateSettings: vi.fn() }));
const ops = vi.hoisted(() => ({ compliance: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] as string[] } }));

vi.mock("@/lib/api/finance-budgets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-budgets-client")>();
  return { ...actual, cashForecast: api, operationsCompliance: ops.compliance };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/cash-forecast",
  useSearchParams: () => new URLSearchParams(),
}));

const M = 1_000_000_00;

function forecast(): CashForecast {
  const weeks: ForecastWeek[] = [];
  let open = 40 * M;
  for (let i = 0; i < 13; i++) {
    const from = new Date(Date.UTC(2026, 9, 5 + i * 7));
    const to = new Date(Date.UTC(2026, 9, 11 + i * 7));
    const inflows = i === 0 ? 12 * M : 4 * M;
    const outflows = i === 3 ? 35 * M : 4 * M;
    const closing = open + inflows - outflows;
    weeks.push({
      week: i + 1,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      opening: open,
      inflows,
      outflows,
      closing,
      byKind: {},
      low: closing < 20 * M,
      negative: closing < 0,
    });
    open = closing;
  }
  const lowest = [...weeks].sort((a, b) => a.closing - b.closing)[0];
  return {
    asOf: "2026-10-06",
    opening: 40 * M,
    threshold: 20 * M,
    weeks,
    items: [
      { kind: "receipts", direction: "in", amount: 12 * M, on: "2026-10-06", week: 0, label: "Invoice INV-0042 (overdue, 50% expected)", reference: "INV-0042", link: "/suite/finance/revenue/invoices/inv-42", late: true },
      { kind: "vouchers", direction: "out", amount: 4 * M, on: "2026-10-06", week: 0, label: "PV/2026/10/0003 Brightline Supplies", reference: "PV/2026/10/0003", link: "/suite/finance/vouchers/pv-3", late: false },
      { kind: "payroll", direction: "out", amount: 26 * M, on: "2026-10-31", week: 3, label: "Payroll, October 2026 (as last month)", reference: null, link: null, late: false },
    ],
    accounts: [
      { code: "1010", name: "GTBank current", balance: 30 * M },
      { code: "1020", name: "Zenith USD", balance: 10 * M },
    ],
    settings: { overdueCollectionPct: 50, pipelinePct: 80 },
    lowest,
    recurring: [{ id: "r-rent", name: "Office rent", direction: "out", amount: 2.5 * M, frequency: "quarterly", nextOn: "2026-11-01", active: true }],
  };
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  ops.compliance.mockReset();
  csv.mockReset();
  auth.user = { id: "u-1", role: "admin", name: "Adaeze", organisationId: "o", permissions: [] };
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("CashForecastBoard", () => {
  it("leads with the lowest point and flags the weeks below the threshold", async () => {
    api.get.mockResolvedValue(forecast());
    render(<CashForecastBoard />);
    expect(await screen.findByText("Lowest point in the next thirteen weeks")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /week 4, 26 Oct to 1 Nov/ })).toBeInTheDocument();
    expect(screen.getByText(/below threshold$/)).toBeInTheDocument();
    // The chart says it in words on each week, not colour alone.
    expect(screen.getByRole("button", { name: /^Week 4, 26 Oct to 1 Nov: .* below threshold$/ })).toBeInTheDocument();
    expect(screen.getByText("GTBank current")).toBeInTheDocument();
  });

  it("downloads the thirteen weeks as CSV, one row a week, amounts in naira", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(forecast());
    render(<CashForecastBoard />);
    await screen.findByText("Lowest point in the next thirteen weeks");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const [name, rows] = csv.mock.calls[0];
    expect(name).toBe("cash-forecast_2026-10-06.csv");
    expect(rows).toHaveLength(14);
    expect(rows[0].slice(0, 8)).toEqual(["Week", "From", "To", "Currency", "Opening", "In", "Out", "Closing"]);
    expect(rows[1].slice(0, 8)).toEqual([1, "2026-10-05", "2026-10-11", "NGN", "40000000.00", "12000000.00", "4000000.00", "48000000.00"]);
    expect(rows[4].at(-1)).toBe("Below threshold");
  });

  it("opens a week to its items, grouped by kind, with late items flagged and linked to their record", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(forecast());
    render(<CashForecastBoard />);
    const table = await screen.findByRole("table", { name: /Opening, in, out and closing cash/ });
    const toggle = within(table).getAllByRole("button")[0];
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const items = document.getElementById("cf-items-0")!;
    expect(within(items).getByText("Client receipts")).toBeInTheDocument();
    expect(within(items).getByText("Payment vouchers")).toBeInTheDocument();
    expect(within(items).getByText("Late, counted now")).toBeInTheDocument();
    expect(within(items).getByRole("link", { name: /INV-0042/ })).toHaveAttribute("href", "/suite/finance/revenue/invoices/inv-42");
  });

  it("removes a recurring item only after confirming", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(forecast());
    api.removeItem.mockResolvedValue({});
    render(<CashForecastBoard />);
    await user.click(await screen.findByRole("button", { name: "Remove Office rent" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(api.removeItem).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remove item" }));
    expect(api.removeItem).toHaveBeenCalledWith("r-rent");
  });

  it("adds a recurring item with the whole shape the API takes", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(forecast());
    api.addItem.mockResolvedValue({ id: "r-new" });
    render(<CashForecastBoard />);
    await user.click(await screen.findByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Software licences");
    await user.type(within(dialog).getByLabelText("Amount each time"), "1,200,000");
    await user.clear(within(dialog).getByLabelText("Next falls on"));
    await user.type(within(dialog).getByLabelText("Next falls on"), "2026-11-15");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    expect(api.addItem).toHaveBeenCalledWith({ name: "Software licences", direction: "out", amount: 1_200_000_00, frequency: "monthly", nextOn: "2026-11-15", active: true });
  });

  it("saves the two collection probabilities", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(forecast());
    api.updateSettings.mockResolvedValue({});
    render(<CashForecastBoard />);
    const box = await screen.findByRole("spinbutton", { name: "Overdue invoices collected, percent" });
    await user.clear(box);
    await user.type(box, "35");
    await user.click(screen.getByRole("button", { name: "Save and recalculate" }));
    expect(api.updateSettings).toHaveBeenCalledWith({ overdueCollectionPct: 35, pipelinePct: 80 });
  });

  it("hides what the person may not change", async () => {
    auth.user = { ...auth.user, role: "user", permissions: ["finance.cash_forecast.view"] };
    api.get.mockResolvedValue(forecast());
    render(<CashForecastBoard />);
    await screen.findByText("Office rent");
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Office rent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save and recalculate" })).not.toBeInTheDocument();
  });
});

describe("ComplianceFlag", () => {
  it("raises expired mandatory certificates and counts what is due", async () => {
    ops.compliance.mockResolvedValue({ dueSoon: 3, overdue: 1, expired: 1, expiring: 0, expiredMandatory: ["Tax clearance certificate", "ITF compliance"] });
    render(<ComplianceFlag />);
    const banner = await screen.findByRole("link", { name: /Expired mandatory certificates: Tax clearance certificate, ITF compliance/ });
    expect(banner).toHaveAttribute("href", "/suite/operations/compliance");
    expect(screen.getByRole("link", { name: /3 due in 30 days/ })).toHaveTextContent("1 overdue");
  });

  it("shows nothing when Operations isn't there", async () => {
    ops.compliance.mockResolvedValue(null);
    const { container } = render(<ComplianceFlag />);
    await vi.waitFor(() => expect(ops.compliance).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe("forecast meta", () => {
  it("writes week ranges plainly", () => {
    expect(weekRange("2026-10-05", "2026-10-11")).toBe("5 to 11 Oct");
    expect(weekRange("2026-09-28", "2026-10-04")).toBe("28 Sep to 4 Oct");
    expect(dayShort("2026-11-01")).toBe("1 Nov");
  });
});
