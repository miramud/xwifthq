import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProjectsBoard from "./ProjectsBoard";

/**
 * /suite/projects/new (P23). "new" is a reserved project slug, so the route
 * redirects here with ?new=1, and the list opens the new-project form - but
 * only for somebody the API says may start one.
 */

const api = vi.hoisted(() => ({
  projectsList: vi.fn(),
  portfoliosList: vi.fn(),
  companiesList: vi.fn(),
}));

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects",
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
    projects: { ...actual.projects, list: api.projectsList },
    portfolios: { ...actual.portfolios, list: api.portfoliosList },
    companies: { ...actual.companies, list: api.companiesList },
  };
});

function page(canCreate: boolean) {
  api.projectsList.mockResolvedValue({ data: [], meta: { canCreate } });
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  api.portfoliosList.mockResolvedValue([]);
  api.companiesList.mockResolvedValue({ data: [] });
});

describe("the new-project link", () => {
  it("opens the form for somebody who may start a project", async () => {
    nav.search = "new=1";
    page(true);

    render(<ProjectsBoard />);

    expect(await screen.findByRole("dialog", { name: "New project" })).toBeInTheDocument();
  });

  it("opens nothing for somebody who may not", async () => {
    nav.search = "new=1";
    page(false);

    render(<ProjectsBoard />);

    await screen.findByText(/staffed on/);
    expect(screen.queryByRole("dialog", { name: "New project" })).not.toBeInTheDocument();
  });

  it("opens nothing without it", async () => {
    page(true);

    render(<ProjectsBoard />);

    expect((await screen.findAllByRole("button", { name: /New project/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog", { name: "New project" })).not.toBeInTheDocument();
  });
});
