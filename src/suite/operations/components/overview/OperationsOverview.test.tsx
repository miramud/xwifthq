import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import OperationsOverview from "./OperationsOverview";
import { overview } from "@/suite/operations/components/procurement/fixtures";

/** The overview: tiles that open their desks, ordered by month, upcoming trips, and the empty states. */

const api = vi.hoisted(() => ({ overview: vi.fn(), replace: vi.fn(), user: { id: "u1", role: "admin", name: "Ada", organisationId: "o", permissions: [] as string[] } }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: api.user, loading: false }) }));
vi.mock("@/lib/api/operations-procurement-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-procurement-client")>();
  return { ...actual, procurement: { ...actual.procurement, overview: api.overview } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: api.replace }), usePathname: () => "/suite/operations", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  api.overview.mockReset();
  api.replace.mockReset();
  api.user = { ...api.user, role: "admin", permissions: [] };
});
afterEach(() => vi.useRealTimers());

describe("OperationsOverview", () => {
  it("sends staff without the overview to their own requests, without asking for it", () => {
    api.user = { ...api.user, role: "user", permissions: [] };
    render(<OperationsOverview />);
    expect(api.replace).toHaveBeenCalledWith("/suite/operations/my/requests");
    expect(api.overview).not.toHaveBeenCalled();
    expect(screen.queryByText(/didn.t load/)).not.toBeInTheDocument();
  });

  it("links each tile to its desk and lays out what is coming", async () => {
    api.overview.mockResolvedValue(overview());
    render(<OperationsOverview />);
    expect(await screen.findByRole("link", { name: /^To source/ })).toHaveAttribute("href", "/suite/operations/procurement/requests");
    expect(screen.getByRole("link", { name: /^Overdue deliveries/ })).toHaveAttribute("href", "/suite/operations/procurement/receiving");
    expect(screen.getByRole("link", { name: /^Draft orders/ })).toHaveAttribute("href", "/suite/operations/procurement/orders?tab=draft");
    expect(screen.getByRole("table", { name: "Value of approved orders by month, goods and services" })).toBeInTheDocument();
    expect(screen.getByText("Abuja: Requirements sign-off with the Eastgate board")).toBeInTheDocument();
    expect(screen.getByText(/No follow-ups scheduled/)).toBeInTheDocument();
  });

  it("says when nothing has been ordered, and when Finance is off", async () => {
    const o = overview({ financeOn: false });
    o.procurement.orderedByMonth = [{ month: "2026-09", goods: 0, services: 0 }];
    api.overview.mockResolvedValue(o);
    render(<OperationsOverview />);
    expect(await screen.findByText("Nothing ordered in these months yet")).toBeInTheDocument();
    expect(screen.getByText(/Finance isn.t switched on/)).toBeInTheDocument();
  });

  it("adds compliance, assets, stock, vendors and change fees for whoever holds those desks", async () => {
    api.overview.mockResolvedValue(overview(extras()));
    render(<OperationsOverview />);
    const compliance = await screen.findByRole("alert");
    expect(compliance).toHaveTextContent("PENCOM compliance certificate");
    expect(screen.getByRole("link", { name: /PAYE remittance/ })).toHaveAttribute("href", "/suite/operations/compliance/oc-1");
    expect(screen.getByRole("table", { name: "Assets by where they are" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Value issued from the stores by month" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Value of approved orders by vendor, past year" })).toBeInTheDocument();
    expect(within(screen.getByText("Rated under 3 of 5").parentElement as HTMLElement).getByText("Quickfix Ltd")).toBeInTheDocument();
    expect(screen.getByText("Travel changes")).toBeInTheDocument();
  });

  it("shows each tile only to someone who holds its desk", async () => {
    api.user = { ...api.user, role: "user", permissions: ["admin.overview.view", "admin.stores.view"] };
    api.overview.mockResolvedValue(overview(extras()));
    render(<OperationsOverview />);
    expect(await screen.findByRole("table", { name: "Value issued from the stores by month" })).toBeInTheDocument();
    expect(screen.queryByText("Compliance")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Assets by where they are" })).not.toBeInTheDocument();
    expect(screen.queryByText("Travel changes")).not.toBeInTheDocument();
  });

  it("adds maintenance, facilities and fleet, and the service desk", async () => {
    api.overview.mockResolvedValue(overview({ ...extras(), ...newDesks() }));
    render(<OperationsOverview />);
    expect(await screen.findByRole("table", { name: "Maintenance cost by month, preventive and corrective" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Open work orders by priority" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Preventive overdue/ })).toHaveAttribute("href", "/suite/operations/maintenance/plans");
    expect(screen.getByRole("table", { name: "Utility and diesel spend by month" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Vehicle papers/ })).toHaveAttribute("href", "/suite/operations/fleet");
    expect(screen.getByRole("img", { name: "4.2 of 5 stars" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Open tickets by category" })).toBeInTheDocument();
  });

  it("shows the new tiles only to whoever holds their desk", async () => {
    api.user = { ...api.user, role: "user", permissions: ["admin.overview.view", "admin.fleet.view"] };
    api.overview.mockResolvedValue(overview({ ...extras(), ...newDesks() }));
    render(<OperationsOverview />);
    expect(await screen.findByText("Facilities and fleet")).toBeInTheDocument();
    // Fleet only: the facility figures don't link to a desk they can't open.
    expect(screen.queryByRole("link", { name: /^Renewals in 90 days/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Maintenance cost by month, preventive and corrective" })).not.toBeInTheDocument();
    expect(screen.queryByText("Service desk")).not.toBeInTheDocument();
  });
});

function newDesks() {
  return {
    maintenance: {
      open: { critical: 1, high: 2, normal: 4, low: 0 },
      slaBreached: 1,
      overduePreventive: 2,
      costThisMonth: 35_000_000,
      slaCompliance: 92,
      byMonth: [
        { month: "2026-09", preventive: 10_000_000, corrective: 25_000_000 },
        { month: "2026-10", preventive: 5_000_000, corrective: 30_000_000 },
      ],
    },
    facilities: {
      spend: [
        { month: "2026-09", utilities: 80_000_000, diesel: 120_000_000 },
        { month: "2026-10", utilities: 40_000_000, diesel: 60_000_000 },
      ],
      renewals: 2,
      serviceToConfirm: 1,
      vehiclePapersExpiring: 3,
      visitorsToday: 5,
    },
    desk: { open: 9, breached: 2, unassigned: 3, resolvedThisWeek: 12, satisfaction: 4.2, slaMet: 88, byCategory: { it: 5, facilities: 4 } },
  };
}

function extras() {
  return {
    assets: {
      byStatus: { in_store: { count: 4, cost: 400_000_00 }, allocated: { count: 10, cost: 1_000_000_00 }, lost: { count: 1, cost: 95_000_00 } },
      total: 15,
      cost: 1_495_000_00,
      missing: 1,
      overduePasses: 2,
      requestsToFulfil: 3,
      clearancesOpen: 1,
      verification: { name: "Q4 count", endsOn: "2026-10-31", percent: 40, missing: 1 },
    },
    stock: { value: 12_500_000_00, belowReorder: 2, requisitionsToIssue: 1, consumption: [{ month: "2026-09", value: 450_000_00 }, { month: "2026-10", value: 120_000_00 }] },
    compliance: {
      dueSoon: 1,
      overdue: 0,
      expired: 1,
      expiring: 0,
      expiredMandatory: ["PENCOM compliance certificate"],
      next: [{ id: "oc-1", name: "PAYE remittance", dueOn: "2026-10-10", stage: "due_soon", owner: "Finance" }],
    },
    vendors: { ordersByVendor: [{ name: "Konga Business", orders: 4, value: 3_200_000_00 }], lowRated: [{ name: "Quickfix Ltd", rating: 2.5 }] },
    travelMoney: { changeFeesThisQuarter: 85_000_00 },
  };
}
