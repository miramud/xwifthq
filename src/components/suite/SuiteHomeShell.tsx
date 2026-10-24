"use client";

import { LayoutGrid } from "lucide-react";
import WorkspaceShell, { type WsNavGroup } from "@/components/workspace/WorkspaceShell";
import { openModuleItems, previewModuleItems } from "@/components/workspace/moduleNav";

/**
 * The suite home and the module preview pages, worn inside the workspace shell.
 *
 * The sidebar is one list of doors: every module this person can open (the
 * same `availability` the switcher uses, so nobody is shown a door onto a
 * 403), then every module their organisation has only as a preview, named as
 * a preview in the nav itself, not only on the page. Finance and Admin are
 * always previews; the others are whenever the platform owner hasn't switched
 * them on for this organisation.
 */
const NAV: WsNavGroup[] = [
  {
    heading: "Suite",
    items: [{ label: "Suite home", href: "/suite", icon: LayoutGrid, exact: true }],
  },
  { heading: "Your modules", items: openModuleItems() },
  /*
    Modules this organisation hasn't switched on, for everybody in it. Each
    opens its preview page; the platform owner is who switches it on.
  */
  { heading: "Previews", items: previewModuleItems() },
];

export default function SuiteHomeShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="home" nav={NAV}>
      {children}
    </WorkspaceShell>
  );
}
