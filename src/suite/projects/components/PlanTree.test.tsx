import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlanTree, { acceptanceLines, keptCounts, shortRange, sumHours } from "./PlanTree";
import { chooseOption } from "@/test/selectOption";
import type { BacklogPlan, PlanEpic } from "@/lib/api/projects-client";
import { primeJobTitlesCache, resetJobTitlesCache } from "@/lib/api/job-titles-client";
import { humaniseKey } from "./AiParts";

/**
 * The drafted plan as a tree.
 *
 * Defended here: **the scheduler's dates and sprint fit are shown as given**
 * (never recomputed), **a possible blocker never reads as an acceptance
 * criterion**, **an absent estimate is absent, never 0h**, and **unticking a
 * parent skips its subtree** without unticking every child.
 */

const EPICS: PlanEpic[] = [
  {
    keep: true,
    title: "Identity, access and roles",
    description: "Sign-in, sessions and who may do what.",
    assumed: false,
    brokenDown: true,
    stories: [
      {
        keep: true,
        title: "As an admin, I want to assign roles, so that access follows the job",
        description: null,
        expectedOutcome: "- Given an admin\n- When they assign a role\n- Then the permissions apply at once",
        points: 5,
        priority: 1,
        possibleBlockers: "The client's SSO details are not confirmed",
        assumed: true,
        tasks: [
          {
            keep: true,
            title: "Build the roles endpoint",
            discipline: "backend",
            disciplineId: "d-be",
            estimateHours: 6,
            expectedOutcome: "Roles persist and are audited",
            possibleBlockers: null,
          },
          {
            keep: true,
            title: "Test role changes",
            discipline: "qa",
            disciplineId: null,
            estimateHours: null,
            expectedOutcome: null,
            possibleBlockers: "No staging data",
          },
        ],
      },
      {
        keep: true,
        title: "As a user, I want to reset my password",
        description: null,
        expectedOutcome: "The reset link works once.",
        points: null,
        priority: 3,
        possibleBlockers: null,
        tasks: [],
      },
    ],
  },
  {
    keep: true,
    title: "Catalogue",
    description: null,
    brokenDown: false,
    stories: [
      { keep: true, title: "As a user, I want to upload a dataset", expectedOutcome: null, points: 3, priority: 2, tasks: [] },
    ],
  },
];

const PLAN: BacklogPlan = {
  window: { startsOn: "2026-09-25", endsOn: "2026-10-08", sprintId: null, sprintName: "Sprint 1", exists: false },
  paths: {
    "0": { startsOn: "2026-09-25", dueOn: "2026-09-30", hours: 6, inSprint: true },
    "0.0": { startsOn: "2026-09-25", dueOn: "2026-09-28", hours: 6, inSprint: true },
    "0.0.0": { startsOn: "2026-09-25", dueOn: "2026-09-25", hours: 6, inSprint: true },
    "0.0.1": { startsOn: "2026-09-28", dueOn: "2026-09-28", hours: null, inSprint: true },
    "0.1": { startsOn: "2026-10-09", dueOn: "2026-10-09", hours: null, inSprint: false },
  },
  totals: { epics: 2, stories: 3, tasks: 2, hours: 6, points: 8, storiesInSprint: 1, hoursInSprint: 6, capacityHours: 120 },
  capacity: { backend: 1 },
};

function renderTree(over: Partial<Parameters<typeof PlanTree>[0]> = {}) {
  const onChange = vi.fn();
  const onBreakdown = vi.fn();

  render(
    <PlanTree epics={EPICS} plan={PLAN} runs={{}} onChange={onChange} onBreakdown={onBreakdown} {...over} />,
  );

  return { onChange, onBreakdown };
}

const storyItem = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

describe("PlanTree", () => {
  it("opens the first epic and folds the rest", () => {
    renderTree();

    expect(screen.getByRole("button", { name: /Identity, access and roles/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /^Catalogue/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("As a user, I want to upload a dataset")).toBeNull();
  });

  it("shows points, hours, short dates and the sprint fit the scheduler gave", () => {
    renderTree();

    const story = storyItem("As an admin, I want to assign roles, so that access follows the job");

    expect(within(story).getByLabelText(/Story points for "As an admin/)).toHaveAttribute("data-value", "5");
    expect(within(story).getAllByText("6h").length).toBeGreaterThan(0);
    expect(within(story).getByText("25 Sep – 28 Sep")).toBeInTheDocument();
    expect(within(story).getByText("In Sprint 1")).toBeInTheDocument();
    expect(within(story).getByText("High")).toBeInTheDocument();

    const later = storyItem("As a user, I want to reset my password");
    expect(within(later).getByText("Product backlog")).toBeInTheDocument();
    expect(within(later).getByText("9 Oct")).toBeInTheDocument();

    /* The epic's header carries its size and its span. */
    expect(screen.getByRole("button", { name: /Identity, access and roles/ })).toHaveTextContent(
      /2 stories.*2 tasks.*6h.*25 Sep – 30 Sep/,
    );
  });

  it("lists multi-line acceptance criteria and keeps blockers apart from them", () => {
    renderTree();

    const story = storyItem("As an admin, I want to assign roles, so that access follows the job");
    const criteria = within(story).getAllByRole("list")[0];

    expect(within(criteria).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Given an admin",
      "When they assign a role",
      "Then the permissions apply at once",
    ]);
    const blocker = within(story).getByText(/The client's SSO details are not confirmed/);
    expect(blocker.closest("div")?.parentElement?.className).toMatch(/sun/);
    expect(within(criteria).queryByText(/SSO/)).toBeNull();
    expect(within(story).getByText("Assumed")).toBeInTheDocument();
  });

  it("draws tasks as compact rows with job title, hours and dates", () => {
    renderTree();

    expect(screen.getByLabelText('Hours for "Build the roles endpoint"')).toHaveValue(6);
    /* Absent, never zero. */
    expect(screen.getByLabelText('Hours for "Test role changes"')).toHaveValue(null);
    expect(screen.getByText("QA · not on our job titles")).toBeInTheDocument();
    expect(screen.getByText("Roles persist and are audited")).toBeInTheDocument();
    expect(screen.getByText(/No staging data/)).toBeInTheDocument();
  });

  it("sends a keep, a points and an hours change by path", async () => {
    const user = userEvent.setup();
    const { onChange } = renderTree();

    await user.click(screen.getByLabelText('Keep epic "Identity, access and roles"'));
    expect(onChange).toHaveBeenLastCalledWith({ path: "0", keep: false });

    await chooseOption(user, screen.getByLabelText(/Story points for "As an admin/), "8 pts");
    expect(onChange).toHaveBeenLastCalledWith({ path: "0.0", points: 8 });

    const hours = screen.getByLabelText('Hours for "Test role changes"');
    await user.type(hours, "4{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ path: "0.0.1", estimateHours: 4 });

    const built = screen.getByLabelText('Hours for "Build the roles endpoint"');
    await user.clear(built);
    await user.tab();
    /* Cleared means not estimated: null, never 0. */
    expect(onChange).toHaveBeenLastCalledWith({ path: "0.0.0", estimateHours: null });
  });

  it("shows who each task lands with, and sends a reassignment by path", async () => {
    const user = userEvent.setup();
    const { onChange } = renderTree({
      plan: {
        ...PLAN,
        paths: {
          ...PLAN.paths,
          "0.0.0": { ...PLAN.paths["0.0.0"], assigneeId: "u-ada" },
          "0.0.1": { ...PLAN.paths["0.0.1"], assigneeId: null },
        },
        team: [
          { userId: "u-ada", name: "Ada Lovelace", jobTitle: "Backend Engineer" },
          { userId: "u-tess", name: "Tess Tester", jobTitle: "Senior QA" },
        ],
      },
    });

    /* The scheduler's pick reads as a suggestion; a title nobody holds reads as unassigned. */
    const built = screen.getByRole("combobox", { name: 'Assign "Build the roles endpoint"' });
    expect(built).toHaveTextContent("Auto · Ada Lovelace");
    expect(screen.getByRole("combobox", { name: 'Assign "Test role changes"' })).toHaveTextContent("Unassigned");

    await chooseOption(user, built, "Tess Tester");
    expect(onChange).toHaveBeenLastCalledWith({ path: "0.0.0", assigneeId: "u-tess" });
  });

  it("greys a skipped epic's subtree and locks its children", () => {
    renderTree({ epics: [{ ...EPICS[0], keep: false }, EPICS[1]] });

    expect(screen.getByText(/Skipped with its epic/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Keep story "As an admin/)).toBeDisabled();
    expect(screen.getByLabelText('Keep task "Build the roles endpoint"')).toBeDisabled();
    /* Skipped, not unticked: the children keep their own ticks. */
    expect(screen.getByLabelText(/Keep story "As an admin/)).toBeChecked();
  });

  it("offers to break down an epic that has no tasks, and to retry one that failed", async () => {
    const user = userEvent.setup();
    const { onBreakdown } = renderTree();

    expect(screen.getByText("Not broken down yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: 'Break down "Catalogue"' }));
    expect(onBreakdown).toHaveBeenCalledWith(1);
  });

  it("shows a failed epic's error beside its Retry", async () => {
    const user = userEvent.setup();
    const { onBreakdown } = renderTree({ runs: { 1: { state: "failed", error: "Anthropic timed out" } } });

    expect(screen.getByRole("alert")).toHaveTextContent("Anthropic timed out");
    await user.click(screen.getByRole("button", { name: 'Retry "Catalogue"' }));
    expect(onBreakdown).toHaveBeenCalledWith(1);
  });
});

describe("PlanTree helpers", () => {
  it("reads acceptance criteria as lines, bullets and numbering stripped", () => {
    expect(acceptanceLines("1. Given x\n2) When y\n\n• Then z")).toEqual(["Given x", "When y", "Then z"]);
    expect(acceptanceLines(null)).toEqual([]);
  });

  it("sums only estimated hours, and says null when none are", () => {
    expect(sumHours([{ title: "a", estimateHours: 2 }, { title: "b", estimateHours: null }])).toBe(2);
    expect(sumHours([{ title: "a", estimateHours: null }])).toBeNull();
  });

  it("counts only what is kept under kept parents", () => {
    expect(keptCounts(EPICS)).toEqual({ epics: 2, stories: 3, tasks: 2 });
    expect(keptCounts([{ ...EPICS[0], keep: false }, EPICS[1]])).toEqual({ epics: 1, stories: 1, tasks: 0 });
  });

  it("formats a span short, and a single day as one date", () => {
    expect(shortRange("2026-09-25", "2026-10-01")).toBe("25 Sep – 1 Oct");
    expect(shortRange("2026-09-25", "2026-09-25")).toBe("25 Sep");
  });
});

/*
  P11: the model answers with a job title's key ("backend"), and that key was
  shown as it came. The organisation's name for it is shown instead.
*/
describe("a planned task's job title", () => {
  it("is shown by the organisation's name for it, not the model's key", () => {
    primeJobTitlesCache([
      { id: "d-be", key: "backend", name: "Backend engineer", position: 1, isActive: true, peopleCount: 2 },
    ]);

    renderTree();

    const row = screen.getByText("Build the roles endpoint").closest("li") as HTMLElement;
    expect(within(row).getByText("Backend engineer")).toBeInTheDocument();
    expect(within(row).queryByText("backend")).not.toBeInTheDocument();

    resetJobTitlesCache();
  });

  it("reads a key as words when no name is known", () => {
    expect(humaniseKey("backend_engineer")).toBe("Backend engineer");
    expect(humaniseKey("qa")).toBe("QA");
    expect(humaniseKey("head-of-ux")).toBe("Head of UX");
  });
});
