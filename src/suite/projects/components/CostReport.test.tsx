import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CostReport from "./CostReport";
import { chooseOption } from "@/test/selectOption";
import type { Project, ProjectCost } from "@/lib/api/projects-client";

/**
 * The cost report.
 *
 * Every test here is about a **caveat**, because the numbers are the easy part
 * and the caveats are what stop them being quoted as solid:
 *
 *  - a forecast over no estimates is not shown as a number
 *  - a forecast over some estimates says what fraction it covers
 *  - unrated hours are stated, because they cost zero and make the total short
 *  - a converted figure carries the rate and the date that produced it
 *  - a missing exchange rate is named, not silently omitted
 *  - an internal project gets no billable figure and no margin
 *
 * And one permission: reaching this screen needs `can.viewCost`, which is
 * narrower than seeing the board.
 */

const { forProject, forSprint, ratesForProject } = vi.hoisted(() => ({
  forProject: vi.fn(),
  forSprint: vi.fn(),
  ratesForProject: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    cost: { ...actual.cost, forProject, forSprint },
    /* The rates panel is its own component with its own test. */
    rates: { ...actual.rates, forProject: ratesForProject },
  };
});

/* The tables are DataViews, which reach for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
  isBillable: true,
  can: {
    update: true,
    manageMembers: true,
    manageBoard: true,
    delete: false,
    viewCost: true,
    manageRates: true,
    logTimeForOthers: true,
  },
} as unknown as Project;

function report(over: Partial<ProjectCost> = {}): ProjectCost {
  return {
    currency: "USD",
    isBillable: true,
    spent: { minor: 600000, currency: "USD" },
    billableSpent: { minor: 400000, currency: "USD" },
    time: {
      minutes: 18000,
      hours: 300,
      billableHours: 200,
      unratedHours: 0,
      people: 4,
    },
    committed: {
      minor: 200000,
      currency: "USD",
      hours: 100,
      estimated: 10,
      total: 10,
      coverage: 1,
    },
    forecast: { minor: 800000, currency: "USD" },
    forecastIsMeaningful: true,
    rates: [
      {
        disciplineId: "d-be",
        label: "Backend",
        rateMinor: 2000,
        currency: "USD",
        source: "organisation_discipline",
        sourceLabel: "The rate card",
      },
      {
        disciplineId: "d-qa",
        label: "QA",
        rateMinor: null,
        currency: "USD",
        source: "none",
        sourceLabel: "No rate set",
      },
    ],
    ...over,
  } as ProjectCost;
}

function meta(over: Record<string, unknown> = {}) {
  return {
    byPerson: [
      { userId: "u-1", name: "Shadrach", hours: 200, billableHours: 150, costMinor: 400000 },
      { userId: "u-2", name: "Isaac", hours: 100, billableHours: 50, costMinor: 200000 },
    ],
    byDiscipline: [
      { disciplineId: "d-be", label: "Backend", hours: 200, costMinor: 400000 },
      { disciplineId: null, label: "Unassigned", hours: 100, costMinor: 200000 },
    ],
    canManageRates: true,
    convertibleTo: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  forProject.mockResolvedValue({ data: report(), meta: meta() });
  ratesForProject.mockResolvedValue({
    data: [],
    meta: {
      card: [],
      effective: [],
      canManage: true,
      projectCurrency: "USD",
      members: [],
    },
  });
});

describe("CostReport", () => {
  it("tells a reader who may not see cost why, and asks for nothing", async () => {
    const reader = {
      ...PROJECT,
      can: { ...PROJECT.can, viewCost: false },
    } as unknown as Project;

    render(<CostReport project={reader} />);

    expect(
      await screen.findByText(/You cannot see this project's cost/i),
    ).toBeInTheDocument();

    expect(forProject).not.toHaveBeenCalled();
  });

  it("shows spent, billable, committed and forecast", async () => {
    render(<CostReport project={PROJECT} />);

    expect(await screen.findByText("$6,000")).toBeInTheDocument();
    expect(screen.getByText("$4,000")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
    expect(screen.getByText("$8,000")).toBeInTheDocument();
  });

  /**
   * The rule the whole report exists to respect. The real backlog had 118
   * tasks and no estimates.
   */
  it("says there is no forecast when nothing is estimated", async () => {
    forProject.mockResolvedValue({
      data: report({
        forecastIsMeaningful: false,
        committed: {
          minor: 0,
          currency: "USD",
          hours: 0,
          estimated: 0,
          total: 118,
          coverage: 0,
        },
      }),
      meta: meta(),
    });

    render(<CostReport project={PROJECT} />);

    expect(
      await screen.findByText(/None of the remaining work is estimated/i),
    ).toBeInTheDocument();
  });

  /** A committed figure over a third of the work must say so. */
  it("states what fraction of the open work the committed figure covers", async () => {
    forProject.mockResolvedValue({
      data: report({
        committed: {
          minor: 200000,
          currency: "USD",
          hours: 100,
          estimated: 12,
          total: 118,
          coverage: 0.102,
        },
      }),
      meta: meta(),
    });

    render(<CostReport project={PROJECT} />);

    expect(await screen.findByText(/Covers 10% of the open work/i)).toBeInTheDocument();
    expect(screen.getByText(/across 12 of 118 open items/i)).toBeInTheDocument();
  });

  /** Full coverage needs no caveat, and showing one would be noise. */
  it("says nothing about coverage when everything is estimated", async () => {
    render(<CostReport project={PROJECT} />);

    await screen.findByText("$6,000");

    expect(screen.queryByText(/Covers .* of the open work/i)).toBeNull();
  });

  /** Hours that cost nothing make every figure short by whatever they were worth. */
  it("states unrated hours", async () => {
    forProject.mockResolvedValue({
      data: report({
        time: { minutes: 18000, hours: 300, billableHours: 200, unratedHours: 18, people: 4 },
      }),
      meta: meta(),
    });

    render(<CostReport project={PROJECT} />);

    expect(
      await screen.findByText(/18h were logged before a rate was set/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/short by whatever they were worth/i)).toBeInTheDocument();
  });

  /*
    The rates panel moved into `ProjectRates`, which fetches its own data so a
    project override can be set - see that component's test. Asserting it from
    here would be asserting a different component's render.
  */

  /* ------------------------------------------------------------------ */
  /*  Currency                                                          */
  /* ------------------------------------------------------------------ */

  it("offers no conversion when no exchange rate exists", async () => {
    render(<CostReport project={PROJECT} />);

    await screen.findByText("$6,000");

    /* A dropdown that leads to "no rate set" is a dead end. */
    expect(screen.queryByLabelText(/Also show in/i)).toBeNull();
  });

  it("converts on request and labels the figure with the rate and date", async () => {
    forProject.mockResolvedValue({
      data: report({
        spent: {
          minor: 600000,
          currency: "USD",
          converted: {
            minor: 948300000,
            currency: "NGN",
            rate: 1580.5,
            asOf: "2026-09-20",
            isStale: false,
            daysOld: 4,
          },
        },
      }),
      meta: meta({ convertibleTo: ["NGN"] }),
    });

    render(<CostReport project={PROJECT} />);

    const picker = await screen.findByLabelText(/Also show in/i);

    await chooseOption(userEvent.setup(), picker, "NGN");

    await waitFor(() =>
      expect(forProject).toHaveBeenLastCalledWith("acme-rebuild", { in: "NGN" }),
    );

    expect(screen.getByText(/≈ ₦9,483,000/)).toBeInTheDocument();
    expect(screen.getByText(/Converted at 1580.5 as of 2026-09-20/i)).toBeInTheDocument();
  });

  /** A stale rate is flagged and still used, a caveated number beats none. */
  it("flags a stale rate without refusing to convert", async () => {
    forProject.mockResolvedValue({
      data: report({
        spent: {
          minor: 600000,
          currency: "USD",
          converted: {
            minor: 948300000,
            currency: "NGN",
            rate: 1580.5,
            asOf: "2026-06-01",
            isStale: true,
            daysOld: 115,
          },
        },
      }),
      meta: meta({ convertibleTo: ["NGN"] }),
    });

    render(<CostReport project={PROJECT} />);

    expect(await screen.findByText(/stale rate/i)).toBeInTheDocument();
    expect(screen.getByText(/115 days old, worth checking/i)).toBeInTheDocument();
    /* Still converted. */
    expect(screen.getByText(/≈ ₦9,483,000/)).toBeInTheDocument();
  });

  /**
   * A missing conversion with no explanation reads as a bug; with one, it reads
   * as a rate somebody needs to enter.
   */
  it("names a missing exchange rate rather than omitting the figure", async () => {
    forProject.mockResolvedValue({
      data: report({
        spent: { minor: 600000, currency: "USD", conversionUnavailable: "NGN" },
      }),
      meta: meta({ convertibleTo: ["NGN"] }),
    });

    render(<CostReport project={PROJECT} />);

    expect(
      await screen.findByText(/No NGN rate set, so it is not converted/i),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */

  /** An internal project has a cost and no price. */
  it("shows no billable figure on an internal project", async () => {
    forProject.mockResolvedValue({
      data: report({ isBillable: false }),
      meta: meta(),
    });

    render(<CostReport project={PROJECT} />);

    expect(await screen.findByText(/A cost and no price/i)).toBeInTheDocument();
    expect(screen.queryByText("Billable")).toBeNull();
  });

  it("breaks the cost down by person and by job title, biggest first", async () => {
    render(<CostReport project={PROJECT} />);

    await screen.findByText("$6,000");

    expect(screen.getByText("By job title")).toBeInTheDocument();
    expect(screen.queryByText(/discipline/i)).toBeNull();

    expect(screen.getByText("Shadrach")).toBeInTheDocument();
    expect(screen.getByText("Isaac")).toBeInTheDocument();
    /* Project-level time belongs to no job title and says so. */
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText(/\(project time\)/i)).toBeInTheDocument();
  });

  it("says plainly when no time has been logged", async () => {
    forProject.mockResolvedValue({
      data: report({
        spent: { minor: 0, currency: "USD" },
        billableSpent: { minor: 0, currency: "USD" },
        time: { minutes: 0, hours: 0, billableHours: 0, unratedHours: 0, people: 0 },
      }),
      meta: meta({ byPerson: [], byDiscipline: [] }),
    });

    render(<CostReport project={PROJECT} />);

    expect(await screen.findByText(/No time logged yet/i)).toBeInTheDocument();
  });
});
