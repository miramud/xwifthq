import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PayrollRun } from "@/lib/api/hrm-client";
import { MarkPaidDialog, RunDetail } from "./PayrollBoard";

const payroll = vi.hoisted(() => ({ run: vi.fn(), exportRun: vi.fn(), transitionRun: vi.fn() }));

vi.mock("@/lib/api/hrm-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/hrm-client")>();
  return { ...actual, hrm: { ...actual.hrm, payroll: { ...actual.hrm.payroll, ...payroll } } };
});

/**
 * "Mark as paid" records the day the money left.
 *
 * It used to stamp the click's own date, so a run marked paid a few days after
 * the transfer disagreed with the bank statement and with every payslip.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/hrm/payroll",
  useSearchParams: () => new URLSearchParams(),
}));

describe("MarkPaidDialog", () => {
  it("starts at the run's pay date when it has passed, and sends the date chosen", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<MarkPaidDialog payDate="2026-08-28" busy={false} onClose={vi.fn()} onConfirm={onConfirm} />);

    const input = screen.getByLabelText(/Paid on/) as HTMLInputElement;
    expect(input.value).toBe("2026-08-28");

    await user.clear(input);
    await user.type(input, "2026-08-29");
    await user.click(screen.getByRole("button", { name: "Mark as paid" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("2026-08-29"));
  });

  it("starts at today when the pay date is still to come", () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    render(<MarkPaidDialog payDate="2999-01-31" busy={false} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect((screen.getByLabelText(/Paid on/) as HTMLInputElement).value).toBe(today);
  });
});

/** Maker-checker: whoever last worked a run out cannot approve it. */
describe("RunDetail approval", () => {
  const RUN = {
    id: "r-1",
    reference: "PR-2026-09",
    kind: "regular",
    kindLabel: "Regular",
    coversEverybody: true,
    status: "calculated",
    statusLabel: "Calculated",
    isRecalculable: true,
    isFrozen: false,
    canPay: false,
    mayApprove: false,
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    periodLabel: "September 2026",
    payDate: "2026-09-30",
    grossKobo: 50_000_000,
    deductionsKobo: 10_000_000,
    netKobo: 40_000_000,
    employerCostKobo: 5_000_000,
    totalCostKobo: 55_000_000,
    headcount: 1,
    note: null,
    calculatedBy: "Hr Manager",
    calculatedAt: "2026-09-23T09:00:00Z",
    approvedAt: null,
    paidAt: null,
    overtimeExcluded: { days: 0, minutes: 0, rows: [] },
    finalSettlements: [],
  } as unknown as PayrollRun;
  const CHECKS = { unbalanced: 0, unpayable: 0, withShortfall: 0 };

  it("won't let the person who worked it out approve it, and says why", async () => {
    payroll.run.mockResolvedValue({ data: RUN, meta: CHECKS });
    render(<RunDetail runId="r-1" onChanged={async () => {}} />);

    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    expect(screen.getByText("You worked these figures out, so somebody else has to approve them.")).toBeInTheDocument();
  });

  it("lets somebody else approve it", async () => {
    payroll.run.mockResolvedValue({ data: { ...RUN, mayApprove: true }, meta: CHECKS });
    render(<RunDetail runId="r-1" onChanged={async () => {}} />);

    expect(await screen.findByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByText("A second person approves it, not whoever worked it out.")).toBeInTheDocument();
  });
});
