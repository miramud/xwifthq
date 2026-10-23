import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingComplete } from "./OnboardingComplete";
import { CLAIM_STORAGE_KEY, ONBOARDING_STORAGE_KEY } from "@/lib/api/public-pricing";

let search = new URLSearchParams();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/get-started/complete",
  useSearchParams: () => search,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ refresh, user: { role: "admin", organisationId: "org-1", modules: [] } }),
}));

const fetchMock = vi.fn();

function verifyReturns(data: Record<string, unknown>) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));
}

const PAID = {
  status: "paid",
  organisation: { name: "Acme Ltd", slug: "acme-ltd" },
  email: "ada@acme.test",
  modules: [
    { key: "lms", label: "Learning", deliveredWhenReleased: false },
    { key: "finance", label: "Finance", deliveredWhenReleased: true },
  ],
};

/** Back from the gateway: confirm with the API, then sign the new admin in. */
describe("onboarding complete", () => {
  beforeEach(() => {
    search = new URLSearchParams("tx_ref=EL-ONB-1&status=successful&transaction_id=99");
    refresh.mockReset();
    fetchMock.mockReset();
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("verifies with the claim token and, once paid and signed in, asks for a password", async () => {
    window.sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify({ reference: "EL-ONB-1", claimToken: "claim-123" }));
    window.sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ modules: ["lms"], currency: "NGN" }));
    verifyReturns({ ...PAID, signedIn: true });

    render(<OnboardingComplete />);

    expect(await screen.findByText("Acme Ltd is ready")).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/onboarding/verify");
    expect(JSON.parse(String(init.body))).toEqual({ reference: "EL-ONB-1", claimToken: "claim-123" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText("Delivered when released")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set your password" }).getAttribute("href")).toBe(
      "/set-password?redirect=%2Fsuite",
    );
    expect(window.sessionStorage.getItem(CLAIM_STORAGE_KEY)).toBeNull();
  });

  it("sends the admin to sign in when this browser didn't start the checkout", async () => {
    verifyReturns({ ...PAID, signedIn: false });
    render(<OnboardingComplete />);

    expect(await screen.findByText("Acme Ltd is ready")).toBeTruthy();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).claimToken).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?email=ada%40acme.test");
  });

  it("keeps checking a clearing payment, then says the email will follow", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ data: { status: "pending", organisation: null, email: "ada@acme.test", modules: [], signedIn: false } }),
          { status: 200 },
        ),
    );
    render(<OnboardingComplete />);

    expect(await screen.findByText("Waiting for your payment to clear…")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(3000 * 5);

    expect(await screen.findByText("Your payment is still clearing")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("offers a retry, with the saved choices, when the payment failed", async () => {
    window.sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ modules: ["lms", "hrm"], currency: "USD" }));
    verifyReturns({ status: "failed", organisation: null, email: "ada@acme.test", modules: [], signedIn: false });
    render(<OnboardingComplete />);

    expect(await screen.findByText("Your payment didn't go through")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe(
      "/get-started?step=3&modules=lms,hrm&currency=USD",
    );
  });

  it("explains a return link without a reference", () => {
    search = new URLSearchParams();
    render(<OnboardingComplete />);

    expect(screen.getByText("This link is missing its payment reference")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
