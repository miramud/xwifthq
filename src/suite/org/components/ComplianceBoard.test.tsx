import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ComplianceBoard from "./ComplianceBoard";
import type { ComplianceReport } from "@/lib/api/admin-client";

/**
 * Who has not done the training they were told to do.
 *
 * Two distinctions carry the screen, and collapsing either is how a compliance
 * dashboard stops being read.
 *
 * **Outstanding is not overdue.** A course with a deadline in June is
 * outstanding and entirely fine. One whose date has passed is a finding. A
 * single merged number makes the board permanently red and therefore
 * permanently ignored.
 *
 * **Percentages are not the report.** What somebody does with this is work
 * through it person by person, so the overdue list names people and says how
 * late — and it downloads, because they will do it in a spreadsheet whether or
 * not we offer one.
 */

const { get, csvUrl } = vi.hoisted(() => ({
  get: vi.fn(),
  csvUrl: vi.fn(() => "/api/admin/compliance.csv"),
}));

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/api/admin-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin-client")>();

  return { ...actual, compliance: { get, csvUrl } };
});

const BASE: ComplianceReport = {
  asAt: "2026-09-23",
  totals: {
    people: 40,
    assignments: 60,
    complete: 48,
    outstanding: 12,
    overdue: 3,
    dueSoon: 5,
    peopleFullyCompliant: 34,
    compliancePercent: 85,
  },
  byCourse: [],
  byDepartment: [],
  overdueList: [],
};

function give(overrides: Partial<ComplianceReport>) {
  get.mockResolvedValue({ data: { ...BASE, ...overrides } });
}

beforeEach(() => {
  vi.clearAllMocks();
  give({});
});

describe("the headline", () => {
  /*
    Outstanding with a future deadline is the normal state of a healthy
    institution, not a problem. Merging it with overdue would make the board
    permanently red.
  */
  it("keeps outstanding and overdue as separate figures", async () => {
    render(<ComplianceBoard />);

    await screen.findByText("Outstanding");

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Each tile's hint is what distinguishes them: "Overdue" is also the
    // heading of the list below, so the word alone is ambiguous.
    expect(screen.getByText("Assigned and not yet done")).toBeInTheDocument();
    expect(screen.getByText("Past its date")).toBeInTheDocument();
  });

  it("says it covers mandatory training only", async () => {
    render(<ComplianceBoard />);

    expect(
      await screen.findByText(/Mandatory training only, as at 2026-09-23/),
    ).toBeInTheDocument();
  });

  it("reports how many people are fully compliant, not how many courses", async () => {
    render(<ComplianceBoard />);

    expect(await screen.findByText("85%")).toBeInTheDocument();
    expect(screen.getByText("34 of 40 people")).toBeInTheDocument();
  });
});

describe("the overdue list", () => {
  /* A compliance report that names nobody is a chart. */
  it("names people and says how late they are", async () => {
    give({
      overdueList: [
        {
          userId: "u-1",
          name: "Ada Lovelace",
          title: "Fire Safety",
          kind: "course",
          reference: "fire-safety",
          dueAt: "2026-08-24",
          completedAt: null,
          isComplete: false,
          isOverdue: true,
          isDueSoon: false,
          daysOverdue: 30,
          isRenewal: false,
          expiredOn: null,
        },
      ],
    });

    render(<ComplianceBoard />);

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Fire Safety")).toBeInTheDocument();
    expect(screen.getByText("30d late")).toBeInTheDocument();
  });

  it("marks a learning path as such", async () => {
    give({
      overdueList: [
        {
          userId: "u-1",
          name: "Ada Lovelace",
          title: "Clinical Induction",
          kind: "path",
          reference: "clinical-induction",
          dueAt: "2026-08-24",
          completedAt: null,
          isComplete: false,
          isOverdue: true,
          isDueSoon: false,
          daysOverdue: 30,
          isRenewal: false,
          expiredOn: null,
        },
      ],
    });

    render(<ComplianceBoard />);

    expect(
      await screen.findByText(/Clinical Induction · learning path/),
    ).toBeInTheDocument();
  });

  /*
    A renewal and a no-show are both overdue and want different handling: one
    person has been through this training and needs a refresher booked, the
    other never started. A list that reads as if everybody on it ignored you
    gets chased in the wrong tone, or not at all.
  */
  it("distinguishes a lapsed certificate from training never started", async () => {
    give({
      overdueList: [
        {
          userId: "u-1",
          name: "Ada Lovelace",
          title: "Fire Safety",
          kind: "course",
          reference: "fire-safety",
          dueAt: "2026-01-10",
          completedAt: null,
          isComplete: false,
          isOverdue: true,
          isDueSoon: false,
          daysOverdue: 256,
          isRenewal: true,
          expiredOn: "2026-01-10",
        },
      ],
    });

    render(<ComplianceBoard />);

    expect(
      await screen.findByText(/Fire Safety · certificate lapsed/),
    ).toBeInTheDocument();
    // "due" would be wrong: the date shown is when their cover ran out.
    expect(screen.getByText("expired 2026-01-10")).toBeInTheDocument();
  });

  it("still says due for somebody who never started", async () => {
    give({
      overdueList: [
        {
          userId: "u-2",
          name: "Grace Hopper",
          title: "Fire Safety",
          kind: "course",
          reference: "fire-safety",
          dueAt: "2026-08-24",
          completedAt: null,
          isComplete: false,
          isOverdue: true,
          isDueSoon: false,
          daysOverdue: 30,
          isRenewal: false,
          expiredOn: null,
        },
      ],
    });

    render(<ComplianceBoard />);

    expect(await screen.findByText("due 2026-08-24")).toBeInTheDocument();
    expect(screen.queryByText(/certificate lapsed/)).not.toBeInTheDocument();
  });

  it("says so plainly when nobody is overdue", async () => {
    render(<ComplianceBoard />);

    expect(await screen.findByText("Nobody is overdue")).toBeInTheDocument();
    expect(
      screen.getByText(/still within its deadline/),
    ).toBeInTheDocument();
  });

  /* They will use a spreadsheet whether or not we offer one. */
  it("offers the overdue list as a download", async () => {
    render(<ComplianceBoard />);

    expect(
      await screen.findByRole("link", { name: /Overdue list/ }),
    ).toHaveAttribute("href", "/api/admin/compliance.csv");
  });
});

describe("the breakdowns", () => {
  it("shows a course with people late on it", async () => {
    give({
      byCourse: [
        { title: "Fire Safety", assigned: 40, complete: 30, overdue: 4, completePercent: 75 },
      ],
    });

    render(<ComplianceBoard />);

    expect(await screen.findByText("Fire Safety")).toBeInTheDocument();
    expect(screen.getByText("4 late")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  /*
    A contractor is a real user with real mandatory training and no employment
    record, and the screen says so rather than dropping them.
  */
  it("explains what no department means", async () => {
    give({
      byDepartment: [
        { department: "No department", assigned: 3, complete: 1, overdue: 2, completePercent: 33 },
      ],
    });

    render(<ComplianceBoard />);

    expect(
      await screen.findByText(/no employment record shows as no department/),
    ).toBeInTheDocument();
    expect(screen.getByText("No department")).toBeInTheDocument();
  });
});
