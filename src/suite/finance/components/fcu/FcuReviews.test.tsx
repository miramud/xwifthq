import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FcuMemoReview, FcuRetirementReview, FcuVoucherReview } from "./FcuReviews";
import { memoFull, voucherFull } from "@/suite/finance/components/requests/fixtures";

/** The review screens: the document beside its checklist, the outcome, and the thread. */

const api = vi.hoisted(() => ({
  memo: vi.fn(),
  voucher: vi.fn(),
  queues: vi.fn(),
  reviewMemo: vi.fn(),
  reviewVoucher: vi.fn(),
  reviewRetirement: vi.fn(),
  retirement: vi.fn(),
  message: vi.fn(),
  search: { value: "" },
}));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: {
      ...actual.spend,
      memos: { ...actual.spend.memos, get: api.memo },
      vouchers: { ...actual.spend.vouchers, get: api.voucher },
      fcu: { ...actual.spend.fcu, queues: api.queues, reviewMemo: api.reviewMemo, reviewVoucher: api.reviewVoucher, reviewRetirement: api.reviewRetirement, retirement: api.retirement, message: api.message },
    },
  };
});
vi.mock("@/suite/finance/components/banking/lookups", () => ({ useLookup: () => ({ status: "ready", options: [{ value: "p1", label: "Campus network upgrade" }] }), lookupText: () => "" }));
vi.mock("@/lib/api/finance-banking-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-banking-client")>();
  return { ...actual, banking: { ...actual.banking, accounts: { ...actual.banking.accounts, list: vi.fn().mockResolvedValue([]) } } };
});
vi.mock("@/lib/api/org-foundations-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/org-foundations-client")>();
  return { ...actual, orgFoundations: { ...actual.orgFoundations, lookups: { ...actual.orgFoundations.lookups, costCentres: vi.fn().mockResolvedValue([]) } } };
});
vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "u-ruth", role: "user", name: "Ruth Akande", organisationId: "o", permissions: ["finance.fcu.review_memo", "finance.fcu.review_voucher", "finance.fcu.review_retirement"] }, loading: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams(api.search.value) }));

const CHECKLISTS = {
  "1": { documents: "All required documents are attached", amount: "The amount agrees with the invoice" },
  "2": { agrees: "The voucher agrees with the cleared memo", tax: "WHT and VAT are computed correctly" },
  "4": { receipts: "Receipts support each line spent", amounts: "Spent plus cash returned equals the advance" },
};

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === "function" && f.mockReset());
  api.search.value = "";
  api.queues.mockResolvedValue({ memos: [], vouchers: [], payments: [], retirements: [{ id: "r1", memoId: "adv1", person: "Tunde Bello", advanced: 200_000_00, spent: 150_000_00, refund: 50_000_00, waitingDays: 1 }], checklists: CHECKLISTS });
});

describe("FcuMemoReview", () => {
  it("puts the memo beside its checklist and clears it", async () => {
    const user = userEvent.setup();
    api.memo.mockResolvedValue(memoFull());
    api.reviewMemo.mockResolvedValue(memoFull({ status: "fcu_cleared" }));
    render(<FcuMemoReview id="m1" />);

    expect(await screen.findByRole("heading", { name: "Swiftlink: September fibre lease" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download swiftlink-sep.pdf" })).toHaveAttribute("href", "/api/finance/me/documents/d1");
    expect(screen.getByText("Released")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Mark the rest OK" }));
    await user.click(screen.getByRole("button", { name: "Clear for payment" }));
    expect(api.reviewMemo).toHaveBeenCalledWith("m1", { items: { documents: { result: "ok", comment: null }, amount: { result: "ok", comment: null } }, outcome: "cleared", comment: null });
    expect(await screen.findByText("Cleared. Finance can now prepare the voucher.")).toBeInTheDocument();
  });

  it("says why it can't be vetted when it isn't waiting for the FCU", async () => {
    api.memo.mockResolvedValue(memoFull({ status: "in_approval" }));
    render(<FcuMemoReview id="m1" />);
    expect(await screen.findByText(/This memo isn't waiting for the FCU: it is in approval/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear for payment" })).toBeDisabled();
  });

  it("lets the FCU reply in a thread and close it", async () => {
    const user = userEvent.setup();
    api.memo.mockResolvedValue(
      memoFull({
        status: "awaiting_fcu",
        queries: [{ id: "q1", checkpoint: 1, status: "answered", raisedBy: "Ruth Akande", raisedAt: null, messages: [{ id: "a", author: "Tunde Bello", authorId: "u-tunde", body: "Corrected invoice attached.", at: null }] }],
      }),
    );
    api.message.mockResolvedValue([]);
    render(<FcuMemoReview id="m1" />);
    await user.click(await screen.findByRole("button", { name: "Close the query" }));
    expect(api.message).toHaveBeenCalledWith("q1", { close: true });
  });
});

describe("FcuVoucherReview", () => {
  it("shows the memo the voucher pays and pre-audits it", async () => {
    const user = userEvent.setup();
    api.voucher.mockResolvedValue(voucherFull({ status: "submitted_to_fcu" }));
    api.memo.mockResolvedValue(memoFull({ status: "fcu_cleared" }));
    api.reviewVoucher.mockResolvedValue(voucherFull({ status: "in_approval" }));
    render(<FcuVoucherReview id="pv1" />);

    expect(await screen.findByRole("link", { name: /PM-2026-0007/ })).toHaveAttribute("href", "/suite/finance/memos/m1");
    expect(screen.getByText(/Zenith Bank •••• 4421/)).toBeInTheDocument();
    expect(screen.getByText(/from the vendor register/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Mark the rest OK" }));
    await user.click(screen.getByRole("button", { name: "Clear for authorisation" }));
    expect(api.reviewVoucher).toHaveBeenCalledWith("pv1", expect.objectContaining({ outcome: "cleared" }));
    expect(await screen.findByText(/gone to its authorisers/)).toBeInTheDocument();
  });
});

describe("FcuRetirementReview", () => {
  const advance = (status: "submitted" | "posted") =>
    memoFull({
      id: "adv1",
      type: "advance",
      status: "awaiting_retirement",
      retirement: {
        id: "r1",
        status,
        advanced: 200_000_00,
        spent: 150_000_00,
        refund: 50_000_00,
        refundBankAccountId: "b1",
        journalId: null,
        lines: [{ account: { id: "a", code: "6200", name: "Travel" }, projectId: "p1", costCentreId: null, description: "Hotel, two nights", amount: 150_000_00 }],
        documents: [],
        queries: [],
      },
    });

  it("loads the retirement by its own id and shows the sum", async () => {
    api.retirement.mockResolvedValue(advance("submitted"));
    render(<FcuRetirementReview id="r1" />);
    expect(await screen.findByText("Hotel, two nights")).toBeInTheDocument();
    expect(api.retirement).toHaveBeenCalledWith("r1");
    expect(api.memo).not.toHaveBeenCalled();
    expect(screen.getByText(/6200 · Travel · Campus network upgrade/)).toBeInTheDocument();
    expect(within(screen.getByText("Difference").parentElement as HTMLElement).getByText("Balances")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Clear and post" })).toBeDisabled();
  });

  it("still opens once the retirement has left the queue, and says it is not waiting", async () => {
    api.retirement.mockResolvedValue(advance("posted"));
    render(<FcuRetirementReview id="r1" />);
    expect(await screen.findByText("Hotel, two nights")).toBeInTheDocument();
    expect(await screen.findByText(/isn't waiting for the FCU/)).toBeInTheDocument();
  });
});
