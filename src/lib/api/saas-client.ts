/* ------------------------------------------------------------------ */
/*  Browser-side client for the multi-organisation SaaS surfaces:      */
/*  tenants, learner provisioning, assignment and learning paths.      */
/* ------------------------------------------------------------------ */

"use client";

import { ApiError } from "./admin-client";
import type { CertificateData } from "@/suite/lms/lib/certificate";

export { ApiError };

/* ---------- shared request helper ---------- */

async function request<T>(
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
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

/* ------------------------------------------------------------------ */
/*  Organisations — the platform owner's console                       */
/* ------------------------------------------------------------------ */

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  /** Where this institution's WhatsApp notices go. Empty means none are sent. */
  whatsappNumber: string | null;
  description: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  status: "active" | "suspended";
  seatLimit: number | null;
  /** Null means seats have not been priced for this institution — not free. */
  seatPrice: number | null;
  /** Null means seats are not on a recurring plan at all. */
  billingPeriod: BillingPeriod | null;
  currentPeriodEnd: string | null;
  licenceStatus: LicenceStatus;
  /** This institution's own window, or null when it follows the platform. */
  graceDaysOverride: number | null;
  /** What is actually in force, override or platform default. */
  graceDays: number;
  seatsUsed: number;
  studentCount?: number;
  instructorCount?: number;
  courseCount?: number;
  createdAt: string;
}

export interface NewOrganisation {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
  seatLimit?: number | null;
  /** Optional first admin, provisioned in the same call. */
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export const organisations = {
  list: (params = "") =>
    request<{ data: Organisation[] }>(`/api/platform/organisations${params}`).then(
      (r) => r.data ?? [],
    ),

  get: (slug: string) =>
    request<{ data: Organisation }>(`/api/platform/organisations/${encodeURIComponent(slug)}`).then(
      (r) => r.data,
    ),

  create: (body: NewOrganisation) =>
    request<{ data: Organisation }>("/api/platform/organisations", {
      method: "POST",
      body,
    }).then((r) => r.data),

  update: (slug: string, body: Partial<Organisation>) =>
    request<{ data: Organisation }>(`/api/platform/organisations/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body,
    }).then((r) => r.data),

  /** Suspends rather than deletes — the API keeps every member recoverable. */
  suspend: (slug: string) =>
    request<{ data: Organisation }>(`/api/platform/organisations/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Learner provisioning                                               */
/* ------------------------------------------------------------------ */

/**
 * A password the server generated and will never show again. Held in memory
 * only, for as long as the dialog presenting it is open.
 */
export interface OneTimeCredential {
  name: string;
  email: string;
  temporaryPassword: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  credentials: OneTimeCredential[];
  errors: { line: number; email: string | null; reason: string }[];
}

export const students = {
  create: (body: { name: string; email: string; password?: string }) =>
    request<{ data: { student: unknown; temporaryPassword: string | null } }>(
      "/api/admin/students",
      { method: "POST", body },
    ).then((r) => r.data),

  /**
   * Bulk import. Sent as multipart, so it deliberately does not use `request`
   * — that sets a JSON content-type, which corrupts a file upload.
   */
  async import(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/students/import", {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new ApiError(json?.message ?? "Import failed.", res.status, json?.errors);
    }

    return json.data as ImportResult;
  },
};

/* ------------------------------------------------------------------ */
/*  Assignment                                                         */
/* ------------------------------------------------------------------ */

export interface AssignmentOutcome {
  assigned: number;
  alreadyHeld: number;
  /** Addresses that had no account and were created and sent a welcome email. */
  invited: number;
  /**
   * Who was not assigned, and why — a seat limit, an address on another
   * organisation, an invalid address. `who` is the email or the learner's name.
   */
  skipped: { who: string; reason: string }[];
}

/** Somebody who has no account yet. The API derives a name when none is given. */
export interface AssignmentInvite {
  email: string;
  name?: string | null;
}

/**
 * Who to assign to.
 *
 * Either list may be empty, but not both. `emails` is how an administrator
 * assigns to somebody who has never used the platform: an address with no
 * account behind it is created on the spot and sent one welcome email with a
 * temporary password, the sign-in link and the link to what was assigned. An
 * address that already has an account is simply assigned to, and is not sent
 * new credentials.
 */
export interface AssignmentRecipients {
  studentIds?: string[];
  emails?: AssignmentInvite[];
  mandatory?: boolean;
  dueAt?: string | null;
}

type RawOutcome = {
  assigned?: number;
  alreadyHeld?: number;
  invited?: number;
  skipped?: { email?: string; name?: string; reason: string }[];
  failed?: { student?: string; email?: string; reason: string }[];
};

/**
 * The assignment endpoints have answered in two shapes over time — `{ result }`
 * with `failed`, and the current `{ data }` with `skipped`. Both are read, so
 * the dialog reports the same thing whichever the API sends.
 */
function outcome(raw: RawOutcome | undefined): AssignmentOutcome {
  const skipped = [
    ...(raw?.skipped ?? []).map((s) => ({ who: s.email ?? s.name ?? "Someone", reason: s.reason })),
    ...(raw?.failed ?? []).map((f) => ({ who: f.email ?? f.student ?? "Someone", reason: f.reason })),
  ];
  return {
    assigned: raw?.assigned ?? 0,
    alreadyHeld: raw?.alreadyHeld ?? 0,
    invited: raw?.invited ?? 0,
    skipped,
  };
}

function body(recipients: AssignmentRecipients | string[]): AssignmentRecipients {
  // An array is still accepted so existing callers keep working; it means
  // "these learner ids".
  return Array.isArray(recipients) ? { studentIds: recipients } : recipients;
}

export interface RosterEntry {
  slug: string;
  title: string;
  status: string;
  progress?: { percent: number };
}

export const assignments = {
  assignCourse: (courseSlug: string, recipients: AssignmentRecipients | string[]) =>
    request<{ data?: RawOutcome; result?: RawOutcome }>(
      `/api/courses/${encodeURIComponent(courseSlug)}/assignments`,
      { method: "POST", body: body(recipients) },
    ).then((r) => outcome(r.data ?? r.result)),

  revokeCourse: (courseSlug: string, studentId: string) =>
    request<{ ok: boolean }>(
      `/api/courses/${encodeURIComponent(courseSlug)}/assignments/${encodeURIComponent(studentId)}`,
      { method: "DELETE" },
    ),

  assignPath: (
    pathSlug: string,
    recipients: AssignmentRecipients | string[],
    dueAt?: string | null,
  ) =>
    request<{ data?: RawOutcome & { courses?: number }; result?: RawOutcome & { courses?: number } }>(
      `/api/learning-paths/${encodeURIComponent(pathSlug)}/assignments`,
      {
        method: "POST",
        body: { ...body(recipients), dueAt: dueAt || undefined },
      },
    ).then((r) => {
      const raw = r.data ?? r.result;
      return { ...outcome(raw), courses: raw?.courses ?? 0 };
    }),

  revokePath: (pathSlug: string, studentId: string) =>
    request<{ ok: boolean }>(
      `/api/learning-paths/${encodeURIComponent(pathSlug)}/assignments/${encodeURIComponent(studentId)}`,
      { method: "DELETE" },
    ),

  /**
   * Who holds a path.
   *
   * Courses have had a roster since assignment existed; paths only ever
   * exposed a count, and a count is not a list anybody can take somebody off.
   */
  pathRoster: (pathSlug: string) =>
    request<{ data: PathAssignee[] }>(
      `/api/learning-paths/${encodeURIComponent(pathSlug)}/assignments`,
    ).then((r) => r.data),
};

export interface PathAssignee {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  assignedOn: string | null;
  assignedBy: string | null;
  dueAt: string | null;
  completedAt: string | null;
  isComplete: boolean;
  /** Unfinished *and* past its date. A path nobody dated is never late. */
  isOverdue: boolean;
}

/* ------------------------------------------------------------------ */
/*  Learning paths                                                     */
/* ------------------------------------------------------------------ */

export interface PathCourse {
  slug: string;
  title: string;
  gradient: string | null;
  thumbnailUrl: string | null;
  totalLectures: number;
  duration: string | null;
  position: number;
  isRequired: boolean;
}

export interface LearningPath {
  slug: string;
  title: string;
  description: string | null;
  gradient: string | null;
  status: "draft" | "published";
  createdBy: string | null;
  courseCount?: number;
  assignedCount?: number;
  courses?: PathCourse[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathInput {
  title: string;
  description?: string | null;
  status?: "draft" | "published";
  courseSlugs?: string[];
  requiredSlugs?: string[] | null;
}

export const learningPaths = {
  list: (params = "") =>
    request<{ data: LearningPath[] }>(`/api/learning-paths${params}`).then((r) => r.data ?? []),

  get: (slug: string) =>
    request<{ data: LearningPath }>(`/api/learning-paths/${encodeURIComponent(slug)}`).then(
      (r) => r.data,
    ),

  // Authoring is admin-gated in Laravel, so it goes through the admin proxy.
  create: (body: LearningPathInput) =>
    request<{ data: LearningPath }>("/api/admin/learning-paths", { method: "POST", body }).then(
      (r) => r.data,
    ),

  update: (slug: string, body: Partial<LearningPathInput>) =>
    request<{ data: LearningPath }>(`/api/admin/learning-paths/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body,
    }).then((r) => r.data),

  remove: (slug: string) =>
    request<unknown>(`/api/admin/learning-paths/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),
};

/* ------------------------------------------------------------------ */
/*  Learner view                                                       */
/* ------------------------------------------------------------------ */

export interface LearnerPath {
  slug: string;
  title: string;
  description: string | null;
  gradient: string | null;
  courseCount: number;
  requiredCount: number;
  completedCount: number;
  percent: number;
  assignedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  isComplete: boolean;
  isOverdue: boolean;
  courses?: (PathCourse & { completed: boolean })[];
}

/**
 * The learner's own certificates.
 *
 * `CertificateData` is shared with the public verification page rather than
 * redeclared, because it is the same payload: what a learner sees of their own
 * certificate is exactly what a verifier sees of it, and two types would drift
 * the first time a field was added.
 */
export const myCertificates = {
  list: () =>
    request<{ certificates: CertificateData[] }>("/api/me/certificates").then(
      (r) => r.certificates ?? [],
    ),
};

export const myLearningPaths = {
  list: () => request<{ paths: LearnerPath[] }>("/api/me/learning-paths").then((r) => r.paths ?? []),

  get: (slug: string) =>
    request<{ path: LearnerPath }>(`/api/me/learning-paths/${encodeURIComponent(slug)}`).then(
      (r) => r.path,
    ),
};

/* ------------------------------------------------------------------ */
/*  Institution policy — governance an institution answers for itself  */
/* ------------------------------------------------------------------ */

export type PolicyKey = "require_course_approval" | "require_review_approval";

export interface OrganisationPolicy {
  key: PolicyKey;
  label: string;
  effect: string;
  /** What is actually in force, after the platform default is applied. */
  value: boolean;
  /** Where `value` came from — "platform" means nobody here has answered. */
  source: "platform" | "organisation";
  platformDefault: boolean;
}

/**
 * `null` is a real value on the way in: it clears this institution's answer and
 * puts the policy back to following the platform. Sending `false` instead would
 * silently opt the institution out of every future platform change.
 */
export type PolicyChanges = Partial<Record<PolicyKey, boolean | null>>;

export const organisationPolicies = {
  list: () =>
    request<{ data: { policies: OrganisationPolicy[] } }>("/api/admin/organisation/policies").then(
      (r) => r.data.policies,
    ),

  update: (changes: PolicyChanges) =>
    request<{ data: { policies: OrganisationPolicy[] } }>("/api/admin/organisation/policies", {
      method: "PATCH",
      body: changes,
    }).then((r) => r.data.policies),
};

/* ------------------------------------------------------------------ */
/*  Gamification — badges and leaderboards                             */
/* ------------------------------------------------------------------ */

export type BadgeType = "course" | "learning_path" | "milestone";

export interface Badge {
  key: string;
  type: BadgeType;
  /** A percentage for course and path badges, a course count for a milestone. */
  tier: number;
  name: string;
  description: string;
  subjectId: string | null;
  subjectTitle: string | null;
  awardedAt: string | null;
}

export interface BadgeShelf {
  badges: Badge[];
  counts: { total: number; course: number; learningPath: number; milestone: number } | null;
  nextMilestone: {
    tier: number;
    name: string;
    description: string;
    coursesCompleted: number;
    coursesToGo: number;
  } | null;
}

export interface LeaderboardRow {
  rank: number;
  name: string;
  initials: string;
  avatarUrl: string | null;
  score: number;
  isYou: boolean;
}

export interface Leaderboard {
  scope?: "usage" | "course" | "learning_path";
  title?: string;
  rows: LeaderboardRow[];
  /** The viewer's own row, returned even when the cut above removed them. */
  you: LeaderboardRow | null;
  total: number;
  unit?: "percent" | "courses";
}

export const gamification = {
  badges: () => request<BadgeShelf>("/api/me/badges"),

  usageBoard: () => request<Leaderboard>("/api/me/leaderboard"),

  courseBoard: (slug: string) =>
    request<Leaderboard>(`/api/me/courses/${encodeURIComponent(slug)}/leaderboard`),

  /**
   * The administrator's view of one course's board. Rows carry no user id, so
   * a caller looking for one learner matches on name and score; `limit` is
   * capped at 50 by the API.
   */
  adminCourseBoard: (slug: string, limit = 50) =>
    request<{ data: Leaderboard }>(
      `/api/admin/leaderboards/courses/${encodeURIComponent(slug)}?limit=${limit}`,
    ).then((r) => r.data),

  pathBoard: (slug: string) =>
    request<{ board: Leaderboard }>(
      `/api/me/learning-paths/${encodeURIComponent(slug)}/leaderboard`,
    ).then((r) => r.board),
};

/* ------------------------------------------------------------------ */
/*  Cross-tenant analytics — the platform owner only                   */
/* ------------------------------------------------------------------ */

export interface PortfolioRow {
  id: string | null;
  name: string;
  slug: string | null;
  status: "active" | "suspended";
  /** The public catalog, which has no Organisation row but does have takings. */
  isMarketplace: boolean;

  seatLimit: number | null;
  seatsUsed: number;
  /** Null means unlimited — which is not the same fact as 0% used. */
  seatUtilisation: number | null;

  students: number;
  instructors: number;
  admins: number;

  publishedCourses: number;
  totalCourses: number;

  activeEnrollments: number;
  completions: number;
  completionRate: number;

  grossRevenue: number;
  netRevenue: number;
  refunds: number;

  lastActiveAt: string | null;
}

export interface PortfolioTotals {
  organisations: number;
  activeOrganisations: number;
  suspendedOrganisations: number;

  seatsSold: number;
  seatsUsed: number;
  unlimitedOrganisations: number;

  grossRevenue: number;
  netRevenue: number;
  marketplaceRevenue: number;
  institutionRevenue: number;

  /** Share of platform revenue resting on the single biggest institution. */
  topTenantShare: number;

  learners: number;
  instructors: number;
  publishedCourses: number;
  platformFeePercent: number;
}

export interface AttentionItem {
  id: string | null;
  name: string;
  slug: string | null;
  reasons: { kind: "suspended" | "seats" | "quiet"; detail: string }[];
}

export interface Portfolio {
  totals: PortfolioTotals;
  organisations: PortfolioRow[];
  monthly: { key: string; month: string; marketplace: number; institutions: number }[];
  attention: AttentionItem[];
}

export const platformInsights = {
  portfolio: () => request<{ data: Portfolio }>("/api/platform/insights").then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Seats — what an institution is licensed for, and what it paid      */
/* ------------------------------------------------------------------ */

export type SeatMethod = "paystack" | "flutterwave" | "offline" | "adjustment";
export type SeatStatus = "pending" | "paid" | "failed" | "cancelled";

/** Seats buy capacity; a renewal buys time. */
export type SeatKind = "seats" | "renewal";

export type BillingPeriod = "monthly" | "quarterly" | "biannual" | "annual";

/**
 * Derived from the term's dates on every read, never stored. `lapsed` is the
 * only one with teeth, and its only consequence is that no new members can be
 * added — nobody is signed out.
 */
export type LicenceStatus = "unbilled" | "active" | "past_due" | "lapsed";

export const BILLING_PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Every six months" },
  { value: "annual", label: "Annually" },
];

export interface SeatPurchase {
  id: string;
  reference: string;
  kind: SeatKind;
  kindLabel: string;
  /** Signed — an adjustment can take seats away as well as add them. */
  seats: number;
  periodStart: string | null;
  periodEnd: string | null;
  unitPrice: number | null;
  amount: number;
  method: SeatMethod;
  methodLabel: string;
  /**
   * Only a gateway-confirmed payment. An offline row is somebody's word that a
   * transfer landed, and must not be rendered as if the platform saw it.
   */
  verified: boolean;
  status: SeatStatus;
  statusLabel: string;
  note: string | null;
  authorizationUrl?: string | null;
  recordedBy?: string | null;
  paidAt: string | null;
  createdAt: string | null;
}

export interface SeatSummary {
  seatLimit: number | null;
  seatsUsed: number;
  seatsRemaining: number | null;
  seatPrice: number | null;

  billingPeriod: BillingPeriod | null;
  billingPeriodLabel: string | null;
  /** "per month", "per year" — how the price reads in a sentence. */
  pricePer: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  daysLeftInTerm: number | null;
  licenceStatus: LicenceStatus;
  licenceStatusLabel: string;
  graceDays: number;
  /** Every seat on the cap at the full period price. Null when not on a plan. */
  renewalAmount: number | null;

  /** False when seats are unpriced or the institution is uncapped. */
  canBuy: boolean;
  seatsPurchased: number;
  totalPaid: number;
  /**
   * The affiliate referral discount the organisation's next payment gets; 0
   * when there is none or it has been used. `renewalAmount` already has it off.
   */
  referralDiscountPercent?: number;
}

export interface SeatQuote {
  seats: number;
  unitPrice: number;
  /** What is charged, after any referral discount. */
  amount: number;
  /** The price before the referral discount. */
  listAmount?: number;
  /** The referral discount taken off, in whole naira like the other amounts. */
  referralDiscount?: number;
  /** True when the amount covers only the rest of the current term. */
  prorated: boolean;
  daysRemaining: number | null;
  periodEnd: string | null;
}

export interface RenewalQuote {
  seats: number;
  unitPrice: number;
  amount: number;
  periodStart: string;
  periodEnd: string;
  period: BillingPeriod;
}

export interface SeatLedger {
  summary: SeatSummary;
  purchases: SeatPurchase[];
}

/** The institution's own side: see the price, see the room, buy more. */
export const seats = {
  mine: () => request<{ data: SeatLedger }>("/api/admin/organisation/seats").then((r) => r.data),

  quote: (count: number) =>
    request<{ data: SeatQuote }>("/api/admin/organisation/seats/quote", {
      method: "POST",
      body: { seats: count },
    }).then((r) => r.data),

  renewalQuote: () =>
    request<{ data: RenewalQuote }>("/api/admin/organisation/seats/renewal").then((r) => r.data),

  renew: () =>
    request<{ data: { purchase: SeatPurchase; authorizationUrl: string | null } }>(
      "/api/admin/organisation/seats/renew",
      { method: "POST", body: {} },
    ).then((r) => r.data),

  purchase: (count: number) =>
    request<{ data: { purchase: SeatPurchase; reference: string; authorizationUrl: string | null } }>(
      "/api/admin/organisation/seats/purchase",
      { method: "POST", body: { seats: count } },
    ).then((r) => r.data),

  verify: (reference: string) =>
    request<{ data: { purchase: SeatPurchase; summary: SeatSummary } }>(
      "/api/admin/organisation/seats/verify",
      { method: "POST", body: { reference } },
    ).then((r) => r.data),
};

/** The platform owner's side: read anybody's ledger, grant against offline money. */
export const organisationSeats = {
  ledger: (slug: string) =>
    request<{ data: SeatLedger }>(
      `/api/platform/organisations/${encodeURIComponent(slug)}/seats`,
    ).then((r) => r.data),

  grant: (slug: string, body: { seats: number; amount?: number | null; note?: string | null }) =>
    request<{ data: { purchase: SeatPurchase; summary: SeatSummary } }>(
      `/api/platform/organisations/${encodeURIComponent(slug)}/seats`,
      { method: "POST", body },
    ).then((r) => r.data),

  /** Record a renewal paid for outside the platform. Buys time, not seats. */
  renew: (slug: string, body: { amount?: number | null; note?: string | null }) =>
    request<{ data: { purchase: SeatPurchase; summary: SeatSummary } }>(
      `/api/platform/organisations/${encodeURIComponent(slug)}/seats/renew`,
      { method: "POST", body },
    ).then((r) => r.data),
};
