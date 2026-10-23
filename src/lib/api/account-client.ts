/* ------------------------------------------------------------------ */
/*  Browser-side client for settings that belong to the *account*,      */
/*  not to a role: the password and notification opt-outs.              */
/*                                                                      */
/*  These do not go through the /api/instructor or /api/admin proxies —  */
/*  the Laravel routes are role-agnostic and scope everything to the     */
/*  signed-in user.                                                     */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

async function request<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors, json?.code);
  }
  return json as T;
}

/* ---------- Profile (name + photo, any role) ---------- */

export interface AccountProfile {
  id: string;
  name: string;
  /** Read-only: the sign-in address. There is no verification or reset flow. */
  email: string;
  role: import("@/lib/roles").AnySessionRole;
  avatar: string | null;
  platformFeePercent: number;
}

export const accountProfile = {
  update: (body: { name?: string; avatarUrl?: string | null; avatarPublicId?: string | null }) =>
    request<{ data: AccountProfile }>("/api/auth/profile", { method: "PUT", body }).then(
      (r) => r.data,
    ),
};

export interface AvatarAsset {
  url: string;
  publicId: string;
}

/**
 * Profile photos have their own endpoint and their own 2 MB cap — the course
 * media route is gated on `role:instructor,admin`, so a learner cannot use it.
 */
export async function uploadAvatar(file: File): Promise<AvatarAsset> {
  const form = new FormData();
  form.append("avatar", file);

  const res = await fetch("/api/auth/avatar", { method: "POST", body: form, cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Laravel reports the size/type refusal under the field name.
    const detail = json?.errors?.avatar?.[0];
    throw new ApiError(detail ?? json?.message ?? "Upload failed.", res.status, json?.errors);
  }

  return json.data as AvatarAsset;
}

/* ---------- Password ---------- */

export interface PasswordChange {
  currentPassword: string;
  password: string;
  password_confirmation: string;
}

export const password = {
  /**
   * Changing the password revokes every *other* session server-side. This tab
   * keeps working, so there is nothing to do here on success but say so.
   */
  update: (body: PasswordChange) =>
    request<{ data: { message: string } }>("/api/auth/password", { method: "PUT", body }),
};

/* ---------- Notification preferences ---------- */

export interface NotificationPreference {
  key: string;
  label: string;
  /** What this notification actually is, straight from the backend registry. */
  effect: string;
  enabled: boolean;
  /** False when an admin has switched this notification off for everyone. */
  platformEnabled: boolean;
}

export const notificationPreferences = {
  list: () =>
    request<{ data: NotificationPreference[] }>("/api/notifications/preferences").then(
      (r) => r.data,
    ),
  update: (preferences: Record<string, boolean>) =>
    request<{ data: NotificationPreference[] }>("/api/notifications/preferences", {
      method: "PUT",
      body: { preferences },
    }).then((r) => r.data),
};

/* ---------- Two-step verification (authenticator app) ---------- */

/**
 * The caller's own authenticator app. Asked for when approving a large
 * request or a payment schedule; signing in does not use it.
 */
export interface MfaStatus {
  enabled: boolean;
  /** Setup started and not finished: protects nothing yet. */
  pending: boolean;
  confirmedAt: string | null;
  backupCodesLeft: number;
  lastVerifiedAt: string | null;
}

export interface MfaSetup {
  /** The key to type by hand, in groups of four. */
  secret: string;
  otpauthUri: string;
  /** The QR code as an SVG data URI. */
  qr: string;
}

export const mfa = {
  status: () => request<{ data: MfaStatus }>("/api/me/mfa").then((r) => r.data),
  start: () => request<{ data: MfaSetup }>("/api/me/mfa/start", { method: "POST" }).then((r) => r.data),
  /** Returns the backup codes - the only time they are ever shown. */
  confirm: (code: string) =>
    request<{ data: MfaStatus & { backupCodes: string[] } }>("/api/me/mfa/confirm", { method: "POST", body: { code } }).then((r) => r.data),
  disable: (code: string) =>
    request<{ data: MfaStatus }>("/api/me/mfa/disable", { method: "POST", body: { code } }).then((r) => r.data),
  regenerate: (code: string) =>
    request<{ data: MfaStatus & { backupCodes: string[] } }>("/api/me/mfa/backup-codes", { method: "POST", body: { code } }).then((r) => r.data),
};
