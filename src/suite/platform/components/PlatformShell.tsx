"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Inbox,
  Blocks,
  Building2,
  CreditCard,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  Trash2,
  Tags,
  UserCog,
  Webhook,
} from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import { allows, canPlatform, PERM } from "@/suite/platform/access";
import { useAuth } from "@/lib/auth-store";
import { platformSalesRequests } from "@/lib/api/platform-billing-client";

/**
 * The platform console: everything the platform owner runs that no single
 * organisation owns: tenants and their modules, money in and out, the
 * people who operate the platform, and the record of what everybody did.
 *
 * Each item shows only to someone who can use it. The super admin sees all
 * of it; platform staff see what their platform roles grant.
 */
function navFor(newRequests: number): WsNavGroup[] {
  return [
    {
      heading: "General",
      items: [{ label: "Overview", href: "/suite/platform", icon: LayoutDashboard, exact: true, show: allows(PERM.overview) }],
    },
    {
      heading: "Tenants",
      items: [
        { label: "Organisations", href: "/suite/platform/organisations", icon: Building2, show: allows(PERM.organisationsView) },
        { label: "Modules", href: "/suite/platform/modules", icon: Blocks, show: allows(PERM.modulesView) },
      ],
    },
    {
      heading: "Analytics",
      items: [
        { label: "Usage", href: "/suite/platform/analytics/usage", icon: BarChart3, show: allows(PERM.analytics) },
        { label: "Performance", href: "/suite/platform/analytics/performance", icon: Gauge, show: allows(PERM.analytics) },
      ],
    },
    {
      heading: "Commerce",
      items: [
        { label: "Sales", href: "/suite/platform/sales", icon: Receipt, show: allows(PERM.sales) },
        { label: "Revenue portfolio", href: "/suite/platform/portfolio", icon: PieChart, show: allows(PERM.sales) },
        { label: "Payments", href: "/suite/platform/payments", icon: CreditCard, show: allows(PERM.paymentsView) },
        { label: "Pricing", href: "/suite/platform/pricing", icon: Tags, show: allows(PERM.sales) },
        {
          label: "Sales requests",
          href: "/suite/platform/sales-requests",
          icon: Inbox,
          show: allows(PERM.sales),
          badge: newRequests > 0 ? newRequests : undefined,
        },
        { label: "Payment gateway", href: "/suite/platform/settings/payments", icon: Webhook, show: allows(PERM.settings) },
        { label: "Email delivery", href: "/suite/platform/settings/email", icon: Mail, show: allows(PERM.settings) },
      ],
    },
    {
      heading: "Access",
      items: [
        { label: "System users", href: "/suite/platform/users", icon: UserCog, show: allows(PERM.usersView) },
        { label: "Roles & permissions", href: "/suite/platform/roles", icon: KeyRound, show: allows(PERM.rolesView) },
      ],
    },
    {
      heading: "Governance",
      items: [
        { label: "Audit log", href: "/suite/platform/audit", icon: ScrollText, show: allows(PERM.audit) },
        { label: "Platform settings", href: "/suite/platform/settings", icon: Settings, exact: true, show: allows(PERM.settings) },
        { label: "Support tickets", href: "/suite/platform/support", icon: LifeBuoy, show: allows(PERM.support) },
        { label: "Recycle bin", href: "/suite/platform/recycle-bin", icon: Trash2, show: allows(PERM.binView) },
      ],
    },
  ];
}

const TITLES: WsTitle[] = [
  { match: "/suite/platform/organisations/", title: "Organisation" },
  { match: "/suite/platform/roles/new", title: "New platform role" },
  { match: "/suite/platform/roles/", title: "Platform role" },
  { match: "/suite/platform/settings/payments", title: "Payment gateway" },
  { match: "/suite/platform/settings/email", title: "Email delivery" },
];

/**
 * How many sales requests are still new, for the badge beside "Sales
 * requests". Read once per console visit: a request arriving mid-session
 * shows on the next page load, which is soon enough for a sales pipeline.
 */
function useNewSalesRequests(): number {
  const { user } = useAuth();
  const allowed = canPlatform(user, PERM.sales);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    platformSalesRequests
      .list({ status: "new", page: 1 })
      .then((r) => {
        if (alive) setCount(r.meta.total);
      })
      .catch(() => {
        // The badge is a convenience; the page itself reports a failed load.
      });
    return () => {
      alive = false;
    };
  }, [allowed]);

  return allowed ? count : 0;
}

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const newRequests = useNewSalesRequests();
  const nav = useMemo(() => navFor(newRequests), [newRequests]);
  return (
    <WorkspaceShell module="platform" nav={nav} titles={TITLES}>
      {children}
    </WorkspaceShell>
  );
}
