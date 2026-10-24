import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyCases from "./MyCases";
import type { MyCase } from "@/lib/api/hrm-client";

/**
 * Somebody's own disciplinaries and grievances.
 *
 * The screen exists to close a hole the module had from the day the case
 * routes were written: they all sit behind HR's keys (`access:hrm` now,
 * `designation:hrm.manager` before phase 3a), so the
 * only way to raise a grievance was to ask HR to file it, routing every
 * confidential complaint through the function a grievance is most often about.
 *
 * So the things worth pinning here are not layout. They are the promises:
 *
 * - **Anonymity is offered, and its cost is stated.** A checkbox labelled
 *   "anonymous" with no explanation gets used by people who then wonder why
 *   nobody came back to them, and avoided by people who needed it.
 * - **Appeal appears only when the window is open.** The API decides; the
 *   screen must not invent a deadline of its own.
 * - **A live warning says when it stops counting.** It is the fact people most
 *   often do not know about their own record.
 */

const { list, get, raise, appeal } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  raise: vi.fn(),
  appeal: vi.fn(),
}));

// DataView reads the app router to open rows; there is none under jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/me",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { myCases: { list, get, raise, appeal } } };
});

const CASE: MyCase = {
  id: "c-1",
  reference: "DIS-0007",
  kind: "disciplinary",
  kindLabel: "Disciplinary",
  status: "decided",
  statusLabel: "Decided",
  summary: "Repeated late starts",
  openedOn: "2026-08-01",
  outcome: "written_warning",
  outcomeLabel: "Written warning",
  outcomeOn: "2026-08-20",
  warningExpiresOn: "2027-02-20",
  hasLiveWarning: true,
  isAppealable: true,
  appealedAt: null,
};

function give(rows: MyCase[]) {
  list.mockResolvedValue(rows);
}

beforeEach(() => {
  vi.clearAllMocks();
  give([]);
});

describe("raising a grievance", () => {
  /*
    The whole reason the screen exists. If this button ever disappears behind a
    role check, the feature is shipped and unusable again.
  */
  it("is offered to anybody, with no role in the way", async () => {
    render(<MyCases />);

    expect(
      await screen.findByRole("button", { name: "Raise a grievance" }),
    ).toBeInTheDocument();
  });

  it("says where it goes, because the fear is that it goes to your manager", async () => {
    render(<MyCases />);

    expect(
      await screen.findByText(/goes to HR, not to your manager/),
    ).toBeInTheDocument();
  });

  it("sends what was typed", async () => {
    raise.mockResolvedValue(CASE);

    render(<MyCases />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Raise a grievance" }),
    );
    await userEvent.type(
      screen.getByLabelText("What is the problem"),
      "Rota changed without notice",
    );
    await userEvent.type(
      screen.getByLabelText("What happened"),
      "Three times in August.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send it" }));

    await waitFor(() =>
      expect(raise).toHaveBeenCalledWith({
        summary: "Rota changed without notice",
        detail: "Three times in August.",
        anonymous: false,
      }),
    );
  });

  /*
    Offered plainly rather than buried, and the cost said out loud. Somebody
    reporting an unsafe ward run by their own manager needs this, and a form
    that makes it look like an unusual request gets no report at all.
  */
  it("offers anonymity and states what it costs", async () => {
    render(<MyCases />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Raise a grievance" }),
    );

    expect(screen.getByLabelText(/Do not attach my name/)).toBeInTheDocument();
    expect(
      screen.getByText(/may not be able to come back to you for more detail/),
    ).toBeInTheDocument();
  });

  it("passes anonymity through rather than quietly naming them", async () => {
    raise.mockResolvedValue(CASE);

    render(<MyCases />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Raise a grievance" }),
    );
    await userEvent.type(
      screen.getByLabelText("What is the problem"),
      "Unsafe staffing on nights",
    );
    await userEvent.click(screen.getByLabelText(/Do not attach my name/));
    await userEvent.click(screen.getByRole("button", { name: "Send it" }));

    await waitFor(() =>
      expect(raise).toHaveBeenCalledWith(
        expect.objectContaining({ anonymous: true }),
      ),
    );
    // Typing a sentence under jsdom on a busy machine: slow, not stuck.
  }, 20_000);

  /* An empty grievance is not a grievance. */
  it("will not send an empty one", async () => {
    render(<MyCases />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Raise a grievance" }),
    );

    expect(screen.getByRole("button", { name: "Send it" })).toBeDisabled();
  });
});

describe("the list", () => {
  it("says plainly when there is nothing rather than showing an empty table", async () => {
    render(<MyCases />);

    expect(await screen.findByText("Nothing open")).toBeInTheDocument();
  });

  it("shows a case with its reference and what it is about", async () => {
    give([CASE]);

    render(<MyCases />);

    expect(
      await screen.findByText("DIS-0007 · Repeated late starts"),
    ).toBeInTheDocument();
  });

  /*
    The fact people most often do not know about their own record: a warning
    stops counting on a date, and after it nothing escalates from it.
  */
  it("says when a live warning stops counting", async () => {
    give([CASE]);

    render(<MyCases />);

    expect(
      await screen.findByText(/stops counting on 20 Feb 2027/),
    ).toBeInTheDocument();
  });

  it("shows the outcome rather than the status once there is one", async () => {
    give([CASE]);

    render(<MyCases />);

    expect(await screen.findByText("Written warning")).toBeInTheDocument();
    expect(screen.queryByText("Decided")).not.toBeInTheDocument();
  });
});

describe("appealing", () => {
  it("offers an appeal while the window is open", async () => {
    give([CASE]);

    render(<MyCases />);

    expect(
      await screen.findByRole("button", { name: "Appeal this" }),
    ).toBeInTheDocument();
  });

  /*
    The API owns the deadline. A screen that worked it out from `outcomeOn`
    would drift the day the policy changed, and offering an appeal that will be
    refused is worse than not offering one.
  */
  it("does not offer one once the window has closed", async () => {
    give([{ ...CASE, isAppealable: false }]);

    render(<MyCases />);

    await screen.findByText("DIS-0007 · Repeated late starts");

    expect(
      screen.queryByRole("button", { name: "Appeal this" }),
    ).not.toBeInTheDocument();
  });

  it("sends the grounds", async () => {
    give([CASE]);
    appeal.mockResolvedValue({ ...CASE, appealedAt: "2026-08-25T09:00:00+00:00" });

    render(<MyCases />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Appeal this" }),
    );
    await userEvent.type(
      screen.getByLabelText("Why you are appealing"),
      "The shifts were swapped with my manager's agreement.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Appeal" }));

    await waitFor(() =>
      expect(appeal).toHaveBeenCalledWith(
        "c-1",
        "The shifts were swapped with my manager's agreement.",
      ),
    );
    // Typing a sentence under jsdom on a busy machine: slow, not stuck.
  }, 20_000);

  it("says an appeal is already in rather than offering a second one", async () => {
    give([{ ...CASE, isAppealable: false, appealedAt: "2026-08-25T09:00:00+00:00" }]);

    render(<MyCases />);

    expect(
      await screen.findByText(/You appealed on 25 Aug 2026/),
    ).toBeInTheDocument();
  });
});

describe("when it does not load", () => {
  it("says so instead of showing an empty list", async () => {
    list.mockRejectedValue(new Error("Network is down."));

    render(<MyCases />);

    expect(await screen.findByText("That did not load")).toBeInTheDocument();
    expect(screen.getByText("Network is down.")).toBeInTheDocument();
  });
});

/*
  H14: the list carries only the outcome's name. The reasons were returned by
  the case endpoint and never shown; reading the decision now loads them.
*/
describe("reading the decision", () => {
  it("loads the case and shows why, and what became of the appeal", async () => {
    const user = userEvent.setup();

    give([{ ...CASE, isAppealable: false, appealedAt: "2026-08-25T09:00:00Z" }]);
    get.mockResolvedValue({
      ...CASE,
      isAppealable: false,
      appealedAt: "2026-08-25T09:00:00Z",
      outcomeReason: "Late on six shifts after a verbal warning.",
      appealGrounds: "Two were covered by approved swaps.",
      appealOutcome: "dismissed",
      appealReason: "The swaps were approved after the shifts.",
      events: [{ id: "ev-1", kind: "outcome_issued", note: null, occurredAt: "2026-08-20T10:00:00Z" }],
    });

    render(<MyCases />);

    const buttons = await screen.findAllByRole("button", { name: "Read the decision" });
    await user.click(buttons[0]);

    expect(await screen.findByText("Late on six shifts after a verbal warning.")).toBeInTheDocument();
    expect(screen.getByText("Dismissed: the decision stands.")).toBeInTheDocument();
    expect(screen.getByText("Outcome issued")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("c-1");
  });

  it("is not offered before there is a decision", async () => {
    give([{ ...CASE, outcome: null, outcomeLabel: null, outcomeOn: null, isAppealable: false, status: "open" }]);

    render(<MyCases />);

    await screen.findAllByText(/Repeated late starts/);
    expect(screen.queryByRole("button", { name: "Read the decision" })).not.toBeInTheDocument();
  });
});
