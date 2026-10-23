/**
 * Public pricing, onboarding and sales requests — the shapes, the defaults and
 * the browser calls.
 *
 * The owner's model (26 September 2026): modules are bought **once**, priced by
 * how many you take, in naira or dollars. Full source code ownership and a
 * dedicated server are by request. Money is integer minor units (kobo, cents)
 * with its currency, as everywhere else in the API.
 *
 * `DEFAULT_PRICING` is the owner's published ladder. The page renders it when
 * the API cannot be reached, so a visitor never sees an empty pricing page —
 * and because it is the same list the platform starts with, it is never a
 * different price from the one checkout will charge on a fresh install.
 */

export type Currency = "NGN" | "USD";
export type Tier = "1" | "2" | "3" | "4" | "5";
export const TIERS: readonly Tier[] = ["1", "2", "3", "4", "5"];

export type ModuleKey = "lms" | "hrm" | "projects" | "finance" | "admin";

export interface PublicModule {
  key: ModuleKey;
  label: string;
  summary: string;
  status: "available" | "coming_soon";
}

export interface PublicPricing {
  currencies: Currency[];
  ladder: Record<Currency, Record<Tier, number>>;
  sourceCode: Record<Currency, number>;
  dedicatedHosting: { billing: "yearly"; byRequest: true };
  modules: PublicModule[];
  /** Not in the contract's required fields; shown on the review step when the API sends it. */
  gateway?: { key: string; label: string; testMode: boolean } | null;
  /**
   * The owner's switch for online payment (`suite.module_payments`). Off: the
   * wizard ends in a licence request the team fulfils by hand, and checkout
   * answers 403. On: the wizard ends at the gateway as before.
   */
  paymentsEnabled: boolean;
}

/** Suite order: the live modules first, so "take three" means the three that ship. */
export const MODULE_ORDER: readonly ModuleKey[] = ["lms", "hrm", "projects", "finance", "admin"];

export const DEFAULT_PRICING: PublicPricing = {
  currencies: ["NGN", "USD"],
  ladder: {
    NGN: { "1": 250_000_000, "2": 450_000_000, "3": 600_000_000, "4": 850_000_000, "5": 1_050_000_000 },
    USD: { "1": 300_000, "2": 500_000, "3": 800_000, "4": 1_050_000, "5": 1_300_000 },
  },
  sourceCode: { NGN: 2_500_000_000, USD: 2_500_000 },
  dedicatedHosting: { billing: "yearly", byRequest: true },
  modules: [
    { key: "lms", label: "Learning", summary: "Courses, learning paths, compliance and certificates.", status: "available" },
    { key: "hrm", label: "HR", summary: "People, leave, attendance, payroll, hiring and reviews.", status: "available" },
    { key: "projects", label: "Projects", summary: "Portfolios, boards, sprints, time and client sharing.", status: "available" },
    { key: "finance", label: "Finance", summary: "Budgets, spend and the books, tied to the rest of the suite.", status: "coming_soon" },
    { key: "admin", label: "Admin", summary: "Assets, facilities, procurement and requests.", status: "coming_soon" },
  ],
  // The platform's default. Offline, a request can still be sent; a checkout could not.
  paymentsEnabled: false,
};

/**
 * Accepts whatever the API sent and fills any gap from the defaults, so a
 * partial response (say, one currency) still renders a complete page.
 */
export function normalisePricing(raw: unknown): PublicPricing {
  const data = (raw as { data?: Partial<PublicPricing> } | null)?.data ?? (raw as Partial<PublicPricing> | null);
  if (!data || typeof data !== "object") return DEFAULT_PRICING;

  const currencies = (Array.isArray(data.currencies) ? data.currencies : DEFAULT_PRICING.currencies).filter(
    (c): c is Currency => c === "NGN" || c === "USD",
  );
  const ladder = { ...DEFAULT_PRICING.ladder, ...(data.ladder ?? {}) } as PublicPricing["ladder"];
  const modules =
    Array.isArray(data.modules) && data.modules.length > 0
      ? [...data.modules].sort((a, b) => MODULE_ORDER.indexOf(a.key) - MODULE_ORDER.indexOf(b.key))
      : DEFAULT_PRICING.modules;

  return {
    currencies: currencies.length > 0 ? currencies : ["NGN"],
    ladder,
    sourceCode: { ...DEFAULT_PRICING.sourceCode, ...(data.sourceCode ?? {}) },
    dedicatedHosting: DEFAULT_PRICING.dedicatedHosting,
    modules,
    gateway: data.gateway ?? null,
    paymentsEnabled:
      typeof data.paymentsEnabled === "boolean" ? data.paymentsEnabled : DEFAULT_PRICING.paymentsEnabled,
  };
}

/** ₦2,500,000 / $3,000 — whole units, the way a one-time price is quoted. */
export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

/** ₦2.5m / $13k — for the compact places (per-module figures, savings). */
export function formatCompactMoney(minor: number, currency: Currency): string {
  const units = minor / 100;
  const symbol = currency === "NGN" ? "₦" : "$";
  if (units >= 1_000_000) return `${symbol}${trim(units / 1_000_000)}m`;
  if (units >= 1_000) return `${symbol}${trim(units / 1_000)}k`;
  return `${symbol}${trim(units)}`;
}

/** 2.5 → "2.5", 2.125 → "2.13", 3 → "3". */
function trim(n: number): string {
  return String(Number.parseFloat(n.toFixed(2)));
}

export function tierFor(count: number): Tier | null {
  return count >= 1 && count <= 5 ? (String(count) as Tier) : null;
}

/** What a tier saves against buying its modules one at a time. Never negative. */
export function savingFor(pricing: PublicPricing, tier: Tier, currency: Currency): number {
  const single = pricing.ladder[currency]["1"];
  return Math.max(0, single * Number(tier) - pricing.ladder[currency][tier]);
}

/* ------------------------------------------------------------------ */
/*  Browser calls (through the Next proxies — no session token)        */
/* ------------------------------------------------------------------ */

export class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> } & T;
  if (!res.ok) {
    throw new PublicApiError(data?.message ?? "Something went wrong. Try again.", res.status, data?.errors ?? {});
  }
  return data as T;
}

export interface OnboardingDetails {
  organisationName: string;
  name: string;
  email: string;
  phone: string;
  acceptTerms: boolean;
  /** Honeypot: must stay empty. */
  website: string;
}

export interface CheckoutResult {
  reference: string;
  authorizationUrl: string;
  gateway: string;
  claimToken: string;
}

export interface VerifyResult {
  status: "paid" | "pending" | "failed" | "abandoned";
  organisation: { name: string; slug: string } | null;
  email: string;
  modules: { key: string; label: string; deliveredWhenReleased: boolean }[];
  /** True when the proxy signed the new admin in (the token itself never reaches the browser). */
  signedIn: boolean;
}

export const onboarding = {
  checkout: (input: OnboardingDetails & { modules: ModuleKey[]; currency: Currency }) =>
    post<{ data: CheckoutResult }>("/api/onboarding/checkout", input).then((r) => r.data),
  verify: (reference: string, claimToken: string | null) =>
    post<{ data: VerifyResult }>("/api/onboarding/verify", { reference, claimToken }).then((r) => r.data),
};

/** `licence` is the module request that stands in for checkout while online payment is off. */
export type SalesRequestType = "source_code" | "dedicated_hosting" | "enterprise" | "licence";

export interface SalesRequestInput {
  type: SalesRequestType;
  name: string;
  email: string;
  phone: string;
  organisationName: string;
  message?: string;
  currency?: Currency;
  /** Required for `licence` (1–10 module keys), rejected for every other type. */
  modules?: ModuleKey[];
  website: string;
}

export const salesRequests = {
  create: (input: SalesRequestInput) =>
    post<{ data: { id: string; reference: string } }>("/api/public/sales-requests", input).then((r) => r.data),
};

/** Where the checkout's claim token waits while the buyer is at the gateway. */
export const CLAIM_STORAGE_KEY = "xwifthq.onboarding.claim";
export const ONBOARDING_STORAGE_KEY = "xwifthq.onboarding.details";
