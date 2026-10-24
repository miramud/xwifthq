import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationPanel from "./ApplicationPanel";
import { primeJobTitlesCache } from "@/lib/api/job-titles-client";
import { chooseOption } from "@/test/selectOption";
import type {
  Employee,
  JobApplication,
  PipelineStage,
  StageEvent,
} from "@/lib/api/hrm-client";

/**
 * The drawer where a candidate is actually worked.
 *
 * Everything in here was built in tranche 5 and had no way to be reached. What
 * is worth pinning is the shape of the decisions rather than the layout:
 * turning somebody down takes a reason and withdrawing does not, terminal
 * stages are not offered as somewhere to move, and an offer only shows the
 * action its current state allows.
 */

const {
  application,
  moveApplication,
  scheduleInterview,
  draftOffer,
  updateOffer,
  scorecards,
  updateInterview,
} = vi.hoisted(() => ({
  application: vi.fn(),
  moveApplication: vi.fn(),
  scheduleInterview: vi.fn(),
  draftOffer: vi.fn(),
  updateOffer: vi.fn(),
  scorecards: vi.fn(),
  updateInterview: vi.fn(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: {
      recruitment: {
        application,
        moveApplication,
        scheduleInterview,
        draftOffer,
        updateOffer,
        scorecards,
        updateInterview,
      },
    },
  };
});

const STAGES: PipelineStage[] = [
  {
    id: "st-1",
    name: "Applied",
    kind: "applied",
    kindLabel: "Applied",
    position: 1,
    colour: null,
    isTerminal: false,
    staleAfterDays: null,
    isActive: true,
  },
  {
    id: "st-2",
    name: "Screening",
    kind: "screening",
    kindLabel: "Screening",
    position: 2,
    colour: null,
    isTerminal: false,
    staleAfterDays: 7,
    isActive: true,
  },
  {
    id: "st-9",
    name: "Rejected",
    kind: "rejected",
    kindLabel: "Rejected",
    position: 9,
    colour: null,
    isTerminal: true,
    staleAfterDays: null,
    isActive: true,
  },
];

const COLLEAGUES = [
  { id: "emp-1", person: { name: "Ada Lovelace" } },
  { id: "emp-2", person: { name: "Grace Hopper" } },
] as unknown as Employee[];

const APPLICATION: JobApplication = {
  id: "app-1",
  candidateId: "cand-1",
  requisitionId: "req-1",
  postingId: null,
  stageId: "st-1",
  status: "active",
  statusLabel: "In progress",
  isOpen: true,
  source: "referral",
  sourceLabel: "Referral",
  appliedAt: "2026-09-20T09:00:00+00:00",
  stageChangedAt: "2026-09-20T09:00:00+00:00",
  daysInStage: 3,
  isStale: false,
  rating: null,
  coverNote: null,
  rejectionReason: null,
  closedAt: null,
  daysToClose: null,
  candidate: {
    id: "cand-1",
    name: "Alan Turing",
    email: "alan@example.test",
    currentTitle: "Engineer",
  },
  stage: { id: "st-1", name: "Applied", kind: "applied", colour: null },
  requisition: { id: "req-1", reference: "REQ-001", jobTitle: "Analyst" },
  interviews: [],
  offers: [],
};

const HISTORY: StageEvent[] = [
  {
    id: "ev-1",
    stage: "Applied",
    kind: "applied",
    daysInPrevious: null,
    movedBy: "Hr Manager",
    note: null,
    at: "2026-09-20T09:00:00+00:00",
  },
];

function detail(overrides: Partial<JobApplication> = {}) {
  return {
    data: { ...APPLICATION, ...overrides },
    meta: { history: HISTORY },
  };
}

function setup(overrides: Partial<JobApplication> = {}) {
  application.mockResolvedValue(detail(overrides));

  const onChanged = vi.fn();

  render(
    <ApplicationPanel
      applicationId="app-1"
      stages={STAGES}
      colleagues={COLLEAGUES}
      onClose={vi.fn()}
      onChanged={onChanged}
    />,
  );

  return { onChanged, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  moveApplication.mockResolvedValue(APPLICATION);
  scheduleInterview.mockResolvedValue({});
  draftOffer.mockResolvedValue({});
  updateOffer.mockResolvedValue({ data: {} });
  scorecards.mockResolvedValue({ data: [], meta: { outstanding: 0, weight: 0 } });
  updateInterview.mockResolvedValue({});
});

describe("ApplicationPanel", () => {
  it("shows who the candidate is and where they are", async () => {
    setup();

    expect(await screen.findByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/Referral/)).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  /*
    A terminal stage is an outcome, not somewhere to drag somebody. Rejecting
    takes a reason, which a stage button cannot ask for.
  */
  it("does not offer terminal stages as somewhere to move", async () => {
    setup();

    await screen.findByText("Move to");

    expect(screen.getByRole("button", { name: /Screening/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Rejected/ }),
    ).not.toBeInTheDocument();
  });

  it("does not offer the stage they are already in", async () => {
    setup();

    await screen.findByText("Move to");

    expect(screen.queryByRole("button", { name: /Applied/ })).not.toBeInTheDocument();
  });

  it("moves somebody to another stage", async () => {
    const { user, onChanged } = setup();

    await user.click(await screen.findByRole("button", { name: /Screening/ }));

    await waitFor(() =>
      expect(moveApplication).toHaveBeenCalledWith("app-1", {
        action: "move",
        stageId: "st-2",
      }),
    );

    expect(onChanged).toHaveBeenCalled();
  });

  /* They are owed a reason, and the API insists on one. */
  it("asks why before turning somebody down", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Turn down" }));

    const dialog = await screen.findByRole("dialog", { name: "Turn down" });

    expect(
      within(dialog).getByText(/They are owed a reason/),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByRole("textbox"),
      "Not enough experience.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Turn down" }));

    await waitFor(() =>
      expect(moveApplication).toHaveBeenCalledWith("app-1", {
        action: "reject",
        reason: "Not enough experience.",
      }),
    );
  });

  /*
    Withdrawing is what the candidate did, not what we decided, so it takes
    no reason from us and is not counted as a rejection anywhere.
  */
  it("records a withdrawal without asking us for a reason", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "They withdrew" }));

    await waitFor(() =>
      expect(moveApplication).toHaveBeenCalledWith("app-1", {
        action: "withdraw",
      }),
    );
  });

  it("offers nothing to do on a closed candidacy", async () => {
    setup({
      status: "rejected",
      statusLabel: "Rejected",
      isOpen: false,
      rejectionReason: "Not enough experience.",
    });

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByText("Move to")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Turn down" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Not enough experience.")).toBeInTheDocument();
  });

  describe("interviews", () => {
    it("says who leads a panel before it is arranged", async () => {
      const { user } = setup();

      await user.click(
        await screen.findByRole("button", { name: "Arrange interview" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: "Arrange interview",
      });

      expect(
        within(dialog).getByText("The first person you pick leads it."),
      ).toBeInTheDocument();
    });

    it("sends the panel with the first person as lead", async () => {
      const { user } = setup();

      await user.click(
        await screen.findByRole("button", { name: "Arrange interview" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: "Arrange interview",
      });

      await user.type(
        within(dialog).getByLabelText("When"),
        "2026-09-25T14:00",
      );
      await user.click(within(dialog).getByLabelText("Ada Lovelace"));
      await user.click(within(dialog).getByLabelText("Grace Hopper"));
      await user.click(within(dialog).getByRole("button", { name: "Arrange" }));

      await waitFor(() =>
        expect(scheduleInterview).toHaveBeenCalledWith(
          "app-1",
          expect.objectContaining({
            panel: [
              { employeeId: "emp-1", isLead: true },
              { employeeId: "emp-2", isLead: false },
            ],
          }),
        ),
      );
    });
  });

  describe("offers", () => {
    it("says the salary has to sit inside the approved band", async () => {
      const { user } = setup();

      await user.click(await screen.findByRole("button", { name: "Make an offer" }));

      const dialog = await screen.findByRole("dialog", { name: "Make an offer" });

      expect(
        within(dialog).getByText(/inside the band the role was approved for/),
      ).toBeInTheDocument();
    });

    /* Typed in naira because that is what an offer letter says. */
    it("converts the salary to kobo on the way out", async () => {
      const { user } = setup();

      await user.click(await screen.findByRole("button", { name: "Make an offer" }));

      const dialog = await screen.findByRole("dialog", { name: "Make an offer" });

      await user.type(within(dialog).getByLabelText(/Salary/), "5000000");
      await user.click(within(dialog).getByRole("button", { name: "Draft offer" }));

      await waitFor(() =>
        expect(draftOffer).toHaveBeenCalledWith(
          "app-1",
          expect.objectContaining({ salaryKobo: 500_000_000 }),
        ),
      );
    });

    /* The title comes from the organisation's list, starting from the role's. */
    it("offers the role's title, or another from the organisation's list", async () => {
      primeJobTitlesCache([
        { id: "t-1", key: "analyst", name: "Analyst", position: 1, isActive: true, peopleCount: 0 },
        { id: "t-2", key: "senior-analyst", name: "Senior Analyst", position: 2, isActive: true, peopleCount: 0 },
      ]);
      const { user } = setup();

      await user.click(await screen.findByRole("button", { name: "Make an offer" }));
      const dialog = await screen.findByRole("dialog", { name: "Make an offer" });
      const title = within(dialog).getByRole("combobox", { name: "Job title" });
      expect(title).toHaveTextContent("Analyst");

      await chooseOption(user, title, "Senior Analyst");
      await user.type(within(dialog).getByLabelText(/Salary/), "100");
      await user.click(within(dialog).getByRole("button", { name: "Draft offer" }));

      await waitFor(() =>
        expect(draftOffer).toHaveBeenCalledWith("app-1", expect.objectContaining({ jobTitle: "Senior Analyst" })),
      );
    });

    /* Only the action the current state allows, so nothing promises a 422. */
    it("offers only the next step an offer can take", async () => {
      setup({
        offers: [
          {
            id: "off-1",
            applicationId: "app-1",
            jobTitle: "Analyst",
            department: null,
            employmentType: "permanent",
            employmentTypeLabel: "Permanent",
            salaryKobo: 500_000_000,
            salaryPeriod: "year",
            signingBonusKobo: null,
            startsOn: null,
            expiresOn: null,
            hasLapsed: false,
            status: "draft",
            statusLabel: "Draft",
            isOpen: true,
            isWithCandidate: false,
            isAccepted: false,
            terms: null,
            notes: null,
            approvedAt: null,
            sentAt: null,
            respondedAt: null,
            responseNote: null,
            daysToRespond: null,
            employeeId: null,
          },
        ],
      });

      expect(
        await screen.findByRole("button", { name: "Send for approval" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Send to candidate" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "They accepted" }),
      ).not.toBeInTheDocument();
    });

    /*
      The status still reads "with the candidate" until somebody tries to
      accept it, so the screen has to say it has lapsed rather than wait.
    */
    it("says an offer has lapsed even though its status has not moved", async () => {
      setup({
        offers: [
          {
            id: "off-2",
            applicationId: "app-1",
            jobTitle: "Analyst",
            department: null,
            employmentType: "permanent",
            employmentTypeLabel: "Permanent",
            salaryKobo: 500_000_000,
            salaryPeriod: "year",
            signingBonusKobo: null,
            startsOn: null,
            expiresOn: "2026-09-01",
            hasLapsed: true,
            status: "sent",
            statusLabel: "With the candidate",
            isOpen: true,
            isWithCandidate: true,
            isAccepted: false,
            terms: null,
            notes: null,
            approvedAt: null,
            sentAt: null,
            respondedAt: null,
            responseNote: null,
            daysToRespond: null,
            employeeId: null,
          },
        ],
      });

      expect(await screen.findByText(/This lapsed on/)).toBeInTheDocument();
    });
  });

  /* "They have been at screening since the 4th" answers most questions. */
  it("shows the history with how long each leg took", async () => {
    setup();

    expect(await screen.findByText("History")).toBeInTheDocument();
    expect(screen.getByText(/Hr Manager/)).toBeInTheDocument();
  });
});
