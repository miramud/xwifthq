import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GanttChart from "./GanttChart";
import type { Schedule, ScheduleItem } from "@/lib/api/projects-client";

/**
 * The chart, and the arithmetic it must not redo.
 *
 * **A CPM finish is an exclusive boundary**, so the server already hands over
 * `endsOn` as the last day work occupies. A client that recomputed it from the
 * offsets draws every bar a day too long — the single easiest way to ship a
 * Gantt that looks right and is wrong by a week across a project. These tests
 * check the bars are measured from the dates, inclusive of both ends.
 *
 * The rest defend what the chart is *for*: slack visible behind the bar,
 * non-working days shaded rather than compressed away, and the promised date
 * shown beside the derived one without a verdict attached.
 */

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
      itemCount: 1,
      criticalCount: 1,
      dependencyCount: 0,
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

beforeEach(() => {
  vi.setSystemTime(new Date("2027-01-06T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GanttChart", () => {
  /**
   * Monday the 4th to Tuesday the 5th is **two** days, not three. A bar drawn
   * from the offsets rather than the dates gets this wrong.
   */
  it("measures a bar inclusively from its first to its last day", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [item({ id: "a", title: "Two days", startsOn: "2027-01-04", endsOn: "2027-01-05" })],
        })}
      />,
    );

    const bar = screen.getByRole("button", { name: /Two days/ });

    /* DAY is 22px, less the 2px gutter: two days is 42, three would be 64. */
    expect(bar.style.width).toBe("42px");
    expect(container).toBeTruthy();
  });

  it("offsets a bar by the days before it", () => {
    render(
      <GanttChart
        data={schedule({
          items: [
            item({ id: "a", title: "First", startsOn: "2027-01-04", endsOn: "2027-01-04" }),
            item({ id: "b", title: "Second", startsOn: "2027-01-06", endsOn: "2027-01-06" }),
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /First/ }).style.left).toBe("0px");
    /* Two days later, and the chart starts on the 4th. */
    expect(screen.getByRole("button", { name: /Second/ }).style.left).toBe("44px");
  });

  /** A weekend is shaded, not skipped: the chart has to match the wall. */
  it("shades weekends rather than compressing them away", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [item({ id: "a", title: "Across a weekend", startsOn: "2027-01-08", endsOn: "2027-01-11" })],
        })}
      />,
    );

    /* 8th to 11th spans Sat and Sun, so the bar covers four days, not two. */
    expect(screen.getByRole("button", { name: /Across a weekend/ }).style.width).toBe("86px");
    expect(container.querySelectorAll(".bg-neutral-50").length).toBeGreaterThan(0);
  });

  it("names a holiday on the day it shades", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [item({ id: "a", title: "Work", startsOn: "2027-01-04", endsOn: "2027-01-07" })],
          calendar: {
            basis: "weekends_and_holidays",
            reason: null,
            anchored: true,
            anchor: "2027-01-04",
            holidays: [{ name: "Founders Day", date: "2027-01-06", location: null }],
            localHolidays: [],
          },
        })}
      />,
    );

    expect(container.querySelector('[title="Founders Day"]')).not.toBeNull();
    expect(screen.getByText(/Shaded: weekends and Founders Day/)).toBeInTheDocument();
  });

  /** Slack behind the bar is the difference between "long" and "immovable". */
  it("draws slack behind an item that can move", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [
            item({
              id: "a",
              title: "Has room",
              isCritical: false,
              slackDays: 2,
              startsOn: "2027-01-04",
              endsOn: "2027-01-04",
              latestEndsOn: "2027-01-06",
            }),
          ],
        })}
      />,
    );

    const slack = container.querySelector(".bg-neutral-100");

    expect(slack).not.toBeNull();
    /* One day of bar plus two of slack. */
    expect((slack as HTMLElement).style.width).toBe("64px");
  });

  it("draws no slack behind something on the critical path", () => {
    const { container } = render(
      <GanttChart
        data={schedule({ items: [item({ id: "a", title: "Cannot move" })] })}
      />,
    );

    expect(container.querySelector(".bg-neutral-100")).toBeNull();
  });

  /** Unestimated work is a dashed marker, never a solid day of work. */
  it("marks an unestimated item rather than drawing it as a day", () => {
    render(
      <GanttChart
        data={schedule({
          items: [
            item({
              id: "a",
              title: "No estimate",
              isEstimated: false,
              durationDays: 0,
              startsOn: "2027-01-04",
              endsOn: "2027-01-04",
            }),
          ],
        })}
      />,
    );

    const bar = screen.getByRole("button", { name: /No estimate/ });

    expect(bar.className).toContain("border-dashed");
    expect(bar).toHaveAttribute(
      "title",
      "No estimate: no estimate, so it takes no time in this plan",
    );
  });

  it("tells the critical path apart from the rest", () => {
    render(
      <GanttChart
        data={schedule({
          items: [
            item({ id: "a", title: "Critical" }),
            item({ id: "b", title: "Not", isCritical: false, slackDays: 3 }),
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /Critical/ }).className).toContain("bg-error-500");
    expect(screen.getByRole("button", { name: /^Not/ }).className).toContain("bg-primary-500");
  });

  /**
   * A target a month past the last bar is exactly the case worth seeing, so
   * the span stretches to include it rather than cropping it out.
   */
  it("widens the chart to reach a promised date beyond the work", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [item({ id: "a", title: "Work", startsOn: "2027-01-04", endsOn: "2027-01-05" })],
          summary: {
            ...schedule().summary!,
            targetEndsOn: "2027-01-20",
          },
        })}
      />,
    );

    expect(container.querySelector(".border-accent-500")).not.toBeNull();
  });

  it("draws an arrow between an item and what it waits for", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [
            item({ id: "a", title: "First", startsOn: "2027-01-04", endsOn: "2027-01-04" }),
            item({
              id: "b",
              title: "Second",
              startsOn: "2027-01-06",
              endsOn: "2027-01-06",
              dependsOn: ["a"],
            }),
          ],
        })}
      />,
    );

    expect(container.querySelector("svg")).not.toBeNull();
  });

  /** An overlap is legitimate and unreadable as a backwards line. */
  it("draws no arrow where a lead makes it run backwards", () => {
    const { container } = render(
      <GanttChart
        data={schedule({
          items: [
            item({ id: "a", title: "First", startsOn: "2027-01-06", endsOn: "2027-01-08" }),
            item({
              id: "b",
              title: "Overlapping",
              startsOn: "2027-01-04",
              endsOn: "2027-01-05",
              dependsOn: ["a"],
            }),
          ],
        })}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("opens an item from its bar", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    render(
      <GanttChart
        data={schedule({ items: [item({ id: "a", title: "Design the API" })] })}
        onOpenItem={onOpenItem}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Design the API/ }));

    expect(onOpenItem).toHaveBeenCalledWith("a");
  });

  it("draws nothing at all when there is no schedule", () => {
    const { container } = render(
      <GanttChart
        data={schedule({ schedulable: false, reason: "cycle", summary: null })}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
