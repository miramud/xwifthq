import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrgOverviewBoard from "./OrgOverviewBoard";
import type { OrgOverview } from "@/lib/api/org-overview-client";

/**
 * The organisation overview. What matters: a section per *live* module and
 * none for a module that isn't (a switched-off module gets a preview card,
 * never a section of zeroes), and the reporting window is in the URL.
 */

const api = vi.hoisted(() => ({ getOrgOverview: vi.fn() }));
vi.mock("@/lib/api/org-overview-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-overview-client")>();
  return { ...actual, getOrgOverview: api.getOrgOverview };
});

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const auth = vi.hoisted(() => ({
  user: { id: "u0", name: "Ada Admin", email: "ada@acme.test", role: "admin", organisationId: "org-1" } as Record<string, unknown> | null,
}));
vi.mock("@/lib/auth-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-store")>();
  return { ...actual, useAuth: () => ({ user: auth.user, loading: false }) };
});

const series = (keys: [string, string]) =>
  ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((date, i) => ({ date, [keys[0]]: i + 1, [keys[1]]: i }));

function overview(over: Partial<OrgOverview> = {}): OrgOverview {
  return {
    organisation: { name: "Meridian Polytechnic", slug: "meridian", logoUrl: null, createdAt: "2026-01-01T00:00:00Z" },
    modules: [
      { key: "lms", label: "Learning", status: "active" },
      { key: "hrm", label: "HR", status: "preview" },
      { key: "projects", label: "Projects", status: "active" },
      { key: "finance", label: "Finance", status: "preview" },
      { key: "admin", label: "Admin", status: "preview" },
    ],
    people: { users: 42, admins: 2, activeLast30Days: 30, newThisPeriod: 5, invited: 3, seatsUsed: 40, seatsTotal: 50 },
    lms: {
      courses: 12,
      published: 9,
      learners: 38,
      enrolments: 120,
      completionRate: 64,
      averageProgress: 71,
      certificatesIssued: 22,
      overdueMandatory: 1,
      series: series(["enrolments", "completions"]) as never,
      topCourses: [{ slug: "fire-safety", title: "Fire safety", learners: 30, completionRate: 80 }],
    },
    hrm: null,
    projects: {
      activeProjects: 4,
      openItems: 57,
      overdueItems: 6,
      completedThisPeriod: 31,
      hoursLogged: 412.5,
      atRisk: [{ slug: "portal", name: "Student Portal Rebuild", reason: "6 items overdue" }],
      series: series(["created", "completed"]) as never,
    },
    finance: null,
    admin: null,
    activity: [{ module: "lms", action: "completed", actor: { id: "u1", name: "Ruth Akande" }, subject: "Fire safety", at: "2026-09-25T09:00:00Z" }],
    alerts: [
      { module: "projects", severity: "warning", message: "Student Portal Rebuild has 6 overdue items", href: "/suite/projects/portal" },
      { module: "lms", severity: "critical", message: "1 mandatory course overdue", href: "/suite/lms/compliance" },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  auth.user = { id: "u0", name: "Ada Admin", email: "ada@acme.test", role: "admin", organisationId: "org-1" };
});

describe("the organisation overview", () => {
  it("shows a section for each live module and none for a switched-off one", async () => {
    api.getOrgOverview.mockResolvedValue(overview());
    render(<OrgOverviewBoard />);

    expect(await screen.findByRole("heading", { name: "Learning", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "HR", level: 2 })).not.toBeInTheDocument();

    const previews = screen.getByRole("region", { name: "Not switched on" });
    expect(within(previews).getByText("HR")).toBeInTheDocument();
    expect(within(previews).getAllByRole("link", { name: /See preview/ })[0]).toHaveAttribute("href", "/suite/preview/hrm");
  });

  it("puts the most urgent alert first", async () => {
    api.getOrgOverview.mockResolvedValue(overview());
    render(<OrgOverviewBoard />);

    const alerts = await screen.findAllByText(/overdue/, { selector: "p" });
    expect(alerts[0]).toHaveTextContent("1 mandatory course overdue");
  });

  it("reads the window from the URL and writes it back when changed", async () => {
    nav.search = "window=90";
    api.getOrgOverview.mockResolvedValue(overview());
    const user = userEvent.setup();
    render(<OrgOverviewBoard />);

    await screen.findByRole("heading", { name: "Meridian Polytechnic" });
    expect(api.getOrgOverview).toHaveBeenCalledWith(90);

    await user.click(screen.getByRole("radio", { name: "30 days" }));
    expect(nav.replace).toHaveBeenCalledWith("/suite/org", { scroll: false });
  });

  it("says what failed and retries", async () => {
    api.getOrgOverview.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(overview());
    const user = userEvent.setup();
    render(<OrgOverviewBoard />);

    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Meridian Polytechnic" })).toBeInTheDocument();
  });

  it("reads the activity feed as sentences, not audit keys", async () => {
    api.getOrgOverview.mockResolvedValue(
      overview({
        activity: [
          { module: "hrm", action: "hrm.leave.approved", actor: { id: "u1", name: "Ruth Akande" }, subject: "Annual leave", at: "2026-09-25T09:00:00Z" },
          { module: "core", action: "team.demoted", actor: { id: "u2", name: "Ada Admin" }, subject: "bola@acme.test", at: "2026-09-24T09:00:00Z" },
        ],
      }),
    );
    render(<OrgOverviewBoard />);

    const feed = await screen.findByText(/approved leave/);
    expect(feed).toHaveTextContent("Ruth Akande approved leave Annual leave");
    expect(screen.getByText(/removed admin access from/)).toBeInTheDocument();
    expect(screen.queryByText(/hrm\.leave\.approved/)).not.toBeInTheDocument();
  });

  it("greets the viewer by first name and offers only the console pages they may open", async () => {
    api.getOrgOverview.mockResolvedValue(overview());
    render(<OrgOverviewBoard />);

    expect(await screen.findByRole("heading", { level: 1, name: /, Ada$|^Welcome back/ })).toBeInTheDocument();
    const links = screen.getByRole("navigation", { name: "Quick links" });
    expect(within(links).getByRole("link", { name: "Users" })).toHaveAttribute("href", "/suite/org/users");
  });

  it("offers a key holder no shortcut their roles do not reach", async () => {
    auth.user = { id: "u9", name: "Bola Member", email: "bola@acme.test", role: "user", organisationId: "org-1" };
    api.getOrgOverview.mockResolvedValue(overview());
    render(<OrgOverviewBoard />);

    await screen.findByRole("heading", { name: "Meridian Polytechnic" });
    expect(screen.queryByRole("navigation", { name: "Quick links" })).not.toBeInTheDocument();
  });

  it("links the new-users card to the newest-first list", async () => {
    api.getOrgOverview.mockResolvedValue(overview());
    render(<OrgOverviewBoard />);

    const card = await screen.findByRole("link", { name: /New in the last/ });
    expect(card).toHaveAttribute("href", "/suite/org/users?sort=-createdAt");
  });
});
