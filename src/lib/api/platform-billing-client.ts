/* ------------------------------------------------------------------ */
/*  Platform console: the price ladder, the payment gateway, sales     */
/*  requests and one-time sales analytics.                             */
/*                                                                      */
/*  Modules are sold once, on a ladder by how many an organisation     */
/*  owns (the owner's ruling of 26 Sep 2026); per-period prices,       */
/*  per-organisation overrides and subscription figures are retired.   */
/*  Money is integer minor units + a currency code on the wire.        */
/* ------------------------------------------------------------------ */

import { platformRequest, queryString } from "@/lib/api/platform-client";

export { ApiError } from "@/lib/api/platform-client";

const unwrap = <T,>(r: { data: T }) => r.data;

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

/** The currencies the platform sells in, in the order screens show them. */
export const SELLING_CURRENCIES = ["NGN", "USD"] as const;
export type SellingCurrency = (typeof SELLING_CURRENCIES)[number];

/** The rungs of the ladder: owning one module up to all five. */
export const LADDER_RUNGS = [1, 2, 3, 4, 5] as const;
export type LadderRung = (typeof LADDER_RUNGS)[number];

/** Minor units for owning N modules, keyed "1" … "5". */
export type Ladder = Record<string, number>;

export interface PlatformPricing {
  ladder: Record<SellingCurrency, Ladder>;
  sourceCode: Record<SellingCurrency, number>;
}

export const platformPricing = {
  get: () => platformRequest<{ data: PlatformPricing }>("pricing").then(unwrap),
  save: (body: PlatformPricing) =>
    platformRequest<{ data: PlatformPricing }>("pricing", { method: "PUT", body }).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Payment settings                                                   */
/* ------------------------------------------------------------------ */

export type GatewayKey = "paystack" | "flutterwave";

export interface GatewayStatus {
  key: GatewayKey | string;
  label: string;
  configured: boolean;
  testMode: boolean;
  webhookUrl: string;
  /** Flutterwave only: whether FLUTTERWAVE_SECRET_HASH is set. `null` for gateways without one. */
  secretHashConfigured: boolean | null;
  callbackUrls: { modules: string; seats: string };
}

export interface PaymentSettings {
  gateway: GatewayKey | string;
  currency: string;
  gateways: GatewayStatus[];
}

export const platformPaymentSettings = {
  get: () => platformRequest<{ data: PaymentSettings }>("payment-settings").then(unwrap),
  setGateway: (gateway: string) =>
    platformRequest<{ data: PaymentSettings }>("payment-settings", { method: "PUT", body: { gateway } }).then(unwrap),
};

/** "Flutterwave" for "flutterwave", and a readable fallback for anything newer. */
export function gatewayLabel(key: string | null | undefined): string {
  if (!key) return "the gateway";
  if (key === "paystack") return "Paystack";
  if (key === "flutterwave") return "Flutterwave";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Sales requests                                                     */
/* ------------------------------------------------------------------ */

export type SalesRequestType = "source_code" | "dedicated_hosting" | "enterprise" | "licence";
export type SalesRequestStatus = "new" | "contacted" | "won" | "lost";

export const SALES_REQUEST_TYPE_LABEL: Record<SalesRequestType, string> = {
  source_code: "Source code",
  dedicated_hosting: "Dedicated server",
  enterprise: "Enterprise",
  licence: "Module licence",
};

export const SALES_REQUEST_STATUS_LABEL: Record<SalesRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost",
};

export interface SalesRequest {
  id: string;
  type: SalesRequestType | string;
  name: string;
  email: string;
  phone: string | null;
  organisationName: string | null;
  message: string | null;
  currency: string | null;
  /** Licence requests: the module keys asked for, and how many. */
  modules?: string[];
  moduleCount?: number | null;
  /** Set when an existing organisation asked from its billing page. */
  organisationId?: string | null;
  /** That organisation, for linking to its console page. */
  organisation?: { slug: string; name: string } | null;
  status: SalesRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesRequestPage {
  data: SalesRequest[];
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
}

export const platformSalesRequests = {
  list: (q: { type?: string; status?: string; page?: number } = {}) =>
    platformRequest<SalesRequestPage>(`sales-requests${queryString({ ...q })}`),
  update: (id: string, body: { status?: SalesRequestStatus; notes?: string | null }) =>
    platformRequest<{ data: SalesRequest }>(`sales-requests/${encodeURIComponent(id)}`, { method: "PATCH", body }).then(
      unwrap,
    ),
  /** Soft delete: the request moves to the platform recycle bin. */
  remove: (id: string) => platformRequest<unknown>(`sales-requests/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/* ------------------------------------------------------------------ */
/*  One-time sales analytics                                           */
/* ------------------------------------------------------------------ */

/** Per-currency minor units; a currency with no sales is absent. */
export type ByCurrencyMinor = Partial<Record<"NGN" | "USD", number>>;

export interface OneTimeSales {
  /** Paid module purchases by how many modules they took the buyer to, per currency. */
  byTier: { modules: number; currency: string; orders: number; grossMinor: number }[];
  byCurrency: { currency: string; orders: number; grossMinor: number }[];
  /** Online checkout against licensed by hand. Absent on an older API. */
  byChannel?: { channel: "online" | "offline"; orders: number; byCurrency: ByCurrencyMinor }[];
  /** First purchase against upgrade. Absent on an older API. */
  byKind?: { kind: "new" | "upgrade"; orders: number; byCurrency: ByCurrencyMinor }[];
  /** Self-serve onboarding: checkouts started, paid, abandoned, still pending. */
  onboarding: { started: number; paid: number; abandoned: number; pending: number };
  salesRequests: {
    byStatus: Partial<Record<SalesRequestStatus, number>>;
    byType: Partial<Record<SalesRequestType, number>>;
  };
}

export const platformOneTimeSales = {
  summary: (q: { from?: string; to?: string } = {}) =>
    platformRequest<{ data: OneTimeSales }>(`sales/one-time${queryString({ ...q })}`).then(unwrap),
};
