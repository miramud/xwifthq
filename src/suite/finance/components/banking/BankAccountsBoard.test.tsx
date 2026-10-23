import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BankAccountsBoard from "./BankAccountsBoard";
import { account } from "./fixtures";

/** Bank accounts: book against bank in words, totals by currency, low balance, and adding an account. */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), glAccounts: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.list, create: api.create }, glAccounts: api.glAccounts } };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: { id: "u-1", role: "admin", name: "Me" }, loading: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/banking",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  api.glAccounts.mockResolvedValue([
    { id: "gl-9", code: "1190", name: "Spare bank", type: "asset", isPostable: true, isBank: true, currency: "NGN", systemKey: null, active: true },
    { id: "gl-1", code: "1110", name: "UBA operating", type: "asset", isPostable: true, isBank: true, currency: "NGN", systemKey: null, active: true },
  ]);
});

describe("BankAccountsBoard", () => {
  it("shows each account's book against bank, and flags a low balance", async () => {
    api.list.mockResolvedValue([
      account(),
      account({ id: "ba-2", name: "UBA fees account", glAccount: { id: "gl-2", code: "1120", name: "Fees" }, bookBalance: 12_000_000_00, bankBalance: 10_000_000_00, unreconciledCount: 10, unreconciledValue: 2_000_000_00 }),
      account({ id: "ba-3", name: "Zenith TETFund", bankCode: "zenith", glAccount: { id: "gl-3", code: "1130", name: "TETFund" }, bankBalance: null, bankBalanceDate: null, lowBalanceThreshold: 5_000_000_00 }),
      account({ id: "ba-4", name: "USD domiciliary", currency: "USD", glAccount: { id: "gl-4", code: "1140", name: "Dom" }, bookBalance: 1_000_00, bankBalance: 900_00, lowBalanceThreshold: 5_000_00 }),
    ]);
    render(<BankAccountsBoard />);

    const list = await screen.findByRole("list", { name: "Bank accounts" });
    const cards = within(list).getAllByRole("link");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByText("Books agree with the bank")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Books higher by ₦2,000,000.00")).toBeInTheDocument();
    expect(within(cards[1]).getByText(/10 not posted/)).toBeInTheDocument();
    expect(within(cards[2]).getByText("No statement yet")).toBeInTheDocument();
    expect(within(cards[3]).getByText("Below $5,000.00")).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute("href", "/suite/finance/banking/ba-1");

    expect(screen.getByText("Cash at bank · NGN")).toBeInTheDocument();
    expect(screen.getByText("Cash at bank · USD")).toBeInTheDocument();
    expect(screen.getByText("Below the low-balance line")).toBeInTheDocument();
  });

  it("invites the first account when there are none", async () => {
    api.list.mockResolvedValue([]);
    render(<BankAccountsBoard />);
    expect(await screen.findByText("No bank accounts yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add the first account" })).toBeInTheDocument();
  });

  it("checks the form, then adds the account and opens it", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([account()]);
    api.create.mockResolvedValue(account({ id: "ba-new" }));
    render(<BankAccountsBoard />);

    await user.click(await screen.findByRole("button", { name: "Add bank account" }));
    const dialog = screen.getByRole("dialog", { name: "Add bank account" });
    await user.click(within(dialog).getByRole("button", { name: "Add bank account" }));
    expect(within(dialog).getByText(/Give the account a name/)).toBeInTheDocument();
    expect(within(dialog).getByText(/6 to 20 digits/)).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Account name"), "UBA capital projects");
    await user.type(within(dialog).getByLabelText("Account number"), "1023456789");
    await user.type(within(dialog).getByLabelText(/Low-balance warning/), "5,000,000");
    await user.click(within(dialog).getByRole("button", { name: "Add bank account" }));

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "UBA capital projects", bankCode: "uba", accountNumber: "1023456789", currency: "NGN", glAccountId: null, lowBalanceThreshold: 5_000_000_00 }),
    );
    expect(push).toHaveBeenCalledWith("/suite/finance/banking/ba-new");
  });
});
