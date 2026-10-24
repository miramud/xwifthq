import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RelationsBoard from "./RelationsBoard";
import type { RelationsCase, RelationsInsights } from "@/lib/api/hrm-client";

/**
 * Disciplinaries and grievances.
 *
 * Employee relations is the part of the module where a well-meaning screen does
 * the most damage, so what these tests protect is mostly what the board
 * *refuses* to show.
 *
 * It does not rank individuals. It does not publish a department small enough
 * that a count names the complainant, and when it withholds one it says so,
 * because a category that silently vanishes reads as zero and somebody would
 * conclude the quiet departments are the healthy ones. It reports procedural
 * gaps as counts rather than as a compliance percentage, because "94%
 * compliant" is a comfortable number that hides the six cases that will be the
 * ones litigated.
 *
 * The one thing it insists on showing is case age. A disciplinary open for four
 * months is doing more harm to the person than any outcome would, and it is the
 * figure nobody looks at.
 */

const { list, analytics } = vi.hoisted(() => ({
  list: vi.fn(),
  analytics: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { relations: { list, analytics } } };
});

const CASE: RelationsCase = {
  id: "c-1",
  reference: "DIS-0001",
  kind: "disciplinary",
  kindLabel: "Disciplinary",
  category: "conduct",
  status: "investigating",
  statusLabel: "Under investigation",
  summary: "Repeated lateness without explanation.",
  openedOn: "2026-09-01",
  ageInDays: 22,
  subjectId: "e-1",
  subjectName: "Ada Lovelace",
  raisedByName: null,
  outcome: null,
  outcomeLabel: null,
  outcomeOn: null,
  hasLiveWarning: false,
  warningExpiresOn: null,
  isAppealable: false,
  appealedAt: null,
  daysToResolve: null,
};

const INSIGHTS: RelationsInsights = {
  volume: {
    open: 4,
    openDisciplinaries: 3,
    openGrievances: 1,
    raisedLast90Days: 6,
    runningOverNinetyDays: 0,
  },
  resolution: { resolved: 5, medianDays: 21, longestDays: 96 },
  outcomes: [],
  hotspots: { departments: [], withheldGroups: 0, minimumGroupSize: 3 },
  liveWarnings: { total: 2, byLevel: {}, expiringWithin30Days: 1 },
  procedure: {
    hearingsWithoutCompanionOffer: 0,
    decisionsWithoutReasons: 0,
    decidedWithoutInvestigation: 0,
    appealsOutstanding: 0,
  },
  asAt: "2026-09-23",
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([CASE]);
  analytics.mockResolvedValue(INSIGHTS);
});

describe("Caseload", () => {
  it("opens on what is running rather than on a chart", async () => {
    render(<RelationsBoard />);

    expect(
      await screen.findByText(/DIS-0001 · Repeated lateness/),
    ).toBeInTheDocument();
  });

  /*
    The figure nobody looks at. A disciplinary open for four months is doing
    more harm to the person than any outcome would.
  */
  it("flags a case that has been running over ninety days", async () => {
    list.mockResolvedValue([{ ...CASE, ageInDays: 122 }]);

    render(<RelationsBoard />);

    expect(await screen.findByText("122d")).toBeInTheDocument();
  });

  it("does not flag one that is still within ninety days", async () => {
    render(<RelationsBoard />);

    await screen.findByText(/DIS-0001/);

    expect(screen.queryByText("22d")).not.toBeInTheDocument();
  });

  /*
    Anonymity is a state and saying so is the point of it. A blank would read
    as missing data and invite somebody to go and find out who.
  */
  it("says a grievance was raised anonymously rather than leaving a blank", async () => {
    list.mockResolvedValue([
      {
        ...CASE,
        kind: "grievance",
        kindLabel: "Grievance",
        reference: "GRV-0001",
        summary: "Staffing on nights is unsafe.",
        subjectName: null,
        raisedByName: "Raised anonymously",
      },
    ]);

    render(<RelationsBoard />);

    expect(await screen.findByText(/Raised anonymously/)).toBeInTheDocument();
  });
});

describe("Live warnings", () => {
  /*
    Derived from cases rather than read from a register, which is why an
    expired one simply stops appearing.
  */
  it("explains that a warning lapses without anything having to run", async () => {
    const user = userEvent.setup();

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Live warnings" }));

    expect(
      await screen.findByText(/with nothing for you to do/),
    ).toBeInTheDocument();
  });

  it("shows a permanent warning as having no expiry", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue([
      {
        ...CASE,
        outcome: "final_written_warning",
        outcomeLabel: "Final written warning",
        outcomeOn: "2026-09-10",
        hasLiveWarning: true,
        warningExpiresOn: null,
      },
    ]);

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Live warnings" }));

    expect(await screen.findByText("No expiry")).toBeInTheDocument();
  });
});

describe("Patterns", () => {
  /*
    Withholding is announced. A category that vanishes reads as zero, and
    somebody would conclude the quiet departments are the healthy ones.
  */
  it("says when a group was withheld, and why", async () => {
    const user = userEvent.setup();

    analytics.mockResolvedValue({
      ...INSIGHTS,
      hotspots: { departments: [], withheldGroups: 2, minimumGroupSize: 3 },
    });

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Patterns" }));

    expect(
      await screen.findByText(/a count names the person/),
    ).toBeInTheDocument();
  });

  /*
    Gaps, not a percentage: "94% compliant" hides the six cases that get
    litigated.
  */
  it("counts procedural gaps rather than scoring compliance", async () => {
    const user = userEvent.setup();

    analytics.mockResolvedValue({
      ...INSIGHTS,
      procedure: {
        hearingsWithoutCompanionOffer: 2,
        decisionsWithoutReasons: 0,
        decidedWithoutInvestigation: 1,
        appealsOutstanding: 0,
      },
    });

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Patterns" }));

    expect(
      await screen.findByText(/no record that a companion was offered/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Warnings issued with no investigation recorded/),
    ).toBeInTheDocument();
    // The clean ones are not listed at all, a zero is not a finding.
    expect(
      screen.queryByText(/Decisions with no reasons recorded/),
    ).not.toBeInTheDocument();
  });

  it("says so plainly when nothing is missing", async () => {
    const user = userEvent.setup();

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Patterns" }));

    expect(
      await screen.findByText(/Nothing missing on the cases recorded so far/),
    ).toBeInTheDocument();
  });

  it("leads with how long cases run rather than how many there are", async () => {
    const user = userEvent.setup();

    analytics.mockResolvedValue({
      ...INSIGHTS,
      volume: { ...INSIGHTS.volume, runningOverNinetyDays: 3 },
    });

    render(<RelationsBoard />);

    await user.click(await screen.findByRole("button", { name: "Patterns" }));

    expect(await screen.findByText("Running over 90 days")).toBeInTheDocument();
    expect(screen.getByText("Median to resolve")).toBeInTheDocument();
    expect(screen.getByText("21d")).toBeInTheDocument();
  });
});
