import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import EmployeeDossierPanel from "./EmployeeDossierPanel";
import type { EmployeeDossier } from "@/lib/api/hrm-client";

/**
 * The rest of somebody's record.
 *
 * What is worth pinning here is not the layout but the *sentences*. Each
 * section states something a manager would otherwise have to work out, and
 * several of them are distinctions the module spent six tranches establishing:
 * that pending leave is held rather than deducted, that an unpublished rota
 * governs nobody, that a suspended loan is still owed but not collected, and
 * that somebody entered by hand has no hiring story worth inventing.
 *
 * The other half is the failure behaviour. This panel is context hanging off an
 * employment record, and it must never be the reason the record cannot be read.
 */

const { dossier } = vi.hoisted(() => ({ dossier: vi.fn() }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { employees: { dossier } } };
});

const EMPTY: EmployeeDossier = {
  leave: {
    onLeaveToday: false,
    currentAbsence: null,
    balances: [],
    pendingRequests: 0,
  },
  attendance: {
    from: "2026-09-10",
    to: "2026-09-23",
    attendanceRate: 100,
    lateDays: 0,
    unexplainedDays: 0,
    workedMinutes: 0,
    varianceMinutes: 0,
    overtime: [],
    exceptions: [],
  },
  roster: { shifts: 0, expectedMinutes: 0, next: [] },
  pay: {
    hasProfile: true,
    missingDetails: [],
    monthlyBasicKobo: 50_000_000,
    lastPayslip: null,
    loans: { count: 0, outstandingKobo: 0, monthlyKobo: 0 },
  },
  welfare: {
    emergencyContact: null,
    hasEmergencyContact: false,
    isBlockedByDocument: false,
    documentsExpiring: [],
  },
  origin: null,
  asAt: "2026-09-23",
};

function give(overrides: Partial<EmployeeDossier>) {
  dossier.mockResolvedValue({ ...EMPTY, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  give({});
});

describe("Leave", () => {
  /*
    The answer to "why can nobody reach them", which previously took three
    clicks into a calendar.
  */
  it("says when somebody is away and until when", async () => {
    give({
      leave: {
        ...EMPTY.leave,
        onLeaveToday: true,
        currentAbsence: {
          id: "lr-1",
          type: "Annual leave",
          startsOn: "2026-09-21",
          endsOn: "2026-09-25",
          isApproved: true,
        },
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/Away on annual leave until/),
    ).toBeInTheDocument();
  });

  /* Somebody off on leave nobody has approved is a different situation. */
  it("marks an absence that was never approved", async () => {
    give({
      leave: {
        ...EMPTY.leave,
        onLeaveToday: true,
        currentAbsence: {
          id: "lr-1",
          type: "Sick leave",
          startsOn: "2026-09-23",
          endsOn: "2026-09-24",
          isApproved: false,
        },
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("Not yet approved")).toBeInTheDocument();
  });

  /*
    Pending days are held back, not deducted. Showing only "remaining" would
    let somebody book the same fortnight twice.
  */
  it("shows pending days beside what is left", async () => {
    give({
      leave: {
        ...EMPTY.leave,
        balances: [
          {
            typeId: "lt-1",
            name: "Annual leave",
            remainingDays: 12,
            takenDays: 5,
            pendingDays: 3,
          },
        ],
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("3 pending")).toBeInTheDocument();
  });
});

describe("Attendance", () => {
  it("lists the days somebody has to account for", async () => {
    give({
      attendance: {
        ...EMPTY.attendance,
        attendanceRate: 86,
        unexplainedDays: 2,
        exceptions: [
          { date: "2026-09-15", expectedMinutes: 420 },
          { date: "2026-09-16", expectedMinutes: 420 },
        ],
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("Days to account for")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
  });

  it("says nothing about exceptions when there are none", async () => {
    render(<EmployeeDossierPanel employeeId="e-1" />);

    await screen.findByText("Attendance");

    expect(
      screen.queryByText("Days to account for"),
    ).not.toBeInTheDocument();
  });
});

describe("Roster", () => {
  /*
    The whole point of the published flag, said out loud. A manager looking at
    an empty rota should know whether it is empty or merely unpublished.
  */
  it("explains that an unpublished rota governs nobody", async () => {
    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/invisible to the person it covers/),
    ).toBeInTheDocument();
  });

  it("marks a shift that runs past midnight", async () => {
    give({
      roster: {
        shifts: 1,
        expectedMinutes: 450,
        next: [
          {
            id: "ra-1",
            worksOn: "2026-09-24",
            name: "Night",
            startsAt: "22:00",
            endsAt: "06:00",
            crossesMidnight: true,
          },
        ],
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("Overnight")).toBeInTheDocument();
    expect(screen.getByText("22:00-06:00")).toBeInTheDocument();
  });
});

describe("Pay", () => {
  /* Roles redesign, phase 2b: confidential, so absent for somebody without HR's confidential records. */
  it("leaves the section out when the API withholds it", async () => {
    give({ pay: null, welfare: null });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("Leave")).toBeInTheDocument();
    expect(screen.queryByText("Pay")).not.toBeInTheDocument();
  });

  /*
    Somebody with no pay profile appears on no list of pay profiles, which is
    exactly why the record has to say so.
  */
  it("says plainly when nobody has set a salary", async () => {
    give({
      pay: {
        ...EMPTY.pay!,
        hasProfile: false,
        monthlyBasicKobo: null,
        missingDetails: ["No salary set"],
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/Nobody has set a salary/),
    ).toBeInTheDocument();
  });

  it("names what is missing rather than counting it", async () => {
    give({
      pay: { ...EMPTY.pay!, missingDetails: ["Pension PIN", "Account number"] },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText("Pension PIN")).toBeInTheDocument();
    expect(screen.getByText("Account number")).toBeInTheDocument();
  });

  /*
    Still owed, not being collected. Folding the two into one figure would
    either overstate this month's deduction or understate the debt.
  */
  it("distinguishes a suspended loan from one being collected", async () => {
    give({
      pay: {
        ...EMPTY.pay!,
        loans: { count: 1, outstandingKobo: 45_000_000, monthlyKobo: 0 },
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/Collection is suspended/),
    ).toBeInTheDocument();
  });

  it("says what comes off each run when it is being collected", async () => {
    give({
      pay: {
        ...EMPTY.pay!,
        loans: { count: 2, outstandingKobo: 45_000_000, monthlyKobo: 5_000_000 },
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText(/comes off each run/)).toBeInTheDocument();
    expect(screen.getByText("Owing on 2 loans")).toBeInTheDocument();
  });
});

describe("Origin", () => {
  it("threads back to the application somebody was hired from", async () => {
    give({
      origin: {
        offerId: "jo-1",
        candidateId: "c-1",
        applicationId: "ja-1",
        requisitionId: "jr-1",
        reference: "REQ-0007",
        jobTitle: "Ward Sister",
        source: "referral",
        sourceLabel: "Referral",
        appliedAt: "2026-06-01",
        acceptedAt: "2026-07-01",
        salaryKobo: 72_000_000,
        daysFromApplication: 30,
        wasReturningCandidate: true,
      },
    });

    render(<EmployeeDossierPanel employeeId="e-1" />);

    expect(await screen.findByText(/Offered Ward Sister/)).toBeInTheDocument();
    expect(screen.getByText("Referral")).toBeInTheDocument();
    expect(screen.getByText("Had applied before")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /application they were hired from/ }),
    ).toHaveAttribute("href", "/suite/hrm/recruitment/candidates/c-1");
  });

  /*
    Most people in a system like this were entered by hand during setup, and a
    fabricated "hired via career site" would be worse than a blank.
  */
  it("says nothing at all for somebody entered by hand", async () => {
    render(<EmployeeDossierPanel employeeId="e-1" />);

    await screen.findByText("Pay");

    expect(screen.queryByText("How they were hired")).not.toBeInTheDocument();
  });
});

describe("when it cannot load", () => {
  /*
    This panel is context hanging off an employment record. A red banner about
    an attendance rate would suggest the record itself is broken, and the
    agreements and probation decision above it are what the page is for.
  */
  it("disappears rather than breaking the record above it", async () => {
    dossier.mockRejectedValue(new Error("gone"));

    const { container } = render(<EmployeeDossierPanel employeeId="e-1" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
