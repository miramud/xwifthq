import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContractFull, FacilityDetail as Detail, FacilityRow, Lease, Visitor } from "@/lib/api/operations-facilities-client";
import FacilitiesDesk from "./FacilitiesDesk";
import FacilityDetail from "./FacilityDetail";
import ContractsBoard from "./ContractsBoard";
import LeasesBoard from "./LeasesBoard";
import VisitorsDesk from "./VisitorsDesk";
import { resetOpsPickers } from "./parts";

/** The facilities desk: sites and spend, a site's diesel, contract months, the lease timeline and reception. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  diesel: vi.fn(),
  contracts: vi.fn(),
  confirm: vi.fn(),
  leases: vi.fn(),
  visitors: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  options: vi.fn(),
  csv: vi.fn(),
  role: "user",
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-facilities-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-facilities-client")>();
  return {
    ...actual,
    facilities: {
      ...actual.facilities,
      list: api.list,
      get: api.get,
      diesel: api.diesel,
      contracts: api.contracts,
      confirm: api.confirm,
      leases: api.leases,
      visitors: api.visitors,
      checkIn: api.checkIn,
      checkOut: api.checkOut,
      options: api.options,
    },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-fac", role: api.role, name: "Bisi Facilities", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: api.csv }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/facilities", useSearchParams: () => new URLSearchParams() }));

const site = (over: Partial<FacilityRow> = {}): FacilityRow => ({
  id: "f1",
  code: "HQ",
  name: "Head office",
  kind: "office",
  address: "12 Adeola Odeku, Victoria Island",
  tankLitres: null,
  ownership: "leased",
  areaSqm: 900,
  headcount: 40,
  managerId: null,
  manager: null,
  costCentreId: null,
  active: true,
  spaces: 5,
  tank: 820,
  lease: { endsOn: "2026-12-31", nextDueOn: "2027-01-01" },
  ...over,
});

const board = () => ({
  facilities: [site(), site({ id: "f2", code: "WH", name: "Apapa warehouse", kind: "warehouse", ownership: "owned", tank: 2400, headcount: 8, lease: null })],
  kinds: { campus: "Campus", office: "Office", site: "Project site", warehouse: "Warehouse" },
  spend: {
    months: ["2026-09", "2026-10"],
    facilities: [
      { facilityId: "f1", name: "Head office", headcount: 40, months: [{ month: "2026-09", byKind: { electricity: 400_000_00, diesel: 300_000_00 }, total: 700_000_00, perHead: 17_500_00 }, { month: "2026-10", byKind: { diesel: 0 }, total: 0, perHead: 0 }] },
      { facilityId: "f2", name: "Apapa warehouse", headcount: 8, months: [{ month: "2026-09", byKind: { diesel: 100_000_00 }, total: 100_000_00, perHead: 12_500_00 }, { month: "2026-10", byKind: { diesel: 0 }, total: 0, perHead: 0 }] },
    ],
  },
});

const detail = (): Detail => ({
  ...site(),
  spaces: [{ id: "s1", name: "Board room", kind: "meeting_room", capacity: 12, bookable: true }],
  leases: [],
  utilities: [],
  contracts: [],
  tank: 80,
  diesel: [
    { id: "d2", kind: "diesel_used", enteredOn: "2026-10-02", litres: 920, amount: 0, reading: 1200, generator: "GEN-001" },
    { id: "d1", kind: "diesel_in", enteredOn: "2026-10-01", litres: 1000, amount: 1_100_000_00, reading: null, generator: null },
  ],
  generators: [{ id: "g1", tagNo: "GEN-001", name: "Perkins 60kVA" }],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  for (const f of [api.list, api.get, api.diesel, api.contracts, api.confirm, api.leases, api.visitors, api.checkIn, api.checkOut, api.options, api.csv]) f.mockReset();
  api.role = "user";
  resetOpsPickers();
  api.options.mockResolvedValue({ staff: [{ id: "u1", name: "Ada Obi" }], vendors: [{ id: "v1", name: "Sparkle Cleaners" }], projects: [], costCentres: [] });
  api.permissions = ["view", "create", "update", "diesel", "confirm", "update_contract", "create_contract", "check_in", "check_out", "create_visitor", "create_lease", "update_lease", "create_space", "update_space"].map((a) => `admin.facilities.${a}`);
});
afterEach(() => vi.useRealTimers());

describe("FacilitiesDesk", () => {
  it("shows each site as a card with its tank, headcount and lease, and the month's spend per head", async () => {
    api.list.mockResolvedValue(board());
    render(<FacilitiesDesk />);
    const sites = await screen.findByRole("region", { name: "Sites" });
    const card = within(sites).getByText("Apapa warehouse").closest("a") as HTMLElement;
    expect(card).toHaveAttribute("href", "/suite/operations/facilities/f2");
    expect(within(card).getByText("Owned")).toBeInTheDocument();
    expect(within(card).getByRole("meter", { name: /Apapa warehouse: 2,400 L of diesel/ })).toBeInTheDocument();
    const hq = within(sites).getByText("Head office").closest("a") as HTMLElement;
    expect(within(hq).getByText("86 days left")).toBeInTheDocument();
    // Leases ending within 120 days, and the spend stacked by kind.
    expect(screen.getByText("Leases ending soon").closest("a")).toHaveTextContent("1");
    expect(screen.getByRole("table", { name: /Utility and diesel spend by month across all sites/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Service contracts/ })).toHaveAttribute("href", "/suite/operations/facilities/contracts");
  }, 20_000);
});

describe("FacilityDetail", () => {
  it("refuses more diesel used than the tank holds, then records it against the generator", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    api.diesel.mockResolvedValue({ id: "d3", tank: 20 });
    render(<FacilityDetail id="f1" />);
    await user.click(await screen.findByRole("tab", { name: /Diesel/ }));
    expect(screen.getByRole("meter", { name: "Diesel in the tank at Head office" })).toHaveAttribute("aria-valuenow", "80");
    await user.click(screen.getAllByRole("button", { name: "Record diesel" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Record diesel" });
    await user.click(within(dialog).getByRole("radio", { name: "Used by a generator" }));
    await user.type(within(dialog).getByLabelText("Litres"), "120");
    await user.click(within(dialog).getByRole("button", { name: "Record diesel used" }));
    expect(within(dialog).getByText("The tank holds 80 L by the log.")).toBeInTheDocument();
    expect(api.diesel).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Litres"));
    await user.type(within(dialog).getByLabelText("Litres"), "60");
    await user.type(within(dialog).getByLabelText("Running hours now"), "1206");
    await user.click(within(dialog).getByRole("button", { name: "Record diesel used" }));
    expect(api.diesel).toHaveBeenCalledWith({ kind: "diesel_used", facilityId: "f1", litres: 60, enteredOn: "2026-10-06", assetId: "g1", reading: 1206 });
  }, 20_000);
});

const contract = (over: Partial<ContractFull> = {}): ContractFull => ({
  id: "c1",
  service: "cleaning",
  serviceLabel: "Cleaning",
  vendorId: "v1",
  vendor: "Sparkle Cleaners",
  facilityId: "f1",
  facility: "Head office",
  reference: "SC-01",
  startsOn: "2026-03-01",
  endsOn: "2026-12-31",
  value: 0,
  periodAmount: 450_000_00,
  frequency: "monthly",
  status: "active",
  daysLeft: 86,
  officerId: null,
  officer: null,
  scope: null,
  sla: null,
  renewalNoticeDays: 60,
  costCentreId: null,
  rating: 4,
  confirmations: [{ period: "2026-08", status: "confirmed", rating: 4, notes: null, amount: 450_000_00, memoId: "m1", by: "Bisi" }],
  toConfirm: ["2026-10", "2026-09"],
  ...over,
});

describe("ContractsBoard", () => {
  it("opens a month to confirm, insists on a reason to dispute, and reports what happened", async () => {
    const user = userEvent.setup();
    api.contracts.mockResolvedValue({ contracts: [contract()], services: { cleaning: "Cleaning" } });
    api.list.mockResolvedValue(board());
    api.confirm.mockResolvedValue(contract({ confirmations: [{ period: "2026-09", status: "disputed", rating: 2, notes: "Missed two Fridays", amount: 0, memoId: null, by: "Bisi" }, ...contract().confirmations], toConfirm: ["2026-10"] }));
    render(<ContractsBoard />);
    expect(await screen.findByRole("img", { name: "August 2026: confirmed and paid, rated 4 of 5" })).toBeInTheDocument();
    expect(screen.getByText("Renewal notice in 26 days")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm or dispute September 2026" }));
    const dialog = screen.getByRole("dialog", { name: /Cleaning: September 2026/ });
    await user.click(within(dialog).getByRole("radio", { name: /Not delivered/ }));
    await user.click(within(dialog).getByRole("radio", { name: "2 of 5" }));
    await user.click(within(dialog).getByRole("button", { name: "Dispute the month" }));
    expect(within(dialog).getByText("Say what was not delivered.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/What was not delivered/), "Missed two Fridays");
    await user.click(within(dialog).getByRole("button", { name: "Dispute the month" }));
    expect(api.confirm).toHaveBeenCalledWith("c1", { period: "2026-09", confirmed: false, rating: 2, notes: "Missed two Fridays" });
    expect(await screen.findByRole("status")).toHaveTextContent("September 2026 disputed. Nothing is paid for it.");
    expect(screen.getByRole("img", { name: /September 2026: disputed, rated 2 of 5/ })).toBeInTheDocument();
  }, 20_000);
});

const theLease = (): Lease => ({
  id: "l1",
  facilityId: "f1",
  facility: "Head office",
  landlordId: null,
  landlord: "Adeyemi Estates",
  reference: "LSE/HQ",
  startsOn: "2024-01-01",
  endsOn: "2026-12-31",
  rent: 12_000_000_00,
  frequency: "annual",
  serviceCharge: 0,
  escalationBp: 0,
  escalationEveryMonths: null,
  noticeDays: 90,
  nextDueOn: null,
  nextAmount: null,
  memoLeadDays: 14,
  status: "active",
  daysLeft: 86,
  documentId: null,
  notes: null,
  payments: [],
});

describe("LeasesBoard", () => {
  it("puts every lease on the expiry timeline with its notice markers", async () => {
    api.leases.mockResolvedValue([theLease()]);
    api.list.mockResolvedValue(board());
    render(<LeasesBoard />);
    expect(await screen.findByRole("img", { name: "Head office: 1 Jan 2024 to 31 Dec 2026, 86 days left" })).toBeInTheDocument();
    expect(screen.getByText("Ending within 120 days").closest("div")?.parentElement).toHaveTextContent("1");
    expect(screen.getByText("T−120 days")).toBeInTheDocument();
  }, 20_000);
});

describe("VisitorsDesk", () => {
  it("checks an expected visitor in with a badge and moves them into the building", async () => {
    const user = userEvent.setup();
    const v: Visitor = { id: "v1", name: "Tunde Bello", company: "Zenith", phone: null, purpose: "Contract signing", host: "Ada Obi", hostId: "u1", facilityId: "f1", expectedAt: "2026-10-06T10:00:00+01:00", checkedInAt: null, checkedOutAt: null, badgeNo: null };
    api.visitors.mockResolvedValue([v]);
    api.list.mockResolvedValue(board());
    api.checkIn.mockResolvedValue({ ...v, checkedInAt: "2026-10-06T10:02:00+01:00", badgeNo: "V-014" });
    render(<VisitorsDesk />);
    const expected = await screen.findByRole("region", { name: "Expected" });
    await user.click(within(expected).getByRole("button", { name: "Check in" }));
    const dialog = screen.getByRole("dialog", { name: "Check in Tunde Bello" });
    await user.type(within(dialog).getByLabelText(/Badge number/), "V-014");
    await user.click(within(dialog).getByRole("button", { name: "Check in" }));
    expect(api.checkIn).toHaveBeenCalledWith("v1", "V-014");
    const inside = await screen.findByRole("region", { name: "In the building" });
    expect(within(inside).getByText("Tunde Bello")).toBeInTheDocument();
    expect(within(inside).getByText("V-014")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Tunde Bello checked in with badge V-014.");
  }, 20_000);
});

describe("CSV, links and detail drawers", () => {
  it("downloads the sites as CSV", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(board());
    render(<FacilitiesDesk />);
    await user.click(await screen.findByRole("button", { name: "Download CSV" }));
    const [name, rows] = api.csv.mock.calls[0];
    expect(name).toBe("facilities_2026-10-06.csv");
    expect(rows[0]).toContain("Lease ends");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(["HQ", "Head office", "Office", "Leased", "12 Adeola Odeku, Victoria Island", 900, 40, "", 5, 820, "", "2026-12-31", "2027-01-01", "Yes"]);
  }, 20_000);

  it("downloads the leases listed, opens one in a drawer and links its rent memo", async () => {
    const user = userEvent.setup();
    api.leases.mockResolvedValue([{ ...theLease(), payments: [{ dueOn: "2026-01-01", amount: 12_000_000_00, memoId: "m9", memo: { reference: "MEMO/2026/009", status: "paid", amount: 12_000_000_00, paid: 12_000_000_00, type: "payment" } }] }]);
    api.list.mockResolvedValue(board());
    render(<LeasesBoard />);
    await user.click(await screen.findByRole("button", { name: "Download CSV" }));
    const [name, rows] = api.csv.mock.calls[0];
    expect(name).toBe("leases_active_2026-10-06.csv");
    expect(rows[1].slice(0, 10)).toEqual(["Head office", "Adeyemi Estates", "LSE/HQ", "Active", "2024-01-01", "2026-12-31", 86, "Yearly", "NGN", "12000000.00"]);
    // Without Finance, the memo opens on the Core memo page.
    expect(screen.getByRole("link", { name: "MEMO/2026/009" })).toHaveAttribute("href", "/suite/memos/m9");
    await user.click(screen.getByRole("button", { name: /Open the lease details/ }));
    const drawer = screen.getByRole("dialog", { name: "Head office lease" });
    expect(within(drawer).getByText("Rent per instalment")).toBeInTheDocument();
    expect(within(drawer).getByText("90 days")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Edit the lease" }));
    expect(screen.queryByRole("dialog", { name: "Head office lease" })).not.toBeInTheDocument();
  }, 20_000);

  it("links a contract's vendor for an admin, downloads the contracts and opens one with its confirmed months", async () => {
    const user = userEvent.setup();
    api.role = "admin";
    api.contracts.mockResolvedValue({ contracts: [contract()], services: { cleaning: "Cleaning" } });
    api.list.mockResolvedValue(board());
    render(<ContractsBoard />);
    expect(await screen.findByRole("link", { name: "Sparkle Cleaners" })).toHaveAttribute("href", "/suite/org/counterparties/v1");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const [, rows] = api.csv.mock.calls[0];
    expect(rows[1].slice(0, 11)).toEqual(["Cleaning", "Sparkle Cleaners", "Head office", "SC-01", "Active", "2026-03-01", "2026-12-31", 86, "Monthly", "NGN", "450000.00"]);
    await user.click(screen.getByRole("button", { name: "Open the cleaning contract details" }));
    const drawer = screen.getByRole("dialog", { name: "Cleaning contract" });
    expect(within(drawer).getByText(/^August 2026/)).toBeInTheDocument();
    expect(within(drawer).getByText("Rated 4 of 5 · By Bisi")).toBeInTheDocument();
    // An admin sees Finance, so the memo opens there.
    expect(within(drawer).getByRole("link", { name: "Payment memo" })).toHaveAttribute("href", "/suite/finance/memos/m1");
  }, 20_000);

  it("leaves the vendor as text for somebody who cannot open the console page", async () => {
    api.contracts.mockResolvedValue({ contracts: [contract()], services: { cleaning: "Cleaning" } });
    api.list.mockResolvedValue(board());
    render(<ContractsBoard />);
    expect(await screen.findByText(/^Sparkle Cleaners · Head office/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sparkle Cleaners" })).not.toBeInTheDocument();
  }, 20_000);

  it("opens a visitor in a drawer", async () => {
    const user = userEvent.setup();
    const v: Visitor = { id: "v1", name: "Tunde Bello", company: "Zenith", phone: "0803 000 0000", purpose: "Contract signing", host: "Ada Obi", hostId: "u1", facilityId: "f1", expectedAt: "2026-10-06T10:00:00+01:00", checkedInAt: null, checkedOutAt: null, badgeNo: null };
    api.visitors.mockResolvedValue([v]);
    api.list.mockResolvedValue(board());
    render(<VisitorsDesk />);
    await user.click(await screen.findByRole("button", { name: "Open the visit details: Tunde Bello" }));
    const drawer = screen.getByRole("dialog", { name: "Tunde Bello" });
    expect(within(drawer).getByText("0803 000 0000")).toBeInTheDocument();
    expect(within(drawer).getByText("Ada Obi")).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  }, 20_000);
});
