import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OffboardingBoard from "./OffboardingBoard";
import { ApiError, type Offboarding } from "@/lib/api/hrm-client";
import { chooseOption } from "@/test/selectOption";

/**
 * Everybody on their way out.
 *
 * The board exists for one number and it is in the header: people who have
 * **gone but are not cleared**. Each may still have a live login, a building
 * pass and an unreturned laptop, and nothing in the module surfaced that
 * before — `employees.ended_on` recorded that somebody left and said nothing
 * about what they took with them.
 *
 * The other thing worth pinning is the shape of "closed". An item can be
 * completed or waived with a reason, and the difference matters: a waived
 * laptop is closed and *not returned*, which is exactly what the final
 * settlement deducts for. A checklist that cannot be finished is one people
 * stop using; one that finishes on a button press is not a checklist.
 */

const { list, get, completeItem, waiveItem, updateItemCost, clear, settle, start, employeeList } =
  vi.hoisted(() => ({
    updateItemCost: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    completeItem: vi.fn(),
    waiveItem: vi.fn(),
    clear: vi.fn(),
    settle: vi.fn(),
    start: vi.fn(),
    employeeList: vi.fn(),
  }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      offboardings: { list, get, completeItem, waiveItem, updateItemCost, clear, settle, start },
      employees: {
        list: employeeList,
        // Pickers load everybody through listAll, page by page.
        listAll: async (...args: unknown[]) => (await employeeList(...args)).data,
      },
    },
  };
});

const ROW: Offboarding = {
  id: "off-1",
  employeeId: "e-1",
  name: "Ada Lovelace",
  jobTitle: "Ward Sister",
  department: "Clinical",
  kind: "resignation",
  kindLabel: "Resignation",
  isVoluntary: true,
  status: "in_progress",
  statusLabel: "In progress",
  noticeGivenOn: "2026-09-01",
  lastWorkingDay: "2026-09-30",
  leavingOn: "2026-09-30",
  noticeDays: 29,
  hasGone: false,
  progress: 40,
  outstandingItems: 3,
  isClearable: false,
};

const DETAIL: Offboarding = {
  ...ROW,
  reason: "Moving to another trust.",
  unreturnedCostKobo: 0,
  outstandingLeaveDays: null,
  settledAt: null,
  items: [
    {
      id: "i-1",
      kind: "task",
      isAsset: false,
      title: "Revoke system access",
      description: null,
      ownerRole: "it",
      assetTag: null,
      replacementCostKobo: null,
      isRequired: true,
      dueOn: "2026-09-30",
      isClosed: false,
      wasReturned: false,
      isOverdue: false,
      completedAt: null,
      completedBy: null,
      waivedReason: null,
    },
    {
      id: "i-2",
      kind: "asset",
      isAsset: true,
      title: "Return laptop and charger",
      description: null,
      ownerRole: "it",
      assetTag: null,
      replacementCostKobo: 45_000_000,
      isRequired: true,
      dueOn: "2026-09-30",
      isClosed: false,
      wasReturned: false,
      isOverdue: false,
      completedAt: null,
      completedBy: null,
      waivedReason: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ data: [ROW], meta: { goneButNotCleared: 0 } });
  get.mockResolvedValue(DETAIL);
  completeItem.mockResolvedValue(DETAIL);
  waiveItem.mockResolvedValue(DETAIL);
  clear.mockResolvedValue({ ...DETAIL, status: "cleared" });
  settle.mockResolvedValue(DETAIL);
});

describe("the access review", () => {
  /*
    Stated as a problem rather than a count. Somebody who has stopped coming in
    and still has a login is not a tidiness issue.
  */
  it("leads with people who have gone without being cleared", async () => {
    list.mockResolvedValue({ data: [ROW], meta: { goneButNotCleared: 2 } });

    render(<OffboardingBoard />);

    expect(
      await screen.findByText(/2 people have gone without being cleared/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/may still have a live login/),
    ).toBeInTheDocument();
  });

  it("says nothing when everybody who left is cleared", async () => {
    render(<OffboardingBoard />);

    await screen.findByText("Ada Lovelace");

    expect(
      screen.queryByText(/gone without being cleared/),
    ).not.toBeInTheDocument();
  });

  /*
    "Gone" is measured against the last working day, not the leaving date: the
    question an access review asks is "are they still coming in", not "is the
    contract technically live".
  */
  it("flags a row for somebody already gone with items outstanding", async () => {
    list.mockResolvedValue({
      data: [{ ...ROW, hasGone: true }],
      meta: { goneButNotCleared: 1 },
    });

    render(<OffboardingBoard />);

    expect(await screen.findByText("Gone, not cleared")).toBeInTheDocument();
  });
});

describe("the clearance list", () => {
  it("opens a departure in place", async () => {
    const user = userEvent.setup();

    render(<OffboardingBoard />);

    await user.click(await screen.findByText("Ada Lovelace"));

    expect(await screen.findByText("Return laptop and charger")).toBeInTheDocument();
  });

  it("marks an item done", async () => {
    const user = userEvent.setup();

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));
    await screen.findByText("Revoke system access");

    await user.click(screen.getAllByRole("button", { name: "Done" })[0]);

    await waitFor(() => expect(completeItem).toHaveBeenCalledWith("i-1"));
  });

  /*
    The reason is required for the same argument as a declined leave request:
    a deduction on somebody's final pay has to be explainable a year later.
  */
  it("will not waive an item without a reason", async () => {
    const user = userEvent.setup();

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));
    await screen.findByText("Revoke system access");

    await user.click(screen.getAllByRole("button", { name: "Waive" })[0]);

    const confirm = await screen.findByRole("button", { name: "Waive it" });

    expect(confirm).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(/Why will this never be done/),
      "Lost.",
    );

    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(waiveItem).toHaveBeenCalledWith("i-1", "Lost."));
  });
});

describe("clearing", () => {
  /*
    Disabled rather than hidden, so it is obvious that clearing is the next
    step and what is holding it up.
  */
  it("refuses to clear while items are outstanding, and says why", async () => {
    const user = userEvent.setup();

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));

    const button = await screen.findByRole("button", {
      name: "Clear and end employment",
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Complete or waive every required item first.",
    );
  });

  it("clears once everything is closed", async () => {
    const user = userEvent.setup();

    get.mockResolvedValue({ ...DETAIL, isClearable: true });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));

    await user.click(
      await screen.findByRole("button", { name: "Clear and end employment" }),
    );

    // Confirmed in a dialog, with "Disable sign-in" ticked by default.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /Disable sign-in/ })).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Clear and end employment" }));

    await waitFor(() => expect(clear).toHaveBeenCalledWith("off-1", { disableSignIn: true }));
  });

  it("sends the unticked choice to keep their sign-in", async () => {
    const user = userEvent.setup();

    get.mockResolvedValue({ ...DETAIL, isClearable: true });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));
    await user.click(await screen.findByRole("button", { name: "Clear and end employment" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: /Disable sign-in/ }));
    await user.click(within(dialog).getByRole("button", { name: "Clear and end employment" }));

    await waitFor(() => expect(clear).toHaveBeenCalledWith("off-1", { disableSignIn: false }));
  });
});

/*
  H16: a cleared departure used to read "Ready" with Clear and "They are
  staying" still live. Closed now reads as closed, with nothing to press.
*/
describe("a cleared departure", () => {
  const CLEARED: Offboarding = {
    ...DETAIL,
    status: "cleared",
    statusLabel: "Cleared",
    outstandingItems: 0,
    isClearable: true,
    awaitsLeavingDate: true,
    disableSignIn: true,
    clearedAt: "2026-09-20T10:00:00Z",
  };

  it("shows its status, not progress, and offers no actions", async () => {
    const user = userEvent.setup();

    list.mockResolvedValue({ data: [CLEARED], meta: { goneButNotCleared: 0 } });
    get.mockResolvedValue(CLEARED);

    render(<OffboardingBoard />);

    expect(await screen.findByText(/Cleared · leaves/)).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();

    await user.click(screen.getByText("Ada Lovelace"));

    expect(await screen.findByText(/Their employment ends on/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear and end employment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "They are staying" })).not.toBeInTheDocument();
  });
});

describe("what they kept", () => {
  it("costs equipment that never came back", async () => {
    const user = userEvent.setup();

    get.mockResolvedValue({ ...DETAIL, unreturnedCostKobo: 45_000_000 });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));

    expect(
      await screen.findByText(/of equipment has not come back/),
    ).toBeInTheDocument();
  });

  it("says outstanding leave was frozen at settlement", async () => {
    const user = userEvent.setup();

    get.mockResolvedValue({ ...DETAIL, outstandingLeaveDays: 12.5 });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));

    expect(
      await screen.findByText(/12.5 days of leave outstanding, frozen at settlement/),
    ).toBeInTheDocument();
  });
});

describe("when there is nobody leaving", () => {
  it("says so rather than showing an empty table", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });

    render(<OffboardingBoard />);

    expect(await screen.findByText("Nobody is leaving")).toBeInTheDocument();
    /*
      The hint used to say a departure was "announced from somebody's record",
      which described a route that did not exist anywhere in the product. An
      empty state that sends people looking for a button is worse than one
      that offers it.
    */
    expect(
      screen.getByText(/clearance list is raised for you/),
    ).toBeInTheDocument();
  });
});

/**
 * Announcing a departure.
 *
 * Until this existed the board could clear a leaver and close them but never
 * start one, so in practice nobody had a clearance list and the access review
 * at the top of the screen was permanently empty. The tests below pin the
 * three judgements rather than the form.
 */
describe("recording a departure", () => {
  beforeEach(() => {
    employeeList.mockResolvedValue({
      data: [
        {
          id: "e-9",
          person: { id: "u-9", name: "Grace Hopper", email: null, avatar: null },
          jobTitle: "Staff Nurse",
        },
      ],
    });
    start.mockResolvedValue({ id: "off-2" });
  });

  async function openForm() {
    render(<OffboardingBoard />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Record a departure" }))[0],
    );
  }

  /* The empty state used to describe a route into this that did not exist. */
  it("is offered from the empty board, not only from a populated one", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });

    render(<OffboardingBoard />);

    expect(await screen.findByText("Nobody is leaving")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Record a departure" }).length,
    ).toBeGreaterThan(0);
  });

  it("sends who, why and when", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    await openForm();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Who is leaving"), /Grace Hopper/);
    await chooseOption(userEvent.setup(), screen.getByLabelText("Why"), "Redundancy");
    await userEvent.type(screen.getByLabelText("Employment ends"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "e-9",
        expect.objectContaining({ kind: "redundancy", leavingOn: "2026-11-30" }),
      ),
    );
  });

  /*
    Sending a copy of the leaving date would put "they worked to the last day"
    on a record where nobody said so. The service defaults it; the screen must
    not pre-empt that.
  */
  it("leaves the last working day null rather than copying the leaving date", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    await openForm();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Who is leaving"), /Grace Hopper/);
    await userEvent.type(screen.getByLabelText("Employment ends"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "e-9",
        expect.objectContaining({ lastWorkingDay: null }),
      ),
    );
  });

  /*
    The one that matters most. A checkbox would record "no" against every
    leaver nobody thought about, and that answer follows a person into every
    future application they make here.
  */
  it("records rehireable as unknown unless somebody chose", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    await openForm();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Who is leaving"), /Grace Hopper/);
    await userEvent.type(screen.getByLabelText("Employment ends"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "e-9",
        expect.objectContaining({ isRehireable: null }),
      ),
    );
  });

  it("records it as false only when somebody actually says no", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    await openForm();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Who is leaving"), /Grace Hopper/);
    await userEvent.type(screen.getByLabelText("Employment ends"), "2026-11-30");
    await chooseOption(
      userEvent.setup(),
      screen.getByLabelText("Would we have them back"),
      "No",
    );
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "e-9",
        expect.objectContaining({ isRehireable: false }),
      ),
    );
  });

  /* Asking a dismissed employee where they are going is neither answerable nor decent. */
  it("asks where they are going only when they chose to leave", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    await openForm();

    expect(screen.getByLabelText("Leaving for")).toBeInTheDocument();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Why"), "Dismissal");

    expect(screen.queryByLabelText("Leaving for")).not.toBeInTheDocument();
  });

  it("says what went wrong rather than closing silently", async () => {
    list.mockResolvedValue({ data: [], meta: { goneButNotCleared: 0 } });
    start.mockRejectedValue(
      new ApiError("That person is already being offboarded.", 422),
    );

    await openForm();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Who is leaving"), /Grace Hopper/);
    await userEvent.type(screen.getByLabelText("Employment ends"), "2026-11-30");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    expect(
      await screen.findByText("That person is already being offboarded."),
    ).toBeInTheDocument();
  });
});

/*
  H15: the settlement figure goes to payroll. "Work out what they are owed"
  opens a dialog for the figure and a note, sends it in kobo, and the record
  then says where it stands: waiting for the next run, or paid on one.
*/
describe("the final settlement", () => {
  it("sends the figure in kobo with a note", async () => {
    const user = userEvent.setup();

    settle.mockResolvedValue({
      ...DETAIL,
      settledAt: "2026-09-25T10:00:00Z",
      finalSettlementKobo: 25_000_000,
      finalSettlementNote: "12 days of untaken leave.",
      finalPay: { amountKobo: 25_000_000, status: "waiting", runId: null, runReference: null, paidAt: null },
    });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));
    await user.click(await screen.findByRole("button", { name: "Work out what they are owed" }));

    await user.type(screen.getByLabelText("Amount owed before deductions (₦)"), "250000");
    await user.type(screen.getByLabelText("How it was worked out"), "12 days of untaken leave.");

    // The laptop not yet returned (₦450,000) is worth more than is owed: nothing to payroll.
    expect(screen.getByText("Deducted for equipment not returned")).toBeInTheDocument();
    expect(screen.getByText(/nothing goes to payroll/).textContent).toContain("₦200,000");

    await user.click(screen.getByRole("button", { name: "Settle" }));

    await waitFor(() =>
      expect(settle).toHaveBeenCalledWith("off-1", 25_000_000, "12 days of untaken leave."),
    );
    expect(await screen.findByText("Waiting for the next payroll run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change the settlement" })).toBeInTheDocument();
  });

  it("lets HR change what an unreturned asset is deducted at", async () => {
    const user = userEvent.setup();
    updateItemCost.mockResolvedValue(DETAIL);

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));
    expect(await screen.findByText(/Deducted if not returned: ₦450,000/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change" }));
    const input = screen.getByLabelText("Deduct (₦)");
    await user.clear(input);
    await user.type(input, "300000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateItemCost).toHaveBeenCalledWith("i-2", 30_000_000));
  });

  it("says which run paid it and no longer offers to change it", async () => {
    const user = userEvent.setup();

    get.mockResolvedValue({
      ...DETAIL,
      settledAt: "2026-09-25T10:00:00Z",
      finalSettlementKobo: 25_000_000,
      finalPay: { amountKobo: 25_000_000, status: "paid", runId: "r-1", runReference: "PR-2026-10", paidAt: "2026-10-31T00:00:00Z" },
    });

    render(<OffboardingBoard />);
    await user.click(await screen.findByText("Ada Lovelace"));

    expect(await screen.findByText("Paid on PR-2026-10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change the settlement" })).not.toBeInTheDocument();
  });
});
