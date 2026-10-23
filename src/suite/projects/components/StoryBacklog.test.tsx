import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoryBacklog from "./StoryBacklog";
import { openCombobox } from "@/test/selectOption";
import type { BoardSetup, Project, Sprint, StoryRow, WorkItem } from "@/lib/api/projects-client";

/**
 * The backlog read as stories.
 *
 * The rule defended here: **scheduling is done to a story**, through `move`
 * with a `sprintId`, and the server carries the story's unfinished tasks with
 * it. Offered only to somebody who manages the board.
 */

const { storiesList, move, complete } = vi.hoisted(() => ({
  storiesList: vi.fn(),
  move: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    stories: { ...actual.stories, list: storiesList },
    workItems: { ...actual.workItems, move, complete },
  };
});

const SETUP: BoardSetup = {
  statuses: [
    { id: "s-todo", key: "to_do", label: "To Do", position: 1, countsAsComplete: false, isDefault: true },
    { id: "s-done", key: "done", label: "Done", position: 2, countsAsComplete: true },
  ],
  disciplines: [],
  assignees: [{ id: "u-me", name: "Ada Lovelace", role: "member" }],
};

const SPRINTS = [
  { id: "sp-2", name: "Sprint 2", sequence: 2, status: "planning", acceptsChanges: true },
  { id: "sp-1", name: "Sprint 1", sequence: 1, status: "closed", acceptsChanges: false },
] as Sprint[];

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

const STORY: StoryRow = {
  ...wi({ id: "st-1", parentId: null, type: "story", typeLabel: "User story", title: "Sign in with email" }),
  epic: { id: "ep-1", title: "Accounts" },
  progress: { total: 1, done: 0, percent: 0 },
  assignees: [],
  bugCount: 0,
  tasks: [wi()],
};

function renderList(project: Partial<Project["can"]> = { manageBoard: true }) {
  return render(
    <StoryBacklog
      project={{ slug: "acme", name: "Acme", can: project } as Project}
      setup={SETUP}
      sprints={SPRINTS}
      viewerId="u-me"
      onOpenItem={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  storiesList.mockResolvedValue({
    data: [STORY],
    meta: {
      total: 1,
      perPage: 250,
      currentPage: 1,
      lastPage: 1,
      loose: [wi({ id: "b-1", parentId: null, type: "bug", typeLabel: "Bug", title: "Footer overlaps" })],
    },
  });
  move.mockResolvedValue(wi({ id: "st-1", type: "story", sprintId: "sp-2" }));
});

describe("the story backlog", () => {
  it("groups stories under their epic and lists loose work apart", async () => {
    renderList();

    const epic = await screen.findByRole("region", { name: "Accounts" });
    expect(within(epic).getByText("Sign in with email")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Not in a story" })).getByText("Footer overlaps")).toBeInTheDocument();
  });

  it("opens a row to show its tasks", async () => {
    renderList();

    const row = await screen.findByRole("button", { name: /Sign in with email/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Build the sign-in form")).not.toBeInTheDocument();

    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Build the sign-in form")).toBeInTheDocument();
  });

  it("moves a story into a sprint with move and a sprintId", async () => {
    renderList();

    const pick = await screen.findByRole("combobox", { name: "Move “Sign in with email” to a sprint" });

    const list = await openCombobox(userEvent.setup(), pick);

    /* A closed sprint is no destination. */
    expect(within(list).queryByRole("option", { name: /Sprint 1/ })).not.toBeInTheDocument();

    await userEvent.click(within(list).getByRole("option", { name: "Sprint 2" }));

    await waitFor(() => expect(move).toHaveBeenCalledWith("st-1", { sprintId: "sp-2" }));
    await waitFor(() => expect(screen.queryByText("Sign in with email")).not.toBeInTheDocument());
  });

  it("gives each row its points, hours from tasks and dates", async () => {
    storiesList.mockResolvedValue({
      data: [
        {
          ...STORY,
          estimatePoints: 5,
          startsOn: "2026-09-25",
          dueOn: "2026-10-01",
          rollup: { hours: 34, estimated: 5, total: 6 },
        },
      ],
      meta: { total: 1, perPage: 250, currentPage: 1, lastPage: 1, loose: [] },
    });
    renderList();

    const row = await screen.findByRole("button", { name: /Sign in with email/ });
    expect(within(row).getByTitle("5 story points")).toBeInTheDocument();
    expect(within(row).getByText("34h")).toBeInTheDocument();
    expect(within(row).getByText("25 Sep – 1 Oct")).toBeInTheDocument();
  });

  it("adds nothing to a row that has no plan facts", async () => {
    renderList();

    const row = await screen.findByRole("button", { name: /Sign in with email/ });
    expect(within(row).queryByTitle(/story point/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/^\d+(\.\d)?h$/)).not.toBeInTheDocument();
    expect(within(row).queryByText(/Sep|Oct|Due|From/)).not.toBeInTheDocument();
  });

  it("offers no scheduling to somebody who does not manage the board", async () => {
    renderList({ manageBoard: false });

    await screen.findByText("Sign in with email");
    expect(screen.queryByRole("combobox", { name: /to a sprint/ })).not.toBeInTheDocument();
  });
});
