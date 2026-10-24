import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MyLearningPathsPage from "./page";
import type { LearnerPath } from "@/lib/api/saas-client";

/**
 * What a learner sees of a track they have been put on.
 *
 * The two facts that matter are how far through they are and whether they are
 * late, and both have to survive without colour, since colour alone is not an
 * indicator anyone can rely on.
 */

const listPaths = vi.fn<() => Promise<LearnerPath[]>>();

vi.mock("@/lib/api/saas-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/saas-client")>();

  return {
    ...actual,
    myLearningPaths: { list: () => listPaths() },
  };
});

let currentUser: { role: string; name: string } | null = { role: "user", name: "Ada" };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

function path(overrides: Partial<LearnerPath> = {}): LearnerPath {
  return {
    slug: "onboarding",
    title: "New starter onboarding",
    description: "Everything to get going in your first fortnight.",
    gradient: null,
    courseCount: 4,
    requiredCount: 4,
    completedCount: 1,
    percent: 25,
    assignedAt: "2026-08-01T00:00:00Z",
    dueAt: null,
    completedAt: null,
    isComplete: false,
    isOverdue: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "user", name: "Ada" };
});

describe("MyLearningPathsPage", () => {
  it("shows each assigned path with its progress", async () => {
    listPaths.mockResolvedValue([path()]);

    render(<MyLearningPathsPage />);

    expect(await screen.findByText("New starter onboarding")).toBeInTheDocument();
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
  });

  /** The figure has to be readable without interpreting the arc. */
  it("exposes progress as an accessible value, not just a drawing", async () => {
    listPaths.mockResolvedValue([path({ percent: 25 })]);

    render(<MyLearningPathsPage />);

    const meter = await screen.findByRole("progressbar");

    expect(meter).toHaveAttribute("aria-valuenow", "25");
    expect(meter).toHaveAccessibleName("25% complete");
  });

  it("counts only required courses in the progress figure", async () => {
    // Six courses on the path, but only three of them required.
    listPaths.mockResolvedValue([
      path({ courseCount: 6, requiredCount: 3, completedCount: 3, percent: 100, isComplete: true }),
    ]);

    render(<MyLearningPathsPage />);

    expect(await screen.findByText(/3 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/required courses? finished/i)).toBeInTheDocument();
  });

  /** Overdue is stated in words, not only in red. */
  it("labels an overdue path in text", async () => {
    listPaths.mockResolvedValue([
      path({ dueAt: "2026-07-01T00:00:00Z", isOverdue: true }),
    ]);

    render(<MyLearningPathsPage />);

    expect(await screen.findByText("Overdue")).toBeInTheDocument();
  });

  it("labels a finished path as complete", async () => {
    listPaths.mockResolvedValue([
      path({ completedCount: 4, percent: 100, isComplete: true, completedAt: "2026-08-05T00:00:00Z" }),
    ]);

    render(<MyLearningPathsPage />);

    expect(await screen.findByText("Complete")).toBeInTheDocument();
  });

  it("hides the deadline once the path is finished", async () => {
    listPaths.mockResolvedValue([
      path({ dueAt: "2026-12-01T00:00:00Z", isComplete: true, percent: 100 }),
    ]);

    render(<MyLearningPathsPage />);

    await screen.findByText("Complete");
    expect(screen.queryByText(/^Due/)).not.toBeInTheDocument();
  });

  it("explains the empty state rather than showing a blank page", async () => {
    listPaths.mockResolvedValue([]);

    render(<MyLearningPathsPage />);

    expect(await screen.findByText(/no learning paths yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to my courses/i })).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    listPaths.mockRejectedValue(new Error("network"));

    render(<MyLearningPathsPage />);

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("sends a signed-out visitor to log in", async () => {
    currentUser = null;

    render(<MyLearningPathsPage />);

    const link = screen.getByRole("link", { name: /log in/i });

    expect(link).toHaveAttribute("href", "/login?redirect=/my-learning-paths");
    expect(listPaths).not.toHaveBeenCalled();
  });
});
