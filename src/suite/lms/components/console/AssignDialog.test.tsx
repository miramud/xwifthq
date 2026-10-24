import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssignDialog, { type AssignableStudent } from "./AssignDialog";
import { ApiError } from "@/lib/api/admin-client";

/**
 * The picker that grants access. Its job is selection at scale: an
 * institution assigns onboarding to a cohort, not to one person, so the
 * behaviour worth pinning down is how selection, filtering and the two
 * together actually work.
 */

const STUDENTS: AssignableStudent[] = [
  { id: "1", name: "Ada Lovelace", email: "ada@acme.test" },
  { id: "2", name: "Grace Hopper", email: "grace@acme.test" },
  { id: "3", name: "Alan Turing", email: "alan@acme.test" },
];

type AssignFn = (recipients: {
  studentIds: string[];
  emails: { email: string; name?: string | null }[];
}) => Promise<{
  assigned: number;
  alreadyHeld?: number;
  invited?: number;
  skipped?: { who: string; reason: string }[];
}>;

function setup(overrides: Partial<Parameters<typeof AssignDialog>[0]> = {}) {
  // Typed explicitly: an untyped `vi.fn(async () => …)` infers a zero-arg
  // signature, so `mock.calls[0][0]` would not typecheck.
  const onAssign = vi.fn<AssignFn>(async () => ({ assigned: 1, alreadyHeld: 0 }));
  const onClose = vi.fn();

  render(
    <AssignDialog
      title="Assign this course"
      subtitle="Practical Kubernetes"
      students={STUDENTS}
      onAssign={onAssign}
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onAssign, onClose };
}

describe("AssignDialog: selection", () => {
  it("cannot submit with nobody selected, and says so on the button", () => {
    setup();

    const submit = screen.getByRole("button", { name: /select learners to assign/i });

    expect(submit).toBeDisabled();
  });

  /** "assign to 34 learners" is a different decision from "assign to 3". */
  it("puts the running count on the confirm button", async () => {
    setup();

    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));
    expect(screen.getByRole("button", { name: /assign to 1 learner$/i })).toBeEnabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /grace hopper/i }));
    expect(screen.getByRole("button", { name: /assign to 2 learners/i })).toBeEnabled();
  });

  it("deselects on a second click", async () => {
    setup();

    const ada = screen.getByRole("checkbox", { name: /ada lovelace/i });

    await userEvent.click(ada);
    expect(ada).toBeChecked();

    await userEvent.click(ada);
    expect(ada).not.toBeChecked();
    expect(screen.getByRole("button", { name: /select learners to assign/i })).toBeDisabled();
  });

  it("passes exactly the selected ids to the caller", async () => {
    const { onAssign } = setup();

    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /alan turing/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 2 learners/i }));

    expect(onAssign).toHaveBeenCalledWith({
      studentIds: expect.arrayContaining(["1", "3"]),
      emails: [],
    });
    expect(onAssign.mock.calls[0][0].studentIds).toHaveLength(2);
  });
});

describe("AssignDialog: search and select-all together", () => {
  it("filters by name and by email", async () => {
    setup();

    await userEvent.type(screen.getByRole("searchbox"), "grace");

    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "alan@acme");

    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
  });

  /**
   * This is the interaction that makes cohort selection work: type part of a
   * cohort's name, then select all. If "select all" ever applied to the whole
   * roster instead of the filtered set, it would silently over-assign.
   */
  it("select-all applies to the filtered set, not the whole roster", async () => {
    const { onAssign } = setup();

    // "la" matches Ada Lovelace and Alan Turing, but not Grace Hopper.
    await userEvent.type(screen.getByRole("searchbox"), "la");
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /select all 2/i }));

    // Clearing the search reveals all three again, but only the two that were
    // on screen when "select all" was pressed are selected.
    await userEvent.clear(screen.getByRole("searchbox"));
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /assign to 2 learners/i }));

    expect(onAssign.mock.calls[0][0].studentIds.sort()).toEqual(["1", "3"]);
  });

  it("keeps a selection made before the search was narrowed", async () => {
    const { onAssign } = setup();

    await userEvent.click(screen.getByRole("checkbox", { name: /alan turing/i }));
    await userEvent.type(screen.getByRole("searchbox"), "ada");
    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));

    await userEvent.click(screen.getByRole("button", { name: /assign to 2 learners/i }));

    expect(onAssign.mock.calls[0][0].studentIds.sort()).toEqual(["1", "3"]);
  });

  it("offers to clear the selection once everything shown is picked", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: /select all 3/i }));
    expect(screen.getByRole("button", { name: /clear selection/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(screen.getByRole("button", { name: /select learners to assign/i })).toBeDisabled();
  });

  it("says so when a search matches nobody", async () => {
    setup();

    await userEvent.type(screen.getByRole("searchbox"), "nobody");

    expect(screen.getByText(/no learners match that search/i)).toBeInTheDocument();
  });
});

describe("AssignDialog: outcome", () => {
  /** Already-held is not a failure, and must not be reported as one. */
  it("reports newly assigned separately from already held", async () => {
    setup({ onAssign: vi.fn<AssignFn>(async () => ({ assigned: 2, alreadyHeld: 3 })) });

    await userEvent.click(screen.getByRole("button", { name: /select all 3/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 3 learners/i }));

    expect(await screen.findByText(/2 learners assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/3 already had it/i)).toBeInTheDocument();
  });

  it("omits the already-held line when there were none", async () => {
    setup({ onAssign: vi.fn<AssignFn>(async () => ({ assigned: 1, alreadyHeld: 0 })) });

    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner$/i }));

    expect(await screen.findByText(/1 learner assigned/i)).toBeInTheDocument();
    expect(screen.queryByText(/already had it/i)).not.toBeInTheDocument();
  });

  it("surfaces a failure with the reason the API gave", async () => {
    setup({
      onAssign: vi.fn(async () => {
        throw new ApiError("That course belongs to a different organisation.", 422);
      }),
    });

    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/different organisation/i);
    // Still on the picker, with the selection intact, so a retry is one click.
    expect(screen.getByRole("checkbox", { name: /ada lovelace/i })).toBeChecked();
  });
});

describe("AssignDialog: empty and loading", () => {
  it("points at the students page when the roster is empty", () => {
    setup({ students: [] });

    expect(screen.getByText(/no learners in this organisation yet/i)).toBeInTheDocument();
  });

  it("announces itself as busy while the roster loads", () => {
    setup({ students: [], loading: true });

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("is a modal dialog labelled by its title", () => {
    setup();

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Assign this course");
  });
});

describe("AssignDialog: inviting somebody with no account", () => {
  it("adds a typed address and sends it alongside the ticked learners", async () => {
    const { onAssign } = setup();

    await userEvent.click(screen.getByRole("checkbox", { name: /ada lovelace/i }));

    await userEvent.type(
      screen.getByLabelText(/not on the platform yet/i),
      "new.starter@acme.test",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    // Both are counted in the confirm button, because "assign to 2" is the
    // decision being made.
    await userEvent.click(screen.getByRole("button", { name: /assign to 2 learners/i }));

    expect(onAssign).toHaveBeenCalledWith({
      studentIds: ["1"],
      emails: [{ email: "new.starter@acme.test" }],
    });
  });

  it("can assign purely by email, with nobody ticked", async () => {
    const { onAssign } = setup();

    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "solo@acme.test");
    await userEvent.keyboard("{Enter}");

    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner/i }));

    expect(onAssign).toHaveBeenCalledWith({ studentIds: [], emails: [{ email: "solo@acme.test" }] });
  });

  /**
   * Caught here rather than coming back as one failed row inside a bulk
   * result, while the admin is still looking at what they typed.
   */
  it("refuses something that is not an email address", async () => {
    setup();

    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/does not look like an email/i);
    expect(
      screen.getByRole("button", { name: /select learners to assign/i }),
    ).toBeDisabled();
  });

  /**
   * Somebody who already has an account is ticked in the list rather than
   * invited again: they must not be emailed a new password.
   */
  it("ticks an existing learner instead of inviting them", async () => {
    const { onAssign } = setup();

    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "ada@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner/i }));

    expect(onAssign).toHaveBeenCalledWith({ studentIds: ["1"], emails: [] });
  });

  it("does not add the same address twice", async () => {
    setup();

    const field = screen.getByLabelText(/not on the platform yet/i);

    await userEvent.type(field, "twice@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await userEvent.type(field, "twice@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/already on the list/i);
    expect(screen.getByRole("button", { name: /assign to 1 learner/i })).toBeInTheDocument();
  });

  it("reports how many accounts were created", async () => {
    setup({
      onAssign: vi.fn<AssignFn>(async () => ({ assigned: 3, alreadyHeld: 0, invited: 2 })),
    });

    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "a@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner/i }));

    expect(
      await screen.findByText(/2 new accounts were created and sent a welcome email with a temporary password/i),
    ).toBeInTheDocument();
  });

  it("sends the optional name with the address", async () => {
    const { onAssign } = setup();

    await userEvent.type(screen.getByLabelText(/their name \(optional\)/i), "Nkechi Obi");
    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "Nkechi@Acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    // The chip shows who, not just the address.
    expect(screen.getByText("Nkechi Obi · nkechi@acme.test")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner/i }));

    expect(onAssign).toHaveBeenCalledWith({
      studentIds: [],
      emails: [{ email: "nkechi@acme.test", name: "Nkechi Obi" }],
    });
  });

  /**
   * A seat limit or an address that belongs to another organisation must not
   * be a silent miss inside a success message.
   */
  it("lists everybody who was skipped, with the reason", async () => {
    setup({
      onAssign: vi.fn<AssignFn>(async () => ({
        assigned: 1,
        invited: 1,
        skipped: [
          { who: "full@acme.test", reason: "No seats left on your licence." },
          { who: "elsewhere@other.test", reason: "That address belongs to another organisation." },
        ],
      })),
    });

    await userEvent.type(screen.getByLabelText(/not on the platform yet/i), "full@acme.test");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign to 1 learner/i }));

    expect(await screen.findByText("2 not assigned")).toBeInTheDocument();
    expect(screen.getByText("full@acme.test")).toBeInTheDocument();
    expect(screen.getByText(/No seats left on your licence/)).toBeInTheDocument();
    expect(screen.getByText(/belongs to another organisation/)).toBeInTheDocument();
  });

  it("names a learning path in the copy when that is what is assigned", () => {
    setup({ subject: "learning path" });

    expect(screen.getByText(/the link to this learning path/i)).toBeInTheDocument();
  });
});

describe("AssignDialog: who already has it", () => {
  const held = new Map([["2", "Assigned"]]);

  it("shows them ticked, locked and badged", () => {
    setup({ held });

    const grace = screen.getByRole("checkbox", { name: /grace hopper/i });
    expect(grace).toBeChecked();
    expect(grace).toBeDisabled();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText(/1 already has it/i)).toBeInTheDocument();
  });

  it("leaves them out of select all and out of what is sent", async () => {
    const user = userEvent.setup();
    const { onAssign } = setup({ held });

    await user.click(screen.getByRole("button", { name: /select all 2/i }));
    await user.click(screen.getByRole("button", { name: /assign to 2 learners/i }));

    expect(onAssign.mock.calls[0][0].studentIds.sort()).toEqual(["1", "3"]);
  });

  it("refuses to add them again by email", async () => {
    const user = userEvent.setup();
    setup({ held });

    await user.type(screen.getByPlaceholderText("name@organisation.com"), "grace@acme.test{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent(/grace hopper already has this course/i);
  });
});
