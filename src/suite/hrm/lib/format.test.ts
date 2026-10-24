import { describe, it, expect } from "vitest";
import {
  contractTone,
  conversionTone,
  countdownTone,
  employmentTone,
  formatCountdown,
  formatDate,
  formatDays,
  initials,
  leaveTone,
  naira,
  placementTone,
  probationTone,
  salary,
} from "./format";

/**
 * The HR module's display rules.
 *
 * Small functions, but each one encodes a decision that goes wrong silently:
 * a negative day count read as a positive one, kobo rendered as naira, a
 * leaver coloured like a failure. None of those throws, they just quietly
 * say the wrong thing on a screen somebody makes a decision from.
 */

describe("formatCountdown", () => {
  it("counts down in whole days", () => {
    expect(formatCountdown(14)).toBe("14 days");
    expect(formatCountdown(1)).toBe("1 day");
  });

  /*
    The important one. A raw negative beside a date is the single most misread
    thing on an expiry report, and the sign *is* the finding: somebody is
    working with no agreement covering them.
  */
  it("says overdue rather than showing a negative number", () => {
    expect(formatCountdown(-14)).toBe("14 days overdue");
    expect(formatCountdown(-1)).toBe("1 day overdue");
  });

  it("calls zero today rather than 0 days", () => {
    expect(formatCountdown(0)).toBe("Today");
  });

  it("renders an absent date as a dash, never as zero", () => {
    expect(formatCountdown(null)).toBe("-");
    expect(formatCountdown(undefined)).toBe("-");
  });
});

describe("countdownTone", () => {
  it("is red once the date has passed", () => {
    expect(countdownTone(-1)).toBe("error");
  });

  it("warms as the date approaches", () => {
    expect(countdownTone(7)).toBe("warning");
    expect(countdownTone(30)).toBe("info");
    expect(countdownTone(120)).toBe("neutral");
  });

  it("is neutral when nothing is scheduled to end", () => {
    expect(countdownTone(null)).toBe("neutral");
  });
});

describe("naira", () => {
  /*
    The API stores kobo, like every amount in the suite, because a float cannot
    hold a salary and be trusted to still hold it after arithmetic. The division
    happens in exactly one place, and this is what pins it there.
  */
  it("divides kobo into naira", () => {
    expect(naira(450_000_00)).toContain("450,000");
  });

  it("renders an unset amount as a dash rather than zero", () => {
    expect(naira(null)).toBe("-");
    expect(naira(undefined)).toBe("-");
  });

  it("renders a genuine zero as zero", () => {
    expect(naira(0)).toContain("0");
    expect(naira(0)).not.toBe("-");
  });
});

describe("salary", () => {
  it("names the period when there is one", () => {
    expect(salary(450_000_00, "month")).toContain("/ month");
  });

  it("omits the period when there is not", () => {
    expect(salary(450_000_00, null)).not.toContain("/");
  });

  it("is a dash when the amount is unset, whatever the period says", () => {
    expect(salary(null, "month")).toBe("-");
  });
});

describe("formatDate", () => {
  /*
    Day, abbreviated month, full year. Asserted by parts rather than as one
    string: Node's ICU data abbreviates September as "Sept" and some builds as
    "Sep", and pinning the exact abbreviation tests the platform rather than
    the format.
  */
  it("writes a short, unambiguous date", () => {
    const formatted = formatDate("2026-09-18");

    expect(formatted).toMatch(/^18 Sept? 2026$/);
    // The year is the part that matters most, a contract end date without one
    // is unreadable on an expiry report.
    expect(formatted).toContain("2026");
  });

  it("returns a dash for nothing, and for nonsense", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("")).toBe("-");
    expect(formatDate("not a date")).toBe("-");
  });
});

describe("initials", () => {
  it("takes the first two words", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Ada Byron King Lovelace")).toBe("AB");
  });

  it("copes with one name, and with none", () => {
    expect(initials("Ada")).toBe("A");
    expect(initials(null)).toBe("??");
    expect(initials("")).toBe("??");
  });
});

describe("tones", () => {
  /*
    Colour never carries meaning alone here, every pill also shows the label
    the API sent. What these assertions defend is consistency: the same status
    must not be amber on one screen and red on another, because that teaches
    the reader the colour means nothing.
  */
  it("colours a current employee by how settled they are", () => {
    expect(employmentTone("active")).toBe("success");
    expect(employmentTone("on_probation")).toBe("info");
    expect(employmentTone("onboarding")).toBe("primary");
  });

  /*
    Somebody whose fixed term finished has not gone wrong, and colouring a
    leaver red reads as a judgement on them. Termination is the one exit that
    is genuinely an exception.
  */
  it("does not colour an ordinary leaver as a failure", () => {
    expect(employmentTone("ended")).toBe("neutral");
    expect(employmentTone("resigned")).toBe("neutral");
    expect(employmentTone("terminated")).toBe("error");
  });

  it("marks an expired agreement as a warning and a terminated one as an error", () => {
    expect(contractTone("active")).toBe("success");
    expect(contractTone("expired")).toBe("warning");
    expect(contractTone("terminated")).toBe("error");
    // A renewed agreement is history, not a problem.
    expect(contractTone("renewed")).toBe("info");
  });

  it("treats an extended probation as a warning, not a pass", () => {
    expect(probationTone("confirmed")).toBe("success");
    expect(probationTone("extended")).toBe("warning");
    expect(probationTone("exited")).toBe("error");
    expect(probationTone("pending")).toBe("info");
  });

  it("keeps placement status and conversion outcome separately coloured", () => {
    expect(placementTone("completed")).toBe("success");
    expect(placementTone("withdrawn")).toBe("neutral");
    expect(conversionTone("converted")).toBe("success");
    // Declining an offer is not a failure of the programme, and not a success
    // either, it is its own answer.
    expect(conversionTone("declined")).toBe("warning");
    expect(conversionTone("not_converted")).toBe("neutral");
  });
});

describe("formatDays", () => {
  it("drops the trailing zero on a whole day", () => {
    expect(formatDays(2)).toBe("2 days");
    expect(formatDays(1)).toBe("1 day");
  });

  /*
    Half days are real and bookable, so the .5 has to survive. "2 days" where
    somebody booked two and a half is a quarter of a working day lost from a
    balance with no trace of where it went.
  */
  it("keeps the half", () => {
    expect(formatDays(2.5)).toBe("2.5 days");
    expect(formatDays(0.5)).toBe("0.5 days");
  });

  it("says zero rather than a dash, because nought days is an answer", () => {
    expect(formatDays(0)).toBe("0 days");
  });

  it("renders an absent figure as a dash", () => {
    expect(formatDays(null)).toBe("-");
    expect(formatDays(undefined)).toBe("-");
  });
});

describe("leaveTone", () => {
  it("separates a withdrawal from a recall", () => {
    /*
      The distinction the whole status enum exists for. Cancelled is the
      employee changing their mind and is unremarkable; recalled is the
      employer taking back leave it had already granted, which somebody may
      have to account for later. Giving them the same colour would merge two
      events that have to stay tellable apart.
    */
    expect(leaveTone("cancelled")).toBe("neutral");
    expect(leaveTone("recalled")).toBe("accent");
    expect(leaveTone("cancelled")).not.toBe(leaveTone("recalled"));
  });

  it("colours a decision by its outcome", () => {
    expect(leaveTone("approved")).toBe("success");
    expect(leaveTone("declined")).toBe("error");
    expect(leaveTone("pending")).toBe("warning");
  });
});
