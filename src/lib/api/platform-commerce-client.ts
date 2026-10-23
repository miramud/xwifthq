/* ------------------------------------------------------------------ */
/*  Platform console: sales and payment reconciliation.                */
/*  Pricing, the gateway and sales requests: platform-billing-client.  */
/*  Newer rows carry minor units + currency (`amountMinor`); older NGN */
/*  rows carry kobo. Read amounts through `minorOf` and format them    */
/*  with `formatMoney`, never by dividing here and there.              */
/* ------------------------------------------------------------------ */

import {
  platformRequest,
  queryString,
  type LicenceChannel,
  type LicenceKind,
  type LicencePaymentMethod,
  type LicenceRow,
  type Paginated,
} from "@/lib/api/platform-client";

export { ApiError } from "@/lib/api/platform-client";

const unwrap = <T,>(r: { data: T }) => r.data;

/* ------------------------------------------------------------------ */
/*  Sales                                                              */
/* ------------------------------------------------------------------ */

export type SalesInterval = "day" | "week" | "month";

export interface SalesReport {
  totals: {
    grossKobo: number;
    platformFeeKobo: number;
    netToOrganisationsKobo: number;
    orders: number;
    seatsSold: number;
  };
  series: { period: string; grossKobo: number; orders: number }[];
  byOrganisation: { slug: string; name: string; grossKobo: number; orders: number }[];
  /** One row per product; module subscriptions come one row per module (`module` is its key). */
  byProduct: { kind: "seats" | "course" | "module"; label: string; grossKobo: number; orders: number; module?: string }[];
  /** Gross per payment gateway. Absent on an API older than gateway choice. */
  byGateway?: { gateway: string; grossKobo: number; orders: number }[];
}

export interface SalesOrder {
  id: string;
  kind: "seats" | "renewal" | "course" | string;
  organisation: { slug: string; name: string } | null;
  customer: { name: string; email: string } | null;
  amountKobo?: number;
  amountMinor?: number;
  currency: string;
  status: string;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  /** Module rows: bought online or licensed by hand (`kind: "licence"`). */
  channel?: LicenceChannel;
  purchaseKind?: LicenceKind | null;
  modulesAfter?: number | null;
  paymentMethod?: LicencePaymentMethod | null;
  paymentReference?: string | null;
}

export interface SalesQuery {
  from?: string;
  to?: string;
  interval?: SalesInterval;
}

export const platformSales = {
  report: (q: SalesQuery = {}) =>
    platformRequest<{ data: SalesReport }>(`sales${queryString({ ...q })}`).then(unwrap),
  orders: (q: SalesQuery & { page?: number; perPage?: number; status?: string; search?: string } = {}) =>
    platformRequest<Paginated<SalesOrder>>(`sales/orders${queryString({ ...q })}`),
  /** The licence ledger: every paid module sale, online and by hand, with per-currency totals. */
  licences: (q: LicenceLedgerQuery = {}) =>
    platformRequest<LicenceLedger>(`sales/licences${queryString({ ...q })}`),
  /** The same ledger as a CSV download, through the proxy's file branch. */
  licencesCsvUrl: (q: LicenceLedgerQuery = {}) =>
    `/api/platform/sales/licences${queryString({ ...q, format: "csv" })}`,
};

/* ------------------------------------------------------------------ */
/*  Licence ledger                                                     */
/* ------------------------------------------------------------------ */

export interface LicenceLedgerQuery {
  from?: string;
  to?: string;
  channel?: LicenceChannel;
  kind?: LicenceKind;
  currency?: "NGN" | "USD";
}

/** One currency's totals; naira and dollars are never added together. */
export interface LicenceLedgerTotals {
  currency: string;
  sales: number;
  paidMinor: number;
  listPriceMinor: number;
  creditMinor: number;
  discountMinor: number;
  offline: number;
  online: number;
  newPurchases: number;
  upgrades: number;
}

export interface LicenceLedger {
  data: LicenceRow[];
  totals: LicenceLedgerTotals[];
}

/* ------------------------------------------------------------------ */
/*  Payments reconciliation                                            */
/* ------------------------------------------------------------------ */

/**
 * - `matched`: the gateway and our record agree.
 * - `pending`: we expect money the gateway has not confirmed.
 * - `mismatch`: both exist but disagree (usually the amount).
 * - `orphan`: the gateway told us about money we have no order for.
 */
export type PaymentStatus = "matched" | "pending" | "mismatch" | "orphan";

export type Resolution = "mark_paid" | "mark_failed" | "ignore";

/**
 * What a payment bought. `signup` is a new organisation onboarding itself
 * (there is no organisation until it's paid); `licence` is modules the owner
 * licensed by hand against money paid offline (always `matched`, no gateway
 * to ask). Older rows may carry other kinds ("renewal").
 */
export type PaymentKind = "module" | "seats" | "signup" | "licence";

export interface Payment {
  id: string;
  reference: string;
  /** Legacy name for the gateway; `gateway` wins when both are present. */
  provider: "paystack" | string;
  gateway?: "paystack" | "flutterwave" | string;
  kind: PaymentKind | string;
  /** Module keys a module payment covers. */
  modules?: string[];
  organisation: { slug: string; name: string } | null;
  /** On a `signup`: who is onboarding, before the organisation exists. */
  signup?: { organisationName: string; name: string; email: string } | null;
  expectedKobo?: number;
  receivedKobo?: number | null;
  expectedMinor?: number;
  receivedMinor?: number | null;
  currency?: string;
  status: PaymentStatus;
  webhookAt: string | null;
  verifiedAt: string | null;
  note: string | null;
  createdAt: string;
  /** Licence rows: how it was paid, the bank/cheque/receipt reference and who recorded it. */
  paymentMethod?: LicencePaymentMethod | null;
  paymentReference?: string | null;
  recordedBy?: string | null;
  purchaseKind?: LicenceKind | null;
  modulesAfter?: number | null;
}

export interface PaymentSummary {
  matched: number;
  pending: number;
  mismatch: number;
  orphan: number;
  unreconciledKobo: number;
}

/** An amount in minor units from whichever field a row carries. */
export function minorOf(minor: number | null | undefined, kobo: number | null | undefined): number | null {
  if (typeof minor === "number") return minor;
  if (typeof kobo === "number") return kobo;
  return null;
}

export const platformPayments = {
  list: (
    q: {
      status?: PaymentStatus | "";
      gateway?: string;
      kind?: PaymentKind | "";
      page?: number;
      perPage?: number;
      search?: string;
    } = {},
  ) =>
    platformRequest<Paginated<Payment>>(`payments${queryString({ ...q })}`),
  summary: () => platformRequest<{ data: PaymentSummary }>("payments/summary").then(unwrap),
  /** Asks the payment's own gateway again and returns the row as it now stands. */
  verify: (id: string) =>
    platformRequest<{ data: Payment }>(`payments/${encodeURIComponent(id)}/verify`, { method: "POST" }).then(
      unwrap,
    ),
  resolve: (id: string, resolution: Resolution, note: string) =>
    platformRequest<{ data: Payment }>(`payments/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      body: { resolution, note },
    }).then(unwrap),
};
