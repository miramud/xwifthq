/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation overview.                 */
/*  Same-origin /api/admin/overview proxy; the token stays httpOnly.   */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";
import type { SuiteModuleKey, ModuleStatus } from "@/lib/module-access";

export { ApiError };

export type OverviewWindow = 30 | 90;

export interface OverviewSeriesPoint {
  date: string;
}

export interface LmsOverview {
  courses: number;
  published: number;
  learners: number;
  enrolments: number;
  /** 0–100. */
  completionRate: number;
  /** 0–100. */
  averageProgress: number;
  certificatesIssued: number;
  overdueMandatory: number;
  series: (OverviewSeriesPoint & { enrolments: number; completions: number })[];
  topCourses: { slug: string; title: string; learners: number; completionRate: number }[];
}

export interface HrmOverview {
  headcount: number;
  onLeaveToday: number;
  pendingLeave: number;
  openRequisitions: number;
  probationEndingSoon: number;
  lastPayrollRun: { period: string; netKobo: number; status: string } | null;
  series: (OverviewSeriesPoint & { joiners: number; leavers: number })[];
}

export interface ProjectsOverview {
  activeProjects: number;
  openItems: number;
  overdueItems: number;
  completedThisPeriod: number;
  hoursLogged: number;
  atRisk: { slug: string; name: string; reason: string }[];
  series: (OverviewSeriesPoint & { created: number; completed: number })[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface OrgOverview {
  organisation: { name: string; slug: string; logoUrl: string | null; createdAt: string };
  modules: { key: SuiteModuleKey; label: string; status: ModuleStatus }[];
  people: {
    users: number;
    admins: number;
    activeLast30Days: number;
    newThisPeriod: number;
    invited: number;
    seatsUsed: number;
    seatsTotal: number | null;
  };
  /** Null when the module isn't switched on for this organisation. */
  lms: LmsOverview | null;
  hrm: HrmOverview | null;
  projects: ProjectsOverview | null;
  /** Preview-only modules: always null until they ship. */
  finance: null;
  admin: null;
  activity: {
    module: SuiteModuleKey | "core";
    action: string;
    actor: { id: string; name: string } | null;
    subject: string | null;
    at: string;
  }[];
  alerts: { module: SuiteModuleKey | "core"; severity: AlertSeverity; message: string; href: string | null }[];
}

export async function getOrgOverview(window: OverviewWindow): Promise<OrgOverview> {
  const res = await fetch(`/api/admin/overview?window=${window}`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.message ?? "The overview didn't load.", res.status, json?.errors);
  return (json as { data: OrgOverview }).data;
}
