import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PerformanceBoard from "./PerformanceBoard";
import type {
  CohortPerformance,
  EmployeePerformance,
  KpiDetail,
} from "@/lib/api/hrm-client";

/**
 * Targets, and taking a wrong reading back out.
 *
 * `DELETE /hrm/measurements/{id}` had no caller and could not have had one:
 * the series a chart is drawn from carried no measurement id, so nothing in
 * the product could name a reading. Recording was built and un-recording was
 * not, which leaves a manager who typed 1,000 instead of 100 with a target
 * permanently at 1000% and a conversation to have about it.
 *
 * The figure this moves is the one a review gets argued over, so the control
 * confirms in place and says what it changes — and the removal is audited,
 * which is stated on screen rather than left as a surprise.
 */

const { cohort, forEmployee, removeMeasurement } = vi.hoisted(() => ({
  cohort: vi.fn(),
  forEmployee: vi.fn(),
  removeMeasurement: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/performance",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      performance: {
        cohort,
        forEmployee,
        removeMeasurement,
        kpis: vi.fn(),
        createKpi: vi.fn(),
        updateKpi: vi.fn(),
        setKpiStatus: vi.fn(),
        record: vi.fn(),
        milestones: vi.fn(),
        createMilestone: vi.fn(),
        setMilestoneStatus: vi.fn(),
      },
    },
  };
});

/* TargetsDue fetches on its own and is not what this file is about. */
vi.mock("./TargetsDue", () => ({ default: () => null }));

const COHORT: CohortPerformance = {
  people: [
    {
      employeeId: "emp-1",
      name: "Ada Lovelace",
      jobTitle: "Staff nurse",
      department: "Ward 4",
      attainment: 64,
      measured: 1,
      total: 1,
    },
  ],
  distribution: [],
  summary: { measured: 1, total: 1, mean: 64, median: 64 },
};

function kpi(overrides: Partial<KpiDetail> = {}): KpiDetail {
  return {
    id: "kpi-1",
    employeeId: "emp-1",
    title: "Medication errors",
    description: null,
    metricType: "count",
    metricTypeLabel: "Count",
    direction: "lower_is_better",
    directionLabel: "Lower is better",
    unit: null,
    weight: 1,
    target: 2,
    baseline: null,
    current: 1000,
    attainment: 0,
    status: "active",
    statusLabel: "Active",
    countsTowardsScore: true,
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    daysRemaining: 100,
    isCurrent: true,
    createdAt: null,
    measurements: 2,
    trend: null,
    series: [
      {
        id: "m-1",
        date: "2026-09-01",
        label: "1 Sep",
        value: 1,
        target: 2,
        attainment: 100,
        note: null,
      },
      {
        id: "m-2",
        date: "2026-09-08",
        label: "8 Sep",
        value: 1000,
        target: 2,
        attainment: 0,
        note: "Typo — meant 1",
      },
    ],
    ...overrides,
  } as KpiDetail;
}

function detail(kpis: KpiDetail[] = [kpi()]): EmployeePerformance {
  return {
    employee: {
      id: "emp-1",
      name: "Ada Lovelace",
      jobTitle: "Staff nurse",
      department: "Ward 4",
    },
    summary: {
      kpiAttainment: 0,
      kpisMeasured: 1,
      kpisTotal: 1,
      milestoneAttainment: null,
      milestonesAchieved: 0,
      milestonesCounted: 0,
    },
    kpis,
    milestones: {
      planned: 0,
      inProgress: 0,
      achieved: 0,
      missed: 0,
      cancelled: 0,
      overdue: 0,
      deliveredLate: 0,
      items: [],
    },
    reviews: [],
  } as EmployeePerformance;
}

async function openPerson() {
  render(<PerformanceBoard />);

  // The avatar names the person for screen readers too, so take the first.
  await userEvent.click((await screen.findAllByText("Ada Lovelace"))[0]);
  await screen.findByText("Medication errors");
}

beforeEach(() => {
  vi.clearAllMocks();
  cohort.mockResolvedValue(COHORT);
  forEmployee.mockResolvedValue(detail());
  removeMeasurement.mockResolvedValue(kpi({ series: [], measurements: 0 }));
});

describe("the readings behind the line", () => {
  /*
    Folded away. The chart is what somebody came for; the list is what they
    open when a point on it is wrong.
  */
  it("is closed until asked for", async () => {
    await openPerson();

    expect(screen.getByRole("button", { name: /Show 2 readings/ })).toBeInTheDocument();
    /* The chart's own axis carries the date, so the list is identified by
       the control that only exists inside it. */
    expect(
      screen.queryByRole("button", { name: "Remove the reading from 8 Sep" }),
    ).not.toBeInTheDocument();
  });

  it("lists each reading, newest first, with its note", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));

    /* By the per-row control, because the cohort list and the chart's axis
       both also carry list items and dates. */
    const remove = screen
      .getAllByRole("button", { name: /Remove the reading from/ })
      .map((b) => b.getAttribute("aria-label"));

    expect(remove).toEqual([
      "Remove the reading from 8 Sep",
      "Remove the reading from 1 Sep",
    ]);
    expect(screen.getByText("Typo — meant 1")).toBeInTheDocument();
  });

  it("shows nothing at all on a target nobody has measured", async () => {
    forEmployee.mockResolvedValue(detail([kpi({ series: [], measurements: 0 })]));

    await openPerson();

    expect(
      screen.queryByRole("button", { name: /Show \d+ reading/ }),
    ).not.toBeInTheDocument();
  });
});

describe("removing a wrong reading", () => {
  it("confirms first and says what it moves", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the reading from 8 Sep" }),
    );

    expect(await screen.findByText(/The attainment figure moves/)).toBeInTheDocument();
    expect(removeMeasurement).not.toHaveBeenCalled();
  });

  it("does nothing if the answer is no", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the reading from 8 Sep" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(removeMeasurement).not.toHaveBeenCalled();
  });

  it("removes the reading it was asked about, by id", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the reading from 8 Sep" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Remove reading" }));

    await waitFor(() => expect(removeMeasurement).toHaveBeenCalledWith("m-2"));
  });

  it("reloads the person so the chart and the score both move", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the reading from 8 Sep" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Remove reading" }));

    await waitFor(() => expect(forEmployee.mock.calls.length).toBeGreaterThan(1));
  });

  /* Said once, not in every confirmation, and not left as a surprise. */
  it("says the removal is recorded", async () => {
    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));

    expect(
      screen.getByText("Removing a reading is recorded in the audit log."),
    ).toBeInTheDocument();
  });

  it("reports a refusal rather than appearing to have worked", async () => {
    removeMeasurement.mockRejectedValue(new Error("That target is closed."));

    await openPerson();

    await userEvent.click(screen.getByRole("button", { name: /Show 2 readings/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Remove the reading from 8 Sep" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Remove reading" }));

    expect(await screen.findByText("That target is closed.")).toBeInTheDocument();
  });
});
