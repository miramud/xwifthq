/**
 * What a signed-in person may do across the suite, as the API computed it.
 *
 * The API sends `capabilities` on the session user (`/auth/me`, login,
 * account update), computed by `App\Suite\Core\Support\Capabilities` — the
 * same functions its route guards and policies enforce with. This module only
 * *reads* them. It deliberately does not re-derive them from `role` or
 * `permissions`: what a person's roles add up to is the API's to say, and a
 * rule mirrored in TypeScript is one that drifts.
 *
 * **This is presentation.** A hidden link is a convenience; the API refuses a
 * hand-typed URL whatever this returns.
 *
 * Its own module so the browser store, the `server-only` helpers and a test
 * can all import one implementation.
 */

export interface Capabilities {
  /** The platform owner (super admin). The only person who sees across tenants. */
  isPlatformOwner: boolean;
  /** Runs HR: a role gives them HR's employees organisation-wide. */
  hrmManage: boolean;
  /** Leads delivery: a role lets them start projects organisation-wide (or the institution admin). */
  projectsLead: boolean;
  /** Moves work on any board in the institution. True for everybody `projectsLead` is true for. */
  projectsEngineeringLead: boolean;
  /** Runs the LMS console: a role lets them manage courses organisation-wide. */
  lmsAdmin: boolean;
  /** Teaches: may open the teaching studio. Optional for sessions stored before it was sent. */
  lmsInstructor?: boolean;
  /** Has My team: a role gives them the line manager's work at My reports (the reporting line gives it). */
  hrmLeadsTeam?: boolean;
  /** Has a current employment record here: My employment is theirs. */
  hrmEmployed?: boolean;
  /**
   * Holds a role with the Organisation admin setting - the admin, since the
   * base Admin role retired (roles redesign, phase 3b). The session's `role`
   * still reads `admin` for them, derived from this.
   */
  organisationAdmin?: boolean;
}

export type Capability = keyof Capabilities;

/** The little a caller has to know about a user to answer the question. */
export interface CapabilityHolder {
  /**
   * Optional: a session stored before capabilities existed carries none, and
   * that has to read as "may do none of these" rather than throw.
   */
  capabilities?: Partial<Capabilities> | null;
}

/**
 * May this user do this?
 *
 * False for no user, for a session without capabilities, and for anything
 * the API did not say `true` to — an absent answer is never a yes.
 */
export function can(
  user: CapabilityHolder | null | undefined,
  capability: Capability,
): boolean {
  return user?.capabilities?.[capability] === true;
}

/** Every capability false: the answer for nobody signed in. */
export const NO_CAPABILITIES: Capabilities = Object.freeze({
  isPlatformOwner: false,
  hrmManage: false,
  projectsLead: false,
  projectsEngineeringLead: false,
  lmsAdmin: false,
  lmsInstructor: false,
  hrmLeadsTeam: false,
  hrmEmployed: false,
  organisationAdmin: false,
});
