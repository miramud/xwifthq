"use client";

import { Activity, BarChart3, ClipboardCheck, Inbox, ListChecks, PiggyBank, Receipt } from "lucide-react";
import { Panel } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";

/*
  The kit Panel for the preview dashboards, which are Server Components: a
  lucide icon is a function and cannot cross into a Client Component as a
  prop, so the preview pages name their icon instead.
*/
const ICONS = { Activity, BarChart3, ClipboardCheck, Inbox, ListChecks, PiggyBank, Receipt };

export function PreviewPanel({
  icon,
  ...rest
}: Omit<React.ComponentProps<typeof Panel>, "icon"> & { icon: keyof typeof ICONS; hue?: Hue }) {
  return <Panel icon={ICONS[icon]} {...rest} />;
}
