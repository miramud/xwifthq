import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JournalDetail } from "@/lib/api/finance-ledger-client";
import JournalDetailView from "./JournalDetailView";

/** A journal: its lines and source, the approval link, reversal with a reason, and a confirmed delete. */

const api = vi.hoisted(() => ({ get: vi.fn(), reverse: vi.fn(), remove: vi.fn(), submit: vi.fn(), post: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, journals: { ...actual.ledger.journals, ...api } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals/j1",
  useSearchParams: () => new URLSearchParams(),
}));

const journal = (over: Partial<JournalDetail>): JournalDetail => ({
  id: "j1",
  journalNo: "JV-2026-0042",
  journalDate: "2026-09-12",
  type: "bank",
  narration: "September bank charges",
  status: "posted",
  total: 1_250_000,
  sourceType: "statement_import",
  sourceId: "imp-7",
  createdBy: "Amaka Obi",
  postedAt: "2026-09-13T10:00:00Z",
  reversesJournalId: null,
  reversedByJournalId: null,
  approvalId: null,
  currency: "NGN",
  postedBy: "Tunde Bello",
  autoReverseOn: null,
  lines: [
    { id: "l1", lineNo: 1, account: { id: "chg", code: "6510", name: "Bank charges" }, debit: 1_250_000, credit: 0, txnCurrency: "NGN", txnDebit: 1_250_000, txnCredit: 0, fxRate: null, project: null, costCentre: { id: "cc", code: "BUR", name: "Bursary" }, counterparty: null, person: null, unitId: null, narration: "SMS alerts" },
    { id: "l2", lineNo: 2, account: { id: "bank", code: "1110", name: "Main operating account" }, debit: 0, credit: 1_250_000, txnCurrency: "NGN", txnDebit: 0, txnCredit: 1_250_000, fxRate: null, project: null, costCentre: null, counterparty: null, person: null, unitId: null, narration: null },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
});

describe("JournalDetailView", () => {
  it("shows lines with their dimensions and where the journal came from", async () => {
    api.get.mockResolvedValue(journal({}));
    render(<JournalDetailView id="j1" />);
    const table = await screen.findByRole("table", { name: /Lines of JV-2026-0042/ });
    expect(within(table).getByText("BUR Bursary")).toBeInTheDocument();
    expect(within(table).getAllByText("12,500.00")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Bank statement import" })).toHaveAttribute("href", "/suite/finance/banking/imports/imp-7");
    expect(screen.getByText("Posted", { selector: "span" })).toBeInTheDocument();
  });

  it("reverses only with a reason, then opens the reversal", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(journal({}));
    api.reverse.mockResolvedValue({ id: "j2" });
    render(<JournalDetailView id="j1" />);
    await user.click(await screen.findByRole("button", { name: "Reverse" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Post reversal" }));
    expect(await within(dialog).findByText("Say why this journal is being reversed.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Charged to the wrong account");
    await user.click(within(dialog).getByRole("button", { name: "Post reversal" }));
    expect(api.reverse).toHaveBeenCalledWith("j1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "Charged to the wrong account");
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/j2?notice=Reversal%20posted.");
  });

  it("sends a pending journal's checker to its approval", async () => {
    api.get.mockResolvedValue(journal({ status: "pending_approval", approvalId: "ap-1", postedAt: null, journalNo: null }));
    render(<JournalDetailView id="j1" />);
    expect(await screen.findByRole("link", { name: "Open the approval" })).toHaveAttribute("href", "/suite/approvals/ap-1");
    expect(screen.queryByRole("button", { name: "Reverse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post journal" })).not.toBeInTheDocument();
  });

  it("asks before deleting a draft", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(journal({ status: "draft", postedAt: null, journalNo: null }));
    api.remove.mockResolvedValue({});
    render(<JournalDetailView id="j1" />);
    await user.click(await screen.findByRole("button", { name: "Delete draft" }));
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Delete draft" }));
    expect(api.remove).toHaveBeenCalledWith("j1");
    expect(push).toHaveBeenCalledWith("/suite/finance/journals");
  });
});
