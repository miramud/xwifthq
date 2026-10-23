/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation's job titles.              */
/*  Same-origin /api/org/job-titles proxy; the token stays httpOnly.    */
/*                                                                      */
/*  One list per organisation, used by every module: the users form,    */
/*  HR (hire, requisitions, offers, contracts, internships) and         */
/*  Projects. The owner's ruling of 27 Sep 2026: a job title is         */
/*  universal across the platform, picked from a list, and anybody      */
/*  allowed to can add one from the dropdown itself.                    */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";

export { ApiError };

export interface JobTitle {
  id: string;
  /** A stable slug of the name. */
  key: string;
  name: string;
  position: number;
  isActive: boolean;
  /** How many people hold it — a title that's held can't be deleted. */
  peopleCount: number;
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/org/${path}`, {
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

export const jobTitles = {
  /** Active titles; `all` adds the inactive ones (admins and HR managers only). */
  list: (opts: { all?: boolean } = {}) =>
    request<{ data: JobTitle[] }>(`job-titles${opts.all ? "?all=1" : ""}`).then((r) => r.data),

  /**
   * Idempotent and case-insensitive: adding "staff accountant" when "Staff
   * Accountant" exists returns the existing one. 403 when this person may not
   * add titles.
   */
  create: (name: string) =>
    request<{ data: JobTitle }>("job-titles", { method: "POST", body: { name } }).then((r) => {
      remember(r.data);
      return r.data;
    }),

  update: (id: string, patch: { name?: string; isActive?: boolean; position?: number }) =>
    request<{ data: JobTitle }>(`job-titles/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }).then((r) => {
      invalidateJobTitles();
      return r.data;
    }),

  /** 422 while anybody holds it; the message says so. */
  remove: (id: string) =>
    request<unknown>(`job-titles/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {
      invalidateJobTitles();
    }),
};

/* ------------------------------------------------------------------ */
/*  The session cache behind every picker                              */
/* ------------------------------------------------------------------ */

/*
  A form can hold several pickers and a page several forms; they share one
  request and one list. The list is loaded once per session, re-read after an
  edit on the management screen, and a title added from any picker appears in
  all of them at once.
*/

export interface JobTitlesState {
  status: "idle" | "loading" | "ready" | "error";
  titles: JobTitle[];
  error: string | null;
}

let state: JobTitlesState = { status: "idle", titles: [], error: null };
let inflight: Promise<JobTitle[]> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<JobTitlesState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const byPosition = (a: JobTitle, b: JobTitle) => a.position - b.position || a.name.localeCompare(b.name);

export function subscribeJobTitles(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getJobTitlesState(): JobTitlesState {
  return state;
}

const SERVER_STATE: JobTitlesState = { status: "idle", titles: [], error: null };
export function getJobTitlesServerState(): JobTitlesState {
  return SERVER_STATE;
}

/** Loads the active titles once; `force` re-reads. Concurrent callers share one request. */
export function loadJobTitles(force = false): Promise<JobTitle[]> {
  if (!force && state.status === "ready") return Promise.resolve(state.titles);
  if (inflight) return inflight;
  if (state.status !== "ready") set({ status: "loading", error: null });
  inflight = jobTitles
    .list()
    .then((titles) => {
      set({ status: "ready", titles: [...titles].sort(byPosition), error: null });
      return state.titles;
    })
    .catch((e: unknown) => {
      // A failed refresh keeps the list we already had.
      if (state.status !== "ready") {
        set({ status: "error", error: e instanceof ApiError ? e.message : "Job titles didn't load." });
      }
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Puts a title into the cached list straight away (after a create). */
function remember(title: JobTitle) {
  if (!title.isActive) return;
  const rest = state.titles.filter((t) => t.id !== title.id);
  set({ titles: [...rest, title].sort(byPosition) });
}

/** Marks the cache stale and re-reads it if anything is showing it. */
export function invalidateJobTitles() {
  if (state.status === "idle") return;
  if (listeners.size > 0) void loadJobTitles(true).catch(() => {});
  else set({ status: "idle" });
}

/**
 * Tests (and anything that already holds the list): fill the cache so
 * pickers show these titles without a request.
 */
export function primeJobTitlesCache(titles: JobTitle[]) {
  inflight = null;
  set({ status: "ready", titles: [...titles].sort(byPosition), error: null });
}

/** Tests only: forget everything between cases. */
export function resetJobTitlesCache() {
  state = { status: "idle", titles: [], error: null };
  inflight = null;
}
