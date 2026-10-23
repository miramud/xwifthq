import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemDependencies from "./ItemDependencies";
import { chooseOption, openCombobox } from "@/test/selectOption";
import { ApiError } from "@/lib/api/admin-client";

/**
 * The dependency editor.
 *
 * The rule under most of these: **the server's refusal is the message**. A
 * client that greyed out unreachable items would need the whole graph on every
 * keystroke and still could not explain itself; the 422 names the loop, and
 * naming it is the only form anybody can act on.
 */

const { forItem, add, remove } = vi.hoisted(() => ({
  forItem: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/projects-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/projects-client")>();

  return { ...actual, dependencies: { forItem, add, remove } };
});

function response(over: Record<string, unknown> = {}) {
  return {
    data: { dependsOn: [], blocks: [], ...(over.data ?? {}) },
    meta: {
      canManage: true,
      types: [
        {
          value: "finish_to_start",
          label: "Finish to start",
          describes: "starts when it finishes",
        },
        {
          value: "start_to_start",
          label: "Start to start",
          describes: "starts when it starts",
        },
      ],
      candidates: [
        { id: "other", title: "Design the API", externalRef: "ACME-1" },
        { id: "third", title: "Write the docs", externalRef: null },
      ],
      ...(over.meta ?? {}),
    },
  };
}

function edge(over: Record<string, unknown> = {}) {
  return {
    id: "dep-1",
    itemId: "other",
    title: "Design the API",
    externalRef: "ACME-1",
    lagDays: 0,
    type: "finish_to_start",
    typeLabel: "Finish to start",
    describes: "starts when it finishes",
    note: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ItemDependencies", () => {
  it("says both directions, and says so when there are none", async () => {
    forItem.mockResolvedValue(response());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    expect(
      await screen.findByText("Nothing — this can start whenever the team is ready."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing is waiting on this.")).toBeInTheDocument();
  });

  /** Worded once on the server so three screens cannot word it three ways. */
  it("shows the server's sentence rather than a lag number", async () => {
    forItem.mockResolvedValue(
      response({
        data: {
          dependsOn: [edge({ lagDays: -2, describes: "may start 2 days before it finishes" })],
        },
      }),
    );

    render(<ItemDependencies slug="acme" itemId="mine" />);

    expect(
      await screen.findByText("may start 2 days before it finishes"),
    ).toBeInTheDocument();
    expect(screen.queryByText("-2")).not.toBeInTheDocument();
  });

  it("warns that these save on their own, not with the form", async () => {
    forItem.mockResolvedValue(response());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    expect(
      await screen.findByText(/Saved as you add them, separately from the rest of this form/),
    ).toBeInTheDocument();
  });

  it("links an item and tells whoever is showing the schedule", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();

    forItem.mockResolvedValue(response());
    add.mockResolvedValue(edge());

    render(<ItemDependencies slug="acme" itemId="mine" onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    await chooseOption(user, screen.getByLabelText("This item waits for"), "ACME-1 — Design the API");
    await user.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("acme", "mine", {
        predecessorId: "other",
        type: "finish_to_start",
        lagDays: 0,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("sends a negative lag through as a lead", async () => {
    const user = userEvent.setup();

    forItem.mockResolvedValue(response());
    add.mockResolvedValue(edge());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    await chooseOption(user, screen.getByLabelText("This item waits for"), "ACME-1 — Design the API");

    const lag = screen.getByLabelText("Days between them");
    await user.clear(lag);
    await user.type(lag, "-2");

    await user.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("acme", "mine", {
        predecessorId: "other",
        type: "finish_to_start",
        lagDays: -2,
      }),
    );
  });

  /** **The refusal, verbatim.** It names the loop; nothing here paraphrases it. */
  it("shows the loop the server named when a link is refused", async () => {
    const user = userEvent.setup();

    forItem.mockResolvedValue(response());
    add.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        predecessorId: [
          "That would make a loop: Build the client → Design the API → Build the client. Nothing could start first, so the link is refused.",
        ],
      }),
    );

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    await chooseOption(user, screen.getByLabelText("This item waits for"), "ACME-1 — Design the API");
    await user.click(screen.getByRole("button", { name: "Link" }));

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Build the client → Design the API → Build the client");
    /* And the form stays open, holding the choice, so it can be changed. */
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
  });

  it("does not offer an item that is already linked either way", async () => {
    forItem.mockResolvedValue(
      response({
        data: {
          dependsOn: [edge()],
          blocks: [edge({ id: "dep-2", itemId: "third", title: "Write the docs" })],
        },
      }),
    );

    render(<ItemDependencies slug="acme" itemId="mine" />);

    /* Both directions render the same sentence, hence All. */
    expect(await screen.findAllByText("starts when it finishes")).toHaveLength(2);

    /* Both candidates are taken, so there is nothing left to add. */
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("unlinks, and tells whoever is showing the schedule", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();

    forItem.mockResolvedValue(response({ data: { dependsOn: [edge()] } }));
    remove.mockResolvedValue(undefined);

    render(<ItemDependencies slug="acme" itemId="mine" onChanged={onChanged} />);

    await user.click(await screen.findByRole("button", { name: "Unlink Design the API" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Unlink" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("acme", "mine", "dep-1"));
    expect(onChanged).toHaveBeenCalled();
  });

  /**
   * The other direction is edited from the item that waits. Two places to
   * write the same edge is two places to get it wrong.
   */
  it("does not offer to unlink from the blocking side", async () => {
    forItem.mockResolvedValue(response({ data: { blocks: [edge()] } }));

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await screen.findByText("Design the API");

    expect(
      screen.queryByRole("button", { name: "Unlink Design the API" }),
    ).not.toBeInTheDocument();
  });

  it("shows somebody who cannot manage the board the links without the controls", async () => {
    forItem.mockResolvedValue(
      response({ data: { dependsOn: [edge()] }, meta: { canManage: false, candidates: [] } }),
    );

    render(<ItemDependencies slug="acme" itemId="mine" />);

    expect(await screen.findByText("Design the API")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlink Design the API" }),
    ).not.toBeInTheDocument();
  });
  /**
   * **The relations come from the server, wording included**, so a fifth one
   * would not need a frontend release.
   */
  it("offers the relations the server sent, with their wording", async () => {
    const user = userEvent.setup();

    forItem.mockResolvedValue(response());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await user.click(await screen.findByRole("button", { name: "Add" }));

    const picker = await openCombobox(user, screen.getByLabelText("How they relate"));

    expect(within(picker).getByRole("option", { name: "Finish to start" })).toBeInTheDocument();
    expect(within(picker).getByRole("option", { name: "Start to start" })).toBeInTheDocument();
    expect(screen.getByText("This item starts when it finishes.")).toBeInTheDocument();
  });

  it("shows the chosen relation's own sentence as the hint", async () => {
    const user = userEvent.setup();

    forItem.mockResolvedValue(response());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    await chooseOption(user, screen.getByLabelText("How they relate"), "Start to start");

    expect(screen.getByText("This item starts when it starts.")).toBeInTheDocument();
  });

  it("sends the chosen relation", async () => {
    const user = userEvent.setup();

    forItem.mockResolvedValue(response());
    add.mockResolvedValue(edge());

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await user.click(await screen.findByRole("button", { name: "Add" }));
    await chooseOption(user, screen.getByLabelText("This item waits for"), "ACME-1 — Design the API");
    await chooseOption(user, screen.getByLabelText("How they relate"), "Start to start");
    await user.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith("acme", "mine", {
        predecessorId: "other",
        type: "start_to_start",
        lagDays: 0,
      }),
    );
  });

  /**
   * "Starts when it finishes" and "finishes when it starts" are one word apart
   * and mean opposite things, so anything other than the ordinary relation is
   * named as well as described.
   */
  it("names a relation that is not the ordinary one", async () => {
    forItem.mockResolvedValue(
      response({
        data: {
          dependsOn: [
            edge({
              type: "start_to_finish",
              typeLabel: "Start to finish",
              describes: "finishes when it starts",
            }),
          ],
        },
      }),
    );

    render(<ItemDependencies slug="acme" itemId="mine" />);

    expect(await screen.findByText("finishes when it starts")).toBeInTheDocument();
    expect(screen.getByText("(Start to finish)")).toBeInTheDocument();
  });

  it("does not clutter an ordinary finish-to-start link with its label", async () => {
    forItem.mockResolvedValue(response({ data: { dependsOn: [edge()] } }));

    render(<ItemDependencies slug="acme" itemId="mine" />);

    await screen.findByText("starts when it finishes");

    expect(screen.queryByText("(Finish to start)")).not.toBeInTheDocument();
  });
});
