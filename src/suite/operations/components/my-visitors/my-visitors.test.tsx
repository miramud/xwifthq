import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Visitor } from "@/lib/api/operations-facilities-client";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { notificationVisual } from "@/components/shared/NotificationBell";
import MyVisitors, { groupVisits } from "./MyVisitors";
import VisitorsDesk from "../facilities/VisitorsDesk";
import { checkVisitor, draftFromVisitor, visitorInput, type VisitorDraft } from "../facilities/VisitorForm";
import { localIso } from "../facilities/labels";

/** Hosts pre-register their visitors; reception sees them expected, checks them in or cancels. */

const api = vi.hoisted(() => ({
  myList: vi.fn(),
  myRegister: vi.fn(),
  myCancel: vi.fn(),
  myUpdate: vi.fn(),
  updateVisitor: vi.fn(),
  visitors: vi.fn(),
  list: vi.fn(),
  cancelVisitor: vi.fn(),
  options: vi.fn(),
  permissions: [] as string[],
}));

vi.mock("@/lib/api/operations-facilities-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/operations-facilities-client")>();
  return {
    ...actual,
    myVisitors: { list: api.myList, register: api.myRegister, cancel: api.myCancel, update: api.myUpdate },
    facilities: { ...actual.facilities, visitors: api.visitors, list: api.list, cancelVisitor: api.cancelVisitor, updateVisitor: api.updateVisitor, options: api.options },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-host", role: "user", name: "Ada Okafor", organisationId: "o", permissions: api.permissions }, loading: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/suite/operations/my/visitors", useSearchParams: () => new URLSearchParams() }));

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const today = todayYmd();

const visit = (over: Partial<Visitor> = {}): Visitor => ({
  id: "v1",
  name: "Tunde Bello",
  company: "Zenith Bank",
  phone: null,
  purpose: "Quarterly review",
  host: "Ada Okafor",
  hostId: "u-host",
  facilityId: "f1",
  site: "Main campus",
  expectedAt: localIso(today, "14:00"),
  expectedUntil: localIso(today, "16:00"),
  checkedInAt: null,
  checkedOutAt: null,
  badgeNo: null,
  partySize: 3,
  vehiclePlate: "LND 123 AB",
  preRegistered: true,
  status: "expected",
  ...over,
});

const draft = (over: Partial<VisitorDraft> = {}): VisitorDraft => ({
  name: "Tunde Bello",
  company: "",
  phone: "",
  email: "",
  purpose: "",
  site: "",
  day: today,
  from: "10:00",
  until: "",
  party: "1",
  plate: "",
  notes: "",
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === "function" && f.mockReset());
  api.permissions = [];
  api.list.mockResolvedValue({ facilities: [] });
  api.options.mockResolvedValue({ staff: [] });
});

describe("groupVisits", () => {
  it("puts today's and anyone still in the building under today, the rest by day", () => {
    const g = groupVisits(
      [
        visit({ id: "later", expectedAt: localIso(shift(3), "09:00"), expectedUntil: null }),
        visit({ id: "soon", expectedAt: localIso(shift(1), "09:00"), expectedUntil: null }),
        visit({ id: "now" }),
        visit({ id: "still-in", expectedAt: localIso(shift(-1), "09:00"), checkedInAt: localIso(shift(-1), "09:10"), status: "on_site" }),
        visit({ id: "old", expectedAt: localIso(shift(-5), "09:00"), status: "left" }),
      ],
      today,
    );
    expect(g.today.map((v) => v.id)).toEqual(["still-in", "now"]);
    expect(g.upcoming.map((v) => v.id)).toEqual(["soon", "later"]);
    expect(g.past.map((v) => v.id)).toEqual(["old"]);
  });
});

describe("the visitor form", () => {
  it("checks a host's visit before sending it", () => {
    expect(checkVisitor(draft({ name: " " }), true)).toHaveProperty("name");
    expect(checkVisitor(draft({ from: "" }), true)).toHaveProperty("expectedAt");
    expect(checkVisitor(draft({ day: shift(-1) }), true).expectedAt).toMatch(/passed/);
    expect(checkVisitor(draft({ until: "09:00" }), true)).toHaveProperty("expectedUntil");
    expect(checkVisitor(draft({ party: "0" }), true)).toHaveProperty("partySize");
    expect(checkVisitor(draft(), true)).toEqual({});
    // Reception may register a walk-in with no time.
    expect(checkVisitor(draft({ from: "" }), false)).toEqual({});
  });

  it("sends blanks as null and the window on the visit's day", () => {
    const input = visitorInput(draft({ until: "12:00", party: "4", plate: "lnd 1" }));
    expect(input).toMatchObject({ name: "Tunde Bello", company: null, email: null, partySize: 4, vehiclePlate: "lnd 1" });
    expect(input.expectedAt).toBe(localIso(today, "10:00"));
    expect(input.expectedUntil).toBe(localIso(today, "12:00"));
    expect(input).not.toHaveProperty("hostId");
  });

  it("reads an existing visit back into the form", () => {
    const d = draftFromVisitor(visit({ email: "t@zenith.example", notes: "Parking" }));
    expect(d).toMatchObject({ name: "Tunde Bello", company: "Zenith Bank", site: "f1", day: today, from: "14:00", until: "16:00", party: "3", plate: "LND 123 AB", email: "t@zenith.example", notes: "Parking" });
    expect(visitorInput(d).expectedAt).toBe(localIso(today, "14:00"));
  });
});

describe("My visitors", () => {
  const renderPage = () =>
    render(
      <ConfirmProvider>
        <MyVisitors />
      </ConfirmProvider>,
    );

  it("lists today's visitors with the window, party and car", async () => {
    api.myList.mockResolvedValue({ visitors: [visit(), visit({ id: "v2", name: "Later Guest", expectedAt: localIso(shift(2), "11:00"), expectedUntil: null })], sites: [] });
    renderPage();
    const row = (await screen.findByText("Tunde Bello")).closest("li")!;
    expect(within(row).getByText("14:00 to 16:00")).toBeInTheDocument();
    expect(within(row).getByText("3 people")).toBeInTheDocument();
    expect(within(row).getByText("LND 123 AB")).toBeInTheDocument();
    expect(within(row).getByText("Expected")).toBeInTheDocument();
    expect(screen.queryByText("Later Guest")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: /Upcoming/ }));
    expect(screen.getByText("Later Guest")).toBeInTheDocument();
  });

  it("registers a visitor as the host, never naming one", async () => {
    const user = userEvent.setup();
    api.myList.mockResolvedValue({ visitors: [], sites: [{ id: "f1", name: "Main campus" }] });
    api.myRegister.mockResolvedValue(visit({ id: "new", name: "Ifeoma Nwosu" }));
    renderPage();
    expect(await screen.findByText("Nobody is coming to see you today")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Register a visitor" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Host/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Register my visitor" }));
    expect(within(dialog).getByText("Enter the visitor's name.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Visitor's name"), "Ifeoma Nwosu");
    await user.clear(within(dialog).getByLabelText("People in the party"));
    await user.type(within(dialog).getByLabelText("People in the party"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Register my visitor" }));

    expect(api.myRegister).toHaveBeenCalledWith(expect.objectContaining({ name: "Ifeoma Nwosu", partySize: 2, facilityId: "f1", expectedAt: localIso(today, "10:00") }));
    expect(api.myRegister.mock.calls[0][0]).not.toHaveProperty("hostId");
    expect(await screen.findByRole("status")).toHaveTextContent(/Ifeoma Nwosu is registered/);
  });

  it("changes an expected visit in the same form, pre-filled", async () => {
    const user = userEvent.setup();
    api.myList.mockResolvedValue({ visitors: [visit()], sites: [{ id: "f1", name: "Main campus" }] });
    api.myUpdate.mockResolvedValue(visit({ partySize: 5, expectedAt: localIso(shift(1), "14:00"), expectedUntil: null }));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit Tunde Bello's visit" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Change Tunde Bello's visit")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Host/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Visitor's name")).toHaveValue("Tunde Bello");
    expect(within(dialog).getByLabelText("From")).toHaveValue("14:00");

    await user.clear(within(dialog).getByLabelText("People in the party"));
    await user.type(within(dialog).getByLabelText("People in the party"), "5");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(api.myUpdate).toHaveBeenCalledWith("v1", expect.objectContaining({ name: "Tunde Bello", partySize: 5, facilityId: "f1", expectedAt: localIso(today, "14:00") }));
    expect(api.myUpdate.mock.calls[0][1]).not.toHaveProperty("hostId");
    expect(await screen.findByRole("status")).toHaveTextContent(/Tunde Bello's visit is updated/);
    // Moved to tomorrow: it now sits under Upcoming.
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the API's refusal once they have arrived", async () => {
    const user = userEvent.setup();
    api.myList.mockResolvedValue({ visitors: [visit()], sites: [] });
    api.myUpdate.mockRejectedValue(new ApiError("They have already arrived; the visit can no longer change.", 422, { visitor: ["They have already arrived; the visit can no longer change."] }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Tunde Bello's visit" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" }));
    expect(await within(screen.getByRole("dialog")).findByText(/already arrived/)).toBeInTheDocument();
  });

  it("offers no edit once a visit is over", async () => {
    api.myList.mockResolvedValue({ visitors: [visit({ status: "left", checkedInAt: localIso(today, "14:05"), checkedOutAt: localIso(today, "15:00") })], sites: [] });
    renderPage();
    await screen.findByText("Tunde Bello");
    expect(screen.queryByRole("button", { name: "Edit Tunde Bello's visit" })).not.toBeInTheDocument();
  });

  it("cancels an expected visit after confirming", async () => {
    const user = userEvent.setup();
    api.myList.mockResolvedValue({ visitors: [visit()], sites: [] });
    api.myCancel.mockResolvedValue(visit({ status: "cancelled", cancelledAt: new Date().toISOString() }));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Cancel Tunde Bello's visit" }));
    expect(api.myCancel).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Cancel the visit" }));
    expect(api.myCancel).toHaveBeenCalledWith("v1");
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Tunde Bello's visit" })).not.toBeInTheDocument();
  });
});

describe("reception's desk", () => {
  it("marks a host's pre-registration and cancels it with the key", async () => {
    const user = userEvent.setup();
    api.permissions = ["admin.facilities.view", "admin.facilities.check_in", "admin.facilities.cancel_visitor"];
    api.visitors.mockResolvedValue([visit()]);
    api.cancelVisitor.mockResolvedValue(visit({ status: "cancelled" }));
    render(
      <ConfirmProvider>
        <VisitorsDesk />
      </ConfirmProvider>,
    );
    const card = (await screen.findByRole("button", { name: /Open the visit details: Tunde Bello/ })).closest("li")!;
    expect(within(card).getByText("Pre-registered by host")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Check in" })).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Cancel Tunde Bello's visit" }));
    await user.click(await screen.findByRole("button", { name: "Cancel the visit" }));
    expect(api.cancelVisitor).toHaveBeenCalledWith("v1");
    expect(await screen.findByRole("status")).toHaveTextContent("Tunde Bello's visit is cancelled.");
  });

  it("changes an expected visit with the key, keeping the host", async () => {
    const user = userEvent.setup();
    api.permissions = ["admin.facilities.view", "admin.facilities.update_visitor"];
    api.options.mockResolvedValue({ staff: [{ id: "u-host", name: "Ada Okafor" }, { id: "u-2", name: "Bayo Ade" }] });
    api.visitors.mockResolvedValue([visit()]);
    api.updateVisitor.mockResolvedValue(visit({ partySize: 4 }));
    render(
      <ConfirmProvider>
        <VisitorsDesk />
      </ConfirmProvider>,
    );
    const card = (await screen.findByRole("button", { name: /Open the visit details: Tunde Bello/ })).closest("li")!;
    expect(within(card).queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Edit Tunde Bello's visit" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/Host/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("People in the party"));
    await user.type(within(dialog).getByLabelText("People in the party"), "4");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(api.updateVisitor).toHaveBeenCalledWith("v1", expect.objectContaining({ hostId: "u-host", partySize: 4 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Tunde Bello's visit is updated.");
  });

  it("offers no cancel without the key", async () => {
    api.permissions = ["admin.facilities.view", "admin.facilities.check_in"];
    api.visitors.mockResolvedValue([visit()]);
    render(<VisitorsDesk />);
    await screen.findByText("Pre-registered by host");
    expect(screen.queryByRole("button", { name: "Cancel Tunde Bello's visit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Tunde Bello's visit" })).not.toBeInTheDocument();
  });
});

describe("the bell", () => {
  it("has its own icon for visitor notices", () => {
    const visual = notificationVisual("operations.visitors");
    expect(visual.tone).toBe("bg-grape-50 text-grape-700");
    expect(notificationVisual("operations.unknown").tone).not.toBe(visual.tone);
  });
});
