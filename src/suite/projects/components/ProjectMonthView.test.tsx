import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectMonthView from "./ProjectMonthView";
import type { CalendarDay, Project, ProjectMonth } from "@/lib/api/projects-client";

/**
 * The month view, and the one thing it exists to keep apart.
 *
 * A due date is a commitment somebody typed in. A scheduled date falls out of
 * estimates and moves when they do. **Drawing them the same way would make the
 * most useful thing on the screen invisible**, so these tests check they are
 * distinguishable, labelled, and that the disagreement between them is named.
 */

const { month } = vi.hoisted(() => ({ month: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, schedule: { ...actual.schedule, month } };
});

/* The list is a DataView, which reaches for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

function day(over: Partial<CalendarDay> & { date: string }): CalendarDay {
  return {
    isWeekend: false,
    holiday: null,
    due: [],
    starting: [],
    finishing: [],
    sprintStarts: [],
    sprintEnds: [],
    ...over,
  };
}

/** January 2027, with whichever days the test cares about filled in. */
function januaryWith(days: CalendarDay[], over: Partial<ProjectMonth> = {}): ProjectMonth {
  const all = Array.from({ length: 31 }, (_, i) => {
    const date = `2027-01-${String(i + 1).padStart(2, "0")}`;

    return days.find((d) => d.date === date) ?? day({ date });
  });

  return {
    year: 2027,
    month: 1,
    from: "2027-01-01",
    to: "2027-01-31",
    days: all,
    meta: {
      scheduled: true,
      scheduleReason: null,
      calendar: {
        basis: "weekends_only",
        reason: null,
        anchored: true,
        anchor: "2027-01-04",
        holidays: [],
        localHolidays: [],
      },
      counts: { due: 0, holidays: 0 },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  /* A fixed "now", so "this month" and the today marker are checkable. */
  vi.setSystemTime(new Date("2027-01-12T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProjectMonthView", () => {
  it("asks for the current month and renders every day in it", async () => {
    month.mockResolvedValue(januaryWith([]));

    render(<ProjectMonthView project={PROJECT} />);

    await waitFor(() =>
      expect(month).toHaveBeenCalledWith("acme-rebuild", { year: 2027, month: 1 }),
    );

    expect(await screen.findByText("January 2027")).toBeInTheDocument();
  });

  it("shows a due date as something somebody committed to", async () => {
    month.mockResolvedValue(
      januaryWith(
        [
          day({
            date: "2027-01-20",
            due: [
              {
                id: "a",
                dueOn: "2027-01-20",
                title: "Ship the API",
                externalRef: null,
                type: "task",
                isComplete: false,
                scheduledEndsOn: "2027-01-18",
                lateAgainstPlan: false,
              },
            ],
          }),
        ],
        { meta: { ...januaryWith([]).meta, counts: { due: 1, holidays: 0 } } },
      ),
    );

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByRole("button", { name: "Ship the API" })).toBeInTheDocument();
    expect(screen.getByText("1 due date")).toBeInTheDocument();
  });

  /**
   * **The disagreement, named.** A commitment the derived plan cannot meet is
   * what a manager opened this screen to find.
   */
  it("names a due date the plan cannot meet", async () => {
    month.mockResolvedValue(
      januaryWith([
        day({
          date: "2027-01-08",
          due: [
            {
              id: "a",
              dueOn: "2027-01-08",
              title: "Ship the API",
              externalRef: null,
              type: "task",
              isComplete: false,
              scheduledEndsOn: "2027-01-15",
              lateAgainstPlan: true,
            },
          ],
        }),
      ]),
    );

    render(<ProjectMonthView project={PROJECT} />);

    const due = await screen.findByRole("button", { name: /Ship the API/ });

    expect(due).toHaveAttribute(
      "title",
      "Due today. The plan cannot finish it before 2027-01-15.",
    );
  });

  /** The two marks are told apart in words, not only by colour. */
  it("says which marks are commitments and which are derived", async () => {
    month.mockResolvedValue(januaryWith([]));

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText(/is a due date somebody set/)).toBeInTheDocument();
    expect(
      screen.getByText(/worked out from the estimates and moves when they do/),
    ).toBeInTheDocument();
  });

  it("marks a derived finish differently from a due date", async () => {
    month.mockResolvedValue(
      januaryWith([
        day({
          date: "2027-01-15",
          finishing: [
            {
              id: "b",
              title: "Derived finish",
              externalRef: null,
              isCritical: true,
              isEstimated: true,
            },
          ],
        }),
      ]),
    );

    render(<ProjectMonthView project={PROJECT} />);

    const mark = await screen.findByRole("button", { name: "Derived finish" });

    expect(mark).toHaveAttribute(
      "title",
      "Scheduled to finish today, on the critical path",
    );
  });

  it("shows sprint boundaries", async () => {
    month.mockResolvedValue(
      januaryWith([
        day({
          date: "2027-01-04",
          sprintStarts: [{ id: "s1", name: "Sprint 1", sequence: 1, status: "active" }],
        }),
        day({
          date: "2027-01-15",
          sprintEnds: [{ id: "s1", name: "Sprint 1", sequence: 1, status: "active" }],
        }),
      ]),
    );

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText("Sprint 1 starts")).toBeInTheDocument();
    expect(screen.getByText("Sprint 1 ends")).toBeInTheDocument();
  });

  /**
   * A located holiday moved no dates — which is why a week can be thin while
   * the chart shows nothing unusual.
   */
  it("distinguishes a holiday that closes one office from one that closes them all", async () => {
    month.mockResolvedValue(
      januaryWith([
        day({
          date: "2027-01-06",
          holiday: {
            name: "Lagos State Day",
            date: "2027-01-06",
            location: "Lagos",
            closesEverywhere: false,
          },
        }),
        day({
          date: "2027-01-07",
          holiday: {
            name: "Founders Day",
            date: "2027-01-07",
            location: null,
            closesEverywhere: true,
          },
        }),
      ]),
    );

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText("Lagos State Day")).toBeInTheDocument();
    expect(screen.getByText("(Lagos)")).toBeInTheDocument();

    /* The one that closes everywhere carries no location qualifier. */
    expect(screen.getByText("Founders Day")).toBeInTheDocument();
  });

  /**
   * A loop costs the derived layer alone. The other three are still facts, and
   * the screen says which one is missing rather than quietly dropping it.
   */
  it("says the derived layer is missing without losing the other three", async () => {
    month.mockResolvedValue(
      januaryWith(
        [
          day({
            date: "2027-01-20",
            due: [
              {
                id: "a",
                dueOn: "2027-01-20",
                title: "Still due",
                externalRef: null,
                type: "task",
                isComplete: false,
                scheduledEndsOn: null,
                lateAgainstPlan: false,
              },
            ],
          }),
        ],
        {
          meta: {
            ...januaryWith([]).meta,
            scheduled: false,
            scheduleReason: "cycle",
          },
        },
      ),
    );

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText(/wait for each other in a circle/)).toBeInTheDocument();
    expect(screen.getByText(/Due dates, sprints and holidays below are unaffected/))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Still due" })).toBeInTheDocument();
  });

  it("distinguishes an empty project from a looping one", async () => {
    month.mockResolvedValue(
      januaryWith([], {
        meta: {
          ...januaryWith([]).meta,
          scheduled: false,
          scheduleReason: "nothing_to_schedule",
        },
      }),
    );

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText(/no work to schedule yet/)).toBeInTheDocument();
    expect(screen.queryByText(/circle/)).not.toBeInTheDocument();
  });

  it("pages to the next month and back to today", async () => {
    const user = userEvent.setup();

    month.mockImplementation((_slug: string, when: { year: number; month: number }) =>
      Promise.resolve({ ...januaryWith([]), year: when.year, month: when.month }),
    );

    render(<ProjectMonthView project={PROJECT} />);

    await screen.findByText("January 2027");

    await user.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() =>
      expect(month).toHaveBeenCalledWith("acme-rebuild", { year: 2027, month: 2 }),
    );
    expect(await screen.findByText("February 2027")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(await screen.findByText("January 2027")).toBeInTheDocument();
  });

  /** December to January has to roll the year, not produce month 13. */
  it("rolls the year at the December boundary", async () => {
    vi.setSystemTime(new Date("2027-12-10T09:00:00Z"));

    const user = userEvent.setup();

    month.mockImplementation((_slug: string, when: { year: number; month: number }) =>
      Promise.resolve({ ...januaryWith([]), year: when.year, month: when.month }),
    );

    render(<ProjectMonthView project={PROJECT} />);

    await waitFor(() =>
      expect(month).toHaveBeenCalledWith("acme-rebuild", { year: 2027, month: 12 }),
    );

    await user.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() =>
      expect(month).toHaveBeenCalledWith("acme-rebuild", { year: 2028, month: 1 }),
    );
  });

  it("opens an item from the grid", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    month.mockResolvedValue(
      januaryWith([
        day({
          date: "2027-01-20",
          due: [
            {
              id: "item-1",
              dueOn: "2027-01-20",
              title: "Ship the API",
              externalRef: null,
              type: "task",
              isComplete: false,
              scheduledEndsOn: null,
              lateAgainstPlan: false,
            },
          ],
        }),
      ]),
    );

    render(<ProjectMonthView project={PROJECT} onOpenItem={onOpenItem} />);

    await user.click(await screen.findByRole("button", { name: "Ship the API" }));

    expect(onOpenItem).toHaveBeenCalledWith("item-1");
  });

  /** "Nothing due in July" is a fact about July, not a failure. */
  it("renders a quiet month as an ordinary grid", async () => {
    month.mockResolvedValue(januaryWith([]));

    render(<ProjectMonthView project={PROJECT} />);

    expect(await screen.findByText("0 due dates")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("puts the first of the month under its weekday", async () => {
    month.mockResolvedValue(januaryWith([]));

    const { container } = render(<ProjectMonthView project={PROJECT} />);

    await screen.findByText("January 2027");

    /* 1 January 2027 is a Friday, so four blanks precede it. */
    const grid = container.querySelector("[aria-busy]");

    expect(within(grid as HTMLElement).getAllByText("1")).toHaveLength(1);
    expect(grid?.querySelectorAll(".bg-neutral-50\\/50")).toHaveLength(4);
  });
});
