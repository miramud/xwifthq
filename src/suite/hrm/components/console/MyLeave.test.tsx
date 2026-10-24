import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyLeave from "./MyLeave";
import { openCombobox } from "@/test/selectOption";
import type {
  LeaveBalance,
  LeaveQuote,
  LeaveRequest,
  LeaveType,
  MyLeave as MyLeaveData,
} from "@/lib/api/hrm-client";

/**
 * Booking your own time off.
 *
 * Two things on this screen are worth pinning down, and neither is layout.
 *
 * The first is that the available figure shown is `remainingDays`, the one
 * that already holds back pending requests. Showing the gross entitlement
 * beside a book button is how somebody books the same fortnight twice.
 *
 * The second is that the cost of a range comes from the server. A week off is
 * not five days for everybody: it depends on the institution's working week
 * and its holiday calendar. A second implementation in the browser would
 * eventually disagree with the one that actually charges the balance, and the
 * person would find out on their payslip.
 */

const {
  leave,
  leaveTypes,
  quoteLeave,
  requestLeave,
  cancelLeave,
  leaveCalendar,
  colleagues,
} = vi.hoisted(() => ({
  leave: vi.fn(),
  leaveTypes: vi.fn(),
  quoteLeave: vi.fn(),
  requestLeave: vi.fn(),
  cancelLeave: vi.fn(),
  leaveCalendar: vi.fn(),
  colleagues: vi.fn(),
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
      me: {
        leave,
        leaveTypes,
        quoteLeave,
        requestLeave,
        cancelLeave,
        leaveCalendar,
        colleagues,
      },
    },
  };
});

const ANNUAL: LeaveType = {
  id: "type-1",
  name: "Annual leave",
  code: "AL",
  description: null,
  colour: null,
  isPaid: true,
  isActive: true,
  accrual: "annual",
  accrualLabel: "Annual",
  hasBalance: true,
  daysPerYear: 20,
  maxCarryOverDays: null,
  carryOverExpiresMonth: null,
  carryOverExpiresDay: null,
  requiresApproval: true,
  minNoticeDays: null,
  maxConsecutiveDays: null,
  allowsHalfDays: true,
  allowsNegativeBalance: false,
  minimumServiceMonths: null,
};

/** Twenty granted, five taken, three awaiting a decision: twelve actually left. */
const BALANCE: LeaveBalance = {
  typeId: "type-1",
  name: "Annual leave",
  code: "AL",
  colour: null,
  isPaid: true,
  tracksBalance: true,
  available: true,
  year: 2026,
  entitledDays: 20,
  accruedDays: 20,
  carriedDays: 0,
  adjustmentDays: 0,
  takenDays: 5,
  pendingDays: 3,
  remainingDays: 12,
  carryOverLapsed: false,
};

const PENDING: LeaveRequest = {
  id: "req-1",
  employeeId: "emp-1",
  leaveTypeId: "type-1",
  leaveTypeName: "Annual leave",
  startsOn: "2026-09-28",
  endsOn: "2026-09-30",
  startPortion: "full",
  endPortion: "full",
  days: 3,
  status: "pending",
  statusLabel: "Pending",
  isOpen: true,
  isGranted: false,
  holdsDays: true,
  reason: null,
  contactWhileAway: null,
  decisionNote: null,
  requestedAt: "2026-09-23T09:00:00+00:00",
};

const QUOTE: LeaveQuote = {
  days: 5,
  calendarDays: 7,
  workingDays: 5,
  holidays: [],
  coverage: { away: 0, team: 4, names: [] },
};

function data(overrides: Partial<MyLeaveData> = {}): MyLeaveData {
  return {
    year: 2026,
    balances: [BALANCE],
    requests: [PENDING],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  leave.mockResolvedValue(data());
  leaveTypes.mockResolvedValue([ANNUAL]);
  quoteLeave.mockResolvedValue(QUOTE);
  requestLeave.mockResolvedValue(PENDING);
  cancelLeave.mockResolvedValue({ ...PENDING, status: "cancelled" });
  colleagues.mockResolvedValue([{ id: "emp-9", name: "Grace Hopper", jobTitle: "Engineer" }]);
  /*
    The "who else is away" card sits above the balances. Its own behaviour is
    covered in SelfServiceExtras; here it only needs to not blow up the page.
  */
  leaveCalendar.mockResolvedValue({
    data: [],
    meta: { from: "2026-09-20", to: "2026-11-19", holidays: [] },
  });
});

describe("MyLeave", () => {
  /*
    The headline number. Twenty granted and five taken would suggest fifteen,
    but three are already spoken for, and it is the twelve that somebody is
    allowed to book against.
  */
  it("shows what is actually left, not the gross entitlement", async () => {
    render(<MyLeave />);

    const tile = await screen.findByText("Annual leave left");
    const card = tile.closest("div")?.parentElement as HTMLElement;

    expect(within(card).getByText("12 days")).toBeInTheDocument();
    expect(within(card).queryByText("20 days")).not.toBeInTheDocument();
  });

  it("says how many days are still awaiting a decision", async () => {
    render(<MyLeave />);

    expect(
      await screen.findByText("3 days awaiting a decision"),
    ).toBeInTheDocument();
  });

  /*
    A balance nobody can reconstruct is a balance people query by email, so
    every part of the sum is on the screen and the parts add up.
  */
  it("breaks the balance into the parts it is made of", async () => {
    render(<MyLeave />);

    // The breakdown is one of several tables on the page now (requests too),
    // so it is found by its caption.
    const table = await screen.findByRole("table", { name: "How that adds up" });
    const row = within(table).getByRole("row", { name: /Annual leave/ });
    const cells = within(row).getAllByRole("cell");

    // Accrued, carried, adjusted, taken, pending, left.
    expect(cells[1]).toHaveTextContent("20");
    expect(cells[4]).toHaveTextContent("5");
    expect(cells[5]).toHaveTextContent("3");
    expect(cells[6]).toHaveTextContent("12");
  });

  it("lists a booked absence with its frozen day count", async () => {
    render(<MyLeave />);

    /*
      Scoped to the request row. "Annual leave" is also the tile label and a
      row in the breakdown table, and "Pending" is also a column heading there
      an unscoped query for either matches more than one thing.
    */
    const row = (
      await screen.findByRole("button", { name: "Withdraw" })
    ).closest("tr, li") as HTMLElement;

    expect(within(row).getByText("Annual leave")).toBeInTheDocument();
    expect(within(row).getByText(/3 days/)).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
  });

  // Typing dates under jsdom is slow on a busy machine; slow is not stuck.
  describe("booking", { timeout: 20_000 }, () => {
    async function openDialog() {
      const user = userEvent.setup();
      render(<MyLeave />);

      await user.click(await screen.findByRole("button", { name: "Book leave" }));
      await screen.findByRole("dialog", { name: "Book leave" });

      return user;
    }

    /*
      The whole reason the quote endpoint exists. Seven calendar days cost five,
      and a screen that showed the seven would be lying to the person about to
      spend them.
    */
    it("quotes the cost from the server rather than counting dates itself", async () => {
      const user = await openDialog();

      await user.type(screen.getByLabelText("First day"), "2026-09-28");
      await user.type(screen.getByLabelText("Last day"), "2026-10-04");

      await waitFor(() =>
        expect(quoteLeave).toHaveBeenCalledWith(
          expect.objectContaining({
            startsOn: "2026-09-28",
            endsOn: "2026-10-04",
          }),
        ),
      );

      expect(await screen.findByText("5 days")).toBeInTheDocument();
      expect(
        screen.getByText("7 calendar days, of which 5 are working days."),
      ).toBeInTheDocument();
    });

    it("names the holiday it did not charge for", async () => {
      quoteLeave.mockResolvedValue({
        ...QUOTE,
        days: 4,
        holidays: [{ name: "Founders Day", observedOn: "2026-10-01" }],
      });

      const user = await openDialog();

      await user.type(screen.getByLabelText("First day"), "2026-09-28");
      await user.type(screen.getByLabelText("Last day"), "2026-10-04");

      expect(await screen.findByText(/Not charged:/)).toHaveTextContent(
        "Founders Day",
      );
    });

    /*
      Shown before booking rather than at the approval stage, so the
      conversation happens between colleagues instead of being adjudicated by
      somebody who was not party to it.
    */
    it("warns when the team is already thin that day", async () => {
      quoteLeave.mockResolvedValue({
        ...QUOTE,
        coverage: { away: 3, team: 5, names: ["Ada", "Grace", "Alan"] },
      });

      const user = await openDialog();

      await user.type(screen.getByLabelText("First day"), "2026-09-28");
      await user.type(screen.getByLabelText("Last day"), "2026-10-04");

      expect(
        await screen.findByText(/3 of 5 of your teammates are also away/),
      ).toHaveTextContent("Ada, Grace, Alan");
    });

    /*
      Every day in the range is a weekend or a public holiday. Booking it would
      record a zero-day absence that shows on a calendar and costs nothing,
      which is worse than refusing.
    */
    it("will not submit a range that costs nothing", async () => {
      quoteLeave.mockResolvedValue({ ...QUOTE, days: 0, workingDays: 0 });

      const user = await openDialog();

      await user.type(screen.getByLabelText("First day"), "2026-09-26");
      await user.type(screen.getByLabelText("Last day"), "2026-09-27");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Request" })).toBeDisabled(),
      );
    });

    it("cannot be submitted before a cost is known", async () => {
      await openDialog();

      expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
    });

    /*
      Not "your HR manager": the booking goes to the line manager when there
      is one, otherwise to HR.
    */
    it("names who the booking goes to", async () => {
      leave.mockResolvedValue(data({ managerName: "Chinonso Okeke" }));

      await openDialog();

      expect(
        screen.getByRole("dialog", { name: "Book leave" }),
      ).toHaveTextContent("It goes to Chinonso Okeke for a decision.");
    });

    it("says HR decides when there is no line manager", async () => {
      await openDialog();

      expect(
        screen.getByRole("dialog", { name: "Book leave" }),
      ).toHaveTextContent("It goes to your HR team for a decision.");
    });

    it("sends the chosen cover with the booking", async () => {
      const user = await openDialog();

      const cover = screen.getByText("Who covers for you (optional)").closest("label") as HTMLElement;
      const listbox = await openCombobox(user, within(cover).getByRole("combobox"));
      await user.click(await within(listbox).findByRole("option", { name: /Grace Hopper/ }));

      await user.type(screen.getByLabelText("First day"), "2026-09-28");
      await user.type(screen.getByLabelText("Last day"), "2026-10-04");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Request" })).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: "Request" }));

      await waitFor(() =>
        expect(requestLeave).toHaveBeenCalledWith(
          expect.objectContaining({ coveringEmployeeId: "emp-9" }),
        ),
      );
    });

    it("sends the booking and reloads", async () => {
      const user = await openDialog();

      await user.type(screen.getByLabelText("First day"), "2026-09-28");
      await user.type(screen.getByLabelText("Last day"), "2026-10-04");

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Request" })).toBeEnabled(),
      );

      await user.click(screen.getByRole("button", { name: "Request" }));

      await waitFor(() =>
        expect(requestLeave).toHaveBeenCalledWith(
          expect.objectContaining({
            leaveTypeId: "type-1",
            startsOn: "2026-09-28",
            endsOn: "2026-10-04",
          }),
        ),
      );

      expect(leave).toHaveBeenCalledTimes(2);
    });
  });

  /*
    Withdrawing is the employee's own decision and only applies while the
    request is still open. Taking back leave already granted is the employer's
    move and lives on the manager's screen under its own name.
  */
  it("offers withdrawal only while a request is still open", async () => {
    render(<MyLeave />);

    expect(
      await screen.findByRole("button", { name: "Withdraw" }),
    ).toBeInTheDocument();
  });

  it("does not offer to withdraw a decided request", async () => {
    leave.mockResolvedValue(
      data({
        requests: [
          {
            ...PENDING,
            status: "approved",
            statusLabel: "Approved",
            isOpen: false,
            isGranted: true,
          },
        ],
      }),
    );

    render(<MyLeave />);

    await screen.findByText("Approved");
    expect(
      screen.queryByRole("button", { name: "Withdraw" }),
    ).not.toBeInTheDocument();
  });

  /*
    A zero that needs explaining. "You have 0 carried days" and "your carried
    days expired in March" are different sentences, and only one of them
    answers the question the person is actually asking.
  */
  it("explains a lapsed carry-over rather than showing a bare zero", async () => {
    leave.mockResolvedValue(
      data({ balances: [{ ...BALANCE, carriedDays: 0, carryOverLapsed: true }] }),
    );

    render(<MyLeave />);

    expect(
      await screen.findByText("carried days have expired"),
    ).toBeInTheDocument();
  });

  it("says so plainly when nothing is booked", async () => {
    leave.mockResolvedValue(data({ requests: [] }));

    render(<MyLeave />);

    expect(
      await screen.findByText("Nothing booked this year"),
    ).toBeInTheDocument();
  });
});
