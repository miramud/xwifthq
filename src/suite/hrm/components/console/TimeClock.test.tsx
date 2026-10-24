import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeClock, { addDaysIso, mondayOf } from "./TimeClock";
import type { MyTimesheet, TimesheetDay } from "@/lib/api/hrm-client";

/**
 * My timesheet, week by week.
 *
 * Three things the handbook caught are pinned here. A missed day can be typed
 * in for any past date, so the page must be able to open, and send, an
 * earlier week; approved leave and public holidays are named on the day rows
 * rather than shown as "Nothing recorded"; and an approved day says so.
 */

const { timesheet, submitWeek } = vi.hoisted(() => ({
  timesheet: vi.fn(),
  submitWeek: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/me/timesheet",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { me: { timesheet, submitWeek } } };
});

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const THIS_MONDAY = mondayOf(todayIso());
const LAST_MONDAY = addDaysIso(THIS_MONDAY, -7);

function day(date: string, overrides: Partial<TimesheetDay> = {}): TimesheetDay {
  return {
    date,
    label: date,
    isWorkingDay: true,
    expectedMinutes: 480,
    entry: null,
    off: null,
    isAbsent: false,
    ...overrides,
  };
}

const ENTRY = {
  id: "te-1",
  clockInAt: null,
  clockOutAt: null,
  clockIn: "09:00",
  clockOut: "17:00",
  minutes: 480,
  hours: 8,
  lateMinutes: 0,
  wasLate: false,
  status: "approved" as const,
  statusLabel: "Approved",
  isOpen: false,
  awaitsApproval: false,
  isEditable: false,
  isEstimated: false,
  source: "clock",
  workLocation: null,
  note: null,
  rejectionReason: null,
};

function sheet(monday: string, days: TimesheetDay[]): MyTimesheet {
  return {
    employeeId: "emp-1",
    canRecordTime: true,
    openEntry: null,
    week: {
      from: monday,
      to: addDaysIso(monday, 6),
      days,
      totals: {
        workedMinutes: 480,
        workedHours: 8,
        expectedMinutes: 960,
        expectedHours: 16,
        balanceMinutes: -480,
        balanceHours: -8,
        lateDays: 0,
        lateMinutes: 0,
        absentDays: 0,
        openDays: 0,
        estimatedDays: 0,
        awaitingApproval: 0,
        requiresApproval: true,
      },
    },
    policy: {
      id: "tp-1",
      workingDays: 31,
      workingDayNumbers: [1, 2, 3, 4, 5],
      workingDaysPerWeek: 5,
      standardMinutes: 480,
      standardHours: 8,
      weeklyMinutes: 2400,
      weeklyHours: 40,
      dayStartsAt: "09:00",
      graceMinutes: 10,
      breakMinutes: 60,
      autoCloseAfterMinutes: null,
      requiresApproval: true,
      allowsManualEntry: true,
      updatedAt: null,
    },
  } as MyTimesheet;
}

beforeEach(() => {
  vi.clearAllMocks();
  timesheet.mockImplementation((week?: string) =>
    Promise.resolve(
      sheet(week === undefined ? THIS_MONDAY : mondayOf(week), [
        day(week === undefined ? THIS_MONDAY : mondayOf(week), { entry: ENTRY }),
        day(addDaysIso(week === undefined ? THIS_MONDAY : mondayOf(week), 1), {
          expectedMinutes: 0,
          off: { kind: "leave", name: "Annual leave", isHalfDay: false },
        }),
        day(addDaysIso(week === undefined ? THIS_MONDAY : mondayOf(week), 2), {
          expectedMinutes: 0,
          off: { kind: "holiday", name: "Founders Day", isHalfDay: false },
        }),
      ]),
    ),
  );
  submitWeek.mockResolvedValue({ data: { submitted: 1, skippedOpen: 0 }, message: "1 sent for approval." });
});

describe("TimeClock", () => {
  it("opens an earlier week and sends that week, not this one", async () => {
    const user = userEvent.setup();
    render(<TimeClock />);

    expect(await screen.findByRole("button", { name: "Next week" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous week" }));

    await waitFor(() => expect(timesheet).toHaveBeenLastCalledWith(LAST_MONDAY));

    const send = await screen.findByRole("button", { name: "Send this week for approval" });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);

    await waitFor(() =>
      expect(submitWeek).toHaveBeenCalledWith(LAST_MONDAY, addDaysIso(LAST_MONDAY, 6)),
    );
    expect(await screen.findByText("1 sent for approval.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to this week" }));
    await waitFor(() => expect(timesheet).toHaveBeenLastCalledWith(undefined));
  });

  /*
    The H23 race: a click while the week is still being fetched would send
    whatever week was on screen before. The button waits.
  */
  it("holds Send for approval until the week has loaded", async () => {
    let release: (v: MyTimesheet) => void = () => {};
    timesheet.mockImplementationOnce(
      () => Promise.resolve(sheet(THIS_MONDAY, [day(THIS_MONDAY)])),
    );
    timesheet.mockImplementationOnce(
      () => new Promise<MyTimesheet>((resolve) => (release = resolve)),
    );

    const user = userEvent.setup();
    render(<TimeClock />);

    await user.click(await screen.findByRole("button", { name: "Previous week" }));

    expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();

    release(sheet(LAST_MONDAY, [day(LAST_MONDAY)]));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send this week for approval" })).toBeEnabled(),
    );
  });

  it("names leave and holidays instead of 'Nothing recorded', and marks approved days", async () => {
    render(<TimeClock />);

    expect((await screen.findAllByText("Annual leave")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Public holiday · Founders Day").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nothing recorded")).not.toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
  });
});

describe("week arithmetic", () => {
  it("finds the Monday of any day", () => {
    expect(mondayOf("2026-10-02")).toBe("2026-09-28");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(addDaysIso("2026-09-28", -7)).toBe("2026-09-21");
  });
});
