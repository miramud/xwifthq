import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import WarningsPanel from "./WarningsPanel";
import type { LiveWarning } from "@/lib/api/hrm-client";

/**
 * What is live on somebody's disciplinary record.
 *
 * The register had an endpoint and no screen, so the question the whole ladder
 * rests on, "is there already something on this person's record?", could
 * only be answered by reading the caseload and working out expiry dates by
 * hand. People answer that sort of question from memory instead, and memory
 * does not expire on a date.
 *
 * Three promises, and they are what the tests are for.
 *
 * **A clean record is stated in words.** Somebody about to issue a warning
 * needs the difference between "nothing on file" and "this did not load", and
 * an empty panel says both.
 *
 * **The expiry is the headline figure**, because how much longer a warning
 * counts is what a decision-maker actually needs from it.
 *
 * **The ladder's suggestion is advice and says so.** It reads the register; it
 * knows nothing about the mitigation offered at the hearing, and a screen that
 * presents it as the answer makes the hearing decorative.
 */

const { warningsFor } = vi.hoisted(() => ({ warningsFor: vi.fn() }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();

  return { ...actual, hrm: { relations: { warningsFor } } };
});

const WARNING = {
  id: "c-1",
  reference: "DIS-0007",
  kind: "disciplinary",
  kindLabel: "Disciplinary",
  category: null,
  status: "decided",
  statusLabel: "Decided",
  summary: "Repeated late starts",
  openedOn: "2026-08-01",
  ageInDays: 50,
  subjectId: "e-1",
  subjectName: "Ada Lovelace",
  raisedByName: "HR",
  outcome: "written_warning",
  outcomeLabel: "Written warning",
  outcomeOn: "2026-08-20",
  hasLiveWarning: true,
  warningExpiresOn: "2027-02-20",
  isAppealable: false,
  appealedAt: null,
  daysToResolve: 19,
  expiresOn: "2027-02-20",
  daysUntilExpiry: 153,
} as LiveWarning;

function give(data: LiveWarning[], suggestedNextStepLabel: string | null = null) {
  warningsFor.mockResolvedValue({
    data,
    meta: { suggestedNextStep: null, suggestedNextStepLabel },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  give([]);
});

describe("a clean record", () => {
  it("says so rather than leaving a blank", async () => {
    render(<WarningsPanel employeeId="e-1" />);

    expect(
      await screen.findByText("Nothing live on this record."),
    ).toBeInTheDocument();
  });
});

describe("a live warning", () => {
  it("leads with the outcome, not the case reference", async () => {
    give([WARNING]);

    render(<WarningsPanel employeeId="e-1" />);

    expect(await screen.findByText("Written warning")).toBeInTheDocument();
    expect(
      screen.getByText("DIS-0007 · Repeated late starts"),
    ).toBeInTheDocument();
  });

  /*
    The figure a decision-maker needs is how much longer it counts, not when it
    was issued.
  */
  it("says how long is left and when it stops counting", async () => {
    give([WARNING]);

    render(<WarningsPanel employeeId="e-1" />);

    expect(await screen.findByText("153d left")).toBeInTheDocument();
    expect(
      screen.getByText("Stops counting 20 Feb 2027"),
    ).toBeInTheDocument();
  });

  it("says plainly when a warning was issued with no expiry", async () => {
    give([{ ...WARNING, expiresOn: null, daysUntilExpiry: null }]);

    render(<WarningsPanel employeeId="e-1" />);

    expect(await screen.findByText("No expiry set")).toBeInTheDocument();
  });
});

describe("what the ladder suggests", () => {
  /*
    Presenting this as the answer would make a hearing a formality. It is
    stated as advice and its blind spot is stated with it.
  */
  it("frames the next step as advice from the register", async () => {
    give([WARNING], "Final written warning");

    render(<WarningsPanel employeeId="e-1" />);

    expect(
      await screen.findByText("Usually next: Final written warning."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nothing about what was said at the hearing/),
    ).toBeInTheDocument();
  });

  it("offers nothing when the ladder has nothing to say", async () => {
    give([WARNING], null);

    render(<WarningsPanel employeeId="e-1" />);

    await screen.findByText("Written warning");

    expect(screen.queryByText(/Usually next/)).not.toBeInTheDocument();
  });
});

describe("when the register does not load", () => {
  /*
    The dangerous failure. A panel that renders empty on an error tells
    somebody about to issue a warning that the record is clean.
  */
  it("says the record is unknown rather than showing it as clean", async () => {
    warningsFor.mockRejectedValue(new Error("Network is down."));

    render(<WarningsPanel employeeId="e-1" />);

    expect(
      await screen.findByText(/treat this record as unknown rather than clean/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing live on this record."),
    ).not.toBeInTheDocument();
  });
});
