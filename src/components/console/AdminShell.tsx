"use client";

import { usePathname } from "next/navigation";
import {
  Award,
  Briefcase,
  BookOpen,
  ChartLine,
  CloudUpload,
  Gavel,
  Globe,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Plug,
  Palette,
  Route,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Ticket,
  Trophy,
  Users,
  Trash2,
  KeyRound,
  Mail,
  CreditCard,
  Stamp,
  Building2,
  FolderTree,
  Handshake,
  ListOrdered,
  FileCheck2,
} from "lucide-react";
import { openModuleItems, previewModuleItems } from "@/components/workspace/moduleNav";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import ConsoleRefused from "@/components/shared/ConsoleRefused";
import { isAdminRole, mayOpenOrgPage } from "@/lib/org-access";
import { landingFor } from "@/lib/roles";

/**
 * The two administrative consoles — Learning (`/suite/lms`) and Organisation
 * (`/suite/org`) — worn inside the workspace shell.
 *
 * They used to share one long rail. They are different jobs: running the
 * catalogue and its learners, and running the institution itself (people,
 * seats, branding, policy). Each now has its own navigation, and the suite
 * switcher moves between them like any other module.
 *
 * What either console can actually read is decided by tenant isolation in the
 * API, not by these lists.
 */

const platformOwner = (u: AuthUser | null) => u?.role === "super_admin";
/*
  Integrations are one organisation's own Slack app and WhatsApp number, so
  the platform owner — who belongs to no organisation — has none to set.
*/
const orgAdmin = (u: AuthUser | null) =>
  Boolean(u?.organisationId) && (u?.role === "admin" || u?.role === "super_admin");
/*
  Branding, policies and seats are one organisation's own. The platform owner
  belongs to none, so those pages could only tell them so; leave them off the
  menu instead of offering a page whose whole content is a refusal.
*/
const inOrganisation = (u: AuthUser | null) => Boolean(u?.organisationId);

/*
  S8: somebody who is not an admin is in this console because a custom role
  holds `core.*` keys (the Auditor, Billing manager, Support desk). Each page
  is offered to them only when they hold a key of what it answers to - the
  same table the server layout admits them by (`@/lib/org-access`). Admins
  keep the rule each item had before (`base`).
*/
const page =
  (href: string, base?: (u: AuthUser | null) => boolean) =>
  (u: AuthUser | null) =>
    isAdminRole(u) ? (base ? base(u) : true) : mayOpenOrgPage(u, href);
/* Managing the organisation's admins stays with organisation admins. */
const orgAdminOnly = (u: AuthUser | null) => u?.role === "admin";

const LMS_NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [{ label: "Overview", href: "/suite/lms", icon: LayoutDashboard, exact: true }],
  },
  {
    heading: "Catalogue",
    items: [
      { label: "Courses", href: "/suite/lms/courses", icon: BookOpen },
      { label: "Learning paths", href: "/suite/lms/learning-paths", icon: Route },
      { label: "Categories", href: "/suite/lms/categories", icon: Tags },
      { label: "Reviews", href: "/suite/lms/reviews", icon: Star },
      { label: "Certificates", href: "/suite/lms/certificates", icon: Award },
    ],
  },
  {
    heading: "Learners",
    items: [
      { label: "Progress", href: "/suite/lms/progress", icon: ChartLine },
      { label: "Compliance", href: "/suite/lms/compliance", icon: ShieldCheck },
      { label: "Leaderboards", href: "/suite/lms/leaderboards", icon: Trophy },
      { label: "Instructors", href: "/suite/lms/instructors", icon: GraduationCap },
    ],
  },
];

export const ORG_NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [{ label: "Overview", href: "/suite/org", icon: LayoutDashboard, exact: true, show: page("/suite/org") }],
  },
  {
    // Which suite modules this organisation has on, and which are previews.
    heading: "Modules",
    items: [
      ...openModuleItems((m) => Boolean(m.suiteModule) && m.key !== "learn"),
      ...previewModuleItems(),
    ],
  },
  {
    heading: "Platform",
    items: [
      // Tenants, revenue and governance moved to the platform console (26 Sep 2026).
      { label: "Platform console", href: "/suite/platform", icon: Globe, show: platformOwner },
    ],
  },
  {
    heading: "User management",
    items: [
      { label: "Users", href: "/suite/org/users", icon: Users, show: page("/suite/org/users") },
      { label: "Roles & permissions", href: "/suite/org/roles", icon: KeyRound, show: page("/suite/org/roles") },
      { label: "Job titles", href: "/suite/org/job-titles", icon: Briefcase, show: page("/suite/org/job-titles") },
    ],
  },
  {
    // The organisation's shared foundations (5 Oct 2026): every module reads them.
    heading: "Organisation",
    items: [
      { label: "Profile", href: "/suite/org/profile", icon: Building2, show: page("/suite/org/profile", inOrganisation) },
      { label: "Structure", href: "/suite/org/structure", icon: FolderTree, show: page("/suite/org/structure", inOrganisation) },
      { label: "Clients & vendors", href: "/suite/org/counterparties", icon: Handshake, show: page("/suite/org/counterparties", inOrganisation) },
      { label: "Reference numbering", href: "/suite/org/numbering", icon: ListOrdered, show: page("/suite/org/numbering", inOrganisation) },
      { label: "Issued documents", href: "/suite/org/documents", icon: FileCheck2, show: page("/suite/org/documents", inOrganisation) },
    ],
  },
  {
    heading: "Support & seats",
    items: [
      { label: "Support", href: "/suite/org/messages", icon: LifeBuoy, show: page("/suite/org/messages") },
      { label: "Plan & billing", href: "/suite/org/billing", icon: CreditCard, show: page("/suite/org/billing", orgAdmin) },
      { label: "Seats", href: "/suite/org/seats", icon: Ticket, show: page("/suite/org/seats", inOrganisation) },
    ],
  },
  {
    heading: "Institution",
    items: [
      { label: "Branding", href: "/suite/org/branding", icon: Palette, show: page("/suite/org/branding", inOrganisation) },
      { label: "Media storage", href: "/suite/org/media", icon: CloudUpload, show: page("/suite/org/media") },
      { label: "Integrations", href: "/suite/org/integrations", icon: Plug, show: page("/suite/org/integrations", orgAdmin) },
      { label: "Email delivery", href: "/suite/org/email", icon: Mail, show: page("/suite/org/email", orgAdmin) },
      { label: "Policies", href: "/suite/org/policies", icon: Gavel, show: page("/suite/org/policies", inOrganisation) },
      { label: "Approvals", href: "/suite/org/approvals", icon: Stamp, show: page("/suite/org/approvals", inOrganisation) },
      { label: "Audit & health", href: "/suite/org/audit", icon: ShieldCheck, show: page("/suite/org/audit") },
      { label: "Recycle bin", href: "/suite/org/recycle-bin", icon: Trash2, show: page("/suite/org/recycle-bin") },
      /*
        O3: Settings is the platform's (saving it needs the platform owner).
        An organisation admin's part of that page is its admin roster.
      */
      { label: "Admins", href: "/suite/org/settings", icon: Settings, show: orgAdminOnly },
      { label: "Settings", href: "/suite/org/settings", icon: Settings, show: platformOwner },
    ],
  },
];

const TITLES: WsTitle[] = [
  { match: "/suite/lms/courses/new", title: "New course" },
  { match: "/suite/lms/learning-paths/new", title: "New learning path" },
  { match: "/suite/org/users/", title: "User" },
  { match: "/suite/org/roles/new", title: "New role" },
  { match: "/suite/org/roles/", title: "Role" },
  { match: "/suite/org/approvals/policies/", title: "Approval rules" },
  { match: "/suite/org/counterparties/", title: "Client or vendor" },
  { match: "/suite/org/billing/return", title: "Module payment" },
  { match: "/suite/org/billing/receipts/", title: "Receipt" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isOrg = pathname.startsWith("/suite/org");
  const { user, loading } = useAuth();

  /*
    A key holder (S8) who follows a link to a console page their roles do not
    reach is told so in place, not shown a page that only ever refuses. Admins
    are never refused here; the API stays the real gate either way.
  */
  const keyHolder = isOrg && user !== null && !isAdminRole(user);
  const refused = keyHolder && !mayOpenOrgPage(user, pathname);

  return (
    <WorkspaceShell module={isOrg ? "org" : "lms"} nav={isOrg ? ORG_NAV : LMS_NAV} titles={TITLES}>
      {isOrg && loading ? null : refused && user !== null ? (
        <ConsoleRefused
          inline
          console="Organisation console"
          who="your organisation's admins"
          home={landingFor(user)}
        />
      ) : (
        children
      )}
    </WorkspaceShell>
  );
}
