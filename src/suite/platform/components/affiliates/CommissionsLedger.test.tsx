import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import CommissionsLedger from "./CommissionsLedger";
import type { Commission } from "@/lib/api/affiliate-client";

/** Every commission across affiliates: filtered by status, reversed only with a reason. */

const api = vi.hoisted(() => ({ commissions: vi.fn(), approveCommission: vi.fn(), reverseCommission: vi.fn() }));

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, platformAffiliates: api };
});

let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/affiliates/commissions",
  useSearchParams: () => search,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: "super_admin", organisationId: null }, loading: false }),
}));

const ROW: Commission = {
  id: "c1",
  organisation: { name: "Acme Institute", slug: "acme" },
  affiliate: { id: "af1", name: "Tolu Adebayo", code: "TOLU10" },
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
};

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  api.commissions.mockResolvedValue({ data: [ROW], meta: { currentPage: 1, lastPage: 1, perPage: 20, total: 1 } });
});

describe("CommissionsLedger", () => {
  it("lists commissions with the affiliate, the base and the rate", async () => {
    render(<CommissionsLedger />);

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: /tolu adebayo/i })).toHaveAttribute("href", "/suite/platform/affiliates/af1");
    expect(within(table).getByText("₦100,000")).toBeInTheDocument();
    expect(within(table).getByText("20%")).toBeInTheDocument();
    expect(within(table).getByText("Ready to pay")).toBeInTheDocument();
  });

  it("opens on the status the link asked for", async () => {
    search = new URLSearchParams("status=approved");
    render(<CommissionsLedger />);

    await waitFor(() => expect(api.commissions).toHaveBeenCalledWith({ status: "approved", page: 1 }));
    expect(screen.getByRole("tab", { name: "Ready to pay" })).toHaveAttribute("aria-selected", "true");
  });

  it("reverses with a reason and drops the row from a status it has left", async () => {
    search = new URLSearchParams("status=approved");
    api.reverseCommission.mockResolvedValue({ ...ROW, status: "reversed", statusLabel: "Reversed", reversalNote: "Refunded" });
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <CommissionsLedger />
      </ConfirmProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /^reverse/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/reason/i), "Refunded");
    await user.click(within(dialog).getByRole("button", { name: "Reverse commission" }));

    await waitFor(() => expect(api.reverseCommission).toHaveBeenCalledWith("c1", "Refunded"));
    expect(await screen.findByText(/is reversed/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
