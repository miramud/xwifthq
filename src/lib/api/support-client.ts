/* ------------------------------------------------------------------ */
/*  Browser-side client for the requester side of support tickets.     */
/*  Calls the same-origin /api/support/* proxy (token stays httpOnly). */
/* ------------------------------------------------------------------ */

"use client";

import { ApiError } from "./admin-client";

export { ApiError };

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
  role: string;
  category: string | null;
  priority: string;
  status: string;
  assignee: string | null;
  created: string;
  updated: string;
  /** Addressed to the platform owner, not the organisation's admins (O7). */
  toPlatform?: boolean;
  messages?: TicketMessage[];
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/support/${path}`, {
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

export const tickets = {
  list: () => request<{ data: SupportTicket[] }>("tickets").then((r) => r.data ?? []),

  get: (id: string) =>
    request<{ data: SupportTicket }>(`tickets/${encodeURIComponent(id)}`).then((r) => r.data),

  /** `toPlatform` sends it to the platform owner instead of the organisation's admins. */
  open: (body: { subject: string; body: string; category?: string; priority?: string; toPlatform?: boolean }) =>
    request<{ data: SupportTicket }>("tickets", { method: "POST", body }).then((r) => r.data),

  reply: (id: string, body: string) =>
    request<{ data: SupportTicket }>(`tickets/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      body: { body },
    }).then((r) => r.data),

  close: (id: string) =>
    request<{ data: SupportTicket }>(`tickets/${encodeURIComponent(id)}/close`, {
      method: "PATCH",
    }).then((r) => r.data),
};
