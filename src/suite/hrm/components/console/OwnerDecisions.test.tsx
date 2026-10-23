import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LeaveBalance, LeaveType, PayrollRun, ShiftPattern } from "@/lib/api/hrm-client";
import { TypeDialog } from "./LeaveBoard";
import { ShiftDialog } from "./RosterBoard";
import { RunExtras } from "./PayrollBoard";
import LeaveBalances from "./LeaveBalances";
import { chooseOption } from "@/test/selectOption";

/**
 * The owner's HRM rulings, on screen.
 *
 * - U2: an edit dialog says "Edit …" and "Save changes", not "Add …".
 * - H8: a leave type carries "Prorate for starters and leavers", on by default.
 * - D5: balance adjustments add up and their history is shown.
 * - D6/H15: a run says which unapproved overtime it left out and which
 *   leavers' settlements it carries.
 */

const { updateType, createType, updateShift, createShift, balances, employeeList } = vi.hoisted(() => ({
  updateType: vi.fn(),
  createType: vi.fn(),
  updateShift: vi.fn(),
  createShift: vi.fn(),
  balances: vi.fn(),
  employeeList: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/leave",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      leave: { updateType, createType, balances },
      roster: { updateShift, createShift },
      employees: { list: employeeList, listAll: async () => (await employeeList()).data },
      payroll: { bankFileUrl: () => "#" },
    },
  };
});

const ANNUAL: LeaveType = {
  id: "lt-1",
  name: "Annual leave",
  code: "AL",
  description: null,
  colour: null,
  isPaid: true,
  isActive: true,
  accrual: "annual",
  accrualLabel: "Whole entitlement up front",
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
  prorateForStarters: true,
  minimumServiceMonths: null,
} as LeaveType;

const DAY: ShiftPattern = {
  id: "sp-1",
  name: "Day",
  code: "D",
  description: null,
  colour: null,
  startsAt: "09:00",
  endsAt: "17:00",
  crossesMidnight: false,
  breakMinutes: 60,
  expectedMinutes: 420,
  expectedHours: 7,
  spanMinutes: 480,
  paidMinutes: null,
  location: null,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  updateType.mockResolvedValue(ANNUAL);
  createType.mockResolvedValue(ANNUAL);
  updateShift.mockResolvedValue(DAY);
  createShift.mockResolvedValue(DAY);
});

describe("edit dialogs say they edit (U2)", () => {
  it("titles the leave type dialog by what it does", () => {
    const { unmount } = render(<TypeDialog existing={ANNUAL} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText("Edit leave type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    unmount();

    render(<TypeDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Add leave type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add type" })).toBeInTheDocument();
  });

  it("titles the shift dialog by what it does", () => {
    const { unmount } = render(<ShiftDialog existing={DAY} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText("Edit shift")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    unmount();

    render(<ShiftDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add shift" })).toBeInTheDocument();
  });
});

describe("proration for starters and leavers (H8)", () => {
  it("is on by default and can be switched off", async () => {
    const user = userEvent.setup();

    render(<TypeDialog existing={ANNUAL} onClose={vi.fn()} onSaved={vi.fn()} />);

    const box = screen.getByRole("checkbox", { name: /Prorate for starters and leavers/ });
    expect(box).toBeChecked();

    await user.click(box);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateType).toHaveBeenCalledWith("lt-1", expect.objectContaining({ prorateForStarters: false })),
    );
  });
});

describe("adjustment history (D5)", () => {
  it("lists every adjustment with who, when and why", async () => {
    const user = userEvent.setup();

    employeeList.mockResolvedValue({
      data: [{ id: "e-1", person: { name: "Ada Lovelace" }, jobTitle: "Analyst", department: null }],
      meta: {},
    });

    const balance: LeaveBalance = {
      typeId: "lt-1",
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
      adjustmentDays: 1.5,
      takenDays: 0,
      pendingDays: 0,
      remainingDays: 21.5,
      carryOverLapsed: false,
      adjustments: [
        { id: "a-2", days: -1.5, note: "Half of the goodwill taken back.", by: "Hr Manager", at: "2026-09-23T10:00:00Z" },
        { id: "a-1", days: 3, note: "Goodwill after the migration weekend.", by: "Hr Manager", at: "2026-09-23T09:00:00Z" },
      ],
    };

    balances.mockResolvedValue({ data: [balance], meta: { year: 2026, employeeId: "e-1" } });

    render(<LeaveBalances />);

    await chooseOption(user, "Whose", /Ada Lovelace/);

    expect(await screen.findByText("Adjustment history")).toBeInTheDocument();
    expect(screen.getByText("Goodwill after the migration weekend.")).toBeInTheDocument();
    expect(screen.getByText("Half of the goodwill taken back.")).toBeInTheDocument();
    expect(screen.getAllByText(/Hr Manager/)).toHaveLength(2);
  });
});

describe("what a run left out and carried (D6, H15)", () => {
  const RUN = {
    id: "r-1",
    reference: "PR-2026-09",
    isFrozen: false,
    overtimeExcluded: {
      days: 1,
      minutes: 180,
      rows: [{ employeeId: "e-1", employeeName: "Ada Lovelace", date: "2026-09-07", kind: "weekday", minutes: 180 }],
    },
    finalSettlements: [
      { payslipId: "p-1", employeeId: "e-2", employeeName: "Tunde Bello", amountKobo: 25_000_000, note: "Untaken leave." },
    ],
  } as unknown as PayrollRun;

  it("names the unapproved overtime days and the settlements", () => {
    render(<RunExtras run={RUN} />);

    expect(screen.getByText("1 unapproved day of overtime left out")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/work the figures out again/)).toBeInTheDocument();
    expect(screen.getByText("Final settlements on this run")).toBeInTheDocument();
    expect(screen.getByText("Tunde Bello")).toBeInTheDocument();
    expect(screen.getByText("Untaken leave.")).toBeInTheDocument();
  });

  it("shows nothing when there is nothing to say", () => {
    const { container } = render(
      <RunExtras run={{ ...RUN, overtimeExcluded: { days: 0, minutes: 0, rows: [] }, finalSettlements: [] }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
