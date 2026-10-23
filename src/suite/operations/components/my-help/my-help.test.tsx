import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import { ApiError, type HelpCatalogue, type TicketFull } from "@/lib/api/operations-desk-client";
import { resetOpsPickers } from "@/suite/operations/components/facilities/parts";
import MyHelp from "./MyHelp";
import MyHelpDetail from "./MyHelpDetail";
import MyBookings from "../my-bookings/MyBookings";

/** Staff self-service: asking for help, closing a request with a rating, and booking a room or vehicle. */

const api = vi.hoisted(() => ({
  catalogue: vi.fn(),
  mine: vi.fn(),
  raise: vi.fn(),
  get: vi.fn(),
  close: vi.fn(),
  workOrders: vi.fn(),
  confirmWork: vi.fn(),
  rooms: vi.fn(),
  bookRoom: vi.fn(),
  vehicles: vi.fn(),
  bookVehicle: vi.fn(),
  logTrip: vi.fn(),
  options: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/api/operations-desk-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-desk-client")>();
  return {
    ...actual,
    help: {
      ...actual.help,
      catalogue: api.catalogue,
      mine: api.mine,
      raise: api.raise,
      get: api.get,
      close: api.close,
      workOrders: api.workOrders,
      confirmWork: api.confirmWork,
      rooms: api.rooms,
      bookRoom: api.bookRoom,
      vehicles: api.vehicles,
      bookVehicle: api.bookVehicle,
      logTrip: api.logTrip,
    },
  };
});
vi.mock("@/lib/api/operations-facilities-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-facilities-client")>();
  return { ...actual, facilities: { ...actual.facilities, options: api.options } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-me", role: "user", name: "Ngozi Eze", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }), usePathname: () => "/suite/operations/my/help", useSearchParams: () => new URLSearchParams() }));

const catalogue = (): HelpCatalogue => ({
  items: [
    { id: "i1", name: "Report a facility fault", category: "facilities", description: "Something broken.", routesTo: "work_order", slaHours: 24, fields: [{ key: "room", label: "Which room", type: "text", required: true }] },
    { id: "i2", name: "IT support", category: "it", description: "Accounts, printers.", routesTo: "ticket", slaHours: 24, fields: [] },
  ],
  categories: { facilities: "Facilities", it: "IT" },
  facilities: [{ id: "f1", name: "Head office" }],
  myAssets: [],
});

const resolved = (over: Partial<TicketFull> = {}): TicketFull => ({
  id: "t1",
  number: "TKT-0007",
  title: "AC not cooling",
  priority: "normal",
  status: "resolved",
  catalogueId: "i1",
  item: "Report a facility fault",
  category: "facilities",
  requester: "Ngozi Eze",
  requesterId: "u-me",
  assignee: "Kemi Desk",
  assigneeId: "u-desk",
  slaDueAt: "2026-10-07T09:00:00",
  breached: false,
  createdAt: "2026-10-05T09:00:00",
  resolvedAt: "2026-10-06T08:00:00",
  rating: null,
  linkedType: "work_order",
  linkedId: "w1",
  description: null,
  answers: {},
  fields: [],
  firstResponseAt: null,
  closedAt: null,
  ratingComment: null,
  facility: "Head office",
  asset: null,
  linked: { type: "work_order", id: "w1", reference: "WO-0031", status: "completed", url: "/suite/operations/maintenance/w1" },
  comments: [{ id: "c1", body: "Compressor replaced.", internal: false, by: "Kemi Desk", byId: "u-desk", at: "2026-10-06T08:00:00" }],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  for (const f of Object.values(api)) f.mockReset();
  resetOpsPickers();
  api.options.mockResolvedValue({ staff: [], vendors: [], projects: [{ id: "p1", name: "Lekki rollout", code: "LR" }], costCentres: [] });
});
afterEach(() => vi.useRealTimers());

describe("MyHelp", () => {
  it("opens a tile's form, asks for its required answer and where the fault is, then sends it", async () => {
    const user = userEvent.setup();
    api.catalogue.mockResolvedValue(catalogue());
    api.mine.mockResolvedValue([]);
    api.workOrders.mockResolvedValue([]);
    api.raise.mockResolvedValue(resolved({ id: "t9", status: "in_progress" }));
    render(<MyHelp />);
    await user.click(await screen.findByRole("button", { name: /Report a facility fault/ }));
    const dialog = screen.getByRole("dialog", { name: "Report a facility fault" });
    await user.type(within(dialog).getByLabelText("In a line"), "Lights out in B2");
    await user.click(within(dialog).getByRole("button", { name: "Report the fault" }));
    expect(within(dialog).getByText("Which room is needed.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say where it is, or which of your assets.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Which room/), "B2");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: /Where/ }), "Head office");
    await user.click(within(dialog).getByRole("button", { name: "Report the fault" }));
    expect(api.raise).toHaveBeenCalledWith({ catalogueId: "i1", title: "Lights out in B2", description: null, answers: { room: "B2" }, priority: "normal", facilityId: "f1", assetId: null });
    expect(api.push).toHaveBeenCalledWith("/suite/operations/my/help/t9");
  }, 20_000);

  it("puts repairs waiting for me first, and confirms one", async () => {
    const user = userEvent.setup();
    api.catalogue.mockResolvedValue(catalogue());
    api.mine.mockResolvedValue([]);
    api.workOrders.mockResolvedValue([{ id: "w1", number: "WO-0031", title: "AC compressor", status: "completed", asset: "AC-004", resolution: "Replaced", completedAt: "2026-10-06T08:00:00", toConfirm: true }]);
    api.confirmWork.mockResolvedValue({ id: "w1", status: "closed" });
    render(<MyHelp />);
    const panel = (await screen.findByText("Repairs to confirm")).closest("section") as HTMLElement;
    await user.click(within(panel).getByRole("button", { name: "Confirm it's fixed" }));
    expect(api.confirmWork).toHaveBeenCalledWith("w1");
    expect(screen.queryByText("Repairs to confirm")).not.toBeInTheDocument();
  }, 20_000);
});

describe("MyHelpDetail", () => {
  it("closes a resolved request with a rating, or insists on a reason to reopen", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(resolved());
    api.close.mockResolvedValue(resolved({ status: "closed", rating: 5 }));
    render(<MyHelpDetail id="t1" />);
    expect(await screen.findByText("The desk says this is done")).toBeInTheDocument();
    expect(screen.getByText("Work order WO-0031")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "It isn't" }));
    await user.click(screen.getByRole("button", { name: "Reopen the request" }));
    expect(screen.getByText("Say what still isn't right.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "It's sorted" }));
    await user.click(screen.getByRole("radio", { name: "5 of 5" }));
    await user.click(screen.getByRole("button", { name: "Close the request" }));
    expect(api.close).toHaveBeenCalledWith("t1", { rating: 5, comment: null });
    expect(await screen.findByRole("img", { name: "Rated 5 of 5" })).toBeInTheDocument();
  }, 20_000);
});

describe("MyBookings", () => {
  it("books a free hour in a room, and shows the clash when someone got there first", async () => {
    const user = userEvent.setup();
    api.rooms.mockResolvedValue({
      rooms: [{ id: "s1", name: "Board room", capacity: 12, facility: "Head office" }],
      bookings: [{ id: "b1", spaceId: "s1", title: "Budget", startsAt: "2026-10-07T10:00:00", endsAt: "2026-10-07T11:00:00", bookedBy: "Femi", mine: false }],
    });
    api.bookRoom.mockRejectedValueOnce(new ApiError("Board room is booked then.", 422, { startsAt: ["Board room is booked then: Budget, 10:00–11:00."] }));
    api.bookRoom.mockResolvedValueOnce({ id: "b2" });
    render(<MyBookings />);
    expect(await screen.findByRole("img", { name: "10:00–11:00: booked by Femi" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book Board room on Wed 7 Oct at 10:00" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Book Board room on Wed 7 Oct at 14:00" }));
    const dialog = screen.getByRole("dialog", { name: "Book Board room" });
    await user.type(within(dialog).getByLabelText("What for"), "Sprint review");
    await user.type(within(dialog).getByLabelText(/People/), "20");
    await user.click(within(dialog).getByRole("button", { name: "Book the room" }));
    expect(within(dialog).getByText("Board room seats 12.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/People/));
    await user.type(within(dialog).getByLabelText(/People/), "8");
    await user.click(within(dialog).getByRole("button", { name: "Book the room" }));
    expect(await within(dialog).findByText("Board room is booked then: Budget, 10:00–11:00.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Book the room" }));
    expect(api.bookRoom).toHaveBeenLastCalledWith("s1", expect.objectContaining({ title: "Sprint review", attendees: 8, startsAt: expect.stringMatching(/^2026-10-07T14:00:00/), endsAt: expect.stringMatching(/^2026-10-07T15:00:00/) }));
    expect(await screen.findByRole("status")).toHaveTextContent("Board room is yours");
  }, 20_000);

  it("requests a pool vehicle and lets a driver log a trip", async () => {
    const user = userEvent.setup();
    api.rooms.mockResolvedValue({ rooms: [], bookings: [] });
    api.vehicles.mockResolvedValue({
      pool: [{ id: "v1", registrationNo: "LND-482-KJ", name: "Toyota Hiace" }],
      busy: [{ vehicleId: "v1", startsAt: "2026-10-08T08:00:00", endsAt: "2026-10-08T17:00:00" }],
      mine: [{ id: "vb1", registrationNo: "LND-482-KJ", purpose: "Site visit", destination: "Lekki", status: "requested", startsAt: "2026-10-09T09:00:00", endsAt: "2026-10-09T12:00:00", driver: null }],
      driving: [{ id: "v2", registrationNo: "ABJ-110-AA", name: "Corolla", odometer: 1000 }],
    });
    api.bookVehicle.mockResolvedValue({ id: "vb2", status: "requested" });
    api.logTrip.mockResolvedValue({ id: "tr1" });
    render(<MyBookings />);
    await user.click(await screen.findByRole("tab", { name: "Vehicles" }));
    expect(await screen.findByText("20 of 21 days free")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the fleet desk")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Request this vehicle" }));
    const dialog = screen.getByRole("dialog", { name: "Request LND-482-KJ" });
    await user.type(within(dialog).getByLabelText("What for"), "Client visit");
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    expect(api.bookVehicle).toHaveBeenCalledWith("v1", expect.objectContaining({ purpose: "Client visit", destination: null }));

    const trip = (await screen.findByText("Log a trip")).closest("section") as HTMLElement;
    await user.type(within(trip).getByLabelText("What for"), "Bank run");
    await user.type(within(trip).getByLabelText(/At the end/), "1042");
    await user.click(within(trip).getByRole("button", { name: "Log the trip" }));
    expect(within(trip).getByText("Charge it to a project or a cost centre.")).toBeInTheDocument();
    await chooseOption(user, within(trip).getByRole("combobox", { name: "Project" }), "Lekki rollout");
    await user.click(within(trip).getByRole("button", { name: "Log the trip" }));
    expect(api.logTrip).toHaveBeenCalledWith("v2", expect.objectContaining({ purpose: "Bank run", startOdometer: 1000, endOdometer: 1042, projectId: "p1", costCentreId: null }));
  }, 20_000);
});
