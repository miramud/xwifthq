"use client";

import { BellRing, Mail, ShieldCheck, SlidersHorizontal } from "lucide-react";
import NotificationPreferencesPane from "@/components/shared/NotificationPreferencesPane";
import { PageHeader, Panel, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";

/*
  The HR notifications page in the workspace layout. The switches themselves
  are the shared pane, untouched — this only gives it the page's header and a
  side column that says what the switches do and do not control.
*/

const FACTS: { icon: typeof Mail; hue: Hue; title: string; body: string }[] = [
  {
    icon: BellRing,
    hue: "coral",
    title: "Every switch is real",
    body: "Each one turns an actual message on or off. Nothing here is decoration.",
  },
  {
    icon: SlidersHorizontal,
    hue: "sky",
    title: "What you see depends on what you do",
    body: "Switches appear as you are given work that sends notifications — a panel, a team, a rota.",
  },
  {
    icon: ShieldCheck,
    hue: "mint",
    title: "An admin can switch one off for everyone",
    body: "When that happens the switch says so, because your setting alone will not bring it back.",
  },
];

export function MyNotificationsPage({
  title,
  subtitle,
  eyebrow = "My employment",
}: {
  title: string;
  subtitle: string;
  /** Which module the page is reached from; Projects mounts it too. */
  eyebrow?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <NotificationPreferencesPane title="Your switches" subtitle="Turn each message on or off." />
        </div>
        <Panel title="How this works" icon={Mail} hue="grape" bodyClassName="px-5 pb-5 pt-3">
          <ul className="space-y-4">
            {FACTS.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[f.hue].soft)}>
                  <f.icon size={16} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">{f.title}</span>
                  <span className="block text-xs text-neutral-500">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
