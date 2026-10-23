import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatementImportDetail from "./StatementImportDetail";
import { detail, line } from "@/suite/finance/components/banking/fixtures";

/**
 * A statement import: the checks and what they found, the review queue with
 * inline classification and "save and next", the maker-checker journals, and
 * a failed import showing what was read.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), lines: vi.fn(), review: vi.fn(), propose: vi.fn(), submit: vi.fn(), post: vi.fn(), analysis: vi.fn(), retry: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, statements: { ...actual.banking.statements, ...api } } };
});
vi.mock("@/suite/finance/components/banking/lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/suite/finance/components/banking/lookups")>();
  const options: Record<string, { value: string; label: string }[]> = {
    accounts: [
      { value: "acc-diesel", label: "5210 · Diesel and generator" },
      { value: "acc-fees", label: "4100 · Tuition fees" },
      { value: "acc-advance", label: "1420 · Staff advances" },
    ],
    people: [{ value: "u-ada", label: "Ada Obi" }],
    projects: [{ value: "p-1", label: "Library extension" }],
    costCentres: [{ value: "cc-1", label: "BUR · Bursary" }],
    counterparties: [{ value: "cp-1", label: "Adex Ventures Ltd" }],
  };
  return {
    ...actual,
    useLookup: (k: string) => ({ status: "ready", options: options[k] ?? [] }),
    requiredFor: (id: string) => (id === "acc-advance" ? ["person"] : []),
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Me" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/banking/imports/imp-1",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("StatementImportDetail", () => {
  it("shows every check, the reordering and the KYC note", async () => {
    api.get.mockResolvedValue(detail());
    api.lines.mockResolvedValue([]);
    render(<StatementImportDetail id="imp-1" />);

    const heading = await screen.findByRole("heading", { name: "Verification" });
    const panel = heading.closest("section") as HTMLElement;
    expect(within(panel).getAllByText("Passed")).toHaveLength(5);
    expect(within(panel).getByText("Not printed")).toBeInTheDocument();
    expect(within(panel).getByText(/printed 2 rows out of order/)).toBeInTheDocument();
    expect(within(panel).getByText(/Update the KYC with the bank/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Progress" })).toHaveTextContent("Verified (done)");
    await waitFor(() => expect(api.lines).toHaveBeenCalledWith("imp-1", { status: "needs_account", q: undefined }));
  });

  it("classifies a line inline, remembers it, and moves to the next", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    const first = line();
    const second = line({ id: "ln-2", postingSeq: 2, narration: "REMITA/FIRS/PAYE SEPT", category: "government_payment", flags: ["needs_review"], counterpartyRaw: null, purposeRaw: null, feeSplit: null });
    api.lines.mockResolvedValue([first, second]);
    api.review.mockResolvedValue({ ...first, account: { id: "acc-diesel", code: "5210", name: "Diesel and generator" }, project: { id: "p-1", name: null }, source: "user", confidence: 100 });
    render(<StatementImportDetail id="imp-1" />);

    const lines = await screen.findByRole("list", { name: "Statement lines" });
    expect(within(lines).getByText("Needs review")).toBeInTheDocument();
    expect(within(lines).getByText(/₦232,000.00 paid \+ ₦50.00 fee \+ ₦3.75 VAT/)).toBeInTheDocument();

    await user.click(within(lines).getAllByRole("button", { expanded: false })[0]);
    const form = screen.getByRole("form", { name: "Classify this line" });
    await user.click(within(form).getByRole("button", { name: "Save and next" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Choose the account this line posts to");

    await user.click(within(form).getByLabelText("Account"));
    await user.click(screen.getByRole("option", { name: /Diesel and generator/ }));
    await user.click(within(form).getByLabelText("Project"));
    await user.click(screen.getByRole("option", { name: /Library extension/ }));
    await user.click(within(form).getByLabelText(/Remember this for next time/));
    await user.click(within(form).getByRole("button", { name: "Save and next" }));

    expect(api.review).toHaveBeenCalledWith("ln-1", expect.objectContaining({ accountId: "acc-diesel", projectId: "p-1", remember: true, category: "payment" }));
    // The saved line shows its account and project name; the next line's editor is open.
    await waitFor(() => expect(within(lines).getByText("5210 · Diesel and generator")).toBeInTheDocument());
    expect(within(lines).getByText("Project: Library extension")).toBeInTheDocument();
    const next = screen.getByRole("form", { name: "Classify this line" });
    expect(next.closest("article")).toHaveTextContent("REMITA/FIRS/PAYE SEPT");
  });

  it("opens the other leg's statement when a transfer crossed accounts, and jumps within this one otherwise", async () => {
    api.get.mockResolvedValue(detail());
    api.lines.mockResolvedValue([
      line({ id: "ln-1", category: "transfer", pairedLineId: "ln-90", pairedImportId: "imp-2", pairedBankAccountId: "ba-2", feeSplit: null }),
      line({ id: "ln-2", postingSeq: 2, category: "transfer", pairedLineId: "ln-3", pairedImportId: "imp-1", pairedBankAccountId: "ba-1", feeSplit: null }),
    ]);
    render(<StatementImportDetail id="imp-1" />);

    const lines = await screen.findByRole("list", { name: "Statement lines" });
    expect(within(lines).getByRole("link", { name: "Open the other leg's statement" })).toHaveAttribute("href", "/suite/finance/banking/imports/imp-2");
    expect(within(lines).getByRole("button", { name: "Go to the other leg" })).toBeInTheDocument();
  });

  it("asks for a person when the account needs one", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(detail());
    const first = line();
    api.lines.mockResolvedValue([first]);
    api.review.mockResolvedValue({ ...first, account: { id: "acc-advance", code: "1420", name: "Staff advances" }, personId: "u-ada", person: { id: "u-ada", name: "Ada Obi" } });
    render(<StatementImportDetail id="imp-1" />);

    const lines = await screen.findByRole("list", { name: "Statement lines" });
    await user.click(within(lines).getAllByRole("button", { expanded: false })[0]);
    const form = screen.getByRole("form", { name: "Classify this line" });
    expect(within(form).queryByLabelText(/Person/)).not.toBeInTheDocument();

    await user.click(within(form).getByLabelText("Account"));
    await user.click(screen.getByRole("option", { name: /Staff advances/ }));
    await user.click(within(form).getByRole("button", { name: "Save and next" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("This account needs a person");
    expect(api.review).not.toHaveBeenCalled();

    await user.click(within(form).getByLabelText(/Person/));
    await user.click(screen.getByRole("option", { name: /Ada Obi/ }));
    await user.click(within(form).getByRole("button", { name: "Save and next" }));
    expect(api.review).toHaveBeenCalledWith("ln-1", expect.objectContaining({ accountId: "acc-advance", personId: "u-ada" }));
    expect(await within(lines).findByText("Person: Ada Obi")).toBeInTheDocument();
  });

  it("proposes journals and sends them for approval, explaining maker-checker", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce(detail({ counts: { matched: 0, suggested: 0, unmatched: 20, ignored: 0, needsAccount: 0 } }));
    api.lines.mockResolvedValue([]);
    api.propose.mockResolvedValue({ journals: ["j-1", "j-2"], unclassified: 0 });
    api.submit.mockResolvedValue({ ...detail(), status: "submitted", approvalId: "ap-1" });
    render(<StatementImportDetail id="imp-1" />);

    await user.click(await screen.findByRole("tab", { name: /Journals/ }));
    expect(screen.getByText(/can.t approve it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send for approval" })).toBeDisabled();
    expect(screen.getByText("Propose the journals first.")).toBeInTheDocument();

    api.get.mockResolvedValueOnce(
      detail({
        counts: { matched: 18, suggested: 0, unmatched: 2, ignored: 0, needsAccount: 0 },
        journals: [{ id: "j-1", journalNo: null, date: "2026-09-30", narration: "Bank charges, UBA operating account, September 2026", status: "draft", total: 12_500_00 }],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Propose journals" }));
    expect(await screen.findByText("2 draft journals proposed.")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /Bank charges, UBA operating account/ });
    expect(link).toHaveAttribute("href", "/suite/finance/journals/j-1");

    api.get.mockResolvedValueOnce(
      detail({ status: "submitted", approvalId: "ap-1", journals: [{ id: "j-1", journalNo: null, date: "2026-09-30", narration: "Bank charges", status: "pending_approval", total: 12_500_00 }] }),
    );
    await user.click(screen.getByRole("button", { name: "Send for approval" }));
    expect(api.submit).toHaveBeenCalledWith("imp-1");
    expect(await screen.findByRole("link", { name: "Open in Approvals" })).toHaveAttribute("href", "/suite/approvals/ap-1");
  });

  it("shows why a failed import stopped and the rows that were read", async () => {
    api.get.mockResolvedValue(
      detail({
        status: "failed_validation",
        verified: false,
        error: null,
        validation: {
          checks: [
            { code: "V1", label: "Account identity", status: "pass", message: "Account ending 4421." },
            { code: "V3", label: "Every transaction read", status: "fail", message: "Extracted deposits ₦1.00 vs printed ₦2.00. Some rows were missed or misread." },
          ],
          diagnostics: ["Page 2, row 4: a dated row with no balance was skipped: 03-SEP-26 X"],
          rows: [{ listed: 1, date: "2026-09-03", narration: "TNF-JOHN DOE", withdrawal: 0, deposit: 1_00, balance: 101_00, location: "page 1" }],
        },
      }),
    );
    render(<StatementImportDetail id="imp-1" />);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/Some rows were missed or misread/)).toBeInTheDocument();
    expect(screen.getByText(/a dated row with no balance was skipped/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Rows read from the failed statement" });
    expect(within(table).getByText("TNF-JOHN DOE")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Review/ })).not.toBeInTheDocument();
    expect(api.lines).not.toHaveBeenCalled();
  });

  it("runs a failed import again from the stored file", async () => {
    const user = userEvent.setup();
    api.get
      .mockResolvedValueOnce(detail({ status: "failed_validation", verified: false, error: "The file could not be read.", validation: null }))
      .mockResolvedValue(detail({ status: "parsing", verified: false }));
    api.retry.mockResolvedValue(detail({ status: "uploaded", verified: false }));
    render(<StatementImportDetail id="imp-1" pollMs={60_000} />);

    await user.click(await screen.findByRole("button", { name: "Run again" }));
    expect(api.retry).toHaveBeenCalledWith("imp-1");
    expect(await screen.findByText(/Reading the file and checking it against the account/)).toBeInTheDocument();
  });

  it("offers no run again for an import that is fine", async () => {
    api.get.mockResolvedValue(detail());
    api.lines.mockResolvedValue([]);
    render(<StatementImportDetail id="imp-1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Run again" })).not.toBeInTheDocument();
  });
});
