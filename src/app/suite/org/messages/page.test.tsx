import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption, comboboxValue, openCombobox } from "@/test/selectOption";
import AdminMessagesPage from "./page";
import { ApiError } from "@/lib/api/admin-client";

/**
 * The support inbox.
 *
 * `PATCH /tickets/{ticket}/assign` had no caller, and could not easily have
 * had one: the ticket payload carried the assignee's *name* and no id, so a
 * screen could print "Assigned to Bola" and had no way to open a list with
 * Bola already selected. A ticket landed in the queue unassigned and stayed
 * there — the only way to say who was dealing with it was to say so in a
 * reply.
 *
 * Two things the control has to get right.
 *
 * **Unassigned is a value, not an absence.** "Nobody has picked this up" is a
 * state a queue needs, and putting a ticket back on nobody has to be possible.
 *
 * **The list is the admin team.** The API accepts only an administrator of
 * this institution, so a wider list would offer choices that come back 422.
 */

const { list, get, reply, setStatus, assign, teamList } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  reply: vi.fn(),
  setStatus: vi.fn(),
  assign: vi.fn(),
  teamList: vi.fn(),
}));

vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();

  return {
    ...actual,
    tickets: { list, get, reply, setStatus, assign },
    team: { list: teamList, add: vi.fn(), remove: vi.fn() },
  };
});

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "tkt-1",
    reference: "TKT-0001",
    subject: "I cannot open lesson four",
    requester: "Ada Lovelace",
    initials: "AL",
    role: "Student",
    category: "Playback",
    priority: "Normal",
    status: "Open",
    assignee: null,
    assigneeId: null,
    created: "2026-09-01T09:00:00Z",
    updated: "2026-09-01T09:00:00Z",
    messages: [
      {
        from: "user",
        author: "Ada Lovelace",
        body: "The video spins forever.",
        time: "2026-09-01T09:00:00Z",
      },
    ],
    ...overrides,
  };
}

const TEAM = [
  { id: "u-1", name: "Bola Adeyemi", email: "b@x.test", initials: "BA", joined: "", isYou: false },
  { id: "u-2", name: "Chi Okafor", email: "c@x.test", initials: "CO", joined: "", isYou: true },
];

async function openTicket() {
  render(<AdminMessagesPage />);

  await userEvent.click(await screen.findByText("I cannot open lesson four"));
  await screen.findByLabelText("Assignee");
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([ticket()]);
  get.mockResolvedValue(ticket());
  teamList.mockResolvedValue(TEAM);
  assign.mockImplementation((id: string, assigneeId: string | null) =>
    Promise.resolve(
      ticket({
        assigneeId,
        assignee: TEAM.find((m) => m.id === assigneeId)?.name ?? null,
      }),
    ),
  );
});

describe("handing a ticket to somebody", () => {
  it("offers the admin team", async () => {
    await openTicket();

    const listbox = await openCombobox(userEvent.setup(), screen.getByLabelText("Assignee"));

    expect(within(listbox).getByRole("option", { name: "Bola Adeyemi" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "Chi Okafor (you)" })).toBeInTheDocument();
  });

  it("assigns the ticket to the colleague picked", async () => {
    await openTicket();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Assignee"), "Bola Adeyemi");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("tkt-1", "u-1"));
  });

  it("shows who currently holds it", async () => {
    get.mockResolvedValue(ticket({ assigneeId: "u-1", assignee: "Bola Adeyemi" }));

    await openTicket();

    expect(comboboxValue(screen.getByLabelText("Assignee"))).toBe("u-1");
  });

  /* "Nobody has picked this up" is a state a queue needs. */
  it("can put a ticket back on nobody", async () => {
    get.mockResolvedValue(ticket({ assigneeId: "u-1", assignee: "Bola Adeyemi" }));

    await openTicket();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Assignee"), "Unassigned");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("tkt-1", null));
  });

  /*
    Somebody who has since left the admin team still holds the ticket. Without
    an option for them the control would read as Unassigned, which is a
    different and untrue statement.
  */
  it("still names an assignee who has left the admin team", async () => {
    get.mockResolvedValue(ticket({ assigneeId: "u-gone", assignee: "Femi Balogun" }));

    await openTicket();

    const assignee = screen.getByLabelText("Assignee");
    expect(comboboxValue(assignee)).toBe("u-gone");
    expect(assignee).toHaveTextContent("Femi Balogun");
  });

  it("puts a refusal in front of the admin", async () => {
    assign.mockRejectedValue(
      new ApiError("A ticket can only be assigned to an administrator here.", 422),
    );

    await openTicket();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Assignee"), "Bola Adeyemi");

    expect(
      await screen.findByText("A ticket can only be assigned to an administrator here."),
    ).toBeInTheDocument();
  });

  /*
    The inbox is what somebody opened this page for. A team list that will not
    load should cost the assign control and nothing else.
  */
  it("still shows the thread when the team list fails", async () => {
    teamList.mockRejectedValue(new Error("nope"));

    render(<AdminMessagesPage />);

    await userEvent.click(await screen.findByText("I cannot open lesson four"));

    expect(await screen.findByText("The video spins forever.")).toBeInTheDocument();
  });
});
