import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewsBoard from "./ReviewsBoard";
import {
  ApiError,
  type PerformanceReview,
  type ReviewCycle,
} from "@/lib/api/hrm-client";

/**
 * Appraisal rounds, and abandoning one.
 *
 * `POST /hrm/reviews/{review}/cancel` had no caller, which left a manager with
 * an appraisal for somebody who resigned in week two sitting in the round
 * forever, counted as outstanding and chased every time the list is read.
 *
 * What the control has to get right:
 *
 * **It is offered only where it will work.** The API refuses to cancel a
 * completed review, because that score has been discussed and signed off and
 * cancelling would take the rating out with nothing to put back. A button that
 * is always shown teaches the rule through an error message.
 *
 * **It is not "delete".** Nothing written is destroyed. A manager who believes
 * it erases a half-written self-assessment will leave the row there instead.
 *
 * **The reason is kept.** A year later it is the only thing separating "she
 * left" from "nobody got round to it".
 */

const { cycles, list, cancel } = vi.hoisted(() => ({
  cycles: vi.fn(),
  list: vi.fn(),
  cancel: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/reviews",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      reviews: {
        cycles,
        list,
        cancel,
        complete: vi.fn(),
        reopen: vi.fn(),
        openCycle: vi.fn(),
        closeCycle: vi.fn(),
        createCycle: vi.fn(),
        submitManager: vi.fn(),
      },
    },
  };
});

const CYCLE: ReviewCycle = {
  id: "cyc-1",
  name: "2025/26 annual",
  description: null,
  periodStart: "2025-04-01",
  periodEnd: "2026-03-31",
  dueOn: "2026-03-31",
  status: "open",
  statusLabel: "Open",
  acceptsReviews: true,
  isOverdue: false,
  createdAt: null,
};

function review(overrides: Partial<PerformanceReview> = {}): PerformanceReview {
  return {
    id: "rev-1",
    cycleId: "cyc-1",
    employeeId: "emp-1",
    status: "awaiting_self",
    statusLabel: "Waiting on them",
    isOpen: true,
    waitingOn: "employee",
    selfRating: null,
    managerRating: null,
    gap: null,
    kpiAttainment: null,
    milestoneAttainment: null,
    selfAssessment: null,
    managerComments: null,
    strengths: null,
    development: null,
    objectives: null,
    selfSubmittedAt: null,
    managerSubmittedAt: null,
    metOn: null,
    completedAt: null,
    employee: {
      id: "emp-1",
      name: "Ada Lovelace",
      jobTitle: "Staff nurse",
      department: "Ward 4",
    },
    cycle: {
      id: "cyc-1",
      name: "2025/26 annual",
      periodStart: "2025-04-01",
      periodEnd: "2026-03-31",
      dueOn: "2026-03-31",
    },
    createdAt: null,
    ...overrides,
  } as PerformanceReview;
}

function respond(reviews: PerformanceReview[]) {
  list.mockResolvedValue({
    data: reviews,
    meta: {
      total: reviews.length,
      awaitingSelf: reviews.filter((r) => r.waitingOn === "employee").length,
      awaitingManager: reviews.filter((r) => r.waitingOn === "manager").length,
      awaitingMeeting: reviews.filter((r) => r.waitingOn === "meeting").length,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cycles.mockResolvedValue([CYCLE]);
  respond([review()]);
  cancel.mockResolvedValue(
    review({ status: "cancelled", statusLabel: "Cancelled", isOpen: false }),
  );
});

describe("abandoning a review", () => {
  it("is offered on an open review", async () => {
    render(<ReviewsBoard />);

    expect(
      await screen.findByRole("button", { name: "Abandon" }),
    ).toBeInTheDocument();
  });

  /*
    The API refuses this, so offering it would teach the rule through a 422.
  */
  it("is not offered on a completed one", async () => {
    respond([
      review({
        status: "complete",
        statusLabel: "Complete",
        isOpen: false,
        waitingOn: null,
      }),
    ]);

    render(<ReviewsBoard />);

    // The avatar also names the person for screen readers, so there are two.
    await screen.findAllByText("Ada Lovelace");

    expect(
      screen.queryByRole("button", { name: "Abandon" }),
    ).not.toBeInTheDocument();
  });

  it("says what is and is not destroyed before anybody confirms", async () => {
    render(<ReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Abandon" }));

    expect(screen.getByText(/Nothing already written is deleted/)).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("sends the reason with it", async () => {
    render(<ReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Abandon" }));
    await userEvent.type(screen.getByLabelText("Why"), "Resigned in October");
    await userEvent.click(screen.getByRole("button", { name: "Abandon it" }));

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith("rev-1", "Resigned in October"),
    );
  });

  /* Optional, but the field says why it is worth filling in. */
  it("goes through without a reason rather than blocking on one", async () => {
    render(<ReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Abandon" }));
    await userEvent.click(screen.getByRole("button", { name: "Abandon it" }));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith("rev-1", undefined));
  });

  it("reloads the round once it has gone through", async () => {
    render(<ReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Abandon" }));
    await userEvent.click(screen.getByRole("button", { name: "Abandon it" }));

    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
  });

  it("keeps the dialog open and says why when the API refuses", async () => {
    cancel.mockRejectedValue(
      new ApiError("A completed review cannot be cancelled.", 422),
    );

    render(<ReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Abandon" }));
    await userEvent.click(screen.getByRole("button", { name: "Abandon it" }));

    expect(
      await screen.findByText("A completed review cannot be cancelled."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Why")).toBeInTheDocument();
  });
});
