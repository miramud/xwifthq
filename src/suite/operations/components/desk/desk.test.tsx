import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import type { Ticket, TicketFull } from "@/lib/api/operations-desk-client";
import { resetOpsPickers } from "@/suite/operations/components/facilities/parts";
import ServiceDesk from "./ServiceDesk";
import TicketDetail from "./TicketDetail";
import CatalogueEditor from "./CatalogueEditor";
import { duration, sla } from "./labels";

/** The service desk: the queue and its clocks, a ticket worked through, and the catalogue's form builder. */

const api = vi.hoisted(() => ({
  queue: vi.fn(),
  get: vi.fn(),
  comment: vi.fn(),
  status: vi.fn(),
  link: vi.fn(),
  linkable: vi.fn(),
  raiseWorkOrder: vi.fn(),
  catalogue: vi.fn(),
  createItem: vi.fn(),
  helpCatalogue: vi.fn(),
  options: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-desk-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-desk-client")>();
  return {
    ...actual,
    desk: { ...actual.desk, queue: api.queue, get: api.get, comment: api.comment, status: api.status, link: api.link, linkable: api.linkable, raiseWorkOrder: api.raiseWorkOrder, catalogue: api.catalogue, createItem: api.createItem },
    help: { ...actual.help, catalogue: api.helpCatalogue },
  };
});
vi.mock("@/lib/api/operations-facilities-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-facilities-client")>();
  return { ...actual, facilities: { ...actual.facilities, options: api.options } };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-desk", role: "user", name: "Kemi Desk", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/desk", useSearchParams: () => new URLSearchParams() }));

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "t1",
  number: "TKT-0007",
  title: "AC not cooling in the board room",
  priority: "high",
  status: "assigned",
  catalogueId: "i1",
  item: "Report a facility fault",
  category: "facilities",
  requester: "Ngozi Eze",
  requesterId: "u-req",
  assignee: "Kemi Desk",
  assigneeId: "u-desk",
  slaDueAt: "2026-10-06T08:00:00",
  breached: true,
  createdAt: "2026-10-05T08:00:00",
  resolvedAt: null,
  rating: null,
  linkedType: null,
  linkedId: null,
  ...over,
});

const full = (over: Partial<TicketFull> = {}): TicketFull => ({
  ...ticket(),
  description: "It blows warm air since Monday.",
  answers: { room: "Board room" },
  fields: [{ key: "room", label: "Which room", type: "text", required: true }],
  firstResponseAt: null,
  closedAt: null,
  ratingComment: null,
  facility: "Head office",
  facilityId: "f1",
  asset: null,
  linked: null,
  comments: [
    { id: "c1", body: "Still warm today.", internal: false, by: "Ngozi Eze", byId: "u-req", at: "2026-10-06T07:30:00" },
    { id: "c2", body: "Vendor quoted for a compressor.", internal: true, by: "Kemi Desk", byId: "u-desk", at: "2026-10-06T08:10:00" },
  ],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T09:00:00"));
  for (const f of Object.values(api)) if (typeof f === "function") (f as ReturnType<typeof vi.fn>).mockReset();
  api.linkable.mockResolvedValue([]);
  resetOpsPickers();
  api.options.mockResolvedValue({ staff: [{ id: "u-desk", name: "Kemi Desk" }, { id: "u2", name: "Ade Fix" }], vendors: [], projects: [], costCentres: [] });
  api.permissions = [
    ...["view", "assign", "comment", "status", "link", "create_item", "update_item"].map((a) => `admin.service_desk.${a}`),
    "admin.maintenance.create",
  ];
});
afterEach(() => vi.useRealTimers());

describe("SLA clocks", () => {
  it("counts down, turns amber in the last two hours, and says how long ago it was breached", () => {
    const now = new Date("2026-10-06T09:00:00").getTime();
    expect(sla({ slaDueAt: "2026-10-06T08:00:00", status: "new", resolvedAt: null }, now)).toMatchObject({ state: "breached", text: "Breached 1h ago" });
    expect(sla({ slaDueAt: "2026-10-06T10:30:00", status: "new", resolvedAt: null }, now)).toMatchObject({ state: "soon", text: "1h 30m left" });
    expect(sla({ slaDueAt: "2026-10-09T10:00:00", status: "waiting", resolvedAt: null }, now)).toMatchObject({ state: "ok", text: "3d 1h left" });
    expect(sla({ slaDueAt: "2026-10-06T10:00:00", status: "resolved", resolvedAt: "2026-10-06T09:30:00" }, now).state).toBe("met");
    expect(duration(45 * 60_000)).toBe("45m");
  }, 20_000);
});

describe("ServiceDesk", () => {
  it("leads with the KPIs, lists the queue most urgent first, and filters to mine", async () => {
    const user = userEvent.setup();
    api.queue.mockResolvedValue({
      tickets: [ticket({ id: "t2", number: "TKT-0008", title: "Printer jammed", priority: "low", category: "it", item: "IT support", breached: false, slaDueAt: "2026-10-07T09:00:00", assignee: null, assigneeId: null }), ticket()],
      summary: { open: 2, breached: 1, unassigned: 1, resolvedThisWeek: 5, satisfaction: 4.6, slaMet: 91.5, byCategory: { facilities: 1, it: 1 } },
      categories: { facilities: "Facilities", it: "IT" },
    });
    render(<ServiceDesk />);
    expect(await screen.findByText("SLA breached")).toBeInTheDocument();
    expect(screen.getByText("91.5%")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "The service desk queue" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("AC not cooling in the board room");
    expect(rows[0]).toHaveTextContent("Breached 1h ago");
    expect(rows[1]).toHaveTextContent("Unassigned");
    expect(rows[1]).toHaveTextContent("24h left");
    await user.click(screen.getByRole("radio", { name: "Assigned to me" }));
    expect(api.queue).toHaveBeenLastCalledWith({ status: "open", mine: true });
    await user.click(screen.getByRole("radio", { name: /^IT/ }));
    expect(within(table).getAllByRole("row")).toHaveLength(2);
  }, 20_000);
});

describe("ServiceDesk CSV", () => {
  it("downloads the tickets as listed, after the search", async () => {
    const user = userEvent.setup();
    csv.mockReset();
    api.queue.mockResolvedValue({
      tickets: [ticket({ id: "t2", number: "TKT-0008", title: "Printer jammed", priority: "low", category: "it", item: "IT support", assignee: null, assigneeId: null }), ticket()],
      summary: { open: 2, breached: 1, unassigned: 1, resolvedThisWeek: 5, satisfaction: 4.6, slaMet: 91.5, byCategory: { facilities: 1, it: 1 } },
      categories: { facilities: "Facilities", it: "IT" },
    });
    render(<ServiceDesk />);
    await screen.findByRole("table", { name: "The service desk queue" });
    await user.type(screen.getByPlaceholderText("Search tickets, people or numbers"), "printer");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(csv).toHaveBeenCalledTimes(1);
    const [name, rows] = csv.mock.calls[0];
    expect(name).toBe("service-desk_open.csv");
    expect(rows[0]).toEqual(["Number", "Title", "Item", "Category", "Priority", "Status", "Asked by", "With", "Raised at", "SLA due at", "Past SLA", "Resolved at", "Rating"]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(expect.arrayContaining(["TKT-0008", "Printer jammed", "IT", "Low", "Unassigned"]));
  }, 20_000);
});

describe("TicketDetail", () => {
  it("marks internal notes for the desk only, and sends a note as internal", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.comment.mockResolvedValue(full());
    render(<TicketDetail id="t1" />);
    expect(await screen.findByText("Internal note · only the desk sees this")).toBeInTheDocument();
    expect(screen.getByText("Which room")).toBeInTheDocument();
    expect(screen.getByText("Board room")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Internal note" }));
    await user.type(screen.getByRole("textbox", { name: "Internal note" }), "Chasing the vendor");
    await user.click(screen.getByRole("button", { name: "Add the note" }));
    expect(api.comment).toHaveBeenCalledWith("t1", "Chasing the vendor", true);
  }, 20_000);

  it("raises a work order at the ticket's site and links it", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.raiseWorkOrder.mockResolvedValue({ id: "w1" });
    api.linkable.mockResolvedValue([]);
    render(<TicketDetail id="t1" />);
    await screen.findByRole("button", { name: "Raise a work order" });
    api.get.mockResolvedValue(full({ linked: { type: "work_order", id: "w1", reference: "WO-0031", status: "open", url: "/suite/operations/maintenance/w1" }, linkedType: "work_order", linkedId: "w1" }));
    await user.click(await screen.findByRole("button", { name: "Raise a work order" }));
    await user.click(await screen.findByRole("button", { name: "Raise the work order" }));
    expect(api.raiseWorkOrder).toHaveBeenCalledWith({ assetId: null, facilityId: "f1", title: "AC not cooling in the board room", fault: "It blows warm air since Monday.", priority: "high", ticketId: "t1" });
    expect(await screen.findByRole("link", { name: /WO-0031/ })).toHaveAttribute("href", "/suite/operations/maintenance/w1");
  }, 20_000);

  it("finds the record it became by search, related ones first", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.linkable.mockResolvedValue([
      { id: "w9", reference: "MPT/WO/2026/0031", title: "AC in the board room", status: "open", date: "2026-10-05T09:00:00+01:00", person: "Ada Obi", related: true },
      { id: "w2", reference: "MPT/WO/2026/0012", title: "Library lights", status: "completed", date: "2026-09-01T09:00:00+01:00", person: null, related: false },
    ]);
    api.link.mockResolvedValue(full({ linked: { type: "work_order", id: "w9", reference: "MPT/WO/2026/0031", status: "open", url: "/suite/operations/maintenance/w9" }, linkedType: "work_order", linkedId: "w9" }));
    render(<TicketDetail id="t1" />);
    await waitFor(() => expect(api.linkable).toHaveBeenCalledWith("t1", "work_order"));
    await user.click(screen.getByRole("combobox", { name: "The record" }));
    await user.click(await screen.findByRole("option", { name: /0031/ }));
    await user.click(screen.getByRole("button", { name: "Link the record" }));
    expect(api.link).toHaveBeenCalledWith("t1", "work_order", "w9");
    expect(await screen.findByRole("link", { name: /0031/ })).toHaveAttribute("href", "/suite/operations/maintenance/w9");
  }, 20_000);

  it("asks before cancelling a ticket", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(full());
    api.status.mockResolvedValue(full({ status: "cancelled" }));
    render(<TicketDetail id="t1" />);
    await user.click(await screen.findByRole("button", { name: "Cancel ticket" }));
    expect(api.status).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Cancel the ticket" }));
    expect(api.status).toHaveBeenCalledWith("t1", "cancelled");
  }, 20_000);
});

describe("CatalogueEditor", () => {
  it("builds a form field by field and saves it with keys made from the labels", async () => {
    const user = userEvent.setup();
    api.catalogue.mockResolvedValue({ items: [], categories: { meetings: "Meetings", it: "IT" }, routes: { ticket: "Handled as a ticket" } });
    api.createItem.mockResolvedValue({ id: "i9" });
    render(<CatalogueEditor />);
    await user.click(await screen.findByRole("button", { name: "Add a request" }));
    const dialog = screen.getByRole("dialog", { name: "Add a request" });
    await user.type(within(dialog).getByLabelText("Name"), "Projector for a meeting");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Category" }), "Meetings");
    await user.click(within(dialog).getByRole("button", { name: "Add a question" }));
    await user.type(within(dialog).getByLabelText("Question"), "Which room");
    await user.click(within(dialog).getByRole("button", { name: "Add a question" }));
    const questions = within(dialog).getAllByLabelText("Question");
    await user.type(questions[1], "Projector type");
    await chooseOption(user, within(dialog).getAllByRole("combobox", { name: "Answer" })[1], "Pick from a list");
    await user.click(within(dialog).getByRole("button", { name: "Add to the catalogue" }));
    expect(within(dialog).getByText("Give at least two choices.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Choices/), "HDMI{enter}Wireless");
    await user.click(within(dialog).getByRole("switch", { name: "Which room must be answered" }));
    await user.click(within(dialog).getByRole("button", { name: "Add to the catalogue" }));
    expect(api.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Projector for a meeting",
        category: "meetings",
        routesTo: "ticket",
        fields: [
          { key: "which_room", label: "Which room", type: "text", required: true },
          { key: "projector_type", label: "Projector type", type: "select", required: false, options: ["HDMI", "Wireless"] },
        ],
      }),
    );
  }, 20_000);
});
