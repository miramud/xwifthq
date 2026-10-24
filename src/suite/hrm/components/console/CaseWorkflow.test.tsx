import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CaseWorkflow from "./CaseWorkflow";
import type { RelationsCase } from "@/lib/api/hrm-client";
import { chooseOption, comboboxValue, openCombobox } from "@/test/selectOption";

/**
 * Running a case, as opposed to reading one.
 *
 * Every step of the process had an endpoint, a policy and tests, and no way
 * in. The board listed cases and charted them and offered not one action, so
 * an institution could see that somebody had a disciplinary open and could not
 * put the allegation to them, investigate it, hear it or decide it.
 *
 * What the tests pin is the *process*, not the forms:
 *
 * - each stage offers only what comes next, so nobody is invited to skip the
 *   step that makes a decision defensible
 * - the outcome is never pre-filled, because a suggested one turns "what does
 *   the policy say" into "what did the software already pick"
 * - a warning's lifespan is on the form, since six months and two years are
 *   different acts
 * - the appeal cannot be heard by whoever decided it, and the screen says so
 */

const {
  get,
  serveAllegation,
  investigate,
  recordFindings,
  scheduleHearing,
  decide,
  decideAppeal,
  withdraw,
  employeeList,
} = vi.hoisted(() => ({
  get: vi.fn(),
  serveAllegation: vi.fn(),
  investigate: vi.fn(),
  recordFindings: vi.fn(),
  scheduleHearing: vi.fn(),
  decide: vi.fn(),
  decideAppeal: vi.fn(),
  withdraw: vi.fn(),
  employeeList: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      relations: {
        get,
        serveAllegation,
        investigate,
        recordFindings,
        scheduleHearing,
        decide,
        decideAppeal,
        withdraw,
      },
      employees: {
        list: employeeList,
        // Pickers load everybody through listAll, page by page.
        listAll: async (...args: unknown[]) => (await employeeList(...args)).data,
      },
    },
  };
});

const CASE: RelationsCase = {
  id: "c-1",
  reference: "DIS-0007",
  kind: "disciplinary",
  kindLabel: "Disciplinary",
  category: null,
  status: "open",
  statusLabel: "Open",
  summary: "Repeated late starts",
  openedOn: "2026-09-01",
  ageInDays: 19,
  subjectId: "e-1",
  subjectName: "Ada Lovelace",
  raisedByName: "HR",
  outcome: null,
  outcomeLabel: null,
  outcomeOn: null,
  hasLiveWarning: false,
  warningExpiresOn: null,
  isAppealable: false,
  appealedAt: null,
  daysToResolve: null,
};

function give(overrides: Partial<RelationsCase> = {}) {
  get.mockResolvedValue({ ...CASE, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  give();
  employeeList.mockResolvedValue({
    data: [
      {
        id: "e-9",
        person: { id: "u-9", name: "Grace Hopper", email: null, avatar: null },
        jobTitle: "Matron",
      },
    ],
  });
});

describe("what a case offers at each stage", () => {
  /*
    The ordering is the whole point. Offering "schedule a hearing" on a case
    where the allegation has not been put invites somebody to skip the step
    that makes the outcome defensible, and the service refuses anyway, after
    they have typed it.
  */
  it("offers the allegation and an investigation on a new case", async () => {
    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: "Put the allegation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start investigating" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Schedule a hearing" }),
    ).not.toBeInTheDocument();
  });

  it("offers findings and a hearing once it is being investigated", async () => {
    give({ status: "investigating", statusLabel: "Investigating" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: "Record findings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Schedule a hearing" }),
    ).toBeInTheDocument();
  });

  it("offers only the appeal once it is under appeal", async () => {
    give({ status: "under_appeal", statusLabel: "Under appeal" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: "Decide the appeal" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Decide it" }),
    ).not.toBeInTheDocument();
  });

  it("says plainly when a case is finished rather than showing dead buttons", async () => {
    give({ status: "closed", statusLabel: "Closed" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    expect(
      await screen.findByText(/This case is finished/),
    ).toBeInTheDocument();
  });
});

describe("putting the allegation", () => {
  it("sends what was written", async () => {
    serveAllegation.mockResolvedValue(CASE);

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Put the allegation" }),
    );
    await userEvent.type(
      screen.getByLabelText("The allegation"),
      "Late on 3, 5 and 9 September.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    await waitFor(() =>
      expect(serveAllegation).toHaveBeenCalledWith(
        "c-1",
        "Late on 3, 5 and 9 September.",
      ),
    );
  });

  /* "Poor attitude" is not something anybody can defend themselves against. */
  it("says an allegation has to be specific enough to answer", async () => {
    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Put the allegation" }),
    );

    expect(
      screen.getByText(/is not something anybody can defend themselves against/),
    ).toBeInTheDocument();
  });
});

describe("deciding it", () => {
  async function openDecide(overrides: Partial<RelationsCase> = {}) {
    give({ status: "investigating", statusLabel: "Investigating", ...overrides });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Decide it" }),
    );
  }

  /*
    The one that matters most. A pre-filled outcome is the software deciding,
    and it is not a decision anybody can defend at an appeal.
  */
  it("starts with no outcome chosen", async () => {
    await openDecide();

    expect(comboboxValue(screen.getByLabelText("Outcome"))).toBe("");
  });

  it("offers only the outcomes that fit a disciplinary", async () => {
    await openDecide();

    const outcomes = await openCombobox(userEvent.setup(), screen.getByLabelText("Outcome"));

    expect(outcomes).toHaveTextContent("Final written warning");
    // A disciplinary is not "upheld", that is a grievance word.
    expect(outcomes).not.toHaveTextContent("Partly upheld");
  });

  it("offers only the outcomes that fit a grievance", async () => {
    await openDecide({ kind: "grievance", kindLabel: "Grievance" });

    const outcomes = await openCombobox(userEvent.setup(), screen.getByLabelText("Outcome"));

    expect(outcomes).toHaveTextContent("Partly upheld");
    expect(outcomes).not.toHaveTextContent("Final written warning");
  });

  /*
    Six months and two years are different acts. Putting it on the form beats
    a policy document nobody has open.
  */
  it("asks how long a warning counts for, defaulted to the usual term", async () => {
    await openDecide();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Outcome"), "Written warning");

    expect(comboboxValue(screen.getByLabelText("Counts for"))).toBe("12");
  });

  /* Asking how long "no case to answer" lasts is a nonsense question. */
  it("does not ask about a lifespan for an outcome that leaves no record", async () => {
    await openDecide();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Outcome"), "No case to answer");

    expect(screen.queryByLabelText("Counts for")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nothing goes on their record/),
    ).toBeInTheDocument();
  });

  /* Dismissing somebody on a case does not end their employment record. */
  it("says a dismissal still has to be recorded as a departure", async () => {
    await openDecide();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Outcome"), "Dismissal");

    expect(
      screen.getByText(/Record the departure on the Leavers board/),
    ).toBeInTheDocument();
  });

  it("sends the outcome, the reasons and the lifespan", async () => {
    decide.mockResolvedValue(CASE);

    await openDecide();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Outcome"), "Verbal warning");
    await userEvent.type(
      screen.getByLabelText("Reasons"),
      "Three unexplained late starts.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Decide" }));

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith("c-1", {
        outcome: "verbal_warning",
        reason: "Three unexplained late starts.",
        decidedById: null,
        lifespanMonths: 6,
      }),
    );
  });

  it("will not decide without reasons", async () => {
    await openDecide();

    await chooseOption(userEvent.setup(), screen.getByLabelText("Outcome"), "Verbal warning");

    expect(screen.getByRole("button", { name: "Decide" })).toBeDisabled();
  });
});

describe("the hearing", () => {
  /*
    Somebody deciding on findings they gathered themselves is the commonest
    procedural failure there is, so the screen says it rather than leaving it
    to whoever happens to know.
  */
  it("warns against the investigator hearing their own case", async () => {
    give({ status: "investigating", statusLabel: "Investigating" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Schedule a hearing" }),
    );

    expect(
      screen.getByText(/Not the investigator/),
    ).toBeInTheDocument();
  });

  /*
    A right in almost every policy, and the failure mode is forgetting rather
    than refusing, so it starts ticked and is recorded either way.
  */
  it("offers the companion by default and records it either way", async () => {
    scheduleHearing.mockResolvedValue(CASE);
    give({ status: "investigating", statusLabel: "Investigating" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Schedule a hearing" }),
    );

    const companion = screen.getByLabelText(
      /They were told they can be accompanied/,
    );
    expect(companion).toBeChecked();

    await userEvent.type(screen.getByLabelText("When"), "2026-10-01T10:00");
    await userEvent.click(companion);
    await userEvent.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() =>
      expect(scheduleHearing).toHaveBeenCalledWith(
        "c-1",
        expect.objectContaining({ companionOffered: false }),
      ),
    );
  });
});

describe("the appeal", () => {
  it("shows what they actually said before asking for a decision", async () => {
    give({
      status: "under_appeal",
      statusLabel: "Under appeal",
      appealGrounds: "The shifts were swapped with my manager's agreement.",
    });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Decide the appeal" }),
    );

    expect(
      screen.getAllByText(/swapped with my manager's agreement/).length,
    ).toBeGreaterThan(0);
  });

  /* An appeal heard by the person who decided it is not an appeal. */
  it("says who may not hear it", async () => {
    give({ status: "under_appeal", statusLabel: "Under appeal" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Decide the appeal" }),
    );

    expect(
      screen.getByText(/had no part in the original decision/),
    ).toBeInTheDocument();
  });

  it("sends whether it was upheld", async () => {
    decideAppeal.mockResolvedValue(CASE);
    give({ status: "under_appeal", statusLabel: "Under appeal" });

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Decide the appeal" }),
    );
    await chooseOption(
      userEvent.setup(),
      screen.getByLabelText("The appeal is"),
      "Upheld: the outcome does not stand",
    );
    await userEvent.type(
      screen.getByLabelText("Reasons"),
      "The rota change was agreed.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(decideAppeal).toHaveBeenCalledWith("c-1", {
        upheld: true,
        reason: "The rota change was agreed.",
        appealHeardById: null,
      }),
    );
  });
});

describe("withdrawing", () => {
  /*
    Withdrawing is not deciding, and the difference is somebody's record. The
    reason is required precisely because nothing else is left behind.
  */
  it("says nothing goes on anybody's record, and requires a reason", async () => {
    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Withdraw" }),
    );

    /*
      Scoped to the dialog: the step button behind it carries the same name,
      which is fine for a modal but ambiguous for a query.
    */
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByText(/counts towards no future escalation/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Withdraw" }),
    ).toBeDisabled();
  });
});

describe("when a step is refused", () => {
  /*
    The refusals here are the interesting part, "the allegation has not been
    put to them yet" is the process working. A form that closed on the error
    would lose what somebody wrote and tell them nothing.
  */
  it("keeps the form open and shows what the service said", async () => {
    serveAllegation.mockRejectedValue(
      new Error("That case has already been decided."),
    );

    render(<CaseWorkflow caseId="c-1" onChanged={vi.fn()} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Put the allegation" }),
    );
    await userEvent.type(screen.getByLabelText("The allegation"), "Late again.");
    await userEvent.click(screen.getByRole("button", { name: "Record it" }));

    expect(
      await screen.findByText("That case has already been decided."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("The allegation")).toHaveValue("Late again.");
  });
});
