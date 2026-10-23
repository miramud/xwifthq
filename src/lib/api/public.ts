/* ------------------------------------------------------------------ */
/*  Public (unauthenticated) LMS catalog client.                       */
/*                                                                      */
/*  Server-only helper used by the learner-facing pages (home,         */
/*  /courses, /courses/[slug], /cart) to read course data from the      */
/*  Laravel backend's public endpoints:                                 */
/*    GET /courses        — paginated catalog (CourseListResource)     */
/*    GET /courses/{slug} — full detail (CourseResource)               */
/*    GET /categories     — category list                              */
/*                                                                      */
/*  These endpoints need no auth, so we hit them directly with `fetch`  */
/*  (ISR-cached) rather than the cookie-aware `lmsFetch`.               */
/*                                                                      */
/*  There is deliberately NO bundled fallback catalog: every course the */
/*  site shows comes from the database. When the API is unreachable the  */
/*  callers render an empty state rather than invented courses.          */
/* ------------------------------------------------------------------ */

import "server-only";
import type { Course } from "@/suite/lms/lib/course-data";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/** Re-fetch public catalog data at most once every 5 minutes (ISR). */
const REVALIDATE_SECONDS = 300;

/** Laravel resource-collection envelope: `{ data: [...], meta: {...} }`. */
interface ListEnvelope<T> {
  data?: T[];
}

/** Laravel single-resource envelope: `{ data: {...} }`. */
interface ItemEnvelope<T> {
  data?: T;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API unreachable (e.g. backend not running). The caller shows an empty state.
    return null;
  }
}

export type CourseSort =
  | "popular"
  | "newest"
  | "price-low"
  | "price-high"
  | "rating";

export interface CourseQuery {
  category?: string;
  level?: string;
  search?: string;
  sort?: CourseSort;
  perPage?: number;
}

export interface PublicCategory {
  name: string;
  slug: string;
  color?: string | null;
}

/**
 * The public course catalog. The list endpoint returns a lightweight subset of
 * `Course` (no description/sections/reviews) — everything the catalog grid and
 * the home carousels need.
 */
export async function getCourses(query: CourseQuery = {}): Promise<Course[]> {
  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.level) params.set("level", query.level);
  if (query.search) params.set("search", query.search);
  if (query.sort) params.set("sort", query.sort);
  params.set("perPage", String(query.perPage ?? 100));

  const body = await getJson<ListEnvelope<Course>>(`/courses?${params.toString()}`);
  return body?.data ?? [];
}

/** A single course by slug, including sections and reviews. Null when it doesn't exist. */
export async function getCourse(slug: string): Promise<Course | null> {
  const body = await getJson<ItemEnvelope<Course>>(`/courses/${encodeURIComponent(slug)}`);
  return body?.data ?? null;
}

/** The category taxonomy, used by every catalog and dashboard filter. */
export async function getCategories(): Promise<PublicCategory[]> {
  const body = await getJson<ListEnvelope<PublicCategory>>("/categories");
  return body?.data ?? [];
}
