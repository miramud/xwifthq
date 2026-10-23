/**
 * Does this person hold a permission key?
 *
 * The session carries `permissions`: every `module.feature.action` key the
 * built-in User role and the roles the person holds add up to, computed by the
 * API (`PermissionResolver`). Roles are the only way anybody reaches a console
 * page - the HR manager, the HR officer, the auditor - so a screen deciding
 * whether to render a link asks this, by feature.
 *
 * **This is presentation.** The route guards are the check
 * (`Access\PermissionGate`), and a hand-typed URL is refused by them whatever
 * this returns. Its own module, like `@/lib/capabilities`, so a layout, a
 * client component and a test can all reach the one implementation.
 */

export interface PermissionHolder {
  role: string;
  /** Optional: a session stored before permissions existed carries none. */
  permissions?: string[];
}

/**
 * Holds any key of any of these features, e.g. `holdsFeature(u, "hrm",
 * "recruitment")` for `hrm.recruitment.*`.
 */
export function holdsFeature(
  user: PermissionHolder | null | undefined,
  module: string,
  ...features: string[]
): boolean {
  if (!user || features.length === 0) return false;

  const prefixes = features.map((feature) => `${module}.${feature}.`);

  return (user.permissions ?? []).some((key) => prefixes.some((prefix) => key.startsWith(prefix)));
}

/** Holds any key in the module at all, e.g. any `core.*`. */
export function holdsModule(user: PermissionHolder | null | undefined, module: string): boolean {
  if (!user) return false;

  return (user.permissions ?? []).some((key) => key.startsWith(`${module}.`));
}
