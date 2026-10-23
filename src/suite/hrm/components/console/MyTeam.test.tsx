import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamLeaveBoard, TeamOverviewBoard, TeamReviewsBoard } from "./MyTeam";
import type { LeaveRequest, PerformanceReview, TeamOverview } from "@/lib/api/hrm-client";

/**
 * My team (S9): a line manager's decisions about their direct reports.
 *
 * What is worth pinning here is *where* the decisions go. The dialogs are
 * HR's own, reused; a My team page that quietly called HR's endpoints would
 * be refused for every supervisor (and would decide outside their team for
 * an HR manager), so every call must be a `hrm.team.*` one.
 */

const team = vi.hoisted(() => ({
  overview: vi.fn(),
  leave: vi.fn(),
  getLeave: vi.fn(),
  approveLeave: vi.fn(),
  declineLeave: vi.fn(),
  timesheets: vi.fn(),
  approveTimesheet: vi.fn(),
  rejectTimesheet: vi.fn(),
  swaps: vi.fn(),
  approveSwap: vi.fn(),
  declineSwap: vi.fn(),
  reviews: vi.fn(),
  submitManagerReview: vi.fn(),
}));

const hrLeave = vi.hoisted(() => ({ get: vi.fn(), approve: vi.fn(), decline: vi.fn(), recall: vi.fn() }));
const hrReviews = vi.hoisted(() => ({ submitManager: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/team",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { team, leave: hrLeave, reviews: hrReviews } };
});

const OVERVIEW: TeamOverview = {
  manager: { employeeId: "emp-boss", jobTitle: "Engineering Manager" },
  date: "2026-09-23",
  people: [
    {
      employeeId: "emp-ada",
      name: "Ada Obi",
      email: "ada@example.test",
      avatar: null,
      jobTitle: "Backend Engineer",
      department: "Engineering",
      status: "active",
      statusLabel: "Active",
      today: { state: "away", leaveType: "Annual leave", awayUntil: "2026-09-25", signedInAt: null, shift: null },
    },
    {
      employeeId: "emp-ike",
      name: "Ike Bello",
      email: "ike@example.test",
      avatar: null,
      jobTitle: "Frontend Engineer",
      department: "Engineering",
      status: "active",
      statusLabel: "Active",
      today: { state: "in", leaveType: null, awayUntil: null, signedInAt: "08:57", shift: null },
    },
  ],
  today: { in: 1, away: 1, signedOut: 0, expected: 0, notIn: 0 },
  waiting: { leave: 2, timesheets: 3, swaps: 0, reviews: 1 },
};

const REQUEST: LeaveRequest = {
  id: "lr-1",
  employeeId: "emp-ada",
  isMine: false,
  leaveTypeId: "lt-1",
  leaveTypeName: "Annual leave",
  startsOn: "2026-10-05",
  endsOn: "2026-10-09",
  startPortion: "full",
  endPortion: "full",
  days: 5,
  status: "pending",
  statusLabel: "Pending",
  isOpen: true,
  isGranted: false,
  holdsDays: true,
  reason: "Family visit",
  contactWhileAway: null,
  employee: { id: "emp-ada", name: "Ada Obi", jobTitle: "Backend Engineer", department: "Engineering" },
  cover: null,
  leaveType: null,
  decisionNote: null,
  requestedAt: "2026-09-20T09:00:00+00:00",
} as LeaveRequest;

const REVIEW = {
  id: "rv-1",
  cycleId: "cy-1",
  employeeId: "emp-ada",
  status: "awaiting_manager",
  statusLabel: "Waiting on the manager",
  isOpen: true,
  waitingOn: "manager",
  selfRating: 4,
  managerRating: null,
  gap: null,
  kpiAttainment: null,
  milestoneAttainment: null,
  selfAssessment: "A good quarter.",
  managerComments: null,
  strengths: null,
  development: null,
  objectives: null,
  selfSubmittedAt: "2026-09-20T09:00:00+00:00",
  managerSubmittedAt: null,
  metOn: null,
  completedAt: null,
  employee: { id: "emp-ada", name: "Ada Obi", jobTitle: "Backend Engineer", department: "Engineering" },
  cycle: { id: "cy-1", name: "Q3 review", periodStart: "2026-07-01", periodEnd: "2026-09-30", dueOn: "2026-10-10" },
  reviewer: null,
  createdAt: null,
} as PerformanceReview;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  team.overview.mockResolvedValue(OVERVIEW);
});

describe("Team overview", () => {
  it("shows each report's day and what is waiting on the manager", async () => {
    render(<TeamOverviewBoard />);

    expect((await screen.findAllByText("Ada Obi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ike Bello").length).toBeGreaterThan(0);
    // A word with every state, never colour alone.
    expect(screen.getByText("Away")).toBeTruthy();
    expect(screen.getByText("Signed in at 08:57")).toBeTruthy();
    expect(screen.getByText("Leave to decide").closest("a")?.getAttribute("href")).toBe("/suite/hrm/team/leave");
  });

  it("says how a team comes about when there is nobody on it", async () => {
    team.overview.mockResolvedValue({ ...OVERVIEW, people: [], waiting: { leave: 0, timesheets: 0, swaps: 0, reviews: 0 } });

    render(<TeamOverviewBoard />);

    expect(await screen.findByText("Nobody reports to you yet")).toBeTruthy();
  });
});

describe("Team leave", () => {
  it("decides through the team endpoints, never HR's", async () => {
    team.leave.mockResolvedValue({ data: [REQUEST], meta: { total: 1 } });
    team.getLeave.mockResolvedValue({ data: REQUEST, meta: { coverage: { away: 0, team: 1, names: [] }, balance: null } });
    team.approveLeave.mockResolvedValue(REQUEST);

    render(<TeamLeaveBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Decide" }));
    await waitFor(() => expect(team.getLeave).toHaveBeenCalledWith("lr-1"));
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(team.approveLeave).toHaveBeenCalledWith("lr-1", undefined));
    expect(hrLeave.approve).not.toHaveBeenCalled();
    expect(hrLeave.get).not.toHaveBeenCalled();
    // Pending by default.
    expect(team.leave).toHaveBeenCalledWith("pending");
  });

  it("offers no recall on My team: taking back granted leave stays with HR", async () => {
    const granted = { ...REQUEST, status: "approved", statusLabel: "Approved", isOpen: false, isGranted: true } as LeaveRequest;
    team.leave.mockResolvedValue({ data: [granted], meta: { total: 1 } });
    team.getLeave.mockResolvedValue({ data: granted, meta: { coverage: { away: 0, team: 1, names: [] }, balance: null } });

    render(<TeamLeaveBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "View" }));

    expect((await screen.findAllByRole("button", { name: "Close" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recall" })).toBeNull();
  });
});

describe("Team reviews", () => {
  it("writes the manager half through the team endpoint", async () => {
    team.reviews.mockResolvedValue({
      data: [REVIEW],
      meta: { total: 1, awaitingSelf: 0, awaitingManager: 1, awaitingMeeting: 0 },
    });
    team.submitManagerReview.mockResolvedValue(REVIEW);

    render(<TeamReviewsBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Write my half" }));
    await userEvent.click(await screen.findByRole("button", { name: "Save my half" }));

    await waitFor(() => expect(team.submitManagerReview).toHaveBeenCalledWith("rv-1", expect.any(Object)));
    expect(hrReviews.submitManager).not.toHaveBeenCalled();
  });
});
