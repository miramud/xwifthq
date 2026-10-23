import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PathRoster from "./PathRoster";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import type { PathAssignee } from "@/lib/api/saas-client";

/**
 * Who holds a learning path, and taking it off them.
 *
 * The path resource only ever exposed `assignedCount`, so a path could be
 * granted to forty people and the product could tell you nothing except that
 * the number was forty. Nobody could see who they were and nobody could take
 * it back from one of them.
 *
 * It matters most where a path is mandatory: an assignment made in error shows
 * on the compliance report as somebody failing training they were never
 * supposed to do, and the only remedy was to let them finish it.
 */

const { pathRoster, revokePath } = vi.hoisted(() => ({
  pathRoster: vi.fn(),
  revokePath: vi.fn(),
}));

// The roster is a workspace DataView now, which reads the app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/lms/learning-paths/induction",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/saas-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/saas-client")>();

  return { ...actual, assignments: { pathRoster, revokePath } };
});

const ADA: PathAssignee = {
  id: "a-1",
  userId: "u-1",
  name: "Ada Lovelace",
  email: "ada@example.org",
  assignedOn: "2026-01-10T09:00:00+00:00",
  assignedBy: "HR",
  dueAt: null,
  completedAt: null,
  isComplete: false,
  isOverdue: false,
};

function give(rows: PathAssignee[]) {
  pathRoster.mockResolvedValue(rows);
}

beforeEach(() => {
  vi.clearAllMocks();
  give([ADA]);
});

describe("the roster", () => {
  it("names who holds it, which a count never could", async () => {
    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(
      screen.getByText(/ada@example.org · assigned by HR/),
    ).toBeInTheDocument();
  });

  it("counts the overdue separately in the heading", async () => {
    give([ADA, { ...ADA, id: "a-2", userId: "u-2", isOverdue: true }]);

    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    expect(
      await screen.findByText("2 assigned · 1 past their date"),
    ).toBeInTheDocument();
  });

  it("says nobody holds it rather than showing an empty list", async () => {
    give([]);

    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    expect(await screen.findByText("Nobody yet")).toBeInTheDocument();
  });

  /* Finished, overdue and in progress are three different things to be. */
  it("distinguishes finished from overdue from in progress", async () => {
    give([
      { ...ADA, id: "a-1", isComplete: true, completedAt: "2026-02-01" },
      { ...ADA, id: "a-2", userId: "u-2", isOverdue: true },
      { ...ADA, id: "a-3", userId: "u-3" },
    ]);

    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    expect(await screen.findByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });
});

describe("un-assigning", () => {
  /*
    Confirmed, because the row is the only thing distinguishing this person
    from the one above and the action is not obviously reversible from where
    somebody is standing.
  */
  it("asks before taking it off somebody", async () => {
    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    await userEvent.click(
      await screen.findByRole("button", { name: "Un-assign Ada Lovelace" }),
    );

    expect(
      await screen.findByRole("alertdialog", { name: "Un-assign this path from Ada Lovelace?" }),
    ).toBeInTheDocument();
    expect(revokePath).not.toHaveBeenCalled();
  });

  it("revokes once confirmed", async () => {
    revokePath.mockResolvedValue({ ok: true });

    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    await userEvent.click(
      await screen.findByRole("button", { name: "Un-assign Ada Lovelace" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Un-assign" }));

    await waitFor(() =>
      expect(revokePath).toHaveBeenCalledWith("induction", "u-1"),
    );
  });

  it("leaves them alone if the confirmation is declined", async () => {
    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    await userEvent.click(
      await screen.findByRole("button", { name: "Un-assign Ada Lovelace" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(revokePath).not.toHaveBeenCalled();
  });

  /*
    The fact somebody needs before pressing any of these, said once rather
    than in every confirmation.
  */
  it("says progress survives, so re-granting is not a reset", async () => {
    render(<PathRoster slug="induction" />, { wrapper: ConfirmProvider });

    expect(
      await screen.findByText(/withdraws access and keeps what they have already done/),
    ).toBeInTheDocument();
  });
});
