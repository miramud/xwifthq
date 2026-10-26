import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeatsPage from "./page";

/**
 * The institution's own seats screen.
 *
 * The things worth pinning down are the ones an admin would be misled by: the
 * total must be shown *before* committing, "unpriced" must not look like
 * "free", and there must be no way to raise the cap from here, a limit the
 * capped party can raise is not a limit.
 */

let currentUser: Record<string, unknown> | null = {
  role: "admin",
  name: "Admin",
  organisationId: "org-1",
};

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/org",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
  AuthError: class extends Error {},
}));

const mine = vi.fn<() => Promise<unknown>>();
const purchase = vi.fn<(seats: number) => Promise<unknown>>();
const quote = vi.fn<(seats: number) => Promise<unknown>>();
const renew = vi.fn<() => Promise<unknown>>();
const renewalQuote = vi.fn<() => Promise<unknown>>();

vi.mock("@/lib/api/saas-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/saas-client")>(
    "@/lib/api/saas-client",
  );

  return {
    ...actual,
    seats: {
      mine: () => mine(),
      purchase: (count: number) => purchase(count),
      quote: (count: number) => quote(count),
      renew: () => renew(),
      renewalQuote: () => renewalQuote(),
      verify: vi.fn(),
    },
  };
});

/** What the renewal buys: seats, unit price, and the term it covers. */
function renewalOf(over: Record<string, unknown> = {}) {
  return {
    seats: 50,
    unitPrice: 5000,
    amount: 250000,
    periodStart: "2027-01-01T00:00:00Z",
    periodEnd: "2027-12-31T00:00:00Z",
    period: "annual",
    ...over,
  };
}

function ledger(summary: Record<string, unknown> = {}, purchases: unknown[] = []) {
  return {
    summary: {
      seatLimit: 50,
      seatsUsed: 42,
      seatsRemaining: 8,
      seatPrice: 5000,
      billingPeriod: null,
      billingPeriodLabel: null,
      pricePer: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      daysLeftInTerm: null,
      licenceStatus: "unbilled",
      licenceStatusLabel: "Not on a plan",
      graceDays: 14,
      renewalAmount: null,
      canBuy: true,
      seatsPurchased: 40,
      totalPaid: 200000,
      ...summary,
    },
    purchases,
  };
}

/** A summary for an institution on a recurring plan. */
function onPlan(over: Record<string, unknown> = {}) {
  return {
    billingPeriod: "annual",
    billingPeriodLabel: "Annually",
    pricePer: "per year",
    currentPeriodStart: "2026-01-01T00:00:00Z",
    currentPeriodEnd: "2026-12-31T00:00:00Z",
    daysLeftInTerm: 143,
    licenceStatus: "active",
    licenceStatusLabel: "Active",
    renewalAmount: 250000,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "admin", name: "Admin", organisationId: "org-1" };
  mine.mockResolvedValue(ledger());
  // A default, because the page asks for a quote whenever the institution is on
  // a plan, an unset mock returns undefined and the effect would throw on it.
  quote.mockResolvedValue({
    seats: 10,
    unitPrice: 5000,
    amount: 50_000,
    prorated: true,
    daysRemaining: 143,
    periodEnd: "2026-12-31T00:00:00Z",
  });
  renewalQuote.mockResolvedValue(renewalOf());
});

describe("SeatsPage: the licence", () => {
  it("says how many seats are in use and how many are left", async () => {
    render(<SeatsPage />);

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText(/of 50 seats in use/i)).toBeInTheDocument();
    expect(screen.getByText("8 free")).toBeInTheDocument();
  });

  it("warns plainly when every seat is taken", async () => {
    mine.mockResolvedValue(ledger({ seatsUsed: 50, seatsRemaining: 0 }));

    render(<SeatsPage />);

    expect(await screen.findByText(/you have used every seat/i)).toBeInTheDocument();
  });

  it("says unlimited rather than showing a full meter", async () => {
    mine.mockResolvedValue(ledger({ seatLimit: null, seatsRemaining: null, canBuy: false }));

    render(<SeatsPage />);

    expect(await screen.findByText(/no seat limit/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /seats in use/i })).not.toBeInTheDocument();
  });
});

describe("SeatsPage: buying", () => {
  it("shows the total before anything is committed to", async () => {
    const user = userEvent.setup();
    render(<SeatsPage />);

    const input = await screen.findByLabelText("Seats");
    await user.clear(input);
    await user.type(input, "3");

    // 3 × ₦5,000, priced on screen rather than revealed at the gateway.
    expect(screen.getByText("₦15,000")).toBeInTheDocument();
    expect(purchase).not.toHaveBeenCalled();
  });

  it("hands off to the gateway with the number chosen", async () => {
    purchase.mockResolvedValue({
      purchase: {},
      reference: "EL-SEAT-1",
      authorizationUrl: "https://checkout.paystack.test/xyz",
    });

    const href = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { set href(v: string) { href(v); } },
    });

    const user = userEvent.setup();
    render(<SeatsPage />);

    const input = await screen.findByLabelText("Seats");
    await user.clear(input);
    await user.type(input, "25");
    await user.click(screen.getByRole("button", { name: /pay for seats/i }));

    expect(purchase).toHaveBeenCalledWith(25);
    expect(href).toHaveBeenCalledWith("https://checkout.paystack.test/xyz");
  });

  /** "Not priced" and "free" are different facts. */
  it("explains that unpriced seats cannot be bought, rather than failing on submit", async () => {
    mine.mockResolvedValue(ledger({ seatPrice: null, canBuy: false }));

    render(<SeatsPage />);

    expect(await screen.findByText(/your platform administrator sets the price/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay for seats/i })).not.toBeInTheDocument();
  });

  /** A cap the capped party can raise is not a cap. */
  it("offers no way to change the limit or the price", async () => {
    render(<SeatsPage />);

    await screen.findByText(/of 50 seats in use/i);

    expect(screen.queryByLabelText(/seat limit/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/price per seat/i)).not.toBeInTheDocument();
  });
});

describe("SeatsPage: the licence term", () => {
  it("says when the licence renews and for how much", async () => {
    mine.mockResolvedValue(ledger(onPlan()));

    render(<SeatsPage />);

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByText(/143 days left/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /renew for ₦250,000/i })).toBeInTheDocument();
  });

  /**
   * The reassurance that matters: a lapsed licence blocks growth and nothing
   * else. An admin who reads "lapsed" and assumes their learners are locked out
   * will escalate to support instead of paying an invoice.
   */
  it("says plainly that a lapsed licence has not locked anybody out", async () => {
    mine.mockResolvedValue(
      ledger(onPlan({ licenceStatus: "lapsed", licenceStatusLabel: "Lapsed", daysLeftInTerm: -20 })),
    );

    render(<SeatsPage />);

    expect(await screen.findByText(/nobody has been signed out/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot add anyone else until it is renewed/i)).toBeInTheDocument();
  });

  /** The grace window is configurable, so it has to be read rather than assumed. */
  it("names the institution's own grace window when the term has just ended", async () => {
    mine.mockResolvedValue(
      ledger(
        onPlan({
          licenceStatus: "past_due",
          licenceStatusLabel: "Payment due",
          daysLeftInTerm: -2,
          graceDays: 45,
        }),
      ),
    );

    render(<SeatsPage />);

    expect(await screen.findByText("Payment due")).toBeInTheDocument();
    expect(screen.getByText(/everything still works for now/i)).toBeInTheDocument();
  });

  it("hands off to the gateway to renew", async () => {
    mine.mockResolvedValue(ledger(onPlan()));
    renew.mockResolvedValue({ purchase: {}, authorizationUrl: "https://checkout.test/renew" });

    const href = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { set href(v: string) { href(v); } },
    });

    const user = userEvent.setup();
    render(<SeatsPage />);

    await user.click(await screen.findByRole("button", { name: /renew for/i }));

    expect(renew).toHaveBeenCalled();
    expect(href).toHaveBeenCalledWith("https://checkout.test/renew");
  });

  /** Off a plan there is no term, so the card is absent rather than empty. */
  it("shows no licence card when seats are a one-off charge", async () => {
    render(<SeatsPage />);

    await screen.findByText(/of 50 seats in use/i);

    expect(screen.queryByRole("button", { name: /renew/i })).not.toBeInTheDocument();
  });
});

describe("SeatsPage: proration", () => {
  /**
   * A total that is quietly a fraction of the list price reads as a bug unless
   * the reason sits next to it.
   */
  it("prices mid-term seats from the API and says they are prorated", async () => {
    mine.mockResolvedValue(ledger(onPlan()));
    quote.mockResolvedValue({
      seats: 10,
      unitPrice: 5000,
      amount: 19_500,
      prorated: true,
      daysRemaining: 143,
      periodEnd: "2026-12-31T00:00:00Z",
    });

    render(<SeatsPage />);

    expect(await screen.findByText("₦19,500")).toBeInTheDocument();
    expect(screen.getByText(/prorated to/i)).toBeInTheDocument();
    expect(screen.getByText(/billed in full from the next renewal/i)).toBeInTheDocument();
  });

  /** Off a plan it is one multiplication, so it is answered without a round trip. */
  it("prices a one-off purchase locally", async () => {
    const user = userEvent.setup();
    render(<SeatsPage />);

    const input = await screen.findByLabelText("Seats");
    await user.clear(input);
    await user.type(input, "3");

    expect(screen.getByText("₦15,000")).toBeInTheDocument();
    expect(quote).not.toHaveBeenCalled();
  });
});

describe("SeatsPage: history", () => {
  it("lets an abandoned payment be resumed", async () => {
    mine.mockResolvedValue(
      ledger({}, [
        {
          id: "p1",
          reference: "EL-SEAT-1",
          seats: 25,
          unitPrice: 5000,
          amount: 125000,
          method: "paystack",
          methodLabel: "Paid online",
          verified: false,
          status: "pending",
          statusLabel: "Awaiting payment",
          note: null,
          authorizationUrl: "https://checkout.paystack.test/xyz",
          paidAt: null,
          createdAt: "2026-08-10T09:00:00Z",
        },
      ]),
    );

    render(<SeatsPage />);

    const resume = await screen.findByRole("link", { name: /finish payment/i });
    expect(resume).toHaveAttribute("href", "https://checkout.paystack.test/xyz");
  });

  it("sends the platform owner to the organisations console instead", () => {
    currentUser = { role: "super_admin", name: "Owner", organisationId: null };

    render(<SeatsPage />);

    expect(screen.getByText(/seats belong to an institution/i)).toBeInTheDocument();
    expect(mine).not.toHaveBeenCalled();
  });
});

describe("SeatsPage: what a renewal buys", () => {
  /*
    `GET /organisation/seats/renewal` had no caller, so the only figure on the
    page was the total. An administrator saw "Renew for ₦250,000" with no
    statement of what term that bought.
  */
  it("breaks the renewal down and names the term it covers", async () => {
    mine.mockResolvedValue(ledger(onPlan()));

    render(<SeatsPage />);

    expect(
      await screen.findByText(/50 seats .* covers 1 Jan 2027 to 31 Dec 2027/),
    ).toBeInTheDocument();
  });

  /*
    The fear that stops somebody renewing before the last day. The billing
    service starts the new term at the end of the current one, so renewing
    early extends rather than discards, and nothing said so.
  */
  it("says an early renewal adds to the current term rather than replacing it", async () => {
    mine.mockResolvedValue(ledger(onPlan()));
    renewalQuote.mockResolvedValue(
      renewalOf({ periodStart: "2099-01-01T00:00:00Z" }),
    );

    render(<SeatsPage />);

    expect(
      await screen.findByText(/adds to your current term rather than replacing it/),
    ).toBeInTheDocument();
  });

  it("says nothing of the sort when the term has already run out", async () => {
    mine.mockResolvedValue(ledger(onPlan({ licenceStatus: "lapsed", licenceStatusLabel: "Lapsed" })));
    renewalQuote.mockResolvedValue(
      renewalOf({ periodStart: "2020-01-01T00:00:00Z" }),
    );

    render(<SeatsPage />);

    await screen.findByText(/covers 1 Jan 2020/);

    expect(
      screen.queryByText(/adds to your current term/),
    ).not.toBeInTheDocument();
  });

  it("does not ask for a renewal quote off a plan", async () => {
    render(<SeatsPage />);

    await screen.findByText("42");

    expect(renewalQuote).not.toHaveBeenCalled();
  });

  /*
    The breakdown explains a figure that is already on screen. Losing it must
    not cost the button.
  */
  it("still offers the renewal when the breakdown cannot be fetched", async () => {
    mine.mockResolvedValue(ledger(onPlan()));
    renewalQuote.mockRejectedValue(new Error("nope"));

    render(<SeatsPage />);

    expect(
      await screen.findByRole("button", { name: /Renew for/ }),
    ).toBeEnabled();
  });
});

describe("SeatsPage: a referral discount", () => {
  /* An organisation an affiliate referred gets money off its first payment; the total says so. */
  it("takes the discount off a one-off purchase and says it is for the first payment", async () => {
    mine.mockResolvedValue(ledger({ referralDiscountPercent: 10 }));
    const user = userEvent.setup();
    render(<SeatsPage />);

    const input = await screen.findByLabelText("Seats");
    await user.clear(input);
    await user.type(input, "3");

    // 3 × ₦5,000 = ₦15,000, less 10%.
    expect(screen.getByText("₦13,500")).toBeInTheDocument();
    expect(screen.getByText("Referral discount (10%)")).toBeInTheDocument();
    expect(screen.getByText("-₦1,500")).toBeInTheDocument();
    expect(screen.getByText(/applies to your first payment only/i)).toBeInTheDocument();
  });

  it("shows the discount the API took off a mid-term quote", async () => {
    mine.mockResolvedValue(ledger(onPlan({ referralDiscountPercent: 10, renewalAmount: 225000 })));
    quote.mockResolvedValue({
      seats: 10,
      unitPrice: 5000,
      amount: 17_550,
      listAmount: 19_500,
      referralDiscount: 1_950,
      prorated: true,
      daysRemaining: 143,
      periodEnd: "2026-12-31T00:00:00Z",
    });

    render(<SeatsPage />);

    expect(await screen.findByText("₦17,550")).toBeInTheDocument();
    expect(screen.getByText("-₦1,950")).toBeInTheDocument();
    expect(screen.getByText(/includes your 10% referral discount/i)).toBeInTheDocument();
  });

  it("shows no discount line without a referral", async () => {
    const user = userEvent.setup();
    render(<SeatsPage />);

    const input = await screen.findByLabelText("Seats");
    await user.clear(input);
    await user.type(input, "3");

    expect(screen.getByText("₦15,000")).toBeInTheDocument();
    expect(screen.queryByText(/referral discount/i)).not.toBeInTheDocument();
  });
});
