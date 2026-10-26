/* ------------------------------------------------------------------ */
/*  The affiliate programme.                                           */
/*                                                                     */
/*  `publicAffiliates`: the terms, a code check, a visit through a     */
/*  link and an application (no sign-in, `/api/public/affiliates/*`).  */
/*  `myAffiliate`: an affiliate's own dashboard (`/api/me/affiliate`).  */
/*  `platformAffiliates`: the Platform console's side                  */
/*  (`/api/platform/affiliates/*`).                                    */
/*                                                                     */
/*  Money is integer minor units with its currency, like the rest of   */
/*  the API; format it with `formatMoney` from `@/lib/money`.          */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";
import { platformRequest, queryString } from "@/lib/api/platform-client";

export { ApiError };

const unwrap = <T,>(r: { data: T }) => r.data;

/* ------------------------------------------------------------------ */
/*  Shapes                                                             */
/* ------------------------------------------------------------------ */

export interface ProgrammeTerms {
  open: boolean;
  commissionPercent: number;
  discountPercent: number;
  cookieDays: number;
  holdDays: number;
}

/** The owner's ruling of 26 Oct 2026, used until the API answers. */
export const DEFAULT_TERMS: ProgrammeTerms = {
  open: true,
  commissionPercent: 20,
  discountPercent: 10,
  cookieDays: 60,
  holdDays: 14,
};

export type AffiliateStatus = "pending" | "approved" | "rejected" | "suspended";

export interface PayoutDetails {
  bankName: string;
  /** Masked to the last four digits for the affiliate; in full for the platform. */
  accountNumber: string;
  accountName: string;
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  code: string | null;
  link: string | null;
  status: AffiliateStatus;
  statusLabel: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  createdAt: string | null;
  payoutDetails: PayoutDetails | null;
}

/** What only the platform sees of an affiliate. */
export interface PlatformAffiliate extends Affiliate {
  phone: string | null;
  country: string | null;
  audienceUrl: string | null;
  promotion: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  hasAccount: boolean;
}

export interface PlatformAffiliateRow extends PlatformAffiliate {
  referralCount: number;
  payingReferralCount: number;
  /** Commission earned so far (not reversed), per currency. */
  earned: Record<string, number>;
}

export interface AffiliateRef {
  id: string;
  name: string;
  code: string | null;
}

export interface Referral {
  id: string;
  organisation: { name: string; slug?: string } | null;
  source: "signup" | "sales_request" | "manual";
  sourceLabel: string;
  referredAt: string | null;
  firstPaidAt: string | null;
  status: "signed_up" | "paying";
  statusLabel: string;
  /** Platform only. */
  affiliate: AffiliateRef | null;
}

export type CommissionStatus = "pending" | "approved" | "paid" | "reversed";

export interface Commission {
  id: string;
  organisation: { name: string; slug?: string } | null;
  /** Platform only. */
  affiliate: AffiliateRef | null;
  sourceType: "seat_purchase" | "module_purchase";
  sourceLabel: string;
  /** Platform only. */
  sourceReference: string | null;
  currency: string;
  /** What the organisation paid. */
  paidMinor: number;
  /** The referral discount it was given. */
  discountMinor: number;
  /** Paid plus discount: the price the commission is worked out on. */
  baseMinor: number;
  ratePercent: number;
  amountMinor: number;
  status: CommissionStatus;
  statusLabel: string;
  earnedAt: string;
  /** When the hold period ends and it becomes ready to pay. */
  availableAt: string;
  approvedAt: string | null;
  reversedAt: string | null;
  reversalNote: string | null;
  payout: { id: string; reference: string; paidOn: string } | null;
}

export type PayoutMethod = "bank_transfer" | "cheque" | "cash" | "other";

export const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export interface Payout {
  id: string;
  reference: string;
  currency: string;
  amountMinor: number;
  method: PayoutMethod;
  methodLabel: string;
  paymentReference: string | null;
  paidOn: string;
  note: string | null;
  commissionCount: number;
  /** Platform only. */
  affiliate: AffiliateRef | null;
  /** Platform only. */
  recordedBy: string | null;
  createdAt: string | null;
}

/** Commission by status, per currency: `{ NGN: { pending, approved, paid, reversed } }`. */
export type Earnings = Record<string, Record<CommissionStatus, number>>;

export interface MonthFigures {
  month: string;
  label: string;
  clicks: number;
  referrals: number;
  firstPayments: number;
  /** Commission earned that month, per currency. */
  earned: Record<string, number>;
}

export interface AffiliateStats {
  clicks: number;
  clicksLast30Days: number;
  referrals: number;
  payingReferrals: number;
  conversionPercent: number | null;
  earnings: Earnings;
  months: MonthFigures[];
}

export interface MyAffiliate {
  affiliate: Affiliate;
  programme: ProgrammeTerms;
  stats: AffiliateStats;
}

export interface Page<T> {
  data: T[];
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
}

export interface CodeCheck {
  valid: boolean;
  code: string | null;
  firstName: string | null;
  discountPercent: number;
  cookieDays: number;
}

export interface AffiliateApplication {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  audienceUrl?: string;
  promotion: string;
  acceptTerms: boolean;
  /** Honeypot: never shown, so only a bot fills it. */
  website?: string;
}

export interface PlatformProgrammeStats {
  affiliates: { pending: number; approved: number; suspended: number; rejected: number };
  clicksLast30Days: number;
  referrals: number;
  payingReferrals: number;
  conversionPercent: number | null;
  earnings: Earnings;
  paidOut: Record<string, number>;
  referredRevenue: Record<string, number>;
  topAffiliates: { id: string; name: string | null; code: string | null; currency: string; earnedMinor: number; organisations: number }[];
  months: MonthFigures[];
}

export interface PlatformAffiliateDetail {
  affiliate: PlatformAffiliate;
  stats: AffiliateStats | null;
  referrals: Referral[];
  commissions: Commission[];
  payouts: Payout[];
}

export interface OrganisationReferral {
  referral: Referral | null;
  /** The discount the organisation's next payment gets; 0 once it has paid. */
  discountPercent: number;
}

export interface NewPayout {
  currency: string;
  commissionIds?: string[];
  method: PayoutMethod;
  reference?: string;
  paidOn: string;
  note?: string;
}

/* ------------------------------------------------------------------ */
/*  Requests                                                           */
/* ------------------------------------------------------------------ */

async function call<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }

  return json as T;
}

export const publicAffiliates = {
  programme: () => call<{ data: ProgrammeTerms }>("/api/public/affiliates/programme").then(unwrap),
  code: (code: string) => call<{ data: CodeCheck }>(`/api/public/affiliates/codes/${encodeURIComponent(code)}`).then(unwrap),
  click: (body: { code: string; path?: string; referrer?: string }) =>
    call<{ data: CodeCheck }>("/api/public/affiliates/clicks", { method: "POST", body }).then(unwrap),
  apply: (body: AffiliateApplication) =>
    call<{ data: { id: string; status: AffiliateStatus } }>("/api/public/affiliates/applications", { method: "POST", body }).then(unwrap),
};

export const myAffiliate = {
  get: () => call<{ data: MyAffiliate }>("/api/me/affiliate").then(unwrap),
  referrals: (page = 1) => call<Page<Referral>>(`/api/me/affiliate/referrals${queryString({ page })}`),
  commissions: (q: { status?: CommissionStatus; page?: number } = {}) =>
    call<Page<Commission>>(`/api/me/affiliate/commissions${queryString({ ...q })}`),
  payouts: (page = 1) => call<Page<Payout>>(`/api/me/affiliate/payouts${queryString({ page })}`),
  updatePayoutDetails: (body: { bankName: string; accountNumber: string; accountName: string }) =>
    call<{ data: Affiliate }>("/api/me/affiliate/payout-details", { method: "PUT", body }).then(unwrap),
};

export const platformAffiliates = {
  list: (q: { status?: AffiliateStatus; search?: string; page?: number } = {}) =>
    platformRequest<Page<PlatformAffiliateRow>>(`affiliates${queryString({ ...q })}`),
  overview: () =>
    platformRequest<{ data: { programme: ProgrammeTerms; stats: PlatformProgrammeStats } }>("affiliates/overview").then(unwrap),
  get: (id: string) => platformRequest<{ data: PlatformAffiliateDetail }>(`affiliates/${id}`).then(unwrap),
  approve: (id: string, body: { code?: string; note?: string } = {}) =>
    platformRequest<{ data: PlatformAffiliate }>(`affiliates/${id}/approve`, { method: "POST", body }).then(unwrap),
  reject: (id: string, body: { note?: string } = {}) =>
    platformRequest<{ data: PlatformAffiliate }>(`affiliates/${id}/reject`, { method: "POST", body }).then(unwrap),
  suspend: (id: string, body: { note?: string } = {}) =>
    platformRequest<{ data: PlatformAffiliate }>(`affiliates/${id}/suspend`, { method: "POST", body }).then(unwrap),
  reinstate: (id: string) =>
    platformRequest<{ data: PlatformAffiliate }>(`affiliates/${id}/reinstate`, { method: "POST", body: {} }).then(unwrap),

  commissions: (q: { status?: CommissionStatus; affiliate?: string; page?: number } = {}) =>
    platformRequest<Page<Commission>>(`affiliates/commissions${queryString({ ...q })}`),
  approveCommission: (id: string) =>
    platformRequest<{ data: Commission }>(`affiliates/commissions/${id}/approve`, { method: "POST", body: {} }).then(unwrap),
  reverseCommission: (id: string, note: string) =>
    platformRequest<{ data: Commission }>(`affiliates/commissions/${id}/reverse`, { method: "POST", body: { note } }).then(unwrap),

  payouts: (q: { affiliate?: string; page?: number } = {}) =>
    platformRequest<Page<Payout>>(`affiliates/payouts${queryString({ ...q })}`),
  recordPayout: (affiliateId: string, body: NewPayout) =>
    platformRequest<{ data: Payout }>(`affiliates/${affiliateId}/payouts`, { method: "POST", body }).then(unwrap),

  referrals: (q: { affiliate?: string; page?: number } = {}) =>
    platformRequest<Page<Referral>>(`affiliates/referrals${queryString({ ...q })}`),
  organisationReferral: (slug: string) =>
    platformRequest<{ data: OrganisationReferral }>(`affiliates/referrals/${slug}`).then(unwrap),
  attachReferral: (slug: string, code: string) =>
    platformRequest<{ data: OrganisationReferral }>(`affiliates/referrals/${slug}`, { method: "PUT", body: { code } }).then(unwrap),
  detachReferral: (slug: string) =>
    platformRequest<{ data: OrganisationReferral }>(`affiliates/referrals/${slug}`, { method: "DELETE" }).then(unwrap),

  settings: () => platformRequest<{ data: ProgrammeTerms }>("affiliates/settings").then(unwrap),
  updateSettings: (body: Partial<ProgrammeTerms>) =>
    platformRequest<{ data: ProgrammeTerms }>("affiliates/settings", { method: "PUT", body }).then(unwrap),
};

/** "20%" or "12.5%": a percentage with no trailing zeros. */
export function percentText(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}%`;
}
