"use client";

import {
  ArrowLeftRight,
  Banknote,
  BellRing,
  Briefcase,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DoorOpen,
  FileClock,
  FileSignature,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Plane,
  Receipt,
  Scale,
  ShieldCheck,
  ShieldQuestion,
  Target,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";
import type { AuthUser } from "@/lib/auth-store";
import { leadsTeam, mayOpenHrmPage } from "@/suite/hrm/lib/hrm-access";

/**
 * The HR console's navigation, worn inside the workspace shell.
 *
 * Not `AdminShell`'s role gate, and that is the point: an HR manager very
 * often is neither `admin` nor `super_admin` - they hold the HR Management
 * Lead role. The nav is filtered by the keys their roles give, for
 * presentation only; `access:hrm` refuses the API regardless, so a
 * hand-typed URL still gets a 403 naming what is missing.
 */

/*
  Each management page is offered to anybody whose roles hold a key of the
  feature that page answers to organisation-wide - the HR Management Lead sees
  them all, the Recruiter Recruitment, the Payroll officer Payroll (S7). One
  table decides both this and `ManagerOnly`.
*/
const opens = (href: string) => (u: AuthUser | null) => mayOpenHrmPage(u, href);

/*
  My team (S9) is in the menu of whoever leads one: the Line Manager role,
  which the reporting line gives with a first direct report. An admin or HR
  lead with nobody reporting to them would get five pages of nothing, so the
  menu doesn't offer them.
*/
const leads = (u: AuthUser | null) => leadsTeam(u);

const NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [{ label: "Overview", href: "/suite/hrm", icon: LayoutDashboard, exact: true, show: opens("/suite/hrm") }],
  },
  {
    /*
      Nobody needs a role for these, they are a person's own record,
      their own timesheet and their own work. Requiring one to see your own
      contract would mean granting everybody one to no purpose.
    */
    heading: "Mine",
    items: [
      { label: "My employment", href: "/suite/hrm/me", icon: UserRound, exact: true },
      { label: "My details", href: "/suite/hrm/me/details", icon: IdCard },
      { label: "My timesheet", href: "/suite/hrm/me/timesheet", icon: Clock },
      { label: "My work", href: "/suite/hrm/me/work", icon: ListTodo },
      { label: "My leave", href: "/suite/hrm/me/leave", icon: Plane },
      { label: "My rota", href: "/suite/hrm/me/roster", icon: CalendarRange },
      { label: "My interviews", href: "/suite/hrm/me/interviews", icon: MessageSquare },
      { label: "My pay", href: "/suite/hrm/me/pay", icon: Receipt },
      /*
        Not hidden behind anything. Every other case route needs HR's keys,
        so without this entry the only way to raise a grievance was to ask HR
        to file it, which routes a confidential complaint through the
        function it is most often about.
      */
      { label: "My cases", href: "/suite/hrm/me/cases", icon: ShieldQuestion },
      { label: "My notifications", href: "/suite/hrm/me/notifications", icon: BellRing },
    ],
  },
  {
    heading: "My team",
    items: [
      { label: "Team overview", href: "/suite/hrm/team", icon: UsersRound, exact: true, show: leads },
      { label: "Team leave", href: "/suite/hrm/team/leave", icon: Plane, show: leads },
      { label: "Team timesheets", href: "/suite/hrm/team/timesheets", icon: Clock, show: leads },
      { label: "Team swaps", href: "/suite/hrm/team/swaps", icon: ArrowLeftRight, show: leads },
      { label: "Team reviews", href: "/suite/hrm/team/reviews", icon: ClipboardCheck, show: leads },
    ],
  },
  {
    heading: "People",
    items: [
      { label: "Directory", href: "/suite/hrm/people", icon: Users, show: opens("/suite/hrm/people") },
      { label: "Onboarding", href: "/suite/hrm/onboarding", icon: ClipboardList, show: opens("/suite/hrm/onboarding") },
      { label: "Probation", href: "/suite/hrm/probation", icon: CalendarClock, show: opens("/suite/hrm/probation") },
      { label: "Recruitment", href: "/suite/hrm/recruitment", icon: Briefcase, show: opens("/suite/hrm/recruitment") },
      { label: "Renewals", href: "/suite/hrm/renewals", icon: FileClock, show: opens("/suite/hrm/renewals") },
    ],
  },
  {
    heading: "Work",
    items: [
      { label: "Timesheets", href: "/suite/hrm/timesheets", icon: Clock, show: opens("/suite/hrm/timesheets") },
      { label: "Tasks", href: "/suite/hrm/tasks", icon: ListTodo, show: opens("/suite/hrm/tasks") },
      { label: "Leave", href: "/suite/hrm/leave", icon: Plane, show: opens("/suite/hrm/leave") },
      { label: "Roster", href: "/suite/hrm/roster", icon: CalendarRange, show: opens("/suite/hrm/roster") },
      { label: "Attendance", href: "/suite/hrm/attendance", icon: UserCheck, show: opens("/suite/hrm/attendance") },
      { label: "Payroll", href: "/suite/hrm/payroll", icon: Banknote, show: opens("/suite/hrm/payroll") },
      { label: "Performance", href: "/suite/hrm/performance", icon: Target, show: opens("/suite/hrm/performance") },
      { label: "Reviews", href: "/suite/hrm/reviews", icon: ClipboardCheck, show: opens("/suite/hrm/reviews") },
    ],
  },
  {
    heading: "Employment",
    items: [
      { label: "Contracts", href: "/suite/hrm/contracts", icon: FileSignature, show: opens("/suite/hrm/contracts") },
      { label: "Internships", href: "/suite/hrm/internships", icon: GraduationCap, show: opens("/suite/hrm/internships") },
      { label: "Relations", href: "/suite/hrm/relations", icon: Scale, show: opens("/suite/hrm/relations") },
      { label: "Workforce", href: "/suite/hrm/workforce", icon: TrendingUp, show: opens("/suite/hrm/workforce") },
      { label: "Leavers", href: "/suite/hrm/leavers", icon: DoorOpen, show: opens("/suite/hrm/leavers") },
      { label: "HR roles", href: "/suite/hrm/roles", icon: ShieldCheck, show: opens("/suite/hrm/roles") },
    ],
  },
];

/** Titles for pages the nav does not name. */
const TITLES: WsTitle[] = [
  { match: "/suite/hrm/relations", title: "Employee relations" },
  { match: "/suite/hrm/people/", title: "Employee record" },
  { match: "/suite/hrm/recruitment/candidates/", title: "Candidate" },
  { match: "/suite/hrm/recruitment/", title: "Requisition" },
];

export default function HrmShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="hrm" nav={NAV} titles={TITLES} requiresOrganisation="HR">
      {children}
    </WorkspaceShell>
  );
}
