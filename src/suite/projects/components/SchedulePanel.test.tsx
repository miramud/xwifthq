import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SchedulePanel from "./SchedulePanel";
import type { Project, Schedule, ScheduleItem } from "@/lib/api/projects-client";

/**
 * The critical path, and the four things it must never do.
 *
 * - draw an unestimated item as though it took a day
 * - state a duration without saying how much of the work is estimated
 * - render "these items wait for each other in a circle" as an empty panel
 * - show slack as a number beside a bar instead of a sentence
 */

const { forProject } = vi.hoisted(() => ({ forProject: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, schedule: { ...actual.schedule, forProject } };
});

/* The list is a DataView, which reaches for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

function item(over: Partial<ScheduleItem> & { id: string; title: string }): ScheduleItem {
  return {
    externalRef: null,
    durationDays: 2,
    earliestStart: 0,
    earliestFinish: 2,
    latestStart: 0,
    latestFinish: 2,
    slackDays: 0,
    isCritical: true,
    isEstimated: true,
    isComplete: false,
    isMilestone: false,
    dependsOn: [],
    startsOn: "2027-01-04",
    endsOn: "2027-01-05",
    latestStartsOn: "2027-01-04",
    latestEndsOn: "2027-01-05",
    ...over,
  };
}

function schedule(over: Partial<Schedule> = {}): Schedule {
  return {
    schedulable: true,
    reason: null,
    explanation: null,
    cycle: [],
    items: [],
    criticalPath: [],
    calendar: {
      basis: "weekends_only",
      reason: null,
      anchored: true,
      anchor: "2027-01-04",
      holidays: [],
      localHolidays: [],
    },
    summary: {
      durationDays: 6,
      itemCount: 2,
      criticalCount: 1,
      dependencyCount: 1,
      unestimated: 0,
      coverage: 1,
      hoursPerDay: 6,
      startsOn: "2027-01-04",
      endsOn: "2027-01-11",
      targetEndsOn: null,
    },
    ...over,
  };
}

/**
 * The component formats dates in the reader's own locale, deliberately, so a
 * test that pinned "15 Jan 2027" would pass in London and fail in Chicago.
 * Built the same way here, which checks the wiring without the ordering.
 */
function shown(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SchedulePanel", () => {
  it("says how long the project is and how many items decide it", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Design the API" })],
        criticalPath: ["a"],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("6 working days")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 items decide the end date")).toBeInTheDocument();
  });

  /** Slack as a sentence, because "4" beside a bar means nothing. */
  it("puts slack in words, and says outright when there is none", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "a", title: "On the path" }),
          item({
            id: "b",
            title: "Has room",
            isCritical: false,
            slackDays: 4,
            latestStart: 4,
          }),
        ],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("cannot slip")).toBeInTheDocument();
    expect(screen.getByText("can slip 4 days")).toBeInTheDocument();
  });

  it("says one day rather than 1 days", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "b", title: "Has a little room", isCritical: false, slackDays: 1 }),
        ],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("can slip 1 day")).toBeInTheDocument();
  });

  /**
   * **The caveat, not a footnote.** A path over a third-estimated backlog is a
   * path through a third of the work with the rest collapsed to zero.
   */
  it("states the estimate coverage and warns that the real end date is later", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "a", title: "Estimated" }),
          item({
            id: "b",
            title: "Nobody has estimated this",
            durationDays: 0,
            isEstimated: false,
            earliestFinish: 0,
          }),
        ],
        summary: {
          durationDays: 6,
          itemCount: 2,
          criticalCount: 1,
          dependencyCount: 0,
          unestimated: 1,
          coverage: 0.5,
          hoursPerDay: 6,
          startsOn: "2027-01-04",
          endsOn: "2027-01-11",
          targetEndsOn: null,
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("1 unestimated")).toBeInTheDocument();
    expect(screen.getByText(/50% of this work is estimated/)).toBeInTheDocument();
    expect(screen.getByText(/the real end date is later/)).toBeInTheDocument();

    /* And the row itself is marked, not silently drawn as a day. */
    expect(screen.getByText("No estimate")).toBeInTheDocument();
  });

  it("says nothing about coverage when everything is estimated", async () => {
    forProject.mockResolvedValue(
      schedule({ items: [item({ id: "a", title: "Estimated" })] }),
    );

    render(<SchedulePanel project={PROJECT} />);

    await screen.findByText("Estimated");

    expect(screen.queryByText(/of this work is estimated/)).not.toBeInTheDocument();
    expect(screen.queryByText(/unestimated/)).not.toBeInTheDocument();
  });

  /**
   * **A loop is a named refusal**, with the items in it — that list is the
   * remedy, and an empty panel would send somebody looking for a bug.
   */
  it("names the items in a loop rather than showing an empty schedule", async () => {
    forProject.mockResolvedValue(
      schedule({
        schedulable: false,
        reason: "cycle",
        explanation: "These items depend on each other in a loop, so no order satisfies them all.",
        cycle: [
          { id: "a", title: "Design the API", externalRef: "ACME-1" },
          { id: "b", title: "Build the client", externalRef: "ACME-2" },
        ],
        summary: null,
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText("These items wait for each other in a circle"),
    ).toBeInTheDocument();
    expect(screen.getByText("Design the API")).toBeInTheDocument();
    expect(screen.getByText("Build the client")).toBeInTheDocument();
    expect(screen.getByText(/Remove any one of the links/)).toBeInTheDocument();
  });

  /** A different situation from a loop, and it must not read as one. */
  it("distinguishes an empty project from a broken one", async () => {
    forProject.mockResolvedValue(
      schedule({
        schedulable: false,
        reason: "nothing_to_schedule",
        explanation: "There is no work to schedule.",
        summary: null,
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("Nothing to schedule yet")).toBeInTheDocument();
    expect(screen.queryByText(/circle/)).not.toBeInTheDocument();
  });

  it("filters to the critical path on request", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "a", title: "On the path" }),
          item({ id: "b", title: "Has room", isCritical: false, slackDays: 3 }),
        ],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("Has room")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Critical only" }));

    expect(screen.getByText("On the path")).toBeInTheDocument();
    expect(screen.queryByText("Has room")).not.toBeInTheDocument();
  });

  it("opens an item from its row", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    forProject.mockResolvedValue(
      schedule({ items: [item({ id: "a", title: "Design the API" })] }),
    );

    render(<SchedulePanel project={PROJECT} onOpenItem={onOpenItem} />);

    await user.click(await screen.findByRole("button", { name: "Design the API" }));

    expect(onOpenItem).toHaveBeenCalledWith("a");
  });

  /** Offsets, not dates: the schedule is derived and nothing is stored. */
  it("shows day offsets rather than calendar dates", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "a", title: "Design the API", earliestStart: 2, earliestFinish: 5 }),
        ],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(await screen.findByText("day 2 to 5")).toBeInTheDocument();
  });

  it("re-reads when a dependency changes elsewhere", async () => {
    forProject.mockResolvedValue(
      schedule({ items: [item({ id: "a", title: "Design the API" })] }),
    );

    const { rerender } = render(<SchedulePanel project={PROJECT} refreshKey={0} />);

    await screen.findByText("Design the API");
    expect(forProject).toHaveBeenCalledTimes(1);

    rerender(<SchedulePanel project={PROJECT} refreshKey={1} />);

    await waitFor(() => expect(forProject).toHaveBeenCalledTimes(2));
  });
  /* ---------------- dates, and what they allow for ---------------- */

  it("shows the run of dates and what was promised, without a verdict", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        summary: {
          ...schedule().summary!,
          startsOn: "2027-01-04",
          endsOn: "2027-01-22",
          targetEndsOn: "2027-01-15",
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(new RegExp(`${shown("2027-01-04")} to`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`promised ${shown("2027-01-15")}`)),
    ).toBeInTheDocument();
    /* The gap, counted — and stated as arithmetic rather than blame. */
    expect(
      screen.getByText(/5 working days earlier than the plan can manage/),
    ).toBeInTheDocument();
  });

  it("says nothing about a gap when the plan meets the promise", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        summary: {
          ...schedule().summary!,
          startsOn: "2027-01-04",
          endsOn: "2027-01-08",
          targetEndsOn: "2027-01-15",
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(new RegExp(`promised ${shown("2027-01-15")}`)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/earlier than the plan can manage/)).not.toBeInTheDocument();
  });

  /**
   * The two causes of "weekends only" have different remedies, so the server's
   * own sentence is shown rather than a generic one.
   */
  it("passes on the reason holidays were not counted", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        calendar: {
          basis: "weekends_only",
          reason:
            "Weekends are skipped. Public holidays are not, because XwiftHQ HRM, where they are kept, is not part of this subscription.",
          anchored: true,
          anchor: "2027-01-04",
          holidays: [],
          localHolidays: [],
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(/is not part of this subscription/),
    ).toBeInTheDocument();
  });

  it("counts the holidays it did skip", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        calendar: {
          basis: "weekends_and_holidays",
          reason: null,
          anchored: true,
          anchor: "2027-01-04",
          holidays: [{ name: "Founders Day", date: "2027-01-06", location: null }],
          localHolidays: [],
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(/Weekends and 1 public holiday are skipped/),
    ).toBeInTheDocument();
  });

  /** Dates hanging off today are not a plan, and must not look like one. */
  it("warns when the dates run from today for want of a start date", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        calendar: {
          basis: "weekends_only",
          reason: null,
          anchored: false,
          anchor: "2027-01-04",
          holidays: [],
          localHolidays: [],
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(/This project has no start date, so the dates run from today/),
    ).toBeInTheDocument();
  });

  /** A local holiday moved nothing, which is why a week can be quietly thin. */
  it("mentions holidays that closed only some locations", async () => {
    forProject.mockResolvedValue(
      schedule({
        items: [item({ id: "a", title: "Work" })],
        calendar: {
          basis: "weekends_only",
          reason: null,
          anchored: true,
          anchor: "2027-01-04",
          holidays: [],
          localHolidays: [
            { name: "Lagos State Day", date: "2027-01-06", location: "Lagos" },
          ],
        },
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    expect(
      await screen.findByText(/a holiday in some locations only/),
    ).toBeInTheDocument();
  });

  /* ---------------- the chart ---------------- */

  it("switches to the chart and back", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      schedule({ items: [item({ id: "a", title: "Design the API" })] }),
    );

    const { container } = render(<SchedulePanel project={PROJECT} />);

    await screen.findByText("Design the API");
    /* The chart's date rail, which the list has no equivalent of. */
    expect(container.querySelector(".select-none")).toBeNull();

    await user.click(screen.getByRole("button", { name: "chart" }));

    expect(container.querySelector(".select-none")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "list" }));

    expect(screen.getByText("cannot slip")).toBeInTheDocument();
  });

  /**
   * The chart is not filtered: a Gantt with rows removed has arrows pointing
   * at nothing, and the gaps read as data rather than as a filter.
   */
  it("keeps every row in the chart even while the list is filtered", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      schedule({
        items: [
          item({ id: "a", title: "On the path" }),
          item({
            id: "b",
            title: "Has room",
            isCritical: false,
            slackDays: 3,
            startsOn: "2027-01-06",
            endsOn: "2027-01-07",
          }),
        ],
      }),
    );

    render(<SchedulePanel project={PROJECT} />);

    await screen.findByText("Has room");

    await user.click(screen.getByRole("button", { name: "Critical only" }));
    await user.click(screen.getByRole("button", { name: "chart" }));

    expect(screen.getByRole("button", { name: /Has room/ })).toBeInTheDocument();
  });
});
