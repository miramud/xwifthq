import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyInterviews from "./MyInterviews";
import type {
  Interview,
  InterviewScorecard,
  PanelView,
} from "@/lib/api/hrm-client";

/**
 * Interviews I am on, and writing up what I thought.
 *
 * One behaviour matters more than everything else on this screen: until I
 * submit my own verdict, I must not see anybody else's. The first person to
 * write anything anchors everybody who reads it, and a panel that has read each
 * other's notes is one opinion wearing four names.
 *
 * The second is that the hidden state has to be *explained*. An empty list
 * reads as nobody else having bothered, which is a different and discouraging
 * message from "this opens once you commit".
 */

const { interviews, interview, submitScorecard } = vi.hoisted(() => ({
  interviews: vi.fn(),
  interview: vi.fn(),
  submitScorecard: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/me",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return {
    ...actual,
    hrm: { me: { interviews, interview, submitScorecard } },
  };
});

const INTERVIEW: Interview = {
  id: "iv-1",
  applicationId: "app-1",
  kind: "panel",
  kindLabel: "Panel",
  needsLocation: true,
  status: "completed",
  statusLabel: "Completed",
  isOpen: false,
  isUpcoming: false,
  scheduledAt: "2026-09-25T14:00:00+00:00",
  endsAt: "2026-09-25T15:00:00+00:00",
  durationMinutes: 60,
  location: "Lagos office",
  meetingUrl: null,
  agenda: "Systems design, then questions.",
  cancellationReason: null,
  scorecardsOutstanding: 1,
  panel: [
    {
      id: "p-1",
      employeeId: "emp-1",
      name: "Ada Lovelace",
      focus: "Technical",
      isLead: true,
    },
    {
      id: "p-2",
      employeeId: "emp-2",
      name: "Grace Hopper",
      focus: "Communication",
      isLead: false,
    },
  ],
  candidate: { id: "cand-1", name: "Alan Turing" },
};

const GRACES_VERDICT: InterviewScorecard = {
  id: "sc-2",
  interviewId: "iv-1",
  employeeId: "emp-2",
  verdict: "strong_no",
  verdictLabel: "Strong no",
  isPositive: false,
  weight: -2,
  ratings: null,
  averageRating: null,
  strengths: null,
  concerns: "Struggled with the design question.",
  notes: null,
  isSubmitted: true,
  submittedAt: "2026-09-25T16:00:00+00:00",
  interviewer: { id: "emp-2", name: "Grace Hopper", jobTitle: "Engineer" },
};

/** Nothing visible, because I have not written mine up. */
const HIDDEN: PanelView = {
  visible: false,
  scorecards: [],
  outstanding: 2,
  weight: null,
};

const VISIBLE: PanelView = {
  visible: true,
  scorecards: [GRACES_VERDICT],
  outstanding: 0,
  weight: -1,
};

function detail(panel: PanelView, mine: InterviewScorecard | null = null) {
  return { data: INTERVIEW, meta: { mine, panel } };
}

beforeEach(() => {
  vi.clearAllMocks();

  interviews.mockResolvedValue({
    data: [INTERVIEW],
    meta: { awaitingMyScorecard: 1, submittedInterviewIds: [] },
  });
  interview.mockResolvedValue(detail(HIDDEN));
  submitScorecard.mockResolvedValue({ ...GRACES_VERDICT, employeeId: "emp-1" });
});

describe("MyInterviews", () => {
  it("lists panels I am on with the candidate's name", async () => {
    render(<MyInterviews />);

    expect(await screen.findByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/Panel/)).toBeInTheDocument();
  });

  it("says plainly which ones are waiting on me", async () => {
    render(<MyInterviews />);

    expect(
      await screen.findByText("1 still waiting on your write-up"),
    ).toBeInTheDocument();
    expect(screen.getByText("Needs your verdict")).toBeInTheDocument();
  });

  it("marks the ones I have already written up", async () => {
    interviews.mockResolvedValue({
      data: [INTERVIEW],
      meta: { awaitingMyScorecard: 0, submittedInterviewIds: ["iv-1"] },
    });

    render(<MyInterviews />);

    expect(await screen.findByText("Written up")).toBeInTheDocument();
  });

  describe("the anchoring rule", () => {
    async function open() {
      const user = userEvent.setup();
      render(<MyInterviews />);

      await user.click(await screen.findByRole("button", { name: "Open" }));

      return user;
    }

    /*
      The behaviour the whole scorecard mechanism exists for. Showing Grace's
      strong no before Ada has written hers would shape what Ada writes.
    */
    it("hides the panel until I submit my own verdict", async () => {
      await open();

      expect(
        await screen.findByText("Hidden until you submit yours"),
      ).toBeInTheDocument();

      /*
        Asserted on Grace's own words rather than on her verdict label: "Strong
        no" is also one of the four buttons on my own form, so its presence
        says nothing about whether hers has leaked.
      */
      expect(
        screen.queryByText(/Struggled with the design/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Grace Hopper")).toBeInTheDocument();
    });

    /*
      An empty list would read as nobody else having bothered. The reason has
      to be on the screen.
    */
    it("explains why it is hidden rather than showing nothing", async () => {
      await open();

      expect(
        await screen.findByText(
          /Reading your colleagues' verdicts first would shape your own/,
        ),
      ).toBeInTheDocument();
    });

    it("opens the panel once mine is in", async () => {
      interview.mockResolvedValue(
        detail(VISIBLE, { ...GRACES_VERDICT, id: "sc-1", employeeId: "emp-1" }),
      );

      await open();

      /*
        Scoped to the panel card. Grace is also listed as a panel member, so an
        unscoped query matches whether or not her verdict is visible — which is
        exactly the thing under test.
      */
      const card = (
        await screen.findByText("What the others said")
      ).closest("section") as HTMLElement;

      expect(within(card).getByText("Grace Hopper")).toBeInTheDocument();
      expect(within(card).getByText("Strong no")).toBeInTheDocument();
      expect(
        within(card).getByText(/Struggled with the design/),
      ).toBeInTheDocument();
    });
  });

  describe("writing a verdict", () => {
    async function openForm() {
      const user = userEvent.setup();
      render(<MyInterviews />);

      await user.click(await screen.findByRole("button", { name: "Open" }));
      await screen.findByRole("button", { name: /Strong yes/ });

      return user;
    }

    /*
      There is deliberately no middle option, and the form says so rather than
      leaving somebody hunting for one.
    */
    it("offers four verdicts and no neutral one", async () => {
      await openForm();

      for (const label of ["Strong yes", "Yes", "No", "Strong no"]) {
        expect(
          screen.getByRole("button", { name: new RegExp(label) }),
        ).toBeInTheDocument();
      }

      expect(screen.queryByRole("button", { name: /Maybe/ })).not.toBeInTheDocument();
      expect(
        screen.getByText(/no middle option on purpose/),
      ).toBeInTheDocument();
    });

    it("refuses to submit without a verdict", async () => {
      const user = await openForm();

      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(
        await screen.findByText(/There is deliberately no middle option/),
      ).toBeInTheDocument();
      expect(submitScorecard).not.toHaveBeenCalled();
    });

    it("submits as final by default", async () => {
      const user = await openForm();

      await user.click(screen.getByRole("button", { name: /Strong yes/ }));
      await user.type(
        screen.getByLabelText("Strengths"),
        "Clear thinker.",
      );
      await user.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() =>
        expect(submitScorecard).toHaveBeenCalledWith(
          "iv-1",
          expect.objectContaining({
            verdict: "strong_yes",
            strengths: "Clear thinker.",
            draft: false,
          }),
        ),
      );
    });

    /* A draft stays private and changeable; submitting is final. */
    it("saves a draft without committing", async () => {
      const user = await openForm();

      await user.click(screen.getByRole("button", { name: /^Yes/ }));
      await user.click(screen.getByRole("button", { name: "Save draft" }));

      await waitFor(() =>
        expect(submitScorecard).toHaveBeenCalledWith(
          "iv-1",
          expect.objectContaining({ verdict: "yes", draft: true }),
        ),
      );
    });

    it("shows a submitted verdict as fixed rather than editable", async () => {
      interview.mockResolvedValue(
        detail(VISIBLE, { ...GRACES_VERDICT, id: "sc-1", employeeId: "emp-1" }),
      );

      const user = userEvent.setup();
      render(<MyInterviews />);

      await user.click(await screen.findByRole("button", { name: "Open" }));

      const card = (await screen.findByText("Your verdict")).closest(
        "div",
      )?.parentElement as HTMLElement;

      expect(
        within(card).queryByRole("button", { name: "Submit" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(/A verdict that can be changed after the panel convenes/),
      ).toBeInTheDocument();
    });
  });

  it("shows what each interviewer is there to assess", async () => {
    const user = userEvent.setup();
    render(<MyInterviews />);

    await user.click(await screen.findByRole("button", { name: "Open" }));

    // A panel where everybody covers everything agrees with itself.
    expect(await screen.findByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
  });
});
