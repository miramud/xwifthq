import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chooseOption } from "@/test/selectOption";
import OrganisationDetailPage from "./OrganisationDetail";

/**
 * One institution, from the platform owner's side.
 *
 * The load-bearing assertion is the **Unverified** badge. An offline row is
 * only somebody's word that a bank transfer landed, and a ledger that renders
 * it identically to a gateway-confirmed payment is quietly asserting something
 * the platform does not know. Everything else here is ordinary form plumbing.
 */

let currentUser: Record<string, unknown> | null = { role: "super_admin", organisationId: null };

// DataView reads the router to open rows; the test has no app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suite/platform/organisations/acme-institute",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuth: () => ({ user: currentUser, loading: false }),
  AuthError: class extends Error {},
}));

const getOrg = vi.fn<() => Promise<unknown>>();
const updateOrg = vi.fn<(slug: string, body: unknown) => Promise<unknown>>();
const getLedger = vi.fn<() => Promise<unknown>>();
const grant = vi.fn<(slug: string, body: unknown) => Promise<unknown>>();
const renew = vi.fn<(slug: string, body: unknown) => Promise<unknown>>();

vi.mock("@/lib/api/saas-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/saas-client")>(
    "@/lib/api/saas-client",
  );

  return {
    ...actual,
    organisations: { get: () => getOrg(), update: (s: string, b: unknown) => updateOrg(s, b) },
    organisationSeats: {
      ledger: () => getLedger(),
      grant: (s: string, b: unknown) => grant(s, b),
      renew: (s: string, b: unknown) => renew(s, b),
    },
  };
});

const ORG = {
  id: "org-1",
  name: "Acme Institute",
  slug: "acme-institute",
  contactEmail: "ops@acme.test",
  contactPhone: null,
  whatsappNumber: null,
  description: null,
  logoUrl: null,
  accentColor: null,
  status: "active",
  seatLimit: 50,
  seatPrice: 5000,
  billingPeriod: null,
  currentPeriodEnd: null,
  licenceStatus: "unbilled",
  graceDaysOverride: null,
  graceDays: 14,
  seatsUsed: 42,
  createdAt: "2026-01-01T00:00:00Z",
};

function purchase(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    reference: "EL-SEAT-1",
    kind: "seats",
    kindLabel: "Seats",
    periodStart: null,
    periodEnd: null,
    seats: 40,
    unitPrice: 5000,
    amount: 180000,
    method: "offline",
    methodLabel: "Recorded offline",
    verified: false,
    status: "paid",
    statusLabel: "Paid",
    note: "Bank transfer, ref 99120041",
    recordedBy: "Owner",
    paidAt: "2026-08-01T09:00:00Z",
    createdAt: "2026-08-01T09:00:00Z",
    ...over,
  };
}

function ledger(summary: Record<string, unknown> = {}, purchases: unknown[] = [purchase()]) {
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
      totalPaid: 180000,
      ...summary,
    },
    purchases,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { role: "super_admin", organisationId: null };
  getOrg.mockResolvedValue(ORG);
  getLedger.mockResolvedValue(ledger());
  updateOrg.mockResolvedValue(ORG);
  grant.mockResolvedValue({ purchase: purchase(), summary: ledger().summary });
  renew.mockResolvedValue({ purchase: purchase(), summary: ledger().summary });
});

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

/**
 * A promise React's `use()` can read synchronously.
 *
 * The page takes `params` as a promise, which is the Next 16 convention the
 * other dynamic pages here follow. A bare `Promise.resolve()` suspends, and
 * nothing in a test environment ever schedules the retry; the boundary just
 * sits on its fallback forever. Tagging the thenable as already fulfilled is
 * how React represents a resolved promise internally, and it is honest: these
 * params *are* known before the render.
 */
function settled<T>(value: T): Promise<T> {
  const thenable = Promise.resolve(value) as Promise<T> & { status?: string; value?: T };
  thenable.status = "fulfilled";
  thenable.value = value;

  return thenable;
}

function renderPage() {
  return render(
    <Suspense fallback={<p>Loading</p>}>
      <OrganisationDetailPage params={settled({ slug: "acme-institute" })} />
    </Suspense>,
  );
}

describe("OrganisationDetailPage: access", () => {
  it("refuses an institution admin", async () => {
    currentUser = { role: "admin", organisationId: "org-1" };

    renderPage();

    expect(
      await screen.findByText(/this console is the platform owner/i),
    ).toBeInTheDocument();
    expect(getOrg).not.toHaveBeenCalled();
  });
});

describe("OrganisationDetailPage: the ledger", () => {
  /** The assertion that matters. */
  it("marks money it never witnessed as unverified", async () => {
    renderPage();

    const table = await screen.findByRole("table");
    const row = within(table).getByText(/bank transfer, ref 99120041/i).closest("tr");

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Unverified")).toBeInTheDocument();
  });

  it("marks a gateway-confirmed payment as verified", async () => {
    getLedger.mockResolvedValue(
      ledger({}, [purchase({ method: "paystack", methodLabel: "Paid online", verified: true })]),
    );

    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Verified")).toBeInTheDocument();
  });

  it("shows a negative adjustment as a reduction, not an addition", async () => {
    getLedger.mockResolvedValue(
      ledger({}, [
        purchase({
          seats: -5,
          amount: 0,
          method: "adjustment",
          methodLabel: "Manual adjustment",
          note: "Pilot wound down",
        }),
      ]),
    );

    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("-5")).toBeInTheDocument();
  });
});

describe("OrganisationDetailPage: pricing", () => {
  it("saves the price and the cap together, with the reason for the change", async () => {
    const user = userEvent.setup();
    renderPage();

    const price = await screen.findByLabelText(/price per seat/i);
    await user.clear(price);
    await user.type(price, "7500");

    const why = screen.getByLabelText(/why \(optional\)/i);
    await user.type(why, "Renegotiated");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateOrg).toHaveBeenCalledWith("acme-institute", {
        seatPrice: 7500,
        seatLimit: 50,
        billingPeriod: null,
        graceDays: null,
        seatLimitNote: "Renegotiated",
      }),
    );
  });

  /** Empty is "follow the platform default", which is not zero days. */
  it("sends null for an empty grace window rather than zero", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/grace window/i), "45");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateOrg).toHaveBeenCalledWith(
        "acme-institute",
        expect.objectContaining({ graceDays: 45 }),
      ),
    );

    updateOrg.mockClear();

    await user.clear(screen.getByLabelText(/grace window/i));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateOrg).toHaveBeenCalledWith(
        "acme-institute",
        expect.objectContaining({ graceDays: null }),
      ),
    );
  });

  it("offers the platform default as the placeholder, so the fallback is visible", async () => {
    renderPage();

    expect(await screen.findByPlaceholderText(/platform default \(14\)/i)).toBeInTheDocument();
  });

  it("sends null for an emptied price rather than zero", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(await screen.findByLabelText(/price per seat/i));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateOrg).toHaveBeenCalledWith(
        "acme-institute",
        expect.objectContaining({ seatPrice: null }),
      ),
    );
  });
});

describe("OrganisationDetailPage: the licence", () => {
  it("puts an institution on a recurring plan", async () => {
    const user = userEvent.setup();
    renderPage();

    await chooseOption(user, await screen.findByLabelText(/billing period/i), "Quarterly");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateOrg).toHaveBeenCalledWith(
        "acme-institute",
        expect.objectContaining({ billingPeriod: "quarterly" }),
      ),
    );
  });

  it("says when a lapsed licence started blocking, and what it does not do", async () => {
    getLedger.mockResolvedValue(
      ledger(onPlan({ licenceStatus: "lapsed", licenceStatusLabel: "Lapsed" })),
    );

    renderPage();

    expect(await screen.findByText("Lapsed")).toBeInTheDocument();
    expect(screen.getByText(/nobody has been signed out/i)).toBeInTheDocument();
  });

  /** Renewals buy time; the control for them is separate from the seat grant. */
  it("records a renewal against money that arrived elsewhere", async () => {
    getLedger.mockResolvedValue(ledger(onPlan()));

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /record a renewal/i }));

    // Both the renewal panel and the seat-grant card ask for an amount, so the
    // fields are reached through the panel that owns them.
    const panel = screen.getByRole("button", { name: /renew term/i }).closest("div")
      ?.parentElement as HTMLElement;

    await user.type(within(panel).getByLabelText(/amount received/i), "250000");
    await user.type(within(panel).getByLabelText(/^reference$/i), "INV-2026-114");
    await user.click(screen.getByRole("button", { name: /renew term/i }));

    await waitFor(() =>
      expect(renew).toHaveBeenCalledWith("acme-institute", {
        amount: 250000,
        note: "INV-2026-114",
      }),
    );
  });

  it("offers no renewal at all when the institution is not on a plan", async () => {
    renderPage();

    await screen.findByText("Not on a plan");

    expect(screen.queryByRole("button", { name: /record a renewal/i })).not.toBeInTheDocument();
  });

  it("shows a renewal in the ledger as a term rather than as seats", async () => {
    getLedger.mockResolvedValue(
      ledger(onPlan(), [
        purchase({
          kind: "renewal",
          kindLabel: "Renewal",
          seats: 0,
          periodEnd: "2027-12-31T00:00:00Z",
          note: "INV-2026-114",
        }),
      ]),
    );

    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByText(/term to/i)).toBeInTheDocument();
  });
});

describe("OrganisationDetailPage: offline grants", () => {
  it("records the seats and the amount that actually landed", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText(/seats to add/i), "40");
    await user.type(screen.getByLabelText(/amount received/i), "120000");
    await user.type(screen.getByLabelText(/reference \(optional\)/i), "Cheque 4471");

    await user.click(screen.getByRole("button", { name: /add seats/i }));

    await waitFor(() =>
      expect(grant).toHaveBeenCalledWith("acme-institute", {
        seats: 40,
        amount: 120000,
        note: "Cheque 4471",
      }),
    );
  });

  /** Selling seats against "unlimited" is meaningless. */
  it("refuses to grant against an uncapped institution and says why", async () => {
    getLedger.mockResolvedValue(ledger({ seatLimit: null, seatsRemaining: null, canBuy: false }));

    renderPage();

    expect(await screen.findByText(/no seat limit, so it already has room/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add seats/i })).toBeDisabled();
  });
});
