import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyCoursesPage from "./page";
import { StoreProvider } from "@/lib/store";

/**
 * The learner's own courses.
 *
 * The behaviour worth pinning is where the numbers come from. They used to be
 * derived in the browser — count the lesson ids in localStorage, divide by the
 * lecture count on the cached course — and that drifts silently the moment
 * anything happens anywhere else. These tests assert that the API's figures
 * win, that a stale local count is overridden rather than averaged in, and
 * that the fallback is announced rather than passed off as current.
 */

vi.mock("@/lib/auth-store", () => ({
  // `isAuthenticated` is the flag the page gates its fetches on. Without it the
  // effect returns early and the whole screen renders its empty state, which
  // looks like a page bug rather than a mock that forgot a field.
  useAuth: () => ({
    user: { role: "user", name: "Ada" },
    isAuthenticated: true,
    loading: false,
  }),
  AuthError: class extends Error {},
}));

/** The chart is exercised by its own tests; here it would only add noise. */
vi.mock("@/suite/lms/components/progress/ProgressCharts", () => ({
  ProgressSeriesChart: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div data-testid="series-chart" aria-label={ariaLabel} />
  ),
}));

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<unknown>>();

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/**
 * The card metadata the progress report has no business carrying, with a
 * *stale* local lesson count — two of four — so a test can tell which source
 * a figure came from.
 */
const ENROLLED = [
  {
    slug: "advanced-sql",
    title: "Advanced SQL",
    enrolledAt: "2026-08-01T10:00:00+00:00",
    instructor: { name: "Grace Hopper" },
    gradient: "from-blue-500 to-indigo-600",
    duration: "6h 20m",
    totalLectures: 4,
    totalHours: 6,
    progress: {
      completedLessons: ["l1", "l2"],
      lastAccessedLesson: "l2",
      lastAccessedSection: 0,
      completedAt: null,
    },
  },
  {
    slug: "fire-safety",
    title: "Fire Safety",
    enrolledAt: "2026-08-05T10:00:00+00:00",
    instructor: { name: "Ada Lovelace" },
    gradient: "from-rose-500 to-orange-500",
    duration: "40m",
    totalLectures: 5,
    totalHours: 1,
    progress: {
      completedLessons: [],
      lastAccessedLesson: "",
      lastAccessedSection: 0,
      completedAt: null,
    },
  },
];

/** The same report an administrator reads about this learner. */
const REPORT = {
  learner: { id: "u1", name: "Ada", email: "ada@acme.test" },
  totals: {
    courses: 2,
    completed: 0,
    lessonsDone: 5,
    averagePercent: 47,
    mandatoryCourses: 1,
    mandatoryCompleted: 0,
    activeDays: 6,
    lastActivityAt: "2026-09-18T10:00:00+00:00",
  },
  series: [
    {
      date: "2026-09-18",
      label: "18 Sep",
      completed: 2,
      backfilled: 0,
      cumulative: 5,
      percent: null,
    },
  ],
  courses: [
    {
      slug: "advanced-sql",
      title: "Advanced SQL",
      gradient: "from-blue-500 to-indigo-600",
      thumbnailUrl: null,
      status: "active",
      source: "self_enrolment",
      mandatory: false,
      // Three of four — the local store still says two.
      lessonsDone: 3,
      totalLectures: 4,
      percent: 75,
      completedAt: null,
    },
    {
      slug: "fire-safety",
      title: "Fire Safety",
      gradient: "from-rose-500 to-orange-500",
      thumbnailUrl: null,
      status: "active",
      source: "assignment",
      mandatory: true,
      lessonsDone: 1,
      totalLectures: 5,
      percent: 20,
      completedAt: null,
    },
  ],
};

function answer(courses: unknown, progress: unknown, progressOk = true) {
  fetchMock.mockImplementation(async (input: string) => {
    if (input.startsWith("/api/me/progress")) {
      return progressOk
        ? ok({ data: progress })
        : { ok: false, status: 500, json: async () => ({ message: "boom" }) };
    }

    if (input.startsWith("/api/me/courses")) {
      return ok({ courses });
    }

    return ok({});
  });
}

function renderPage() {
  return render(
    <StoreProvider>
      <MyCoursesPage />
    </StoreProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

describe("my courses", () => {
  /**
   * The point of the change. The card must show 3/4 from the API, not the 2/4
   * the browser had cached — and it must not quietly average the two.
   */
  it("shows the API's lesson count rather than the one cached locally", async () => {
    answer(ENROLLED, REPORT);

    renderPage();

    const card = await screen.findByRole("heading", { name: "Advanced SQL" });
    const figures = card.closest("div.flex-1") as HTMLElement;

    await waitFor(() => {
      expect(within(figures).getByText("3/4 lessons")).toBeInTheDocument();
    });

    expect(within(figures).getByText("75% complete")).toBeInTheDocument();
    expect(within(figures).queryByText("2/4 lessons")).not.toBeInTheDocument();
  });

  it("reports average completion from the API", async () => {
    answer(ENROLLED, REPORT);

    renderPage();

    expect(await screen.findByText("47%")).toBeInTheDocument();
    expect(screen.getByText("Average Completion")).toBeInTheDocument();
  });

  /**
   * Required training is the one thing on this page somebody else is waiting
   * on, and burying it among courses the learner chose is how it gets missed.
   */
  it("calls out outstanding required training above everything else", async () => {
    answer(ENROLLED, REPORT);

    renderPage();

    // The count and the noun are separate text nodes, so the assertion reads
    // the banner's own text rather than hunting for a single matching node.
    const banner = await screen.findByText(/were assigned to you/i);

    expect(banner.textContent).toMatch(/1 required course\b/i);

    /*
       Exactly one card carries the badge, and it is the assigned one.

       Scoped to the cards rather than queried globally: the filter tab reads
       as "Required" too, because Testing Library's default matcher joins only
       an element's direct text children and the tab's count sits in a nested
       span.
     */
    const cards = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.closest("div.shadow-sm") as HTMLElement);

    const flagged = cards.filter(
      (card) => within(card).queryByText("Required") !== null,
    );

    expect(flagged).toHaveLength(1);
    expect(flagged[0].textContent).toContain("Fire Safety");
  });

  it("filters to the required courses", async () => {
    answer(ENROLLED, REPORT);

    renderPage();

    /*
       The count sits in a `<span>` with no separating text node, so the
       accessible name is "Required(1)" — anchored, because a loose /Required/
       also matches the badge on the assigned card.
     */
    const tab = await screen.findByRole("button", { name: /^Required\(1\)$/ });

    await userEvent.click(tab);

    expect(screen.getByRole("heading", { name: "Fire Safety" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Advanced SQL" }),
    ).not.toBeInTheDocument();
  });

  /** Nothing assigned, so the tab would always be empty. */
  it("hides the required tab when there is no required training", async () => {
    answer(ENROLLED, {
      ...REPORT,
      totals: { ...REPORT.totals, mandatoryCourses: 0, mandatoryCompleted: 0 },
      courses: REPORT.courses.map((c) => ({ ...c, mandatory: false })),
    });

    renderPage();

    await screen.findByText("47%");

    expect(screen.queryByRole("button", { name: /Required/ })).toBeNull();
    expect(screen.queryByText(/were assigned to you/i)).toBeNull();
  });

  it("draws the activity chart when there is a series", async () => {
    answer(ENROLLED, REPORT);

    renderPage();

    expect(await screen.findByTestId("series-chart")).toBeInTheDocument();

    // Days studied, not consecutive days — a weekend break is not a failure of
    // consistency. Asserted on the whole label, since the number and the words
    // are separate nodes and a bare /6/ matches half the page.
    const streak = screen.getByText(/days studied/i);
    expect(streak.parentElement?.textContent).toMatch(/6\s*days studied/i);
  });

  /**
   * A stale bar is better than a blank card — but only if the page says which
   * it is showing. Passing local data off as current is the failure the whole
   * change was made to avoid.
   */
  it("falls back to the local count and says so when the report fails", async () => {
    answer(ENROLLED, null, false);

    renderPage();

    expect(
      await screen.findByText(/Showing progress saved on this device/i),
    ).toBeInTheDocument();

    const card = screen.getByRole("heading", { name: "Advanced SQL" });
    const figures = card.closest("div.flex-1") as HTMLElement;

    // The local two of four, not the API's three.
    expect(within(figures).getByText("2/4 lessons")).toBeInTheDocument();

    // And average completion is withheld rather than invented.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is enrolled", async () => {
    answer([], { ...REPORT, totals: { ...REPORT.totals, courses: 0 }, courses: [] });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /No courses yet/i }),
    ).toBeInTheDocument();
  });
});
