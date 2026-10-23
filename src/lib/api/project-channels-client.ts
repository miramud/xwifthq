/* ------------------------------------------------------------------ */
/*  Browser-side client for one project's notification channels.        */
/*  Calls the same-origin /api/projects/* proxy (token stays httpOnly).  */
/*                                                                      */
/*  A project may post its updates to its own Slack channel, WhatsApp    */
/*  group and team email list. Left blank, updates go to the             */
/*  organisation's defaults from the Integrations screen.                */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/projects/${path}`, {
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

/**
 * The project events that can be posted to a channel.
 *
 * The contract leaves the event list open; these are the keys the frontend
 * offers, named after the notifications the backend sends.
 */
export type ProjectChannelEvent =
  | "member_added"
  | "item_assigned"
  | "sprint_started"
  | "sprint_closed"
  | "item_overdue";

export const PROJECT_CHANNEL_EVENTS: { key: ProjectChannelEvent; label: string; hint: string }[] = [
  { key: "member_added", label: "Someone joins the project", hint: "Posted when a member is added to the team." },
  { key: "item_assigned", label: "A task or story is assigned", hint: "Posted when work is assigned or reassigned." },
  { key: "sprint_started", label: "A sprint starts", hint: "With the sprint goal and dates." },
  { key: "sprint_closed", label: "A sprint closes", hint: "With what was finished and what carried over." },
  { key: "item_overdue", label: "Work becomes overdue", hint: "Once a day, for items past their due date." },
];

export interface ProjectChannels {
  slackChannel: string | null;
  whatsappGroup: string | null;
  /** Comma-separated addresses; at most ten. */
  emailList?: string | null;
  /** The organisation has a mailbox switched on. Absent on older deployments. */
  emailConnected?: boolean;
  /** Which mailbox sends, when one does. */
  emailProvider?: "gmail" | "zoho_mail" | null;
  events: string[];
  /**
   * The organisation's defaults, when the API includes them. Not part of the
   * contract's required shape, so it is read defensively.
   */
  defaults?: { slackChannel?: string | null; whatsappGroup?: string | null; emailList?: string | null } | null;
}

const path = (slug: string) => `projects/${encodeURIComponent(slug)}/channels`;

export const projectChannels = {
  get: (slug: string) => request<{ data: ProjectChannels }>(path(slug)).then((r) => r.data),
  save: (
    slug: string,
    body: { slackChannel: string | null; whatsappGroup: string | null; emailList?: string | null; events: string[] },
  ) =>
    request<{ data: ProjectChannels }>(path(slug), { method: "PUT", body }).then((r) => r.data),
};
