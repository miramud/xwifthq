import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SprintDialog from "./SprintDialog";
import { ApiError, type Sprint } from "@/lib/api/projects-client";

/**
 * Editing a sprint.
 *
 * This screen exists because `PATCH /sprints/{id}` did and nothing called it.
 * The dates were the point, the brief was explicit that a sprint's dates come
 * from the document *or* are set by hand, and the product shipped with the
 * 14-day default and no way to change it.
 *
 * Two rules worth defending:
 *
 * **A cleared goal is sent as null, not omitted.** The API tells those apart:
 * a present null deletes, an absent key means "I sent nothing". Omitting it
 * saves successfully and keeps the old goal, which is the shape of bug where
 * the form says it worked. The API had exactly that bug too.
 *
 * **Dates stay editable on a running sprint.** Refusing would push people into
 * closing early and opening a replacement, which throws away the commitment
 * snapshot that makes velocity mean anything.
 */

const { update } = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, sprints: { ...actual.sprints, update } };
});

function sprint(over: Partial<Sprint> = {}): Sprint {
  return {
    id: "sp-1",
    projectId: "p-1",
    sequence: 3,
    name: "Sprint 3",
    goal: "Ship the dataset list",
    startsOn: "2026-11-02",
    endsOn: "2026-11-13",
    lengthInDays: 12,
    daysRemaining: 4,
    hasOverrun: false,
    status: "active",
    statusLabel: "Active",
    acceptsChanges: true,
    startedAt: null,
    closedAt: null,
    ...over,
  } as Sprint;
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("SprintDialog", () => {
  it("opens with the sprint's own dates and goal", async () => {
    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/^Name$/i)).toHaveValue("Sprint 3");
    expect(screen.getByLabelText(/^Goal$/i)).toHaveValue("Ship the dataset list");
    expect(screen.getByLabelText(/^Starts$/i)).toHaveValue("2026-11-02");
    expect(screen.getByLabelText(/^Ends$/i)).toHaveValue("2026-11-13");
  });

  it("moves the end date of a running sprint", async () => {
    const onSaved = vi.fn();

    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={onSaved} />);

    const ends = screen.getByLabelText(/^Ends$/i);

    await userEvent.clear(ends);
    await userEvent.type(ends, "2026-11-20");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith("sp-1", {
      name: "Sprint 3",
      goal: "Ship the dataset list",
      startsOn: "2026-11-02",
      endsOn: "2026-11-20",
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  /** A cleared goal is a deliberate null, never an omission. */
  it("sends null for a cleared goal", async () => {
    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText(/^Goal$/i));
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith(
      "sp-1",
      expect.objectContaining({ goal: null }),
    );
  });

  it("writes a goal onto a sprint that had none", async () => {
    render(
      <SprintDialog sprint={sprint({ goal: null })} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(screen.getByLabelText(/^Goal$/i)).toHaveValue("");

    await userEvent.type(screen.getByLabelText(/^Goal$/i), "Get the import shipped");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    expect(update).toHaveBeenCalledWith(
      "sp-1",
      expect.objectContaining({ goal: "Get the import shipped" }),
    );
  });

  /** The end cannot be dragged before the start; the browser enforces it too. */
  it("will not offer an end date before the start", async () => {
    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/^Ends$/i)).toHaveAttribute("min", "2026-11-02");
  });

  it("says a closed sprint's record cannot change", async () => {
    render(
      <SprintDialog
        sprint={sprint({ status: "closed", acceptsChanges: false })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText(/record of what was committed and finished cannot change/i))
      .toBeInTheDocument();
  });

  it("shows the API's refusal and stays open", async () => {
    update.mockRejectedValue(
      new ApiError("That sprint is closed. Its record is fixed.", 422),
    );

    const onSaved = vi.fn();

    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(await screen.findByText(/Its record is fixed/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("will not save without a name", async () => {
    render(<SprintDialog sprint={sprint()} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText(/^Name$/i));

    expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });
});
