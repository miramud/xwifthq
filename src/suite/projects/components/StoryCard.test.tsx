import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoryCard, shortSpan, storyPoints, storyRollup } from "./StoryCard";
import type { StoryRow, WorkItem } from "@/lib/api/projects-client";

/**
 * The plan facts on a story card: points, hours from tasks, and when it runs.
 *
 * The card stays a summary, and every fact is optional — stories written
 * before the planner carry none of them, and a card of "—" says nothing.
 */

function wi(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "t-1",
    projectId: "p-1",
    sprintId: null,
    parentId: "st-1",
    type: "task",
    typeLabel: "Task",
    countsTowardsVelocity: true,
    title: "Build the sign-in form",
    description: null,
    expectedOutcome: null,
    isComplete: false,
    discipline: null,
    assignee: null,
    estimateHours: null,
    estimatePoints: null,
    dueOn: null,
    priority: 2,
    isMilestone: false,
    blockedReason: null,
    externalRef: null,
    position: 1,
    completedAt: null,
    bounceBacks: 0,
    can: { move: true, update: true, delete: false },
    createdAt: null,
    ...overrides,
  };
}

function story(overrides: Partial<StoryRow> = {}): StoryRow {
  return {
    ...wi({ id: "st-1", parentId: null, type: "story", typeLabel: "User story", title: "Sign in with email" }),
    epic: null,
    progress: { total: 2, done: 0, percent: 0 },
    assignees: [],
    bugCount: 0,
    tasks: [wi(), wi({ id: "t-2" })],
    ...overrides,
  };
}

const drag = { onDragStart: vi.fn(), onDragEnd: vi.fn() };

describe("the story card's plan facts", () => {
  it("shows points, hours from tasks and a short date span", () => {
    render(
      <StoryCard
        story={story({
          estimatePoints: 5,
          startsOn: "2026-09-25",
          dueOn: "2026-10-01",
          rollup: { hours: 34, estimated: 5, total: 6 },
        })}
        onOpen={vi.fn()}
        {...drag}
      />,
    );

    expect(screen.getByTitle("5 story points")).toHaveTextContent("5pts");
    expect(screen.getByText("34h")).toHaveAttribute("title", "34h from tasks, 5 of 6 estimated");
    expect(screen.getByText("25 Sep – 1 Oct")).toBeInTheDocument();
  });

  it("shows none of them on a story that has none", () => {
    render(<StoryCard story={story()} onOpen={vi.fn()} {...drag} />);

    expect(screen.queryByTitle(/story point/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\dh$/)).not.toBeInTheDocument();
    expect(screen.queryByTitle("Planned dates")).not.toBeInTheDocument();
    /* The existing summary is untouched. */
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  it("draws no hours when the rollup says nothing is estimated", () => {
    render(
      <StoryCard story={story({ rollup: { hours: null, estimated: 0, total: 2 } })} onOpen={vi.fn()} {...drag} />,
    );

    expect(screen.queryByText(/\dh$/)).not.toBeInTheDocument();
  });
});

describe("plan fact helpers", () => {
  it("shortens a span, and says which end is missing", () => {
    expect(shortSpan(null, null)).toBeNull();
    expect(shortSpan(undefined, "2026-10-01")).toBe("Due 1 Oct");
    expect(shortSpan("2026-09-25", null)).toBe("From 25 Sep");
    expect(shortSpan("2026-09-25", "2026-09-25")).toBe("25 Sep");
    expect(shortSpan("2026-12-28", "2027-01-04")).toBe("28 Dec 2026 – 4 Jan 2027");
  });

  it("works hours out from the tasks when the server sent no rollup, treating zero as unestimated", () => {
    expect(
      storyRollup({ tasks: [wi({ estimateHours: 6 }), wi({ estimateHours: 0 }), wi({ estimateHours: 2.5 })] }),
    ).toEqual({ hours: 8.5, estimated: 2, total: 3 });
    expect(storyRollup({ tasks: [wi()] })).toEqual({ hours: null, estimated: 0, total: 1 });
    expect(storyRollup({ rollup: { hours: 34, estimated: 5, total: 6 }, tasks: [] })).toEqual({
      hours: 34,
      estimated: 5,
      total: 6,
    });
  });
});

/* D22: imported points sit on the tasks; the story shows their sum. */
describe("story points from tasks", () => {
  it("shows the server's sum of task points when the story has none of its own", () => {
    render(<StoryCard story={story({ taskPoints: 8 })} onOpen={vi.fn()} {...drag} />);

    expect(screen.getByTitle("8 story points, the sum of its tasks' points")).toHaveTextContent("8pts");
  });

  it("prefers the story's own points", () => {
    expect(storyPoints(story({ estimatePoints: 5, taskPoints: 8 }))).toEqual({ points: 5, summed: false });
  });

  it("sums the tasks itself when the payload carries no total, and says nothing when none is pointed", () => {
    const tasks = [wi({ estimatePoints: 3 }), wi({ id: "t-2", estimatePoints: 2 }), wi({ id: "t-3" })];

    expect(storyPoints(story({ tasks }))).toEqual({ points: 5, summed: true });
    expect(storyPoints(story())).toEqual({ points: null, summed: false });
    expect(storyPoints(story({ taskPoints: null }))).toEqual({ points: null, summed: false });
  });
});
