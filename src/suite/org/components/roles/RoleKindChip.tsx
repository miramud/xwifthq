import { KeyRound, LayoutTemplate, Lock, Sprout, type LucideIcon } from "lucide-react";
import { Chip } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import type { Role } from "@/lib/api/roles-client";

const MODULE_LABEL: Record<string, string> = {
  core: "Organisation",
  projects: "Projects",
  hrm: "HR",
  lms: "Learning",
};

type KindOf = Pick<Role, "kind" | "starter" | "seeded">;

/**
 * Built in (read-only, derived from the routes), Seeded (one of the roles
 * every organisation is set up with, editable), Ready-made (a starter role
 * this organisation was given and may edit), or Custom (one it made itself).
 */
export function roleKind(r: KindOf): { label: string; hue: Hue; icon: LucideIcon } {
  if (r.kind === "system") return { label: "Built in", hue: "slate", icon: Lock };
  if (r.seeded) return { label: "Seeded", hue: "blue", icon: Sprout };
  if (r.starter) return { label: "Ready-made", hue: "sky", icon: LayoutTemplate };
  return { label: "Custom", hue: "grape", icon: KeyRound };
}

export function moduleLabel(module: string | null | undefined): string | null {
  return module ? (MODULE_LABEL[module] ?? module) : null;
}

export function RoleKindChip({ role }: { role: KindOf }) {
  const k = roleKind(role);
  return (
    <Chip hue={k.hue} icon={k.icon}>
      {k.label}
    </Chip>
  );
}
