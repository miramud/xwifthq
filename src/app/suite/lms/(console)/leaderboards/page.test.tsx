import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import LeaderboardsPage from "./page";

/**
 * The admin leaderboards screen.
 *
 * An admin's question is "who has stalled", so the count of learners with any
 * progress at all is as load-bearing as the ranking — a board of three names
 * from a cohort of ninety is the finding. The other thing worth pinning down is
 * that switching scope actually re-asks the API rather than re-labelling stale
 * rows.
 */

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: "admin", organisationId: "org-1" }, loading: false }),
  AuthError: class extends Error {},
}));

// The ranking is a workspace DataView now, which reads the app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/lms/leaderboards",
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const USAGE = {
  data: {
    scope: "usage",
    unit: "courses",
    rows: [
      { rank: 1, name: "Ada Lovelace", initials: "AL", avatarUrl: null, score: 4, isYou: false },
      { rank: 2, name: "Alan Turing", initials: "AT", avatarUrl: null, score: 1, isYou: false },
    ],
    you: null,
    total: 2,
  },
};

const COURSE_BOARD = {
  data: {
    scope: "course",
    unit: "percent",
    rows: [{ rank: 1, name: "Ada Lovelace", initials: "AL", avatarUrl: null, score: 75, isYou: false }],
    you: null,
    total: 1,
  },
};

function route(url: string) {
  if (url.startsWith("/api/admin/leaderboards/usage")) return ok(USAGE);
  if (url.startsWith("/api/admin/leaderboards/courses/")) return ok(COURSE_BOARD);
  if (url.startsWith("/api/admin/courses")) {
    return ok({ data: [{ slug: "advanced-sql", title: "Advanced SQL" }] });
  }
  if (url.startsWith("/api/admin/learning-paths")) return ok({ data: [] });
  return ok({});
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation((url: string) => Promise.resolve(route(url)));
  vi.stubGlobal("fetch", fetchMock);
});

describe("AdminLeaderboardsPage", () => {
  it("opens on the overall board and ranks by courses finished", async () => {
    render(<LeaderboardsPage />);

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("4 courses")).toBeInTheDocument();
    // Singular, because "1 courses" is the kind of thing people notice.
    expect(screen.getByText("1 course")).toBeInTheDocument();
  });

  /** The number that turns a ranking into a finding. */
  it("says how many learners have any progress at all", async () => {
    render(<LeaderboardsPage />);

    expect(await screen.findByText(/2 learners with progress/i)).toBeInTheDocument();
  });

  it("re-asks the API when the scope changes", async () => {
    const user = userEvent.setup();
    render(<LeaderboardsPage />);

    await screen.findByText("Ada Lovelace");

    await chooseOption(user, screen.getByRole("combobox", { name: /leaderboard type/i }), "By course");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/admin/leaderboards/courses/advanced-sql"),
        ),
      ).toBe(true),
    );

    expect(await screen.findByText("75%")).toBeInTheDocument();
  });

  it("explains an empty board instead of showing a bare frame", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/admin/leaderboards/usage")
          ? ok({ data: { rows: [], you: null, total: 0, unit: "courses" } })
          : route(String(url)),
      ),
    );

    render(<LeaderboardsPage />);

    expect(await screen.findByText(/nobody on this board yet/i)).toBeInTheDocument();
  });

  it("reports a failure rather than pretending the board is empty", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/admin/leaderboards/usage")
          ? { ok: false, status: 500, json: async () => ({ message: "Leaderboards are down." }) }
          : route(String(url)),
      ),
    );

    render(<LeaderboardsPage />);

    expect(await screen.findByText("Leaderboards are down.")).toBeInTheDocument();
  });

  it("does not ask for a board when there is nothing to rank", async () => {
    const user = userEvent.setup();
    render(<LeaderboardsPage />);

    await screen.findByText("Ada Lovelace");

    // No learning paths exist in this institution.
    await chooseOption(user, screen.getByRole("combobox", { name: /leaderboard type/i }), "By learning path");

    expect(await screen.findByText(/nothing to rank yet/i)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/admin/leaderboards/learning-paths/"),
      ),
    ).toBe(false);
  });
});
