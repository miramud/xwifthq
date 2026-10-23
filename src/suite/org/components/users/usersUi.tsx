import { Chip } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { BASE_ROLE_KEYS, type OrgRole, type OrgUser, type OrgUserStatus } from "@/lib/api/users-client";

/** One colour per role, the same on the list, the card and the profile. */
export const ROLE_HUE: Record<OrgRole, Hue> = {
  admin: "grape",
  user: "blue",
};

export const ROLE_NAME: Record<OrgRole, string> = {
  admin: "Admin",
  user: "User",
};

export function RoleChip({ role, label }: { role: OrgRole; label?: string }) {
  return <Chip hue={ROLE_HUE[role]}>{label ?? ROLE_NAME[role]}</Chip>;
}

export function StatusPill({ status }: { status: OrgUserStatus }) {
  return status === "invited" ? (
    <Chip hue="sun" dot>
      Invited
    </Chip>
  ) : (
    <Chip hue="mint" dot>
      Active
    </Chip>
  );
}

/**
 * The roles a user holds besides the built-in User role. The API lists that
 * among `roles` too (it is a system role); their role chip already stands for it.
 */
export function extraRoles(u: Pick<OrgUser, "roles" | "roleLabel">): OrgUser["roles"] {
  return (u.roles ?? []).filter((r) => {
    if (r.kind !== "system") return true;
    // Identified by key where the API sends one; by name for older payloads.
    if (r.systemKey) return !BASE_ROLE_KEYS.includes(r.systemKey);
    return r.name !== u.roleLabel;
  });
}

/** Built-in roles in slate, this organisation's custom roles in grape. */
export function RoleChips({ roles, max = 2 }: { roles: OrgUser["roles"]; max?: number }) {
  if (roles.length === 0) return <span className="text-xs text-neutral-500">None</span>;
  const shown = roles.slice(0, max);
  const rest = roles.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((r) => (
        <Chip key={r.id} hue={r.kind === "custom" ? "grape" : "slate"}>
          {r.name}
        </Chip>
      ))}
      {rest > 0 && (
        <Chip hue="slate">
          <span aria-hidden>+{rest}</span>
          <span className="sr-only">and {rest} more</span>
        </Chip>
      )}
    </span>
  );
}
