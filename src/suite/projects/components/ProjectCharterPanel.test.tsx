import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectCharterPanel from "./ProjectCharterPanel";
import type { Charter, Project } from "@/lib/api/projects-client";

/**
 * The charter screen.
 *
 * **An approval is of a text.** Editing after sign-off clears it, and this
 * screen has to warn before and report after — a charter that quietly kept its
 * approval through a rewrite is worse than one never signed, because somebody
 * downstream is relying on it.
 *
 * **Half the page is live data.** The stakeholders, team, milestones and
 * schedule are read fresh, never copied in, and the page says so rather than
 * letting a reader assume the whole thing was typed at kick-off.
 */

const { forProject, save, approve, unapprove } = vi.hoisted(() => ({
  forProject: vi.fn(),
  save: vi.fn(),
  approve: vi.fn(),
  unapprove: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, charter: { forProject, save, approve, unapprove } };
});

const PROJECT = { slug: "acme-rebuild", name: "Acme Rebuild" } as unknown as Project;

function charter(over: Partial<Charter> = {}): Charter {
  return {
    narrative: {
      purpose: null,
      background: null,
      scopeIn: null,
      scopeOut: null,
      successCriteria: null,
      assumptions: null,
      constraints: null,
    },
    approval: { isApproved: false, by: null, as: null, at: null },
    project: {
      name: "Acme Rebuild",
      company: "Acme Ltd",
      startsOn: "2027-01-04",
      targetEndsOn: "2027-03-31",
      currency: "NGN",
    },
    stakeholders: [],
    team: [],
    milestones: [],
    schedule: null,
    ...over,
  };
}

function response(data: Charter, meta: { canEdit?: boolean; isStarted?: boolean } = {}) {
  return {
    data,
    meta: { canEdit: true, isStarted: false, ...meta },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProjectCharterPanel", () => {
  it("invites a charter rather than showing blank headings", async () => {
    forProject.mockResolvedValue(response(charter()));

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText("No charter yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Write it/ })).toBeInTheDocument();
  });

  it("shows only the sections that have been written", async () => {
    forProject.mockResolvedValue(
      response(
        charter({
          narrative: {
            ...charter().narrative,
            purpose: "Replace the order system.",
            scopeOut: "Warehouse and logistics.",
          },
        }),
        { isStarted: true },
      ),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText("Replace the order system.")).toBeInTheDocument();
    expect(screen.getByText("Out of scope")).toBeInTheDocument();
    /* Nothing written under Background, so no empty heading. */
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
  });

  it("saves the narrative it was given", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(response(charter()));
    save.mockResolvedValue({
      data: charter({ narrative: { ...charter().narrative, purpose: "A purpose." } }),
      meta: { approvalCleared: false },
    });

    render(<ProjectCharterPanel project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: /Write it/ }));
    await user.type(screen.getByLabelText("Purpose"), "A purpose.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "acme-rebuild",
        expect.objectContaining({ purpose: "A purpose." }),
      ),
    );
  });

  /** **Warned before.** */
  it("warns that editing will clear an existing approval", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      response(
        charter({
          narrative: { ...charter().narrative, purpose: "A purpose." },
          approval: {
            isApproved: true,
            by: "Ada Lead",
            as: "Finance Director, Acme",
            at: "2027-01-10",
          },
        }),
        { isStarted: true },
      ),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: /Edit/ }));

    expect(
      screen.getByText(/Changing any of the wording below will clear that approval/),
    ).toBeInTheDocument();
  });

  /** **And reported after**, at the moment it happens. */
  it("says so when a save clears the approval", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      response(
        charter({
          narrative: { ...charter().narrative, purpose: "A purpose." },
          approval: { isApproved: true, by: "Ada", as: "FD, Acme", at: "2027-01-10" },
        }),
        { isStarted: true },
      ),
    );

    save.mockResolvedValue({
      data: charter({ narrative: { ...charter().narrative, purpose: "Something else." } }),
      meta: { approvalCleared: true },
    });

    render(<ProjectCharterPanel project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: /Edit/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(/its approval has been cleared/);
    expect(alert).toHaveTextContent(/agreed to the previous wording/);
  });

  it("records an approval in somebody's own words", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      response(
        charter({ narrative: { ...charter().narrative, purpose: "A purpose." } }),
        { isStarted: true },
      ),
    );

    approve.mockResolvedValue(
      charter({
        approval: { isApproved: true, by: "Ada Lead", as: "Finance Director, Acme", at: "2027-01-10" },
      }),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: /Record an approval/ }));
    await user.type(
      screen.getByLabelText("Who approved it, in their words"),
      "Finance Director, Acme",
    );
    await user.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith("acme-rebuild", "Finance Director, Acme"),
    );

    expect(await screen.findByText("Finance Director, Acme")).toBeInTheDocument();
  });

  it("offers no approval on a charter nobody has written", async () => {
    forProject.mockResolvedValue(response(charter()));

    render(<ProjectCharterPanel project={PROJECT} />);

    await screen.findByText("No charter yet");

    expect(
      screen.queryByRole("button", { name: /Record an approval/ }),
    ).not.toBeInTheDocument();
  });

  it("withdraws an approval without touching the words", async () => {
    const user = userEvent.setup();

    forProject.mockResolvedValue(
      response(
        charter({
          narrative: { ...charter().narrative, purpose: "A purpose." },
          approval: { isApproved: true, by: "Ada", as: "FD, Acme", at: "2027-01-10" },
        }),
        { isStarted: true },
      ),
    );

    unapprove.mockResolvedValue(
      charter({ narrative: { ...charter().narrative, purpose: "A purpose." } }),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(unapprove).toHaveBeenCalledWith("acme-rebuild"));
    expect(screen.getByText("A purpose.")).toBeInTheDocument();
  });

  /* ---------------- assembled, not transcribed ---------------- */

  it("says the second half is read fresh rather than copied in", async () => {
    forProject.mockResolvedValue(response(charter()));

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(
      await screen.findByText("Read fresh each time you open this — never copied in"),
    ).toBeInTheDocument();
  });

  it("shows the stakeholder map with its derived strategy", async () => {
    forProject.mockResolvedValue(
      response(
        charter({
          stakeholders: [
            {
              name: "Tolu Bello",
              role: "sponsor",
              roleLabel: "Sponsor",
              influence: "high",
              interest: "high",
              strategy: "Manage closely",
              isPrimary: true,
            },
          ],
        }),
      ),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText("Tolu Bello")).toBeInTheDocument();
    expect(screen.getByText("(Manage closely)")).toBeInTheDocument();
  });

  /** An absence is stated, never rendered as a blank heading. */
  it("says when nobody has been mapped rather than showing an empty list", async () => {
    forProject.mockResolvedValue(response(charter()));

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText(/Nobody mapped yet/)).toBeInTheDocument();
    expect(screen.getByText("Nobody staffed yet.")).toBeInTheDocument();
    expect(screen.getByText(/None marked/)).toBeInTheDocument();
  });

  /** The coverage caveat belongs here — this page is read by people who can act. */
  it("keeps the estimate caveat on the schedule", async () => {
    forProject.mockResolvedValue(
      response(
        charter({
          schedule: {
            startsOn: "2027-01-04",
            endsOn: "2027-01-22",
            durationDays: 15,
            itemCount: 9,
            unestimated: 3,
            coverage: 0.667,
          },
        }),
      ),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText("2027-01-04 to 2027-01-22")).toBeInTheDocument();
    expect(screen.getByText("3 unestimated")).toBeInTheDocument();
  });

  it("says why there is no schedule rather than showing a blank", async () => {
    forProject.mockResolvedValue(response(charter({ schedule: null })));

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(
      await screen.findByText(/no estimated work, or a dependency loop/),
    ).toBeInTheDocument();
  });

  it("gives somebody who cannot edit a read-only page", async () => {
    forProject.mockResolvedValue(
      response(
        charter({ narrative: { ...charter().narrative, purpose: "A purpose." } }),
        { canEdit: false, isStarted: true },
      ),
    );

    render(<ProjectCharterPanel project={PROJECT} />);

    expect(await screen.findByText("A purpose.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Record an approval/ }),
    ).not.toBeInTheDocument();
  });
});
