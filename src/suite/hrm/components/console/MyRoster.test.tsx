import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyRoster from "./MyRoster";
import { comboboxValue, openCombobox } from "@/test/selectOption";
import type {
  AttendanceTotals,
  RosterAssignment,
  ShiftSwapRequest,
} from "@/lib/api/hrm-client";

/**
 * My shifts, and the two-step that changes them.
 *
 * The behaviour worth pinning is the split between agreeing and approving. A
 * colleague agreeing to take a shift does not move the roster — a manager still
 * has to sign it off — and a screen that offers an "agree" button once the
 * request has already moved on is promising something the API will refuse.
 *
 * The other is that an overnight shift has to read as overnight. Without the
 * marker, 22:00 – 06:00 looks like a shift that goes backwards.
 */

const { roster, swaps, attendance, respondToSwap, cancelSwap, requestSwap, colleagues, list } =
  vi.hoisted(() => ({
    roster: vi.fn(),
    swaps: vi.fn(),
    attendance: vi.fn(),
    respondToSwap: vi.fn(),
    cancelSwap: vi.fn(),
    requestSwap: vi.fn(),
    colleagues: vi.fn(),
    list: vi.fn(),
  }));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/me",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      me: { roster, swaps, attendance, respondToSwap, cancelSwap, requestSwap, colleagues },
      // The manager-only directory. My rota must never need it.
      employees: { list },
    },
  };
});

const DAY_SHIFT: RosterAssignment = {
  id: "ra-1",
  employeeId: "emp-1",
  shiftPatternId: "sp-1",
  worksOn: "2026-09-28",
  startsAt: "09:00",
  endsAt: "17:00",
  crossesMidnight: false,
  expectedMinutes: 420,
  expectedHours: 7,
  location: "Lagos",
  note: null,
  isPublished: true,
  publishedAt: "2026-09-23T09:00:00+00:00",
  shift: { id: "sp-1", name: "Day shift", code: "DAY", colour: null },
};

const NIGHT_SHIFT: RosterAssignment = {
  ...DAY_SHIFT,
  id: "ra-2",
  worksOn: "2026-09-29",
  startsAt: "22:00",
  endsAt: "06:00",
  crossesMidnight: true,
  expectedMinutes: 450,
  expectedHours: 7.5,
  shift: { id: "sp-2", name: "Night shift", code: "NIGHT", colour: null },
};

const TOTALS: AttendanceTotals = {
  days: 10,
  counts: {
    worked: 8,
    late: 1,
    on_leave: 1,
    holiday: 0,
    absent: 0,
    scheduled: 0,
    open: 0,
  },
  expectedMinutes: 4200,
  workedMinutes: 4260,
  varianceMinutes: 60,
  lateMinutes: 25,
  lateDays: 1,
  unexplainedDays: 0,
  attendanceRate: 100,
  overtime: [],
};

/** Somebody has asked me to take their shift. It is my answer that is wanted. */
const ASKING_ME: ShiftSwapRequest = {
  id: "sw-1",
  requestedById: "emp-2",
  requestedToId: "emp-1",
  myRole: "colleague",
  involvesMe: true,
  status: "pending",
  statusLabel: "Awaiting your colleague",
  isOpen: true,
  awaitsColleague: true,
  awaitsApproval: false,
  isGiveaway: true,
  isFulfillable: true,
  reason: "A wedding.",
  respondedAt: null,
  responseNote: null,
  decidedAt: null,
  decisionNote: null,
  requestedBy: { id: "emp-2", name: "Grace Hopper" },
  requestedTo: { id: "emp-1", name: "Ada Lovelace" },
  offered: DAY_SHIFT,
  wanted: null,
  requestedAt: "2026-09-23T09:00:00+00:00",
};

beforeEach(() => {
  vi.clearAllMocks();

  roster.mockResolvedValue({
    data: [DAY_SHIFT, NIGHT_SHIFT],
    meta: { from: "2026-09-28", to: "2026-10-11", expectedMinutes: 870 },
  });
  swaps.mockResolvedValue({ data: [], meta: { awaitingMe: 0 } });
  attendance.mockResolvedValue({ days: [], totals: TOTALS });
  respondToSwap.mockResolvedValue(ASKING_ME);
  cancelSwap.mockResolvedValue(ASKING_ME);
  requestSwap.mockResolvedValue(ASKING_ME);
  colleagues.mockResolvedValue([
    { id: "emp-1", name: "Ada Lovelace", jobTitle: "Analyst" },
    { id: "emp-2", name: "Grace Hopper", jobTitle: "Engineer" },
  ]);
  list.mockRejectedValue(new Error("Only the HR Manager can do this."));
});

describe("MyRoster", () => {
  it("lists published shifts with their hours", async () => {
    render(<MyRoster />);

    /*
      Asserted against the row's whole text rather than element by element.
      The detail line is assembled from several JSX expressions, so each
      value lands in its own text node and a text query matches none of
      them. "7h" also appears in the night shift's 7h 30m, so an unscoped
      query matches two rows.
    */
    // Scoped to the shifts table: the rota calendar above names the shift too.
    const table = await screen.findByRole("table", { name: "Your shifts" });
    const row = within(table).getByText("Day shift").closest("tr") as HTMLElement;

    expect(row).toHaveTextContent("09:00");
    expect(row).toHaveTextContent("17:00");
    expect(row).toHaveTextContent("7h");
    expect(row).toHaveTextContent("Lagos");
  });

  /*
    Without the marker a night shift reads as going backwards, and the reader
    has to already know which shifts cross midnight to make sense of the list.
  */
  it("marks an overnight shift as ending the next day", async () => {
    render(<MyRoster />);

    expect(await screen.findByText(/22:00 to 06:00 \+1/)).toBeInTheDocument();
    expect(screen.getByText("Overnight")).toBeInTheDocument();
  });

  /*
    A draft roster is half-built. The API filters them out, and the empty state
    has to explain that silence rather than implying nobody is working.
  */
  it("explains an empty rota rather than implying there is no work", async () => {
    roster.mockResolvedValue({
      data: [],
      meta: { from: "2026-09-28", to: "2026-10-11", expectedMinutes: 0 },
    });

    render(<MyRoster />);

    expect(await screen.findByText("No shifts published")).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing here means nothing final yet/),
    ).toBeInTheDocument();
  });

  describe("swaps", () => {
    it("offers agree and decline only while the answer is mine to give", async () => {
      swaps.mockResolvedValue({ data: [ASKING_ME], meta: { awaitingMe: 1 } });

      render(<MyRoster />);

      expect(
        await screen.findByRole("button", { name: "Agree" }),
      ).toBeInTheDocument();
      // A labelled button, not an icon whose only name is an aria-label.
      expect(screen.getByRole("button", { name: "Decline" })).toHaveTextContent("Decline");
      // Withdrawing is the requester's, never the colleague's.
      expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
    });

    it("gives the requester Withdraw, and no answer buttons", async () => {
      swaps.mockResolvedValue({
        data: [{ ...ASKING_ME, myRole: "requester", requestedBy: { id: "emp-1", name: "Ada Lovelace" }, requestedTo: { id: "emp-2", name: "Grace Hopper" } }],
        meta: { awaitingMe: 0 },
      });

      render(<MyRoster />);

      expect(await screen.findByRole("button", { name: "Withdraw" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Agree" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
      expect(screen.getAllByText(/You asked Grace Hopper to take/).length).toBeGreaterThan(0);
    });

    /*
      The two-step. Once the colleague has agreed it belongs to a manager, and
      showing the agree button again would promise something the API refuses.
    */
    it("withdraws the agree button once it is with the manager", async () => {
      swaps.mockResolvedValue({
        data: [
          {
            ...ASKING_ME,
            status: "accepted",
            statusLabel: "Awaiting approval",
            awaitsColleague: false,
            awaitsApproval: true,
          },
        ],
        meta: { awaitingMe: 0 },
      });

      render(<MyRoster />);

      expect(await screen.findByText("Awaiting approval")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Agree" }),
      ).not.toBeInTheDocument();
      // I agreed as the colleague: the request is not mine to withdraw.
      expect(
        screen.queryByRole("button", { name: "Withdraw" }),
      ).not.toBeInTheDocument();
    });

    /*
      "Attendance, last fortnight" means the fourteen days up to today — the
      window HR's dossier uses — not this week and next.
    */
    it("reads attendance for the fortnight just gone", async () => {
      render(<MyRoster />);

      await waitFor(() => expect(attendance).toHaveBeenCalled());

      const params = attendance.mock.calls[0][0] as { from: string; days: number };
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const expected = new Date(`${today}T00:00:00Z`);
      expected.setUTCDate(expected.getUTCDate() - 13);

      expect(params).toEqual({ from: expected.toISOString().slice(0, 10), days: 13 });
    });

    it("sends my answer and reloads", async () => {
      swaps.mockResolvedValue({ data: [ASKING_ME], meta: { awaitingMe: 1 } });

      const user = userEvent.setup();
      render(<MyRoster />);

      await user.click(await screen.findByRole("button", { name: "Agree" }));

      await waitFor(() =>
        expect(respondToSwap).toHaveBeenCalledWith("sw-1", true),
      );

      expect(roster).toHaveBeenCalledTimes(2);
    });

    it("counts what is waiting on me", async () => {
      swaps.mockResolvedValue({ data: [ASKING_ME], meta: { awaitingMe: 1 } });

      render(<MyRoster />);

      const tile = await screen.findByText("Swaps needing your answer");
      const card = tile.closest("div")?.parentElement as HTMLElement;

      expect(within(card).getByText("1")).toBeInTheDocument();
    });

    /*
      The dialog says the two-step out loud. Somebody asking a colleague to
      cover should not believe the shift has moved the moment they press Ask.
    */
    it("says that agreeing is not the end of it", async () => {
      const user = userEvent.setup();
      render(<MyRoster />);

      await user.click(
        (await screen.findAllByRole("button", { name: "Ask to swap" }))[0],
      );

      const dialog = await screen.findByRole("dialog", { name: "Ask to swap" });

      expect(
        within(dialog).getByText(/Nothing changes on the rota until both have/),
      ).toBeInTheDocument();
    });

    it("offers the shift to a colleague, never to myself", async () => {
      const user = userEvent.setup();
      render(<MyRoster />);

      await user.click(
        (await screen.findAllByRole("button", { name: "Ask to swap" }))[0],
      );

      const dialog = await screen.findByRole("dialog", { name: "Ask to swap" });

      await waitFor(() =>
        expect(comboboxValue(within(dialog).getByRole("combobox"))).toBe("emp-2"),
      );

      // From the employee-facing list; the HR directory refuses employees.
      expect(colleagues).toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();

      // Ada owns the shift, so she is not in the list of people to hand it to.
      const listbox = await openCombobox(user, within(dialog).getByRole("combobox"));
      expect(
        within(listbox).queryByRole("option", { name: "Ada Lovelace" }),
      ).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Ask" }));

      await waitFor(() =>
        expect(requestSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            offeredAssignmentId: "ra-1",
            requestedToId: "emp-2",
          }),
        ),
      );
    });
  });
});
