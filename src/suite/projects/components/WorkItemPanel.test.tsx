import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkItemPanel from "./WorkItemPanel";
import { chooseOption, comboboxLabel, comboboxValue, openCombobox } from "@/test/selectOption";
import { primeJobTitlesCache } from "@/lib/api/job-titles-client";
import type {
  BoardSetup,
  Project,
  Sprint,
  WorkItem,
} from "@/lib/api/projects-client";

/**
 * Creating and editing one item.
 *
 * The rule this file exists to defend: **an empty estimate is sent as null,
 * never as zero.** The real backlog this module was designed against had 118
 * tasks and no estimates at all, so an empty field is the common case — and a
 * zero would be a wrong number rather than an absent one, which every cost and
 * velocity total downstream would then repeat as fact.
 *
 * The second is that **scheduling is a move, not an update**. It carries a
 * different permission and different bookkeeping, and the API refuses to put
 * work into a closed sprint; sending it as part of a field update would
 * quietly lose that refusal.
 */

const { create, update, move, remove, list, get } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    workItems: { ...actual.workItems, create, update, move, remove, list, get },
  };
});

const SETUP: BoardSetup = {
  statuses: [
    { id: "s-todo", key: "to_do", label: "To Do", position: 1, countsAsComplete: false, isDefault: true },
    { id: "s-done", key: "done", label: "Done", position: 5, countsAsComplete: true, isDefault: false },
  ],
  disciplines: [
    { id: "d-be", key: "backend", label: "Backend" },
    { id: "d-fe", key: "frontend", label: "Frontend" },
  ],
  assignees: [{ id: "u-1", name: "Shadrach", role: "member" }],
};

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as Project;

const SPRINT: Sprint = {
  id: "sp-1",
  projectId: "p-1",
  sequence: 1,
  name: "Sprint 1",
  goal: null,
  startsOn: "2026-09-28",
  endsOn: "2026-10-11",
  lengthInDays: 14,
  daysRemaining: 10,
  hasOverrun: false,
  status: "active",
  statusLabel: "Active",
  acceptsChanges: true,
  startedAt: null,
  closedAt: null,
};

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "wi-1",
    projectId: "p-1",
    sprintId: null,
    parentId: null,
    type: "task",
    typeLabel: "Task",
    countsTowardsVelocity: true,
    title: "Build the CRUD API",
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
    position: 1000,
    completedAt: null,
    bounceBacks: 0,
    can: { move: true, update: true, delete: true },
    createdAt: null,
    ...overrides,
  };
}

/* The organisation's job titles, which replaced disciplines on 27 Sep 2026. */
const JOB_TITLES = [
  { id: "d-be", key: "backend", name: "Backend", position: 1, isActive: true, peopleCount: 2 },
  { id: "d-fe", key: "frontend", name: "Frontend", position: 2, isActive: true, peopleCount: 1 },
];

beforeEach(() => {
  vi.clearAllMocks();
  primeJobTitlesCache(JOB_TITLES);
  create.mockResolvedValue(item({ id: "wi-new" }));
  update.mockResolvedValue(item());
  move.mockResolvedValue(item());
  remove.mockResolvedValue(undefined);
  list.mockResolvedValue({ data: [], meta: { total: 0, perPage: 250, currentPage: 1, lastPage: 1 } });
});

describe("creating", () => {
  it("needs nothing but a title", async () => {
    const onSaved = vi.fn();

    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), "Add pagination");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalled();
  });

  /* The rule the whole coverage story depends on. */
  it("sends an empty estimate as null, never as zero", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), "Unestimated");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "acme-rebuild",
        expect.objectContaining({ estimateHours: null }),
      ),
    );
  });

  it("sends a real estimate as a number", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), "Estimated");
    await userEvent.type(screen.getByLabelText("Estimate (hours)"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "acme-rebuild",
        expect.objectContaining({ estimateHours: 6 }),
      ),
    );
  });

  it("says plainly that an empty estimate is the honest answer", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText(/Empty is honest/)).toBeInTheDocument();
  });

  /** Created from a sprint board, it lands in that sprint. */
  it("puts a new item into the sprint it was created from", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        sprint={SPRINT}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), "In the sprint");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(move).toHaveBeenCalledWith("wi-new", { sprintId: "sp-1" }));
  });

  /* A new item has no sprint to change yet. */
  it("offers no sprint selector while creating", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        sprints={[SPRINT]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Sprint")).not.toBeInTheDocument();
  });

  it("only offers people who are on the project", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const people = await openCombobox(userEvent.setup(), screen.getByLabelText("Assignee"));
    expect(within(people).getByRole("option", { name: "Shadrach" })).toBeInTheDocument();
    expect(screen.getByText("People on this project.")).toBeInTheDocument();
  });

  /* Job titles replaced disciplines: the organisation's one list, shared with HR. */
  it("picks the job title from the organisation's list and sends its id", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Title"), "Style the sign-in form");
    await chooseOption(userEvent.setup(), screen.getByRole("combobox", { name: "Job title" }), "Frontend");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ disciplineId: "d-fe" })),
    );
  });

  it("opens an item with its job title, and can clear it", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ discipline: { id: "d-be", key: "backend", label: "Backend" } })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const field = screen.getByRole("combobox", { name: "Job title" });
    expect(field).toHaveTextContent("Backend");

    await chooseOption(userEvent.setup(), field, "No job title", { search: false });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("wi-1", expect.objectContaining({ disciplineId: null })));
  });

  it("says job title, never discipline", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ discipline: { id: "d-be", key: "backend", label: "Backend" } })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Job title")).toBeInTheDocument();
    expect(screen.queryByText(/discipline/i)).toBeNull();
    expect(screen.queryByLabelText(/discipline/i)).toBeNull();
  });
});

describe("editing", () => {
  it("opens with the item's current values", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ title: "Existing", estimateHours: 4 })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    expect(screen.getByLabelText("Estimate (hours)")).toHaveValue(4);
  });

  /* Scheduling is a `move`, so the refusal for a closed sprint survives. */
  it("schedules through move, not through update", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item()}
        sprints={[SPRINT]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await chooseOption(userEvent.setup(), screen.getByLabelText("Sprint"), "Sprint 1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(move).toHaveBeenCalledWith("wi-1", { sprintId: "sp-1" }));
    expect(update).toHaveBeenCalledWith("wi-1", expect.not.objectContaining({ sprintId: "sp-1" }));
  });

  /** Unscheduled *is* the product backlog, not an absence of one. */
  it("sends it back to the backlog as an explicit null", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ sprintId: "sp-1" })}
        sprints={[SPRINT]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await chooseOption(userEvent.setup(), screen.getByLabelText("Sprint"), "Product backlog");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(move).toHaveBeenCalledWith("wi-1", { sprintId: null }));
  });

  /* Editing a title must not re-assert the sprint it happens to be in. */
  it("does not touch the sprint when only a field changed", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ sprintId: "sp-1" })}
        sprints={[SPRINT]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), " — revised");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(move).not.toHaveBeenCalled();
  });

  it("asks before removing, and does nothing if the answer is no", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove this item" }));
    expect(remove).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", { name: /Remove/ });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
  });

  /* An assignee may move their work and may not delete it. */
  it("offers no delete control when the viewer may not delete", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ can: { move: true, update: true, delete: false } })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Remove this item" })).not.toBeInTheDocument();
  });
});

/*
  P3: the panel never read item.can.update, so people the API would refuse were
  handed every field and a live Save. Read-only now, still readable.
*/
describe("an item the viewer may not change", () => {
  it("is shown read-only, with no Save, and says who can change it", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ can: { move: false, update: false, delete: false } })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Title")).toHaveValue("Build the CRUD API");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText(/You can read this item but not change it/)).toBeInTheDocument();
  });

  it("stays editable for somebody who may change it", () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("where a bug was found", () => {
  const WORK = [
    item({ id: "wi-login", title: "Login form", type: "story", typeLabel: "User story", externalRef: "2.1" }),
    item({ id: "wi-other-bug", title: "Another bug", type: "bug", typeLabel: "Bug" }),
  ];

  beforeEach(() => {
    list.mockResolvedValue({ data: WORK, meta: { total: 2, perPage: 250, currentPage: 1, lastPage: 1 } });
  });

  /* Most items are not bugs; the field, and its fetch, are for bugs only. */
  it("offers no Found in field on anything but a bug", () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.queryByLabelText(/Found in/)).not.toBeInTheDocument();
    /* The only fetch a task makes is for its story picker — never the Found in list. */
    expect(list.mock.calls.every(([, filters]) => filters?.type === "story")).toBe(true);
  });

  it("links a new bug to the non-bug work it was found in", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Title"), "Login loops");
    await userEvent.click(screen.getByRole("radio", { name: "Bug" }));

    const field = await screen.findByLabelText(/Found in/);
    await waitFor(() => expect(field).toBeEnabled());

    /* Bugs are not offered: a bug is found in work, not in another bug. */
    const choices = await openCombobox(userEvent.setup(), field);
    expect(within(choices).queryByRole("option", { name: /Another bug/ })).not.toBeInTheDocument();

    await userEvent.click(within(choices).getByRole("option", { name: /Login form/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "acme-rebuild",
        expect.objectContaining({ type: "bug", foundInItemId: "wi-login" }),
      ),
    );
  });

  it("shows where an existing bug was found, and can clear it", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({
          type: "bug",
          typeLabel: "Bug",
          foundInItemId: "wi-login",
          foundIn: { id: "wi-login", title: "Login form", externalRef: "2.1", type: "story" },
        })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("2.1 · Login form")).toBeInTheDocument();

    const field = screen.getByLabelText(/Found in/);
    expect(comboboxValue(field)).toBe("wi-login");

    await waitFor(() => expect(field).toBeEnabled());
    await chooseOption(userEvent.setup(), field, "Not linked to other work");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("wi-1", expect.objectContaining({ foundInItemId: null })),
    );
  });

  /*
    D23: opened with only the id, on a project whose first 250 items do not
    include the linked one. The select showed "Select…" for a link that was
    still there; it now fetches and names it.
  */
  it("fetches and names a linked item that is not in the first page", async () => {
    get.mockResolvedValue(
      item({ id: "wi-far", title: "Checkout flow", type: "story", typeLabel: "User story", externalRef: "9.4" }),
    );

    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ type: "bug", typeLabel: "Bug", foundInItemId: "wi-far", foundIn: null })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const field = screen.getByLabelText(/Found in/);
    await waitFor(() => expect(comboboxLabel(field)).toBe("9.4 — Checkout flow"));
    expect(get).toHaveBeenCalledWith("wi-far");
    expect(comboboxValue(field)).toBe("wi-far");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("wi-1", expect.objectContaining({ foundInItemId: "wi-far" })),
    );
  });

  it("keeps a linked item it cannot fetch, under a plain name", async () => {
    get.mockRejectedValue(new Error("gone"));

    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ type: "bug", typeLabel: "Bug", foundInItemId: "wi-far", foundIn: null })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const field = screen.getByLabelText(/Found in/);
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(comboboxLabel(field)).toBe("The work it was found in"));
  });

  /* The API refuses the link on anything else, so it is never sent. */
  it("sends no link for an item that is not a bug", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty("foundInItemId");
  });
});

describe("who work can be given to", () => {
  const TEAM: BoardSetup = {
    ...SETUP,
    assignees: [
      { id: "u-me", name: "Me", role: "member" },
      { id: "u-dev", name: "Ada Developer", role: "member" },
    ],
  };

  /**
   * The owner's ask: the engineering lead adds work to a project and gives it
   * to a developer. The server's word for that is `can.manageBoard`.
   */
  it("offers a board manager everybody on the project", async () => {
    const lead = { ...PROJECT, can: { manageBoard: true } } as Project;

    render(
      <WorkItemPanel project={lead} setup={TEAM} item={null} viewerId="u-lead" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    const people = await openCombobox(userEvent.setup(), screen.getByLabelText("Assignee"));
    expect(within(people).getByRole("option", { name: "Ada Developer" })).toBeInTheDocument();
    expect(screen.getByText(/You manage this board/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.type(screen.getByLabelText("Title"), "Harden the search");
    await chooseOption(userEvent.setup(), screen.getByLabelText("Assignee"), "Ada Developer");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ assigneeId: "u-dev" })),
    );
  });

  /* The API would refuse a member assigning a colleague; the picker does not offer it. */
  it("offers somebody without it only themselves", async () => {
    const member = { ...PROJECT, can: { manageBoard: false } } as Project;

    render(
      <WorkItemPanel project={member} setup={TEAM} item={null} viewerId="u-me" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    const people = await openCombobox(userEvent.setup(), screen.getByLabelText("Assignee"));
    expect(within(people).getByRole("option", { name: "Me" })).toBeInTheDocument();
    expect(within(people).queryByRole("option", { name: "Ada Developer" })).not.toBeInTheDocument();
  });
});

describe("the story a task sits under", () => {
  const STORIES = [
    item({ id: "st-login", title: "Sign in with email", type: "story", typeLabel: "User story", externalRef: "2" }),
    item({ id: "st-search", title: "Search the catalogue", type: "story", typeLabel: "User story" }),
  ];

  beforeEach(() => {
    list.mockResolvedValue({ data: STORIES, meta: { total: 2, perPage: 250, currentPage: 1, lastPage: 1 } });
  });

  it("offers the project's stories for a new task and sends the one picked", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    const field = await screen.findByLabelText(/Part of story/);
    await waitFor(() => expect(field).toBeEnabled());
    expect(list).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ type: "story" }));

    await userEvent.type(screen.getByLabelText("Title"), "Validate the email");
    await chooseOption(userEvent.setup(), field, "2 — Sign in with email");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ parentId: "st-login" })),
    );
  });

  /* Opened from a story drawer's "Add with more detail". */
  it("starts with the story it was opened from", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        initialParentId="st-search"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const field = await screen.findByLabelText(/Part of story/);
    await waitFor(() => expect(comboboxValue(field)).toBe("st-search"));
  });

  /* A task under a story takes the story's sprint server-side; a move would be refused. */
  it("does not move a new task into the sprint when it goes under a story", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={null}
        sprint={SPRINT}
        initialParentId="st-login"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText("Title"), "Under the story");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(move).not.toHaveBeenCalled();
  });

  /* Re-sending the same parent would re-take the story's sprint. */
  it("sends the parent on edit only when it changed", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ parentId: "st-login", parent: { id: "st-login", title: "Sign in with email", type: "story" } })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty("parentId");
  });

  it("offers no story picker for a story itself", () => {
    render(
      <WorkItemPanel project={PROJECT} setup={SETUP} item={null} initialType="story" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.queryByLabelText(/Part of story/)).not.toBeInTheDocument();
  });
});

/*
  The plan fields. The AI planner fills every one of them; each must be
  settable by hand, and none may be conflated with its neighbour — a start
  after the due date, or a risk filed as a blocker, is a plan that lies.
*/
describe("the plan fields", () => {
  const EPICS = [
    item({ id: "ep-auth", title: "Identity, access and roles", type: "epic", typeLabel: "Epic" }),
    item({ id: "ep-shop", title: "Checkout", type: "epic", typeLabel: "Epic" }),
  ];

  beforeEach(() => {
    list.mockResolvedValue({ data: EPICS, meta: { total: 2, perPage: 250, currentPage: 1, lastPage: 1 } });
  });

  it("sends the dates and the possible blockers it was given", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Title"), "Build the login endpoint");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-09-25");
    await userEvent.type(screen.getByLabelText("Due date"), "2026-09-29");
    await userEvent.type(screen.getByLabelText("Possible blockers"), "SSO details from the client");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "acme-rebuild",
        expect.objectContaining({
          startsOn: "2026-09-25",
          dueOn: "2026-09-29",
          possibleBlockers: "SSO details from the client",
        }),
      ),
    );
  });

  it("sends empty dates and blockers as null", async () => {
    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Title"), "Undated");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][1]).toMatchObject({ startsOn: null, dueOn: null, possibleBlockers: null });
    /* Points size stories only; a task carries none from this form. */
    expect(create.mock.calls[0][1]).not.toHaveProperty("estimatePoints");
  });

  it("keeps possible blockers apart from blocked now", () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ blockedReason: "Staging is down", possibleBlockers: "UAT window not agreed" })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Blocked by")).toHaveValue("Staging is down");
    expect(screen.getByLabelText("Possible blockers")).toHaveValue("UAT window not agreed");
    expect(screen.getByText(/Risks to plan around\. Nothing is stopped yet/)).toBeInTheDocument();
  });

  it("will not save a start after the due date, and says why beside the dates", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ startsOn: "2026-10-02", dueOn: "2026-09-28" })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const start = screen.getByLabelText("Start date");
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("The start date is after the due date");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(update).not.toHaveBeenCalled();
    expect(start).toHaveFocus();

    await userEvent.clear(start);
    await userEvent.type(start, "2026-09-25");
    expect(screen.queryByText(/The start date is after the due date/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("wi-1", expect.objectContaining({ startsOn: "2026-09-25", dueOn: "2026-09-28" })),
    );
  });

  it("shows the API's refusal of the start date under the dates", async () => {
    const { ApiError } = await import("@/lib/api/admin-client");
    update.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, { startsOn: ["The start must be on or before the due date."] }),
    );

    render(<WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("The start must be on or before the due date.")).toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toHaveAttribute("aria-invalid", "true");
  });

  describe("on a story", () => {
    const story = (overrides: Partial<WorkItem> = {}) =>
      item({ id: "st-1", type: "story", typeLabel: "User story", ...overrides });

    it("offers points as an accessible radio group, and sends the one picked", async () => {
      render(
        <WorkItemPanel project={PROJECT} setup={SETUP} item={story({ estimatePoints: 3 })} onClose={vi.fn()} onSaved={vi.fn()} />,
      );

      const group = screen.getByRole("radiogroup", { name: "Story points" });
      const radios = within(group).getAllByRole("radio");
      expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual([
        "No points",
        "1 point",
        "2 points",
        "3 points",
        "5 points",
        "8 points",
        "13 points",
      ]);
      expect(within(group).getByRole("radio", { name: "3 points" })).toBeChecked();

      /* Keyboard: arrows move within the group, as a radio group should. */
      within(group).getByRole("radio", { name: "3 points" }).focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(within(group).getByRole("radio", { name: "5 points" })).toBeChecked();

      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(update).toHaveBeenCalledWith("st-1", expect.objectContaining({ estimatePoints: 5 })));
    });

    it("clears the points as null", async () => {
      render(
        <WorkItemPanel project={PROJECT} setup={SETUP} item={story({ estimatePoints: 8 })} onClose={vi.fn()} onSaved={vi.fn()} />,
      );

      await userEvent.click(screen.getByRole("radio", { name: "No points" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(update.mock.calls[0][1]).toMatchObject({ estimatePoints: null });
    });

    it("keeps an imported off-scale value selectable rather than dropping it", () => {
      render(
        <WorkItemPanel project={PROJECT} setup={SETUP} item={story({ estimatePoints: 4 })} onClose={vi.fn()} onSaved={vi.fn()} />,
      );

      expect(screen.getByRole("radio", { name: "4 points" })).toBeChecked();
    });

    it("offers no points to a task", () => {
      render(<WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

      expect(screen.queryByRole("radiogroup", { name: "Story points" })).not.toBeInTheDocument();
    });

    it("loads the project's epics and sends the one picked as the parent", async () => {
      render(
        <WorkItemPanel project={PROJECT} setup={SETUP} item={null} initialType="story" onClose={vi.fn()} onSaved={vi.fn()} />,
      );

      const field = screen.getByLabelText("Part of epic");
      await waitFor(() => expect(field).toBeEnabled());
      expect(list).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ type: "epic" }));

      await userEvent.type(screen.getByLabelText("Title"), "As an admin, I want roles");
      await chooseOption(userEvent.setup(), field, "Identity, access and roles");
      await userEvent.click(screen.getByRole("button", { name: "Add item" }));

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith("acme-rebuild", expect.objectContaining({ type: "story", parentId: "ep-auth" })),
      );
    });

    const inAuth = () =>
      story({ parentId: "ep-auth", parent: { id: "ep-auth", title: "Identity, access and roles", type: "epic" } });

    it("does not re-send an unchanged epic on edit", async () => {
      render(<WorkItemPanel project={PROJECT} setup={SETUP} item={inAuth()} onClose={vi.fn()} onSaved={vi.fn()} />);

      const field = screen.getByLabelText("Part of epic");
      await waitFor(() => expect(field).toBeEnabled());
      expect(comboboxValue(field)).toBe("ep-auth");

      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update.mock.calls[0][1]).not.toHaveProperty("parentId");
    });

    it("sends a changed epic on edit", async () => {
      render(<WorkItemPanel project={PROJECT} setup={SETUP} item={inAuth()} onClose={vi.fn()} onSaved={vi.fn()} />);

      const field = screen.getByLabelText("Part of epic");
      await waitFor(() => expect(field).toBeEnabled());

      await chooseOption(userEvent.setup(), field, "Checkout");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(update.mock.calls[0][1]).toMatchObject({ parentId: "ep-shop" });
    });

    it("takes a story out of its epic with an explicit null", async () => {
      render(
        <WorkItemPanel project={PROJECT} setup={SETUP} item={story({ parentId: "ep-auth" })} onClose={vi.fn()} onSaved={vi.fn()} />,
      );

      const field = screen.getByLabelText("Part of epic");
      await waitFor(() => expect(field).toBeEnabled());
      await chooseOption(userEvent.setup(), field, "Not in an epic");
      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(update.mock.calls[0][1]).toMatchObject({ parentId: null });
    });

    it("offers no epic picker for a task", () => {
      render(<WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />);

      expect(screen.queryByLabelText("Part of epic")).not.toBeInTheDocument();
    });

    it("shows what its tasks add up to", () => {
      render(
        <WorkItemPanel
          project={PROJECT}
          setup={SETUP}
          item={story({ rollup: { hours: 34, estimated: 5, total: 6 } })}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );

      expect(screen.getByText(/From tasks:/).textContent).toBe("From tasks: 34h across 5 of 6 estimated");
    });

    it("says so gently when no task is estimated", () => {
      render(
        <WorkItemPanel
          project={PROJECT}
          setup={SETUP}
          item={story({ rollup: { hours: null, estimated: 0, total: 3 } })}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );

      expect(screen.getByText("No tasks estimated yet.")).toBeInTheDocument();
      expect(screen.queryByText(/From tasks:/)).not.toBeInTheDocument();
    });
  });
});

/* P13: what the client link calls a milestone. */
describe("client-facing milestone title", () => {
  it("is offered only on a milestone, and sent when written", async () => {
    render(
      <WorkItemPanel project={PROJECT} setup={SETUP} item={item()} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.queryByLabelText("Title on the client link")).toBeNull();

    await userEvent.click(screen.getByRole("checkbox", { name: /This is a milestone/ }));
    await userEvent.type(screen.getByLabelText("Title on the client link"), "Single sign-on ready");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ isMilestone: true, clientTitle: "Single sign-on ready" });
  });

  it("opens with the saved wording, and blank is sent as null", async () => {
    render(
      <WorkItemPanel
        project={PROJECT}
        setup={SETUP}
        item={item({ isMilestone: true, clientTitle: "Go live" })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Title on the client link");
    expect(input).toHaveValue("Go live");

    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ clientTitle: null });
  });
});
