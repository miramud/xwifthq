import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingBoard } from "./BillingBoard";

/**
 * Plan & billing, one-time model (26 Sep 2026). What an admin must be able to
 * trust before leaving for the gateway: the total is on screen, it follows
 * what they ticked, it credits what they already bought ("you pay only the
 * difference"), and it is in the currency they chose.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org/billing",
  useSearchParams: () => new URLSearchParams(),
}));

const catalogue = vi.fn<() => Promise<unknown>>();
const quote = vi.fn<(modules: string[], currency: string) => Promise<unknown>>();
const checkout = vi.fn<(modules: string[], currency: string) => Promise<unknown>>();
const purchases = vi.fn<() => Promise<unknown>>();
const requestModules = vi.fn<(input: unknown) => Promise<unknown>>();

vi.mock("@/lib/api/billing-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/billing-client")>("@/lib/api/billing-client");
  return {
    ...actual,
    billing: {
      catalogue: () => catalogue(),
      quote: (m: string[], c: string) => quote(m, c),
      checkout: (m: string[], c: string) => checkout(m, c),
      purchases: () => purchases(),
      requestModules: (input: unknown) => requestModules(input),
      verify: vi.fn(),
      purchase: vi.fn(),
    },
  };
});

const LADDER = {
  NGN: { "1": 250_000_000, "2": 450_000_000, "3": 600_000_000, "4": 850_000_000, "5": 1_050_000_000 },
  USD: { "1": 300_000, "2": 500_000, "3": 800_000, "4": 1_050_000, "5": 1_300_000 },
};

function offerCatalogue(paymentsEnabled = true) {
  return {
    paymentsEnabled,
    gateway: { key: "flutterwave", label: "Flutterwave", testMode: true },
    currencies: ["NGN", "USD"],
    ladder: LADDER,
    purchasedCount: 1,
    modules: [
      { key: "lms", label: "Learning", status: "active", source: "purchase", owned: true, deliveredWhenReleased: false, purchasable: false },
      { key: "hrm", label: "HR", status: "preview", source: null, owned: false, deliveredWhenReleased: false, purchasable: true },
      { key: "projects", label: "Projects", status: "active", source: "manual", owned: true, deliveredWhenReleased: false, purchasable: false },
      { key: "finance", label: "Finance", status: "preview", source: null, owned: false, deliveredWhenReleased: false, purchasable: true },
    ],
  };
}

/** The ladder rule, as the API applies it: price(p + k) − price(p). */
function quoteFor(modules: string[], currency: "NGN" | "USD") {
  const p = 1;
  const full = LADDER[currency][String(p + modules.length) as "2"];
  const credit = LADDER[currency][String(p) as "1"];
  return { purchasedCount: p, addingCount: modules.length, fullPriceMinor: full, creditMinor: credit, amountMinor: full - credit, currency };
}

beforeEach(() => {
  catalogue.mockReset().mockResolvedValue(offerCatalogue());
  quote.mockReset().mockImplementation(async (m, c) => quoteFor(m, c as "NGN" | "USD"));
  checkout.mockReset();
  requestModules.mockReset();
  purchases.mockReset().mockResolvedValue({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 15, total: 0 } });
});

describe("Plan & billing (one-time)", () => {
  it("charges only the difference over what was already bought", async () => {
    const user = userEvent.setup();
    render(<BillingBoard />);

    await user.click(await screen.findByRole("checkbox", { name: "Add HR" }));
    await waitFor(() => expect(quote).toHaveBeenLastCalledWith(["hrm"], "NGN"));

    const summary = await screen.findByRole("complementary", { name: "Order summary" });
    await waitFor(() => expect(summary).toHaveTextContent("Price for 2 modules"));
    expect(summary).toHaveTextContent("₦4,500,000");
    expect(summary).toHaveTextContent("Already paid for 1 module");
    expect(summary).toHaveTextContent("− ₦2,500,000");
    expect(summary).toHaveTextContent("You pay only the difference.");
    expect(within(summary).getByRole("button", { name: "Pay ₦2,000,000 with Flutterwave" })).toBeEnabled();
  });

  it("follows the selection as modules are added and removed", async () => {
    const user = userEvent.setup();
    render(<BillingBoard />);

    await user.click(await screen.findByRole("checkbox", { name: "Add HR" }));
    await user.click(screen.getByRole("checkbox", { name: "Add Finance" }));
    await waitFor(() => expect(quote).toHaveBeenLastCalledWith(["hrm", "finance"], "NGN"));
    // 3 modules (₦6m) minus the 1 already bought (₦2.5m).
    expect(await screen.findByRole("button", { name: "Pay ₦3,500,000 with Flutterwave" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "HR added" }));
    await waitFor(() => expect(quote).toHaveBeenLastCalledWith(["finance"], "NGN"));
    expect(await screen.findByRole("button", { name: "Pay ₦2,000,000 with Flutterwave" })).toBeEnabled();
  });

  it("quotes and pays in dollars when USD is chosen", async () => {
    checkout.mockResolvedValue({ reference: "EL-MOD-1", authorizationUrl: "https://checkout.flutterwave.test/pay/abc", gateway: "flutterwave" });
    const href = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        set href(v: string) {
          href(v);
        },
      },
    });

    const user = userEvent.setup();
    render(<BillingBoard initialModule="hrm" />);

    await user.click(await screen.findByText("USD"));
    await waitFor(() => expect(quote).toHaveBeenLastCalledWith(["hrm"], "USD"));
    // $5,000 for two modules minus $3,000 already paid.
    await user.click(await screen.findByRole("button", { name: "Pay $2,000 with Flutterwave" }));

    expect(checkout).toHaveBeenCalledWith(["hrm"], "USD");
    expect(href).toHaveBeenCalledWith("https://checkout.flutterwave.test/pay/abc");
  });

  it("shows what is owned, and sells nothing that is", async () => {
    render(<BillingBoard />);

    expect(await screen.findByText("Owned · paid")).toBeInTheDocument();
    expect(screen.getByText("Granted by the platform owner")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Learning/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Projects/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Delivered when released").length).toBeGreaterThan(0);
    expect(screen.getByText(/Test mode/)).toBeInTheDocument();
    expect(screen.queryByText(/Active until|Extend|per month/)).not.toBeInTheDocument();
  });

  it("starts with the module a preview page asked for", async () => {
    render(<BillingBoard initialModule="hrm" />);

    expect(await screen.findByRole("checkbox", { name: "HR added" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(quote).toHaveBeenCalledWith(["hrm"], "NGN"));
  });
});

describe("Plan & billing with online payment switched off", () => {
  beforeEach(() => {
    catalogue.mockReset().mockResolvedValue(offerCatalogue(false));
  });

  it("says up front that our team activates modules, and still shows the price", async () => {
    const user = userEvent.setup();
    render(<BillingBoard />);

    expect(await screen.findByText("Modules are activated by our team for now.")).toBeInTheDocument();
    expect(screen.queryByText(/Test mode/)).not.toBeInTheDocument();

    await user.click(await screen.findByRole("checkbox", { name: "Add HR" }));
    const summary = await screen.findByRole("complementary", { name: "Your request" });
    await waitFor(() => expect(summary).toHaveTextContent("₦2,000,000"));
    expect(summary).toHaveTextContent("To be invoiced");
    expect(within(summary).queryByRole("button", { name: /Pay/ })).not.toBeInTheDocument();
  });

  it("sends a request with the picked modules and shows the reference", async () => {
    requestModules.mockResolvedValue({ id: "r1", reference: "SR-4F9A21C7" });
    const user = userEvent.setup();
    render(<BillingBoard initialModule="hrm" />);

    await user.click(await screen.findByRole("checkbox", { name: "Add Finance" }));
    await user.type(screen.getByLabelText(/Phone/), "+234 800 000 0000");
    await user.type(screen.getByLabelText(/Message/), "Invoice to accounts, please.");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(requestModules).toHaveBeenCalledWith({
      modules: ["hrm", "finance"],
      currency: "NGN",
      message: "Invoice to accounts, please.",
      phone: "+234 800 000 0000",
    });
    expect(checkout).not.toHaveBeenCalled();

    const done = await screen.findByRole("complementary", { name: "Request sent" });
    expect(done).toHaveTextContent("SR-4F9A21C7");
    expect(done).toHaveTextContent("Our team will contact you to confirm the modules and arrange payment.");
    // No email is promised: switching a module on from the platform console sends none.
    expect(done).toHaveTextContent("Once they're switched on, they show as active here and in everyone's suite menu.");
    expect(done).not.toHaveTextContent(/email/i);
  });

  it("shows the API's field error next to the field it's about", async () => {
    const { ApiError } = await import("@/lib/api/billing-client");
    requestModules.mockRejectedValue(new ApiError("The phone is invalid.", 422, { phone: ["Enter a valid phone number."] }));
    const user = userEvent.setup();
    render(<BillingBoard initialModule="hrm" />);

    await user.type(await screen.findByLabelText(/Phone/), "x");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Enter a valid phone number.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("complementary", { name: "Request sent" })).not.toBeInTheDocument();
  });
});

describe("Plan & billing: a referral discount", () => {
  it("lists the referral discount in the breakdown when the quote carries one", async () => {
    quote.mockImplementation(async (m, c) => {
      const q = quoteFor(m, c as "NGN" | "USD");
      const off = Math.round((q.amountMinor * 10) / 100);
      return { ...q, referralDiscountMinor: off, amountMinor: q.amountMinor - off };
    });
    const user = userEvent.setup();
    render(<BillingBoard />);

    await user.click(await screen.findByRole("checkbox", { name: "Add HR" }));
    const summary = await screen.findByRole("complementary", { name: "Order summary" });
    await waitFor(() => expect(summary).toHaveTextContent("Referral discount"));
    expect(summary).toHaveTextContent("− ₦200,000");
    expect(within(summary).getByRole("button", { name: "Pay ₦1,800,000 with Flutterwave" })).toBeEnabled();
  });
});
