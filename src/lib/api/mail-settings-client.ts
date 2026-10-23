/* ------------------------------------------------------------------ */
/*  Browser-side client for email delivery, at two scopes that share   */
/*  one API shape:                                                      */
/*                                                                      */
/*  - an organisation's own provider, at /api/admin/mail-settings       */
/*  - the platform's provider, at /api/platform/mail-settings           */
/*                                                                      */
/*  Mail to a member of an organisation goes through that               */
/*  organisation's active provider; failing that, the platform's; and   */
/*  failing that, the server's default mail settings. Both go through  */
/*  the same-origin proxy, so the session token stays httpOnly.         */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

/** Which proxy a client talks to: the organisation's admin API or the platform's. */
export type MailSettingsBase = "admin" | "platform";

async function request<T>(
  base: MailSettingsBase,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/${base}/${path}`, {
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

export type MailProviderKey =
  | "smtp"
  | "gmail"
  | "resend"
  | "zeptomail"
  | "microsoft"
  | "mailgun"
  | "postmark"
  | "ses"
  | (string & {});

export type MailFieldType = "text" | "password" | "select" | "email";

/** A select's options arrive either as bare values or as value/label pairs. */
export type MailFieldOption = string | { value: string; label: string };

export interface MailField {
  key: string;
  label: string;
  type: MailFieldType;
  required: boolean;
  options?: MailFieldOption[];
  hint?: string | null;
}

export interface MailProvider {
  key: MailProviderKey;
  label: string;
  /** Credentials are stored. Says nothing about whether they work. */
  configured: boolean;
  /** Set when the last test email went out. */
  verifiedAt: string | null;
  fields: MailField[];
  /** Non-secret values only. A password field never comes back. */
  values: Record<string, string | null>;
}

export interface MailSettings {
  active: MailProviderKey | null;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  providers: MailProvider[];
  /** Platform scope only: how mail is routed, in the API's own words. */
  /**
   * Platform scope only. A single "right now" sentence, or the API's list of
   * the routing steps — which the page already draws itself, so a list is not
   * repeated.
   */
  routing?: string | string[] | null;
}

export interface MailProviderInput {
  /** Secrets left blank keep the stored value. */
  values: Record<string, string>;
  fromName?: string;
  fromAddress?: string;
  replyTo?: string | null;
}

const path = (provider: string) => `mail-settings/${encodeURIComponent(provider)}`;

export function createMailSettingsClient(base: MailSettingsBase) {
  return {
    get: () => request<{ data: MailSettings }>(base, "mail-settings").then((r) => r.data),
    save: (provider: MailProviderKey, body: MailProviderInput) =>
      request<{ data: MailSettings }>(base, path(provider), { method: "PUT", body }).then((r) => r.data),
    /** Sends a real email. A refusal carries the provider's own error message. */
    test: (provider: MailProviderKey, to: string) =>
      request<{ data: { sent: boolean } }>(base, `${path(provider)}/test`, { method: "POST", body: { to } }).then(
        (r) => r.data,
      ),
    activate: (provider: MailProviderKey) =>
      request<{ data: MailSettings }>(base, `${path(provider)}/activate`, { method: "POST" }).then((r) => r.data),
    /** Erases the credentials for real — a secret never goes to the recycle bin. */
    remove: (provider: MailProviderKey) => request<unknown>(base, path(provider), { method: "DELETE" }),
  };
}

export type MailSettingsClient = ReturnType<typeof createMailSettingsClient>;

/** The organisation's own provider. */
export const mailSettings = createMailSettingsClient("admin");

/** The platform's provider: onboarding, sales and owner mail, and people outside any organisation. */
export const platformMailSettings = createMailSettingsClient("platform");

export function optionValue(o: MailFieldOption): string {
  return typeof o === "string" ? o : o.value;
}

export function optionLabel(o: MailFieldOption): string {
  return typeof o === "string" ? o : o.label;
}
