/**
 * Which of the suite's modules an organisation has switched on.
 *
 * The platform owner activates modules per organisation, by hand (the owner's
 * ruling of 26 September 2026 — payment-based activation exists in the code
 * but is not switched on). A module that is not active is a **preview** for
 * everybody in the organisation: its routes answer 403 on the API, its pages
 * redirect to `/suite/preview/{module}` here, and every menu shows it with a
 * "Preview" badge that opens that page.
 *
 * The session carries the answer (`GET /api/auth/me` → `modules`). This file
 * only reads it. It is shared by server layouts and client components, so it
 * imports nothing that is client- or server-only.
 *
 * Two readings are deliberate:
 * - **No `modules` on the session** (one stored before this shipped) reads as
 *   active for LMS, HRM and Projects. Locking somebody out on a stale session
 *   would be worse than showing a door the API then refuses.
 * - **Unreleased modules** are previews whatever an organisation holds. The
 *   session says which (`released` on each module, from the platform's
 *   `SUITE_UNRELEASED` setting, 5 Oct 2026); a session that doesn't say is
 *   released - every module is complete since 9 Oct 2026.
 */

export type SuiteModuleKey = "lms" | "hrm" | "projects" | "finance" | "admin";
export type ModuleStatus = "active" | "preview";

export interface SessionModule {
  key: SuiteModuleKey;
  label: string;
  status: ModuleStatus;
  /** False while the module is still being built (a preview for everybody). */
  released?: boolean;
}

export const SUITE_MODULES: readonly SuiteModuleKey[] = ["lms", "hrm", "projects", "finance", "admin"];

export const MODULE_LABEL: Record<SuiteModuleKey, string> = {
  lms: "Learning",
  hrm: "HR",
  projects: "Projects",
  finance: "Finance",
  admin: "Operations",
};

/** Unreleased when the session does not say: none since every module shipped (9 Oct 2026). */
const UNRELEASED_BY_DEFAULT: readonly SuiteModuleKey[] = [];

/** Still being built: a preview for everybody, whatever an organisation holds. */
export function isUnreleased(user: ModuleHolder | null | undefined, key: SuiteModuleKey): boolean {
  const listed = user?.modules?.find((m) => m.key === key);
  if (listed && typeof listed.released === "boolean") return !listed.released;
  return UNRELEASED_BY_DEFAULT.includes(key);
}

interface ModuleHolder {
  role?: string;
  organisationId?: string | null;
  modules?: SessionModule[] | null;
}

export function previewHref(key: SuiteModuleKey): string {
  return `/suite/preview/${key}`;
}

export function moduleStatus(user: ModuleHolder | null | undefined, key: SuiteModuleKey): ModuleStatus {
  if (isUnreleased(user, key)) return "preview";
  if (!user) return "active";

  // The platform's own people navigate every module; the API decides the rest.
  if (user.role === "super_admin" || user.role === "platform_staff") return "active";

  // A self-serve learner belongs to no organisation: the public catalogue is
  // theirs, and nothing else is.
  if (!user.organisationId) return key === "lms" ? "active" : "preview";

  const listed = user.modules?.find((m) => m.key === key);
  if (!user.modules || !listed) return user.modules ? "preview" : "active";
  return listed.status;
}

export function isModuleActive(user: ModuleHolder | null | undefined, key: SuiteModuleKey): boolean {
  return moduleStatus(user, key) === "active";
}
