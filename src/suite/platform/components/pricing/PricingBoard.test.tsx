import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingBoard from "./PricingBoard";
import type { PlatformPricing } from "@/lib/api/platform-billing-client";
import { parseDrafts, toDrafts } from "./priceInput";

/**
 * The price ladder (26 Sep 2026): one-time prices for owning 1 to 5 modules in
 * naira and dollars, and the source-code price. The ladder must climb, and
 * every step needs a price.
 */

const get = vi.fn<() => Promise<PlatformPricing>>();
const save = vi.fn<(body: PlatformPricing) => Promise<PlatformPricing>>();

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: { id: "o1", name: "Owner", role: "super_admin", organisationId: null }, loading: false }),
}));

vi.mock("@/lib/api/platform-billing-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/platform-billing-client")>();
  return { ...actual, platformPricing: { get: () => get(), save: (b: PlatformPricing) => save(b) } };
});

const PRICING: PlatformPricing = {
  ladder: {
    NGN: { "1": 250_000_000, "2": 450_000_000, "3": 600_000_000, "4": 850_000_000, "5": 1_050_000_000 },
    USD: { "1": 300_000, "2": 500_000, "3": 800_000, "4": 1_050_000, "5": 1_300_000 },
  },
  sourceCode: { NGN: 2_500_000_000, USD: 2_500_000 },
};

beforeEach(() => {
  get.mockReset().mockResolvedValue(PRICING);
  save.mockReset().mockImplementation(async (b) => b);
});

describe("price ladder", () => {
  it("shows the ladder in major units with a per-module hint", async () => {
    render(<PricingBoard />);

    expect(await screen.findByLabelText("2 modules, NGN")).toHaveValue("4500000");
    expect(screen.getByLabelText("4 modules, USD")).toHaveValue("10500");
    expect(screen.getByText("₦2.3M per module")).toBeInTheDocument();
    expect(screen.getByLabelText("Naira (₦)")).toHaveValue("25000000");
  });

  it("refuses a step cheaper than the one below it, and a blank step", async () => {
    const user = userEvent.setup();
    render(<PricingBoard />);

    const three = await screen.findByLabelText("3 modules, NGN");
    await user.clear(three);
    await user.type(three, "4000000");
    const fiveUsd = screen.getByLabelText("5 modules, USD");
    await user.clear(fiveUsd);

    await user.click(screen.getByRole("button", { name: "Save prices" }));

    expect(await screen.findByText("3 modules can't cost less than 2.")).toBeInTheDocument();
    expect(screen.getByText("Every step needs a price.")).toBeInTheDocument();
    expect(screen.getByText("2 prices need fixing before saving.")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("saves minor units and clears the unsaved state", async () => {
    const user = userEvent.setup();
    render(<PricingBoard />);

    const one = await screen.findByLabelText("1 module, USD");
    await user.clear(one);
    await user.type(one, "3,250.50");
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save prices" }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].ladder.USD["1"]).toBe(325_050);
    expect(save.mock.calls[0][0].ladder.NGN["5"]).toBe(1_050_000_000);
    expect(await screen.findByText(/Prices saved/)).toBeInTheDocument();
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
  });

  it("parses drafts round-trip without drift", () => {
    const parsed = parseDrafts(toDrafts(PRICING));
    expect(parsed).toEqual({ pricing: PRICING });
  });
});
