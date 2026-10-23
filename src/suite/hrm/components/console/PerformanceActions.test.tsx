import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  KpiDialog,
  KpiStatusDialog,
  MilestoneDialog,
  MilestoneStatusDialog,
  RecordReadingDialog,
} from "./PerformanceActions";
import type { Kpi } from "@/lib/api/hrm-client";
import { chooseOption, comboboxValue, openCombobox } from "@/test/selectOption";

/**
 * Setting targets, rather than only reading them.
 *
 * The board rendered attainment percentages against nine write endpoints
 * nothing called, so the only KPIs that could exist were the seeder's and
 * every figure on it was decoration.
 *
 * Three judgements are worth pinning, and each is a way of getting somebody's
 * appraisal wrong:
 *
 * - **direction is asked, never assumed**, because about a third of real
 *   targets are "lower is better" and assuming otherwise scores them backwards
 * - **closed and cancelled are different**, because one counts towards a score
 *   and the other is excluded
 * - **a reading is dated when it was measured**, not when it was typed in
 */

const {
  createKpi,
  updateKpi,
  setKpiStatus,
  record,
  createMilestone,
  setMilestoneStatus,
} = vi.hoisted(() => ({
  createKpi: vi.fn(),
  updateKpi: vi.fn(),
  setKpiStatus: vi.fn(),
  record: vi.fn(),
  createMilestone: vi.fn(),
  setMilestoneStatus: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      performance: {
        createKpi,
        updateKpi,
        setKpiStatus,
        record,
        createMilestone,
        setMilestoneStatus,
      },
    },
  };
});

const KPI: Kpi = {
  id: "k-1",
  employeeId: "e-1",
  title: "Sickness absence",
  description: null,
  metricType: "percentage",
  metricTypeLabel: "Percentage",
  direction: "lower",
  directionLabel: "Lower is better",
  unit: "%",
  weight: 2,
  target: 3,
  baseline: 7,
  current: 5,
  attainment: 60,
  status: "active",
  statusLabel: "Active",
  countsTowardsScore: true,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  daysRemaining: 102,
  isCurrent: true,
  createdAt: null,
};

beforeEach(() => vi.clearAllMocks());

describe("setting a target", () => {
  /*
    The one that silently ruins an appraisal. Absence, complaints and waiting
    times are all targets where lower is the achievement, and a form that
    assumes higher scores them backwards without anybody noticing.
  */
  it("asks which direction is good, and says why it matters", async () => {
    render(
      <KpiDialog employeeId="e-1" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.getByLabelText("Good means")).toBeInTheDocument();
    expect(
      screen.getByText(/lower is the achievement/),
    ).toBeInTheDocument();
  });

  it("sends the direction that was chosen", async () => {
    createKpi.mockResolvedValue(KPI);

    render(
      <KpiDialog employeeId="e-1" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await userEvent.type(
      screen.getByLabelText("What is being measured"),
      "Sickness absence",
    );
    await chooseOption(userEvent.setup(), screen.getByLabelText("Good means"), "Lower is better");
    await userEvent.type(screen.getByLabelText("Target"), "3");
    await userEvent.type(screen.getByLabelText("From"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Until"), "2026-12-31");
    await userEvent.click(screen.getByRole("button", { name: "Set it" }));

    await waitFor(() =>
      expect(createKpi).toHaveBeenCalledWith(
        "e-1",
        expect.objectContaining({
          title: "Sickness absence",
          direction: "lower",
          targetValue: 3,
        }),
      ),
    );
  });

  /* A target without a period is an aspiration. */
  it("will not save without a target and a period", async () => {
    render(
      <KpiDialog employeeId="e-1" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await userEvent.type(
      screen.getByLabelText("What is being measured"),
      "Something",
    );

    expect(screen.getByRole("button", { name: "Set it" })).toBeDisabled();
  });

  it("edits an existing target rather than creating a second one", async () => {
    updateKpi.mockResolvedValue(KPI);

    render(
      <KpiDialog
        employeeId="e-1"
        existing={KPI}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("What is being measured")).toHaveValue(
      "Sickness absence",
    );
    expect(comboboxValue(screen.getByLabelText("Good means"))).toBe("lower");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateKpi).toHaveBeenCalled());
    expect(createKpi).not.toHaveBeenCalled();
  });
});

describe("recording a reading", () => {
  it("says what the target is and which way is good", async () => {
    render(
      <RecordReadingDialog kpi={KPI} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(
      screen.getByText("Target is 3. Lower is better."),
    ).toBeInTheDocument();
  });

  /*
    A figure for last month entered this morning is a reading for last month.
    Stamping it with today bends the series in a way nobody spots later.
  */
  it("lets the reading be dated when it was measured", async () => {
    record.mockResolvedValue({});

    render(
      <RecordReadingDialog kpi={KPI} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText("Reading (%)"), "4");
    await userEvent.type(screen.getByLabelText("Measured on"), "2026-08-31");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(record).toHaveBeenCalledWith("k-1", {
        value: 4,
        measuredOn: "2026-08-31",
        note: undefined,
      }),
    );
  });

  it("leaves the date off entirely when none was given", async () => {
    record.mockResolvedValue({});

    render(
      <RecordReadingDialog kpi={KPI} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText("Reading (%)"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(record).toHaveBeenCalledWith(
        "k-1",
        expect.objectContaining({ measuredOn: undefined }),
      ),
    );
  });
});

describe("closing a target", () => {
  /*
    A target overtaken by a reorganisation should be cancelled, not closed. A
    single "close" button would mark somebody down for a target nobody could
    have met.
  */
  it("spells out that cancelled is excluded from the score and closed is not", async () => {
    render(
      <KpiStatusDialog kpi={KPI} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(
      screen.getByText(/A cancelled one is left out of it entirely/),
    ).toBeInTheDocument();

    const status = await openCombobox(userEvent.setup(), screen.getByLabelText("Status"));
    expect(status).toHaveTextContent("Closed — the result counts");
    expect(status).toHaveTextContent("Cancelled — excluded from their score");
  });

  it("sends the chosen status", async () => {
    setKpiStatus.mockResolvedValue(KPI);

    render(
      <KpiStatusDialog kpi={KPI} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await chooseOption(
      userEvent.setup(),
      screen.getByLabelText("Status"),
      "Cancelled — excluded from their score",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(setKpiStatus).toHaveBeenCalledWith("k-1", "cancelled"),
    );
  });
});

describe("milestones", () => {
  it("can stand on its own or hang off a target", async () => {
    createMilestone.mockResolvedValue({});

    render(
      <MilestoneDialog
        employeeId="e-1"
        kpis={[KPI]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Towards which target")).toHaveTextContent(
      "On its own",
    );

    await userEvent.type(
      screen.getByLabelText("What has to be delivered"),
      "Ward audit",
    );
    await userEvent.type(screen.getByLabelText("Due"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Set it" }));

    await waitFor(() =>
      expect(createMilestone).toHaveBeenCalledWith(
        "e-1",
        expect.objectContaining({ title: "Ward audit", dueOn: "2026-11-30" }),
      ),
    );
  });

  it("offers no target picker when there are none to pick", async () => {
    render(
      <MilestoneDialog
        employeeId="e-1"
        kpis={[]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Towards which target"),
    ).not.toBeInTheDocument();
  });

  /*
    Something delivered last Friday and recorded this morning was delivered
    last Friday. The board reports "delivered, and late" separately from
    "delivered", which only works if the real date is available.
  */
  it("asks when it actually landed once it is marked achieved", async () => {
    setMilestoneStatus.mockResolvedValue({});

    render(
      <MilestoneStatusDialog
        milestone={{
          id: "m-1",
          title: "Ward audit",
          status: "planned",
          achievedOn: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Delivered on")).not.toBeInTheDocument();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Status"), "Achieved");

    expect(screen.getByLabelText("Delivered on")).toBeInTheDocument();
    expect(
      screen.getByText(/recorded as delivered and as late, not as missed/),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Delivered on"), "2026-09-18");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(setMilestoneStatus).toHaveBeenCalledWith(
        "m-1",
        "achieved",
        "2026-09-18",
      ),
    );
  });
});

describe("when the service refuses", () => {
  it("keeps the form open and says what happened", async () => {
    createKpi.mockRejectedValue(new Error("That period has already closed."));

    render(
      <KpiDialog employeeId="e-1" onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    await userEvent.type(
      screen.getByLabelText("What is being measured"),
      "Absence",
    );
    await userEvent.type(screen.getByLabelText("Target"), "3");
    await userEvent.type(screen.getByLabelText("From"), "2026-01-01");
    await userEvent.type(screen.getByLabelText("Until"), "2026-12-31");
    await userEvent.click(screen.getByRole("button", { name: "Set it" }));

    expect(
      await screen.findByText("That period has already closed."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What is being measured")).toHaveValue(
      "Absence",
    );
  });
});
