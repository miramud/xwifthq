import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoryBoard from "./StoryBoard";
import { chooseOption, comboboxValue } from "@/test/selectOption";
import {
  ApiError,
  type BoardSetup,
  type Project,
  type StoryRow,
  type WorkItem,
  type WorkItemStatus,
} from "@/lib/api/projects-client";

/**
 * The story board.
 *
 * What the owner asked for, and what these defend:
 *
 * - **A card is a user story, and a summary only**, epic, title, a progress
 *   line, how many tasks, who is on it. No task titles on the card.
 * - **Clicking a card shows the whole story**: its description and every task
 *   with whether it is done.
 * - **Ticking a task moves the progress line at once**, and a refusal puts it
 *   back and says why, the board's standing promise about optimistic moves.
 * - **Only somebody who may move a task can tick it.**
 */

const { storiesList, complete, move, update, create } = vi.hoisted(() => ({
  storiesList: vi.fn(),
  complete: vi.fn(),
  move: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    stories: { ...actual.stories, list: storiesList },
    workItems: { ...actual.workItems, complete, move, update, create },
  };
});

const STATUSES: WorkItemStatus[] = [
  { id: "s-todo", key: "to_do", label: "To Do", position: 1, countsAsComplete: false, isDefault: true },
  { id: "s-prog", key: "in_progress", label: "In Progress", position: 2, countsAsComplete: false },
  { id: "s-done", key: "done", label: "Done", position: 3, countsAsComplete: true },
];

const SETUP: BoardSetup = {
  statuses: STATUSES,
  disciplines: [],
  assignees: [
    { id: "u-me", name: "Ada Lovelace", role: "member" },
    { id: "u-2", name: "Grace Hopper", role: "member" },
  ],
};

const PROJECT = { slug: "acme", name: "Acme", can: { manageBoard: true } } as Project;

function wi(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "t-1",
    projectId: "p-1",
    sprintId: "sp-1",
    parentId: "st-1",
    type: "task",
    typeLabel: "Task",
    countsTowardsVelocity: true,
    title: "Build the sign-in form",
    description: null,
    expectedOutcome: null,
    status: STATUSES[0],
    isComplete: false,
    discipline: null,
    assignee: { id: "u-me", name: "Ada Lovelace" },
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

function story(tasks: WorkItem[], overrides: Partial<StoryRow> = {}): StoryRow {
  const done = tasks.filter((t) => t.isComplete).length;

  return {
    ...wi({ id: "st-1", parentId: null, type: "story", typeLabel: "User story", title: "Sign in with email" }),
    description: "As a member\nI want to sign in\nSo that I see my work",
    expectedOutcome: "A member lands on their dashboard",
    epic: { id: "ep-1", title: "Accounts" },
    progress: { total: tasks.length, done, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 },
    assignees: [
      { id: "u-me", name: "Ada Lovelace" },
      { id: "u-2", name: "Grace Hopper" },
    ],
    bugCount: tasks.filter((t) => t.type === "bug").length,
    tasks,
    ...overrides,
  };
}

const TASKS = [
  wi({ id: "t-1", title: "Build the sign-in form" }),
  wi({ id: "t-2", title: "Wire the session cookie", assignee: { id: "u-2", name: "Grace Hopper" } }),
  wi({ id: "t-3", title: "Login loops on Safari", type: "bug", typeLabel: "Bug", isComplete: true, status: STATUSES[2] }),
];

function respond(rows: StoryRow[], loose: WorkItem[] = []) {
  storiesList.mockResolvedValue({
    data: rows,
    meta: { total: rows.length, perPage: 250, currentPage: 1, lastPage: 1, loose },
  });
}

function renderBoard(props: Partial<React.ComponentProps<typeof StoryBoard>> = {}) {
  return render(
    <StoryBoard project={PROJECT} setup={SETUP} sprintId="sp-1" viewerId="u-me" onOpenItem={vi.fn()} {...props} />,
  );
}

async function openCard() {
  const card = await screen.findByRole("button", { name: /Sign in with email/ });
  await userEvent.click(card);

  return screen.findByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  respond([story(TASKS)]);
});

describe("the story card", () => {
  it("asks for the sprint's stories", async () => {
    renderBoard();

    await screen.findByText("Sign in with email");
    expect(storiesList).toHaveBeenCalledWith("acme", expect.objectContaining({ sprintId: "sp-1" }));
  });

  it("asks for the product backlog when given no sprint", async () => {
    renderBoard({ sprintId: undefined });

    await screen.findByText("Sign in with email");
    expect(storiesList).toHaveBeenCalledWith("acme", expect.objectContaining({ backlog: true }));
  });

  it("shows a summary: epic, counts, people and progress, and no task titles", async () => {
    renderBoard();

    const card = await screen.findByRole("button", { name: /Sign in with email/ });

    expect(within(card).getByText("Accounts")).toBeInTheDocument();
    expect(within(card).getByText("2 tasks")).toBeInTheDocument();
    expect(within(card).getByText("1 bug")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 3 tasks done");
    expect(within(card).getByText("33%")).toBeInTheDocument();
    expect(within(card).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(card).getByText("Grace Hopper")).toBeInTheDocument();

    expect(screen.queryByText("Build the sign-in form")).not.toBeInTheDocument();
    expect(screen.queryByText("Wire the session cookie")).not.toBeInTheDocument();
  });

  it("puts the story in the column of its own status", async () => {
    respond([story(TASKS, { status: STATUSES[1] })]);
    renderBoard();

    const lane = await screen.findByRole("region", { name: /In Progress/ });
    expect(within(lane).getByText("Sign in with email")).toBeInTheDocument();
  });

  it("shows loose work as compact cards labelled as not in a story", async () => {
    respond([story(TASKS)], [wi({ id: "b-9", parentId: null, type: "bug", typeLabel: "Bug", title: "Footer overlaps" })]);
    renderBoard();

    const card = await screen.findByRole("button", { name: /not in a story: Footer overlaps/ });
    expect(within(card).getByText("Not in a story")).toBeInTheDocument();
  });

  it("explains what to do when there are no stories at all", async () => {
    respond([]);
    renderBoard({ onNewItem: vi.fn() });

    expect(await screen.findByText("No stories in this sprint")).toBeInTheDocument();
    expect(screen.getByText(/import a sheet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a story" })).toBeInTheDocument();
  });

  it("moves a story between columns optimistically, and back when refused", async () => {
    move.mockRejectedValue(new ApiError("Not yours to move.", 403));
    renderBoard();

    await screen.findByText("Sign in with email");
    const lane = screen.getByRole("region", { name: /In Progress/ });

    fireEvent.drop(lane, { dataTransfer: { getData: () => "st-1", setData: () => {} } });

    await waitFor(() => expect(move).toHaveBeenCalledWith("st-1", { statusId: "s-prog" }));
    expect(await screen.findByText("Not yours to move.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /To Do/ })).getByText("Sign in with email")).toBeInTheDocument();
  });

  it("moves a story one column with Alt+Arrow from the keyboard", async () => {
    move.mockResolvedValue(wi({ id: "st-1", type: "story", status: STATUSES[1] }));
    renderBoard();

    const card = await screen.findByRole("button", { name: /Sign in with email/ });
    card.focus();
    fireEvent.keyDown(card, { key: "ArrowRight", altKey: true });

    await waitFor(() => expect(move).toHaveBeenCalledWith("st-1", { statusId: "s-prog" }));
    expect(screen.getByText(/Moved “Sign in with email” to In Progress/)).toBeInTheDocument();
  });
});

describe("the story drawer", () => {
  it("opens with the full description, the outcome and every task", async () => {
    renderBoard();
    const dialog = await openCard();

    /* Line breaks kept: the description is one element with its newlines. */
    expect(within(dialog).getByText(/As a member\s+I want to sign in/)).toHaveClass("whitespace-pre-line");
    expect(within(dialog).getByText("A member lands on their dashboard")).toBeInTheDocument();
    expect(within(dialog).getByText("Build the sign-in form")).toBeInTheDocument();
    expect(within(dialog).getByText("Wire the session cookie")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: /“Login loops on Safari” not done/ })).toBeChecked();
  });

  it("opens from the keyboard too", async () => {
    renderBoard();

    const card = await screen.findByRole("button", { name: /Sign in with email/ });
    card.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("ticks a task done and moves the progress at once", async () => {
    let resolve: (v: WorkItem) => void = () => {};
    complete.mockReturnValue(new Promise<WorkItem>((r) => (resolve = r)));
    renderBoard();
    const dialog = await openCard();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Mark “Build the sign-in form” done" }));

    expect(complete).toHaveBeenCalledWith("t-1", true);
    /* Before the server answers: optimistic. */
    expect(within(dialog).getByRole("progressbar", { name: "Story progress" })).toHaveAttribute(
      "aria-valuetext",
      "2 of 3 tasks done",
    );
    const card = screen.getByRole("button", { name: /Sign in with email\. 2 of 3 done/ });
    expect(card).toBeInTheDocument();

    resolve(wi({ id: "t-1", isComplete: true, status: STATUSES[2] }));
    await waitFor(() =>
      expect(within(dialog).getByRole("checkbox", { name: /“Build the sign-in form” not done/ })).toBeChecked(),
    );
  });

  it("puts the tick back and says why when it is refused", async () => {
    complete.mockRejectedValue(new ApiError("Only the assignee can tick this.", 403));
    renderBoard();
    const dialog = await openCard();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Mark “Build the sign-in form” done" }));

    expect(await within(dialog).findByText("Only the assignee can tick this.")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Mark “Build the sign-in form” done" })).not.toBeChecked();
    expect(within(dialog).getByRole("progressbar", { name: "Story progress" })).toHaveAttribute(
      "aria-valuetext",
      "1 of 3 tasks done",
    );
  });

  it("does not let somebody tick a task they may not move", async () => {
    respond([story([wi({ id: "t-1", title: "Someone else's task", can: { move: false, update: false, delete: false } })])]);
    renderBoard();
    const dialog = await openCard();

    const box = within(dialog).getByRole("checkbox", { name: "Mark “Someone else's task” done" });
    expect(box).toBeDisabled();
    await userEvent.click(box);
    expect(complete).not.toHaveBeenCalled();
  });

  it("shows the API's reason when a member tries to give a task to a colleague", async () => {
    update.mockRejectedValue(
      new ApiError("Only somebody who manages this board can give work to someone else. You can take it yourself.", 422),
    );
    renderBoard();
    const dialog = await openCard();

    await chooseOption(userEvent.setup(), within(dialog).getByRole("combobox", { name: "Assign “Build the sign-in form”" }), "Grace Hopper");

    expect(update).toHaveBeenCalledWith("t-1", { assigneeId: "u-2" });
    expect(await within(dialog).findByText(/Only somebody who manages this board/)).toBeInTheDocument();
    expect(comboboxValue(within(dialog).getByRole("combobox", { name: "Assign “Build the sign-in form”" }))).toBe("u-me");
  });

  it("adds a task under the story without naming a sprint", async () => {
    create.mockResolvedValue(wi({ id: "t-new", title: "Rate-limit attempts" }));
    renderBoard();
    const dialog = await openCard();

    await userEvent.type(within(dialog).getByLabelText("Add a task to this story"), "Rate-limit attempts");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add task" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("acme", {
        title: "Rate-limit attempts",
        type: "task",
        parentId: "st-1",
        assigneeId: null,
      }),
    );
    expect(await within(dialog).findByText("Rate-limit attempts")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar", { name: "Story progress" })).toHaveAttribute(
      "aria-valuetext",
      "1 of 4 tasks done",
    );
  });

  it("opens the full item panel for a task, and for the story itself", async () => {
    const onOpenItem = vi.fn();
    renderBoard({ onOpenItem });
    const dialog = await openCard();

    await userEvent.click(within(dialog).getByRole("button", { name: "Open “Wire the session cookie”" }));
    expect(onOpenItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: "t-2" }));

    await userEvent.click(within(dialog).getByRole("button", { name: "Edit story" }));
    expect(onOpenItem).toHaveBeenLastCalledWith(expect.objectContaining({ id: "st-1" }));
  });
});
