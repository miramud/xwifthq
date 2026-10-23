import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TestBacklog from "./TestBacklog";
import TestSprintDetail from "./TestSprintDetail";
import { RunStrip } from "./testingUi";
import type { Project, TestRun, TestSprint, TestSprintReport, WorkItem } from "@/lib/api/projects-client";

/**
 * Testing on a project (5 Oct 2026).
 *
 * What the screens must get right: a finding opens the ordinary item panel
 * (that is where it is assigned, dated, weighted and sprinted); results are
 * one press while a test sprint runs and cannot be recorded before it starts;
 * and "not run" is never drawn as if it were nothing.
 */

const { findingsList, sprintGet, runUpdate } = vi.hoisted(() => ({
  findingsList: vi.fn(),
  sprintGet: vi.fn(),
  runUpdate: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();
  return {
    ...actual,
    findings: { list: findingsList, create: vi.fn() },
    testSprints: { ...actual.testSprints, get: sprintGet },
    testRuns: { update: runUpdate, remove: vi.fn(), raiseFinding: vi.fn() },
  };
});

vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-qa" } }) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
  can: { manageTesting: true, manageBoard: false },
} as unknown as Project;

const FINDING = {
  id: "w-1",
  type: "bug",
  title: "Another organisation's leave is readable by id",
  severity: "critical",
  severityLabel: "Critical",
  findingCategory: "security",
  findingCategoryLabel: "Security",
  assignee: null,
  estimateHours: null,
  estimatePoints: null,
  dueOn: null,
  sprint: null,
  testCase: { id: "c-1", reference: "TC-3", title: "Refuse another org" },
  foundIn: null,
  status: { id: "s-1", key: "todo", label: "To do", position: 1, countsAsComplete: false },
} as unknown as WorkItem;

const SUMMARY = {
  open: 1,
  unscheduled: 1,
  resolved: 0,
  openBySeverity: { critical: 1, high: 0, medium: 0, low: 0, info: 0, unclassified: 0 },
};

function sprint(over: Partial<TestSprint> = {}): TestSprint {
  return {
    id: "ts-1",
    projectId: "p-1",
    name: "Test sprint 1",
    goal: null,
    focus: "functional",
    focusLabel: "Functional QA",
    environment: "staging",
    startsOn: "2026-10-05",
    endsOn: "2026-10-11",
    status: "active",
    statusLabel: "Active",
    sequence: 1,
    targetSprintId: null,
    summary: null,
    recommendations: null,
    startedAt: null,
    closedAt: null,
    createdAt: null,
    ...over,
  };
}

const RUN = {
  id: "r-1",
  testSprintId: "ts-1",
  testCaseId: "c-1",
  status: "not_run",
  statusLabel: "Not run",
  actualResult: null,
  notes: null,
  attempts: 0,
  executedAt: null,
  findingId: null,
  finding: null,
  testCase: {
    id: "c-1",
    reference: "TC-1",
    title: "Submit a valid leave request",
    level: "ui",
    category: "functional",
    steps: ["Open Leave", "Submit"],
    expectedResult: "Shown as pending.",
    acceptanceCriterion: null,
    preconditions: null,
    testData: null,
    apiMethod: null,
    apiPath: null,
    expectedStatus: null,
    workItem: null,
  },
} as unknown as TestRun;

const REPORT = {
  runs: { not_run: 1, passed: 0, failed: 0, blocked: 0, skipped: 0, total: 1, executed: 0 },
  passRate: null,
  executionRate: 0,
  byLevel: {},
  byCategory: {},
  coverage: null,
  findings: { total: 0, open: 0, bySeverity: { critical: { open: 0, resolved: 0 }, high: { open: 0, resolved: 0 }, medium: { open: 0, resolved: 0 }, low: { open: 0, resolved: 0 }, info: { open: 0, resolved: 0 } } },
  frozen: false,
} as unknown as TestSprintReport;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TestBacklog", () => {
  it("lists findings by severity and opens one in the item panel", async () => {
    findingsList.mockResolvedValue({ data: [FINDING], meta: { summary: SUMMARY, canManage: true, canSchedule: false } });
    const onOpenItem = vi.fn();

    render(<TestBacklog project={PROJECT} refreshKey={0} onOpenItem={onOpenItem} />);

    const title = await screen.findAllByText("Another organisation's leave is readable by id");
    expect(findingsList).toHaveBeenCalledWith("acme-rebuild", { state: "unscheduled", severity: undefined });
    expect(screen.getAllByText("Not scheduled").length).toBeGreaterThan(0);

    await userEvent.click(title[0]);
    expect(onOpenItem).toHaveBeenCalledWith(FINDING);
  });
});

describe("TestSprintDetail", () => {
  it("records an outcome with one press while the sprint runs", async () => {
    sprintGet.mockResolvedValue({ data: sprint(), meta: { runs: [RUN], report: REPORT } });
    runUpdate.mockResolvedValue({ ...RUN, status: "passed", statusLabel: "Passed" });

    render(
      <TestSprintDetail
        project={PROJECT}
        sprints={[]}
        setup={null}
        testSprintId="ts-1"
        onBack={vi.fn()}
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Submit a valid leave request/ }));
    const outcome = screen.getByRole("group", { name: "Outcome" });
    await userEvent.click(within(outcome).getByRole("button", { name: /Passed/ }));

    await waitFor(() => expect(runUpdate).toHaveBeenCalledWith("r-1", { status: "passed" }));
  });

  it("offers no outcome before the sprint starts", async () => {
    sprintGet.mockResolvedValue({ data: sprint({ status: "planning", statusLabel: "Planning" }), meta: { runs: [RUN], report: REPORT } });

    render(
      <TestSprintDetail
        project={PROJECT}
        sprints={[]}
        setup={null}
        testSprintId="ts-1"
        onBack={vi.fn()}
        onOpenItem={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: /Submit a valid leave request/ }));
    expect(screen.queryByRole("group", { name: "Outcome" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start test sprint" })).toBeEnabled();
  });
});

describe("RunStrip", () => {
  it("says every count in words, not only in colour", () => {
    render(<RunStrip counts={{ passed: 3, failed: 1, not_run: 2 }} total={6} />);
    expect(screen.getByRole("img", { name: /6 cases: 3 passed, 1 failed, 0 blocked, 0 skipped, 2 not run/ })).toBeInTheDocument();
  });
});
