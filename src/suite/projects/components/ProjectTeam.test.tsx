import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectTeam from "./ProjectTeam";
import { chooseOption } from "@/test/selectOption";
import { primeJobTitlesCache } from "@/lib/api/job-titles-client";
import type { MemberCandidate, Project, ProjectMember } from "@/lib/api/projects-client";

/**
 * The project team, and each member's job title on it.
 *
 * Since 27 Sep 2026 a project member's "discipline" is a job title from the
 * organisation's one list (shared with HR and the users screen). The API keeps
 * the old field name, so what goes over the wire is `disciplineId` holding the
 * job title's id. These tests run the real client against a stubbed `fetch`,
 * so they check the request body, not a mock's arguments.
 */

/* The team is a DataView, which reaches for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme",
  useSearchParams: () => new URLSearchParams(),
}));

const JOB_TITLES = [
  { id: "jt-fe", key: "frontend-engineer", name: "Frontend Engineer", position: 1, isActive: true, peopleCount: 1 },
  { id: "jt-qa", key: "qa-engineer", name: "QA Engineer", position: 2, isActive: true, peopleCount: 1 },
];

function member(over: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: "m-1",
    userId: "u-1",
    name: "Shadrach Obi",
    email: "shadrach@acme.test",
    initials: "SO",
    role: "member",
    roleLabel: "Member",
    roleDescription: "Moves the work assigned to them.",
    managesBoard: false,
    managesProject: false,
    managesMembers: false,
    disciplineId: "jt-fe",
    discipline: "Frontend Engineer",
    jobTitleId: "jt-fe",
    jobTitle: "Frontend Engineer",
    addedBy: null,
    addedAt: null,
    ...over,
  };
}

const RUTH: MemberCandidate = { userId: "u-ra", name: "Ruth Akande", email: "ruth@acme.test", jobTitle: "QA Engineer" };

function project(manageMembers = true): Project {
  return { slug: "acme", name: "Acme", can: { manageMembers } } as unknown as Project;
}

type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];

function respond(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ data }) } as Response;
}

beforeEach(() => {
  calls = [];
  primeJobTitlesCache(JOB_TITLES);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });

      if (url.includes("/members/candidates")) return respond([RUTH]);
      if (method === "GET" && url.endsWith("/members")) return respond([member()]);
      return respond(member());
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const writes = () => calls.filter((c) => c.method !== "GET");

describe("ProjectTeam, job titles", () => {
  it("shows each member's job title", async () => {
    render(<ProjectTeam project={project()} />);

    const picker = await screen.findByRole("combobox", { name: "Job title for Shadrach Obi" });
    expect(picker).toHaveTextContent("Frontend Engineer");
    expect(screen.queryByText(/discipline/i)).toBeNull();
  });

  it("changes a member's job title with the picker, sending it as disciplineId", async () => {
    render(<ProjectTeam project={project()} />);

    await chooseOption(userEvent.setup(), await screen.findByRole("combobox", { name: "Job title for Shadrach Obi" }), "QA Engineer");

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      url: "/api/projects/projects/acme/members/m-1",
      method: "PATCH",
      /* The role goes along unchanged; the job title is the old field's name. */
      body: { role: "member", disciplineId: "jt-qa" },
    });
  });

  it("starts a new member on their own job title, matched by name, and sends it", async () => {
    const user = userEvent.setup();
    render(<ProjectTeam project={project()} startAdding />);

    const person = await screen.findByRole("combobox", { name: "Person" });
    await user.click(person);
    await user.type(person, "ruth");
    await user.click(await screen.findByRole("option", { name: /Ruth Akande/ }));

    /* Her title came back as a name only; it is resolved against the list. */
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Job title" })).toHaveTextContent("QA Engineer"));

    const form = screen.getByRole("combobox", { name: "Job title" }).closest("form") as HTMLFormElement;
    await user.click(within(form).getByRole("button", { name: /Add Ruth/ }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      url: "/api/projects/projects/acme/members",
      method: "POST",
      body: { userId: "u-ra", role: "member", seat: "member", disciplineId: "jt-qa" },
    });
  });

  it("shows the job title, without a picker, to somebody who may not staff the project", async () => {
    render(<ProjectTeam project={project(false)} />);

    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Job title for/ })).toBeNull();
  });
});

describe("ProjectTeam, the organisation's leads", () => {
  it("shows a lead under Oversight with the badge, offered work but never removed or re-roled", async () => {
    const lead = member({
      id: "m-lead",
      userId: "u-lead",
      name: "Ibukun Salami",
      role: "oversight",
      roleLabel: "Oversight",
      seat: "oversight",
      joinsEveryProject: true,
      systemManaged: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([member(), lead]) : respond([]))),
    );

    render(<ProjectTeam project={project()} />);

    expect(await screen.findByText("Oversight · every project")).toBeInTheDocument();
    /* Set by their role, not here: no role or seat picker, no Remove - only work on it. */
    const oversight = screen.getByRole("list", { name: "Oversight on this project" });
    expect(within(oversight).getAllByText("Ibukun Salami").length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox", { name: "Role for Ibukun Salami" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Seat for Ibukun Salami" })).toBeNull();
    expect(within(oversight).getByRole("button", { name: /Work on this project/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("shows somebody whose role joins every project as Oversight, with no way to remove or re-role them", async () => {
    const observer = member({
      id: "m-ov",
      userId: "u-ov",
      name: "Obi Observer",
      role: "oversight",
      roleLabel: "Oversight",
      seat: "oversight",
      seatLabel: "Oversight",
      working: false,
      systemManaged: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([member(), observer]) : respond([]))),
    );

    render(<ProjectTeam project={project()} />);

    expect(await screen.findByText("Oversight · every project")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Role for Obi Observer" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("puts somebody to work on the project, and back to oversight", async () => {
    const observer = member({
      id: "m-ov",
      userId: "u-ov",
      name: "Obi Observer",
      role: "oversight",
      roleLabel: "Oversight",
      seat: "oversight",
      systemManaged: true,
      joinsEveryProject: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? "GET";
        calls.push({ url, method, body: undefined });
        return url.endsWith("/members") ? respond([member(), observer]) : respond(observer);
      }),
    );

    render(<ProjectTeam project={project()} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Work on this project: Obi Observer" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ url: "/api/projects/projects/acme/members/m-ov/work", method: "POST" });
  });

  it("offers the person themselves Work on this project, and nobody else's, without staffing rights", async () => {
    const me = member({ id: "m-me", userId: "u-me", name: "Ada Me", role: "oversight", seat: "oversight", systemManaged: true, isYou: true });
    const other = member({ id: "m-ot", userId: "u-ot", name: "Obi Other", role: "oversight", seat: "oversight", systemManaged: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([member(), me, other]) : respond([]))),
    );

    render(<ProjectTeam project={project(false)} />);

    const oversight = await screen.findByRole("list", { name: "Oversight on this project" });
    expect(within(oversight).getAllByRole("button", { name: "Work on this project" })).toHaveLength(1);
    expect(within(oversight).getByText("On every project")).toBeInTheDocument();
  });

  it("offers Back to oversight, not Remove, for somebody whose role joins every project", async () => {
    const working = member({ id: "m-w", userId: "u-w", name: "Wale Working", seat: "member", joinsEveryProject: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([member(), working]) : respond([]))),
    );

    render(<ProjectTeam project={project()} />);

    expect(await screen.findAllByRole("button", { name: "Back to oversight" })).not.toHaveLength(0);
    expect(screen.getAllByText("Oversight · every project").length).toBeGreaterThan(0);
  });

  it("keeps the badge on a lead somebody also made this project's manager, and still no Remove", async () => {
    const lead = member({
      id: "m-lead",
      userId: "u-lead",
      name: "Ibukun Salami",
      role: "project_manager",
      roleLabel: "Project manager",
      seat: "owner",
      joinsEveryProject: true,
      systemManaged: false,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([lead]) : respond([]))),
    );

    render(<ProjectTeam project={project()} />);

    expect(await screen.findByRole("combobox", { name: "Role for Ibukun Salami" })).toBeInTheDocument();
    expect(screen.getAllByText("Oversight · every project").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Back to oversight" }).length).toBeGreaterThan(0);
  });
});

describe("ProjectTeam, seats", () => {
  it("changes a member's seat with the picker", async () => {
    render(<ProjectTeam project={project()} />);

    await chooseOption(userEvent.setup(), await screen.findByRole("combobox", { name: "Seat for Shadrach Obi" }), "Viewer");

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      url: "/api/projects/projects/acme/members/m-1",
      method: "PATCH",
      body: { seat: "viewer" },
    });
  });

  it("shows the seat, without a picker, to somebody who may not staff the project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/members") ? respond([member({ seat: "viewer", seatLabel: "Viewer" })]) : respond([]))),
    );

    render(<ProjectTeam project={project(false)} />);

    expect((await screen.findAllByText("Viewer")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox", { name: /Seat for/ })).toBeNull();
    expect(screen.getAllByText("Reads only").length).toBeGreaterThan(0);
  });
});
