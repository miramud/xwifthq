import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard } from "./OnboardingWizard";
import { CLAIM_STORAGE_KEY, DEFAULT_PRICING } from "@/lib/api/public-pricing";
import { clearReferralCode, storedReferralCode } from "@/lib/referral";

/** The owner's switch on: the wizard ends at the gateway. */
const PAYING = { ...DEFAULT_PRICING, paymentsEnabled: true };
/** The switch off (the default): the wizard ends in a licence request. */
const REQUESTING = { ...DEFAULT_PRICING, paymentsEnabled: false };

let search = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/get-started",
  useSearchParams: () => search,
}));

const fetchMock = vi.fn();
const assign = vi.fn();
const originalLocation = window.location;

// Filled in one step rather than typed key by key: the behaviour under test is
// the flow, and per-keystroke typing is what times out on a loaded machine.
async function fillDetails(user: ReturnType<typeof userEvent.setup>, { terms = true } = {}) {
  fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Acme Ltd" } });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Obi" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+234 803 000 0000" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@acme.test" } });
  if (terms) await user.click(screen.getByRole("checkbox", { name: /authorised to buy/ }));
}

/** New organisations: choose modules, give details, pay once. */
describe("onboarding wizard", () => {
  beforeEach(() => {
    search = new URLSearchParams("count=3&currency=NGN");
    replace.mockReset();
    fetchMock.mockReset();
    assign.mockReset();
    window.sessionStorage.clear();
    clearReferralCode();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: { ...originalLocation, assign } });
  });

  afterEach(() => {
    clearReferralCode();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", { configurable: true, writable: true, value: originalLocation });
  });

  it("preselects the tier's modules and prices them", () => {
    render(<OnboardingWizard pricing={DEFAULT_PRICING} />);

    expect((screen.getByRole("checkbox", { name: /Learning/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /^HR/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Projects/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Finance/ }) as HTMLInputElement).checked).toBe(false);

    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("₦6,000,000")).toBeTruthy();
  });

  it("reprices as modules change", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={DEFAULT_PRICING} />);

    await user.click(screen.getByRole("checkbox", { name: /Finance/ }));
    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("₦8,500,000")).toBeTruthy();
    expect(within(summary).getByText("When released")).toBeTruthy();
  });

  it("asks for the organisation, name, email, phone and consent before review", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={PAYING} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await user.click(screen.getByRole("button", { name: /Review your order/ }));

    expect(screen.getByText("Enter your organisation's name.")).toBeTruthy();
    expect(screen.getByText("Enter your full name.")).toBeTruthy();
    expect(screen.getByText("Enter your work email.")).toBeTruthy();
    expect(screen.getByText("Enter a phone number.")).toBeTruthy();
    expect(screen.getByText("Confirm you can buy on your organisation's behalf.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "not-an-email" } });
    await user.click(screen.getByRole("button", { name: /Review your order/ }));
    expect(screen.getByText(/Enter a valid email address/)).toBeTruthy();
  });

  it("starts checkout, keeps the claim token, and goes to the gateway", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            reference: "EL-ONB-1",
            authorizationUrl: "https://checkout.flutterwave.test/pay/abc",
            gateway: "flutterwave",
            claimToken: "claim-123",
          },
        }),
        { status: 200 },
      ),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={PAYING} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await fillDetails(user);
    await user.click(screen.getByRole("button", { name: /Review your order/ }));
    await user.click(screen.getByRole("button", { name: "Pay ₦6,000,000" }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/onboarding/checkout");
    expect(JSON.parse(String(init.body))).toMatchObject({
      organisationName: "Acme Ltd",
      name: "Ada Obi",
      email: "ada@acme.test",
      phone: "+234 803 000 0000",
      modules: ["lms", "hrm", "projects"],
      currency: "NGN",
      acceptTerms: true,
      website: "",
    });
    expect(JSON.parse(window.sessionStorage.getItem(CLAIM_STORAGE_KEY) ?? "{}")).toEqual({
      reference: "EL-ONB-1",
      claimToken: "claim-123",
    });
    expect(assign).toHaveBeenCalledWith("https://checkout.flutterwave.test/pay/abc");
  });

  it("sends somebody who already has an account to sign in", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "The given data was invalid.",
          errors: { email: ["This email already has an account. Sign in and use Plan & billing."] },
        }),
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={PAYING} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await fillDetails(user);
    await user.click(screen.getByRole("button", { name: /Review your order/ }));
    await user.click(screen.getByRole("button", { name: "Pay ₦6,000,000" }));

    expect(await screen.findByText(/This email already has an account/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toContain("/login?email=ada%40acme.test");
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a licence request with the modules instead of paying while payment is off", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "sr-9", reference: "SR-4F9A21C7" } }), { status: 201 }),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={REQUESTING} />);

    const summary = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(summary).getByText("₦6,000,000")).toBeTruthy();
    expect(within(summary).getByText(/invoiced, not charged now/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    // A request doesn't ask anybody to accept purchase terms.
    expect(screen.queryByRole("checkbox", { name: /authorised to buy/ })).toBeNull();
    await fillDetails(user, { terms: false });
    await user.click(screen.getByRole("button", { name: /Review your request/ }));

    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Anything we should know/), { target: { value: "Start in October" } });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("SR-4F9A21C7")).toBeTruthy();
    expect(screen.getByText(/Request sent, Ada/)).toBeTruthy();
    expect(screen.getByText(/confirmation email is on its way/)).toBeTruthy();
    expect(screen.getByText("ada@acme.test")).toBeTruthy();
    expect(screen.getByText("What happens next")).toBeTruthy();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/sales-requests");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "licence",
      organisationName: "Acme Ltd",
      name: "Ada Obi",
      email: "ada@acme.test",
      phone: "+234 803 000 0000",
      message: "Start in October",
      modules: ["lms", "hrm", "projects"],
      currency: "NGN",
      website: "",
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps a rejected request on the review step with the reason", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: "The given data was invalid.", errors: { modules: ["Choose modules we sell."] } }),
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard pricing={REQUESTING} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await fillDetails(user, { terms: false });
    await user.click(screen.getByRole("button", { name: /Review your request/ }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Choose modules we sell.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send request" })).toBeTruthy();
  });

  describe("a referral", () => {
    const codeCheck = (valid: boolean, code = "ADA20") =>
      new Response(
        JSON.stringify({
          data: { valid, code: valid ? code : null, firstName: valid ? "Ada" : null, discountPercent: 10, cookieDays: 60 },
        }),
        { status: 200 },
      );

    it("takes the discount off a code from an affiliate link and sends it with checkout", async () => {
      document.cookie = "xw_ref=ADA20; path=/";
      fetchMock.mockImplementation(async (url: string) => {
        if (url.startsWith("/api/public/affiliates/codes/")) return codeCheck(true);
        return new Response(
          JSON.stringify({
            data: { reference: "EL-ONB-2", authorizationUrl: "https://checkout.test/pay", gateway: "flutterwave", claimToken: "c" },
          }),
          { status: 200 },
        );
      });
      const user = userEvent.setup();
      render(<OnboardingWizard pricing={PAYING} />);

      const summary = screen.getByRole("complementary", { name: "Order summary" });
      expect(await within(summary).findByText(/Referred by Ada/)).toBeTruthy();
      expect(within(summary).getByText(/10% off your first payment/)).toBeTruthy();
      expect(within(summary).getByText("₦6,000,000")).toBeTruthy();
      expect(within(summary).getByText("Referral discount (10%)")).toBeTruthy();
      expect(within(summary).getByText("-₦600,000")).toBeTruthy();
      expect(within(summary).getByText("₦5,400,000")).toBeTruthy();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/public/affiliates/codes/ADA20");

      await user.click(screen.getByRole("button", { name: /Continue/ }));
      await fillDetails(user);
      await user.click(screen.getByRole("button", { name: /Review your order/ }));
      await user.click(screen.getByRole("button", { name: "Pay ₦5,400,000" }));

      const checkout = fetchMock.mock.calls.find(([url]) => url === "/api/onboarding/checkout") as [string, RequestInit];
      expect(JSON.parse(String(checkout[1].body))).toMatchObject({ referralCode: "ADA20", modules: ["lms", "hrm", "projects"] });
      expect(assign).toHaveBeenCalledWith("https://checkout.test/pay");
    });

    it("prices in full and sends no code when the stored one is no longer live", async () => {
      document.cookie = "xw_ref=OLDCODE; path=/";
      fetchMock.mockResolvedValue(codeCheck(false));
      render(<OnboardingWizard pricing={PAYING} />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const summary = screen.getByRole("complementary", { name: "Order summary" });
      expect(within(summary).queryByText(/Referred by/)).toBeNull();
      expect(within(summary).getByText("₦6,000,000")).toBeTruthy();
    });

    it("lets somebody enter a code, says when it isn't valid, and remove one that is", async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard pricing={REQUESTING} />);

      await user.click(screen.getByRole("button", { name: "Have a referral code?" }));
      fireEvent.change(screen.getByLabelText("Referral code"), { target: { value: "nope1" } });
      fetchMock.mockResolvedValueOnce(codeCheck(false));
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(await screen.findByText(/isn't active/)).toBeTruthy();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/public/affiliates/codes/NOPE1");

      fireEvent.change(screen.getByLabelText("Referral code"), { target: { value: "ada20" } });
      fetchMock.mockResolvedValueOnce(codeCheck(true));
      await user.click(screen.getByRole("button", { name: "Apply" }));

      const summary = screen.getByRole("complementary", { name: "Order summary" });
      expect(await within(summary).findByText(/Referred by Ada/)).toBeTruthy();
      expect(within(summary).getByText("₦5,400,000")).toBeTruthy();
      expect(within(summary).getByText(/comes off your first payment/)).toBeTruthy();
      expect(storedReferralCode()).toBe("ADA20");

      await user.click(within(summary).getByRole("button", { name: /Remove/ }));
      expect(within(summary).queryByText(/Referred by/)).toBeNull();
      expect(within(summary).getByText("₦6,000,000")).toBeTruthy();
      expect(storedReferralCode()).toBeNull();
    });

    it("sends the code with a licence request", async () => {
      document.cookie = "xw_ref=ADA20; path=/";
      fetchMock.mockImplementation(async (url: string) =>
        url.startsWith("/api/public/affiliates/codes/")
          ? codeCheck(true)
          : new Response(JSON.stringify({ data: { id: "sr-1", reference: "SR-1" } }), { status: 201 }),
      );
      const user = userEvent.setup();
      render(<OnboardingWizard pricing={REQUESTING} />);

      await screen.findByText(/Referred by Ada/);
      await user.click(screen.getByRole("button", { name: /Continue/ }));
      await fillDetails(user, { terms: false });
      await user.click(screen.getByRole("button", { name: /Review your request/ }));
      await user.click(screen.getByRole("button", { name: "Send request" }));

      expect(await screen.findByText("SR-1")).toBeTruthy();
      const request = fetchMock.mock.calls.find(([url]) => url === "/api/public/sales-requests") as [string, RequestInit];
      expect(JSON.parse(String(request[1].body))).toMatchObject({ type: "licence", referralCode: "ADA20" });
    });
  });
});
