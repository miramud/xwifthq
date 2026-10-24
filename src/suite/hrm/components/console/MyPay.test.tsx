import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyPay, { payslipTitle } from "./MyPay";
import type { EmployeeLoan, Payslip } from "@/lib/api/hrm-client";

/**
 * My payslips.
 *
 * Two things are worth pinning. The first is the itemisation: a deduction
 * somebody cannot account for is the commonest payroll query, and every line
 * carries how it was worked out so the answer is on the payslip rather than in
 * somebody's inbox.
 *
 * The second is that an employer contribution must not read as a charge to the
 * employee. It appears on the payslip, it is real money spent on them, but
 * beside their own deductions with a minus it would say the opposite of what
 * it means.
 */

const { payslips, payslip, loans } = vi.hoisted(() => ({
  payslips: vi.fn(),
  payslip: vi.fn(),
  loans: vi.fn(),
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
    hrm: { me: { payslips, payslip, loans } },
  };
});

/** ₦500,000 basic, ₦125,000 housing, ₦625,000 gross. */
const PAYSLIP: Payslip = {
  id: "ps-1",
  runId: "run-1",
  employeeId: "emp-1",
  employeeName: "Ada Lovelace",
  employeeNumber: "E-001",
  jobTitle: "Analyst",
  department: "Operations",
  bankName: "Zenith Bank",
  bankAccountNumber: "1234567890",
  bankCode: "057",
  basicKobo: 50_000_000,
  grossKobo: 62_500_000,
  taxableKobo: 42_083_333,
  reliefKobo: 20_416_666,
  payeKobo: 8_366_666,
  pensionEmployeeKobo: 5_000_000,
  pensionEmployerKobo: 6_250_000,
  nhfKobo: 1_250_000,
  nsitfKobo: 625_000,
  otherDeductionsKobo: 0,
  loanRepaymentKobo: 0,
  totalDeductionsKobo: 14_616_666,
  netKobo: 47_883_334,
  employerCostKobo: 6_875_000,
  uncollectedKobo: 0,
  hasShortfall: false,
  isPayable: true,
  balances: true,
  isDistributed: true,
  distributedAt: "2026-09-30T12:00:00+00:00",
};

const WITH_LINES: Payslip = {
  ...PAYSLIP,
  lines: [
    {
      id: "l-1",
      code: "HOUSING",
      name: "Housing allowance",
      kind: "earning",
      kindLabel: "Earning",
      amountKobo: 12_500_000,
      signedKobo: 12_500_000,
      basisNote: "25% of 500,000.00",
      sequence: 100,
    },
    {
      id: "l-2",
      code: "PAYE",
      name: "PAYE",
      kind: "deduction",
      kindLabel: "Deduction",
      amountKobo: 8_366_666,
      signedKobo: -8_366_666,
      basisNote: null,
      sequence: 700,
    },
    {
      id: "l-3",
      code: "PENSION",
      name: "Pension",
      kind: "deduction",
      kindLabel: "Deduction",
      amountKobo: 5_000_000,
      signedKobo: -5_000_000,
      basisNote: "On 625,000.00 pensionable",
      sequence: 710,
    },
    {
      id: "l-4",
      code: "PENSION-ER",
      name: "Pension (employer)",
      kind: "employer_contribution",
      kindLabel: "Employer cost",
      amountKobo: 6_250_000,
      // Zero, not negative: it is not charged to the employee.
      signedKobo: 0,
      basisNote: null,
      sequence: 800,
    },
  ],
};

const LOAN: EmployeeLoan = {
  id: "loan-1",
  employeeId: "emp-1",
  reference: "LN-0001",
  kind: "loan",
  kindLabel: "Loan",
  recoveredInFull: false,
  principalKobo: 12_000_000,
  outstandingKobo: 10_000_000,
  instalmentKobo: 2_000_000,
  instalmentsTotal: 6,
  instalmentsPaid: 1,
  progressPercent: 16.7,
  startsOn: "2026-09-01",
  status: "active",
  statusLabel: "Being repaid",
  isCollecting: true,
  isOutstanding: true,
  purpose: "School fees.",
  note: null,
  approvedAt: "2026-08-20T09:00:00+00:00",
};

beforeEach(() => {
  vi.clearAllMocks();

  payslips.mockResolvedValue({
    data: [PAYSLIP],
    meta: {
      total: 1,
      grossThisYearKobo: 62_500_000,
      payeThisYearKobo: 8_366_666,
    },
  });
  payslip.mockResolvedValue(WITH_LINES);
  loans.mockResolvedValue({
    data: [],
    meta: { outstandingKobo: 0, monthlyKobo: 0 },
  });
});

describe("MyPay", () => {
  it("shows the last net pay in naira, not kobo", async () => {
    render(<MyPay />);

    const tile = await screen.findByText("Last net pay");
    const card = tile.closest("div")?.parentElement as HTMLElement;

    // ₦478,833, not 47,883,334.
    expect(within(card).getByText("₦478,833")).toBeInTheDocument();
  });

  it("explains an empty list rather than implying nobody was paid", async () => {
    payslips.mockResolvedValue({
      data: [],
      meta: { total: 0, grossThisYearKobo: 0, payeThisYearKobo: 0 },
    });

    render(<MyPay />);

    expect(await screen.findByText("No payslips yet")).toBeInTheDocument();
    expect(
      screen.getByText(/once the run it belongs to has been released/),
    ).toBeInTheDocument();
  });

  describe("the breakdown", () => {
    async function open() {
      const user = userEvent.setup();
      render(<MyPay />);

      await user.click(await screen.findByRole("button", { name: "Breakdown" }));

      return user;
    }

    it("itemises earnings and deductions separately", async () => {
      await open();

      expect(await screen.findByText("Earnings")).toBeInTheDocument();
      expect(screen.getByText("Deductions")).toBeInTheDocument();
      expect(screen.getByText("Basic salary")).toBeInTheDocument();
      expect(screen.getByText("Housing allowance")).toBeInTheDocument();
      expect(screen.getByText("PAYE")).toBeInTheDocument();
    });

    /*
      The only question anybody ever asks about a payslip line, answered on
      the line itself.
    */
    it("says how each figure was arrived at", async () => {
      await open();

      expect(await screen.findByText("25% of 500,000.00")).toBeInTheDocument();
      expect(screen.getByText("On 625,000.00 pensionable")).toBeInTheDocument();
    });

    /*
      Real money spent on them, so it belongs on the payslip, but beside
      their own deductions it would read as a charge.
    */
    it("separates the employer's contribution from the employee's deductions", async () => {
      await open();

      const panel = (
        await screen.findByText(/Paid by your employer/)
      ).closest("div") as HTMLElement;

      expect(within(panel).getByText("Pension (employer)")).toBeInTheDocument();

      const deductionsHeading = screen.getByText("Deductions");
      const deductionsGroup = deductionsHeading.closest("div")
        ?.parentElement as HTMLElement;

      expect(
        within(deductionsGroup).queryByText("Pension (employer)"),
      ).not.toBeInTheDocument();
    });

    /*
      A deduction that could not be taken has not been written off, and the
      payslip has to say so rather than quietly balancing.
    */
    it("says when a deduction had to be held back", async () => {
      payslip.mockResolvedValue({
        ...WITH_LINES,
        hasShortfall: true,
        uncollectedKobo: 3_000_000,
      });

      await open();

      expect(
        await screen.findByText(/could not be deducted this month/),
      ).toBeInTheDocument();
      expect(screen.getByText(/has not been written off/)).toBeInTheDocument();
    });
  });

  /* A deduction somebody cannot account for is the commonest payroll query. */
  it("shows what is owed so a deduction is never a surprise", async () => {
    loans.mockResolvedValue({
      data: [LOAN],
      meta: { outstandingKobo: 10_000_000, monthlyKobo: 2_000_000 },
    });

    render(<MyPay />);

    expect(await screen.findByText("What I owe")).toBeInTheDocument();
    expect(screen.getByText(/Loan · LN-0001/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 6 paid/)).toBeInTheDocument();
  });
});

/*
  The release date is when HR made a payslip visible, not when anybody was
  paid. The title says which month it pays for and the day the money moved.
*/
describe("payslipTitle", () => {
  const period = { start: "2026-08-01", end: "2026-08-31", payDate: "2026-08-28", paidOn: null, reference: "PR-2026-08" };

  it("shows the month and the payment date once the run is paid", () => {
    expect(payslipTitle({ ...PAYSLIP, period: { ...period, paidOn: "2026-08-28" } })).toBe("August 2026 · paid 28 Aug");
  });

  it("shows the planned pay date until it is marked paid", () => {
    expect(payslipTitle({ ...PAYSLIP, period })).toBe("August 2026 · pay date 28 Aug");
  });

  it("never calls the release date a payment date", () => {
    expect(payslipTitle({ ...PAYSLIP, period: undefined })).toMatch(/^Released /);
  });
});
