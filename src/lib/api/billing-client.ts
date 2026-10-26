/* ------------------------------------------------------------------ */
/*  Browser-side client for an organisation's Plan & billing.          */
/*  Same-origin /api/admin/billing/* proxy; the token stays httpOnly.  */
/*                                                                      */
/*  Modules are bought once and kept for good (the owner's ruling of   */
/*  26 Sep 2026). The price follows a ladder by how many modules the   */
/*  organisation owns, and adding modules later pays only the          */
/*  difference between rungs. The platform owner picks the gateway, so */
/*  nothing here names one: the API says which, and we show it.        */
/*                                                                      */
/*  Money is integer minor units + a currency code (kobo for NGN,      */
/*  cents for USD). Format it with `formatMoney` from `@/lib/money`.   */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";
import { formatMoney, type CurrencyCode } from "@/lib/money";

export { ApiError };
export type { CurrencyCode };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/admin/billing/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }

  return json as T;
}

function query(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/* ---------- Types ---------- */

export type BillableModule = "lms" | "hrm" | "projects" | "finance" | "admin";

/** Price in minor units by how many modules are owned: "1" … "5". */
export type Ladder = Record<string, number>;

export interface Gateway {
  key: "paystack" | "flutterwave" | string;
  label: string;
  testMode: boolean;
}

export interface ModuleOffer {
  key: BillableModule | string;
  label: string;
  status: "active" | "preview";
  /** How the organisation came to have it, when it does. */
  source: "purchase" | "manual" | "default" | null;
  /** Bought (or granted) already — not for sale to this organisation again. */
  owned: boolean;
  /** Finance and Admin: bought now, switched on the day they ship. */
  deliveredWhenReleased: boolean;
  purchasable: boolean;
}

export interface BillingCatalogue {
  gateway: Gateway;
  /** Currencies the selected gateway can charge in, e.g. ["NGN", "USD"]. */
  currencies: CurrencyCode[];
  ladder: Record<string, Ladder>;
  /** Modules this organisation has bought so far (the platform owner's grants don't count). */
  purchasedCount: number;
  modules: ModuleOffer[];
  /**
   * The owner's switch for online payment. Off: there is no checkout, and an
   * admin sends a request the platform owner fulfils by hand (`requestModules`).
   */
  paymentsEnabled: boolean;
}

export interface ModuleQuote {
  purchasedCount: number;
  addingCount: number;
  /** Ladder price for purchased + adding. */
  fullPriceMinor: number;
  /** Ladder price already paid for the purchased modules. */
  creditMinor: number;
  /** What this checkout charges: full price minus credit, minus any referral discount. */
  amountMinor: number;
  /** The affiliate referral discount on the organisation's first payment; 0 or absent when none. */
  referralDiscountMinor?: number;
  currency: CurrencyCode;
}

export interface ModuleRequestInput {
  modules: string[];
  currency?: CurrencyCode;
  message?: string;
  phone?: string;
}

export interface ModuleRequest {
  id: string;
  /** What the admin quotes back to us, e.g. "SR-4F9A21C7". */
  reference: string;
}

export interface Checkout {
  reference: string;
  authorizationUrl: string;
  gateway: string;
}

export type PurchaseStatus = "pending" | "paid" | "failed" | "abandoned" | "cancelled";

export interface PurchasedModule {
  key: string;
  label: string;
  /** Older subscription rows carry a term; one-time purchases have none. */
  startsOn?: string | null;
  endsOn?: string | null;
  deliveredWhenReleased?: boolean;
}

export interface Purchase {
  id: string;
  kind: "module" | "seats" | string;
  reference: string;
  gateway: string;
  status: PurchaseStatus;
  amountMinor?: number;
  /** NGN rows from before the currency switch; read through `amountOf`. */
  amountKobo?: number;
  currency: CurrencyCode;
  /** Only on rows from the retired per-period model. */
  period?: string | null;
  modules: PurchasedModule[];
  seats: number | null;
  createdAt: string;
  paidAt: string | null;
}

export interface ReceiptLine {
  description?: string;
  label?: string;
  module?: string | null;
  amountMinor?: number;
  amountKobo?: number;
  startsOn?: string | null;
  endsOn?: string | null;
}

export interface Receipt extends Purchase {
  lines?: ReceiptLine[];
  organisation: { name: string; slug: string };
  billedTo: { name: string; email: string };
}

export interface Paginated<T> {
  data: T[];
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
}

/* ---------- Calls ---------- */

export const billing = {
  catalogue: () => request<{ data: BillingCatalogue }>("modules").then((r) => r.data),

  quote: (modules: string[], currency: CurrencyCode) =>
    request<{ data: ModuleQuote }>("modules/quote", { method: "POST", body: { modules, currency } }).then((r) => r.data),

  checkout: (modules: string[], currency: CurrencyCode) =>
    request<{ data: Checkout }>("modules/checkout", { method: "POST", body: { modules, currency } }).then((r) => r.data),

  /** While online payment is off: ask the platform owner to switch these on. */
  requestModules: (input: ModuleRequestInput) =>
    request<{ data: ModuleRequest }>("modules/request", { method: "POST", body: input }).then((r) => r.data),

  /** Idempotent: the webhook may already have fulfilled it. */
  verify: (reference: string) =>
    request<{ data: Purchase }>("verify", { method: "POST", body: { reference } }).then((r) => r.data),

  purchases: (filters: { kind?: string; status?: string; page?: number } = {}) =>
    request<Paginated<Purchase>>(`purchases${query(filters)}`),

  purchase: (id: string) =>
    request<{ data: Receipt }>(`purchases/${encodeURIComponent(id)}`).then((r) => r.data),
};

/* ---------- Helpers shared by the billing screens ---------- */

/** A purchase's amount in minor units, whichever field the row carries. */
export function amountOf(p: { amountMinor?: number | null; amountKobo?: number | null }): number | null {
  if (typeof p.amountMinor === "number") return p.amountMinor;
  if (typeof p.amountKobo === "number") return p.amountKobo;
  return null;
}

/** A purchase's amount, formatted in its own currency. */
export function purchaseAmount(p: { amountMinor?: number | null; amountKobo?: number | null; currency?: string | null }): string {
  return formatMoney(amountOf(p), p.currency ?? "NGN");
}

/** The ladder price for `count` modules, or null when that rung isn't set. */
export function ladderPrice(ladder: Ladder | undefined, count: number): number | null {
  if (!ladder || count < 1) return null;
  const v = ladder[String(count)];
  return typeof v === "number" ? v : null;
}

export const STATUS_LABEL: Record<PurchaseStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
};

/** Human gateway name for a stored gateway key. */
export function gatewayLabel(key: string | null | undefined): string {
  switch (key) {
    case "flutterwave":
      return "Flutterwave";
    case "paystack":
      return "Paystack";
    case "offline":
      return "Bank transfer";
    default:
      return key ? key.charAt(0).toUpperCase() + key.slice(1) : "-";
  }
}
