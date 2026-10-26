import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { chooseOption } from "@/test/selectOption";
import AffiliateDetail from "./AffiliateDetail";
import type { Commission, PlatformAffiliate, PlatformAffiliateDetail } from "@/lib/api/affiliate-client";

/**
 * One affiliate, from the platform's side. What carries weight: approving
 * sends the code we chose, a reversal never goes without a reason, and a
 * payout sends exactly the commissions ticked, never a typed amount.
 */

const api = vi.hoisted(() => ({
  get: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  suspend: vi.fn(),
  reinstate: vi.fn(),
  approveCommission: vi.fn(),
  reverseCommission: vi.fn(),
  recordPayout: vi.fn(),
}));

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, platformAffiliates: api };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/affiliates/af1",
  useSearchParams: () => new URLSearchParams(),
}));

let currentUser: Record<string, unknown> = { role: "super_admin", organisationId: null };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

function affiliate(over: Partial<PlatformAffiliate> = {}): PlatformAffiliate {
  return {
    id: "af1",
    name: "Tolu Adebayo",
    email: "tolu@example.com",
    code: null,
    link: null,
    status: "pending",
    statusLabel: "Pending",
    approvedAt: null,
    suspendedAt: null,
    createdAt: "2026-10-20T10:00:00Z",
    payoutDetails: null,
    phone: "+234 801 234 5678",
    country: "Nigeria",
    audienceUrl: "https://example.com/tolu",
    promotion: "I run a newsletter for school owners.",
    reviewNote: null,
    reviewedAt: null,
    hasAccount: false,
    ...over,
  };
}

function commission(over: Partial<Commission> = {}): Commission {
  return {
    id: "c1",
    organisation: { name: "Acme Institute", slug: "acme" },
    affiliate: null,
    sourceType: "seat_purchase",
    sourceLabel: "Seats",
    sourceReference: "EL-SEAT-1",
    currency: "NGN",
    paidMinor: 9_000_000,
    discountMinor: 1_000_000,
    baseMinor: 10_000_000,
    ratePercent: 20,
    amountMinor: 2_000_000,
    status: "approved",
    statusLabel: "Approved",
    earnedAt: "2026-09-01T10:00:00Z",
    availableAt: "2026-09-15T10:00:00Z",
    approvedAt: "2026-09-15T10:00:00Z",
    reversedAt: null,
    reversalNote: null,
    payout: null,
    ...over,
  };
}

function detail(over: Partial<PlatformAffiliateDetail> = {}): PlatformAffiliateDetail {
  return { affiliate: affiliate(), stats: null, referrals: [], commissions: [], payouts: [], ...over };
}

const ACTIVE = affiliate({ status: "approved", statusLabel: "Approved", code: "TOLU10", link: "https://xwifthq.com/?ref=TOLU10" });

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "super_admin", organisationId: null };
  api.get.mockResolvedValue(detail());
});

function renderDetail() {
  return render(
    <ConfirmProvider>
      <AffiliateDetail affiliateId="af1" />
    </ConfirmProvider>,
  );
}

describe("AffiliateDetail: an application", () => {
  it("shows the application and approves it with the code we chose", async () => {
    api.approve.mockResolvedValue(ACTIVE);
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText("I run a newsletter for school owners.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/tolu" })).toHaveAttribute("href", "https://example.com/tolu");

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog", { name: /approve tolu adebayo/i });
    expect(dialog).toHaveTextContent(/generates one/i);

    await user.type(within(dialog).getByLabelText(/code/i), "TOLU10");
    await user.click(within(dialog).getByRole("button", { name: "Approve affiliate" }));

    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("af1", { code: "TOLU10" }));
    expect(await screen.findByText(/approved with the code TOLU10/)).toBeInTheDocument();
  });

  it("shows a 422 against the code", async () => {
    const { ApiError } = await import("@/lib/api/affiliate-client");
    api.approve.mockRejectedValue(new ApiError("The given data was invalid.", 422, { code: ["That code is taken."] }));
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/code/i), "TAKEN");
    await user.click(within(dialog).getByRole("button", { name: "Approve affiliate" }));

    expect(await within(dialog).findByText("That code is taken.")).toBeInTheDocument();
  });

  it("turns an application down with a note", async () => {
    api.reject.mockResolvedValue(affiliate({ status: "rejected", statusLabel: "Rejected" }));
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: "Turn down" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/note to them/i), "Not a fit right now.");
    await user.click(within(dialog).getByRole("button", { name: "Turn down application" }));

    await waitFor(() => expect(api.reject).toHaveBeenCalledWith("af1", { note: "Not a fit right now." }));
  });

  it("offers no decisions to staff who can only view", async () => {
    currentUser = { role: "platform_staff", permissions: ["platform.affiliates.view"] };
    renderDetail();

    await screen.findByText("I run a newsletter for school owners.");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn down" })).not.toBeInTheDocument();
  });
});

describe("AffiliateDetail: commissions", () => {
  it("won't reverse a commission without a reason", async () => {
    api.get.mockResolvedValue(detail({ affiliate: ACTIVE, commissions: [commission({ status: "pending", statusLabel: "Pending" })] }));
    api.reverseCommission.mockImplementation(async (id: string, note: string) =>
      commission({ id, status: "reversed", statusLabel: "Reversed", reversalNote: note }),
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /^reverse/i }));
    const dialog = await screen.findByRole("dialog", { name: /reverse this commission/i });
    const submit = within(dialog).getByRole("button", { name: "Reverse commission" });
    expect(submit).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/reason/i), "Payment refunded");
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(api.reverseCommission).toHaveBeenCalledWith("c1", "Payment refunded"));
    expect(await screen.findByText(/₦20,000 is reversed/)).toBeInTheDocument();
  });

  it("warns that a paid commission was already paid out", async () => {
    api.get.mockResolvedValue(
      detail({
        affiliate: ACTIVE,
        commissions: [commission({ status: "paid", statusLabel: "Paid", payout: { id: "p1", reference: "AFP-0001", paidOn: "2026-10-01" } })],
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /^reverse/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/already paid out in AFP-0001/);
  });

  it("approves a held commission early after asking", async () => {
    api.get.mockResolvedValue(detail({ affiliate: ACTIVE, commissions: [commission({ status: "pending", statusLabel: "Pending" })] }));
    api.approveCommission.mockResolvedValue(commission());
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /approve now/i }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Approve now" }));

    await waitFor(() => expect(api.approveCommission).toHaveBeenCalledWith("c1"));
  });
});

describe("AffiliateDetail: recording a payout", () => {
  it("sends the currency, method, date and the ticked commissions, with the total worked out", async () => {
    api.get.mockResolvedValue(
      detail({
        affiliate: ACTIVE,
        commissions: [
          commission({ id: "c1", amountMinor: 2_000_000, organisation: { name: "Acme Institute", slug: "acme" } }),
          commission({ id: "c2", amountMinor: 500_000, organisation: { name: "Bola Academy", slug: "bola" } }),
          commission({ id: "c3", currency: "USD", amountMinor: 4_000, organisation: { name: "Kite School", slug: "kite" } }),
          commission({ id: "c4", status: "pending", statusLabel: "Pending", organisation: { name: "Held Ltd", slug: "held" } }),
        ],
      }),
    );
    api.recordPayout.mockResolvedValue({
      id: "p1",
      reference: "AFP-0002",
      currency: "NGN",
      amountMinor: 2_000_000,
      method: "cheque",
      methodLabel: "Cheque",
      paymentReference: "CHQ-881",
      paidOn: "2026-10-26",
      note: null,
      commissionCount: 1,
      affiliate: null,
      recordedBy: "Owner",
      createdAt: null,
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: "Record a payout" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a payout" });

    // Every ready NGN commission is ticked to start; held ones and USD aren't offered.
    const acme = within(dialog).getByRole("checkbox", { name: /acme institute/i });
    const bola = within(dialog).getByRole("checkbox", { name: /bola academy/i });
    expect(acme).toBeChecked();
    expect(bola).toBeChecked();
    expect(within(dialog).queryByRole("checkbox", { name: /held ltd/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: /kite school/i })).not.toBeInTheDocument();
    const total = within(dialog).getByText(/^Total/);
    expect(total).toHaveTextContent("Total ₦25,000");

    await user.click(bola);
    expect(total).toHaveTextContent("Total ₦20,000");

    await chooseOption(user, within(dialog).getByLabelText("Method"), "Cheque");
    await user.type(within(dialog).getByLabelText(/payment reference/i), "CHQ-881");
    const paidOn = within(dialog).getByLabelText("Paid on") as HTMLInputElement;
    expect(paidOn.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await user.click(within(dialog).getByRole("button", { name: "Record payout" }));

    await waitFor(() =>
      expect(api.recordPayout).toHaveBeenCalledWith("af1", {
        currency: "NGN",
        commissionIds: ["c1"],
        method: "cheque",
        reference: "CHQ-881",
        paidOn: paidOn.value,
        note: undefined,
      }),
    );
    expect(await screen.findByText(/Payout AFP-0002 recorded/)).toBeInTheDocument();
  }, 15_000);

  it("can't be opened when nothing is ready to pay", async () => {
    api.get.mockResolvedValue(detail({ affiliate: ACTIVE, commissions: [commission({ status: "pending", statusLabel: "Pending" })] }));
    renderDetail();

    expect(await screen.findByRole("button", { name: "Record a payout" })).toBeDisabled();
  });
});
