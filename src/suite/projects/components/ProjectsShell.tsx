"use client";

import { BellRing, Building2, FolderTree, LayoutDashboard, ListTodo, Plug, Sparkles, Wallet } from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";

/**
 * The Projects module's navigation, worn inside the workspace shell.
 *
 * Two different gates, and the shell answers neither on its own: the module
 * gate says "your institution is entitled to Projects", and `ProjectPolicy`
 * answers "may you touch this one". Rates and AI are shown to everybody and
 * refused by the API to anybody who may not read them — hiding them here
 * would be the only place in the module where the nav carries authority, and
 * a nav that lies about what exists is worse than a 403 that explains itself.
 */

const NAV: WsNavGroup[] = [
  {
    heading: "Delivery",
    items: [
      { label: "Projects", href: "/suite/projects", icon: LayoutDashboard, exact: true },
      { label: "Portfolios", href: "/suite/projects/portfolios", icon: FolderTree },
      { label: "External companies", href: "/suite/projects/companies", icon: Building2 },
    ],
  },
  {
    heading: "Mine",
    items: [
      { label: "My work", href: "/suite/projects/me", icon: ListTodo },
      /*
        Here as well as under HRM. Most people on a project hold no HR
        role, so the only way to the switches — and to turning on
        Slack or WhatsApp — was a menu they never see.
      */
      { label: "My notifications", href: "/suite/projects/notifications", icon: BellRing },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Rates", href: "/suite/projects/rates", icon: Wallet },
      { label: "AI", href: "/suite/projects/ai", icon: Sparkles },
      /*
        The same board as /suite/org/integrations. Delivery leads may connect
        Slack and WhatsApp (Capabilities::projectsLead) but cannot enter the
        org console, so without this they had no way to reach it.
      */
      { label: "Integrations", href: "/suite/projects/integrations", icon: Plug },
    ],
  },
];

const TITLES: WsTitle[] = [
  // Any /suite/projects/{slug} that is not one of the named pages above.
  { match: "/suite/projects/", title: "Project" },
];

export default function ProjectsShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="projects" nav={NAV} titles={TITLES} requiresOrganisation="Projects">
      {children}
    </WorkspaceShell>
  );
}
