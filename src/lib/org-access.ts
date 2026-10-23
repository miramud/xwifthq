import { holdsFeature, type PermissionHolder } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";

/**
 * Who may open the organisation console, and which of its pages (S8).
 *
 * The owner's ruling of 2 October 2026: the console admits anybody holding a
 * `core.*` key for one of its pages - the Auditor, the Billing manager, the
 * Support desk starter roles had no screen at all - and shows them only the
 * pages their keys reach. The organisation admin and the platform owner see
 * it as before. Managing the organisation's admins stays with those who hold
 * the Organisation admin role (`RoleDirectory::mayManageAdmins`), so that page
 * maps to no key.
 *
 * Presentation only: every page's API is guarded route by route, and a custom
 * role is let through it on exactly these keys (`Access\PermissionGate`).
 * Shared by the server layout and the client shell so they cannot disagree.
 */

type OrgHolder = PermissionHolder & { organisationId?: string | null };

/** Path prefix -> the `core` features whose keys open it. Longest prefix wins. */
export const ORG_PAGE_FEATURES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["/suite/org/users", ["users"]],
  ["/suite/org/people", ["users"]],
  ["/suite/org/roles", ["roles"]],
  ["/suite/org/job-titles", ["job_titles"]],
  ["/suite/org/messages", ["support"]],
  ["/suite/org/billing", ["billing"]],
  ["/suite/org/seats", ["seats"]],
  ["/suite/org/branding", ["branding"]],
  ["/suite/org/media", ["media_settings"]],
  ["/suite/org/integrations", ["integrations"]],
  ["/suite/org/email", ["mail_settings"]],
  ["/suite/org/policies", ["policies"]],
  ["/suite/org/audit", ["audit_log"]],
  ["/suite/org/recycle-bin", ["recycle_bin"]],
  // The organisation's shared foundations (5 Oct 2026).
  ["/suite/org/profile", ["organisation_profile", "fx_rates"]],
  ["/suite/org/structure", ["org_units", "cost_centres"]],
  ["/suite/org/counterparties", ["counterparties"]],
  ["/suite/org/numbering", ["numbering"]],
  ["/suite/org/documents", ["documents"]],
  // The approval setup: each tab is guarded by its own key in the API.
  ["/suite/org/approvals", ["approvals", "approval_policies", "approval_roles", "approval_authority"]],
];

const OVERVIEW: readonly string[] = ["overview"];

/** Every feature some console page answers to. */
const ALL_FEATURES = Array.from(new Set([...OVERVIEW, ...ORG_PAGE_FEATURES.flatMap(([, f]) => f)]));

/** Organisation admin or platform owner; re-exported so the shell asks one module. */
export { isAdminRole };

/** The features a console page answers to, or null for an admin-only page. */
export function orgFeaturesFor(pathname: string): readonly string[] | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/suite/org") return OVERVIEW;

  let best: readonly [string, readonly string[]] | null = null;

  for (const entry of ORG_PAGE_FEATURES) {
    if ((path === entry[0] || path.startsWith(`${entry[0]}/`)) && (best === null || entry[0].length > best[0].length)) {
      best = entry;
    }
  }

  return best?.[1] ?? null;
}

/** May this person enter the organisation console at all? */
export function admitsToOrgConsole(user: OrgHolder & { role: string } | null | undefined): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;

  return Boolean(user.organisationId) && holdsFeature(user, "core", ...ALL_FEATURES);
}

/** May this person open the console page at this path? */
export function mayOpenOrgPage(user: OrgHolder & { role: string } | null | undefined, pathname: string): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;
  if (!user.organisationId) return false;

  const features = orgFeaturesFor(pathname);

  return features !== null && holdsFeature(user, "core", ...features);
}
