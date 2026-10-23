import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReconciliationBoard from "./ReconciliationBoard";
import type { Reconciliation } from "@/lib/api/finance-banking-client";

/** A month's reconciliation: the two sides, the difference, and the prepare / approve rules. */

const api = vi.hoisted(() => ({ get: vi.fn(), prepare: vi.fn(), approve: vi.fn(), reopen: vi.fn(), history: vi.fn(), pdfUrl: vi.fn(), csvUrl: vi.fn() }));
const me = vi.hoisted(() => ({ name: "Ada Bursar", id: "u-1" }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, reconciliations: api } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: me.id, role: "admin", name: me.name }, loading: false }) }));

const rec = (over: Partial<Reconciliation> = {}): Reconciliation => ({
  id: null,
  prepared: false,
  bankAccount: { id: "ba-1", name: "UBA operating account", currency: "NGN" },
  period: "2026-09",
  status: "draft",
  statementClosing: 75_000_000_00,
  glClosing: 74_000_000_00,
  unpresentedPayments: 500_000_00,
  uncreditedReceipts: 0,
  difference: 500_000_00,
  detail: {
    unpresented: [{ journalId: "j-9", journalNo: "JV-0009", date: "2026-09-29", narration: "Cheque 0042 to Adex", amount: 500_000_00 }],
    uncredited: [],
    notInLedger: [{ lineId: "ln-3", date: "2026-09-30", narration: "SMS CHARGES", amount: -1_000_000_00 }],
    adjustedBank: 74_500_000_00,
    adjustedBook: 74_000_000_00 - 1_000_000_00,
    lastStatementDate: "2026-09-30",
  },
  preparedBy: null,
  approvedBy: null,
  approvedAt: null,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.history.mockResolvedValue([]);
  api.pdfUrl.mockImplementation((a: string, p: string) => `/api/finance/bank-accounts/${a}/reconciliations/${p}/pdf`);
  api.csvUrl.mockImplementation((a: string, p: string) => `/api/finance/bank-accounts/${a}/reconciliations/${p}/csv`);
  me.name = "Ada Bursar";
  me.id = "u-1";
});

describe("ReconciliationBoard", () => {
  it("lays out both sides and the difference, with each outstanding item", async () => {
    api.get.mockResolvedValue(rec());
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    expect(await screen.findByRole("heading", { name: "Reconciliation, September 2026" })).toBeInTheDocument();
    expect(screen.getByText("Not balanced")).toBeInTheDocument();
    expect(screen.getByText("₦500,000.00", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Adjusted bank balance").nextSibling).toHaveTextContent("₦74,500,000.00");
    expect(screen.getByRole("link", { name: /Cheque 0042 to Adex/ })).toHaveAttribute("href", "/suite/finance/journals/j-9");
    expect(screen.getByText("SMS CHARGES")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous month, August 2026/ })).toHaveAttribute("href", "/suite/finance/banking/ba-1/reconciliation/2026-08");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("prepares, and won't let the preparer approve", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(rec({ difference: 0, status: "balanced" }));
    api.prepare.mockResolvedValue(rec({ id: "r-1", prepared: true, status: "balanced", difference: 0, preparedBy: "Ada Bursar" }));
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    await user.click(await screen.findByRole("button", { name: "Prepare" }));
    expect(api.prepare).toHaveBeenCalledWith("ba-1", "2026-09");
    expect(await screen.findByText("Prepared and balanced. Somebody else can now approve it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByText(/You prepared it; somebody else has to approve it./)).toBeInTheDocument();
  });

  it("lets somebody else approve a balanced, current reconciliation", async () => {
    const user = userEvent.setup();
    me.name = "Bola Controller";
    api.get.mockResolvedValue(rec({ id: "r-1", prepared: true, status: "balanced", difference: 0, preparedBy: "Ada Bursar" }));
    api.approve.mockResolvedValue(rec({ id: "r-1", prepared: true, status: "approved", difference: 0, preparedBy: "Ada Bursar", approvedBy: "Bola Controller", approvedAt: "2026-10-05T10:00:00+01:00" }));
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/September 2026 is locked/)).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prepare/ })).not.toBeInTheDocument();
  });

  it("says when the figures moved since it was prepared", async () => {
    api.get.mockResolvedValue(rec({ id: "r-1", prepared: false, status: "draft" }));
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);
    expect(await screen.findByText(/changed since this month was last prepared/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare again" })).toBeInTheDocument();
  });

  it("offers the report as PDF and CSV for any month", async () => {
    api.get.mockResolvedValue(rec());
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    const pdf = await screen.findByRole("link", { name: /Download report \(PDF\)/ });
    expect(pdf).toHaveAttribute("href", "/api/finance/bank-accounts/ba-1/reconciliations/2026-09/pdf");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "CSV" })).toHaveAttribute("href", "/api/finance/bank-accounts/ba-1/reconciliations/2026-09/csv");
    // Nothing saved yet, so no history to ask for.
    expect(api.history).not.toHaveBeenCalled();
  });

  it("reopens an approved month with a reason and shows the history", async () => {
    const user = userEvent.setup();
    me.name = "Chidi Manager";
    me.id = "u-3";
    const approved = rec({ id: "r-1", prepared: true, status: "approved", difference: 0, preparedBy: "Ada Bursar", approvedBy: "Bola Controller", approvedById: "u-2", approvedAt: "2026-10-05T10:00:00+01:00" });
    api.get.mockResolvedValue(approved);
    api.history.mockResolvedValueOnce([
      { id: "e-2", action: "approved", by: "Bola Controller", byId: "u-2", at: "2026-10-05T10:00:00+01:00", reason: null, difference: 0 },
      { id: "e-1", action: "prepared", by: "Ada Bursar", byId: "u-1", at: "2026-10-04T09:00:00+01:00", reason: null, difference: 0 },
    ]);
    api.reopen.mockResolvedValue(rec({ id: "r-1", prepared: true, status: "balanced", difference: 0, preparedBy: "Ada Bursar" }));
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    const trail = await screen.findByRole("list", { name: /Sign-off history/ });
    expect(within(trail).getAllByRole("listitem")).toHaveLength(2);
    expect(within(trail).getByText(/by Bola Controller/)).toBeInTheDocument();
    expect(api.history).toHaveBeenCalledWith("ba-1", "2026-09");

    api.history.mockResolvedValueOnce([
      { id: "e-3", action: "reopened", by: "Chidi Manager", byId: "u-3", at: "2026-10-06T08:00:00+01:00", reason: "Fee booked to the wrong line", difference: 0 },
      { id: "e-2", action: "approved", by: "Bola Controller", byId: "u-2", at: "2026-10-05T10:00:00+01:00", reason: null, difference: 0 },
      { id: "e-1", action: "prepared", by: "Ada Bursar", byId: "u-1", at: "2026-10-04T09:00:00+01:00", reason: null, difference: 0 },
    ]);

    await user.click(screen.getByRole("button", { name: "Reopen" }));
    const dialog = await screen.findByRole("dialog");
    // A reason is needed before anything is sent.
    await user.click(within(dialog).getByRole("button", { name: "Reopen reconciliation" }));
    expect(api.reopen).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole("textbox"), "Fee booked to the wrong line");
    await user.click(within(dialog).getByRole("button", { name: "Reopen reconciliation" }));

    expect(api.reopen).toHaveBeenCalledWith("ba-1", "2026-09", "Fee booked to the wrong line");
    expect(await screen.findByText(/Reopened\. September 2026's statement lines can change again/)).toBeInTheDocument();
    expect(await screen.findByText(/“Fee booked to the wrong line”/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prepare again" })).toBeInTheDocument();
  });

  it("won't let the approver reopen their own approval", async () => {
    me.name = "Bola Controller";
    me.id = "u-2";
    api.get.mockResolvedValue(rec({ id: "r-1", prepared: true, status: "approved", difference: 0, preparedBy: "Ada Bursar", approvedBy: "Bola Controller", approvedById: "u-2" }));
    render(<ReconciliationBoard accountId="ba-1" period="2026-09" />);

    expect(await screen.findByRole("button", { name: "Reopen" })).toBeDisabled();
    expect(screen.getByText(/another finance manager has to reopen it/)).toBeInTheDocument();
  });

  it("refuses a period that is not a month", () => {
    render(<ReconciliationBoard accountId="ba-1" period="september" />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/is not a month/)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
