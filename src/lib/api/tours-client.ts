/* ------------------------------------------------------------------ */
/*  Browser-side client for product-tour progress.                     */
/*                                                                      */
/*  Which dashboard tours the signed-in person has finished or skipped, */
/*  through the thin /api/me/tours proxy that attaches the httpOnly     */
/*  token server-side. The tour engine treats every call as best        */
/*  effort: a failure here must never stop a page from working.         */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

export type TourStatus = "completed" | "dismissed";

export interface TourProgress {
  completed: string[];
  dismissed: string[];
}

async function request<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }
  return json as T;
}

function normalise(data: Partial<TourProgress> | undefined): TourProgress {
  return {
    completed: Array.isArray(data?.completed) ? data.completed : [],
    dismissed: Array.isArray(data?.dismissed) ? data.dismissed : [],
  };
}

export const tours = {
  progress: () => request<{ data?: Partial<TourProgress> }>("/api/me/tours").then((r) => normalise(r.data)),

  mark: (key: string, status: TourStatus) =>
    request<{ data?: Partial<TourProgress> }>(`/api/me/tours/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { status },
    }).then((r) => normalise(r.data)),

  /** Forgets a tour so it can be replayed. */
  reset: (key: string) => request<unknown>(`/api/me/tours/${encodeURIComponent(key)}`, { method: "DELETE" }),
};
