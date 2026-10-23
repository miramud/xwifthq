import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Account } from "@/lib/api/finance-ledger-client";
import { chooseOption } from "@/test/selectOption";
import JournalEditor from "./JournalEditor";
import { resetDimensionLists } from "./dimensions";

/** The entry grid: the beam, required dimensions, and errors placed on the line they are about. */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), submit: vi.fn(), get: vi.fn(), update: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return {
    ...actual,
    ledger: {
      ...actual.ledger,
      accounts: { ...actual.ledger.accounts, list: api.list },
      journals: { ...actual.ledger.journals, create: api.create, submit: api.submit, get: api.get, update: api.update },
    },
  };
});

vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return {
    ...actual,
    orgFoundations: {
      ...actual.orgFoundations,
      lookups: { ...actual.orgFoundations.lookups, costCentres: async () => [{ id: "cc-1", code: "ENG", name: "School of Engineering", orgUnitId: null }] },
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/journals/new",
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
  acct({ id: "bank", code: "1110", name: "Main operating account", isBank: true }),
  acct({ id: "fees", code: "4100", name: "Tuition and academic fees", type: "revenue", normalBalance: "credit", requires: ["cost centre"], requiresCostCentre: true }),
];

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  resetDimensionLists();
  api.list.mockResolvedValue({ accounts: ACCOUNTS, templates: [], systemKeys: [] });
});

async function keyFeesJournal(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("combobox", { name: "Account, line 1" });
  await user.type(screen.getByLabelText("Narration"), "Fees received for first semester");
  await chooseOption(user, "Account, line 1", /1110 Main operating account/, { search: "1110" });
  await user.type(screen.getByLabelText("Debit, line 1"), "1,500,000");
  await chooseOption(user, "Account, line 2", /4100 Tuition/, { search: "4100" });
  await user.type(screen.getByLabelText("Credit, line 2"), "1500000");
}

// Typing-heavy: the default 5s is not enough when the whole suite runs at once.
describe("JournalEditor", { timeout: 20_000 }, () => {
  it("shows the balance as it is typed, and asks for the dimension the account needs", async () => {
    const user = userEvent.setup();
    render(<JournalEditor />);
    await keyFeesJournal(user);

    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
    expect(screen.getByText("Cost centre")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Required for this account.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await chooseOption(user, screen.getByRole("combobox", { name: /Cost centre/ }), /School of Engineering/, { search: "ENG" });
    api.create.mockResolvedValue({ id: "j-9" });
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        narration: "Fees received for first semester",
        lines: [
          expect.objectContaining({ accountId: "bank", debit: 150000000, credit: null }),
          expect.objectContaining({ accountId: "fees", credit: 150000000, costCentreId: "cc-1" }),
        ],
      }),
    );
    expect(push).toHaveBeenCalledWith("/suite/finance/journals/j-9?notice=saved");
  });

  it("says how far out an unbalanced journal is, and offers to put the difference on a line", async () => {
    const user = userEvent.setup();
    render(<JournalEditor />);
    await screen.findByRole("combobox", { name: "Account, line 1" });
    await chooseOption(user, "Account, line 1", /1110 Main operating account/, { search: "1110" });
    await user.type(screen.getByLabelText("Debit, line 1"), "250");
    await chooseOption(user, "Account, line 2", /4100 Tuition/, { search: "4100" });

    expect(screen.getByRole("status")).toHaveTextContent("Out by 250.00: credits are short");
    await user.click(screen.getByRole("button", { name: /Put the 250.00 difference on line 2/ }));
    expect(screen.getByLabelText("Credit, line 2")).toHaveValue("250.00");
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("puts the ledger's refusal next to the line and the date it is about", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(
      new ApiError("Invalid", 422, {
        "lines.1.cost_centre_id": ["That cost centre is closed or not open on 2026-09-30."],
        journal_date: ["PERIOD_LOCKED: July 2026 is locked. Post the adjustment in the next open month."],
      }),
    );
    render(<JournalEditor />);
    await keyFeesJournal(user);
    await chooseOption(user, screen.getByRole("combobox", { name: /Cost centre/ }), /School of Engineering/, { search: "ENG" });
    await user.click(screen.getByRole("button", { name: "Send for approval" }));

    expect(await screen.findByText("That cost centre is closed or not open on 2026-09-30.")).toBeInTheDocument();
    expect(screen.getByText("July 2026 is locked. Post the adjustment in the next open month.")).toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();
  });
});
