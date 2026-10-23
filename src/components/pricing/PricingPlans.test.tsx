import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PricingPlans } from "./PricingPlans";
import { DEFAULT_PRICING } from "@/lib/api/public-pricing";

const fetchMock = vi.fn();

/**
 * The one-time ladder (the owner's prices, 26 Sep 2026), the currency switch,
 * and the tier cards handing the count to onboarding.
 */
describe("pricing plans", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the naira ladder and the source code price", () => {
    render(<PricingPlans pricing={DEFAULT_PRICING} />);

    const ladder = screen.getByRole("list", { name: "Module bundles, one-time price" });
    for (const price of ["₦2,500,000", "₦4,500,000", "₦6,000,000", "₦8,500,000", "₦10,500,000"]) {
      expect(within(ladder).getByText(price)).toBeTruthy();
    }
    expect(screen.getByText("₦25,000,000")).toBeTruthy();
    expect(screen.getByText("Every live module")).toBeTruthy();
  });

  it("switches every price to dollars", async () => {
    const user = userEvent.setup();
    render(<PricingPlans pricing={DEFAULT_PRICING} />);

    await user.click(screen.getByRole("radio", { name: /US dollars/ }));

    const ladder = screen.getByRole("list", { name: "Module bundles, one-time price" });
    for (const price of ["$3,000", "$5,000", "$8,000", "$10,500", "$13,000"]) {
      expect(within(ladder).getByText(price)).toBeTruthy();
    }
    expect(screen.getByText("$25,000")).toBeTruthy();
  });

  it("sends a tier's count and currency to onboarding", async () => {
    const user = userEvent.setup();
    render(<PricingPlans pricing={DEFAULT_PRICING} />);

    const three = screen.getByRole("link", { name: /3 modules, ₦6,000,000/ });
    expect(three.getAttribute("href")).toBe("/get-started?count=3&currency=NGN");

    await user.click(screen.getByRole("radio", { name: /US dollars/ }));
    expect(screen.getByRole("link", { name: /3 modules, \$8,000/ }).getAttribute("href")).toBe(
      "/get-started?count=3&currency=USD",
    );
  });

  it("only offers the currencies the API returns", () => {
    render(<PricingPlans pricing={{ ...DEFAULT_PRICING, currencies: ["NGN"] }} />);
    expect(screen.queryByRole("radiogroup", { name: "Currency" })).toBeNull();
  });

  it("requests the source code without charging anything", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: "sr-1" } }), { status: 201 }));
    const user = userEvent.setup();
    render(<PricingPlans pricing={DEFAULT_PRICING} />);

    await user.click(screen.getByRole("button", { name: /Request the source code/ }));
    const dialog = screen.getByRole("dialog", { name: "Own the full source code" });

    fireEvent.change(within(dialog).getByLabelText("Full name"), { target: { value: "Ada Obi" } });
    fireEvent.change(within(dialog).getByLabelText("Organisation"), { target: { value: "Acme Ltd" } });
    fireEvent.change(within(dialog).getByLabelText("Work email"), { target: { value: "ada@acme.test" } });
    fireEvent.change(within(dialog).getByLabelText("Phone"), { target: { value: "+2348030000000" } });
    await user.click(within(dialog).getByRole("button", { name: "Request the source code" }));

    expect(await screen.findByText("Request received")).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/sales-requests");
    expect(JSON.parse(String(init.body))).toMatchObject({
      type: "source_code",
      name: "Ada Obi",
      organisationName: "Acme Ltd",
      email: "ada@acme.test",
      phone: "+2348030000000",
      currency: "NGN",
      website: "",
    });
  });

  it("says nothing is charged online while payment is off, and still offers sign-in for existing customers", () => {
    const { unmount } = render(<PricingPlans pricing={{ ...DEFAULT_PRICING, paymentsEnabled: false }} />);
    expect(screen.getByText(/Nothing is charged online/)).toBeTruthy();
    expect(screen.queryByText(/pay only the difference/)).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to add modules" }).getAttribute("href")).toBe(
      "/login?redirect=/suite/org/billing",
    );
    unmount();

    render(<PricingPlans pricing={{ ...DEFAULT_PRICING, paymentsEnabled: true }} />);
    expect(screen.getByText(/pay only the difference/)).toBeTruthy();
    expect(screen.queryByText(/Nothing is charged online/)).toBeNull();
  });
});
