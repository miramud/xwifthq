import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingWizard } from "./OnboardingWizard";
import { DEFAULT_PRICING } from "@/lib/api/public-pricing";
import { clearReferralCode, storedReferralCode } from "@/lib/referral";

const MODULES = DEFAULT_PRICING.modules;

let search = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/get-started",
  useSearchParams: () => search,
}));

const fetchMock = vi.fn();

// Filled in one step rather than typed key by key: the behaviour under test is
// the flow, and per-keystroke typing is what times out on a loaded machine.
function fillDetails() {
  fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Acme Ltd" } });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Obi" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+234 803 000 0000" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@acme.test" } });
}

const summary = () => screen.getByRole("complementary", { name: "Order summary" });
const setEmployees = (n: number) =>
  fireEvent.change(screen.getByRole("spinbutton", { name: "Employees" }), { target: { value: String(n) } });

/** New organisations: choose Free, Cloud or Own, give details, send the request. */
describe("onboarding wizard", () => {
  beforeEach(() => {
    search = new URLSearchParams("plan=cloud&list=NG&count=3&employees=18");
    replace.mockReset();
    fetchMock.mockReset();
    window.sessionStorage.clear();
    clearReferralCode();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    clearReferralCode();
    vi.unstubAllGlobals();
  });

  it("takes the plan, modules and headcount from a pricing link and prices them from the price book", () => {
    render(<OnboardingWizard modules={MODULES} />);

    expect((screen.getByRole("radio", { name: /XwiftHQ Cloud/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Learning/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /^HR/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Projects/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Finance/ }) as HTMLInputElement).checked).toBe(false);

    // The strategy's 18-person agency: 18 × ₦7,400 × 12.
    expect(within(summary()).getByText("₦1,598,400")).toBeTruthy();
    expect(within(summary()).getByText(/Quick Start onboarding: ₦500,000/)).toBeTruthy();
  });

  it("reprices as modules and headcount change", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("checkbox", { name: /Finance/ }));
    expect(within(summary()).getByText("₦1,857,600")).toBeTruthy();
    expect(within(summary()).getByText("When released")).toBeTruthy();

    setEmployees(600);
    expect(within(summary()).getByText("Quoted")).toBeTruthy();
  });

  it("prices Own by the band a pricing card sent", () => {
    search = new URLSearchParams("plan=own&list=INT&count=5&band=growth");
    render(<OnboardingWizard modules={MODULES} />);

    expect((screen.getByRole("spinbutton", { name: "Employees" }) as HTMLInputElement).value).toBe("26");
    expect(within(summary()).getByText("$22,000")).toBeTruthy();
    expect(within(summary()).getByText(/Growth band/)).toBeTruthy();
    expect(within(summary()).getByText("Care $4,400 a year from year two")).toBeTruthy();
  });

  it("keeps Free to ten employees and its own modules", () => {
    search = new URLSearchParams("plan=free&list=NG&employees=12");
    render(<OnboardingWizard modules={MODULES} />);

    expect(screen.queryByRole("checkbox", { name: /Projects/ })).toBeNull();
    expect(screen.getByText(/Free covers up to 10 employees/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement).disabled).toBe(true);

    setEmployees(8);
    expect((screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(summary()).getByText("₦0")).toBeTruthy();
    expect(within(summary()).getByText("Learning (basic)")).toBeTruthy();
  });

  it("needs a headcount before the details step", () => {
    search = new URLSearchParams("plan=cloud&count=2");
    render(<OnboardingWizard modules={MODULES} />);

    expect((screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(summary()).getByText(/Enter your headcount/)).toBeTruthy();
  });

  it("asks for the organisation, name, email and phone before review", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.queryByRole("checkbox", { name: /authorised to buy/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Review your request/ }));

    expect(screen.getByText("Enter your organisation's name.")).toBeTruthy();
    expect(screen.getByText("Enter your full name.")).toBeTruthy();
    expect(screen.getByText("Enter your work email.")).toBeTruthy();
    expect(screen.getByText("Enter a phone number.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "not-an-email" } });
    await user.click(screen.getByRole("button", { name: /Review your request/ }));
    expect(screen.getByText(/Enter a valid email address/)).toBeTruthy();
  });

  it("sends a licence request with the modules and the priced plan, and never goes to checkout", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "sr-9", reference: "SR-4F9A21C7" } }), { status: 201 }),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    fillDetails();
    await user.click(screen.getByRole("button", { name: /Review your request/ }));

    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Anything we should know/), { target: { value: "Start in October" } });
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("SR-4F9A21C7")).toBeTruthy();
    expect(screen.getByText(/Request sent, Ada/)).toBeTruthy();
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
      message:
        "Plan: XwiftHQ Cloud, 18 employees, 3 modules, Nigeria price list, ₦1,598,400 a year (₦7,400 per employee a month).\n\nStart in October",
      modules: ["lms", "hrm", "projects"],
      currency: "NGN",
      website: "",
    });
  });

  it("asks for dollars on the dollar price lists, and sends Free with HR and Learning", async () => {
    search = new URLSearchParams("plan=free&list=AFR&employees=6");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: "sr-2", reference: "SR-2" } }), { status: 201 }));
    const user = userEvent.setup();
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    fillDetails();
    await user.click(screen.getByRole("button", { name: /Review your request/ }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("SR-2")).toBeTruthy();
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({
      type: "licence",
      modules: ["lms", "hrm"],
      currency: "USD",
      message: "Plan: XwiftHQ Free, 6 employees, Africa price list.",
    });
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
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    fillDetails();
    await user.click(screen.getByRole("button", { name: /Review your request/ }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText(/This email already has an account/)).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Sign in" }).some((a) => a.getAttribute("href")?.includes("/login?email=ada%40acme.test")),
    ).toBe(true);
  });

  it("keeps a rejected request on the review step with the reason", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: "The given data was invalid.", errors: { modules: ["Choose modules we sell."] } }),
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    render(<OnboardingWizard modules={MODULES} />);

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    fillDetails();
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

    it("takes the discount off the first payment and sends the code with the request", async () => {
      document.cookie = "xw_ref=ADA20; path=/";
      fetchMock.mockImplementation(async (url: string) =>
        url.startsWith("/api/public/affiliates/codes/")
          ? codeCheck(true)
          : new Response(JSON.stringify({ data: { id: "sr-1", reference: "SR-1" } }), { status: 201 }),
      );
      const user = userEvent.setup();
      render(<OnboardingWizard modules={MODULES} />);

      expect(await within(summary()).findByText(/Referred by Ada/)).toBeTruthy();
      expect(within(summary()).getByText(/10% off your first payment/)).toBeTruthy();
      expect(within(summary()).getByText("Referral discount (10%)")).toBeTruthy();
      expect(within(summary()).getByText("-₦159,840")).toBeTruthy();
      expect(within(summary()).getByText("₦1,438,560")).toBeTruthy();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/public/affiliates/codes/ADA20");

      await user.click(screen.getByRole("button", { name: /Continue/ }));
      fillDetails();
      await user.click(screen.getByRole("button", { name: /Review your request/ }));
      await user.click(screen.getByRole("button", { name: "Send request" }));

      expect(await screen.findByText("SR-1")).toBeTruthy();
      const request = fetchMock.mock.calls.find(([url]) => url === "/api/public/sales-requests") as [string, RequestInit];
      expect(JSON.parse(String(request[1].body))).toMatchObject({ type: "licence", referralCode: "ADA20" });
    });

    it("prices in full when the stored code is no longer live", async () => {
      document.cookie = "xw_ref=OLDCODE; path=/";
      fetchMock.mockResolvedValue(codeCheck(false));
      render(<OnboardingWizard modules={MODULES} />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(within(summary()).queryByText(/Referred by/)).toBeNull();
      expect(within(summary()).getByText("₦1,598,400")).toBeTruthy();
    });

    it("lets somebody enter a code, says when it isn't valid, and remove one that is", async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard modules={MODULES} />);

      await user.click(screen.getByRole("button", { name: "Have a referral code?" }));
      fireEvent.change(screen.getByLabelText("Referral code"), { target: { value: "nope1" } });
      fetchMock.mockResolvedValueOnce(codeCheck(false));
      await user.click(screen.getByRole("button", { name: "Apply" }));
      expect(await screen.findByText(/isn't active/)).toBeTruthy();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/public/affiliates/codes/NOPE1");

      fireEvent.change(screen.getByLabelText("Referral code"), { target: { value: "ada20" } });
      fetchMock.mockResolvedValueOnce(codeCheck(true));
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(await within(summary()).findByText(/Referred by Ada/)).toBeTruthy();
      expect(within(summary()).getByText("₦1,438,560")).toBeTruthy();
      expect(storedReferralCode()).toBe("ADA20");

      await user.click(within(summary()).getByRole("button", { name: /Remove/ }));
      expect(within(summary()).queryByText(/Referred by/)).toBeNull();
      expect(within(summary()).getByText("₦1,598,400")).toBeTruthy();
      expect(storedReferralCode()).toBeNull();
    });
  });
});
