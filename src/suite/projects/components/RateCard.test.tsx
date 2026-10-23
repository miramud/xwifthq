import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RateCard from "./RateCard";
import { ApiError, type ProjectRate } from "@/lib/api/projects-client";

/**
 * The organisation's rate card.
 *
 * **It says what an unpriced job title actually costs.** The resolver takes
 * the most specific row that matches, so an "Everybody else" row prices every
 * job title without one of its own; "cost nothing" is only true without it.
 *
 * **A refusal is a refusal.** The page is in everybody's nav, and somebody the
 * API refuses must not be shown an empty card with live buttons on it.
 */

const { card, fxList } = vi.hoisted(() => ({ card: vi.fn(), fxList: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, rates: { ...actual.rates, card }, fx: { ...actual.fx, list: fxList } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/projects/rates",
  useSearchParams: () => new URLSearchParams(),
}));

function row(overrides: Partial<ProjectRate>): ProjectRate {
  return {
    id: "r-1",
    projectId: null,
    disciplineId: null,
    discipline: null,
    userId: null,
    user: null,
    rateMinor: 2000,
    currency: "USD",
    source: "organisation",
    sourceLabel: "Organisation",
    specificity: 1,
    note: null,
    createdAt: null,
    ...overrides,
  } as ProjectRate;
}

const TITLES = [
  { id: "jt-be", key: "backend", label: "Backend engineer" },
  { id: "jt-qa", key: "qa", label: "QA engineer" },
];

function cardOf(rows: ProjectRate[]) {
  card.mockResolvedValue({
    data: rows,
    meta: { disciplines: TITLES, jobTitles: TITLES, defaultMinor: 2000, defaultCurrency: "USD" },
  });
}

beforeEach(() => {
  card.mockReset();
  fxList.mockReset();
  fxList.mockResolvedValue({ data: [] });
});

describe("the rate card", () => {
  it("says an unpriced job title is priced at the fallback rate when there is one", async () => {
    cardOf([
      row({ id: "r-be", disciplineId: "jt-be", discipline: "Backend engineer", rateMinor: 4500 }),
      row({ id: "r-all", rateMinor: 2500 }),
    ]);

    render(<RateCard />);

    expect(await screen.findByText(/priced at the fallback rate/)).toHaveTextContent(
      "No rate of its own for QA engineer. Hours logged against it are priced at the fallback rate ($25",
    );
    expect(screen.getByText("1 on the fallback rate")).toBeInTheDocument();
    expect(screen.queryByText(/cost nothing/)).not.toBeInTheDocument();
  });

  it("says unpriced hours cost nothing only when there is no fallback row", async () => {
    cardOf([row({ id: "r-be", disciplineId: "jt-be", discipline: "Backend engineer", rateMinor: 4500 })]);

    render(<RateCard />);

    expect(await screen.findByText(/cost nothing until/)).toHaveTextContent("No rate for QA engineer.");
    expect(screen.getByText("1 cost nothing yet")).toBeInTheDocument();
  });

  it("calls the $20 what it is: the starting value of a new rate", async () => {
    cardOf([row({ id: "r-all" })]);

    render(<RateCard />);

    expect(await screen.findByText(/New rates start at \$20/)).toBeInTheDocument();
    expect(screen.queryByText(/^Default /)).not.toBeInTheDocument();
  });

  it("shows a refusal, with nothing to press, to somebody who may not read it", async () => {
    card.mockRejectedValue(new ApiError("This action is unauthorized.", 403));

    render(<RateCard />);

    expect(await screen.findByText("Rates are kept by delivery leads")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a rate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set an exchange rate/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Rate card")).not.toBeInTheDocument();
  });

  it("offers a retry, not an empty card, when it fails to load for another reason", async () => {
    card.mockRejectedValue(new ApiError("Server error", 500));

    render(<RateCard />);

    expect(await screen.findByText("The rate card did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add a rate/ })).not.toBeInTheDocument();
  });
});
