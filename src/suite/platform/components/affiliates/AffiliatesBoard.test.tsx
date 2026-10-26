import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AffiliatesBoard from "./AffiliatesBoard";
import type { PlatformAffiliateRow, PlatformProgrammeStats } from "@/lib/api/affiliate-client";

/**
 * The affiliate list. Applications are the queue: their tab comes first with
 * the count waiting, and the page opens on it unless the link says otherwise.
 */

const api = vi.hoisted(() => ({ list: vi.fn(), overview: vi.fn() }));

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, platformAffiliates: api };
});

let search = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/affiliates",
  useSearchParams: () => search,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { role: "super_admin", organisationId: null }, loading: false }),
}));

function row(over: Partial<PlatformAffiliateRow> = {}): PlatformAffiliateRow {
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
    phone: null,
    country: null,
    audienceUrl: null,
    promotion: "Newsletter",
    reviewNote: null,
    reviewedAt: null,
    hasAccount: false,
    referralCount: 0,
    payingReferralCount: 0,
    earned: {},
    ...over,
  };
}

const STATS: PlatformProgrammeStats = {
  affiliates: { pending: 3, approved: 12, suspended: 1, rejected: 2 },
  clicksLast30Days: 400,
  referrals: 20,
  payingReferrals: 5,
  conversionPercent: 25,
  earnings: { NGN: { pending: 1_000_000, approved: 4_000_000, paid: 9_000_000, reversed: 0 } },
  paidOut: { NGN: 9_000_000 },
  referredRevenue: { NGN: 50_000_000 },
  topAffiliates: [{ id: "af9", name: "Bola Ade", code: "BOLA", currency: "NGN", earnedMinor: 6_000_000, organisations: 4 }],
  months: [],
};

function page(rows: PlatformAffiliateRow[]) {
  return { data: rows, meta: { currentPage: 1, lastPage: 1, perPage: 20, total: rows.length } };
}

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  api.overview.mockResolvedValue({
    programme: { open: true, commissionPercent: 20, discountPercent: 10, cookieDays: 60, holdDays: 14 },
    stats: STATS,
  });
  api.list.mockResolvedValue(page([row()]));
});

describe("AffiliatesBoard", () => {
  it("opens on applications, the first tab, with the count waiting", async () => {
    render(<AffiliatesBoard />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("Applications");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(tabs[0]).toHaveTextContent("3"));

    await waitFor(() => expect(api.list).toHaveBeenCalledWith({ status: "pending", search: undefined, page: 1 }));
    const table = await screen.findByRole("table");
    const link = within(table).getByRole("link", { name: /tolu adebayo/i });
    expect(link).toHaveAttribute("href", "/suite/platform/affiliates/af1");
  });

  it("shows the programme's figures, money kept in its currency", async () => {
    render(<AffiliatesBoard />);

    expect(await screen.findByText("Applications waiting")).toBeInTheDocument();
    expect(screen.getByText("₦40K")).toBeInTheDocument();
    expect(screen.getByText(/5 paying · 25% convert/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bola ade/i })).toHaveAttribute("href", "/suite/platform/affiliates/af9");
  });

  it("changes status through the tabs and keeps it in the address", async () => {
    const user = userEvent.setup();
    render(<AffiliatesBoard />);

    await user.click(screen.getByRole("tab", { name: "Active" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: "approved", search: undefined, page: 1 }));
    expect(replace).toHaveBeenCalledWith("/suite/platform/affiliates?status=approved");
  });

  it("opens on the status the link asked for", async () => {
    search = new URLSearchParams("status=suspended");
    render(<AffiliatesBoard />);

    await waitFor(() => expect(api.list).toHaveBeenCalledWith({ status: "suspended", search: undefined, page: 1 }));
  });

  it("searches on the server", async () => {
    const user = userEvent.setup();
    render(<AffiliatesBoard />);

    await user.type(screen.getByLabelText("Search affiliates"), "tolu");
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: "pending", search: "tolu", page: 1 }));
  });
});
