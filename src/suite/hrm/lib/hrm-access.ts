import { can, type CapabilityHolder } from "@/lib/capabilities";
import { holdsFeature, type PermissionHolder } from "@/lib/permissions";

/**
 * Which HR management pages a person may open, by permission key.
 *
 * A page opens when the person holds, organisation-wide, a key of the feature
 * that page's API answers to - an HR officer's `hrm.employees.*` opens the
 * Directory, a recruiter's `hrm.recruitment.*` opens Recruitment - because
 * that is exactly what `access:hrm` lets them through on (`HrmAccess`; roles
 * redesign, phase 3a). The HR Management Lead holds every key, so every page
 * opens for them; the session's `permissions` carry what each role gives.
 * Gating on `hrmManage` instead would offer every page to anybody holding any
 * HR key, and teach the rest through 403s.
 *
 * Shared by the nav (`HrmShell`) and the page gate (`ManagerOnly`), so the
 * link and the page can never disagree. Presentation only: the API decides.
 */

type HrmHolder = PermissionHolder & CapabilityHolder;

/** Path prefix -> the HRM features whose keys open it. Longest prefix wins. */
export const HRM_PAGE_FEATURES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["/suite/hrm/people", ["employees", "personal_records"]],
  ["/suite/hrm/onboarding", ["onboarding"]],
  ["/suite/hrm/probation", ["probation"]],
  ["/suite/hrm/recruitment", ["recruitment"]],
  ["/suite/hrm/renewals", ["contracts"]],
  ["/suite/hrm/timesheets", ["timesheets"]],
  ["/suite/hrm/tasks", ["tasks"]],
  ["/suite/hrm/leave", ["leave"]],
  ["/suite/hrm/roster", ["attendance"]],
  ["/suite/hrm/attendance", ["attendance"]],
  ["/suite/hrm/payroll", ["payroll"]],
  ["/suite/hrm/performance", ["performance"]],
  ["/suite/hrm/reviews", ["reviews"]],
  ["/suite/hrm/contracts", ["contracts"]],
  ["/suite/hrm/internships", ["internships"]],
  ["/suite/hrm/relations", ["relations"]],
  ["/suite/hrm/workforce", ["workforce"]],
  ["/suite/hrm/leavers", ["offboarding"]],
  // HR's roles board answers to the keys "Who does what" did.
  ["/suite/hrm/roles", ["designations"]],
];

/** The HR overview, `/suite/hrm` itself. */
const OVERVIEW_FEATURES = ["overview"] as const;

/** The features a management page answers to, or null for one nobody maps. */
export function hrmFeaturesFor(pathname: string): readonly string[] | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/suite/hrm") return OVERVIEW_FEATURES;

  let best: readonly [string, readonly string[]] | null = null;

  for (const entry of HRM_PAGE_FEATURES) {
    if ((path === entry[0] || path.startsWith(`${entry[0]}/`)) && (best === null || entry[0].length > best[0].length)) {
      best = entry;
    }
  }

  return best?.[1] ?? null;
}

/** My team (S9): the line manager's pages, under this prefix. */
export const TEAM_PREFIX = "/suite/hrm/team";

/** Is this one of the My team pages? */
export function isTeamPage(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return path === TEAM_PREFIX || path.startsWith(`${TEAM_PREFIX}/`);
}

/**
 * Leads a team: holds the line manager's work at My reports - the Line Manager
 * role, which the reporting line gives with a first direct report (S9). The
 * API says so (`hrmLeadsTeam`); an admin or HR lead with nobody reporting to
 * them gets no empty My team in their menu.
 */
export function leadsTeam(user: HrmHolder | null | undefined): boolean {
  return can(user, "hrmLeadsTeam");
}

/** May this person open My team? Whoever leads a team. */
export function mayOpenTeam(user: HrmHolder | null | undefined): boolean {
  return leadsTeam(user);
}

/** May this person open the HR management page at this path? */
export function mayOpenHrmPage(user: HrmHolder | null | undefined, pathname: string, features?: readonly string[]): boolean {
  if (isTeamPage(pathname)) return mayOpenTeam(user);

  const wanted = features ?? hrmFeaturesFor(pathname);

  return wanted !== null && holdsFeature(user, "hrm", ...wanted);
}
