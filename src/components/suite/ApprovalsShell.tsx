"use client";

import { LayoutGrid, NotebookPen, Stamp, UserCheck } from "lucide-react";
import WorkspaceShell, { type WsNavGroup } from "@/components/workspace/WorkspaceShell";
import { useApprovalCounts } from "@/suite/approvals/lib/useApprovalCounts";

/**
 * Approvals and memos, worn inside the suite home workspace.
 *
 * Approvals belong to no one module — a purchase order, a leave request and a
 * memo all land in the same inbox — so they sit beside the suite home rather
 * than inside HR or Projects, with a small nav of their own. The badge on
 * "Approvals" is what waits on you, from the same poll as the top bar.
 */
export default function ApprovalsShell({ children }: { children: React.ReactNode }) {
  const counts = useApprovalCounts(true);

  const nav: WsNavGroup[] = [
    { heading: "Suite", items: [{ label: "Suite home", href: "/suite", icon: LayoutGrid, exact: true }] },
    {
      heading: "Approvals",
      items: [
        { label: "Approvals", href: "/suite/approvals", icon: Stamp, badge: counts?.to_approve || undefined },
        { label: "My memos", href: "/suite/memos", icon: NotebookPen },
        { label: "My cover", href: "/suite/approvals/cover", icon: UserCheck },
      ],
    },
  ];

  return (
    <WorkspaceShell
      module="home"
      nav={nav}
      requiresOrganisation="Approvals"
      titles={[
        { match: "/suite/memos/new", title: "New memo", exact: true },
        { match: "/suite/memos/", title: "Memo" },
        { match: "/suite/approvals/cover", title: "My cover", exact: true },
        { match: "/suite/approvals/", title: "Request" },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
