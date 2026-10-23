import type { AuthUser } from "@/lib/auth-store";

/**
 * Who may use the platform console, and which parts of it.
 *
 * Two kinds of person sit here. The super admin owns the platform and passes
 * every check. Platform staff (`platform_staff`, no organisation) hold platform
 * roles, and see a page only when the session carries the permission for it.
 *
 * Like every gate on the client, this decides what to *offer*. The API refuses
 * the call regardless, so a hidden link is courtesy, not security.
 */

/** Platform permission keys the console asks about. `manage` implies `view` for the same feature. */
export const PERM = {
  overview: "platform.overview.view",
  organisationsView: "platform.organisations.view",
  organisationsManage: "platform.organisations.manage",
  modulesView: "platform.modules.view",
  modulesManage: "platform.modules.manage",
  analytics: "platform.analytics.view",
  sales: "platform.sales.view",
  paymentsView: "platform.payments.view",
  paymentsReconcile: "platform.payments.reconcile",
  usersView: "platform.users.view",
  usersManage: "platform.users.manage",
  rolesView: "platform.roles.view",
  rolesManage: "platform.roles.manage",
  audit: "platform.audit.view",
  settings: "platform.settings.manage",
  support: "platform.support.view",
  binView: "platform.recycle_bin.view",
  binManage: "platform.recycle_bin.manage",
} as const;

type SessionExtras = { permissions?: string[] | null; role?: string };

function extras(u: AuthUser | null): SessionExtras {
  return (u ?? {}) as unknown as SessionExtras;
}

export function isSuperAdmin(u: AuthUser | null): boolean {
  return u?.role === "super_admin";
}

export function isPlatformStaff(u: AuthUser | null): boolean {
  return extras(u).role === "platform_staff";
}

/** May this person open the platform console at all? */
export function isPlatformMember(u: AuthUser | null): boolean {
  return isSuperAdmin(u) || isPlatformStaff(u);
}

/** Does this person hold `key` (or the `manage` sibling of a `view` key)? */
export function canPlatform(u: AuthUser | null, key: string): boolean {
  if (isSuperAdmin(u)) return true;
  if (!isPlatformStaff(u)) return false;

  const held = extras(u).permissions ?? [];
  if (held.includes(key)) return true;

  if (key.endsWith(".view")) {
    const feature = key.slice(0, -".view".length);
    return held.some((p) => p.startsWith(`${feature}.`));
  }

  return false;
}

/** A nav `show` predicate for one permission. */
export const allows = (key: string) => (u: AuthUser | null) => canPlatform(u, key);
