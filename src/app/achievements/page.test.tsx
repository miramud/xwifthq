import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import AchievementsPage from "./page";

/**
 * The learner's achievements screen.
 *
 * Two things are worth asserting. The rails have to say which quarter is
 * *next*, because that is the only reason the page beats a list of names. And
 * the leaderboard has to show the viewer their own rank even when the top-N cut
 * removed them, a board that lists ten strangers and not you is somebody
 * else's scoreboard.
 */

let currentUser: Record<string, unknown> | null = { role: "user", name: "Ada" };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false, refresh: vi.fn() }),
  AuthError: class extends Error {},
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const SHELF = {
  badges: [
    {
      key: "course:c1:25",
      type: "course",
      tier: 25,
      name: "Quarter Way",
      description: "Finished a quarter of the lectures in this course.",
      subjectId: "c1",
      subjectTitle: "Advanced SQL",
      awardedAt: "2026-08-01T10:00:00+00:00",
    },
    {
      key: "course:c1:50",
      type: "course",
      tier: 50,
      name: "Halfway",
      description: "Reached the midpoint of this course.",
      subjectId: "c1",
      subjectTitle: "Advanced SQL",
      awardedAt: "2026-08-02T10:00:00+00:00",
    },
    {
      key: "milestone:1",
      type: "milestone",
      tier: 1,
      name: "First Finish",
      description: "Completed your first course.",
      subjectId: null,
      subjectTitle: null,
      awardedAt: "2026-08-03T10:00:00+00:00",
    },
  ],
  counts: { total: 3, course: 2, learningPath: 0, milestone: 1 },
  nextMilestone: {
    tier: 3,
    name: "Three Down",
    description: "Completed three courses.",
    coursesCompleted: 1,
    coursesToGo: 2,
  },
};

const USAGE_BOARD = {
  scope: "usage",
  title: "Courses completed",
  unit: "courses",
  rows: [{ rank: 1, name: "Grace Hopper", initials: "GH", avatarUrl: null, score: 9, isYou: false }],
  you: { rank: 14, name: "Ada", initials: "A", avatarUrl: null, score: 1, isYou: true },
  total: 14,
};

/** Routes the page can call, keyed by the part of the URL that identifies them. */
function route(url: string) {
  if (url.startsWith("/api/me/badges")) return ok(SHELF);
  if (url.startsWith("/api/me/leaderboard")) return ok(USAGE_BOARD);
  if (url.startsWith("/api/me/learning-paths")) return ok({ paths: [] });
  if (url.startsWith("/api/me/courses")) return ok({ courses: [{ slug: "advanced-sql", title: "Advanced SQL" }] });
  return ok({});
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "user", name: "Ada" };
  fetchMock.mockImplementation((url: string) => Promise.resolve(route(url)));
  vi.stubGlobal("fetch", fetchMock);
});

describe("AchievementsPage: access", () => {
  it("asks a signed-out visitor to log in rather than loading anything", () => {
    currentUser = null;

    render(<AchievementsPage />);

    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AchievementsPage: the quarter rails", () => {
  it("names the quarter a learner is closest to, not just what they hold", async () => {
    render(<AchievementsPage />);

    // Queried as a heading: the title is also an option in the board picker.
    expect(await screen.findByRole("heading", { name: "Advanced SQL" })).toBeInTheDocument();
    expect(screen.getByText(/next: 75% of the way through/i)).toBeInTheDocument();
  });

  it("labels the rail with how many of the four quarters are earned", async () => {
    render(<AchievementsPage />);

    expect(
      await screen.findByRole("list", { name: /advanced sql: 2 of 4 quarter badges earned/i }),
    ).toBeInTheDocument();
  });

  it("says how many more courses the next milestone needs", async () => {
    render(<AchievementsPage />);

    expect(await screen.findByText(/three down: 2 more courses/i)).toBeInTheDocument();
  });
});

describe("AchievementsPage: the leaderboard", () => {
  /** The reason `you` is returned separately from `rows`. */
  it("pins the viewer's own rank when the cut left them off", async () => {
    render(<AchievementsPage />);

    const you = await screen.findByText(/^You$/);
    expect(you).toBeInTheDocument();

    // Their real rank, not a position inside the visible slice.
    expect(screen.getByText("14")).toBeInTheDocument();
    // Ranks 2 through 13 are not shown, which is what the gap has to say.
    expect(screen.getByText(/12 others between/i)).toBeInTheDocument();
  });

  it("switches board when another one is chosen", async () => {
    const user = userEvent.setup();
    render(<AchievementsPage />);

    await screen.findByRole("heading", { name: "Advanced SQL" });

    await chooseOption(user, /which leaderboard/i, "Advanced SQL");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/me/courses/advanced-sql/leaderboard"),
        ),
      ).toBe(true),
    );
  });

  it("says the board is empty rather than showing a bare frame", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/me/leaderboard")
          ? ok({ rows: [], you: null, total: 0, unit: "courses" })
          : route(String(url)),
      ),
    );

    render(<AchievementsPage />);

    expect(await screen.findByText(/nobody has made progress here yet/i)).toBeInTheDocument();
  });
});

describe("AchievementsPage: nothing earned yet", () => {
  it("points a learner with no badges at their courses", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/me/badges")
          ? ok({
              badges: [],
              counts: { total: 0, course: 0, learningPath: 0, milestone: 0 },
              nextMilestone: null,
            })
          : route(String(url)),
      ),
    );

    render(<AchievementsPage />);

    const empty = await screen.findByText(/no badges yet/i);
    expect(empty).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to my courses/i })).toBeInTheDocument();
  });
});

describe("AchievementsPage: failure", () => {
  it("offers a retry instead of an empty page", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/me/badges")
          ? { ok: false, status: 500, json: async () => ({ message: "Badges are unavailable." }) }
          : route(String(url)),
      ),
    );

    render(<AchievementsPage />);

    expect(await screen.findByText("Badges are unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

describe("AchievementsPage: a removed course", () => {
  /** A badge outlives what it was earned on; it must still render. */
  it("still shows a badge whose course has been deleted", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).startsWith("/api/me/badges")
          ? ok({
              ...SHELF,
              badges: [{ ...SHELF.badges[0], subjectTitle: null }],
            })
          : route(String(url)),
      ),
    );

    render(<AchievementsPage />);

    const rails = await screen.findByRole("list", { name: /removed: 1 of 4/i });
    expect(within(rails).getAllByRole("listitem")).toHaveLength(4);
  });
});
