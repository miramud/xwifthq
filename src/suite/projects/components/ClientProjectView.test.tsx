import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientProjectView, { type SharedProject } from "./ClientProjectView";

/**
 * The page a client sees.
 *
 * Written for somebody who has never used this product and never will, so the
 * tests are mostly about **not overclaiming**: a derived date is labelled
 * *expected* and a set one is labelled *due*, the page says outright that the
 * dates can change, and nothing from the board's vocabulary appears anywhere.
 */

/**
 * The component formats in the reader's own locale, deliberately, so a test
 * pinning "30 Mar 2027" would pass in London and fail in Chicago.
 */
function shown(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shared(over: Partial<SharedProject> = {}): SharedProject {
  return {
    token: "f".repeat(64),
    project: {
      name: "Acme Rebuild",
      summary: "Replacing the order system.",
      status: "active",
      statusLabel: "Active",
      startsOn: "2027-01-04",
      targetEndsOn: "2027-03-31",
      company: "Acme Ltd",
    },
    progress: { total: 10, complete: 4 },
    milestones: [],
    timeline: [],
    documents: [],
    sharedBy: { organisation: "Rexwift" },
    asAt: "2027-01-20",
    basis: "These dates are worked out from the current plan and can change.",
    ...over,
  };
}

describe("ClientProjectView", () => {
  it("leads with the project, the client and where it stands", () => {
    render(<ClientProjectView data={shared()} />);

    expect(screen.getByRole("heading", { name: "Acme Rebuild" })).toBeInTheDocument();
    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Replacing the order system.")).toBeInTheDocument();
  });

  /** In the header, not a footnote nobody reads. */
  it("says the dates can change", () => {
    render(<ClientProjectView data={shared()} />);

    expect(
      screen.getByText("These dates are worked out from the current plan and can change."),
    ).toBeInTheDocument();
  });

  it("counts milestones when there are any", () => {
    render(
      <ClientProjectView
        data={shared({
          milestones: [
            { title: "Discovery", isComplete: true, dueOn: null, expectedOn: null },
            { title: "Go live", isComplete: false, dueOn: "2027-03-30", expectedOn: null },
          ],
        })}
      />,
    );

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText(/milestones complete/)).toBeInTheDocument();
  });

  /** Without milestones there is still a useful number. */
  it("falls back to counting items when nothing is a milestone", () => {
    render(<ClientProjectView data={shared()} />);

    expect(screen.getByText("4 of 10")).toBeInTheDocument();
    expect(screen.getByText(/items complete/)).toBeInTheDocument();
  });

  /**
   * **A commitment and an estimate are worded differently.** Presenting a
   * derived date as a promise is the one mistake worth designing around on a
   * client-facing page.
   */
  it("says due for a set date and expected for a derived one", () => {
    render(
      <ClientProjectView
        data={shared({
          milestones: [
            { title: "Promised", isComplete: false, dueOn: "2027-03-30", expectedOn: "2027-04-02" },
            { title: "Derived", isComplete: false, dueOn: null, expectedOn: "2027-04-10" },
            { title: "Neither", isComplete: false, dueOn: null, expectedOn: null },
          ],
        })}
      />,
    );

    expect(screen.getByText(`Due ${shown("2027-03-30")}`)).toBeInTheDocument();
    expect(
      screen.getByText(`Expected around ${shown("2027-04-10")}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Not yet scheduled")).toBeInTheDocument();
  });

  it("shows sprint names and dates without any numbers behind them", () => {
    const { container } = render(
      <ClientProjectView
        data={shared({
          timeline: [
            {
              name: "Sprint 1",
              startsOn: "2027-01-04",
              endsOn: "2027-01-15",
              isComplete: true,
              isCurrent: false,
            },
            {
              name: "Sprint 2",
              startsOn: "2027-01-18",
              endsOn: "2027-01-29",
              isComplete: false,
              isCurrent: true,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2")).toBeInTheDocument();

    const body = container.textContent ?? "";

    expect(body).not.toContain("velocity");
    expect(body).not.toContain("committed");
  });

  it("links a shared document through the token", () => {
    render(
      <ClientProjectView
        data={shared({
          documents: [
            {
              id: "d-1",
              title: "January status report",
              description: null,
              kind: "report",
              kindLabel: "Status report",
              addedOn: "2027-01-20",
            },
          ],
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /January status report/ });

    expect(link).toHaveAttribute(
      "href",
      `/api/shared/${"f".repeat(64)}/documents/d-1`,
    );
  });

  it("leaves out sections it has nothing for", () => {
    render(<ClientProjectView data={shared()} />);

    expect(screen.queryByText("Milestones")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
  });

  it("says who shared it and that the link can be withdrawn", () => {
    render(<ClientProjectView data={shared()} />);

    expect(screen.getByText("Shared with you by Rexwift.")).toBeInTheDocument();
    expect(screen.getByText(/expires, and whoever sent it can withdraw it/)).toBeInTheDocument();
  });

  /** Nothing from the board's vocabulary reaches this page. */
  it("carries none of the internal vocabulary", () => {
    const { container } = render(
      <ClientProjectView
        data={shared({
          milestones: [
            { title: "Go live", isComplete: false, dueOn: "2027-03-30", expectedOn: null },
          ],
        })}
      />,
    );

    const body = (container.textContent ?? "").toLowerCase();

    for (const word of ["slack", "critical", "sprint backlog", "blocked", "estimate", "cost"]) {
      expect(body).not.toContain(word);
    }
  });
});
