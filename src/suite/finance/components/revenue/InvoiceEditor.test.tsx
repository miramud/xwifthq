import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Account } from "@/lib/api/finance-ledger-client";
import { chooseOption } from "@/test/selectOption";
import InvoiceEditor from "./InvoiceEditor";
import InvoiceDetail from "./InvoiceDetail";
import { CONTRACTS_META, contract, invoiceDetail } from "./fixtures";

/** Keying an invoice: totals worked out as the API will, what it sends, refusals put back on the line. */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  issue: vi.fn(),
  contracts: vi.fn(),
  forProject: vi.fn(),
  projects: vi.fn(),
  accounts: vi.fn(),
  counterparties: vi.fn(),
}));
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/lib/api/finance-revenue-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-revenue-client")>();
  return {
    ...actual,
    revenue: {
      ...actual.revenue,
      invoices: { ...actual.revenue.invoices, get: api.get, create: api.create, update: api.update, remove: api.remove, issue: api.issue },
      contracts: { ...actual.revenue.contracts, list: api.contracts, forProject: api.forProject },
      projects: api.projects,
    },
  };
});
vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, accounts: { ...actual.ledger.accounts, list: api.accounts } } };
});
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, lookups: { ...actual.orgFoundations.lookups, counterparties: api.counterparties } } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Accountant", organisationId: "o", permissions: [] }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/revenue/invoices/new",
  useSearchParams: () => new URLSearchParams(),
}));

const acct = (over: Partial<Account>): Account => ({
  id: "acc-4400",
  code: "4400",
  name: "Consultancy and research income",
  type: "revenue",
  subtype: null,
  parentId: null,
  level: 2,
  isPostable: true,
  normalBalance: "credit",
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

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  nav.push.mockReset();
  nav.replace.mockReset();
  api.contracts.mockResolvedValue({
    contracts: [
      contract({
        id: "ct-lsk",
        clientId: "cp-mlsb",
        client: "Meridian Library Services Board",
        title: "Library kiosks",
        project: { id: "proj-lsk", name: "Library Self-Service Kiosk", code: "LSK", status: "complete" },
        retentionBp: 500,
        expectedWhtBp: 500,
        vatApplicable: true,
        vatRateBp: 750,
      }),
    ],
    meta: CONTRACTS_META,
  });
  api.projects.mockResolvedValue([{ id: "proj-lsk", name: "Library Self-Service Kiosk", code: "LSK" }]);
  api.accounts.mockResolvedValue({ accounts: [acct({}), acct({ id: "acc-6100", code: "6100", name: "Salaries", type: "expense" })], templates: [], systemKeys: [] });
  api.counterparties.mockResolvedValue([
    { id: "cp-mlsb", code: "MLSB", name: "Meridian Library Services Board", roles: ["client"] },
    { id: "cp-kora", code: null, name: "Kora Cloud Ltd", roles: ["vendor"] },
  ]);
});

async function keyInvoice(user: ReturnType<typeof userEvent.setup>) {
  await chooseOption(user, await screen.findByRole("combobox", { name: /Client/ }), "Meridian Library Services Board");
  await user.type(screen.getByLabelText("Description, line 1"), "Kiosk installation, phase 2");
  await chooseOption(user, screen.getByRole("combobox", { name: "Revenue account" }), /4400 Consultancy/, { search: "4400" });
  await user.type(screen.getByLabelText("Amount, before VAT"), "7,500,000");
  const ret = screen.getByLabelText("Retention held (%)");
  await user.clear(ret);
  await user.type(ret, "5");
  const wht = screen.getByLabelText("WHT the client deducts (%)");
  await user.clear(wht);
  await user.type(wht, "5");
}

describe("InvoiceEditor", { timeout: 20_000 }, () => {
  it("works out VAT, retention, expected WHT and what the client pays now", async () => {
    const user = userEvent.setup();
    render(<InvoiceEditor />);
    await keyInvoice(user);
    const totals = screen.getByRole("heading", { name: "Totals" }).parentElement as HTMLElement;
    expect(within(totals).getByText("562,500.00")).toBeInTheDocument();
    expect(within(totals).getByText("8,062,500.00")).toBeInTheDocument();
    expect(within(totals).getByText("−403,125.00")).toBeInTheDocument();
    expect(within(totals).getByText("−375,000.00")).toBeInTheDocument();
    expect(within(totals).getByText("₦7,284,375.00")).toBeInTheDocument();
  });

  it("offers only revenue accounts, and saves a new draft with the lines in kobo", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue({ id: "inv-new", status: "draft" });
    render(<InvoiceEditor />);
    await keyInvoice(user);
    await user.click(screen.getByRole("combobox", { name: "Revenue account" }));
    expect(screen.queryByRole("option", { name: /6100 Salaries/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "cp-mlsb",
        retentionBp: 500,
        expectedWhtBp: 500,
        currency: "NGN",
        lines: [{ description: "Kiosk installation, phase 2", accountId: "acc-4400", amount: 7_500_000_00, vatRateBp: 750 }],
      }),
    );
    expect(nav.replace).toHaveBeenCalledWith("/suite/finance/revenue/invoices/inv-new?notice=saved");
  });

  it("asks for what is missing before calling the API, and puts the API's refusals on the line", async () => {
    const user = userEvent.setup();
    render(<InvoiceEditor />);
    await screen.findByRole("combobox", { name: /Client/ });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByText("Choose the client to invoice.")).toBeInTheDocument();
    expect(screen.getByText("Say what this line bills for.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await keyInvoice(user);
    api.create.mockRejectedValue(new ApiError("Invalid.", 422, { "lines.0.account_id": ["Choose the revenue account this line earns."] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Choose the revenue account this line earns.")).toBeInTheDocument();
  });

  it("takes the client, project, terms, VAT and revenue account from the contract's row", async () => {
    const user = userEvent.setup();
    render(<InvoiceEditor />);
    await chooseOption(user, await screen.findByRole("combobox", { name: /Contract/ }), "Library kiosks");
    expect(screen.getByRole("combobox", { name: /Client/ })).toHaveTextContent("Meridian Library Services Board");
    expect(screen.getByRole("combobox", { name: "Revenue account" })).toHaveTextContent("4400 Consultancy and research income");
    expect(screen.getByLabelText("VAT %")).toHaveValue("7.5");
    expect(screen.getByLabelText("Retention held (%)")).toHaveValue("5");
    expect(api.forProject).not.toHaveBeenCalled();
  });

  it("says who issued an invoice, and when", async () => {
    api.get.mockResolvedValue(invoiceDetail());
    render(<InvoiceDetail id="inv-3" />);
    expect(await screen.findByText(/Issued 2 Oct 2026, \d{2}:\d{2} by Ngozi Eze\./)).toBeInTheDocument();
  });

  it("says who voided an invoice, when, and the reason they gave", async () => {
    api.get.mockResolvedValue(invoiceDetail({ status: "void", voidedAt: "2026-10-04T15:30:00+01:00", voidedBy: "Tunde Bakare", voidReason: "Raised against the wrong contract" }));
    render(<InvoiceDetail id="inv-3" />);
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(/Voided by Tunde Bakare on 4 Oct 2026, \d{2}:\d{2}\./);
    expect(note).toHaveTextContent("stays in the register");
    expect(within(note).getByText("Raised against the wrong contract", { exact: false })).toBeInTheDocument();
  });

  it("still reads when an older void has no who or why", async () => {
    api.get.mockResolvedValue(invoiceDetail({ status: "void" }));
    render(<InvoiceDetail id="inv-3" />);
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent("Voided. Its journal was reversed");
    expect(note).not.toHaveTextContent("Reason:");
  });

  it("issues a draft on the date chosen, saving it first", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(invoiceDetail({ status: "draft", invoiceNo: null }));
    api.update.mockResolvedValue(invoiceDetail({ status: "draft", invoiceNo: null }));
    api.issue.mockResolvedValue({ id: "inv-3", invoiceNo: "INV/2026/0004", status: "issued", dueOn: "2026-11-05" });
    render(<InvoiceEditor invoiceId="inv-3" />);
    expect(await screen.findByDisplayValue("Kiosk installation, phase 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Issue invoice" }));
    const dialog = screen.getByRole("dialog");
    const date = within(dialog).getByLabelText("Issue date");
    await user.clear(date);
    await user.type(date, "2026-10-06");
    await user.click(within(dialog).getByRole("button", { name: "Issue invoice" }));
    expect(api.update).toHaveBeenCalledWith("inv-3", expect.objectContaining({ contractId: "ct-lsk", milestoneId: "ms-lsk-2" }));
    expect(api.issue).toHaveBeenCalledWith("inv-3", "2026-10-06");
    expect(nav.push).toHaveBeenCalledWith("/suite/finance/revenue/invoices/inv-3?notice=issued");
  });
});
