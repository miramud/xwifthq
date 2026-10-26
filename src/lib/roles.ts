/**
 * The session's `role`, and the questions every screen asks of it.
 *
 * Every member of an organisation is a **User** (the base Admin role retired
 * in the roles redesign, phase 3b). An organisation admin is a User holding a
 * role with the Organisation admin setting; the API still presents their
 * `role` as `admin`. What anybody does beyond that - teach, run HR, lead
 * delivery - comes from the roles they hold, which the API sums up as
 * `capabilities` (designations were retired in the roles redesign, phase 3a).
 * `super_admin` (the platform owner) and `platform_staff` belong to no
 * organisation and never appear in an organisation's user list.
 *
 * Every learner-side screen is open to every member: an admin can take a
 * course too. What a *user* does not get is the admin console.
 *
 * Sessions stored before the change may still carry `student` or
 * `instructor`. They are read as `user` (and `instructor` still teaches)
 * rather than trusted or thrown on, so nobody is locked out by a stale tab;
 * the API is the check either way.
 */

import { can, type Capabilities } from "@/lib/capabilities";
import { isModuleActive, type SessionModule } from "@/lib/module-access";

export type BaseRole = "admin" | "user";
export type PlatformRole = "super_admin" | "platform_staff";
export type SessionRole = BaseRole | PlatformRole;

/** Roles a session may carry, including the retired values a stale session can still hold. */
export type AnySessionRole = SessionRole | "student" | "instructor";

export const BASE_ROLE_LABEL: Record<BaseRole, string> = {
  admin: "Admin",
  user: "User",
};

export const ROLE_LABEL: Record<SessionRole, string> = {
  ...BASE_ROLE_LABEL,
  super_admin: "Platform owner",
  platform_staff: "Platform staff",
};

interface RoleHolder {
  role: string;
  capabilities?: Partial<Capabilities> | null;
}

/** The session role with retired values folded in. */
export function normaliseRole(role: string | null | undefined): SessionRole | null {
  switch (role) {
    case "admin":
    case "user":
    case "super_admin":
    case "platform_staff":
      return role;
    case "student":
    case "instructor":
      return "user";
    default:
      return null;
  }
}

/**
 * Runs one organisation, or runs the platform. An organisation's admin holds a
 * role with the Organisation admin setting (phase 3b); the API reports their
 * `role` as `admin` and says so in `capabilities.organisationAdmin`.
 */
export function isAdminRole(user: RoleHolder | null | undefined): boolean {
  const role = normaliseRole(user?.role);
  return role === "admin" || role === "super_admin" || can(user, "organisationAdmin");
}

export function isPlatformPerson(user: RoleHolder | null | undefined): boolean {
  const role = normaliseRole(user?.role);
  return role === "super_admin" || role === "platform_staff";
}

/** May run the LMS console, as the API says (`lmsAdmin`); admins for a session without capabilities. */
export function administersLms(user: RoleHolder | null | undefined): boolean {
  if (!user) return false;
  if (user.capabilities && typeof user.capabilities.lmsAdmin === "boolean") return can(user, "lmsAdmin");
  return isAdminRole(user);
}

/** Holds a teaching role: may open the studio. A stale `instructor` session still counts. */
export function holdsStudio(user: RoleHolder | null | undefined): boolean {
  if (!user) return false;
  return user.role === "instructor" || can(user, "lmsInstructor");
}

/**
 * May open the teaching studio: a teaching role, or anybody who runs the LMS.
 * A stale `instructor` session still counts, so the change does not strand
 * somebody mid-lesson.
 */
export function teaches(user: RoleHolder | null | undefined): boolean {
  if (!user) return false;
  return holdsStudio(user) || administersLms(user);
}

export function roleLabel(role: string | null | undefined): string {
  const r = normaliseRole(role);
  return r ? ROLE_LABEL[r] : "User";
}

interface LandingHolder extends RoleHolder {
  organisationId?: string | null;
  modules?: SessionModule[] | null;
  /** On the team of any live project (the API works it out; see X4). */
  onProjectTeam?: boolean;
  /** An affiliate with no organisation lands on their affiliate dashboard. */
  affiliate?: { status: string } | null;
}

/**
 * Somebody whose daily work is in Projects (X4, 2 Oct 2026): whoever leads
 * delivery or moves work on every board, or anybody on a project team -
 * unless they run HR without leading delivery, in which case HR stays their
 * home. Line managers and employees on a project are project people; their
 * own employment is one click away in the menu.
 */
function isProjectPerson(user: LandingHolder): boolean {
  const leads = can(user, "projectsLead") || can(user, "projectsEngineeringLead");

  if (can(user, "hrmManage") && !leads) return false;

  return leads || user.onProjectTeam === true;
}

/**
 * Where somebody lands after signing in, when nothing asked for a particular
 * page (the owner's ruling of 26 September 2026):
 *
 *  - the platform owner and platform staff: the Platform console
 *  - an organisation's admin: the suite home
 *  - an organisation's user on a project team, or a delivery or engineering
 *    lead, who does not run HR: Projects (X4, 2 Oct 2026)
 *  - any other organisation's user: My employment
 *  - a self-serve learner, who belongs to no organisation: their courses
 *
 * My employment lives in HRM. When the organisation doesn't have HRM switched
 * on, that page would only bounce to the HRM preview, so a user lands in their
 * learning space instead, or on the suite home if the LMS is off too.
 */
export function landingFor(user: LandingHolder | null | undefined): string {
  if (!user) return "/my-courses";
  if (isPlatformPerson(user)) return "/suite/platform";
  // Somebody outside any organisation who is an affiliate came here for that.
  if (!user.organisationId && user.affiliate) return "/suite/affiliate";
  if (!user.organisationId) return "/my-courses";
  if (isAdminRole(user)) return "/suite";
  if (isModuleActive(user, "projects") && isProjectPerson(user)) return "/suite/projects";
  if (isModuleActive(user, "hrm")) return "/suite/hrm/me";
  if (isModuleActive(user, "lms")) return "/my-courses";
  return "/suite";
}
