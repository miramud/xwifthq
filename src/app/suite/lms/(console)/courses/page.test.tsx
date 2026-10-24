import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminCoursesPage from "./page";

/**
 * The admin course list.
 *
 * The record below is the shape the API sends today: no `completions`, and
 * the instructor's initials where an avatar URL might be. The table view used
 * to format the missing count and took the whole page down with it.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/lms/courses",
  useSearchParams: () => new URLSearchParams(),
}));

const COURSE = {
  slug: "reading-technical-drawings",
  title: "Reading Technical Drawings",
  category: "Engineering",
  level: "Beginner",
  instructor: "Emeka Nwosu",
  instructorAvatar: "EN",
  gradient: "from-primary-600 to-primary-800",
  thumbnailUrl: null,
  students: 6,
  revenue: 0,
  rating: 5,
  reviews: 1,
  lectures: 4,
  status: "Published",
  lastUpdated: "September 2026",
  createdAt: "2026-09-23T17:40:17+00:00",
};

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(String(url).includes("categories") ? ok({ data: [] }) : ok({ data: [COURSE] })),
    ),
  );
});

describe("AdminCoursesPage", () => {
  it("shows the table when the API sends no completions", async () => {
    const user = userEvent.setup();
    render(<AdminCoursesPage />);

    await screen.findAllByText("Reading Technical Drawings");
    await user.click(screen.getByRole("radio", { name: /table view/i }));

    const row = screen.getByRole("row", { name: /reading technical drawings/i });
    expect(within(row).getByText("6")).toBeInTheDocument();
    expect(within(row).getByText("-")).toBeInTheDocument();
  });

  it("says completions are not reported rather than showing nought", async () => {
    render(<AdminCoursesPage />);

    await screen.findAllByText("Reading Technical Drawings");
    expect(screen.getByText("Not reported yet")).toBeInTheDocument();
  });

  it("does not use initials as an image address", async () => {
    const { container } = render(<AdminCoursesPage />);

    await screen.findAllByText("Reading Technical Drawings");
    expect(container.querySelector('img[src="EN"]')).toBeNull();
  });
});
