"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Route,
  Settings,
  Star,
  Users,
} from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import { questions } from "@/lib/api/instructor-client";

/**
 * The teaching studio's navigation, worn inside the workspace shell.
 *
 * The one thing this shell adds is the Q&A badge: unanswered learner
 * questions, refreshed every minute, because a question left a week is a
 * learner who stopped.
 */

const TITLES: WsTitle[] = [
  { match: "/suite/lms/teach/courses/new", title: "Create a course", exact: true },
  { match: "/suite/lms/teach/messages", title: "Q&A inbox" },
];

export default function InstructorShell({ children }: { children: React.ReactNode }) {
  const [qaBadge, setQaBadge] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      questions
        .unansweredCount()
        .then((n: number) => {
          if (alive) setQaBadge(n);
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const nav = useMemo<WsNavGroup[]>(
    () => [
      {
        heading: "Teach",
        items: [
          { label: "Overview", href: "/suite/lms/teach", icon: LayoutDashboard, exact: true },
          { label: "My courses", href: "/suite/lms/teach/courses", icon: BookOpen },
          { label: "Learning paths", href: "/suite/lms/teach/learning-paths", icon: Route },
          { label: "Students", href: "/suite/lms/teach/students", icon: Users },
        ],
      },
      {
        heading: "Engage",
        items: [
          { label: "Reviews", href: "/suite/lms/teach/reviews", icon: Star },
          { label: "Q&A", href: "/suite/lms/teach/messages", icon: MessageSquare, badge: qaBadge || undefined },
          { label: "Analytics", href: "/suite/lms/teach/analytics", icon: BarChart3 },
          { label: "Announcements", href: "/suite/lms/teach/announcements", icon: Megaphone },
        ],
      },
      {
        heading: "Account",
        items: [{ label: "Settings", href: "/suite/lms/teach/settings", icon: Settings }],
      },
    ],
    [qaBadge],
  );

  return (
    <WorkspaceShell module="teach" nav={nav} titles={TITLES}>
      {children}
    </WorkspaceShell>
  );
}
