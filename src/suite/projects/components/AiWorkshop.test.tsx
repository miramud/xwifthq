import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AiWorkshop from "./AiWorkshop";
import { chooseOption } from "@/test/selectOption";
import { ApiError, type AiGeneration, type PlanEpic, type Project, type Sprint } from "@/lib/api/projects-client";

/**
 * Generating a backlog.
 *
 * Every test here defends the same thing from a different angle: **nothing a
 * model writes reaches the board unread.** That pattern was earned against a
 * spreadsheet, and a language model is a less reliable source than a
 * spreadsheet — it invents plausible work, duplicates what is already there,
 * and is equally confident either way.
 *
 * Also defended:
 *
 * **A discipline the model invented is flagged, not guessed at.**
 *
 * **An absent estimate reads as absent**, never as zero.
 *
 * **No provider means one message with a link**, not a button that leads to a
 * message telling somebody to go somewhere else.
 */

const { history, get, stories, backlog, breakdown, reviseTree, tasks, revise, commit, discard, listItems } = vi.hoisted(() => ({
  history: vi.fn(),
  get: vi.fn(),
  stories: vi.fn(),
  backlog: vi.fn(),
  breakdown: vi.fn(),
  reviseTree: vi.fn(),
  tasks: vi.fn(),
  revise: vi.fn(),
  commit: vi.fn(),
  discard: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    /* No server progress in these tests: the card runs on the request alone. */
    generate: { ...actual.generate, history, get, stories, backlog, breakdown, reviseTree, tasks, revise, commit, discard, progress: vi.fn().mockResolvedValue(null) },
    workItems: { ...actual.workItems, list: listItems },
  };
});

/* The preview and the history are DataViews, which read the router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
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

const SPRINT = {
  id: "sp-1",
  sequence: 2,
  name: "Sprint 2",
  acceptsChanges: true,
} as unknown as Sprint;

function generation(over: Partial<AiGeneration> = {}): AiGeneration {
  return {
    id: "gen-1",
    projectId: "p-1",
    feature: "stories",
    parentItemId: null,
    parentItem: null,
    sprintId: null,
    status: "previewing",
    statusLabel: "Ready to review",
    isOpen: true,
    error: null,
    provider: "anthropic",
    model: "claude-sonnet-5",
    itemCount: 2,
    createdCount: 0,
    keptCount: 2,
    totalTokens: 600,
    createdBy: "Ada Lead",
    committedAt: null,
    createdAt: null,
    items: [
      {
        keep: true,
        title: "As a user, I want to upload a dataset",
        description: "Upload with metadata.",
        expectedOutcome: "It appears in the catalogue.",
      },
      {
        keep: true,
        title: "As an admin, I want to define templates",
        description: "CRUD over templates.",
        expectedOutcome: "Templates can be edited.",
      },
    ],
    ...over,
  } as AiGeneration;
}

function taskGeneration(): AiGeneration {
  return generation({
    id: "gen-2",
    feature: "tasks",
    parentItem: "As a user, I want to upload a dataset",
    parentItemId: "wi-1",
    items: [
      {
        keep: true,
        title: "Build the upload endpoint",
        description: "Multipart.",
        discipline: "backend",
        disciplineId: "d-be",
        estimateHours: 8,
      },
      {
        keep: true,
        title: "Test the upload flow",
        description: "Happy and sad paths.",
        discipline: "qa",
        disciplineId: "d-qa",
        estimateHours: null,
      },
      {
        keep: true,
        title: "Deploy a blockchain",
        description: "It invented this.",
        discipline: "blockchain",
        disciplineId: null,
        estimateHours: 3,
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  /* Queued answers and implementations must not leak between planner tests. */
  breakdown.mockReset();
  reviseTree.mockReset();
  history.mockResolvedValue({
    data: [],
    meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
  });
  listItems.mockResolvedValue({
    data: [{ id: "wi-1", title: "As a user, I want to upload a dataset", type: "story" }],
    meta: { total: 1, perPage: 100, currentPage: 1, lastPage: 1 },
  });
});

describe("AiWorkshop — thin briefs and assumed stories", () => {
  it("shows the model's questions when a brief is too thin, and adds them to the brief", async () => {
    const user = userEvent.setup();
    backlog.mockRejectedValueOnce(
      new ApiError("The brief is too short to draft stories from without guessing.", 422, {
        generation: ["The brief is too short to draft stories from without guessing."],
        questions: ["Which modules are in scope first?", "Who are the users?"],
      }),
    );

    render(<AiWorkshop project={PROJECT} sprints={[SPRINT]} />);

    const brief = await screen.findByRole("textbox", { name: /requirements/i });
    await user.type(brief, "We are building a very wholistic HR system with every module.");
    await user.click(screen.getByRole("button", { name: /Draft the plan/ }));

    const panel = await screen.findByRole("region", { name: "It needs a little more to go on" });
    expect(panel).toHaveTextContent("Which modules are in scope first?");
    expect(panel).toHaveTextContent("Who are the users?");
    /* Advice, not an error banner. */
    expect(screen.queryByText(/too short to draft/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add these to the brief" }));

    expect((brief as HTMLTextAreaElement).value).toBe(
      "We are building a very wholistic HR system with every module.\n\n" +
        "Which modules are in scope first?\nAnswer: \n\nWho are the users?\nAnswer: ",
    );
    expect(screen.queryByRole("region", { name: "It needs a little more to go on" })).not.toBeInTheDocument();
  });

  it("marks assumed stories and lists the questions above the draft", async () => {
    history.mockResolvedValue({
      data: [generation()],
      meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
    });
    get.mockResolvedValue(
      generation({
        items: [
          { keep: true, title: "Employee records", description: null, assumed: true },
          { keep: true, title: "Administrative configuration", description: null, assumed: false },
        ],
        questions: ["Does payroll run here or elsewhere?"],
      }),
    );

    render(<AiWorkshop project={PROJECT} sprints={[SPRINT]} />);

    expect(await screen.findByRole("region", { name: "Questions that would sharpen this draft" })).toHaveTextContent(
      "Does payroll run here or elsewhere?",
    );
    expect(screen.getAllByText("Assumed").length).toBeGreaterThan(0);
    expect(screen.getByText(/were assumed from the kind of system|was assumed from the kind of system/)).toBeInTheDocument();
  });
});

describe("AiWorkshop", () => {
  /**
   * Without a provider every button here leads to a message telling somebody
   * to go to a different screen. Say it once, with the link.
   */
  it("points at the settings screen when no provider is set up", async () => {
    history.mockResolvedValue({ data: [], meta: { canGenerate: true, provider: null } });

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/No AI provider is set up/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add your own key/i })).toHaveAttribute(
      "href",
      "/suite/projects/ai",
    );

    /* And no way to spend money that would fail. */
    expect(screen.queryByRole("button", { name: /Draft the plan/i })).toBeNull();
  });

  it("tells a reader who may not generate why", async () => {
    history.mockResolvedValue({ data: [], meta: { canGenerate: false, provider: null } });

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(
      await screen.findByText(/You cannot generate work on this project/i),
    ).toBeInTheDocument();
  });

  /** Says whose account it runs on, because that is the first question. */
  it("names the provider and model it will spend on", async () => {
    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(
      await screen.findByText(/Runs on your own anthropic account · claude-sonnet-5/i),
    ).toBeInTheDocument();
  });

  it("will not ask for a plan from a scrap of text", async () => {
    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await userEvent.type(await screen.findByLabelText(/Requirements/i), "make it good");

    expect(screen.getByRole("button", { name: /Draft the plan/i })).toBeDisabled();
    expect(backlog).not.toHaveBeenCalled();
  });

  /* The flat preview still serves a "stories" generation left open before the planner. */
  it("unticks an item in a flat preview and commits only what is left", async () => {
    history.mockResolvedValue({
      data: [generation()],
      meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
    });
    get.mockResolvedValue(generation());
    revise.mockResolvedValue(
      generation({
        keptCount: 1,
        items: [
          { keep: false, title: "As a user, I want to upload a dataset", description: null },
          { keep: true, title: "As an admin, I want to define templates", description: null },
        ],
      }),
    );
    commit.mockResolvedValue(
      generation({ status: "committed", isOpen: false, createdCount: 1 }),
    );

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await screen.findByText("As a user, I want to upload a dataset");

    await userEvent.click(
      screen.getByLabelText(/Keep "As a user, I want to upload a dataset"/i),
    );

    await waitFor(() => expect(revise).toHaveBeenCalledTimes(1));

    expect(revise).toHaveBeenCalledWith("acme-rebuild", "gen-1", {
      items: [{ index: 0, keep: false }],
    });

    await userEvent.click(await screen.findByRole("button", { name: /Add 1 to the board/i }));

    await waitFor(() => expect(commit).toHaveBeenCalledWith("acme-rebuild", "gen-1"));

    expect(await screen.findByText(/1 stories created/i)).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Breaking a story down                                             */
  /* ------------------------------------------------------------------ */

  it("breaks a story into tasks across the disciplines", async () => {
    tasks.mockResolvedValue(taskGeneration());

    render(<AiWorkshop project={PROJECT} sprints={[SPRINT]} />);

    await chooseOption(userEvent.setup(), await screen.findByLabelText(/^Story$/i), "As a user, I want to upload a dataset");
    await userEvent.type(
      screen.getByLabelText(/Anything else it should know/i),
      "Laravel and Next",
    );
    await userEvent.click(screen.getByRole("button", { name: /Break it down/i }));

    await waitFor(() => expect(tasks).toHaveBeenCalledTimes(1));

    expect(tasks).toHaveBeenCalledWith("acme-rebuild", "wi-1", {
      context: "Laravel and Next",
    });

    expect(await screen.findByText("Build the upload endpoint")).toBeInTheDocument();
    /* The QA task is the one always missing from a hand-written backlog. */
    expect(screen.getByText("Test the upload flow")).toBeInTheDocument();
  });

  /** A discipline this organisation does not have is flagged, not guessed. */
  it("flags a discipline the model invented", async () => {
    tasks.mockResolvedValue(taskGeneration());

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await chooseOption(userEvent.setup(), await screen.findByLabelText(/^Story$/i), "As a user, I want to upload a dataset");
    await userEvent.click(screen.getByRole("button", { name: /Break it down/i }));

    expect(await screen.findByText(/blockchain · not on our job titles/i)).toBeInTheDocument();
  });

  /** Absent, never zero — as everywhere else in the module. */
  it("shows an unestimated task as unestimated", async () => {
    tasks.mockResolvedValue(taskGeneration());

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await chooseOption(userEvent.setup(), await screen.findByLabelText(/^Story$/i), "As a user, I want to upload a dataset");
    await userEvent.click(screen.getByRole("button", { name: /Break it down/i }));

    expect(await screen.findByText("not estimated")).toBeInTheDocument();
    expect(screen.getByText("8h")).toBeInTheDocument();
    expect(screen.queryByText("0h")).toBeNull();
  });

  it("sends generated tasks to a sprint when one is chosen", async () => {
    tasks.mockResolvedValue(taskGeneration());
    revise.mockResolvedValue(taskGeneration());

    render(<AiWorkshop project={PROJECT} sprints={[SPRINT]} />);

    await chooseOption(userEvent.setup(), await screen.findByLabelText(/^Story$/i), "As a user, I want to upload a dataset");
    await userEvent.click(screen.getByRole("button", { name: /Break it down/i }));

    await screen.findByText("Build the upload endpoint");

    await chooseOption(userEvent.setup(), screen.getByRole("combobox", { name: /Where the tasks go/i }), "Sprint 2");

    await waitFor(() =>
      expect(revise).toHaveBeenCalledWith("acme-rebuild", "gen-2", {
        items: [],
        sprintId: "sp-1",
      }),
    );
  });

  /* ------------------------------------------------------------------ */

  it("discards a preview without creating anything", async () => {
    history.mockResolvedValue({
      data: [generation()],
      meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
    });
    get.mockResolvedValue(generation());
    discard.mockResolvedValue({});

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await userEvent.click(await screen.findByRole("button", { name: /^Discard$/i }));
    expect(discard).not.toHaveBeenCalled();
    /* Marked discarded and kept, never binned: the dialog does not promise a restore. */
    expect(await screen.findByText(/kept as a discarded record/)).toBeInTheDocument();
    expect(screen.queryByText(/recycle bin/)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Discard draft" }));

    await waitFor(() => expect(discard).toHaveBeenCalledWith("acme-rebuild", "gen-1"));
    expect(commit).not.toHaveBeenCalled();
  });

  /** The provider's own words are more use than "something went wrong". */
  it("shows the failure the provider actually reported", async () => {
    backlog.mockRejectedValue(
      new ApiError("Anthropic returned 401: invalid x-api-key", 422),
    );

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await userEvent.type(
      await screen.findByLabelText(/Requirements/i),
      "We need a data catalogue where users upload datasets and admins define templates.",
    );
    await userEvent.click(screen.getByRole("button", { name: /Draft the plan/i }));

    /* Said once, in the progress card's alert, on the step that stopped. */
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid x-api-key/i);
    expect(screen.getByText("Stopped here. The reason is below")).toBeInTheDocument();
  });

  it("resumes a preview somebody left open", async () => {
    const open = generation();

    history.mockResolvedValue({
      data: [open],
      meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
    });
    get.mockResolvedValue(open);

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("acme-rebuild", "gen-1"));

    expect(await screen.findByText("As a user, I want to upload a dataset")).toBeInTheDocument();
    expect(stories).not.toHaveBeenCalled();
  });

  it("lists past generations with what each one cost", async () => {
    history.mockResolvedValue({
      data: [
        generation({
          status: "committed",
          statusLabel: "Imported",
          isOpen: false,
          createdCount: 2,
          items: undefined,
        }),
      ],
      meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
    });

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(await screen.findByText(/Past generations/i)).toBeInTheDocument();
    expect(screen.getByText("600 tokens")).toBeInTheDocument();
    expect(screen.getByText("2 created")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  The delivery planner                                               */
/* ------------------------------------------------------------------ */

const EPICS = ["Identity, access and roles", "Catalogue", "Search"];

/** A plan as the plan call returns it: epics and stories, tasks only for `broken`. */
function plan(broken: number[] = [], over: Partial<AiGeneration> = {}): AiGeneration {
  const items: PlanEpic[] = EPICS.map((title, e) => ({
    keep: true,
    title,
    description: null,
    brokenDown: broken.includes(e),
    stories: [
      {
        keep: true,
        title: `As a user, I want ${title.toLowerCase()}`,
        description: null,
        expectedOutcome: "Given a user\nWhen they act\nThen it works",
        points: 3,
        priority: 2,
        possibleBlockers: null,
        tasks: broken.includes(e)
          ? [
              { keep: true, title: `Build ${title} API`, discipline: "backend", disciplineId: "d-be", estimateHours: 6 },
              { keep: true, title: `Test ${title}`, discipline: "qa", disciplineId: "d-qa", estimateHours: 2 },
            ]
          : [],
      },
    ],
  }));

  return generation({
    feature: "backlog",
    items,
    plan: {
      window: { startsOn: "2026-09-25", endsOn: "2026-10-08", sprintId: null, sprintName: "Sprint 1", exists: false },
      paths: {},
      totals: {
        epics: 3,
        stories: 3,
        tasks: broken.length * 2,
        hours: broken.length * 8,
        points: 9,
        storiesInSprint: 2,
        hoursInSprint: 16,
        capacityHours: 120,
      },
      capacity: { backend: 1, qa: 1 },
    },
    ...over,
  });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function resumable(g: AiGeneration) {
  history.mockResolvedValue({
    data: [g],
    meta: { canGenerate: true, provider: { provider: "anthropic", model: "claude-sonnet-5" } },
  });
  get.mockResolvedValue(g);
}

async function draftPlan() {
  const user = userEvent.setup();

  render(<AiWorkshop project={PROJECT} sprints={[]} />);

  await user.type(
    await screen.findByLabelText(/Requirements/i),
    "We need a data catalogue where users upload datasets and admins define metadata templates.",
  );
  await user.click(screen.getByRole("button", { name: /Draft the plan/i }));

  return user;
}

const progress = () => screen.getByRole("region", { name: "Breaking the plan down" });

describe("AiWorkshop — the delivery planner", () => {
  it("picks the plan up when the connection drops but the server finishes it", async () => {
    const { generate } = await import("@/lib/api/projects-client");
    vi.mocked(generate.progress).mockResolvedValue({
      status: "done",
      title: "Drafting a plan from your brief",
      error: null,
      startedAt: new Date().toISOString(),
      generationId: "gen-1",
      steps: [],
    });
    backlog.mockRejectedValue(new ApiError("The server took too long to answer (HTTP 504), so the request was stopped before it finished.", 504));
    get.mockResolvedValue(plan());
    breakdown
      .mockResolvedValueOnce(plan([0]))
      .mockResolvedValueOnce(plan([0, 1]))
      .mockResolvedValueOnce(plan([0, 1, 2]));

    await draftPlan();

    /* Not a failure: the saved plan opens and is broken down as usual. */
    expect(await screen.findByRole("heading", { name: "Your plan is ready to review" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("acme-rebuild", "gen-1");
    expect(screen.queryByText("Why it stopped")).not.toBeInTheDocument();
    vi.mocked(generate.progress).mockResolvedValue(null);
  });

  it("reports every step from the click to a plan ready to review", async () => {
    const { generate } = await import("@/lib/api/projects-client");
    vi.mocked(generate.progress).mockResolvedValue({
      status: "running",
      title: "Drafting a plan from your brief",
      error: null,
      startedAt: new Date().toISOString(),
      steps: [
        { key: "read", label: "Reading your brief", status: "done", detail: "14 words", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), expectedSeconds: null },
        { key: "check", label: "Checking it can be planned", status: "done", detail: "Within limits", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), expectedSeconds: null },
        { key: "plan", label: "Drafting epics and user stories", status: "active", detail: "The AI is reading it and writing the plan", startedAt: new Date().toISOString(), endedAt: null, expectedSeconds: 40 },
        { key: "arrange", label: "Arranging the plan for your team", status: "pending", detail: null, startedAt: null, endedAt: null, expectedSeconds: null },
      ],
    });
    const drafted = deferred<AiGeneration>();
    backlog.mockReturnValue(drafted.promise);
    breakdown
      .mockResolvedValueOnce(plan([0]))
      .mockResolvedValueOnce(plan([0, 1]))
      .mockResolvedValueOnce(plan([0, 1, 2]));

    await draftPlan();

    /* While the server works: its own steps, as it reports them. */
    await waitFor(() =>
      expect(screen.getAllByRole("listitem").find((li) => li.textContent?.startsWith("Drafting epics"))).toHaveTextContent("Drafting epics and user stories (in progress)"),
    );
    expect(screen.getByText("14 words")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Plan drafting progress" })).toBeInTheDocument();

    drafted.resolve(plan());

    /* Then the breakdown, then the success card. */
    expect(await screen.findByRole("heading", { name: "Your plan is ready to review" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Plan drafting progress" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText(/Nothing is on the board yet/)).toBeInTheDocument();
    expect(breakdown).toHaveBeenCalledTimes(3);
    vi.mocked(generate.progress).mockResolvedValue(null);
  });

  it("breaks every epic down in order, saying which one it is on", async () => {
    backlog.mockResolvedValue(plan());
    const calls = [deferred<AiGeneration>(), deferred<AiGeneration>(), deferred<AiGeneration>()];
    breakdown.mockImplementation((_s: string, _id: string, i: number) => calls[i].promise);

    await draftPlan();

    await waitFor(() => expect(progress()).toHaveTextContent("Breaking down 1 of 3: Identity, access and roles"));
    expect(backlog).toHaveBeenCalledWith(
      "acme-rebuild",
      "We need a data catalogue where users upload datasets and admins define metadata templates.",
      null,
      expect.objectContaining({ progressKey: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
    );
    expect(breakdown).toHaveBeenCalledTimes(1);
    /* Adding waits for the loop. */
    expect(screen.getByRole("button", { name: /^Add / })).toBeDisabled();

    calls[0].resolve(plan([0]));
    await waitFor(() => expect(progress()).toHaveTextContent("Breaking down 2 of 3: Catalogue"));

    calls[1].resolve(plan([0, 1]));
    await waitFor(() => expect(progress()).toHaveTextContent("Breaking down 3 of 3: Search"));

    calls[2].resolve(plan([0, 1, 2]));
    await waitFor(() => expect(progress()).toHaveTextContent("All 3 epics broken down into tasks"));

    expect(breakdown.mock.calls.map((c) => c[2])).toEqual([0, 1, 2]);
    expect(breakdown).toHaveBeenCalledWith("acme-rebuild", "gen-1", 0);
    expect(screen.getByRole("button", { name: "Add 3 stories and 6 tasks" })).toBeEnabled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps going past a failed epic, and retries it on the epic", async () => {
    backlog.mockResolvedValue(plan());
    breakdown
      .mockResolvedValueOnce(plan([0]))
      .mockRejectedValueOnce(new ApiError("The provider timed out.", 422))
      .mockResolvedValueOnce(plan([0, 2]))
      .mockResolvedValueOnce(plan([0, 1, 2]));

    const user = await draftPlan();

    expect(await screen.findByText("The provider timed out.")).toBeInTheDocument();
    /* The loop moved on to the third epic regardless. */
    await waitFor(() => expect(breakdown).toHaveBeenCalledTimes(3));
    expect(breakdown.mock.calls.map((c) => c[2])).toEqual([0, 1, 2]);
    await waitFor(() => expect(progress()).toHaveTextContent("1 of 3 epics not broken down yet"));

    await user.click(screen.getByRole("button", { name: 'Retry "Catalogue"' }));

    await waitFor(() => expect(breakdown).toHaveBeenCalledTimes(4));
    expect(breakdown.mock.calls[3][2]).toBe(1);
    await waitFor(() => expect(progress()).toHaveTextContent("All 3 epics broken down into tasks"));
    expect(screen.queryByText("The provider timed out.")).toBeNull();
  });

  it("stops after the epic in hand, and offers to continue", async () => {
    backlog.mockResolvedValue(plan());
    const first = deferred<AiGeneration>();
    /* The second stays in flight, so the count below is exact. */
    breakdown.mockReturnValueOnce(first.promise).mockReturnValueOnce(deferred<AiGeneration>().promise);

    const user = await draftPlan();

    await user.click(await screen.findByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: /Stopping after this epic/ })).toBeDisabled();

    first.resolve(plan([0]));

    await waitFor(() => expect(progress()).toHaveTextContent("2 of 3 epics not broken down yet"));
    expect(breakdown).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Not broken down yet")).toHaveLength(2);
    expect(screen.getByRole("button", { name: 'Break down "Search"' })).toBeInTheDocument();
    /* Stopped is a state you can add from: those stories go in without tasks. */
    expect(screen.getByText(/2 epics have no tasks yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue breaking down" }));

    await waitFor(() => expect(breakdown).toHaveBeenCalledTimes(2));
    expect(breakdown.mock.calls[1][2]).toBe(1);
  });

  it("does not spend on a half-broken-down plan just because it was opened", async () => {
    resumable(plan([0]));

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(await screen.findByRole("button", { name: "Continue breaking down" })).toBeInTheDocument();
    expect(progress()).toHaveTextContent("2 of 3 epics not broken down yet");
    expect(breakdown).not.toHaveBeenCalled();
  });

  it("unticks an epic at once, saves it by path, and greys what is under it", async () => {
    resumable(plan([0, 1, 2]));
    const saved = deferred<AiGeneration>();
    reviseTree.mockReturnValue(saved.promise);

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    expect(await screen.findByRole("button", { name: "Add 3 stories and 6 tasks" })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Keep epic "Identity, access and roles"'));

    expect(reviseTree).toHaveBeenCalledWith("acme-rebuild", "gen-1", [{ path: "0", keep: false }]);
    /* Optimistic: the count moves before the server answers. */
    expect(screen.getByLabelText('Keep epic "Identity, access and roles"')).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Add 2 stories and 4 tasks" })).toBeInTheDocument();
    expect(screen.getByLabelText('Keep story "As a user, I want identity, access and roles"')).toBeDisabled();
    expect(screen.getByText(/Skipped with its epic/)).toBeInTheDocument();

    saved.resolve(plan([0, 1, 2]));
  });

  it("puts a refused tick back and says so", async () => {
    resumable(plan([0, 1, 2]));
    reviseTree.mockRejectedValue(new ApiError("The generation is no longer open.", 422));

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await userEvent.click(await screen.findByLabelText('Keep story "As a user, I want identity, access and roles"'));

    expect(await screen.findByText(/That change did not save: The generation is no longer open/)).toBeInTheDocument();
    expect(screen.getByLabelText('Keep story "As a user, I want identity, access and roles"')).toBeChecked();
    expect(screen.getByRole("button", { name: "Add 3 stories and 6 tasks" })).toBeInTheDocument();
  });

  it("adds the kept stories and tasks, then says what was created", async () => {
    resumable(plan([0, 1, 2]));
    commit.mockResolvedValue(plan([0, 1, 2], { status: "committed", isOpen: false, createdCount: 12 }));
    const onCommitted = vi.fn();

    render(<AiWorkshop project={PROJECT} sprints={[]} onCommitted={onCommitted} />);

    await userEvent.click(await screen.findByRole("button", { name: "Add 3 stories and 6 tasks" }));

    await waitFor(() => expect(commit).toHaveBeenCalledWith("acme-rebuild", "gen-1"));
    expect(await screen.findByText(/12 work items created/)).toBeInTheDocument();
    expect(onCommitted).toHaveBeenCalled();
  });

  it("shows the plan's size and the first sprint's fit above the tree", async () => {
    resumable(plan([0, 1, 2]));

    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    const fit = await screen.findByRole("region", { name: "First sprint" });
    expect(fit).toHaveTextContent(
      "Sprint 1 · 25 Sep to 8 Oct: 2 stories fit (16h of 120h capacity); 1 waits in the product backlog",
    );
    expect(fit).toHaveTextContent("Adding the plan creates it");
    expect(screen.getByLabelText("What you would add")).toHaveTextContent(
      /Epics\s*3\s*Stories\s*3\s*Tasks\s*6\s*Hours\s*24h\s*Points\s*9/,
    );
  });
});

describe("AiWorkshop — uploaded briefs and the team", () => {
  const withTeam = (delivery: number) =>
    history.mockResolvedValue({
      data: [],
      meta: {
        canGenerate: true,
        provider: { provider: "anthropic", model: "claude-sonnet-5" },
        team: { delivery },
      },
    });

  it("asks for the team before anything can be uploaded or drafted", async () => {
    withTeam(0);
    const onAddPeople = vi.fn();
    render(<AiWorkshop project={PROJECT} sprints={[]} onAddPeople={onAddPeople} />);

    expect(await screen.findByText("Add the team before generating")).toBeInTheDocument();
    expect(screen.queryByLabelText("PRD or sheet to plan from")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Draft the plan/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add people" }));
    expect(onAddPeople).toHaveBeenCalled();
  });

  it("drafts from an uploaded document, with what was typed sent as notes", async () => {
    withTeam(3);
    backlog.mockResolvedValue({ id: "gen-9", feature: "backlog", status: "previewing", isOpen: false, items: [] });
    const user = userEvent.setup();
    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    const prd = new File(["PRD"], "leave-prd.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(await screen.findByLabelText("PRD or sheet to plan from"), prd);

    expect(screen.getByText("leave-prd.docx")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Notes about the document/), "Phase one only");
    await user.click(screen.getByRole("button", { name: "Draft the plan from the document" }));

    await waitFor(() =>
      expect(backlog).toHaveBeenCalledWith(
        "acme-rebuild",
        "Phase one only",
        prd,
        /* The upload reports its bytes into the progress card. */
        expect.objectContaining({ progressKey: expect.any(String), onUpload: expect.any(Function) }),
      ),
    );
  });

  it("refuses an old Word file before uploading it", async () => {
    withTeam(1);
    const user = userEvent.setup({ applyAccept: false });
    render(<AiWorkshop project={PROJECT} sprints={[]} />);

    await user.upload(
      await screen.findByLabelText("PRD or sheet to plan from"),
      new File(["x"], "spec.doc", { type: "application/msword" }),
    );

    expect(await screen.findByText(/"spec.doc" is an old Office format/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft the plan" })).toBeDisabled();
  });
});
