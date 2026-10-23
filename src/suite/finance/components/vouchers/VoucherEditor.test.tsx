import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type Account } from "@/lib/api/finance-ledger-client";
import { chooseOption } from "@/test/selectOption";
import VoucherEditor from "./VoucherEditor";
import { resetDimensionLists } from "../journals/dimensions";
import { WHT, bank, detail, memo } from "./fixtures";

/** Coding a voucher: live WHT and net, the memo meter, and refusals placed where they belong. */

const api = vi.hoisted(() => ({
  memo: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  wht: vi.fn(),
  accounts: vi.fn(),
  banks: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/finance-payments-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-payments-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      memos: { get: api.memo },
      vouchers: { ...actual.spend.vouchers, get: api.get, create: api.create, update: api.update, submit: api.submit, whtRates: api.wht },
    },
  };
});
vi.mock("@/lib/api/finance-ledger-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-ledger-client")>();
  return { ...actual, ledger: { ...actual.ledger, accounts: { ...actual.ledger.accounts, list: api.accounts } } };
});
vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: api.banks } } };
});
vi.mock("@/lib/api/finance-request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-request")>();
  return { ...actual, financeRequest: async () => ({ data: [{ id: "proj-1", name: "Student Portal Rebuild", code: "SPR" }] }) };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/finance/vouchers/new",
  useSearchParams: () => new URLSearchParams(),
}));

const acct = (over: Partial<Account>): Account => ({
  id: "acc-it",
  code: "6420",
  name: "IT services",
  type: "expense",
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

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  push.mockReset();
  resetDimensionLists();
  api.memo.mockResolvedValue(memo());
  api.wht.mockResolvedValue(WHT);
  api.accounts.mockResolvedValue({ accounts: [acct({})], templates: [], systemKeys: [] });
  api.banks.mockResolvedValue([bank()]);
});

async function codeLine(user: ReturnType<typeof userEvent.setup>, gross: string, vat: string) {
  await screen.findByRole("combobox", { name: "Account, line 1" });
  await chooseOption(user, "Account, line 1", /6420 IT services/, { search: "6420" });
  await user.type(screen.getByLabelText("Gross, before VAT, line 1"), gross);
  await user.type(screen.getByLabelText("VAT, line 1"), vat);
  await chooseOption(user, "WHT class, line 1", /Technical services/, { search: "Technical" });
}

describe("VoucherEditor", () => {
  it("shows the cleared memo, works out WHT on the amount before VAT, and says how much is left", async () => {
    const user = userEvent.setup();
    render(<VoucherEditor memoId="memo-1" />);
    expect(await screen.findByText(/PM\/2026\/10\/0007/)).toBeInTheDocument();
    expect(screen.getByText("Kora Cloud Ltd")).toBeInTheDocument();

    await codeLine(user, "1,000,000", "75,000");
    // 10% of 1,000,000 = 100,000; net = 1,000,000 + 75,000 − 100,000.
    expect(screen.getAllByText("100,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("975,000.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Within the memo balance: ₦125,000.00 left after this voucher");
  });

  it("warns when the voucher exceeds the memo, and sends the coded lines", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(detail());
    render(<VoucherEditor memoId="memo-1" />);
    await codeLine(user, "1,200,000", "90,000");
    expect(screen.getByRole("status")).toHaveTextContent("Exceeds the memo balance by ₦90,000.00");

    await user.clear(screen.getByLabelText("VAT, line 1"));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(api.create).toHaveBeenCalledWith(
      "memo-1",
      expect.objectContaining({
        payingBankAccountId: null,
        lines: [expect.objectContaining({ accountId: "acc-it", gross: 1_200_000_00, vat: 0, whtCode: "technical", projectId: "proj-1", description: "Cloud hosting, Q4" })],
      }),
    );
    expect(push).toHaveBeenCalledWith("/suite/finance/vouchers/pv-3?notice=saved");
  });

  it("asks for a reason when the WHT rate is changed", async () => {
    const user = userEvent.setup();
    render(<VoucherEditor memoId="memo-1" />);
    await codeLine(user, "100,000", "0");
    await user.click(screen.getByRole("button", { name: /Show project, category and rate, line 1/ }));
    await user.click(screen.getByLabelText("Change the rate"));
    const rate = screen.getByLabelText("WHT rate (%)");
    await user.clear(rate);
    await user.type(rate, "5");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Changing the table rate needs a reason.")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    api.create.mockResolvedValue(detail());
    await user.type(screen.getByLabelText(/Why the rate changes/), "Exemption certificate on file");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(api.create.mock.calls[0][1].lines[0]).toMatchObject({ whtCode: "technical", whtRateBp: 500, whtOverrideReason: "Exemption certificate on file" });
  });

  it("shows a refusal in plain words, without the API's code", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { lines: ["PV_EXCEEDS_MEMO: the memo has 1,000.00 left; this voucher is for 2,000.00. Amend the memo (it goes back for approval) to pay more."] }),
    );
    render(<VoucherEditor memoId="memo-1" />);
    await codeLine(user, "1,000", "0");
    await user.click(screen.getByRole("button", { name: "Send to FCU" }));
    const alert = await screen.findByText(/the memo has 1,000.00 left/);
    expect(alert.textContent).not.toMatch(/PV_EXCEEDS_MEMO/);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("pays an advance in one line to staff advances by sending no lines", async () => {
    const user = userEvent.setup();
    api.memo.mockResolvedValue(memo({ type: "advance", payee: { kind: "staff", id: "u-9", name: "Chidi Okafor" }, approvedAmount: 50_000_00, amount: 50_000_00, balance: 50_000_00 }));
    api.create.mockResolvedValue(detail({ id: "pv-2" }));
    render(<VoucherEditor memoId="memo-1" />);
    expect(await screen.findByText(/One line,/)).toBeInTheDocument();
    await chooseOption(user, screen.getByRole("combobox", { name: "Paid from" }), /UBA Operations/, { search: false });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    const input = api.create.mock.calls[0][1];
    expect(input.lines).toBeUndefined();
    expect(input.payingBankAccountId).toBe("bank-1");
  });

  it("refuses to prepare a voucher from a memo the FCU hasn't cleared", async () => {
    api.memo.mockResolvedValue(memo({ status: "awaiting_fcu" }));
    render(<VoucherEditor memoId="memo-1" />);
    expect(await screen.findByText(/isn't cleared yet/)).toBeInTheDocument();
  });
});
