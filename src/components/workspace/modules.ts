import {
  BookOpenCheck,
  Building,
  Building2,
  FolderKanban,
  Globe,
  GraduationCap,
  Handshake,
  LayoutGrid,
  Presentation,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth-store";
import { administersLms, isAdminRole, isPlatformPerson, teaches } from "@/lib/roles";
import { isUnreleased, moduleStatus, previewHref, type SuiteModuleKey } from "@/lib/module-access";
import { admitsToOrgConsole } from "@/lib/org-access";

/**
 * The suite's modules, as the switcher and the shell see them.
 *
 * One list, so the switcher in the top bar, the launcher and each module's
 * own sidebar agree on a module's name, its colour and where it starts. Each
 * module owns a hue: it colours the module's tile in the switcher and the
 * small mark beside its name in the top bar, so somebody moving between HR
 * and Projects can tell at a glance which one they are in.
 *
 * `canOpen` is presentation only. Every route is refused by the API
 * regardless; this decides what to *offer*, so nobody is shown a door that
 * opens onto a 403.
 */

export type WorkspaceModuleKey =
  | "home"
  | "hrm"
  | "projects"
  | "lms"
  | "teach"
  | "learn"
  | "org"
  | "platform"
  | "affiliate"
  | "finance"
  | "admin";

export type Hue = "blue" | "coral" | "mint" | "grape" | "sun" | "sky" | "rose" | "slate";

export interface ModuleLink {
  label: string;
  href: string;
}

export interface WorkspaceModule {
  key: WorkspaceModuleKey;
  name: string;
  /** What it is for, in the switcher. */
  blurb: string;
  href: string;
  icon: LucideIcon;
  hue: Hue;
  /** The pages worth jumping straight to from the switcher. */
  links: ModuleLink[];
  canOpen: (user: AuthUser | null) => boolean;
  /**
   * False keeps the module out of the suite's menus: the Suites switcher, the
   * suite sidebar and the launcher. The module still exists and its own pages
   * still name it. Defaults to listed.
   */
  listed?: boolean;
  /**
   * The suite module this area belongs to. When the organisation has not
   * switched that module on, every menu offers the area as a preview instead
   * (see `availability`). Areas of the platform itself carry none.
   */
  suiteModule?: SuiteModuleKey;
}

/** Server-computed capabilities, when the API sends them. */
type Capabilities = Partial<Record<"hrmManage" | "projectsLead" | "lmsAdmin" | "isPlatformOwner", boolean>>;

function capability(user: AuthUser | null, key: keyof Capabilities): boolean | undefined {
  const caps = (user as (AuthUser & { capabilities?: Capabilities }) | null)?.capabilities;
  return caps?.[key];
}

const isAdmin = (u: AuthUser | null) => isAdminRole(u);
const inInstitution = (u: AuthUser | null) => Boolean(u?.organisationId);

/** May this person run the LMS console? Admins, and the HR Manager. */
export function canAdministerLms(u: AuthUser | null): boolean {
  return capability(u, "lmsAdmin") ?? administersLms(u);
}

export const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    key: "home",
    name: "Suite home",
    blurb: "Every module you can open",
    href: "/suite",
    icon: LayoutGrid,
    hue: "slate",
    links: [],
    canOpen: (u) => Boolean(u),
  },
  {
    key: "hrm",
    name: "People",
    blurb: "HR, leave, payroll and hiring",
    href: "/suite/hrm",
    icon: Users,
    hue: "coral",
    links: [
      { label: "Overview", href: "/suite/hrm" },
      { label: "Directory", href: "/suite/hrm/people" },
      { label: "Leave", href: "/suite/hrm/leave" },
      { label: "Payroll", href: "/suite/hrm/payroll" },
      { label: "Recruitment", href: "/suite/hrm/recruitment" },
      { label: "My employment", href: "/suite/hrm/me" },
    ],
    canOpen: inInstitution,
    suiteModule: "hrm",
  },
  {
    key: "projects",
    name: "Projects",
    blurb: "Boards, sprints, schedules and cost",
    href: "/suite/projects",
    icon: FolderKanban,
    hue: "blue",
    links: [
      { label: "All projects", href: "/suite/projects" },
      { label: "My work", href: "/suite/projects/me" },
      { label: "Portfolios", href: "/suite/projects/portfolios" },
      { label: "Companies", href: "/suite/projects/companies" },
    ],
    canOpen: inInstitution,
    suiteModule: "projects",
  },
  {
    key: "lms",
    name: "Learning",
    blurb: "Courses, paths and compliance",
    href: "/suite/lms",
    icon: GraduationCap,
    hue: "grape",
    links: [
      { label: "Dashboard", href: "/suite/lms" },
      { label: "Courses", href: "/suite/lms/courses" },
      { label: "Learning paths", href: "/suite/lms/learning-paths" },
      { label: "Compliance", href: "/suite/lms/compliance" },
      { label: "Certificates", href: "/suite/lms/certificates" },
    ],
    canOpen: canAdministerLms,
    suiteModule: "lms",
  },
  {
    key: "teach",
    name: "Teaching studio",
    blurb: "Build and run your courses",
    href: "/suite/lms/teach",
    icon: Presentation,
    hue: "sky",
    links: [
      { label: "Studio home", href: "/suite/lms/teach" },
      { label: "My courses", href: "/suite/lms/teach/courses" },
      { label: "Students", href: "/suite/lms/teach/students" },
      { label: "Analytics", href: "/suite/lms/teach/analytics" },
    ],
    // A teaching role, or anybody who runs the LMS.
    canOpen: (u) => teaches(u),
    suiteModule: "lms",
    // The owner's call (26 Sep 2026): not offered in the suite's menus. Instructors
    // reach it from the navbar's "Instructor Studio" link.
    listed: false,
  },
  {
    key: "learn",
    name: "My learning",
    blurb: "Your courses and certificates",
    href: "/my-courses",
    icon: BookOpenCheck,
    hue: "mint",
    links: [
      { label: "My courses", href: "/my-courses" },
      { label: "Learning paths", href: "/my-learning-paths" },
      { label: "Certificates", href: "/my-certificates" },
    ],
    // Every member learns, admins included; there is no "student" role any more.
    canOpen: (u) => Boolean(u),
    suiteModule: "lms",
  },
  {
    key: "org",
    name: "Organisation",
    blurb: "Users, roles, seats, branding and policy",
    href: "/suite/org",
    icon: Building2,
    hue: "sun",
    links: [
      { label: "Overview", href: "/suite/org" },
      { label: "Users", href: "/suite/org/users" },
      { label: "Roles & permissions", href: "/suite/org/roles" },
      { label: "Seats", href: "/suite/org/seats" },
      { label: "Branding", href: "/suite/org/branding" },
      { label: "Settings", href: "/suite/org/settings" },
      { label: "Recycle bin", href: "/suite/org/recycle-bin" },
    ],
    // Admins, and anybody a custom role admits with `core.*` keys (S8).
    canOpen: (u) => isAdmin(u) || admitsToOrgConsole(u),
  },
  {
    key: "platform",
    name: "Platform",
    blurb: "Tenants, modules, revenue and governance",
    href: "/suite/platform",
    icon: Globe,
    hue: "slate",
    links: [
      { label: "Overview", href: "/suite/platform" },
      { label: "Organisations", href: "/suite/platform/organisations" },
      { label: "Modules", href: "/suite/platform/modules" },
      { label: "Sales", href: "/suite/platform/sales" },
      { label: "Payments", href: "/suite/platform/payments" },
      { label: "Audit log", href: "/suite/platform/audit" },
    ],
    // The platform owner, and platform staff (no organisation) holding platform roles.
    canOpen: (u) => isPlatformPerson(u),
  },
  /*
    The affiliate programme, from the affiliate's side: their link, what it
    earned and what they were paid. Open to approved affiliates and suspended
    ones (who can still see their history); not a suite module, so never a
    preview.
  */
  {
    key: "affiliate",
    name: "Affiliate",
    blurb: "Your referral link, commissions and payouts",
    href: "/suite/affiliate",
    icon: Handshake,
    hue: "mint",
    links: [
      { label: "Overview", href: "/suite/affiliate" },
      { label: "Referrals", href: "/suite/affiliate/referrals" },
      { label: "Commissions", href: "/suite/affiliate/commissions" },
      { label: "Payouts", href: "/suite/affiliate/payouts" },
    ],
    canOpen: (u) => Boolean(u?.affiliate),
  },
  /*
    Finance opens where the organisation holds it and the platform has
    released it (`SUITE_UNRELEASED`); otherwise it is a preview -
    `availability` decides. Admin & Operations works the same way.
  */
  {
    key: "finance",
    name: "Finance",
    blurb: "Ledger, banking and financial statements",
    href: "/suite/finance",
    icon: Wallet,
    hue: "sun",
    links: [
      { label: "Overview", href: "/suite/finance" },
      { label: "Journals", href: "/suite/finance/journals" },
      { label: "Bank accounts", href: "/suite/finance/banking" },
      { label: "Financial statements", href: "/suite/finance/reports" },
      { label: "Company report", href: "/suite/finance/reports/company" },
    ],
    canOpen: inInstitution,
    suiteModule: "finance",
  },
  {
    key: "admin",
    name: "Operations",
    blurb: "Procurement, travel, events and client payments",
    href: "/suite/operations",
    icon: Building,
    hue: "slate",
    links: [
      { label: "Overview", href: "/suite/operations" },
      { label: "Purchase orders", href: "/suite/operations/procurement/orders" },
      { label: "Travel desk", href: "/suite/operations/travel" },
      { label: "Client payments", href: "/suite/operations/clients/requests" },
    ],
    canOpen: inInstitution,
    suiteModule: "admin",
  },
];

export type ModuleAvailability = "open" | "preview" | "hidden";

/**
 * What every menu offers for one area, for one person.
 *
 * - **preview** when the area's module is not switched on for their
 *   organisation, shown to *everybody* in it, so the whole organisation can
 *   see what exists, with a "Preview" badge opening the preview page;
 * - **open** when the module is on and this person may use the area;
 * - **hidden** otherwise (the module is on, but not for them).
 *
 * The platform's own people have no organisation, so previews never apply to
 * them and only `canOpen` decides.
 */
export function availability(m: WorkspaceModule, user: AuthUser | null): ModuleAvailability {
  if (m.suiteModule && user?.organisationId && moduleStatus(user, m.suiteModule) === "preview") {
    // One door per module: the LMS console stands in for the studio and the
    // learning space, so a menu doesn't list the same preview three times.
    return m.key === "teach" || m.key === "learn" ? "hidden" : "preview";
  }
  if (m.suiteModule && isUnreleased(user, m.suiteModule)) {
    return user?.organisationId ? "preview" : "hidden";
  }
  return m.canOpen(user) ? "open" : "hidden";
}

/** Where a menu entry for this area should point, given its availability. */
export function hrefFor(m: WorkspaceModule, state: ModuleAvailability): string {
  return state === "preview" && m.suiteModule ? previewHref(m.suiteModule) : m.href;
}

export function moduleByKey(key: WorkspaceModuleKey): WorkspaceModule {
  return WORKSPACE_MODULES.find((m) => m.key === key) ?? WORKSPACE_MODULES[0];
}

/**
 * Tailwind classes per hue. Spelled out in full so the compiler sees every
 * class, a class built by string concatenation is a class Tailwind never
 * generates.
 */
export const HUE: Record<
  Hue,
  { tile: string; soft: string; text: string; dot: string; ring: string; bar: string }
> = {
  blue: {
    tile: "bg-primary-600 text-white",
    soft: "bg-primary-50 text-primary-700",
    text: "text-primary-700",
    dot: "bg-primary-500",
    ring: "ring-primary-200",
    bar: "bg-primary-500",
  },
  coral: {
    tile: "bg-coral-500 text-white",
    soft: "bg-coral-50 text-coral-700",
    text: "text-coral-700",
    dot: "bg-coral-500",
    ring: "ring-coral-100",
    bar: "bg-coral-500",
  },
  mint: {
    tile: "bg-mint-500 text-white",
    soft: "bg-mint-50 text-mint-700",
    text: "text-mint-700",
    dot: "bg-mint-500",
    ring: "ring-mint-100",
    bar: "bg-mint-500",
  },
  grape: {
    tile: "bg-grape-500 text-white",
    soft: "bg-grape-50 text-grape-700",
    text: "text-grape-700",
    dot: "bg-grape-500",
    ring: "ring-grape-100",
    bar: "bg-grape-500",
  },
  sun: {
    tile: "bg-sun-400 text-neutral-900",
    soft: "bg-sun-50 text-sun-700",
    text: "text-sun-700",
    dot: "bg-sun-500",
    ring: "ring-sun-100",
    bar: "bg-sun-400",
  },
  sky: {
    tile: "bg-sky-500 text-white",
    soft: "bg-sky-50 text-sky-700",
    text: "text-sky-700",
    dot: "bg-sky-500",
    ring: "ring-sky-100",
    bar: "bg-sky-500",
  },
  rose: {
    tile: "bg-rose-500 text-white",
    soft: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
    dot: "bg-rose-500",
    ring: "ring-rose-100",
    bar: "bg-rose-500",
  },
  slate: {
    tile: "bg-neutral-800 text-white",
    soft: "bg-neutral-100 text-neutral-700",
    text: "text-neutral-700",
    dot: "bg-neutral-500",
    ring: "ring-neutral-200",
    bar: "bg-neutral-500",
  },
};

const ROTATION: Hue[] = ["blue", "coral", "mint", "grape", "sun", "sky", "rose"];

/**
 * A stable hue for anything with a name, a person, a project, a leave type, 
 * so the same thing is the same colour on every screen it appears on.
 */
export function hueFor(seed: string | null | undefined): Hue {
  if (!seed) return "slate";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ROTATION[h % ROTATION.length];
}
