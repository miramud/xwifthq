import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PerformancePanel from "./PerformancePanel";
import { ApiError } from "@/lib/api/admin-client";
import type {
  MemberPerformance,
  Burndown,
  Performance,
  Project,
  Sprint,
  VelocityPoint,
} from "@/lib/api/projects-client";

/**
 * Velocity, forecast and health.
 *
 * Every test defends the same discipline from a different angle: **never state
 * a number more confidently than the data allows**.
 *
 * - a forecast that cannot be made says *which* of the four things is missing
 * - a velocity below the minimum is **absent, not zero**
 * - a range is shown as a range, with what it covers
 * - health is named findings, never a score
 * - a burndown over unestimated work is not drawn as a flat line at zero
 */

const { forProject, burndown, mine, exportWorkbook } = vi.hoisted(() => ({
  forProject: vi.fn(),
  burndown: vi.fn(),
  mine: vi.fn(),
  exportWorkbook: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, performance: { ...actual.performance, forProject, burndown, mine, export: exportWorkbook } };
});

/* The sprint figures are a DataView, which reaches for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

const ACTIVE_SPRINT = {
  id: "sp-3",
  sequence: 3,
  name: "Sprint 3",
  status: "active",
} as unknown as Sprint;

function point(over: Partial<VelocityPoint> & { sequence: number }): VelocityPoint {
  return {
    sprintId: `sp-${over.sequence}`,
    name: `Sprint ${over.sequence}`,
    startsOn: "2026-10-01",
    endsOn: "2026-10-12",
    committedHours: 40,
    completedHours: 40,
    carriedHours: 0,
    addedHours: 0,
    committedCount: 4,
    completedCount: 4,
    attainment: 1,
    estimated: 4,
    total: 4,
    bounceBacks: 0,
    ...over,
  } as VelocityPoint;
}

function performance(over: Partial<Performance> = {}): Performance {
  return {
    velocity: {
      series: [point({ sequence: 1 }), point({ sequence: 2 })],
      summary: {
        sprintsMeasured: 2,
        window: 2,
        averageHours: 40,
        lowHours: 30,
        highHours: 50,
        variability: 0.15,
        estimateCoverage: 1,
        bounceBacks: 2,
      },
      minimumSprints: 2,
      window: 3,
    },
    forecast: {
      available: true,
      reason: null,
      sprintsRemaining: { optimistic: 2, expected: 3, pessimistic: 4 },
      dates: {
        optimistic: "2026-11-20",
        expected: "2026-12-04",
        pessimistic: "2026-12-18",
      },
      confidence: "medium",
      basis: {
        sprintsMeasured: 2,
        averageHours: 40,
        variability: 0.15,
        sprintLengthDays: 14,
      },
      estimatedHours: 120,
      estimated: 10,
      total: 10,
      coverage: 1,
      targetEndsOn: null,
      slipsPastTarget: null,
    },
    health: [
      {
        key: "estimates",
        label: "Estimates",
        verdict: "good",
        detail: "100% of the open work is estimated.",
        value: 100,
      },
      {
        key: "quality",
        label: "Rework",
        verdict: "bad",
        detail:
          "22 moves backwards across 5 items. Work is being called done before it is. Read it per project, never per person.",
        value: 22,
      },
    ],
    ...over,
  } as Performance;
}

function burndownData(over: Partial<Burndown> = {}): Burndown {
  return {
    sprintId: "sp-3",
    sequence: 3,
    totalHours: 40,
    estimated: 4,
    total: 4,
    points: [
      { date: "2026-10-01", idealHours: 40, remainingHours: 40 },
      { date: "2026-10-02", idealHours: 30, remainingHours: 30 },
      { date: "2026-10-03", idealHours: 20, remainingHours: null },
      { date: "2026-10-04", idealHours: 0, remainingHours: null },
    ],
    ...over,
  } as Burndown;
}

beforeEach(() => {
  vi.clearAllMocks();
  forProject.mockResolvedValue({
    data: performance(),
    meta: { canSeeCost: true, currency: "USD" },
  });
  burndown.mockResolvedValue(burndownData());
  /* The personal section has its own tests below; out of the way here. */
  mine.mockRejectedValue(new ApiError("Not found.", 404));
});

describe("PerformancePanel", () => {
  it("shows the forecast as a range, not a single date", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("2026-12-04")).toBeInTheDocument();
    expect(screen.getByText("2026-11-20")).toBeInTheDocument();
    expect(screen.getByText("2026-12-18")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  /** Where the range comes from matters: it is the team's spread, not maths. */
  it("says the range is the team's own spread", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(
      await screen.findByText(/best and worst sprints, not a statistical interval/i),
    ).toBeInTheDocument();
  });

  /**
   * "We cannot tell you yet" and "something broke" look identical without a
   * named reason.
   */
  it("explains a forecast it cannot make", async () => {
    forProject.mockResolvedValue({
      data: performance({
        forecast: {
          available: false,
          reason: "not_enough_history",
          explanation:
            "A forecast needs at least 2 closed sprints to measure velocity from. Close a sprint and it appears here.",
          sprintsRemaining: null,
          dates: null,
          confidence: null,
          basis: null,
          estimatedHours: 0,
          estimated: 0,
          total: 6,
          coverage: 0,
          targetEndsOn: null,
          slipsPastTarget: null,
        },
      }),
      meta: { canSeeCost: true, currency: "USD" },
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(
      await screen.findByText(/needs at least 2 closed sprints/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 of 6 open items are estimated/i)).toBeInTheDocument();
  });

  /** A forecast over a third of the work must not read as covering all of it. */
  it("states what fraction of the remaining work the forecast covers", async () => {
    forProject.mockResolvedValue({
      data: performance({
        forecast: {
          ...performance().forecast,
          coverage: 0.3,
          estimated: 3,
          total: 10,
          estimatedHours: 36,
        },
      }),
      meta: { canSeeCost: true, currency: "USD" },
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/Covers the 30%/i)).toBeInTheDocument();
    expect(screen.getByText(/3 of 10 items/i)).toBeInTheDocument();
  });

  it("shows a slip against the promised date without conflating the two", async () => {
    forProject.mockResolvedValue({
      data: performance({
        forecast: {
          ...performance().forecast,
          targetEndsOn: "2026-11-01",
          slipsPastTarget: 33,
        },
      }),
      meta: { canSeeCost: true, currency: "USD" },
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/33 days past the 2026-11-01 target/i)).toBeInTheDocument();
    expect(
      screen.getByText(/what was promised; this is what the measured velocity says/i),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Velocity                                                          */
  /* ------------------------------------------------------------------ */

  /** Absent, not zero, a zero would be a claim about the team. */
  it("says velocity is not measured yet rather than showing zero", async () => {
    forProject.mockResolvedValue({
      data: performance({
        velocity: { series: [], summary: null, minimumSprints: 2, window: 3 },
      }),
      meta: { canSeeCost: true, currency: "USD" },
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("Not measured yet")).toBeInTheDocument();
    expect(screen.getByText(/zero would be a claim about the team/i)).toBeInTheDocument();
    expect(screen.queryByText("0h")).toBeNull();
  });

  it("shows the average, the range and the variability", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    /* "40h" is both the average and each bar's own label. */
    expect((await screen.findAllByText("40h")).length).toBeGreaterThan(0);
    expect(screen.getByText("30h to 50h")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  /** The rule is restated where somebody reads the number. */
  it("says rework is read per project, never per person", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("Per project, never per person")).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Health                                                            */
  /* ------------------------------------------------------------------ */

  it("shows health as named findings with a sentence each", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("Estimates")).toBeInTheDocument();
    /* Twice: the health finding, and the velocity figure of the same name. */
    expect(screen.getAllByText("Rework").length).toBeGreaterThan(0);
    expect(screen.getByText(/22 moves backwards across 5 items/i)).toBeInTheDocument();

    /* And no score anywhere. */
    expect(screen.queryByText(/health score/i)).toBeNull();
  });

  it("renders an unknown verdict as not-yet rather than a failure", async () => {
    forProject.mockResolvedValue({
      data: performance({
        health: [
          {
            key: "velocity",
            label: "Velocity",
            verdict: "unknown",
            detail: "Not enough closed sprints to tell whether this team is steady.",
            value: null,
          },
        ],
      }),
      meta: { canSeeCost: true, currency: "USD" },
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("Not yet")).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Burndown                                                          */
  /* ------------------------------------------------------------------ */

  it("draws the burndown for the running sprint", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[ACTIVE_SPRINT]} />);

    await waitFor(() => expect(burndown).toHaveBeenCalledWith("sp-3"));

    expect(await screen.findByText(/Sprint 3 burndown/i)).toBeInTheDocument();

    /* Both series named, so colour is never the only distinction. */
    expect(screen.getByText("Even progress")).toBeInTheDocument();
    expect(screen.getByText("Actually left")).toBeInTheDocument();
  });

  /** A burndown over unestimated work would be a flat line at zero. */
  it("refuses to draw a curve when nothing in the sprint is estimated", async () => {
    burndown.mockResolvedValue(burndownData({ estimated: 0, totalHours: 0 }));

    render(<PerformancePanel project={PROJECT} sprints={[ACTIVE_SPRINT]} />);

    expect(
      await screen.findByText(/Nothing in this sprint is estimated, so there is no curve/i),
    ).toBeInTheDocument();
  });

  it("says how much of the sprint the curve is drawn from", async () => {
    burndown.mockResolvedValue(burndownData({ estimated: 2, total: 5 }));

    render(<PerformancePanel project={PROJECT} sprints={[ACTIVE_SPRINT]} />);

    expect(await screen.findByText(/Drawn from the 2 of 5 items/i)).toBeInTheDocument();
  });

  it("draws nothing when no sprint has run", async () => {
    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    await screen.findByText("Estimates");

    expect(burndown).not.toHaveBeenCalled();
    expect(screen.queryByText(/burndown/i)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  My performance                                                     */
/* ------------------------------------------------------------------ */

/**
 * The caller's own figures. Counts with what they are out of, never a score,
 * never a percentage, for everybody on the project, and simply absent when
 * the API says there is nothing to show this person.
 */
function figures(completed: number, reopened: number, withBugsRaised: number, bugsRaised: number, fixed: number) {
  return {
    tasks: { completed, reopened, bounceBacks: reopened, withBugsRaised, bugsRaised },
    bugs: { fixed },
  };
}

function mineData(over: Partial<MemberPerformance> = {}): MemberPerformance {
  return {
    person: { id: "u-1", name: "Ada Obi" },
    project: { id: "p-1", slug: "acme-rebuild", name: "Acme Rebuild" },
    ...figures(9, 2, 3, 4, 5),
    open: {
      assigned: 6,
      byType: { epic: 0, story: 2, task: 3, bug: 1, spike: 0 },
      blocked: 2,
    },
    hours: { logged: 31.5, estimatedDelivered: 28, estimatedItems: 7, finishedItems: 14 },
    sprints: [
      {
        id: "sp-1",
        name: "Sprint 1",
        sequence: 1,
        status: "closed",
        startsOn: "2026-09-01",
        endsOn: "2026-09-14",
        ...figures(4, 1, 1, 1, 2),
        hours: { logged: 12, estimatedDelivered: 10, estimatedItems: 3, finishedItems: 6 },
      },
      {
        id: "sp-2",
        name: "Sprint 2",
        sequence: 2,
        status: "active",
        startsOn: "2026-09-15",
        endsOn: "2026-09-28",
        ...figures(5, 1, 2, 3, 3),
        hours: { logged: 19.5, estimatedDelivered: 18, estimatedItems: 4, finishedItems: 8 },
      },
    ],
    outsideSprints: { ...figures(0, 0, 0, 0, 0), hours: { estimatedDelivered: 0, estimatedItems: 0, finishedItems: 0 } },
    ...over,
  } as MemberPerformance;
}

const MINE_META = {
  selfOnly: true as const,
  definitions: {
    "tasks.completed": "Finished items assigned to you that are not bugs or epics. Partially Done is not finished.",
    "bugs.fixed": "Bugs assigned to you that are finished.",
  },
};

describe("PerformancePanel, my performance", () => {
  it("shows the caller's own counts with their denominators", async () => {
    mine.mockResolvedValue({ data: mineData(), meta: MINE_META });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByRole("heading", { name: "My performance" })).toBeInTheDocument();
    expect(mine).toHaveBeenCalledWith("acme-rebuild");

    /* Completed, and how many of those came through clean: 9 − 3. */
    expect(screen.getAllByText("Tasks completed").length).toBeGreaterThan(0);
    expect(screen.getByText("6 with no bug raised against them")).toBeInTheDocument();

    /* Bugs raised against their work, over how many tasks. */
    expect(screen.getByText("Bugs raised against my work")).toBeInTheDocument();
    expect(screen.getByText("Across 3 of 9 tasks")).toBeInTheDocument();

    expect(screen.getAllByText("Bugs fixed").length).toBeGreaterThan(0);
    expect(screen.getByText("Open and assigned")).toBeInTheDocument();
    expect(screen.getAllByText("2 blocked").length).toBeGreaterThan(0);

    /* Hours logged beside the estimate delivered, with its coverage. */
    expect(screen.getByText("31.5h")).toBeInTheDocument();
    expect(screen.getByText("On 7 of 14 finished items")).toBeInTheDocument();

    /* Per sprint, in the table. */
    expect(screen.getByRole("table", { name: /your figures per sprint/i })).toBeInTheDocument();
    expect(screen.getAllByText("Sprint 2").length).toBeGreaterThan(0);
  });

  it("uses the API's definitions as the explanation of each figure", async () => {
    mine.mockResolvedValue({ data: mineData(), meta: MINE_META });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("How these are counted")).toBeInTheDocument();
    expect(screen.getByText("Bugs assigned to you that are finished.")).toBeInTheDocument();
    expect(
      screen.getByTitle(/Partially Done is not finished/),
    ).toBeInTheDocument();
  });

  /** Counts, never a score: no rating and no percentage anywhere in the section. */
  it("never turns the counts into a score or a rate", async () => {
    mine.mockResolvedValue({ data: mineData(), meta: MINE_META });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    const section = await screen.findByRole("region", { name: "My performance" });
    await screen.findByText("6 with no bug raised against them");

    /* No percentage anywhere, and no rating: every figure is a count. */
    expect(section.textContent ?? "").not.toMatch(/\d\s*%/);
    expect(section.textContent ?? "").not.toMatch(/rating|out of 10|\/10/i);
  });

  it("is simply absent when the API refuses it", async () => {
    mine.mockRejectedValue(new ApiError("Forbidden.", 403));

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    await screen.findByText("Estimates");
    await waitFor(() => expect(mine).toHaveBeenCalled());

    expect(screen.queryByRole("heading", { name: "My performance" })).toBeNull();
  });

  /** One report failing never takes the other with it. */
  it("still shows my figures when the team report fails", async () => {
    forProject.mockRejectedValue(new ApiError("Server error.", 500));
    mine.mockResolvedValue({ data: mineData(), meta: MINE_META });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText("Server error.")).toBeInTheDocument();
    expect(await screen.findByText("6 with no bug raised against them")).toBeInTheDocument();
  });

  it("says when nothing is finished yet rather than drawing empty bars", async () => {
    mine.mockResolvedValue({
      data: mineData({ ...figures(0, 0, 0, 0, 0), sprints: [] }),
      meta: MINE_META,
    });

    render(<PerformancePanel project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/Nothing finished yet/i)).toBeInTheDocument();
  });
});

/**
 * The Excel workbook. It carries per-member figures, so it is a manager's
 * export: offered only where the API would hand it over.
 */
describe("PerformancePanel export", () => {
  const MANAGER = { ...PROJECT, can: { manageBoard: true } } as unknown as Project;
  const MEMBER = { ...PROJECT, can: { manageBoard: false } } as unknown as Project;

  it("is not offered to somebody who cannot manage the board", async () => {
    render(<PerformancePanel project={MEMBER} sprints={[]} />);

    await screen.findByText("Estimates");
    expect(screen.queryByRole("button", { name: /Export to Excel/ })).toBeNull();
  });

  it("downloads the workbook for a manager", async () => {
    const blob = new Blob(["xlsx"]);
    exportWorkbook.mockResolvedValue({ blob, filename: "acme-rebuild-performance-2026-09-25.xlsx" });
    const createObjectURL = vi.fn(() => "blob:workbook");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("acme-rebuild-performance-2026-09-25.xlsx");
      expect(this.getAttribute("href")).toBe("blob:workbook");
    });

    render(<PerformancePanel project={MANAGER} sprints={[]} />);

    expect(await screen.findByText(/Sprints, members, bugs and stories/)).toBeInTheDocument();
    screen.getByRole("button", { name: /Export to Excel/ }).click();

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(exportWorkbook).toHaveBeenCalledWith("acme-rebuild");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    click.mockRestore();
  });

  it("says so when the download fails", async () => {
    exportWorkbook.mockRejectedValue(new ApiError("You cannot export this project.", 403));

    render(<PerformancePanel project={MANAGER} sprints={[]} />);

    (await screen.findByRole("button", { name: /Export to Excel/ })).click();

    expect(await screen.findByText("You cannot export this project.")).toBeInTheDocument();
  });
});
