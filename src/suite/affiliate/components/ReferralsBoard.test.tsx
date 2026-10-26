import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ReferralsBoard from "./ReferralsBoard";
import { pageOf } from "./fixtures";
import { ApiError, type Page, type Referral } from "@/lib/api/affiliate-client";

/**
 * The organisations an affiliate referred. With none yet, the page says how
 * to get some; and a session that is no longer an affiliate's is told so in
 * words, not with "Not found".
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/affiliate/referrals",
  useSearchParams: () => new URLSearchParams(),
}));

const referrals = vi.fn<(page: number) => Promise<Page<Referral>>>();

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, myAffiliate: { ...actual.myAffiliate, referrals: (page: number) => referrals(page) } };
});

const REFERRAL: Referral = {
  id: "r1",
  organisation: { name: "Acme Holdings" },
  source: "signup",
  sourceLabel: "Signed up through your link",
  referredAt: "2026-09-10T09:00:00Z",
  firstPaidAt: "2026-10-01T09:00:00Z",
  status: "paying",
  statusLabel: "Paying",
  affiliate: null,
};

beforeEach(() => {
  window.localStorage.clear();
  referrals.mockReset().mockResolvedValue(pageOf([REFERRAL]));
});

describe("affiliate referrals", () => {
  it("lists the organisations referred", async () => {
    render(<ReferralsBoard />);

    expect(await screen.findByText("Acme Holdings")).toBeInTheDocument();
    expect(referrals).toHaveBeenCalledWith(1);
    expect(screen.getByText("Signed up through your link")).toBeInTheDocument();
    expect(screen.getByText("Paying")).toBeInTheDocument();
  });

  it("tells somebody with no referrals to share their link", async () => {
    referrals.mockResolvedValue(pageOf([]));
    render(<ReferralsBoard />);

    expect(await screen.findByText("No organisations yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get your link" })).toHaveAttribute("href", "/suite/affiliate");
  });

  it("explains a 404 as no longer being an affiliate", async () => {
    referrals.mockRejectedValue(new ApiError("Not found.", 404));
    render(<ReferralsBoard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't an affiliate account any more/);
  });
});
