import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RulesBoard from "./RulesBoard";
import type { BankRule } from "@/lib/api/finance-banking-client";

/** Statement rules: priority order, the live tester, switching a rule off, keywords, and the fee table in kobo. */

const api = vi.hoisted(() => ({ book: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), addKeyword: vi.fn(), removeKeyword: vi.fn(), saveFeeBands: vi.fn() }));

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, rules: api } };
});
vi.mock("@/suite/finance/components/banking/lookups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/suite/finance/components/banking/lookups")>();
  const options: Record<string, { value: string; label: string }[]> = {
    accounts: [{ value: "acc-lt", label: "5300 · Local transport" }],
    projects: [{ value: "p-1", label: "Library extension" }],
  };
  return { ...actual, useLookup: (k: string) => ({ status: "ready", options: options[k] ?? [] }) };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Me" }, loading: false }) }));

const rule = (over: Partial<BankRule>): BankRule => ({
  id: "r",
  priority: 100,
  name: "Rule",
  direction: "DR",
  pattern: "X",
  amountMin: null,
  amountMax: null,
  category: null,
  systemKey: null,
  accountId: null,
  costCentreId: null,
  projectId: null,
  action: "classify",
  active: true,
  hits: 0,
  ...over,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.book.mockResolvedValue({
    rules: [
      rule({ id: "r-100", priority: 100, name: "Transfer to another bank", pattern: "^CIB/UTO/(?<purpose>[^/]+)/(?<cp>.+)", category: "payment", action: "split_fee", hits: 7 }),
      rule({ id: "r-10", priority: 10, name: "SMS alert charges", pattern: "^SMS", category: "bank_charge", systemKey: "bank_charges", hits: 12 }),
      rule({ id: "r-85", priority: 85, name: "Ride-hailing", pattern: "\\bBOLT\\b", category: "payment", accountId: "acc-lt" }),
    ],
    keywords: [{ id: "k-1", keyword: "LIBX", projectId: "p-1", project: "Library extension" }],
    feeBands: [
      { upTo: 500_000, fee: 1_000, vat: 75 },
      { upTo: null, fee: 5_000, vat: 375 },
    ],
  });
});

describe("RulesBoard", () => {
  it("lists rules in the order they run, with what each sets", async () => {
    render(<RulesBoard />);
    const table = await screen.findByRole("table", { name: "Statement rules in priority order" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["10", "85", "100"]);
    expect(within(rows[0]).getByText("Bank charges")).toBeInTheDocument();
    expect(within(rows[1]).getByText("5300 · Local transport")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Split transfer fee")).toBeInTheDocument();
    expect(screen.getByText("LIBX")).toBeInTheDocument();
  });

  it("tests a pattern live and shows the payee and purpose it reads", async () => {
    const user = userEvent.setup();
    api.update.mockImplementation(async (id: string, body: Partial<BankRule>) => rule({ id, ...body, name: body.name ?? "Rule" }));
    render(<RulesBoard />);

    await user.click(await screen.findByRole("button", { name: "Transfer to another bank" }));
    const dialog = screen.getByRole("dialog", { name: "Edit rule" });
    await user.type(within(dialog).getByLabelText("Narration to test"), "CIB/UTO/Diesel supply/Adex Ventures Ltd");
    expect(within(dialog).getByText("ADEX VENTURES LTD")).toBeInTheDocument();
    expect(within(dialog).getByText("DIESEL SUPPLY")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("radio", { name: "In" }));
    expect(within(dialog).getByText("This rule only looks at money going out.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    expect(api.update).toHaveBeenCalledWith("r-100", expect.objectContaining({ priority: 100, direction: "DR", action: "split_fee", pattern: "^CIB/UTO/(?<purpose>[^/]+)/(?<cp>.+)" }));
  });

  it("switches a rule off, and puts it back when the API refuses", async () => {
    const user = userEvent.setup();
    api.update.mockRejectedValueOnce(new Error("offline"));
    render(<RulesBoard />);
    const toggle = await screen.findByRole("switch", { name: "Use “SMS alert charges”" });
    await user.click(toggle);
    expect(api.update).toHaveBeenCalledWith("r-10", { active: false });
    expect(await screen.findByText(/wasn't switched off/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("saves the fee table in kobo", async () => {
    const user = userEvent.setup();
    api.saveFeeBands.mockImplementation(async (bands: unknown) => bands);
    render(<RulesBoard />);
    const fee = await screen.findByLabelText("Band 1: fee");
    expect(fee).toHaveValue("10.00");
    await user.clear(fee);
    await user.type(fee, "26.88");
    await user.click(screen.getByRole("button", { name: "Save fee table" }));
    expect(api.saveFeeBands).toHaveBeenCalledWith([
      { upTo: 500_000, fee: 2_688, vat: 75 },
      { upTo: null, fee: 5_000, vat: 375 },
    ]);
    expect(await screen.findByText(/Fee table saved/)).toBeInTheDocument();
  });

  it("adds a project keyword", async () => {
    const user = userEvent.setup();
    api.addKeyword.mockResolvedValue({ id: "k-2", keyword: "TETF", projectId: "p-1" });
    render(<RulesBoard />);
    await user.type(await screen.findByLabelText("Word"), "tetf");
    await user.click(screen.getAllByLabelText("Project").at(-1) as HTMLElement);
    await user.click(screen.getByRole("option", { name: /Library extension/ }));
    await user.click(screen.getByRole("button", { name: "Add keyword" }));
    expect(api.addKeyword).toHaveBeenCalledWith("tetf", "p-1");
    expect(await screen.findByText("TETF")).toBeInTheDocument();
  });
});
