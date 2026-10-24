import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectRates from "./ProjectRates";
import { chooseOption } from "@/test/selectOption";
import { primeJobTitlesCache } from "@/lib/api/job-titles-client";
import type { EffectiveRate, Project, ProjectRate } from "@/lib/api/projects-client";

/**
 * A project's rate overrides.
 *
 * **This screen exists because the chain was unreachable at the project level.**
 * The API had always accepted a project override and a person's own rate, and
 * the resolver had always preferred them, nothing could set one. An agency
 * whose client pays above the card had no way to say so, and every figure on
 * that engagement was wrong by the difference.
 *
 * Three rules worth defending:
 *
 * **What resolves is shown, not just what is overridden.** Most disciplines
 * will have no override, and a list of overrides alone reads as though nothing
 * were set.
 *
 * **A discipline or a person, never both.** A person's own rate already beats
 * their discipline's, so naming both is two rules pretending to be one, the
 * API refuses it and the form makes it structurally impossible.
 *
 * **A rate in another currency is flagged before it bites**, rather than
 * surfacing as a 422 the first time somebody logs an hour.
 */

const { forProject, setForProject, remove } = vi.hoisted(() => ({
  forProject: vi.fn(),
  setForProject: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, rates: { ...actual.rates, forProject, setForProject, remove } };
});

/* The tables are DataViews, which reach for the app router. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/acme-rebuild",
  useSearchParams: () => new URLSearchParams(),
}));

const PROJECT = {
  slug: "acme-rebuild",
  name: "Acme Rebuild",
  currency: "USD",
  can: {
    update: true,
    manageMembers: true,
    manageBoard: true,
    delete: false,
    viewCost: true,
    manageRates: true,
    logTimeForOthers: true,
  },
} as unknown as Project;

const EFFECTIVE: EffectiveRate[] = [
  {
    disciplineId: "d-be",
    label: "Backend",
    rateMinor: 3500,
    currency: "USD",
    source: "project_discipline",
    sourceLabel: "This project's rate for that discipline",
  },
  {
    disciplineId: "d-fe",
    label: "Frontend",
    rateMinor: 2000,
    currency: "USD",
    source: "organisation_discipline",
    sourceLabel: "The rate card",
  },
  {
    disciplineId: "d-qa",
    label: "QA",
    rateMinor: null,
    currency: "USD",
    source: "none",
    sourceLabel: "No rate set",
  },
];

const OVERRIDE: ProjectRate = {
  id: "r-1",
  projectId: "p-1",
  disciplineId: "d-be",
  discipline: "Backend",
  userId: null,
  user: null,
  rateMinor: 3500,
  currency: "USD",
  source: "project_discipline",
  sourceLabel: "This project's rate for that discipline",
  specificity: 5,
  note: "Agreed in the statement of work",
  createdAt: null,
};

function payload(over: Record<string, unknown> = {}) {
  return {
    data: [OVERRIDE],
    meta: {
      card: [],
      effective: EFFECTIVE,
      canManage: true,
      projectCurrency: "USD",
      members: [
        { userId: "u-1", name: "Shadrach", disciplineId: "d-be" },
        { userId: "u-2", name: "Isaac", disciplineId: "d-fe" },
      ],
      ...over,
    },
  };
}

/* The organisation's job titles, what the rates are set per since 27 Sep 2026. */
const JOB_TITLES = [
  { id: "d-be", key: "backend", name: "Backend", position: 1, isActive: true, peopleCount: 1 },
  { id: "d-fe", key: "frontend", name: "Frontend", position: 2, isActive: true, peopleCount: 1 },
  { id: "d-qa", key: "qa", name: "QA", position: 3, isActive: true, peopleCount: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  primeJobTitlesCache(JOB_TITLES);
  forProject.mockResolvedValue(payload());
  setForProject.mockResolvedValue({});
  remove.mockResolvedValue({});
});

describe("ProjectRates", () => {
  it("shows what each job title resolves to and which rule set it", async () => {
    render(<ProjectRates project={PROJECT} />);

    expect(await screen.findByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("$35.00/h")).toBeInTheDocument();
    /* The server's label still says "discipline"; the screen says job title. */
    expect(screen.getByText("This project's rate for that job title")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Job title/i })).toBeInTheDocument();
    expect(screen.queryByText(/discipline/i)).toBeNull();

    /* A discipline with no override still shows, falling through to the card. */
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("$20.00/h")).toBeInTheDocument();
    expect(screen.getByText("The rate card")).toBeInTheDocument();
  });

  /** A visible gap gets filled; a plausible zero does not. */
  it("shows an unpriced discipline as unset rather than free", async () => {
    render(<ProjectRates project={PROJECT} />);

    expect(await screen.findByText("No rate set")).toBeInTheDocument();
    expect(screen.queryByText("$0.00/h")).toBeNull();
  });

  it("sets an override for a job title", async () => {
    render(<ProjectRates project={PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Override a rate/i }));

    expect(screen.getByRole("combobox", { name: /Override for/i })).toHaveTextContent("A job title");
    await chooseOption(userEvent.setup(), screen.getByLabelText(/^Job title$/i), "Frontend");

    const amount = screen.getByLabelText(/Per hour/i);
    await userEvent.clear(amount);
    await userEvent.type(amount, "42.50");

    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(setForProject).toHaveBeenCalledTimes(1));

    expect(setForProject).toHaveBeenCalledWith("acme-rebuild", {
      /* Minor units, so nothing carries a float amount of money. */
      rateMinor: 4250,
      currency: "USD",
      disciplineId: "d-fe",
      userId: null,
      note: undefined,
    });
  });

  /**
   * A person's own rate, a contractor's number, beats their discipline's, so
   * the form sends one or the other and never both.
   */
  it("sets a person's own rate, and never both at once", async () => {
    render(<ProjectRates project={PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Override a rate/i }));
    await chooseOption(userEvent.setup(), screen.getByLabelText(/Override for/i), "One person");

    /* The job title control is gone, so both cannot be sent. */
    expect(screen.queryByLabelText(/^Job title$/i)).toBeNull();

    await chooseOption(userEvent.setup(), screen.getByLabelText(/^Person$/i), "Isaac");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(setForProject).toHaveBeenCalledTimes(1));

    expect(setForProject.mock.calls[0][1]).toMatchObject({
      userId: "u-2",
      disciplineId: null,
    });
  });

  /**
   * Said before it bites. A card in another currency is converted when an hour
   * is logged, and refused there if no exchange rate exists.
   */
  it("warns when an override is in a different currency from the project", async () => {
    render(<ProjectRates project={PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Override a rate/i }));

    expect(screen.queryByText(/An exchange rate has to exist/i)).toBeNull();

    await chooseOption(userEvent.setup(), screen.getByLabelText(/Currency/i), "₦ Naira");

    expect(
      screen.getByText(/This project is in USD. An exchange rate has to exist/i),
    ).toBeInTheDocument();
  });

  /** Deleting an override restores the card rather than unpricing the work. */
  it("removes an override, which falls back to the card", async () => {
    render(<ProjectRates project={PROJECT} />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Remove this project's Backend override/i }),
    );
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Remove rate" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("r-1"));
  });

  /** No override on a discipline means no delete button against it. */
  it("offers no removal where there is no override", async () => {
    render(<ProjectRates project={PROJECT} />);

    await screen.findByText("Frontend");

    expect(
      screen.queryByRole("button", { name: /Remove this project's Frontend override/i }),
    ).toBeNull();
  });

  it("lists people who have their own rate here, apart from the disciplines", async () => {
    forProject.mockResolvedValue({
      data: [
        {
          ...OVERRIDE,
          id: "r-2",
          disciplineId: null,
          discipline: null,
          userId: "u-1",
          user: "Shadrach",
          rateMinor: 5000,
          source: "project_person",
          sourceLabel: "Their rate on this project",
          specificity: 6,
        },
      ],
      meta: payload().meta,
    });

    render(<ProjectRates project={PROJECT} />);

    expect(await screen.findByText(/People with their own rate here/i)).toBeInTheDocument();
    expect(screen.getByText("Shadrach")).toBeInTheDocument();
    expect(screen.getByText("$50.00/h")).toBeInTheDocument();
  });

  it("offers no controls to somebody who may not manage rates", async () => {
    forProject.mockResolvedValue(payload({ canManage: false }));

    render(<ProjectRates project={PROJECT} />);

    await screen.findByText("Backend");

    expect(screen.queryByRole("button", { name: /Override a rate/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Remove this project's Backend override/i }),
    ).toBeNull();
  });

  it("shows the API's refusal", async () => {
    const { ApiError } = await import("@/lib/api/projects-client");

    setForProject.mockRejectedValue(
      new ApiError("Set a rate for the person or for the discipline, not both.", 422),
    );

    render(<ProjectRates project={PROJECT} />);

    await userEvent.click(await screen.findByRole("button", { name: /Override a rate/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(await screen.findByText(/not both/i)).toBeInTheDocument();
  });
});
