import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkforceBoard from "./WorkforceBoard";
import type { WorkforceInsights } from "@/lib/api/hrm-client";

/**
 * Turnover, tenure, absence and what the untaken leave is worth.
 *
 * What these tests protect is the *framing*, because workforce numbers are
 * easy to compute and easy to present in a way that leads somebody to the
 * wrong action.
 *
 * A turnover rate never appears without its two halves beside it, losing
 * eight people to resignations and losing eight to redundancy are different
 * problems that one number describes neither of. Leave liability says how many
 * people it could not value, so nobody quotes an understated figure to a
 * finance director. Bradford appears as a distribution with its caveat on the
 * screen rather than in a footnote, because a high score is usually a health
 * condition and the screen is where somebody decides what to do about it.
 */

const { get, csvUrl } = vi.hoisted(() => ({
  get: vi.fn(),
  csvUrl: vi.fn(() => "/api/hrm/workforce.csv"),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { workforce: { get, csvUrl } } };
});

const BASE: WorkforceInsights = {
  window: { from: "2025-09-23", to: "2026-09-23" },
  turnover: {
    leavers: 6,
    voluntary: 4,
    involuntary: 2,
    excludedDeathsInService: 0,
    headcountStart: 40,
    headcountEnd: 50,
    averageHeadcount: 45,
    ratePercent: 13,
    voluntaryRatePercent: 9,
    byDepartment: [],
    byTenureBand: [],
    leftWithinFirstYear: 0,
  },
  movement: { joiners: 16, leavers: 6, net: 10 },
  tenure: [
    { label: "Under 6 months", count: 8, sharePercent: 16 },
    { label: "Over 5 years", count: 12, sharePercent: 24 },
  ],
  spanOfControl: {
    managers: 5,
    averageSpan: 8,
    widestSpan: 9,
    wideSpans: [],
    unmanaged: 1,
    wideSpanThreshold: 12,
  },
  absence: {
    ratePercent: 3.2,
    totalDays: 48,
    spells: 22,
    bradford: { low: 30, moderate: 6, high: 2, veryHigh: 1 },
    byDepartment: [],
  },
  leaveLiability: {
    days: 210.5,
    kobo: 42_000_000,
    peopleWithBalance: 38,
    withoutSalary: 0,
    byDepartment: [],
  },
};

function give(overrides: Partial<WorkforceInsights>) {
  get.mockResolvedValue({ ...BASE, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  give({});
});

describe("Turnover", () => {
  /*
    A retention problem and a restructuring look identical in a combined
    figure and need completely different responses.
  */
  it("never shows a rate without its two halves", async () => {
    render(<WorkforceBoard />);

    expect(await screen.findByText("13%")).toBeInTheDocument();
    expect(screen.getByText("Voluntary")).toBeInTheDocument();
    expect(screen.getByText("Involuntary")).toBeInTheDocument();
    expect(screen.getByText("4 chose to go")).toBeInTheDocument();
  });

  /** The denominator, said out loud rather than assumed. */
  it("shows what the rate was measured against", async () => {
    render(<WorkforceBoard />);

    expect(await screen.findByText("6 of 45 average")).toBeInTheDocument();
  });

  /*
    The finding a headline rate hides: the fix for first-year attrition is in
    hiring or induction, not retention.
  */
  it("calls out people lost inside their first year", async () => {
    give({
      turnover: { ...BASE.turnover, leftWithinFirstYear: 4 },
    });

    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/4 of 6 leavers were here under a year/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hiring or an induction problem/),
    ).toBeInTheDocument();
  });

  it("says nothing about first-year attrition when there is none", async () => {
    render(<WorkforceBoard />);

    await screen.findByText("13%");

    expect(screen.queryByText(/here under a year/)).not.toBeInTheDocument();
  });

  /** Excluded from every rate, and said so, or the leaver list would not add up. */
  it("explains that a death in service is excluded", async () => {
    give({
      turnover: { ...BASE.turnover, excludedDeathsInService: 1 },
    });

    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/excluded from every rate above/),
    ).toBeInTheDocument();
  });
});

describe("Leave liability", () => {
  it("values what has been earned and not taken", async () => {
    render(<WorkforceBoard />);

    expect(await screen.findByText("210.5")).toBeInTheDocument();
    expect(
      screen.getByText(/Money already earned, paid on a final payslip/),
    ).toBeInTheDocument();
  });

  /*
    Pretending the figure is complete would put a wrong number in front of a
    finance director.
  */
  it("warns when the value is an understatement", async () => {
    give({
      leaveLiability: { ...BASE.leaveLiability, withoutSalary: 3 },
    });

    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/the value above is an understatement/),
    ).toBeInTheDocument();
  });

  it("stays quiet when everybody could be valued", async () => {
    render(<WorkforceBoard />);

    await screen.findByText("210.5");

    expect(screen.queryByText(/understatement/)).not.toBeInTheDocument();
  });
});

describe("Absence", () => {
  /*
    A distribution, never a list of names. Somebody with a chronic condition
    scores highly through no fault of their own.
  */
  it("shows Bradford as a distribution with its caveat on screen", async () => {
    render(<WorkforceBoard />);

    expect(await screen.findByText("Bradford distribution")).toBeInTheDocument();
    expect(
      screen.getByText(/often a health condition rather than a conduct issue/),
    ).toBeInTheDocument();
  });

  /** Booked annual leave is not an absence problem. */
  it("says the rate covers unplanned absence only", async () => {
    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/Booked leave is not an absence problem/),
    ).toBeInTheDocument();
  });
});

describe("Span of control", () => {
  it("shows outliers rather than every manager", async () => {
    give({
      spanOfControl: {
        ...BASE.spanOfControl,
        widestSpan: 19,
        wideSpans: [{ managerId: "m-1", name: "Grace Hopper", reports: 19 }],
      },
    });

    render(<WorkforceBoard />);

    expect(await screen.findByText("19 reports")).toBeInTheDocument();
  });

  it("says plainly when nobody is overloaded", async () => {
    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/Nobody is carrying more than 12 direct reports/),
    ).toBeInTheDocument();
  });

  /*
    More than one is an org chart somebody stopped maintaining, which quietly
    breaks every approval that routes to a manager.
  */
  it("warns when several people report to nobody", async () => {
    give({
      spanOfControl: { ...BASE.spanOfControl, unmanaged: 7 },
    });

    render(<WorkforceBoard />);

    expect(
      await screen.findByText(/Approvals that route to a manager will not reach one/),
    ).toBeInTheDocument();
  });

  it("stays quiet about the one person at the top", async () => {
    render(<WorkforceBoard />);

    await screen.findByText("13%");

    expect(screen.queryByText(/report to nobody/)).not.toBeInTheDocument();
  });
});

describe("the report as a file", () => {
  it("offers a download for a board pack", async () => {
    render(<WorkforceBoard />);

    expect(
      await screen.findByRole("link", { name: /Download/ }),
    ).toHaveAttribute("href", "/api/hrm/workforce.csv");
  });
});
