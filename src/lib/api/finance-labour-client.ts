/* ------------------------------------------------------------------ */
/*  Finance › Labour costing: each month's payroll cost spread over    */
/*  projects from the hours logged, the weekly provisional charge and  */
/*  utilisation. Shapes follow `LabourController`,                     */
/*  `LabourPeopleController` and `LabourCosting` in api-lms. Money is  */
/*  integer minor units (kobo); utilisation is basis points.           */
/*                                                                    */
/*  Individual pay is its own permission (`finance.labour_people`):    */
/*  without it the API sends project totals only, `people` is null    */
/*  and the people route answers 403.                                  */
/* ------------------------------------------------------------------ */

import { ApiError, errorText, financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText };

const enc = encodeURIComponent;

export type LabourMethod = "standard_hours" | "proportional";
export type LabourRunKind = "allocation" | "provisional";
export type LabourRunStatus = "posted" | "reversed";
export type LabourExceptionType = "no_timesheet" | "over_120" | "closed_project" | "no_budget" | "not_on_payroll";

export interface LabourConfig {
  method: LabourMethod;
  /** Hours a full month is costed over (40–300). */
  standardHours: number;
}

export interface LabourRunRow {
  id: string;
  kind: LabourRunKind;
  /** `YYYY-MM`. */
  month: string;
  asOf: string | null;
  method: LabourMethod;
  /** The month's loaded payroll cost. */
  loaded: number;
  /** Charged to projects. */
  allocated: number;
  /** Left in overhead: paid time not logged to a project. */
  bench: number;
  status: LabourRunStatus;
  journalId: string | null;
  /** How many exceptions the run carried. */
  exceptions: number;
  postedBy: string | null;
  postedAt: string | null;
}

export interface UtilisationMonth {
  month: string;
  people: number;
  loaded: number;
  allocated: number;
  bench: number;
  hoursLogged: number;
  hoursStandard: number;
  utilisationBp: number;
}

export interface UtilisationPerson {
  userId: string;
  name: string | null;
  hoursLogged: number;
  utilisationBp: number;
  bench: number;
}

export interface LabourOverview {
  config: LabourConfig;
  methods: Record<LabourMethod, string>;
  runs: LabourRunRow[];
  utilisation: {
    /** The last six allocated months, oldest first. */
    months: UtilisationMonth[];
    /** The latest allocated month, person by person; null without `labour_people`. */
    people: UtilisationPerson[] | null;
  };
  seesPeople: boolean;
}

export interface LabourException {
  type: LabourExceptionType | string;
  message: string;
  /** Person exceptions name the person only for those who see individual pay. */
  userId?: string;
  name?: string | null;
  projectId?: string;
  project?: string | null;
}

export interface LabourPreviewProject {
  projectId: string;
  project: string | null;
  /** The project's own status in Elevate Projects (`active`, `completed` …). */
  status: string | null;
  minutes: number;
  amount: number;
  people: number;
}

export interface LabourPreviewPerson {
  userId: string;
  name: string | null;
  loaded: number;
  /** Private: loaded cost over standard hours, minor units per hour. */
  hourlyRate: number;
  minutes: number;
  lines: { projectId: string; minutes: number; amount: number }[];
  bench: number;
}

export interface LabourPreview {
  month: string;
  method: LabourMethod;
  standardHours: number;
  /** The month's payroll run; null when HR has not approved one. */
  payrollRun: { id: string; reference: string | null; status: string; posted: boolean } | null;
  totals: { loaded: number; allocated: number; unallocated: number; people: number; hours: number };
  projects: LabourPreviewProject[];
  /** Only from the people route. */
  people: LabourPreviewPerson[] | null;
  exceptions: LabourException[];
  /** The allocation already posted for this month, which posting again replaces. */
  existingRun: { id: string; allocated: number; postedAt: string | null } | null;
  /** Sentences; posting is refused while any stands. */
  blockers: string[];
  /** One code per blocker, in the same order. Older APIs leave it out. */
  blockerCodes?: LabourBlockerCode[];
  /** True only when the closed project is the sole blocker. Older APIs leave it out. */
  overridable?: boolean;
}

/** Why a month can't post: no payroll run, a payroll not in the books, or hours on a closed project. */
export type LabourBlockerCode = "no_payroll" | "payroll_not_posted" | "closed_project";

export interface LabourRunDetail {
  id: string;
  kind: LabourRunKind;
  month: string;
  asOf: string | null;
  method: LabourMethod;
  standardHours: number;
  status: LabourRunStatus;
  journalId: string | null;
  loaded: number;
  allocated: number;
  bench: number;
  exceptions: LabourException[];
  /** Why a closed-project blocker was overridden, when it was. */
  override: string | null;
  projects: { projectId: string; project: string | null; hours: number; amount: number; people: number }[];
  people:
    | {
        userId: string;
        name: string | null;
        hourlyRate: number;
        hours: number;
        /** Charged to projects. */
        projects: number;
        bench: number;
        lines: { projectId: string; project: string | null; hours: number; amount: number }[];
      }[]
    | null;
  seesPeople: boolean;
}

export interface LabourPostInput {
  method?: LabourMethod | null;
  /** Lets a month post past the closed-project blocker. */
  overrideReason?: string | null;
}

export interface LabourPosted {
  id: string;
  allocated: number;
  bench: number;
  journalId: string | null;
}

export interface ProvisionalCharged {
  id: string;
  allocated: number;
  asOf: string | null;
  journalId: string | null;
}

/** The blocker a Finance override may lift (`LabourCosting::post`). */
export const CLOSED_PROJECT_BLOCKER = "Hours were logged on a closed project";

/**
 * Posting may go ahead with an override reason only when every blocker
 * left is the closed-project one: a missing or unposted payroll never can.
 * The API says so in `overridable`; reading the sentences is only the
 * fallback for a preview that doesn't carry it.
 */
export function overridable(p: Pick<LabourPreview, "blockers" | "overridable">): boolean {
  if (typeof p.overridable === "boolean") return p.overridable;
  return p.blockers.length > 0 && p.blockers.every((b) => b.startsWith(CLOSED_PROJECT_BLOCKER));
}

/** Each blocker with its code; the code is null where the API didn't send one. */
export function blockerList(p: Pick<LabourPreview, "blockers" | "blockerCodes">): { text: string; code: LabourBlockerCode | null }[] {
  return p.blockers.map((text, i) => ({ text, code: p.blockerCodes?.[i] ?? null }));
}

export const labour = {
  overview: () => unwrap(financeRequest<{ data: LabourOverview }>("labour")),
  configure: (patch: Partial<LabourConfig>) => unwrap(financeRequest<{ data: LabourConfig }>("labour/settings", { method: "PATCH", body: patch })),
  /** Hours so far this month at the latest rates; null when there is nothing to charge. */
  provisional: (asOf?: string | null) =>
    unwrap(financeRequest<{ data: ProvisionalCharged | null }>("labour/provisional", { method: "POST", body: asOf ? { asOf } : {} })),
  run: (id: string) => unwrap(financeRequest<{ data: LabourRunDetail }>(`labour/runs/${enc(id)}`)),
  preview: (month: string, method?: LabourMethod | null) =>
    unwrap(financeRequest<{ data: LabourPreview }>(`labour/${enc(month)}`, { query: { method: method ?? undefined } })),
  /** The same preview with each person's cost and rate. 403 without `labour_people`. */
  people: (month: string, method?: LabourMethod | null) =>
    unwrap(financeRequest<{ data: LabourPreview }>(`labour/${enc(month)}/people`, { query: { method: method ?? undefined } })),
  post: (month: string, input: LabourPostInput = {}) =>
    unwrap(financeRequest<{ data: LabourPosted }>(`labour/${enc(month)}/post`, { method: "POST", body: input })),
};
