/* ------------------------------------------------------------------ */
/*  The one request helper both Finance clients share                 */
/*  (`finance-ledger-client`, `finance-banking-client`). Same-origin   */
/*  /api/finance proxy; Laravel decides who may do what.               */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";

export { ApiError };

type Query = Record<string, string | number | boolean | null | undefined>;

function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function read<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors, json?.code);
  return json as T;
}

/** JSON in and out. */
export async function financeRequest<T>(path: string, init: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const res = await fetch(`/api/finance/${path}${qs(init.query)}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return read<T>(res);
}

/** A file upload (multipart); the browser sets the boundary. */
export async function financeUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/finance/${path}`, { method: "POST", body: form, cache: "no-store" });
  return read<T>(res);
}

/** Unwrap Laravel's `{ data }`. */
export const unwrap = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);

/** The first validation message for a field, or the error's message. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const first = e.errors ? Object.values(e.errors).flat()[0] : undefined;
    return (typeof first === "string" ? first : undefined) ?? e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}
