/**
 * One place that turns an audit action key (`hrm.leave.approved`) into words
 * people read ("approved leave").
 *
 * The Overview feed, the Audit log and a user's profile all used to print the
 * raw key. The phrase is written to follow the actor's name ("Ada approved
 * leave"); `auditActionSentence` capitalises it for a column or a list where
 * it stands alone.
 *
 * The backend records some two hundred keys and new ones arrive with every
 * tranche, so only the ones the generic rule reads badly are spelled out
 * below. Everything else is derived: the module prefix is dropped, the
 * past-tense word becomes the verb and the rest the thing it happened to
 * (`projects.member_added` → "added member").
 */

const LABELS: Record<string, string> = {
  "team.demoted": "removed admin access from",
  "team.promoted": "made an admin of",
  "team.invited": "invited a new admin",
  "user.created": "added a person",
  "user.updated": "updated a person",
  "user.deleted": "deleted a person",
  "user.invite_resent": "resent an invitation to",
  "user.password_changed": "changed their password",
  "user.password_reset": "reset a password for",
  "user.password_reset_via_console": "reset a password from the console for",
  "account.updated": "updated their account",
  "settings.updated": "changed the platform settings",
  "designation.granted": "gave a designation to",
  "designation.revoked": "took a designation from",
  "hrm.line_manager.auto_granted": "gave the Line Manager role (first direct report) to",
  "hrm.line_manager.auto_revoked": "took the Line Manager role (no direct reports left) from",
  "role.created": "created a role",
  "role.updated": "changed a role",
  "role.deleted": "deleted a role",
  "role.duplicated": "duplicated a role",
  "recycle_bin.restored": "restored from the recycle bin",
  "recycle_bin.purged": "permanently deleted from the recycle bin",
  "recycle_bin.emptied": "emptied the recycle bin",
  "organisation.modules_changed": "changed the active modules",
  "organisation.branding_updated": "updated the branding",
  "organisation.policies_updated": "updated the policies",
  "organisation.seat_limit_changed": "changed the seat limit",
  "organisation.billing_period_changed": "changed the billing period",
  "student.bulk_imported": "imported learners",
  "student.provisioned": "added a learner",
  "hrm.employee.hired": "hired",
  "hrm.employee.left": "recorded the departure of",
  "hrm.employee.reinstated": "reinstated",
  "hrm.employee.manager_changed": "changed the manager of",
  "hrm.employee.personal_details_updated": "updated personal details for",
  "hrm.leave.requested": "requested leave",
  "hrm.time_entry.recorded_manually": "recorded time by hand",
  "hrm.time_policy.updated": "changed the time policy",
  "ticket.opened": "opened a support ticket",
  "ticket.created": "opened a support ticket",
  "ticket.closed_by_requester": "closed their support ticket",
  "onboarding.needs_attention": "flagged onboarding for attention",
};

/** Module prefixes that say where an event happened, not what it was. */
const MODULE_PREFIXES = new Set(["core", "hrm", "projects", "lms", "platform"]);

/** Past tenses that do not end in "-ed". */
const IRREGULAR = new Set(["reset", "sent", "set", "left", "run", "made", "taken", "given", "held", "read", "put"]);

const isVerb = (w: string) => IRREGULAR.has(w) || (w.length > 3 && w.endsWith("ed"));

/** "approved leave", "added member", "changed course status". */
export function auditActionLabel(action: string): string {
  const known = LABELS[action];
  if (known) return known;

  const parts = action.split(".").filter(Boolean);
  if (parts.length > 1 && MODULE_PREFIXES.has(parts[0])) parts.shift();

  const words = parts.flatMap((p) => p.split("_")).filter(Boolean);
  const at = words.findIndex(isVerb);

  if (at <= 0) {
    // No verb to lead with (or it is the only word): read the key as a phrase.
    return words.join(" ") || action;
  }

  const noun = words.slice(0, at).join(" ");
  const tail = words.slice(at + 1).join(" ");

  return [words[at], noun, tail].filter(Boolean).join(" ");
}

/** The same phrase standing on its own: "Approved leave". */
export function auditActionSentence(action: string): string {
  const label = auditActionLabel(action);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * What an event was about, read out of its `meta`, or null.
 *
 * `meta` is whatever the event recorded: an object (`{title, email, ...}`), a
 * string, or nothing. Rendering it directly crashed React when it was an
 * object, so only a short human name is ever pulled out of it.
 */
export function auditSubject(meta: unknown): string | null {
  if (typeof meta === "string") return meta.trim() || null;
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return null;

  const m = meta as Record<string, unknown>;
  for (const key of ["title", "name", "label", "email"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim() !== "") return v;
  }

  return null;
}
