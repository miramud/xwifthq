import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Account } from "@/lib/api/finance-ledger-client";
import AccountsBoard from "./AccountsBoard";

/** The chart: a tree with balances, the missing-purpose warning, templates for an empty chart, and the code lock. */

const api = vi.hoisted(() => ({ list: vi.fn(), applyTemplate: vi.fn(), update: vi.fn(), trialBalance: vi.fn() }));
const csv = vi.hoisted(() => vi.fn());
vi.mock("../reports/shared", async (importOriginal) => ({ ...(await importOriginal<typeof import("../reports/shared")>()), downloadCsv: csv }));

vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return {
    ...actual,
    ledger: {
      ...actual.ledger,
      accounts: { ...actual.ledger.accounts, list: api.list, applyTemplate: api.applyTemplate, update: api.update },
      reports: { ...actual.ledger.reports, trialBalance: api.trialBalance },
    },
  };
});

vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u", role: "admin", name: "Bursar", organisationId: "o" }, loading: false }) }));

const acct = (over: Partial<Account>): Account => ({
  id: "a",
  code: "1000",
  name: "A",
  type: "asset",
  subtype: null,
  parentId: null,
  level: 1,
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
  used: false,
  aliases: [],
  ...over,
});

const CHART = [
  acct({ id: "h-assets", code: "1000", name: "Assets", isPostable: false }),
  acct({ id: "bank", code: "1110", name: "Main operating account", parentId: "h-assets", level: 2, isBank: true, used: true }),
  acct({ id: "h-rev", code: "4000", name: "Revenue", type: "revenue", normalBalance: "credit", isPostable: false }),
  acct({ id: "fees", code: "4100", name: "Tuition and academic fees", type: "revenue", normalBalance: "credit", parentId: "h-rev", level: 2, requires: ["cost centre"], requiresCostCentre: true, used: true }),
  acct({ id: "surplus", code: "3010", name: "Accumulated surplus", type: "equity", normalBalance: "credit", systemKey: "retained_earnings" }),
];

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  csv.mockReset();
  api.list.mockResolvedValue({
    accounts: CHART,
    templates: [{ key: "institution_v1", name: "Public tertiary institution", description: "Polytechnics and colleges." }],
    systemKeys: ["retained_earnings", "bank_charges"],
  });
  api.trialBalance.mockResolvedValue({
    rows: [
      { accountId: "bank", code: "1110", name: "Main operating account", type: "asset", openingDebit: 0, openingCredit: 0, debit: 500000, credit: 0, closingDebit: 500000, closingCredit: 0 },
      { accountId: "fees", code: "4100", name: "Tuition", type: "revenue", openingDebit: 0, openingCredit: 0, debit: 0, credit: 500000, closingDebit: 0, closingCredit: 500000 },
    ],
    totals: { openingDebit: 0, openingCredit: 0, debit: 500000, credit: 500000, closingDebit: 500000, closingCredit: 500000 },
    balanced: true,
    currency: "NGN",
  });
});

describe("AccountsBoard", () => {
  it("shows the tree by family with balances read the account's way, and what automatic postings still lack", async () => {
    render(<AccountsBoard />);

    const assets = (await screen.findByRole("table", { name: "Assets accounts" })) as HTMLElement;
    expect(within(assets).getByText("Main operating account")).toBeInTheDocument();
    expect(within(assets).getAllByText("5,000.00").length).toBeGreaterThan(0);

    const income = screen.getByRole("table", { name: "Income accounts" });
    expect(within(income).getByText("Needs cost centre")).toBeInTheDocument();
    // A credit balance on an income account reads as a positive figure.
    expect(within(income).getAllByText("5,000.00").length).toBeGreaterThan(0);

    expect(screen.getByText("Accumulated surplus", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Automatic postings need an account/)).toHaveTextContent("Bank charges");
  });

  it("collapses a heading and finds an account by search with its heading kept", async () => {
    const user = userEvent.setup();
    render(<AccountsBoard />);
    await screen.findByRole("table", { name: "Assets accounts" });

    await user.click(screen.getByRole("button", { name: "Collapse Assets" }));
    expect(screen.queryByText("Main operating account")).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search accounts" }), "tuition");
    expect(screen.getByText("Tuition and academic fees")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Assets accounts" })).not.toBeInTheDocument();
  });

  it("downloads the accounts listed, with the search applied, as CSV", async () => {
    const user = userEvent.setup();
    render(<AccountsBoard />);
    await screen.findByRole("table", { name: "Assets accounts" });
    await user.type(screen.getByRole("searchbox", { name: "Search accounts" }), "tuition");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    const [name, rows] = csv.mock.calls[0];
    expect(name).toBe("chart-of-accounts.csv");
    expect(rows.map((r: unknown[]) => r[0])).toEqual(["Code", "4000", "4100"]);
    expect(rows[2]).toEqual(["4100", "Tuition and academic fees", expect.any(String), "4000", "Posting", "Credit", "", "", "Open", "5000.00"]);
  });

  it("locks the code of an account that has postings", async () => {
    const user = userEvent.setup();
    render(<AccountsBoard />);
    await user.click(await screen.findByRole("button", { name: "Main operating account" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/Code/)).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
  });

  it("offers the templates when the chart is empty", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValueOnce({ accounts: [], templates: [{ key: "institution_v1", name: "Public tertiary institution", description: "Polytechnics and colleges." }], systemKeys: [] });
    api.applyTemplate.mockResolvedValue({ created: 96 });
    render(<AccountsBoard />);

    expect(await screen.findByRole("radio", { name: /Public tertiary institution/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Start from this chart" }));
    expect(api.applyTemplate).toHaveBeenCalledWith("institution_v1");
    expect(await screen.findByText("96 accounts created. Adjust any of them below.", { selector: "p:not(.sr-only)" })).toBeInTheDocument();
  });
});
