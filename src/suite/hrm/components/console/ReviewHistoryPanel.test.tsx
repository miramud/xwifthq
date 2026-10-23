import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewHistoryPanel from "./ReviewHistoryPanel";
import type { PerformanceReview } from "@/lib/api/hrm-client";

/**
 * Everything one person has been reviewed on.
 *
 * `GET /hrm/employees/{employee}/reviews` had no caller, and the nearest thing
 * that did — the rating chart on the performance screen — answers a narrower
 * question: completed reviews only, two numbers per round. This is the written
 * record, which is what somebody opens before a promotion conversation and
 * what is asked for when a decision is disputed.
 *
 * Three things worth pinning.
 *
 * **The two ratings never become one.** Somebody at 5 against a manager's 2 is
 * the most actionable fact in the review, and an average destroys it while
 * looking like information.
 *
 * **An abandoned round is shown, not hidden.** It is part of why there is a
 * gap in the record, and hiding it makes the gap look like neglect.
 *
 * **The frozen figures say they are frozen.** They were snapshotted at
 * sign-off, and a reader who assumes they are live will misread a three-year-
 * old review against this quarter's targets.
 */

const { forEmployee } = vi.hoisted(() => ({ forEmployee: vi.fn() }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { reviews: { forEmployee } } };
});

function review(overrides: Partial<PerformanceReview> = {}): PerformanceReview {
  return {
    id: "rev-1",
    cycleId: "cyc-1",
    employeeId: "emp-1",
    status: "complete",
    statusLabel: "Complete",
    isOpen: false,
    waitingOn: null,
    selfRating: 4,
    managerRating: 3,
    gap: 1,
    kpiAttainment: 92,
    milestoneAttainment: 75,
    selfAssessment: "I took on the night rota single-handed in March.",
    managerComments: "Agreed, and it held up under real pressure.",
    strengths: "Keeps her head when the ward is short.",
    development: "Delegate sooner.",
    objectives: "Lead the induction programme next year.",
    selfSubmittedAt: "2026-03-01T09:00:00Z",
    managerSubmittedAt: "2026-03-08T09:00:00Z",
    metOn: "2026-03-15",
    completedAt: "2026-03-15T14:00:00Z",
    cycle: {
      id: "cyc-1",
      name: "2025/26 annual",
      periodStart: "2025-04-01",
      periodEnd: "2026-03-31",
      dueOn: "2026-03-31",
    },
    createdAt: "2026-01-01T09:00:00Z",
    ...overrides,
  } as PerformanceReview;
}

beforeEach(() => {
  vi.clearAllMocks();
  forEmployee.mockResolvedValue([review()]);
});

describe("the record", () => {
  it("asks for this employee's reviews", async () => {
    render(<ReviewHistoryPanel employeeId="emp-9" />);

    await screen.findByText("2025/26 annual");

    expect(forEmployee).toHaveBeenCalledWith("emp-9");
  });

  it("reports the two ratings separately and never averages them", async () => {
    render(<ReviewHistoryPanel employeeId="emp-1" />);

    await screen.findByText("2025/26 annual");

    expect(screen.getByText("Self")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    /* 3.5 would be the average of the two. It must not appear. */
    expect(screen.queryByText("3.5")).not.toBeInTheDocument();
  });

  /* The paragraphs, which is the whole reason this is not the rating chart. */
  it("opens the written halves of a review", async () => {
    render(<ReviewHistoryPanel employeeId="emp-1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Read it" }));

    expect(
      screen.getByText("I took on the night rota single-handed in March."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Agreed, and it held up under real pressure."),
    ).toBeInTheDocument();
    expect(screen.getByText("Lead the induction programme next year.")).toBeInTheDocument();
  });

  it("keeps the paragraphs folded away until asked for", async () => {
    render(<ReviewHistoryPanel employeeId="emp-1" />);

    await screen.findByText("2025/26 annual");

    expect(
      screen.queryByText("I took on the night rota single-handed in March."),
    ).not.toBeInTheDocument();
  });

  /*
    A reader who assumes these are live figures will judge a three-year-old
    review against this quarter's targets.
  */
  it("says the attainment figures were frozen at sign-off", async () => {
    render(<ReviewHistoryPanel employeeId="emp-1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Read it" }));

    expect(screen.getByText(/Frozen at the time, not recalculated since/)).toBeInTheDocument();
    expect(screen.getByText(/targets 92%/)).toBeInTheDocument();
  });

  it("offers nothing to open on a review nobody has written in", async () => {
    forEmployee.mockResolvedValue([
      review({
        status: "awaiting_self",
        statusLabel: "Waiting on them",
        isOpen: true,
        selfAssessment: null,
        managerComments: null,
        strengths: null,
        development: null,
        objectives: null,
      }),
    ]);

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    await screen.findByText("2025/26 annual");

    expect(screen.queryByRole("button", { name: "Read it" })).not.toBeInTheDocument();
  });
});

describe("rounds that did not finish", () => {
  /*
    Shown rather than filtered. A cancelled review is part of why there is a
    gap in somebody's record, and hiding it makes the gap look like neglect.
  */
  it("keeps an abandoned round in the list", async () => {
    forEmployee.mockResolvedValue([
      review({
        id: "rev-2",
        status: "cancelled",
        statusLabel: "Cancelled",
        isOpen: false,
        cycle: {
          id: "cyc-0",
          name: "2024/25 annual",
          periodStart: "2024-04-01",
          periodEnd: "2025-03-31",
          dueOn: null,
        },
      }),
      review(),
    ]);

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    expect(await screen.findByText("2024/25 annual")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("counts finished rounds against the total when some are not", async () => {
    forEmployee.mockResolvedValue([
      review(),
      review({ id: "rev-2", status: "awaiting_manager", statusLabel: "Waiting on you", isOpen: true }),
    ]);

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    expect(await screen.findByText("1 of 2 rounds finished")).toBeInTheDocument();
  });
});

describe("edges", () => {
  it("says somebody has never been reviewed, and what raises one", async () => {
    forEmployee.mockResolvedValue([]);

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    expect(await screen.findByText("Never been reviewed here")).toBeInTheDocument();
    expect(screen.getByText(/raises one for everybody currently employed/)).toBeInTheDocument();
  });

  it("reports a failure rather than showing an empty record", async () => {
    forEmployee.mockRejectedValue(new Error("Gateway timed out."));

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    expect(await screen.findByText("Could not load")).toBeInTheDocument();
    expect(screen.getByText("Gateway timed out.")).toBeInTheDocument();
  });

  /* A round deleted after the reviews were raised. */
  it("survives a review whose cycle has gone", async () => {
    forEmployee.mockResolvedValue([review({ cycle: undefined })]);

    render(<ReviewHistoryPanel employeeId="emp-1" />);

    expect(await screen.findByText("Unnamed round")).toBeInTheDocument();
  });
});
