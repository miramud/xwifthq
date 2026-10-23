import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoryDrawer from "./StoryDrawer";
import type { BoardSetup, Project, StoryRow, WorkItem } from "@/lib/api/projects-client";

/**
 * The plan in the story drawer: dates, points, hours from tasks, possible
 * blockers apart from blocked-now, and each task's hours and dates.
 */

const SETUP: BoardSetup = {
  statuses: [{ id: "s-todo", key: "to_do", label: "To Do", position: 1, countsAsComplete: false, isDefault: true }],
  disciplines: [],
  assignees: [],
};

function wi(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "t-1",
    projectId: "p-1",
    sprintId: null,
    parentId: "st-1",
    type: "task",
    typeLabel: "Task",
    countsTowardsVelocity: true,
    title: "Build the login endpoint",
    description: null,
    expectedOutcome: null,
    status: SETUP.statuses[0],
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
    progress: { total: 1, done: 0, percent: 0 },
    assignees: [],
    bugCount: 0,
    tasks: [wi()],
    ...overrides,
  };
}

function open(s: StoryRow) {
  return render(
    <StoryDrawer
      story={s}
      project={{ slug: "acme", name: "Acme", can: { manageBoard: true } } as Project}
      setup={SETUP}
      error={null}
      onTick={vi.fn()}
      onAssign={vi.fn()}
      onAddTask={vi.fn().mockResolvedValue(true)}
      onClose={vi.fn()}
    />,
  );
}

describe("the story drawer's plan", () => {
  it("shows the dates, points and hours from tasks", () => {
    open(
      story({
        startsOn: "2026-09-25",
        dueOn: "2026-10-01",
        estimatePoints: 5,
        rollup: { hours: 34, estimated: 5, total: 6 },
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("25 Sep – 1 Oct 2026")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("5 points");
    expect(within(dialog).getByText("34h").parentElement).toHaveTextContent("34h from tasks (5 of 6 estimated)");
  });

  it("keeps possible blockers apart from what blocks it now", () => {
    open(story({ blockedReason: "Staging is down", possibleBlockers: "Client SSO details may be late" }));

    const risks = screen.getByRole("heading", { name: "Possible blockers" }).closest("section");
    const now = screen.getByRole("heading", { name: "Blocked now" }).closest("section");

    expect(risks).toHaveTextContent("Client SSO details may be late");
    expect(now).toHaveTextContent("Staging is down");
    expect(risks).not.toBe(now);
    expect(risks?.className).toContain("border-dashed");
  });

  it("gives each task its hours and dates", () => {
    open(story({ tasks: [wi({ estimateHours: 6, startsOn: "2026-09-25", dueOn: "2026-09-26" })] }));

    const row = screen.getByText("Build the login endpoint").closest("li") as HTMLElement;
    expect(within(row).getByText("6h")).toBeInTheDocument();
    expect(within(row).getByText("25 Sep – 26 Sep")).toBeInTheDocument();
  });

  it("shows none of it on a story written before the planner", () => {
    open(story());

    expect(screen.queryByText("Planned dates")).not.toBeInTheDocument();
    expect(screen.queryByText(/from tasks/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Possible blockers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Blocked now" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+(\.\d)?h$/)).not.toBeInTheDocument();
  });
});

/*
  P25: the per-task "Assign" select in the drawer reportedly did not save. In
  code it is wired straight to onAssign (and from there to `useStories.assign`,
  which PATCHes the item); these pin that the pick reaches it, by mouse and by
  keyboard, and does not close the drawer on the way.
*/
describe("assigning a task from the drawer", () => {
  const PEOPLE: BoardSetup = {
    ...SETUP,
    assignees: [{ id: "u-2", name: "Bola Ade" }] as BoardSetup["assignees"],
  };

  function drawer() {
    const onAssign = vi.fn();
    const onClose = vi.fn();
    render(
      <StoryDrawer
        story={story()}
        project={{ slug: "acme", name: "Acme", can: { manageBoard: true } } as Project}
        setup={PEOPLE}
        error={null}
        onTick={vi.fn()}
        onAssign={onAssign}
        onAddTask={vi.fn().mockResolvedValue(true)}
        onClose={onClose}
      />,
    );
    return { onAssign, onClose };
  }

  it("passes a person picked with the mouse to onAssign and keeps the drawer open", async () => {
    const user = userEvent.setup();
    const { onAssign, onClose } = drawer();

    await user.click(screen.getByRole("combobox", { name: "Assign “Build the login endpoint”" }));
    await user.click(screen.getByRole("option", { name: "Bola Ade" }));

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "t-1" }), "u-2");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("passes a person picked from the keyboard to onAssign", async () => {
    const user = userEvent.setup();
    const { onAssign } = drawer();

    screen.getByRole("combobox", { name: "Assign “Build the login endpoint”" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "t-1" }), "u-2");
  });
});
