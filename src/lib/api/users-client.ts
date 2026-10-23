/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation's user management.        */
/*  Same-origin /api/admin/users/* proxy; the token stays httpOnly.    */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";

export { ApiError };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
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

/**
 * How the API presents an organisation member: `admin` for whoever holds a
 * role with the Organisation admin setting (roles redesign, phase 3b; nobody
 * is stored as admin), `user` for everybody else. What anybody does comes
 * from their roles.
 */
export type OrgRole = "admin" | "user";
export type OrgUserStatus = "active" | "invited";

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: OrgRole;
  roleLabel: string;
  jobTitle: string | null;
  status: OrgUserStatus;
  /** Sign-in switched off: a leaver on their leaving date, or an admin's call. */
  signInDisabledAt?: string | null;
  /** Every role held, system and custom; the built-in User role is the system one whose `systemKey` is user. */
  roles: { id: string; name: string; kind: "system" | "custom"; systemKey?: string | null }[];
  createdAt: string;
  lastActiveAt: string | null;
  stats: {
    enrolments: number;
    completed: number;
    averageProgress: number;
    certificates: number;
  };
}

export interface OrgUserDetail extends OrgUser {
  /** Effective permissions: the union of every role held. */
  permissions: string[];
  employee: { id: string; status: string; department: string | null; jobTitle: string | null } | null;
  instructorProfileId: string | null;
  learning: {
    enrolments: {
      courseSlug: string;
      courseTitle: string;
      status: string;
      percent: number;
      enrolledAt: string | null;
      completedAt: string | null;
      lastActivityAt: string | null;
      quizAverage: number | null;
    }[];
    certificates: { serial: string; courseTitle: string; issuedAt: string }[];
    points: number | null;
  };
  projects: { slug: string; name: string; role: string }[];
  /** `meta` is whatever the event recorded - usually an object; read it with `auditSubject`. */
  recentActivity: { action: string; at: string; meta: unknown }[];
}

export interface OrgUserSummary {
  total: number;
  byRole: Record<OrgRole, number>;
  activeLast30Days: number;
  newThisMonth: number;
  invited: number;
}

/** The API's `PaginatedResponse`: Laravel's own `meta` plus currentPage/lastPage/perPage. */
export interface Paginated<T> {
  data: T[];
  meta: { currentPage: number; lastPage: number; perPage: number; total: number };
}

export type OrgUserSort = "name" | "-createdAt" | "-lastActiveAt";

export interface OrgUserFilters {
  search?: string;
  role?: OrgRole | "";
  status?: OrgUserStatus | "";
  /** Holders of one role (system or custom). */
  roleId?: string;
  sort?: OrgUserSort;
  page?: number;
  perPage?: number;
}

export interface OrgUserInput {
  name: string;
  email: string;
  /**
   * A shortcut the API still takes: `admin` gives the Organisation admin role,
   * `user` takes it. The users form leaves it out and sends the role itself
   * in `roleIds`.
   */
  role?: OrgRole;
  /** Role ids from this organisation only; the Organisation admin role among them. */
  roleIds?: string[];
  jobTitle?: string | null;
  /** Switch sign-in off (and end their sessions) or back on. */
  signInDisabled?: boolean;
}

/**
 * May this signed-in person add, change or remove an admin? Only an
 * organisation admin (or the platform owner) - a custom role that lends user
 * management does not reach admins. The API enforces it; this only hides what
 * it refuses.
 */
export function managesAdmins(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** The built-in role everybody holds, for telling it apart from the roles they were given. */
export const BASE_ROLE_KEYS: readonly string[] = ["user"];

/* ---------- Endpoints ---------- */

export const users = {
  list: (filters: OrgUserFilters = {}) =>
    request<Paginated<OrgUser>>(
      `users${query({
        search: filters.search,
        role: filters.role,
        status: filters.status,
        roleId: filters.roleId,
        sort: filters.sort,
        page: filters.page,
        perPage: filters.perPage,
      })}`,
    ),
  summary: () => request<{ data: OrgUserSummary }>("users/summary").then((r) => r.data),
  get: (id: string) => request<{ data: OrgUserDetail }>(`users/${encodeURIComponent(id)}`).then((r) => r.data),
  /**
   * The API also returns a one-time temporary password, for when email isn't
   * set up. It is never shown again, so the caller must display it now.
   */
  create: (body: OrgUserInput) =>
    request<{ data: OrgUser; temporaryPassword?: string | null }>("users", { method: "POST", body }).then((r) => ({
      user: r.data,
      temporaryPassword: r.temporaryPassword ?? null,
    })),
  update: (id: string, body: Partial<OrgUserInput>) =>
    request<{ data: OrgUser }>(`users/${encodeURIComponent(id)}`, { method: "PATCH", body }).then((r) => r.data),
  /** Soft delete: the person moves to the organisation's recycle bin. */
  remove: (id: string) => request<unknown>(`users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Issues a fresh temporary password along with the email; returned once. */
  resendInvite: (id: string) =>
    request<{ data?: { sent: boolean; temporaryPassword?: string | null } }>(
      `users/${encodeURIComponent(id)}/resend-invite`,
      { method: "POST" },
    ).then((r) => ({ temporaryPassword: r?.data?.temporaryPassword ?? null })),
};
