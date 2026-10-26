/* ------------------------------------------------------------------ */
/*  Browser-side client for the platform console (`/api/platform/*`).  */
/*  Same-origin proxy; the bearer token stays httpOnly on the server.  */
/*                                                                     */
/*  Overview, organisations (modules, suspension, deletion), modules,  */
/*  analytics and governance. Sales and payments are in                */
/*  platform-commerce-client, system users and platform roles in       */
/*  platform-access-client.                                            */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";
import type { Paginated } from "@/lib/api/users-client";
import type { Organisation } from "@/lib/api/saas-client";
import type { OrgUser } from "@/lib/api/users-client";

export { ApiError };
export type { Paginated };

export async function platformRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/platform/${path}`, {
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

/** `?a=1&b=2`, skipping empty values. */
export function queryString(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const unwrap = <T,>(r: { data: T }) => r.data;

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

export type AlertSeverity = "info" | "warning" | "critical";

export interface PlatformAlert {
  kind: string;
  severity: AlertSeverity;
  message: string;
  href: string | null;
  at: string;
}

export interface PlatformOverview {
  organisations: { total: number; active: number; suspended: number; newThisMonth: number };
  users: { total: number; byRole: Record<string, number>; active30d: number };
  revenue: {
    grossKobo: number;
    platformFeeKobo: number;
    thisMonthKobo: number;
    lastMonthKobo: number;
    currency: string;
  };
  seats: { sold: number; used: number };
  modules: { key: string; label: string; organisations: number; activeUsers30d: number }[];
  alerts: PlatformAlert[];
  recentOrganisations: { slug: string; name: string; createdAt: string; modules: string[] }[];
}

export const platformOverview = {
  get: () => platformRequest<{ data: PlatformOverview }>("overview").then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Organisations                                                      */
/* ------------------------------------------------------------------ */

export interface OrganisationModule {
  key: string;
  label: string;
  entitled: boolean;
  /** `licence` when recorded against this organisation; `default` when it rides the platform default. */
  source: "licence" | "default";
  since: string | null;
  until: string | null;
  /** False while the module is unreleased deployment-wide — still a preview for everyone. */
  released: boolean;
  /** Opened for this organisation ahead of release. Only meaningful while `released` is false. */
  earlyAccess: boolean;
}

export interface ModuleChange {
  key: string;
  enabled: boolean;
  /** ISO date; omitted or null for "no end date". */
  until?: string | null;
  /** Open an unreleased module for this organisation. Only takes effect while `enabled`. */
  earlyAccess?: boolean;
}

export interface PlatformAuditEntry {
  id: string;
  action: string;
  severity: "info" | "warning" | "critical" | string;
  actor: { id: string; name: string; email?: string | null } | null;
  organisation: { slug: string; name: string } | null;
  subject: { type: string; id: string | null; label: string | null } | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  at: string;
}

export interface AuditFilters {
  organisation?: string;
  actor?: string;
  action?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

/* Module licences: one-time purchases, recorded by hand or bought online. */

export type LicenceCurrency = "NGN" | "USD";
export type LicenceKind = "new" | "upgrade";
export type LicenceChannel = "offline" | "online";
/** How a licence recorded by hand was paid; `gateway` marks an online checkout. */
export type LicencePaymentMethod =
  | "bank_transfer"
  | "cheque"
  | "cash"
  | "card"
  | "complimentary"
  | "other"
  | "gateway";

export const LICENCE_METHOD_LABEL: Record<LicencePaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card (in person)",
  complimentary: "Complimentary",
  other: "Other",
  gateway: "Online checkout",
};

/** One module purchase. Amounts are minor units (kobo, cents) in `currency`. */
export interface LicenceRow {
  id: string;
  /** `LIC-…` when recorded by hand, `MOD-…` when bought online. */
  reference: string;
  status: string;
  organisation: { slug: string; name: string } | null;
  channel: LicenceChannel;
  gateway: string | null;
  kind: LicenceKind;
  /** The modules this purchase added. */
  modules: string[];
  modulesBefore: number;
  modulesAdded: number;
  modulesAfter: number;
  currency: LicenceCurrency | string;
  amountMinor: number;
  listPriceMinor: number;
  creditMinor: number;
  /** List less credit less paid; negative when more than the list difference was paid. */
  discountMinor: number;
  paymentMethod: LicencePaymentMethod | null;
  paymentReference: string | null;
  note: string | null;
  paidBy: { name: string; email: string } | null;
  recordedBy: { name: string; email: string } | null;
  paidAt: string | null;
  createdAt: string | null;
}

export interface LicencePreview {
  kind: LicenceKind;
  modulesBefore: number;
  modulesAdded: number;
  modulesAfter: number;
  listPriceMinor: number;
  creditMinor: number;
  suggestedMinor: number;
  /** The affiliate referral discount already taken off `suggestedMinor`. */
  referralDiscountMinor?: number;
  currency: LicenceCurrency;
  /** The picked modules this licence would add. */
  modules: string[];
  /** The picked modules the organisation already owns. */
  alreadyLicensed: string[];
}

export interface NewLicence {
  modules: string[];
  currency: LicenceCurrency;
  amountMinor: number;
  method: Exclude<LicencePaymentMethod, "gateway">;
  /** Required unless the method is complimentary or cash. */
  reference?: string;
  /** `yyyy-mm-dd`, today at the latest. */
  paidOn: string;
  /** Required when the method is complimentary or other. */
  note?: string;
}

const org = (slug: string) => `organisations/${encodeURIComponent(slug)}`;

export const platformOrganisations = {
  modules: (slug: string) =>
    platformRequest<{ data: OrganisationModule[] }>(`${org(slug)}/modules`).then(unwrap),
  /** Replaces the organisation's entitlements with exactly these. */
  saveModules: (slug: string, modules: ModuleChange[]) =>
    platformRequest<{ data: OrganisationModule[] }>(`${org(slug)}/modules`, {
      method: "PUT",
      body: { modules },
    }).then(unwrap),
  suspend: (slug: string) =>
    platformRequest<{ data: Organisation }>(`${org(slug)}/suspend`, { method: "POST" }).then(unwrap),
  reactivate: (slug: string) =>
    platformRequest<{ data: Organisation }>(`${org(slug)}/reactivate`, { method: "POST" }).then(unwrap),
  /** Soft delete: the organisation moves to the platform recycle bin. */
  remove: (slug: string) => platformRequest<void>(org(slug), { method: "DELETE" }),
  users: (slug: string, params: { search?: string; page?: number; perPage?: number } = {}) =>
    platformRequest<Paginated<OrgUser>>(`${org(slug)}/users${queryString(params)}`),
  /** Its module purchases, by hand and online, newest first. */
  licences: (slug: string) =>
    platformRequest<{ data: LicenceRow[] }>(`${org(slug)}/licences`).then(unwrap),
  /** New or upgrade, the counts, list price, credit and the suggested amount for a pick. */
  previewLicence: (slug: string, body: { modules: string[]; currency: LicenceCurrency }) =>
    platformRequest<{ data: LicencePreview }>(`${org(slug)}/licences/preview`, { method: "POST", body }).then(unwrap),
  /** Records money paid for modules; they switch on for good and the organisation's admins are emailed. */
  recordLicence: (slug: string, body: NewLicence) =>
    platformRequest<{ data: LicenceRow }>(`${org(slug)}/licences`, { method: "POST", body }).then(unwrap),
  audit: (slug: string, params: Omit<AuditFilters, "organisation"> = {}) =>
    platformRequest<Paginated<PlatformAuditEntry>>(
      `audit-logs${queryString({ ...params, organisation: slug })}`,
    ),
};

/* ------------------------------------------------------------------ */
/*  Modules                                                            */
/* ------------------------------------------------------------------ */

export interface PlatformModule {
  key: string;
  label: string;
  deployed: boolean;
  enabled: boolean;
  sellable: boolean;
  organisations: number;
  activeUsers30d: number;
  features: number;
}

export const platformModules = {
  list: () => platformRequest<{ data: PlatformModule[] }>("modules").then(unwrap),
  setEnabled: (key: string, enabled: boolean) =>
    platformRequest<{ data: PlatformModule }>(`modules/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: { enabled },
    }).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Analytics                                                          */
/* ------------------------------------------------------------------ */

export type UsageWindow = 7 | 30 | 90;
export type PerformanceWindow = 1 | 7 | 30;

export interface UsageAnalytics {
  series: { date: string; module: string; activeUsers: number; events: number }[];
  byOrganisation: { slug: string; name: string; activeUsers: number; events: number }[];
  topFeatures: { module: string; feature: string; events: number }[];
}

export interface PerformanceAnalytics {
  requests: { total: number; errorRate: number; p50Ms: number; p95Ms: number };
  series: { at: string; requests: number; errors: number; p95Ms: number }[];
  slowestRoutes: { route: string; count: number; p95Ms: number }[];
  queue: { pending: number; failed: number; oldestPendingAt: string | null };
  scheduler: { lastRunAt: string | null };
}

export const platformAnalytics = {
  usage: (window: UsageWindow, module?: string) =>
    platformRequest<{ data: UsageAnalytics }>(`analytics/usage${queryString({ window, module })}`).then(
      unwrap,
    ),
  performance: (window: PerformanceWindow) =>
    platformRequest<{ data: PerformanceAnalytics }>(`analytics/performance${queryString({ window })}`).then(
      unwrap,
    ),
};

/* ------------------------------------------------------------------ */
/*  Governance                                                         */
/* ------------------------------------------------------------------ */

export const platformAudit = {
  list: (filters: AuditFilters = {}) =>
    platformRequest<Paginated<PlatformAuditEntry>>(`audit-logs${queryString({ ...filters })}`),
};
