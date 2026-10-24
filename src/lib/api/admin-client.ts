/* ------------------------------------------------------------------ */
/*  Browser-side client for the admin APIs.                            */
/*  Calls the same-origin /api/admin/* proxy (token stays httpOnly).   */
/* ------------------------------------------------------------------ */

import type { LectureContent } from "@/suite/lms/lib/curriculum";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: Record<string, string[]>,
    /** A machine code some refusals carry (`MFA_REQUIRED`, `MFA_NOT_ENROLLED`…). */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      json?.message ?? "Request failed.",
      res.status,
      json?.errors,
    );
  }

  return json as T;
}

/** Unwrap a `{ data }` envelope. */
function data<T>(res: { data?: T }): T {
  return (res.data ?? []) as T;
}

/* ---------- Categories ---------- */

export interface AdminCategory {
  name: string;
  slug: string;
  color: string | null;
  courses: number;
  students: number;
  revenue: number;
}

export const categories = {
  list: () => request<{ data: AdminCategory[] }>("categories").then(data),
  create: (body: { name: string; color?: string; description?: string }) =>
    request<{ data: AdminCategory }>("categories", { method: "POST", body }).then((r) => r.data),
  update: (slug: string, body: Partial<{ name: string; color: string; description: string }>) =>
    request<{ data: AdminCategory }>(`categories/${slug}`, { method: "PATCH", body }).then((r) => r.data),
  remove: (slug: string) => request<unknown>(`categories/${slug}`, { method: "DELETE" }),
};

/* ---------- Reviews ---------- */

export interface AdminReview {
  id: string;
  student: string;
  initials: string;
  rating: number;
  body: string;
  status: string;
  courseTitle: string | null;
  instructor: string | null;
  reports: number;
  date: string;
  /** The instructor's answer, where they gave one. */
  reply?: string | null;
  replyDate?: string | null;
}

export interface AdminReviewDetail extends AdminReview {
  /**
   * Named here and nowhere a learner can see. Moderation is where "is this
   * person review-bombing us" gets answered, and `student` is whatever they
   * typed in the box.
   */
  learner: { id: string | null; name: string | null; email: string | null };
  createdAt: string | null;
  updatedAt: string | null;
  /** The clearest signal a review is not what it claims to be. */
  fromEnrolledLearner: boolean;
}

export const reviews = {
  list: (status?: string) =>
    request<{ data: AdminReview[] }>(`reviews${status ? `?status=${status}` : ""}`).then(data),
  get: (id: string) =>
    request<{ data: AdminReviewDetail }>(`reviews/${encodeURIComponent(id)}`).then(
      (r) => r.data,
    ),
  setStatus: (id: string, status: string, reason?: string) =>
    request<{ data: AdminReview }>(`reviews/${id}/status`, { method: "PATCH", body: { status, reason } }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`reviews/${id}`, { method: "DELETE" }),
};

/* ---------- Courses ---------- */

export interface AdminCourse {
  slug: string;
  title: string;
  category: string | null;
  level: string;
  instructor: string | null;
  instructorAvatar: string | null;
  gradient: string | null;
  thumbnailUrl: string | null;
  students: number;
  /** Learners who finished it. Not sent by the course list yet, so it may be missing. */
  completions?: number;
  rating: number;
  reviews: number;
  lectures: number;
  status: string;
  lastUpdated: string | null;
  /** Not tracked by the backend yet — defaults to 0 in the UI. */
  completionRate?: number;
  trend?: number;
}

export interface CourseLecture {
  id?: string;
  title: string;
  duration: string | null;
  type: string;
  /** Type-specific payload (video URL, article HTML, quiz questions). */
  content?: LectureContent | null;
}

export interface CourseDetail {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string | null;
  categorySlug: string | null;
  level: string;
  status: string;
  language: string;
  gradient: string | null;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
  hasCertificate: boolean;
  /** Months a certificate stays good for. Null means it never expires. */
  certificateValidMonths?: number | null;
  rating: number;
  reviewCount: number;
  studentsEnrolled: number;
  totalLectures: number;
  totalHours: number;
  lastUpdated: string | null;
  learningOutcomes: string[];
  requirements: string[];
  instructor: { name: string | null; title: string | null; avatar: string | null; bio: string | null };
  sections: { title: string; lectures: CourseLecture[] }[];
  reviews?: { name: string; rating: number; date: string; comment: string; avatar: string }[];
}

export const courses = {
  list: (params = "") => request<{ data: AdminCourse[] }>(`courses${params}`).then(data),
  // Admin authors a course on behalf of a chosen instructor (instructorId required).
  create: (body: Record<string, unknown>) =>
    request<{ data: CourseDetail }>("courses", { method: "POST", body }).then((r) => r.data),
  get: (slug: string) => request<{ data: CourseDetail }>(`courses/${slug}`).then((r) => r.data),
  update: (slug: string, body: Record<string, unknown>) =>
    request<{ data: CourseDetail }>(`courses/${slug}`, { method: "PATCH", body }).then((r) => r.data),
  setStatus: (slug: string, status: string) =>
    request<{ data: unknown }>(`courses/${slug}/status`, { method: "PATCH", body: { status } }).then((r) => r.data),
  remove: (slug: string) => request<unknown>(`courses/${slug}`, { method: "DELETE" }),
};

/* ---------- Instructors ---------- */

export interface AdminInstructor {
  id: string;
  name: string;
  initials: string;
  title: string | null;
  email: string | null;
  status: string;
  category: string | null;
  courses: number;
  students: number;
  revenue: number;
  payoutPending: number;
  avgRating: number;
  joined: string;
  gradient: string | null;
}

export const instructors = {
  list: (status?: string) =>
    request<{ data: AdminInstructor[] }>(`instructors${status ? `?status=${status}` : ""}`).then(data),
  create: (body: Record<string, unknown>) =>
    request<{ data: AdminInstructor }>("instructors", { method: "POST", body }).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    request<{ data: AdminInstructor }>(`instructors/${id}`, { method: "PATCH", body }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`instructors/${id}`, { method: "DELETE" }),
};

/* ---------- Certificate templates ---------- */

export interface AdminCertificateTemplate {
  id: string;
  name: string;
  description: string | null;
  orgName: string;
  signatoryName: string;
  signatoryTitle: string;
  accentColor: string;
  logoUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  certificatesIssued?: number;
  createdAt?: string;
}

export const certificateTemplates = {
  list: () =>
    request<{ data: AdminCertificateTemplate[] }>("certificate-templates").then(data),
  create: (body: Record<string, unknown>) =>
    request<{ data: AdminCertificateTemplate }>("certificate-templates", { method: "POST", body }).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    request<{ data: AdminCertificateTemplate }>(`certificate-templates/${id}`, { method: "PATCH", body }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`certificate-templates/${id}`, { method: "DELETE" }),
};

/* ---------- Issued certificates ---------- */

export interface AdminCertificate {
  serial: string;
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  issuedAt: string | null;
  /** Null means it never lapses. */
  expiresAt: string | null;
  expires: boolean;
  expired: boolean;
  /** Signed: negative once it has lapsed. */
  daysUntilExpiry: number | null;
  /** Neither revoked nor expired — the only state that means "counts today". */
  valid: boolean;
  /** Which round of recurring training. 1 unless it has been renewed. */
  cycle: number;
  revoked: boolean;
  revokedAt: string | null;
  courseSlug?: string | null;
  verifyUrl: string | null;
}

export interface AdminCertificateDetail extends AdminCertificate {
  learner: { id: string | null; name: string | null; email: string | null };
  /** What they actually did — the evidence behind the claim. */
  enrollment: {
    id: string;
    status: string;
    completedAt: string | null;
  } | null;
}

export const issuedCertificates = {
  list: (params = "") =>
    request<{ data: AdminCertificate[] }>(`certificates${params}`).then(data),
  get: (serial: string) =>
    request<{ data: AdminCertificateDetail }>(
      `certificates/${encodeURIComponent(serial)}`,
    ).then((r) => r.data),
  revoke: (serialId: string) =>
    request<{ data: AdminCertificate }>(`certificates/${serialId}/revoke`, { method: "PATCH" }).then((r) => r.data),
  reinstate: (serialId: string) =>
    request<{ data: AdminCertificate }>(`certificates/${serialId}/reinstate`, { method: "PATCH" }).then((r) => r.data),
};

/* ---------- Students ---------- */

export interface AdminStudent {
  id: string;
  name: string;
  email: string;
  initials: string;
  enrollments: number;
  /** Courses finished. Courses are free, so there is no lifetime value. */
  completed: number;
  status: string;
  joined: string;
}

export const students = {
  list: (params = "") => request<{ data: AdminStudent[] }>(`students${params}`).then(data),
  update: (id: string, body: Partial<{ name: string; email: string }>) =>
    request<{ data: AdminStudent }>(`students/${id}`, { method: "PATCH", body }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`students/${id}`, { method: "DELETE" }),

  /**
   * Take a course off somebody, addressed by the enrollment.
   *
   * Access is withdrawn and the progress record kept, so granting it again
   * later picks up where they stopped. The same operation is reachable as
   * `assignments.revokeCourse` by course and learner — that is the route
   * instructors share; this one is the admin's, and an enrollment id is the
   * natural handle when you are looking at one person's list.
   */
  withdraw: (enrollmentId: string) =>
    request<unknown>(`enrollments/${encodeURIComponent(enrollmentId)}/withdraw`, {
      method: "POST",
    }),
};

/* ---------- Support tickets ---------- */

export interface TicketMessage {
  from: "user" | "support";
  author: string;
  body: string;
  time: string;
}

export interface SupportTicket {
  id: string;
  reference: string;
  subject: string;
  requester: string;
  initials: string;
  role: string;
  category: string | null;
  priority: string;
  status: string;
  assignee: string | null;
  /**
   * Who it sits with, by id.
   *
   * The name alone is what left `PATCH /tickets/{id}/assign` with no caller:
   * a screen could print "Assigned to Bola" and had no way to open a list
   * with Bola already selected.
   */
  assigneeId: string | null;
  created: string;
  updated: string;
  /** Addressed to the platform owner (O7); only the platform queue shows these. */
  toPlatform?: boolean;
  messages?: TicketMessage[];
}

export const tickets = {
  list: (status?: string) =>
    request<{ data: SupportTicket[] }>(`tickets${status ? `?status=${status}` : ""}`).then(data),
  get: (id: string) => request<{ data: SupportTicket }>(`tickets/${id}`).then((r) => r.data),
  reply: (id: string, body: string) =>
    request<{ data: SupportTicket }>(`tickets/${id}/reply`, { method: "POST", body: { body } }).then((r) => r.data),
  setStatus: (id: string, status: string) =>
    request<{ data: SupportTicket }>(`tickets/${id}/status`, { method: "PATCH", body: { status } }).then((r) => r.data),

  /**
   * Hand a ticket to a colleague, or put it back on nobody.
   *
   * Null is a real value here rather than an omission — "nobody has picked
   * this up" is a state a queue needs, and the API distinguishes it from "the
   * field was not sent".
   *
   * Only an administrator of this institution is accepted. The endpoint used
   * to take any user id on the platform, which let a ticket be assigned to a
   * learner, or to a stranger in another tenant.
   */
  assign: (id: string, assigneeId: string | null) =>
    request<{ data: SupportTicket }>(`tickets/${id}/assign`, {
      method: "PATCH",
      body: { assigneeId },
    }).then((r) => r.data),
};

/* ---------- Audit log ---------- */

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  /** Whatever the event recorded; read it with `auditSubject`. */
  meta?: unknown;
  ip: string | null;
  severity: string;
  time: string;
}

export type AuditSeverityKey = "info" | "warning" | "critical";

export interface AuditPage {
  data: AuditEntry[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    /** Over everything the search matches, whatever the severity filter. */
    severityCounts: Record<AuditSeverityKey, number>;
  };
}

export interface AuditQuery {
  page?: number;
  perPage?: number;
  severity?: AuditSeverityKey | "";
  search?: string;
}

export const audit = {
  list: (params = "") => request<{ data: AuditEntry[] }>(`audit-logs${params}`).then(data),
  /** One page of the trail, filtered on the server. */
  page: (q: AuditQuery = {}) => {
    const qs = new URLSearchParams();
    if (q.page) qs.set("page", String(q.page));
    if (q.perPage) qs.set("perPage", String(q.perPage));
    if (q.severity) qs.set("severity", q.severity);
    if (q.search) qs.set("search", q.search);
    const tail = qs.toString();
    return request<AuditPage>(`audit-logs${tail ? `?${tail}` : ""}`);
  },
};

/* ---------- Settings ---------- */

/**
 * Mirrors `App\Support\PlatformSettings::SCHEMA`. Keys are flat, not dotted:
 * Laravel reads a dot as nesting in validation rules and JSON paths.
 */
/**
 * What the API returns in place of a stored credential.
 *
 * Mirrors `PlatformSettings::SECRET_MASK`. The value round-trips harmlessly —
 * submitting it means "keep what you have" — but no field should ever *display*
 * it as if it were the secret.
 */
export const SECRET_MASK = "••••••••";

export interface PlatformSettingsMap {
  platform_name: string;
  support_email: string;
  platform_fee_percent: number;
  // These two are platform *defaults* — an institution can answer either for
  // itself. See `organisationPolicies` in saas-client.
  require_course_approval: boolean;
  require_review_approval: boolean;
  /** Days an institution keeps adding members after its term ends. */
  seat_grace_days: number;

  /**
   * WhatsApp Cloud API. The access token is write-only: the API returns a mask,
   * and submitting that mask (or an empty string) leaves the stored credential
   * alone — so saving this form without retyping it cannot erase it.
   */
  whatsapp_enabled: boolean;
  whatsapp_phone_number_id: string;
  whatsapp_access_token: string;
  whatsapp_api_version: string;
  whatsapp_template_name: string;
  whatsapp_template_language: string;

  // The platform-wide notification switches, mirroring `PlatformSettings`'
  // `notifications` group. The settings page lists whatever that group holds,
  // so a switch added on the server shows up without a change here.
  notify_licence_reminders: boolean;
  notify_course_assignment: boolean;
  notify_instructor_enrollment: boolean;
  notify_admin_sale: boolean;
  notify_payment_failed: boolean;
  notify_refund_processed: boolean;
  notify_hrm_employee: boolean;
  notify_hrm_manager: boolean;
  notify_hrm_appraisals: boolean;
  notify_hrm_reminders: boolean;
  notify_projects_work: boolean;
  notify_projects_deadlines: boolean;
  notify_projects_sprints: boolean;
  notify_projects_digest: boolean;
}

export type SettingKey = keyof PlatformSettingsMap;

export interface SettingSpec {
  group: "general" | "payments" | "catalog" | "billing" | "whatsapp" | "notifications";
  type: "string" | "int" | "bool" | "secret";
  default: string | number | boolean;
  label: string;
  /** Where this value actually takes effect — shown next to the control. */
  effect: string;
}

export interface Integration {
  name: string;
  purpose: string;
  connected: boolean;
  detail: string;
}

export interface SettingsPayload {
  settings: PlatformSettingsMap;
  schema: Record<SettingKey, SettingSpec>;
  integrations: Integration[];
}

export const settings = {
  get: () => request<{ data: SettingsPayload }>("settings").then((r) => r.data),
  /** Send only the keys that changed; unknown keys are rejected server-side. */
  update: (changes: Partial<PlatformSettingsMap>) =>
    request<{ data: SettingsPayload }>("settings", {
      method: "PUT",
      body: { settings: changes },
    }).then((r) => r.data),
};

/* ---------- Admin roster ---------- */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  joined: string;
  isYou: boolean;
}

export const team = {
  list: () => request<{ data: TeamMember[] }>("team").then(data),
  /** Creates the account, or promotes an existing student to admin. */
  add: (body: { name: string; email: string; password?: string }) =>
    request<{ data: { id: string; promoted: boolean } }>("team", { method: "POST", body }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`team/${id}`, { method: "DELETE" }),
};

/* ---------- Analytics ---------- */

export interface MonthPoint {
  month: string;
  fullMonth: string;
  enrollments: number;
  completions: number;
}

/**
 * Required training reported apart from training people chose.
 *
 * Optional courses almost always complete better, because nobody starts one
 * who did not want to — so a single blended rate hides whether the mandatory
 * programme is working.
 */
export interface SourceSplit {
  assigned: number;
  selfEnrolled: number;
  assignedCompletion: number;
  selfEnrolledCompletion: number;
}

export interface AdminOverview {
  totals: {
    /** People. Someone on four courses counts once. */
    learners: number;
    /** Seats. Someone on four courses counts four times. */
    enrollments: number;
    completions: number;
    courses: number;
    instructors: number;
    reviews: number;
    avgRating: number;
    /**
     * Mean share of a course's lectures finished — how far people get.
     * Deliberately not the same figure as `completionRate`, which is how many
     * reach the end. A cohort that all stall at 90% has a high average and a
     * completion rate of zero.
     */
    avgCompletion: number;
    completionRate: number;
    mandatory: SourceSplit;
    enrollmentsDelta: number;
    completionsDelta: number;
    coursesDelta: number;
    ratingDelta: number;
  };
  monthly: MonthPoint[];
  topCourses: {
    slug: string;
    title: string;
    category: string | null;
    learners: number;
    completions: number;
    completionRate: number;
    rating: number;
    gradient: string | null;
  }[];
  categories: {
    label: string;
    learners: number;
    completions: number;
    completionRate: number;
    color: string;
  }[];
  levels: { label: string; learners: number; color: string }[];
}

/* ---------- Insights (activity feed, student analytics, health, detail pages) ---------- */

export type ActivityKind = "enrollment" | "completion" | "review" | "course";

export interface ActivityItem {
  kind: ActivityKind;
  title: string;
  meta: string;
  at: string;
}

export interface RecentEnrollment {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  initials: string;
  courseSlug: string | null;
  courseTitle: string | null;
  /** "Assigned", "Learning path" or "Self-enrolled". */
  source: string;
  mandatory: boolean;
  date: string;
  status: string;
}

export interface AdminStudentAnalytics {
  totals: {
    students: number;
    enrollments: number;
    newThisMonth: number;
    avgCompletion: number;
    /** Seats withdrawn — a revoked assignment, or somebody who left. */
    withdrawn: number;
    withdrawalRate: number;
    avgQuizScore: number | null;
  };
  monthly: { month: string; fullMonth: string; enrollments: number }[];
  byLevel: { label: string; students: number; color: string }[];
  recent: RecentEnrollment[];
}

export type HealthStatus = "operational" | "degraded" | "down";

export interface HealthMetric {
  label: string;
  value: string;
  status: HealthStatus;
  detail: string;
}

export interface AdminStudentDetail {
  id: string;
  name: string;
  email: string;
  initials: string;
  joined: string;
  status: string;
  totals: {
    enrollments: number;
    completed: number;
    /** Of their live courses, how many the organisation required. */
    mandatory: number;
    avgQuizScore: number | null;
    avgCompletion: number;
  };
  enrollments: {
    id: string;
    courseSlug: string | null;
    courseTitle: string | null;
    gradient: string | null;
    thumbnailUrl: string | null;
    status: string;
    source: string;
    mandatory: boolean;
    progress: number;
    lessonsDone: number;
    totalLessons: number;
    enrolledAt: string;
    completedAt: string | null;
  }[];
}

export interface AdminInstructorDetail {
  id: string;
  name: string;
  initials: string;
  title: string | null;
  headline: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  joined: string;
  gradient: string | null;
  category: string | null;
  totals: {
    courses: number;
    publishedCourses: number;
    students: number;
    completions: number;
    completionRate: number;
    avgRating: number;
    reviews: number;
  };
  monthly: { month: string; fullMonth: string; enrollments: number; completions: number }[];
  courses: {
    slug: string;
    title: string;
    category: string | null;
    level: string;
    status: string;
    students: number;
    completions: number;
    rating: number;
    reviews: number;
    lectures: number;
    gradient: string | null;
    thumbnailUrl: string | null;
  }[];
}

export interface CourseAnalytics {
  monthly: { month: string; fullMonth: string; enrollments: number; completions: number }[];
  totals: {
    students: number;
    completions: number;
    completionRate: number;
    views: number;
    uniqueVisitors: number;
    /**
     * Of the people who opened the course page, how many enrolled. Still
     * meaningful for a free course: it measures whether the page persuades.
     */
    conversionRate: number;
    withdrawn: number;
    withdrawalRate: number;
    avgCompletion: number;
    avgQuizScore: number | null;
  };
}

export const analytics = {
  overview: () => request<{ data: AdminOverview }>("analytics/overview").then((r) => r.data),
  activity: () => request<{ data: ActivityItem[] }>("analytics/activity").then(data),
  students: () => request<{ data: AdminStudentAnalytics }>("analytics/students").then((r) => r.data),
  student: (id: string) =>
    request<{ data: AdminStudentDetail }>(`analytics/students/${id}`).then((r) => r.data),
  instructor: (id: string) =>
    request<{ data: AdminInstructorDetail }>(`analytics/instructors/${id}`).then((r) => r.data),
  course: (slug: string) =>
    request<{ data: CourseAnalytics }>(`analytics/courses/${slug}`).then((r) => r.data),
};

/** Measured system health: DB latency, queue depth, failed jobs, webhooks, media. */
export const health = {
  get: () => request<{ data: HealthMetric[] }>("health").then(data),
};


/* ------------------------------------------------------------------ */
/*  Media settings                                                     */
/* ------------------------------------------------------------------ */

export type MediaProviderKey = "cloudinary" | "google_drive" | "s3";

export interface MediaField {
  name: string;
  label: string;
  required: boolean;
  /** Masked on the way out; sending the mask back means "leave it alone". */
  secret: boolean;
  hint: string | null;
}

export interface MediaConnection {
  id: string;
  provider: MediaProviderKey;
  providerLabel: string;
  label: string | null;
  /** Secrets arrive masked. Never the real value. */
  credentials: Record<string, string>;
  settings: Record<string, string>;
  isActive: boolean;
  isDefault: boolean;
  isComplete: boolean;
  /** Named, so a form can say "Bucket" rather than "2 fields missing". */
  missing: string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  fileCount: number;
}

export interface MediaProviderRow {
  provider: MediaProviderKey;
  label: string;
  credentialFields: MediaField[];
  settingFields: MediaField[];
  connection: MediaConnection | null;
}

export const mediaSettings = {
  list: () =>
    request<{
      data: MediaProviderRow[];
      meta: { activeProvider: MediaProviderKey | null; fallback: string };
    }>("media-settings"),

  save: (
    provider: MediaProviderKey,
    body: {
      credentials?: Record<string, string>;
      settings?: Record<string, string>;
      label?: string | null;
    },
  ) =>
    request<{ data: MediaConnection }>(
      `media-settings/${provider}`,
      { method: "PUT", body },
    ),

  /** A real round trip. Returns what it reached, not just a tick. */
  verify: (provider: MediaProviderKey) =>
    request<{ message: string; data: MediaConnection }>(
      `media-settings/${provider}/verify`,
      { method: "POST" },
    ),

  activate: (provider: MediaProviderKey, active: boolean) =>
    request<{ data: MediaConnection }>(
      `media-settings/${provider}/activate`,
      { method: "POST", body: { active } },
    ),

  makeDefault: (provider: MediaProviderKey) =>
    request<{ data: MediaConnection }>(
      `media-settings/${provider}/default`,
      { method: "POST" },
    ),

  disconnect: (provider: MediaProviderKey) =>
    request<{ message: string }>(`media-settings/${provider}`, {
      method: "DELETE",
    }),
};

/* ------------------------------------------------------------------ */
/*  Compliance                                                         */
/* ------------------------------------------------------------------ */

export interface ComplianceItem {
  userId: string;
  name: string | null;
  title: string;
  kind: "course" | "path";
  reference: string | null;
  dueAt: string | null;
  completedAt: string | null;
  isComplete: boolean;
  /** Past its date and not done. A finding, unlike merely outstanding. */
  isOverdue: boolean;
  isDueSoon: boolean;
  daysOverdue: number | null;
  /**
   * Open *because* a certificate lapsed, rather than never started. Both are
   * outstanding; only one of them means the person has been through it before,
   * and telling them apart is the difference between "chase them" and "book
   * them a refresher".
   */
  isRenewal: boolean;
  expiredOn: string | null;
}

export interface ComplianceReport {
  asAt: string;
  totals: {
    people: number;
    assignments: number;
    complete: number;
    /** Includes everything with a future deadline — the healthy state. */
    outstanding: number;
    overdue: number;
    dueSoon: number;
    peopleFullyCompliant: number;
    compliancePercent: number;
  };
  byCourse: {
    title: string;
    assigned: number;
    complete: number;
    overdue: number;
    completePercent: number;
  }[];
  byDepartment: {
    department: string;
    assigned: number;
    complete: number;
    overdue: number;
    completePercent: number;
  }[];
  /** Named, because the thing somebody does with this is chase people. */
  overdueList: ComplianceItem[];
}

export const compliance = {
  get: () => request<{ data: ComplianceReport }>("compliance"),
  csvUrl: () => "/api/admin/compliance.csv",
};
