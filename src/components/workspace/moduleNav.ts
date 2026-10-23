import type { WsNavItem } from "./WorkspaceShell";
import { WORKSPACE_MODULES, availability, hrefFor, type WorkspaceModule } from "./modules";

/**
 * Sidebar entries for the suite's modules, in the two states a menu shows.
 *
 * Each module appears twice in the list and `show` keeps exactly one of the
 * pair (or neither): the open door into the module, or the preview door with
 * its "Preview" badge. A static nav array can't know the viewer; `show` can.
 */
export function openModuleItems(filter: (m: WorkspaceModule) => boolean = () => true): WsNavItem[] {
  return WORKSPACE_MODULES.filter((m) => m.key !== "home" && m.listed !== false && filter(m)).map((m) => ({
    label: m.name,
    href: m.href,
    icon: m.icon,
    show: (u) => availability(m, u) === "open",
  }));
}

export function previewModuleItems(filter: (m: WorkspaceModule) => boolean = () => true): WsNavItem[] {
  return WORKSPACE_MODULES.filter((m) => m.suiteModule && m.listed !== false && filter(m)).map((m) => ({
    label: m.name,
    href: hrefFor(m, "preview"),
    icon: m.icon,
    badge: "Preview",
    badgeTone: "preview" as const,
    show: (u) => availability(m, u) === "preview",
  }));
}
