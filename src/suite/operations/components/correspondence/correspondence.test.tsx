import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import type { Letter, LetterFull, Register, RegisterOptions } from "@/lib/api/operations-correspondence-client";
import CorrespondenceRegister from "./CorrespondenceRegister";
import CorrespondenceDetail from "./CorrespondenceDetail";
import MyCorrespondence from "../my-correspondence/MyCorrespondence";
import MyCorrespondenceDetail from "../my-correspondence/MyCorrespondenceDetail";
import { dueText, letterRows } from "./labels";

/** The correspondence register: the desk list, a letter worked through, and the officer's own letters. */

const api = vi.hoisted(() => ({
  list: vi.fn(),
  options: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  assign: vi.fn(),
  dispatch: vi.fn(),
  myList: vi.fn(),
  myGet: vi.fn(),
  acknowledge: vi.fn(),
  forward: vi.fn(),
  colleagues: vi.fn(),
  push: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-correspondence-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-correspondence-client")>();
  return {
    ...actual,
    correspondence: { ...actual.correspondence, list: api.list, options: api.options, get: api.get, create: api.create, assign: api.assign, dispatch: api.dispatch },
    myCorrespondence: { ...actual.myCorrespondence, list: api.myList, get: api.myGet, acknowledge: api.acknowledge, forward: api.forward, colleagues: api.colleagues },
  };
});
const csv = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/csv", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/components/workspace/csv")>()), downloadCsv: csv }));
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-reg", role: "user", name: "Grace Udo", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }), usePathname: () => "/suite/operations/correspondence", useSearchParams: () => new URLSearchParams() }));

const letter = (over: Partial<Letter> = {}): Letter => ({
  id: "c1",
  direction: "incoming",
  reference: "MP/IN/2026/0001",
  status: "assigned",
  subject: "Accreditation visit: documents required",
  confidentiality: "normal",
  counterpartyId: "cp1",
  party: "NBTE",
  partyOrganisation: null,
  partyReference: "NBTE/ACC/2026/118",
  channel: "courier",
  letterDate: null,
  receivedOn: "2026-10-05",
  sentOn: null,
  date: "2026-10-05",
  addressee: "The Rector",
  orgUnitId: null,
  unit: null,
  project: null,
  projectId: null,
  assigneeId: "u-off",
  assignee: "Ada Okafor",
  assignedUnitId: null,
  assignedUnit: null,
  dueOn: "2026-10-01",
  overdue: true,
  signatoryId: null,
  signatory: null,
  trackingRef: null,
  inReplyToId: null,
  createdAt: "2026-10-05T09:00:00+01:00",
  ...over,
});

const full = (over: Partial<LetterFull> = {}): LetterFull => ({
  ...letter(),
  summary: "Pre-visit on 6 October.",
  registeredBy: "Grace Udo",
  assignedBy: "Grace Udo",
  assignedAt: "2026-10-05T09:00:00+01:00",
  acknowledgedAt: null,
  respondedAt: null,
  deliveredAt: null,
  receiptAcknowledgedAt: null,
  closedAt: null,
  closeNote: null,
  approvalId: null,
  inReplyTo: null,
  replies: [],
  files: [],
  actions: [{ id: "a1", action: "assigned", by: "Grace Udo", byId: "u-reg", from: null, to: "Ada Okafor", note: "Prepare the list.", at: "2026-10-05T09:00:00+01:00" }],
  ...over,
});

const options: RegisterOptions = {
  staff: [
    { id: "u-off", name: "Ada Okafor", unitId: null },
    { id: "u-col", name: "Musa Garba", unitId: null },
  ],
  units: [{ id: "un1", name: "Academic planning", code: "ACAD" }],
  parties: [{ id: "cp1", name: "NBTE", code: null }],
  projects: [],
  channels: { hand: "By hand", post: "Post", courier: "Courier", email: "Email" },
};

const register = (letters: Letter[]): Register => ({
  letters,
  summary: { open: 2, overdue: 1, unassigned: 1, awaitingClosure: 0, receivedThisMonth: 4, inApproval: 1, toDispatch: 1, sentThisMonth: 2 },
  registry: true,
});

beforeEach(() => {
  api.permissions = ["admin.correspondence.view", "admin.correspondence.create", "admin.correspondence.assign", "admin.correspondence.dispatch", "admin.correspondence.comment", "admin.correspondence.file"];
  api.options.mockResolvedValue(options);
});
afterEach(() => {
  vi.clearAllMocks();
  document.querySelectorAll("[data-confirm-host]").forEach((n) => n.remove());
});

describe("labels", () => {
  it("says how long is left or how late, only while a letter received waits", () => {
    const now = new Date(2026, 9, 7);
    expect(dueText({ direction: "incoming", status: "assigned", dueOn: "2026-10-05" }, now)).toBe("2 days late");
    expect(dueText({ direction: "incoming", status: "in_progress", dueOn: "2026-10-07" }, now)).toBe("Due today");
    expect(dueText({ direction: "incoming", status: "received", dueOn: "2026-10-08" }, now)).toBe("Due in 1 day");
    expect(dueText({ direction: "incoming", status: "closed", dueOn: "2026-10-05" }, now)).toBe("");
    expect(dueText({ direction: "outgoing", status: "draft", dueOn: "2026-10-05" }, now)).toBe("");
  });

  it("exports the register with a header and one row a letter", () => {
    const rows = letterRows([letter(), letter({ id: "c2", direction: "outgoing", reference: null, status: "draft", overdue: false })]);
    expect(rows[0][0]).toBe("Reference");
    expect(rows[1]).toEqual(expect.arrayContaining(["MP/IN/2026/0001", "In", "NBTE", "Yes", "With officer"]));
    expect(rows[2][0]).toBe("Draft");
    expect(rows[2][1]).toBe("Out");
  });
});

describe("the register", () => {
  it("shows what is waiting and overdue, filters on the server and downloads the rows", async () => {
    api.list.mockResolvedValue(register([letter(), letter({ id: "c2", reference: "MP/OUT/2026/0001", direction: "outgoing", status: "approved", subject: "Re: Accreditation", overdue: false, dueOn: null })]));
    const user = userEvent.setup();
    render(<CorrespondenceRegister />);

    expect(await screen.findByText("Accreditation visit: documents required")).toBeInTheDocument();
    expect(screen.getAllByText(/days? late/).length).toBeGreaterThan(0);
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: "open", overdue: false }));

    await user.click(screen.getByRole("radio", { name: "Overdue only" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ overdue: true })));

    await user.click(screen.getByRole("button", { name: /download csv/i }));
    expect(csv).toHaveBeenCalledWith(expect.stringMatching(/^correspondence_.*_overdue\.csv$/), expect.arrayContaining([expect.arrayContaining(["Reference"])]));
  });

  it("hides logging a letter from those who may only read", async () => {
    api.permissions = ["admin.correspondence.view"];
    api.list.mockResolvedValue(register([letter()]));
    render(<CorrespondenceRegister />);
    await screen.findByText("Accreditation visit: documents required");
    expect(screen.queryByRole("button", { name: "Log a letter received" })).not.toBeInTheDocument();
  });

  it("will not log a letter without its subject, sender and channel", async () => {
    api.list.mockResolvedValue(register([]));
    const user = userEvent.setup();
    render(<CorrespondenceRegister />);
    await user.click(await screen.findByRole("button", { name: "Log a letter received" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Log the letter" }));
    expect(within(dialog).getByText("Give the subject of the letter.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose who sent it, or type their name.")).toBeInTheDocument();
    expect(within(dialog).getByText("Say how it came.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Subject"), "Invitation to a forum");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Client, vendor or agency" }), "NBTE");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "How it came" }), "Email");
    api.create.mockResolvedValue(full({ id: "c9" }));
    await user.click(within(dialog).getByRole("button", { name: "Log the letter" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ direction: "incoming", subject: "Invitation to a forum", counterpartyId: "cp1", channel: "email", confidentiality: "normal" })));
    expect(api.push).toHaveBeenCalledWith("/suite/operations/correspondence/c9");
  });
});

describe("a letter on the desk", () => {
  it("routes a letter received to a unit, whose head gets it", async () => {
    api.get.mockResolvedValue(full());
    api.assign.mockResolvedValue(full({ assignee: "Musa Garba", assignedUnit: "Academic planning" }));
    const user = userEvent.setup();
    render(<CorrespondenceDetail id="c1" />);
    expect(await screen.findByText("Prepare the list.")).toBeInTheDocument();
    await chooseOption(user, screen.getByRole("combobox", { name: /or a unit/i }), "Academic planning");
    await user.click(screen.getByRole("button", { name: "Re-route" }));
    await waitFor(() => expect(api.assign).toHaveBeenCalledWith("c1", expect.objectContaining({ assigneeId: null, assignedUnitId: "un1" })));
    expect(await screen.findAllByText("Routed. The officer has been told.")).not.toHaveLength(0);
  });

  it("dispatches an approved reply only once its channel is chosen", async () => {
    const reply = full({ id: "c2", direction: "outgoing", reference: "MP/OUT/2026/0001", status: "approved", subject: "Re: Accreditation", overdue: false, dueOn: null, inReplyTo: { id: "c1", direction: "incoming", reference: "MP/IN/2026/0001", subject: "Accreditation", status: "in_progress", sentOn: null, receivedOn: "2026-10-05" }, channel: null });
    api.get.mockResolvedValue(reply);
    api.dispatch.mockResolvedValue({ ...reply, status: "dispatched" });
    const user = userEvent.setup();
    render(<CorrespondenceDetail id="c2" />);
    await user.click(await screen.findByRole("button", { name: "Dispatch it" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/which closes when this goes out/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Dispatch it" }));
    expect(await within(dialog).findAllByText("Say how it went.")).not.toHaveLength(0);
    expect(api.dispatch).not.toHaveBeenCalled();
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "How it went" }), "Courier");
    await user.type(within(dialog).getByLabelText(/tracking reference/i), "GIG-55102");
    await user.click(within(dialog).getByRole("button", { name: "Dispatch it" }));
    await waitFor(() => expect(api.dispatch).toHaveBeenCalledWith("c2", expect.objectContaining({ channel: "courier", trackingRef: "GIG-55102" })));
  });
});

describe("letters for my action", () => {
  it("lists what is waiting on me, the overdue first in sight", async () => {
    api.myList.mockResolvedValue([letter(), letter({ id: "c3", status: "closed", subject: "Answered already", overdue: false })]);
    const user = userEvent.setup();
    render(<MyCorrespondence />);
    expect(await screen.findByText("Accreditation visit: documents required")).toBeInTheDocument();
    expect(screen.queryByText("Answered already")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /answered/i }));
    expect(screen.getByText("Answered already")).toBeInTheDocument();
  });

  it("acknowledges, and will not forward without a minute", async () => {
    api.myGet.mockResolvedValue(full());
    api.acknowledge.mockResolvedValue(full({ status: "in_progress" }));
    api.colleagues.mockResolvedValue([{ id: "u-col", name: "Musa Garba" }]);
    const user = userEvent.setup();
    render(<MyCorrespondenceDetail id="c1" />);
    await user.click(await screen.findByRole("button", { name: "Acknowledge" }));
    expect(api.acknowledge).toHaveBeenCalledWith("c1");
    expect(await screen.findByRole("button", { name: "Mark responded" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Forward" }));
    const dialog = await screen.findByRole("dialog");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "To" }), "Musa Garba");
    await user.click(within(dialog).getByRole("button", { name: "Forward it" }));
    expect(await within(dialog).findAllByText(/write a minute/i)).not.toHaveLength(0);
    expect(api.forward).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Minute"), "You hold the files.");
    api.forward.mockResolvedValue({ id: "c1", forwarded: true });
    await user.click(within(dialog).getByRole("button", { name: "Forward it" }));
    await waitFor(() => expect(api.forward).toHaveBeenCalledWith("c1", expect.objectContaining({ assigneeId: "u-col", note: "You hold the files." })));
    expect(api.push).toHaveBeenCalledWith("/suite/operations/my/correspondence");
  });
});
