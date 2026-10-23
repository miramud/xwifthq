import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import FleetBoard from "./FleetBoard";
import VehicleDetail from "./VehicleDetail";
import { resetFleetOptions } from "./FleetDialogs";
import type { FleetBoard as Board, VehicleFull, VehicleRow } from "@/lib/api/operations-fleet-client";

/** The fleet desk: plates and papers, efficiency, pool bookings, and a vehicle's logs. */

const api = vi.hoisted(() => ({ board: vi.fn(), get: vi.fn(), create: vi.fn(), addTrip: vi.fn(), addPaper: vi.fn(), decide: vi.fn(), options: vi.fn(), push: vi.fn(), permissions: [] as string[] }));

vi.mock("@/lib/api/operations-fleet-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-fleet-client")>();
  return { ...actual, fleet: { ...actual.fleet, board: api.board, get: api.get, create: api.create, addTrip: api.addTrip, addPaper: api.addPaper, decide: api.decide, options: api.options } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push, replace: vi.fn() }), usePathname: () => "/suite/operations/fleet", useSearchParams: () => new URLSearchParams() }));

const PAPERS = { licence: "Vehicle licence", roadworthiness: "Roadworthiness certificate", insurance: "Motor insurance", hackney: "Hackney permit" };

function vehicle(over: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: "v1",
    assetId: "a-hilux",
    tagNo: "MPT/VEH/0001",
    name: "Toyota Hilux",
    assetStatus: "allocated",
    registrationNo: "ABC-123-XY",
    chassisNo: null,
    engineNo: null,
    driverId: "u-musa",
    driver: "Musa Garba",
    pool: true,
    fuelType: "diesel",
    expectedKmPerLitre: 10,
    odometer: 48210,
    papers: [
      { kind: "licence", label: "Vehicle licence", obligationId: "o1", occurrenceId: null, expiresOn: "2027-03-01", reference: "LIC-1", state: "valid" },
      { kind: "insurance", label: "Motor insurance", obligationId: "o2", occurrenceId: "oc-9", expiresOn: "2026-09-30", reference: null, state: "expired" },
    ],
    ...over,
  };
}

function board(over: Partial<Board> = {}): Board {
  return {
    vehicles: [vehicle()],
    efficiency: [
      {
        vehicleId: "v1",
        registrationNo: "ABC-123-XY",
        name: "Toyota Hilux",
        expected: 10,
        months: [
          { month: "2026-09", km: 900, litres: 90, cost: 7_650_000, kmPerLitre: 10, flag: false },
          { month: "2026-10", km: 300, litres: 50, cost: 4_250_000, kmPerLitre: 6, flag: true },
        ],
      },
    ],
    bookings: [
      { id: "b1", vehicleId: "v1", registrationNo: "ABC-123-XY", purpose: "Client visit", destination: "Wuse II", startsAt: "2026-10-07T09:00:00+01:00", endsAt: "2026-10-07T14:00:00+01:00", status: "requested", requestedBy: "Ada Obi", driver: null },
    ],
    unregistered: [{ id: "a-bus", tagNo: "MPT/VEH/0002", name: "Toyota Hiace" }],
    papers: PAPERS,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T10:00:00+01:00"));
  for (const f of [api.board, api.get, api.create, api.addTrip, api.addPaper, api.decide, api.options, api.push]) f.mockReset();
  resetFleetOptions();
  api.options.mockResolvedValue({ staff: [{ id: "u-musa", name: "Musa Garba" }], vendors: [], projects: [{ id: "p1", name: "Kano rollout", code: "KAN", status: "active" }], costCentres: [] });
  api.permissions = ["view", "create", "update", "paper", "trip", "fuel", "decide"].map((a) => `admin.fleet.${a}`);
});
afterEach(() => vi.useRealTimers());

describe("FleetBoard", () => {
  it("shows each vehicle by its plate with its papers, and flags a low month", async () => {
    api.board.mockResolvedValue(board());
    render(<FleetBoard />);
    const card = await screen.findByRole("link", { name: /ABC-123-XY.*Toyota Hilux/ });
    expect(card).toHaveAttribute("href", "/suite/operations/fleet/v1");
    expect(within(card).getByText("Insurance")).toBeInTheDocument();
    expect(within(card).getByText(": expired")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "ABC-123-XY: km per litre by month" })).toBeInTheDocument();
    expect(screen.getByText("1 low month")).toBeInTheDocument();
    expect(screen.getByText(/on the asset register but not set up in the fleet: MPT\/VEH\/0002/)).toBeInTheDocument();
  });

  it("declines a pool booking only once confirmed, and approves one with a driver", async () => {
    const user = userEvent.setup();
    api.board.mockResolvedValue(board());
    api.decide.mockResolvedValue({});
    render(<FleetBoard />);
    await user.click(await screen.findByRole("button", { name: "Decline" }));
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(api.decide).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve the booking" });
    await chooseOption(user, within(dialog).getByRole("combobox", { name: /Driver/ }), "Musa Garba");
    await user.click(within(dialog).getByRole("button", { name: "Approve booking" }));
    expect(api.decide).toHaveBeenCalledWith("b1", true, "u-musa");
    expect(await screen.findByText("Booking approved on ABC-123-XY.")).toBeInTheDocument();
  }, 20_000);

  it("adds a vehicle from the register and opens it", async () => {
    const user = userEvent.setup();
    api.board.mockResolvedValue(board());
    api.create.mockResolvedValue({ ...vehicle({ id: "v2", registrationNo: "KJA-555-AA" }) });
    render(<FleetBoard />);
    await user.click(await screen.findByRole("button", { name: "Add vehicle" }));
    const dialog = screen.getByRole("dialog", { name: "Add a vehicle" });
    await user.type(within(dialog).getByLabelText("Registration number"), "kja-555-aa");
    await user.click(within(dialog).getByRole("button", { name: "Add vehicle" }));
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ assetId: "a-bus", registrationNo: "KJA-555-AA", pool: true, fuelType: "petrol", papers: ["licence", "roadworthiness", "insurance"] }));
    expect(api.push).toHaveBeenCalledWith("/suite/operations/fleet/v2");
  }, 20_000);
});

describe("VehicleDetail", () => {
  const full = (over: Partial<VehicleFull> = {}): VehicleFull => ({
    ...vehicle(),
    trips: [{ id: "t1", tripOn: "2026-10-02", driver: "Musa Garba", purpose: "Site survey", project: { id: "p1", name: "Kano rollout", code: "KAN" }, origin: "Head office", destination: "Kubwa", startOdometer: 48000, endOdometer: 48210, km: 210 }],
    fuel: [],
    workOrders: [{ id: "w1", number: "WO-2026-0050", title: "Brake pads", kind: "corrective", status: "in_progress", cost: 6_500_000, createdAt: "2026-10-01T09:00:00+01:00" }],
    incidents: [],
    efficiency: board().efficiency[0],
    ...over,
  });

  it("links each paper to its renewal and each work order to its page", async () => {
    api.get.mockResolvedValue(full());
    render(<VehicleDetail id="v1" />);
    expect(await screen.findByRole("link", { name: "Renew Motor insurance" })).toHaveAttribute("href", "/suite/operations/compliance/oc-9");
    expect(screen.getByText("No renewal raised yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Brake pads/ })).toHaveAttribute("href", "/suite/operations/maintenance/w1");
    expect(screen.getByRole("table", { name: "ABC-123-XY: km per litre by month, twelve months" })).toBeInTheDocument();
  });

  it("logs a trip charged to a project, and refuses one that runs the odometer backwards", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.addTrip.mockResolvedValue({ id: "t2", odometer: 48300 });
    render(<VehicleDetail id="v1" />);
    await user.click(await screen.findByRole("button", { name: "Log a trip" }));
    const dialog = screen.getByRole("dialog", { name: "Log a trip" });
    await user.type(within(dialog).getByLabelText("Purpose"), "Client visit");
    await user.type(within(dialog).getByLabelText("Odometer at end"), "48100");
    await user.click(within(dialog).getByRole("button", { name: "Log trip" }));
    expect(within(dialog).getByText("The odometer at the end is more than at the start.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose the project to charge.")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Odometer at end"));
    await user.type(within(dialog).getByLabelText("Odometer at end"), "48300");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Project" }), "Kano rollout");
    await user.click(within(dialog).getByRole("button", { name: "Log trip" }));
    expect(api.addTrip).toHaveBeenCalledWith("v1", expect.objectContaining({ purpose: "Client visit", projectId: "p1", costCentreId: null, startOdometer: 48210, endOdometer: 48300, driverId: "u-musa", tripOn: "2026-10-06" }));
    expect(await screen.findByText("Trip logged: 90 km. The odometer reads 48,300 km.")).toBeInTheDocument();
  }, 20_000);

  it("tracks another paper on the compliance register", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.addPaper.mockResolvedValue([...vehicle().papers, { kind: "hackney", label: "Hackney permit", obligationId: "o3", occurrenceId: null, expiresOn: null, reference: null, state: "missing" }]);
    render(<VehicleDetail id="v1" />);
    await user.click(await screen.findByRole("button", { name: "Hackney permit" }));
    expect(api.addPaper).toHaveBeenCalledWith("v1", "hackney");
    expect(await screen.findByText(/Hackney permit added to the compliance register/)).toBeInTheDocument();
  });
});
