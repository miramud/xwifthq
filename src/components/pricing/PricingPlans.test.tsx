import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PricingPlans } from "./PricingPlans";
import { DEFAULT_PRICING } from "@/lib/api/public-pricing";

const LIVE = DEFAULT_PRICING.modules;
// The platform owner can still hold a module back; the API then says so.
const HELD_BACK = LIVE.map((m) =>
  m.key === "finance" || m.key === "admin" ? { ...m, status: "coming_soon" as const } : m,
);

/**
 * Rent or Own (the strategy's price book, 23 Oct 2026): Free, Cloud and Own,
 * the price lists, the module count, and the sign-up links the buttons carry.
 */
describe("pricing plans", () => {
  it("shows the full suite on the Nigeria list: Cloud per employee and Own by band", () => {
    render(<PricingPlans modules={LIVE} />);

    const plans = screen.getByRole("list", { name: "Ways to buy XwiftHQ" });
    // The headline rate, and again as the 1–50 employees volume row.
    expect(within(plans).getAllByText("₦9,500")).toHaveLength(2);
    expect(within(plans).getByText("From ₦4,500,000")).toBeTruthy();
    // Graduated volume: 70% from 51 employees, 50% from 201.
    expect(within(plans).getByText("₦6,650")).toBeTruthy();
    expect(within(plans).getByText("₦4,750")).toBeTruthy();

    const own = screen.getByRole("list", { name: "XwiftHQ Own licences" });
    for (const price of ["₦4,500,000", "₦12,500,000", "₦35,000,000", "₦70,000,000"]) {
      expect(within(own).getByText(price)).toBeTruthy();
    }
    // Care at 20% of the Growth licence.
    expect(within(own).getByText("₦2,500,000")).toBeTruthy();
  });

  it("reprices for fewer modules at the fixed shares", async () => {
    const user = userEvent.setup();
    render(<PricingPlans modules={LIVE} />);

    await user.click(screen.getByRole("radio", { name: "3 modules" }));

    expect(within(screen.getByRole("list", { name: "Ways to buy XwiftHQ" })).getAllByText("₦7,400")).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "XwiftHQ Own licences" })).getByText("₦9,800,000")).toBeTruthy();
  });

  it("switches to the dollar price lists", async () => {
    const user = userEvent.setup();
    render(<PricingPlans modules={LIVE} />);

    await user.click(screen.getByRole("radio", { name: /International/ }));
    expect(within(screen.getByRole("list", { name: "Ways to buy XwiftHQ" })).getAllByText("$16.00")).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "XwiftHQ Own licences" })).getByText("$22,000")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: /Africa/ }));
    expect(within(screen.getByRole("list", { name: "Ways to buy XwiftHQ" })).getAllByText("$8.50")).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "XwiftHQ Own licences" })).getByText("$11,500")).toBeTruthy();
  });

  it("sends each plan to sign-up with the visitor's choice", async () => {
    const user = userEvent.setup();
    render(<PricingPlans modules={LIVE} />);

    expect(screen.getByRole("link", { name: /Start free/ }).getAttribute("href")).toBe("/get-started?plan=free&list=NG");

    await user.click(screen.getByRole("radio", { name: "2 modules" }));
    await user.click(screen.getByRole("radio", { name: /International/ }));
    expect(screen.getByRole("link", { name: /Start a 30-day trial/ }).getAttribute("href")).toBe(
      "/get-started?plan=cloud&list=INT&count=2",
    );
    expect(screen.getByRole("link", { name: /Get the Growth licence, \$13,200/ }).getAttribute("href")).toBe(
      "/get-started?plan=own&list=INT&count=2&band=growth",
    );
  });

  it("notes the modules that switch on when released, only once the count reaches them", async () => {
    const user = userEvent.setup();
    render(<PricingPlans modules={HELD_BACK} />);

    expect(screen.getAllByText("Finance and Admin switched on when released")).toHaveLength(2);
    await user.click(screen.getByRole("radio", { name: "3 modules" }));
    expect(screen.queryByText("Finance and Admin switched on when released")).toBeNull();
  });

  it("still offers existing customers a log in", () => {
    render(<PricingPlans modules={LIVE} />);
    expect(screen.getByRole("link", { name: "Log in to add modules" }).getAttribute("href")).toBe(
      "/login?redirect=/suite/org/billing",
    );
  });
});
