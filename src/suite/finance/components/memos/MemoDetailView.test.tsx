import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemoDetailView from "./MemoDetailView";
import { memoFull } from "@/suite/finance/components/requests/fixtures";

/** Finance's view of a request: the reviews item by item, the voucher door, the MD's override, and the requester redirect. */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  override: vi.fn(),
  expire: vi.fn(),
  funds: vi.fn(),
  replace: vi.fn(),
  user: { id: "u", role: "user", name: "Amaka Obi", organisationId: "o", permissions: [] as string[] },
}));
vi.mock("@/lib/api/finance-spend-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/finance-spend-client")>();
  return {
    ...actual,
    spend: { ...actual.spend, memos: { ...actual.spend.memos, get: api.get, override: api.override, expire: api.expire }, me: { ...actual.spend.me, funds: api.funds } },
  };
});
vi.mock("@/lib/auth-store", () => ({ useAuth: () => ({ user: api.user, loading: false }) }));
const router = vi.hoisted(() => ({ push: () => undefined, replace: (...a: unknown[]) => api.replace(...a), refresh: () => undefined, back: () => undefined, prefetch: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/suite/finance/memos/m1", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  Object.values(api).forEach((f) => typeof f === "function" && f.mockReset());
});

describe("MemoDetailView", () => {
  it("sends a requester without Finance access to their own view of it", () => {
    api.user = { id: "u-tunde", role: "user", name: "Tunde Bello", organisationId: "o", permissions: [] };
    render(<MemoDetailView id="m1" />);
    expect(api.replace).toHaveBeenCalledWith("/suite/finance/requests/m1");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("shows each FCU mark and offers the voucher once cleared", async () => {
    api.user = { id: "u", role: "user", name: "Amaka Obi", organisationId: "o", permissions: ["finance.memos.view", "finance.vouchers.view", "finance.vouchers.create"] };
    api.get.mockResolvedValue(
      memoFull({
        status: "fcu_cleared",
        reviews: [
          {
            id: "r1",
            checkpoint: 1,
            outcome: "cleared",
            reviewer: "Ruth Akande",
            comment: null,
            at: "2026-09-03T12:00:00+01:00",
            items: [
              { code: "documents", label: "All required documents are attached", result: "ok", comment: null },
              { code: "quotes", label: "The three-quote rule is met where it applies", result: "na", comment: null },
            ],
          },
        ],
      }),
    );
    render(<MemoDetailView id="m1" />);
    expect(await screen.findByText("All required documents are attached")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create voucher" })).toHaveAttribute("href", "/suite/finance/vouchers/new?memo=m1");
    expect(screen.queryByRole("button", { name: "Cancel it" })).not.toBeInTheDocument();
  });

  it("marks a post-facto memo and lets Finance expire an unpaid one past its date, with a reason", async () => {
    const user = userEvent.setup();
    api.user = { id: "fc", role: "user", name: "Controller", organisationId: "o", permissions: ["finance.memos.view", "finance.memos.expire"] };
    const memo = memoFull({ status: "awaiting_fcu", postFacto: true, expirable: true, pastExpiry: true, approvedAt: "2026-06-01T09:00:00+01:00", expiresOn: "2026-08-30" });
    api.get.mockResolvedValue(memo);
    api.expire.mockResolvedValue({ ...memo, status: "expired", expirable: false, expiryReason: "Never delivered", expiredAt: "2026-09-02T09:00:00+01:00" });
    render(<MemoDetailView id="m1" />);

    expect(await screen.findByText("Post-facto")).toBeInTheDocument();
    expect(screen.getByText(/regularises a bank debit paid without authority/)).toBeInTheDocument();
    expect(screen.getByText(/Past expiry/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expire it" }));
    await user.type(screen.getByLabelText("Why it is expired"), "Never delivered");
    await user.click(screen.getByRole("button", { name: "Expire request" }));
    expect(api.expire).toHaveBeenCalledWith("m1", "Never delivered", false);
    expect(await screen.findByText(/Expired. Its commitment on the project is released/)).toBeInTheDocument();
  }, 15_000);

  it("offers early expiry only to whoever may change the spend settings", async () => {
    api.user = { id: "fc", role: "user", name: "Clerk", organisationId: "o", permissions: ["finance.memos.view", "finance.memos.expire"] };
    api.get.mockResolvedValue(memoFull({ status: "fcu_cleared", expirable: true, pastExpiry: false, approvedAt: "2026-09-01T09:00:00+01:00", expiresOn: "2026-11-30" }));
    render(<MemoDetailView id="m1" />);
    expect(await screen.findByText(/Expires 30 Nov 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expire early" })).not.toBeInTheDocument();
  });

  it("lets the MD send a draft beyond the project's funds, with a reason", async () => {
    const user = userEvent.setup();
    api.user = { id: "md", role: "user", name: "MD", organisationId: "o", permissions: ["finance.memos.view", "finance.memos.override"] };
    const draft = memoFull({ status: "draft", amount: 2_000_000_00, fundsSnapshot: null });
    api.get.mockResolvedValue(draft);
    api.funds.mockResolvedValue({ controlled: true, hasBudget: true, hasRelease: true, available: 1_000_000_00 });
    api.override.mockResolvedValue({ ...draft, overrideReason: "Board approved the early order" });
    render(<MemoDetailView id="m1" />);

    await user.click(await screen.findByRole("button", { name: "Allow beyond funds" }));
    expect(screen.getByText(/The project has ₦1,000,000.00 available; this asks for ₦2,000,000.00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record the override" }));
    expect(screen.getByText(/Give the reason for going beyond the funds/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reason"), "Board approved the early order");
    await user.click(screen.getByRole("button", { name: "Record the override" }));
    expect(api.override).toHaveBeenCalledWith("m1", "Board approved the early order");
    expect(await screen.findByText(/Override recorded/)).toBeInTheDocument();
  }, 15_000);
});
