/* ------------------------------------------------------------------ */
/*  Server-only LMS API helper.                                        */
/*                                                                      */
/*  Used exclusively inside Next route handlers (src/app/api/**).      */
/*  The bearer token lives in an httpOnly cookie and is read here on    */
/*  the server — it never reaches the browser JS heap.                  */
/* ------------------------------------------------------------------ */

import "server-only";
import { cookies } from "next/headers";
import type { Capabilities } from "@/lib/capabilities";

export const AUTH_COOKIE = "tt_token";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export interface LmsResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Raw parsed body (useful for error messages / validation errors). */
  body: unknown;
}

/**
 * Call the Laravel API. When `auth` is true, attaches the stored bearer token.
 */
export async function lmsFetch<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<LmsResult<T>> {
  const { auth = false, headers, ...rest } = init;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    cache: "no-store",
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    data: res.ok ? (body as T) : null,
    body,
  };
}

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  role: import("@/lib/roles").AnySessionRole;
  organisationId?: string | null;
  avatar: string | null;
  /** See `AuthUser.roleNames`. */
  roleNames?: string[];
  /** Computed by the API; read with `serverCan`. See `@/lib/capabilities`. */
  capabilities?: Capabilities;
  /**
   * Every permission key this person holds (`module.feature.action`), computed
   * by the API from the built-in User role and the roles they hold. Read it with
   * `holdsFeature()` from `@/lib/permissions`. Presentation only; optional for
   * older sessions.
   */
  permissions?: string[];
  /** On any live project's team; decides the sign-in landing (X4). */
  onProjectTeam?: boolean;
  /** See `AuthUser.modules`. */
  modules?: import("@/lib/module-access").SessionModule[];
  /** See `AuthUser.affiliate`. */
  affiliate?: import("@/lib/auth-store").SessionAffiliate | null;
}

export { can as serverCan } from "@/lib/capabilities";

/**
 * Resolve the signed-in user from the httpOnly token cookie (server-side).
 * Returns null when there is no valid session.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const result = await lmsFetch<{ data?: ServerUser }>("/auth/me", { auth: true });
  if (!result.ok) return null;
  const body = result.body as { data?: ServerUser } | ServerUser;
  return ("data" in (body as object) ? (body as { data?: ServerUser }).data : (body as ServerUser)) ?? null;
}

/** Best-effort extraction of a human-readable error message from a Laravel response. */
export function lmsErrorMessage(body: unknown, fallback = "Something went wrong."): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
  }
  return fallback;
}

/**
 * An organisation's course, for a signed-in member of that organisation.
 *
 * The public catalogue deliberately never returns an organisation's course —
 * it is private to its members — so `/courses/[slug]` falls back to this when
 * the cached public read comes back empty. The API answers with the course
 * only when the bearer belongs to the course's organisation; everybody else
 * gets the same 404 as a course that doesn't exist, so the URL confirms
 * nothing to an outsider. Reads the session cookie, which makes the render
 * dynamic — only on this fallback path; public courses stay cached.
 */
export async function getMemberCourse<T = unknown>(slug: string): Promise<T | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const result = await lmsFetch<{ data?: T }>(`/courses/${encodeURIComponent(slug)}`, { auth: true });
  if (!result.ok) return null;
  return (result.body as { data?: T })?.data ?? null;
}

/** Is there a session cookie at all? Cheaper than resolving the user. */
export async function hasSessionCookie(): Promise<boolean> {
  return Boolean((await cookies()).get(AUTH_COOKIE)?.value);
}

/**
 * Call the Laravel API and hand back its response untouched - for files
 * (PDFs), which `lmsFetch` would try to read as text. Attaches the token.
 */
export async function lmsFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const headers: Record<string, string> = { Accept: "application/pdf, application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
}
