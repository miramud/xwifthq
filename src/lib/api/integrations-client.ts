/* ------------------------------------------------------------------ */
/*  Browser-side client for where notifications are delivered.          */
/*                                                                      */
/*  Two halves, because they answer to different people:               */
/*   - the organisation's own Slack app, WhatsApp Business number and   */
/*     sending mailbox (Gmail or Zoho Mail), for admins and delivery    */
/*     leads, and                                                       */
/*   - each person's own choice of channel (anyone signed in).          */
/*                                                                      */
/*  Both go through thin Next proxies (/api/org/*, /api/me/notification- */
/*  channels/*) that attach the httpOnly token server-side.             */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

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

/* ---------- The organisation's integrations ---------- */

export type IntegrationProvider = "slack" | "whatsapp" | "gmail" | "zoho_mail";

/** The two mailboxes. Only one of them sends project email at a time. */
export type EmailProvider = "gmail" | "zoho_mail";

export const EMAIL_PROVIDERS: EmailProvider[] = ["gmail", "zoho_mail"];

export const EMAIL_PROVIDER_LABEL: Record<EmailProvider, string> = {
  gmail: "Gmail",
  zoho_mail: "Zoho Mail",
};

export function isEmailProvider(p: string | null | undefined): p is EmailProvider {
  return p === "gmail" || p === "zoho_mail";
}

/** Zoho keeps each account in one data centre; the domain in its URL says which. */
export type ZohoRegion = "com" | "eu" | "in" | "com.au" | "jp" | "com.cn";

export const ZOHO_REGIONS: { value: ZohoRegion; label: string; hint: string }[] = [
  { value: "com", label: "zoho.com", hint: "United States and everywhere not listed below" },
  { value: "eu", label: "zoho.eu", hint: "Europe" },
  { value: "in", label: "zoho.in", hint: "India" },
  { value: "com.au", label: "zoho.com.au", hint: "Australia" },
  { value: "jp", label: "zoho.jp", hint: "Japan" },
  { value: "com.cn", label: "zoho.com.cn", hint: "China" },
];

/** A Zoho mailbox on Zoho's own domain, or on the organisation's own domain. */
export type ZohoAccount = "personal" | "organisation";

export interface SlackIntegrationSettings {
  teamName?: string | null;
  /** The bot's Slack user name, without the @. */
  botUser?: string | null;
}

export interface WhatsAppIntegrationSettings {
  phoneNumberId?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  displayNumber?: string | null;
  verifiedName?: string | null;
}

export interface EmailIntegrationSettings {
  /** The mailbox that signs in and sends. */
  address?: string | null;
  fromName?: string | null;
  /** Comma-separated addresses a project without its own list is sent to. */
  defaultList?: string | null;
  /** Zoho only. */
  region?: ZohoRegion | null;
  /** Zoho only. */
  account?: ZohoAccount | null;
}

export interface OrgIntegration {
  provider: IntegrationProvider;
  /** "Slack" / "WhatsApp". */
  label?: string;
  /** Credentials are stored. Says nothing about whether they work. */
  connected: boolean;
  enabled: boolean;
  /** Set when the last check against Slack / Meta succeeded. */
  verifiedAt: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
  settings: SlackIntegrationSettings & WhatsAppIntegrationSettings & EmailIntegrationSettings;
  /** The last few characters only — enough to recognise, never enough to use. */
  masked: { botToken?: string | null; accessToken?: string | null; appPassword?: string | null } | null;
}

export interface SlackIntegrationInput {
  botToken?: string;
  enabled?: boolean;
}

export interface WhatsAppIntegrationInput {
  accessToken?: string;
  phoneNumberId?: string;
  templateName?: string;
  templateLanguage?: string;
  enabled?: boolean;
}

export interface EmailIntegrationInput {
  address: string;
  /** Omit (or send the mask back) to keep the saved one. */
  appPassword?: string;
  fromName?: string | null;
  defaultList?: string | null;
  region?: ZohoRegion;
  account?: ZohoAccount;
  enabled?: boolean;
}

export interface TestResult {
  ok: boolean;
  detail: string;
}

export interface SavedIntegration {
  integration: OrgIntegration;
  /**
   * Present when saving re-checked the credentials with Slack / Meta. A save
   * can succeed while the check fails — the token is kept, and this says why
   * it does not work yet.
   */
  verification: TestResult | null;
  /**
   * Set when switching a mailbox on switched the other one off — only one
   * mailbox sends project email at a time.
   */
  disabled: EmailProvider | null;
}

export const orgIntegrations = {
  list: () =>
    request<{ data: OrgIntegration[] }>("/api/org/integrations").then((r) => r.data ?? []),
  save: (
    provider: IntegrationProvider,
    body: SlackIntegrationInput | WhatsAppIntegrationInput | EmailIntegrationInput,
  ) =>
    request<{
      data: OrgIntegration;
      meta?: { verification?: TestResult | null; disabled?: string | null };
    }>(`/api/org/integrations/${provider}`, { method: "PUT", body }).then(
      (r): SavedIntegration => ({
        integration: r.data,
        verification: r.meta?.verification ?? null,
        disabled: isEmailProvider(r.meta?.disabled) ? r.meta.disabled : null,
      }),
    ),
  test: (provider: IntegrationProvider) =>
    request<{ data: TestResult }>(`/api/org/integrations/${provider}/test`, { method: "POST" }).then(
      (r) => r.data,
    ),
  disconnect: (provider: IntegrationProvider) =>
    request<unknown>(`/api/org/integrations/${provider}`, { method: "DELETE" }),
};

/* ---------- One person's channels ---------- */

export interface MyNotificationChannels {
  slack: {
    /** The organisation has Slack switched on and verified. */
    available: boolean;
    enabled: boolean;
    /** Matched to a Slack account by work email. */
    linked: boolean;
    handle?: string | null;
    /** Why it could not be matched, in words fit to show. */
    problem?: string | null;
  };
  whatsapp: {
    available: boolean;
    enabled: boolean;
    number: string | null;
    optedInAt: string | null;
    /** From the caller's own HR record, when there is one. */
    suggestedNumber?: string | null;
  };
  /**
   * A copy by email from the organisation's mailbox. Optional because older
   * deployments do not send it.
   */
  email?: {
    /** The organisation has a mailbox switched on. */
    available: boolean;
    enabled: boolean;
    /** The person's own sign-in address; they do not choose another. */
    address: string;
  };
}

/** The channels a person can pick for themselves, and test. */
export type ReachChannel = "slack" | "whatsapp" | "email";

export interface MyNotificationChannelsInput {
  slack?: { enabled: boolean };
  whatsapp?: { enabled: boolean; number?: string | null; consent?: boolean };
  email?: { enabled: boolean };
}

export const notificationChannels = {
  get: () =>
    request<{ data: MyNotificationChannels }>("/api/me/notification-channels").then((r) => r.data),
  update: (body: MyNotificationChannelsInput) =>
    request<{ data: MyNotificationChannels }>("/api/me/notification-channels", { method: "PUT", body }).then(
      (r) => r.data,
    ),
  test: (channel: ReachChannel) =>
    request<{ data: TestResult }>("/api/me/notification-channels/test", {
      method: "POST",
      body: { channel },
    }).then((r) => r.data),
};

/**
 * E.164 as Meta takes it: a plus, a country code that does not start with 0,
 * and up to fifteen digits in all. Spaces, dashes and brackets are forgiven —
 * people paste numbers the way they write them.
 */
export function normaliseE164(raw: string): string | null {
  const compact = raw.replace(/[\s\-().]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(compact) ? compact : null;
}

/* ---------- Address lists ---------- */

/**
 * One list of addresses, however it was typed: one per line, or separated by
 * commas or semicolons (how Outlook copies them). Blanks and repeats go.
 */
export function parseAddressList(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(/[\n,;]+/)) {
    const a = part.trim();
    if (a === "" || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push(a);
  }
  return out;
}

/** A first pass only — the server has the last word, and names what it refuses. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(value);
}

/** The most addresses a list may hold; the API refuses more. */
export const MAX_LIST_ADDRESSES = 10;
