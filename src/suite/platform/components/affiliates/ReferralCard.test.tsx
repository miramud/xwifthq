import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import ReferralCard from "./ReferralCard";
import type { OrganisationReferral, Referral } from "@/lib/api/affiliate-client";

/** A referral recorded by hand on an organisation, until it has paid. */

const api = vi.hoisted(() => ({ organisationReferral: vi.fn(), attachReferral: vi.fn(), detachReferral: vi.fn() }));

vi.mock("@/lib/api/affiliate-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/affiliate-client")>();
  return { ...actual, platformAffiliates: api };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/organisations/acme",
  useSearchParams: () => new URLSearchParams(),
}));

let currentUser: Record<string, unknown> = { role: "super_admin", organisationId: null };

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
}));

function referral(over: Partial<Referral> = {}): Referral {
  return {
    id: "r1",
    organisation: { name: "Acme Institute", slug: "acme" },
    source: "manual",
    sourceLabel: "Recorded by hand",
    referredAt: "2026-10-20T10:00:00Z",
    firstPaidAt: null,
    status: "signed_up",
    statusLabel: "Signed up",
    affiliate: { id: "af1", name: "Tolu Adebayo", code: "TOLU10" },
    ...over,
  };
}

const NONE: OrganisationReferral = { referral: null, discountPercent: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "super_admin", organisationId: null };
  api.organisationReferral.mockResolvedValue(NONE);
});

function renderCard() {
  return render(
    <ConfirmProvider>
      <ReferralCard slug="acme" />
    </ConfirmProvider>,
  );
}

describe("ReferralCard", () => {
  it("records a referral by the affiliate's code and says the next payment is discounted", async () => {
    api.attachReferral.mockResolvedValue({ referral: referral(), discountPercent: 10 });
    const user = userEvent.setup();
    renderCard();

    expect(await screen.findByText("No affiliate.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Affiliate code"), " TOLU10 ");
    await user.click(screen.getByRole("button", { name: "Record referral" }));

    await waitFor(() => expect(api.attachReferral).toHaveBeenCalledWith("acme", "TOLU10"));
    const link = await screen.findByRole("link", { name: /tolu adebayo/i });
    expect(link).toHaveAttribute("href", "/suite/platform/affiliates/af1");
    expect(link).toHaveTextContent("Tolu Adebayo (TOLU10)");
    expect(screen.getByText(/next payment gets the 10% referral discount/i)).toBeInTheDocument();
  });

  it("shows why a code was refused", async () => {
    const { ApiError } = await import("@/lib/api/affiliate-client");
    api.attachReferral.mockRejectedValue(new ApiError("Invalid.", 422, { code: ["No active affiliate has that code."] }));
    const user = userEvent.setup();
    renderCard();

    await user.type(await screen.findByLabelText("Affiliate code"), "NOPE");
    await user.click(screen.getByRole("button", { name: "Record referral" }));

    expect(await screen.findByText("No active affiliate has that code.")).toBeInTheDocument();
  });

  it("removes a referral before the organisation has paid, after asking", async () => {
    api.organisationReferral.mockResolvedValue({ referral: referral(), discountPercent: 10 });
    api.detachReferral.mockResolvedValue(NONE);
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove referral" }));

    await waitFor(() => expect(api.detachReferral).toHaveBeenCalledWith("acme"));
    expect(await screen.findByText("No affiliate.")).toBeInTheDocument();
  });

  it("can't remove a referral once the organisation has paid", async () => {
    api.organisationReferral.mockResolvedValue({
      referral: referral({ firstPaidAt: "2026-10-22T10:00:00Z", status: "paying", statusLabel: "Paying" }),
      discountPercent: 0,
    });
    renderCard();

    expect(await screen.findByText(/^Paid/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows nothing, and asks nothing, to staff without affiliate access", () => {
    currentUser = { role: "platform_staff", permissions: ["platform.organisations.view"] };
    const { container } = renderCard();

    expect(container).toBeEmptyDOMElement();
    expect(api.organisationReferral).not.toHaveBeenCalled();
  });
});
