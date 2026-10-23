import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Account } from "@/lib/api/finance-ledger-client";
import type { RecurringJournalDetail } from "@/lib/api/finance-recurring-client";
import { chooseOption } from "@/test/selectOption";
import RecurringJournalEditor, { rowsFromTemplate } from "./RecurringJournalEditor";
import { resetDimensionLists } from "../dimensions";

/** Setting up a recurring journal: the schedule preview, the shared entry grid, and where refusals land. */

const api = vi.hoisted(() => ({ accounts: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, accounts: { ...actual.ledger.accounts, list: api.accounts } } };
});
vi.mock("@/lib/api/finance-recurring-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-recurring-client")>();
  return { ...actual, recurring: { ...actual.recurring, create: api.create, update: api.update, get: api.get } };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals/recurring/new",
  useSearchParams: () => new URLSearchParams(),
}));

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  code: "1000",
  name: "A",
  type: "asset",
  subtype: null,
  parentId: null,
  level: 2,
  isPostable: true,
  normalBalance: "debit",
  requires: [],
  requiresProject: false,
  requiresCostCentre: false,
  requiresCounterparty: false,
  requiresPerson: false,
  currency: null,
  isBank: false,
  systemKey: null,
  cashFlow: null,
  description: null,
  active: true,
  used: true,
  aliases: [],
  ...over,
});

const ACCOUNTS = [
  acct({ id: "rent", code: "6210", name: "Rent expense", type: "expense" }),
  acct({ id: "prepaid", code: "1310", name: "Prepaid rent" }),
];

const template = (over: Partial<RecurringJournalDetail> = {}): RecurringJournalDetail => ({
  id: "rj-1",
  name: "Office rent release",
  narration: "Release of prepaid office rent",
  frequency: "monthly",
  dayOfMonth: 31,
  startDate: "2026-01-01",
  endDate: null,
  maxOccurrences: 12,
  autoReverse: false,
  status: "active",
  nextRunOn: "2026-03-31",
  lastRunOn: "2026-02-28",
  occurrences: 2,
  amount: 250_000_00,
  currencies: [],
  lastError: null,
  lastErrorAt: null,
  createdBy: "Amaka Obi",
  baseCurrency: "NGN",
  updatedBy: null,
  upcoming: ["2026-03-31"],
  lines: [
    { lineNo: 1, account: { id: "rent", code: "6210", name: "Rent expense" }, debit: 250_000_00, credit: 0, currency: "NGN", project: null, costCentre: null, counterparty: null, person: null, unitId: null, narration: null },
    { lineNo: 2, account: { id: "prepaid", code: "1310", name: "Prepaid rent" }, debit: 0, credit: 250_000_00, currency: "NGN", project: null, costCentre: null, counterparty: null, person: null, unitId: null, narration: null },
  ],
  runs: [],
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  resetDimensionLists();
  api.accounts.mockResolvedValue({ accounts: ACCOUNTS, templates: [], systemKeys: [] });
});

describe("RecurringJournalEditor", { timeout: 20_000 }, () => {
  it("previews the dates, and sends the lines from the shared grid", async () => {
    const user = userEvent.setup();
    render(<RecurringJournalEditor />);
    await screen.findByRole("combobox", { name: "Account, line 1" });

    await user.type(screen.getByLabelText("Name"), "Office rent release");
    await user.type(screen.getByLabelText("Narration on each journal"), "Release of prepaid office rent");
    await user.clear(screen.getByLabelText("Starting from"));
    await user.type(screen.getByLabelText("Starting from"), "2026-01-01");

    // Last day of the month by default: February is the 28th.
    const dates = screen.getByRole("list", { name: "Next dates a journal is made" });
    expect(dates).toHaveTextContent("31 Jan 2026");
    expect(dates).toHaveTextContent("28 Feb 2026");

    await user.click(screen.getByRole("radio", { name: "After a number" }));
    await user.clear(screen.getByLabelText("Number of journals"));
    await user.type(screen.getByLabelText("Number of journals"), "2");
    expect(screen.getByRole("list", { name: "Next dates a journal is made" }).querySelectorAll("li")).toHaveLength(2);

    await chooseOption(user, "Account, line 1", /6210 Rent expense/, { search: "6210" });
    await user.type(screen.getByLabelText("Debit, line 1"), "250,000");
    await chooseOption(user, "Account, line 2", /1310 Prepaid rent/, { search: "1310" });
    await user.type(screen.getByLabelText("Credit, line 2"), "250000");
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");

    api.create.mockResolvedValue(template());
    await user.click(screen.getByRole("button", { name: "Create recurring journal" }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Office rent release",
        narration: "Release of prepaid office rent",
        frequency: "monthly",
        dayOfMonth: 31,
        startDate: "2026-01-01",
        endDate: null,
        maxOccurrences: 2,
        autoReverse: false,
        lines: [expect.objectContaining({ accountId: "rent", debit: 25_000_000 }), expect.objectContaining({ accountId: "prepaid", credit: 25_000_000 })],
      }),
    );
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/recurring/rj-1?notice=created");
  });

  it("asks for a name and puts the ledger's refusal on the line", async () => {
    const user = userEvent.setup();
    render(<RecurringJournalEditor />);
    await screen.findByRole("combobox", { name: "Account, line 1" });
    await user.type(screen.getByLabelText("Narration on each journal"), "Accrual");
    await chooseOption(user, "Account, line 1", /6210 Rent expense/, { search: "6210" });
    await user.type(screen.getByLabelText("Debit, line 1"), "10");
    await chooseOption(user, "Account, line 2", /1310 Prepaid rent/, { search: "1310" });
    await user.type(screen.getByLabelText("Credit, line 2"), "10");

    await user.click(screen.getByRole("button", { name: "Create recurring journal" }));
    expect(await screen.findByText("Give the template a name you will recognise in a list.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Name"), "Accrual");
    api.create.mockRejectedValue(
      new ApiError("Invalid", 422, {
        "lines.0.account_id": ["ACCOUNT_NOT_POSTABLE: 6210 Rent expense is switched off."],
        endDate: ["The end date is before the first occurrence (31 Jan 2026)."],
      }),
    );
    await user.click(screen.getByRole("radio", { name: "On a date" }));
    await user.type(screen.getByLabelText("Last date"), "2025-12-01");
    await user.click(screen.getByRole("button", { name: "Create recurring journal" }));

    expect(await screen.findByText("6210 Rent expense is switched off.")).toBeInTheDocument();
    expect(screen.getByText("The end date is before the first occurrence (31 Jan 2026).")).toBeInTheDocument();
  });

  it("keeps the schedule fixed once a template has made journals", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(template());
    api.update.mockResolvedValue(template());
    render(<RecurringJournalEditor templateId="rj-1" />);

    expect(await screen.findByDisplayValue("Office rent release")).toBeInTheDocument();
    expect(screen.getByText(/has made 2 journals, so its schedule is fixed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Starting from")).toBeDisabled();
    expect(screen.getByLabelText("Credit, line 2")).toHaveValue("250000.00");
    // The preview continues from the third.
    expect(screen.getByRole("list", { name: "Next dates a journal is made" })).toHaveTextContent("31 Mar 2026");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Head office rent");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const body = api.update.mock.calls[0][1];
    expect(api.update.mock.calls[0][0]).toBe("rj-1");
    expect(body).toMatchObject({ name: "Head office rent", maxOccurrences: 12 });
    expect(body.frequency).toBeUndefined();
    expect(body.startDate).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/recurring/rj-1?notice=saved");
  });

  it("turns saved lines back into grid rows in their own currency", () => {
    const rows = rowsFromTemplate(
      [{ lineNo: 1, account: { id: "x", code: "1", name: "X" }, debit: 1_000, credit: 0, currency: "USD", project: { id: "p", name: "P" }, costCentre: null, counterparty: null, person: null, unitId: null, narration: "n" }],
      "NGN",
    );
    expect(rows[0]).toMatchObject({ accountId: "x", debit: "10.00", credit: "", currency: "USD", projectId: "p", narration: "n", more: true });
  });
});
