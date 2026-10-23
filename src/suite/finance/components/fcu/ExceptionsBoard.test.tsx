import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExceptionsBoard from "./ExceptionsBoard";
import { OPTIONS, memoFull } from "@/suite/finance/components/requests/fixtures";
import type { FcuExceptions } from "@/lib/api/finance-spend-client";

/** The exceptions board: grouped, counted, each one linked to where it is put right - and regularised or expired from here. */

const api = vi.hoisted(() => ({
  exceptions: vi.fn(),
  regularise: vi.fn(),
  expire: vi.fn(),
  options: vi.fn(),
  user: { id: "u-ruth", role: "user", name: "Ruth Akande", organisationId: "o", permissions: ["finance.fcu.view"] as string[] },
}));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      fcu: { ...actual.spend.fcu, exceptions: api.exceptions, regularise: api.regularise },
      memos: { ...actual.spend.memos, expire: api.expire },
      me: { ...actual.spend.me, options: api.options },
    },
  };
});
vi.mock("@/lib/api/org-foundations-client", () => ({
  orgFoundations: {
    lookups: {
      counterparties: () => Promise.resolve([{ id: "v-ecn", name: "ECN Printing Ltd", code: "CP-1" }]),
      costCentres: () => Promise.resolve([]),
    },
  },
}));
vi.mock("@/suite/org/components/foundations/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/suite/org/components/foundations/shared")>();
  return { ...actual, PersonSelect: () => <div>people</div> };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: api.user, loading: false }) }));

const EMPTY: FcuExceptions = { unauthorisedPayments: [], unmatchedProvisional: [], memosNotCleared: [], unretiredAdvances: [], postFacto: [], ageingCommitments: [] };

const debit = {
  type: "UNAUTHORISED_PAYMENT" as const,
  lineId: "l1",
  importId: "imp1",
  date: "2026-09-07",
  narration: "NIP TRF ECN PRINTING",
  amount: 75_000_00,
  principal: 75_000_00,
  posted: false,
  bankAccount: "Main operating account",
  counterpartyId: "v-ecn",
  counterparty: "ECN Printing Ltd",
  projectId: "p-portal",
  regularising: null,
};

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === "function" && f.mockReset());
  api.user = { id: "u-ruth", role: "user", name: "Ruth Akande", organisationId: "o", permissions: ["finance.fcu.view"] };
  api.options.mockResolvedValue(OPTIONS);
});

describe("ExceptionsBoard", () => {
  it("groups and links each exception", async () => {
    api.exceptions.mockResolvedValue({
      unauthorisedPayments: [{ type: "UNAUTHORISED_PAYMENT", lineId: "l1", importId: "imp1", date: "2026-09-07", narration: "NIP TRF UNKNOWN", amount: 75_000_00, posted: false }],
      unmatchedProvisional: [{ type: "UNMATCHED_PROVISIONAL", pvId: "pv1", pvNo: "PV-2026-0003", payee: "Swiftlink Networks", amount: 1_150_000_00, confirmedAt: "2026-09-05" }],
      memosNotCleared: [],
      unretiredAdvances: [{ type: "UNRETIRED_ADVANCE", memoId: "adv1", reference: "PM-2026-0002", person: "Tunde Bello", amount: 200_000_00, since: "2026-08-01" }],
      postFacto: [],
    });
    render(<ExceptionsBoard />);

    expect(await screen.findByRole("link", { name: /NIP TRF UNKNOWN/ })).toHaveAttribute("href", "/suite/finance/banking/imports/imp1");
    expect(screen.getByRole("link", { name: /PV-2026-0003 · Swiftlink Networks/ })).toHaveAttribute("href", "/suite/finance/fcu/payments/pv1");
    expect(screen.getByRole("link", { name: /Tunde Bello/ })).toHaveAttribute("href", "/suite/finance/memos/adv1");
    expect(screen.getByText("₦75,000.00 out of the bank")).toBeInTheDocument();
    // Not cleared in time, raised after the spend, ageing commitments: none.
    expect(screen.getAllByText("None.")).toHaveLength(3);
    // No regularise key: no button.
    expect(screen.queryByRole("button", { name: /Regularise/ })).not.toBeInTheDocument();
  });

  it("says so when there is nothing to chase", async () => {
    api.exceptions.mockResolvedValue(EMPTY);
    render(<ExceptionsBoard />);
    expect(await screen.findByText("No exceptions")).toBeInTheDocument();
  });

  it("regularises a debit with a post-facto memo, prefilled from the statement line", async () => {
    const user = userEvent.setup();
    api.user = { ...api.user, permissions: ["finance.fcu.view", "finance.fcu.regularise"] };
    api.exceptions.mockResolvedValueOnce({ ...EMPTY, unauthorisedPayments: [debit] });
    api.exceptions.mockResolvedValueOnce({
      ...EMPTY,
      unauthorisedPayments: [{ ...debit, regularising: { memoId: "m9", reference: "MEMO/2026/09/0009", status: "draft" } }],
      postFacto: [{ type: "POST_FACTO", memoId: "m9", reference: "MEMO/2026/09/0009", title: "Post-facto: NIP TRF ECN PRINTING", amount: 75_000_00, status: "draft", paidOn: "2026-09-07", vouchers: [] }],
    });
    api.regularise.mockResolvedValue({ memo: memoFull({ id: "m9", reference: "MEMO/2026/09/0009", postFacto: true, status: "draft" }), submitError: "Attach before sending: Invoice." });
    render(<ExceptionsBoard />);

    await user.click(await screen.findByRole("button", { name: "Regularise NIP TRF ECN PRINTING" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Debit, no voucher")).toBeInTheDocument();
    expect(within(dialog).getByText(/matched this debit to ECN Printing Ltd/)).toBeInTheDocument();

    // The reason is required.
    await user.click(within(dialog).getByRole("button", { name: "Raise post-facto memo" }));
    expect(within(dialog).getByText("Say why it was paid without authority.")).toBeInTheDocument();
    expect(api.regularise).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/Why it was paid without authority/), "Urgent repairs paid from the portal");
    await user.click(within(dialog).getByRole("button", { name: "Raise post-facto memo" }));
    expect(api.regularise).toHaveBeenCalledWith("l1", {
      explanation: "Urgent repairs paid from the portal",
      projectId: "p-portal",
      costCentreId: null,
      costCategory: null,
      payeeCounterpartyId: "v-ecn",
      payeeUserId: null,
    });

    expect(await screen.findByText(/MEMO\/2026\/09\/0009 is raised as a draft: Attach before sending: Invoice./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the memo" })).toHaveAttribute("href", "/suite/finance/requests/m9");
    expect(await screen.findByText("Regularising · MEMO/2026/09/0009")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Regularise/ })).not.toBeInTheDocument();
  }, 20_000);

  it("lists ageing commitments and expires one past its date with a reason", async () => {
    const user = userEvent.setup();
    api.user = { ...api.user, permissions: ["finance.fcu.view", "finance.memos.expire"] };
    const ageing = {
      type: "AGEING_COMMITMENT" as const,
      memoId: "m3",
      reference: "MEMO/2026/06/0003",
      title: "Library chairs",
      amount: 400_000_00,
      requester: "Tunde Bello",
      project: "Library",
      status: "fcu_cleared" as const,
      approvedAt: "2026-06-01",
      ageDays: 98,
      expiresOn: "2026-08-30",
      expirable: true,
      reminded: true,
    };
    api.exceptions.mockResolvedValue({ ...EMPTY, ageingCommitments: [ageing, { ...ageing, memoId: "m4", reference: "MEMO/2026/07/0004", title: "Printer toner", ageDays: 65, expiresOn: "2026-10-05", expirable: false }] });
    api.expire.mockResolvedValue(memoFull({ id: "m3", status: "expired" }));
    render(<ExceptionsBoard />);

    expect(await screen.findByText("Past expiry")).toBeInTheDocument();
    expect(screen.getByText("Expires 5 Oct 2026")).toBeInTheDocument();
    // Early expiry is for whoever sets the limits: not offered here.
    expect(screen.queryByRole("button", { name: "Expire MEMO/2026/07/0004" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expire MEMO/2026/06/0003" }));
    await user.type(screen.getByLabelText("Why it is expired"), "Order cancelled");
    await user.click(screen.getByRole("button", { name: "Expire memo" }));
    expect(api.expire).toHaveBeenCalledWith("m3", "Order cancelled", false);
    expect(await screen.findByText(/MEMO\/2026\/06\/0003 has expired and its funds are released/)).toBeInTheDocument();
  }, 20_000);
});
