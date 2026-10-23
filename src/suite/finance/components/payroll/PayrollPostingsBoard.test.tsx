import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayrollPostingsBoard from "./PayrollPostingsBoard";
import type { PayrollRunRow } from "@/lib/api/finance-banking-client";

/** Payroll postings: the empty state, the preview with missing mappings, and sending for a second person to approve. */

const api = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, payroll: api } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Me" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/payroll",
  useSearchParams: () => new URLSearchParams(),
}));

const run = (over: Partial<PayrollRunRow> = {}): PayrollRunRow => ({
  id: "run-9",
  reference: "PR-2026-09",
  period: "September 2026",
  periodEnd: "2026-09-30",
  status: "approved",
  headcount: 42,
  gross: 48_000_000_00,
  net: 39_500_000_00,
  employerCost: 52_000_000_00,
  journal: null,
  waiting: null,
  ...over,
});

const preview = (missing: string[]) => ({
  id: "run-9",
  period: "September 2026",
  lines: [
    { label: "Salaries and wages", systemKey: "salaries_expense", account: { id: "a-1", code: "6100", name: "Salaries" }, side: "debit" as const, amount: 48_000_000_00 },
    { label: "PAYE payable", systemKey: "paye_payable", account: missing.length ? null : { id: "a-2", code: "2210", name: "PAYE" }, side: "credit" as const, amount: 8_500_000_00 },
    { label: "Net pay payable", systemKey: "net_pay_payable", account: { id: "a-3", code: "2200", name: "Net pay" }, side: "credit" as const, amount: 39_500_000_00 },
  ],
  missing,
  debit: 48_000_000_00,
  credit: 48_000_000_00,
  journal: null,
  waiting: null,
});

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe("PayrollPostingsBoard", () => {
  it("points to HR payroll when nothing is approved yet", async () => {
    api.list.mockResolvedValue([]);
    render(<PayrollPostingsBoard />);
    expect(await screen.findByText("No approved payroll runs yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open HR payroll" })).toHaveAttribute("href", "/suite/hrm/payroll");
  });

  it("won't post while a payroll line has no account", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([run(), run({ id: "run-8", period: "August 2026", journal: { id: "j-8", journalNo: "PAY-0008" } })]);
    api.preview.mockResolvedValue(preview(["PAYE payable"]));
    render(<PayrollPostingsBoard />);

    expect(await screen.findByRole("link", { name: "PAY-0008" })).toHaveAttribute("href", "/suite/finance/journals/j-8");
    await user.click(screen.getByRole("button", { name: "Preview the journal for September 2026" }));
    const drawer = await screen.findByRole("dialog", { name: "September 2026" });
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("PAYE payable");
    expect(within(drawer).getByText(/No account \(needs Paye payable\)/)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Send for approval" })).toBeDisabled();
  });

  it("sends a run for approval after asking, then says it is waiting", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([run()]);
    api.preview.mockResolvedValue(preview([]));
    api.post.mockResolvedValue({ id: "j-9", journalNo: null, total: 48_000_000_00, status: "pending_approval", approvalId: "ap-9" });
    render(<PayrollPostingsBoard />);

    await user.click(await screen.findByRole("button", { name: "Preview the journal for September 2026" }));
    const drawer = await screen.findByRole("dialog", { name: "September 2026" });
    const send = await within(drawer).findByRole("button", { name: "Send for approval" });
    await within(drawer).findByText("6100 · Salaries");
    await user.click(send);
    const ask = await screen.findByRole("alertdialog", { name: "Send payroll for September 2026 for approval?" });
    expect(ask).toHaveTextContent("It is in the books once they do.");
    await user.click(within(ask).getByRole("button", { name: "Send for approval" }));
    expect(api.post).toHaveBeenCalledWith("run-9");

    expect(await within(drawer).findByText("Waiting for a second person to approve it")).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Open the approval" })).toHaveAttribute("href", "/suite/approvals/ap-9");
    expect(within(drawer).getByRole("link", { name: "Open the journal" })).toHaveAttribute("href", "/suite/finance/journals/j-9");
    expect(within(drawer).queryByRole("button", { name: "Send for approval" })).not.toBeInTheDocument();
  });

  it("marks runs awaiting approval or rejected, and offers to send a rejected one again", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      run(),
      run({ id: "run-8", period: "August 2026", waiting: { id: "j-8", status: "pending_approval", approvalId: "ap-8" } }),
      run({ id: "run-7", period: "July 2026", waiting: { id: "j-7", status: "rejected", approvalId: "ap-7" } }),
    ]);
    api.preview.mockResolvedValue({ ...preview([]), waiting: { id: "j-7", status: "rejected", approvalId: "ap-7" } });
    render(<PayrollPostingsBoard />);

    expect(await screen.findByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/1 awaiting approval/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview the journal for July 2026" }));
    const drawer = await screen.findByRole("dialog", { name: "July 2026" });
    expect(await within(drawer).findByText(/The last posting was rejected/)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Send again" })).toBeEnabled();
  });
});
