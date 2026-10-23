import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectWorkspace from "./ProjectWorkspace";
import type { BoardSetup, Project, Sprint } from "@/lib/api/projects-client";

/**
 * The project's tabs, as the owner ordered them: **Product backlog, then
 * Sprint backlog** — the backlog is where a sprint is drawn from — and the
 * sprint opening by default while one is running.
 */

const api = vi.hoisted(() => ({
  projectGet: vi.fn(),
  sprintsList: vi.fn(),
  sprintGet: vi.fn(),
  boardGet: vi.fn(),
  portfoliosList: vi.fn(),
  companiesList: vi.fn(),
  itemGet: vi.fn(),
}));

/* The address bar, for `?item=<id>` deep links from notifications. */
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/suite/projects/acme",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-me", name: "Me" }, loading: false, refresh: vi.fn() }),
  AuthError: class extends Error {},
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return {
    ...actual,
    projects: { ...actual.projects, get: api.projectGet },
    sprints: { ...actual.sprints, list: api.sprintsList, get: api.sprintGet },
    board: { ...actual.board, get: api.boardGet },
    portfolios: { ...actual.portfolios, list: api.portfoliosList },
    companies: { ...actual.companies, list: api.companiesList },
    workItems: { ...actual.workItems, get: api.itemGet },
  };
});

/* The views themselves have their own tests; here only which one, and for what. */
vi.mock("./StoryBoard", () => ({
  default: (p: { sprintId?: string; viewSwitch?: React.ReactNode }) => (
    <div>
      <div data-testid="story-board">board:{p.sprintId ?? "backlog"}</div>
      {p.viewSwitch}
    </div>
  ),
}));
vi.mock("./StoryBacklog", () => ({
  default: (p: { sprintId?: string; viewSwitch?: React.ReactNode }) => (
    <div>
      <div data-testid="story-list">list:{p.sprintId ?? "backlog"}</div>
      {p.viewSwitch}
    </div>
  ),
}));
vi.mock("./WorkItemList", () => ({
  default: (p: { sprintId?: string; viewSwitch?: React.ReactNode }) => (
    <div>
      <div data-testid="item-list">items:{p.sprintId ?? "backlog"}</div>
      {p.viewSwitch}
    </div>
  ),
}));
vi.mock("./WorkItemPanel", () => ({
  default: (p: { item: { id: string; title: string } | null }) => (
    <div data-testid="item-panel">{p.item?.title ?? "new"}</div>
  ),
}));
vi.mock("./ProjectAssistant", () => ({
  default: () => null,
  AskAssistantButton: () => null,
}));

const PROJECT = {
  id: "p-1",
  slug: "acme",
  code: "ACME",
  name: "Acme",
  typeLabel: "Client",
  currency: "NGN",
  status: "active",
  statusLabel: "Active",
  isOverdue: false,
  startsOn: null,
  targetEndsOn: null,
  actualEndsOn: null,
  daysToTarget: null,
  externalCompany: null,
  externalCompanyId: null,
  viewerRole: null,
  members: [],
  can: { update: false, manageBoard: false, viewCost: false },
} as unknown as Project;

const SETUP: BoardSetup = { statuses: [], disciplines: [], assignees: [] };

const RUNNING = {
  id: "sp-3",
  sequence: 3,
  name: "Sprint 3",
  goal: null,
  status: "active",
  startsOn: "2026-09-21",
  endsOn: "2026-10-04",
  lengthInDays: 14,
  daysRemaining: 9,
  hasOverrun: false,
} as unknown as Sprint;

const REPORT = {
  committed: { count: 0, hours: 0, points: 0, estimated: 0 },
  completed: { count: 0, hours: 0, points: 0, estimated: 0 },
  carriedOver: { count: 0, hours: 0, points: 0, estimated: 0 },
  addedMidSprint: { count: 0, hours: 0, points: 0, estimated: 0 },
  bounceBacks: 0,
  velocityHours: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  api.projectGet.mockResolvedValue(PROJECT);
  api.boardGet.mockResolvedValue(SETUP);
  api.portfoliosList.mockResolvedValue([]);
  api.companiesList.mockResolvedValue({ data: [] });
  api.sprintGet.mockResolvedValue({ meta: { report: REPORT } });
});

describe("the work tabs", () => {
  it("puts the product backlog before the sprint backlog", async () => {
    api.sprintsList.mockResolvedValue([RUNNING]);
    render(<ProjectWorkspace slug="acme" />);

    const tabs = await screen.findAllByRole("tab");
    const names = tabs.map((t) => t.textContent ?? "");

    expect(names[0]).toBe("Product backlog");
    expect(names[1]).toMatch(/^Sprint backlog/);
    expect(names[1]).toContain("S3");
  });

  it("opens on the sprint board while a sprint is running", async () => {
    api.sprintsList.mockResolvedValue([RUNNING]);
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByTestId("story-board")).toHaveTextContent("board:sp-3");
    expect(screen.getByRole("tab", { name: /Sprint backlog/ })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on the product backlog as stories when none is", async () => {
    api.sprintsList.mockResolvedValue([]);
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByTestId("story-list")).toHaveTextContent("list:backlog");
    expect(screen.getByRole("tab", { name: "Product backlog" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the flat item table one choice away", async () => {
    api.sprintsList.mockResolvedValue([]);
    render(<ProjectWorkspace slug="acme" />);

    await screen.findByTestId("story-list");
    const views = screen.getByRole("radiogroup", { name: "Show the work as" });
    /* It sits with the list's own toolbar, never in the tab row it used to crowd. */
    expect(screen.getByRole("tablist")).not.toContainElement(views);
    await userEvent.click(within(views).getByRole("radio", { name: "Items" }));

    expect(screen.getByTestId("item-list")).toHaveTextContent("items:backlog");
  });
});

describe("a link to one item", () => {
  it("opens the item a notification links to, then takes the id off the address", async () => {
    nav.search = "item=wi-9&tab=x";
    api.sprintsList.mockResolvedValue([]);
    api.itemGet.mockResolvedValue({ id: "wi-9", title: "Build login endpoint" });
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByTestId("item-panel")).toHaveTextContent("Build login endpoint");
    expect(api.itemGet).toHaveBeenCalledTimes(1);
    expect(api.itemGet).toHaveBeenCalledWith("wi-9");
    /* Other parameters survive; only the one that opened the panel goes. */
    expect(nav.replace).toHaveBeenCalledWith("/suite/projects/acme?tab=x", { scroll: false });
  });

  it("says so when the linked item cannot be opened", async () => {
    nav.search = "item=gone";
    api.sprintsList.mockResolvedValue([]);
    api.itemGet.mockRejectedValue(new Error("404"));
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText("Could not open that item.")).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/suite/projects/acme", { scroll: false });
  });

  it("does nothing without one", async () => {
    api.sprintsList.mockResolvedValue([]);
    render(<ProjectWorkspace slug="acme" />);

    await screen.findByTestId("story-list");
    expect(api.itemGet).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

/* P17: a finished project has no days to go. */
describe("the project's promise", () => {
  it("says when a complete project finished, not how many days are left", async () => {
    api.sprintsList.mockResolvedValue([]);
    api.projectGet.mockResolvedValue({
      ...PROJECT,
      status: "complete",
      statusLabel: "Complete",
      startsOn: "2026-06-01",
      targetEndsOn: "2026-12-31",
      actualEndsOn: "2026-09-15",
      daysToTarget: 90,
    });
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText(/^Finished 15 Sep 2026$/)).toBeInTheDocument();
    expect(screen.queryByText(/days to go/)).not.toBeInTheDocument();
    expect(screen.queryByText("Time used")).not.toBeInTheDocument();
  });

  it("says a cancelled one was cancelled", async () => {
    api.sprintsList.mockResolvedValue([]);
    api.projectGet.mockResolvedValue({
      ...PROJECT,
      status: "cancelled",
      statusLabel: "Cancelled",
      actualEndsOn: "2026-09-20",
      daysToTarget: 4,
    });
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText(/^Cancelled 20 Sep 2026$/)).toBeInTheDocument();
    expect(screen.queryByText(/days to go/)).not.toBeInTheDocument();
  });

  it("still counts down on an open project", async () => {
    api.sprintsList.mockResolvedValue([]);
    api.projectGet.mockResolvedValue({ ...PROJECT, targetEndsOn: "2026-12-31", daysToTarget: 12 });
    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText("12 days to go")).toBeInTheDocument();
  });
});

describe("when the project cannot be opened", () => {
  it("says the server's actual reason, not 'you are not on this project'", async () => {
    const { ApiError } = await import("@/lib/api/admin-client");
    api.sprintsList.mockResolvedValue([]);
    api.projectGet.mockRejectedValue(new ApiError("Change your password before you continue.", 403));

    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText("You cannot open this project")).toBeInTheDocument();
    expect(screen.getByText(/Change your password before you continue\./)).toBeInTheDocument();
    expect(screen.queryByText("You are not on this project")).toBeNull();
  });

  it("calls a missing project missing", async () => {
    const { ApiError } = await import("@/lib/api/admin-client");
    api.sprintsList.mockResolvedValue([]);
    api.projectGet.mockRejectedValue(new ApiError("Not found.", 404));

    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText("This project could not be found")).toBeInTheDocument();
  });

  it("opens the project when only a side list is refused, saying what went wrong", async () => {
    const { ApiError } = await import("@/lib/api/admin-client");
    api.sprintsList.mockResolvedValue([]);
    api.companiesList.mockRejectedValue(new ApiError("You cannot see the client register.", 403));

    render(<ProjectWorkspace slug="acme" />);

    expect(await screen.findByText("You cannot see the client register.")).toBeInTheDocument();
    expect(screen.queryByText("You cannot open this project")).toBeNull();
  });
});
