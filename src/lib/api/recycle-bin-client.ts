/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation's recycle bin.            */
/*  Same-origin /api/admin/recycle-bin/* proxy; token stays httpOnly.  */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";
import type { Paginated } from "@/lib/api/users-client";

export { ApiError };

async function request<T>(path: string, init: { method?: string } = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, { method: init.method ?? "GET", cache: "no-store" });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }

  return json as T;
}

export type BinModule = "core" | "lms" | "hrm" | "projects";

export interface BinEntry {
  id: string;
  type: string;
  typeLabel: string;
  module: BinModule;
  label: string;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
  restorable: boolean;
  blockedReason: string | null;
  /** Platform-wide bin only: whose item this was. Null for platform-scope items. */
  organisation?: { slug: string; name: string } | null;
}

export interface BinSummary {
  total: number;
  types: { type: string; typeLabel: string; module: BinModule; count: number }[];
}

export interface BinFilters {
  type?: string;
  module?: BinModule | "";
  search?: string;
  /** Platform-wide bin only: an organisation slug, or `platform` for platform-scope items. */
  organisation?: string;
  page?: number;
  perPage?: number;
}

function query(filters: BinFilters): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const recycleBin = {
  list: (filters: BinFilters = {}) => request<Paginated<BinEntry>>(`recycle-bin${query(filters)}`),
  summary: () => request<{ data: BinSummary }>("recycle-bin/summary").then((r) => r.data),
  restore: (id: string) =>
    request<{ data: BinEntry }>(`recycle-bin/${encodeURIComponent(id)}/restore`, { method: "POST" }).then(
      (r) => r.data,
    ),
  /** Permanent. There is no way back from this. */
  purge: (id: string) => request<unknown>(`recycle-bin/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Permanently deletes everything in this organisation's bin. */
  empty: () =>
    request<{ data: { deleted: number; skipped?: number } }>("recycle-bin", { method: "DELETE" }).then((r) => r.data),
};
