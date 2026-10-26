import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverviewBoard from "./OverviewBoard";
import { myAffiliateOf } from "./fixtures";
import type { MyAffiliate } from "@/lib/api/affiliate-client";

/**
 * The affiliate's front page. What matters: the terms and figures are the
 * API's, the link is there and copies (and says so), a suspended affiliate is
 * told their link is paused and is not offered it to share, and missing bank
 * details are asked for.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/affiliate",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn<() => Promise<MyAffiliate>>();

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, myAffiliate: { ...actual.myAffiliate, get: () => get() } };
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(myAffiliateOf());
});

describe("affiliate overview", () => {
  it("states the terms and shows the figures from the API", async () => {
    render(<OverviewBoard />);

    expect(
      await screen.findByText("10% off a referred organisation's first payment; you earn 20% of it, before their discount."),
    ).toBeInTheDocument();
    // Ready to pay is the approved figure, on hold is mentioned beside it.
    expect(screen.getByText("Ready to pay", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("₦20,000", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("₦10,000 more is on hold for up to 14 days")).toBeInTheDocument();

    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.getByText("57 in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("37.5% of those referred")).toBeInTheDocument();
    // Earned leaves the reversed ₦5,000 out: 10,000 + 20,000 + 15,000.
    expect(screen.getByText("₦45,000")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "How you earn" })).toBeInTheDocument();
    expect(screen.getByText(/on a ₦50,000 price they pay ₦45,000 and you earn ₦10,000/)).toBeInTheDocument();
  });

  it("shows the link and code, and copies the link with a confirmation", async () => {
    const user = userEvent.setup();
    render(<OverviewBoard />);

    expect(await screen.findByLabelText("Referral link")).toHaveValue("https://xwifthq.com/?ref=AMAKA10");
    expect(screen.getByText("AMAKA10")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy your link" }));

    await expect(navigator.clipboard.readText()).resolves.toBe("https://xwifthq.com/?ref=AMAKA10");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your link is copied.");

    await user.click(screen.getByRole("button", { name: "Copy code" }));
    await expect(navigator.clipboard.readText()).resolves.toBe("AMAKA10");
    expect(screen.getByRole("status")).toHaveTextContent("Your code is copied.");
  });

  it("tells a suspended affiliate their link is paused, and does not offer it to share", async () => {
    get.mockResolvedValue(myAffiliateOf({ status: "suspended", statusLabel: "Suspended" }));
    render(<OverviewBoard />);

    expect(await screen.findByText("Your link is paused")).toBeInTheDocument();
    expect(screen.getByText(/earn nothing new/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy your link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    // History stays visible.
    expect(screen.getByText("₦45,000")).toBeInTheDocument();
  });

  it("asks for bank details when none are saved", async () => {
    get.mockResolvedValue(myAffiliateOf({ payoutDetails: null }));
    render(<OverviewBoard />);

    const callout = await screen.findByRole("link", { name: /Add your bank details/ });
    expect(callout).toHaveAttribute("href", "/suite/affiliate/settings");
  });
});
