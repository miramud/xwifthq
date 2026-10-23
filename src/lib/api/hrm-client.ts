/* ------------------------------------------------------------------ */
/*  Browser-side client for XwiftHQ HRM.                               */
/*  Calls the same-origin /api/hrm/* proxy (token stays httpOnly).     */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/hrm/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      json?.message ?? "Request failed.",
      res.status,
      json?.errors,
    );
  }

  return json as T;
}

/**
 * A multipart upload (a document scan). Separate from `request` because no
 * `Content-Type` may be set: the browser writes it with the boundary.
 */
async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`/api/hrm/${path}`, { method: "POST", body, cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json?.message ?? "That file could not be uploaded.", res.status, json?.errors);
  }

  return json as T;
}

/** Unwrap a `{ data }` envelope. */
function unwrap<T>(res: { data: T }): T {
  return res.data;
}

export { ApiError };

/* ------------------------------------------------------------------ */
/*  Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/**
 * The basis somebody is engaged on. Kept in step with the `EmploymentType`
 * enum in `app/Suite/Hrm/Enums` — the API sends the label alongside every
 * value, so nothing here needs a second copy of the English.
 */
export type EmploymentType = "permanent" | "contract" | "intern" | "casual";

/** Where they are in that engagement. */
export type EmploymentStatus =
  | "onboarding"
  | "on_probation"
  | "active"
  | "suspended"
  | "ended"
  | "resigned"
  | "terminated";

export type ContractStatus =
  | "draft"
  | "active"
  | "renewed"
  | "expired"
  | "terminated";

export type ProbationOutcome = "pending" | "confirmed" | "extended" | "exited";

export type OnboardingStatus = "in_progress" | "completed" | "abandoned";

export type StepOwner = "hr" | "manager" | "employee" | "it" | "finance";

export type CohortStatus = "planned" | "open" | "running" | "closed";

export type PlacementStatus = "placed" | "completed" | "withdrawn";

export type ConversionOutcome =
  | "pending"
  | "offered"
  | "converted"
  | "declined"
  | "not_converted";

/** How a KPI is measured, and which way is good. */
export type MetricType =
  | "number"
  | "percentage"
  | "currency"
  | "duration"
  | "boolean";

/** Roughly a third of real KPIs are `lower` — do not assume. */
export type MetricDirection = "higher" | "lower";

export type KpiStatus = "draft" | "active" | "closed" | "cancelled";

export type MilestoneStatus =
  | "planned"
  | "in_progress"
  | "achieved"
  | "missed"
  | "cancelled";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TimeEntryStatus =
  | "open"
  | "recorded"
  | "submitted"
  | "approved"
  | "rejected";

export type ReviewStatus =
  | "awaiting_self"
  | "awaiting_manager"
  | "awaiting_meeting"
  | "complete"
  | "cancelled";

export type CycleStatus = "planned" | "open" | "closed";

/* ------------------------------------------------------------------ */
/*  People                                                              */
/* ------------------------------------------------------------------ */

export interface EmployeePerson {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
}

export interface Employee {
  id: string;
  employeeNumber: string | null;
  person: EmployeePerson;

  jobTitle: string;
  department: string | null;
  workLocation: string | null;
  weeklyHours: number | null;

  employmentType: EmploymentType;
  employmentTypeLabel: string;
  status: EmploymentStatus;
  statusLabel: string;

  isCurrent: boolean;
  canRecordTime: boolean;
  countsAsHeadcount: boolean;

  hiredOn: string | null;
  startedOn: string | null;
  probationEndsOn: string | null;
  confirmedOn: string | null;
  endedOn: string | null;
  exitReason: string | null;
  /** Sign-in is switched off on the leaving date (the leaver sweep). */
  disableSignInOnLeaving?: boolean;
  /** When the leaver sweep took their roles, project places and (if asked) sign-in. */
  accessRevokedAt?: string | null;

  probationOverdue: boolean;
  /** Negative when the date has passed — itself a finding, so it is not clamped. */
  daysUntilEnd: number | null;
  monthsOfService: number | null;

  manager?: { id: string; name: string | null; jobTitle: string } | null;
  directReports?: number;

  contract?: EmploymentContract[];
  onboarding?: OnboardingJourney[];
  placements?: InternshipPlacement[];

  createdAt: string | null;
}

export interface EmploymentContract {
  id: string;
  reference: string | null;

  employmentType: EmploymentType;
  employmentTypeLabel: string;
  status: ContractStatus;
  statusLabel: string;

  jobTitle: string;
  department: string | null;

  startsOn: string | null;
  endsOn: string | null;
  isOpenEnded: boolean;
  termInMonths: number | null;
  daysRemaining: number | null;
  isInForce: boolean;
  /** In force and past its end date: somebody working with nothing covering them. */
  isOverrunning: boolean;

  /** Kobo. Formatting is the client's business; the integer is the record. */
  grossSalary: number | null;
  salaryPeriod: string | null;
  noticeDays: number | null;

  renewedFromId: string | null;

  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  } | null;

  signedAt: string | null;
  terms: string | null;
  note: string | null;
  createdAt: string | null;
}

export interface ProbationReview {
  id: string;
  employeeId: string;

  dueOn: string | null;
  heldOn: string | null;

  outcome: ProbationOutcome;
  outcomeLabel: string;
  isOpen: boolean;
  isOverdue: boolean;
  daysLate: number;
  wasHeldLate: boolean;
  endsProbation: boolean;

  extendedTo: string | null;
  /** Absent reads as absent, never as average. */
  rating: number | null;
  summary: string | null;
  objectives: string | null;

  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  reviewer?: { id: string; name: string } | null;

  decidedAt: string | null;
  createdAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Onboarding                                                          */
/* ------------------------------------------------------------------ */

export interface ProgrammeStep {
  id: string;
  title: string;
  description: string | null;
  ownerRole: StepOwner;
  ownerRoleLabel: string;
  category: string | null;
  /** Signed. Negative is before day one, where the blocking steps live. */
  dueOffsetDays: number;
  isBeforeStart: boolean;
  isRequired: boolean;
  position: number;  /**
   * The course this step requires, where it names one. Null on most steps.
   *
   * Carried down onto each starter's own step when a journey is created, so
   * an edit to the programme governs the next intake rather than rewriting
   * the checklists people are already working through.
   */
  courseId?: string | null;
  courseTitle?: string | null;
}

export interface OnboardingProgramme {
  id: string;
  name: string;
  description: string | null;
  employmentType: EmploymentType | null;
  employmentTypeLabel: string | null;
  isFallback: boolean;
  isActive: boolean;
  isDefault: boolean;
  stepCount?: number;
  journeyCount?: number;
  steps?: ProgrammeStep[];
  spanInDays?: number;
  createdAt: string | null;
}

export interface OnboardingStep {
  id: string;
  journeyId: string;
  title: string;
  description: string | null;
  category: string | null;
  ownerRole: StepOwner;
  ownerRoleLabel: string;
  /** Owned by the starter themselves, so theirs to tick off. */
  isMine: boolean;
  isRequired: boolean;
  position: number;
  dueOn: string | null;
  isComplete: boolean;
  isOverdue: boolean;
  daysLate: number;
  completedAt: string | null;
  completedBy?: string | null;
  note: string | null;  /**
   * The induction bridge, and null on most steps. Naming a course makes the
   * step answerable from the LMS rather than on somebody's word.
   */
  courseId?: string | null;
  courseTitle?: string | null;
  courseSlug?: string | null;
  /**
   * Whether the seat was actually granted. "We asked" is not "they have it":
   * a step can name a course and fail to assign it, and without this an HR
   * officer chases somebody for training they were never given.
   */
  courseAssigned?: boolean;
}

export interface OnboardingJourney {
  id: string;
  employeeId: string;
  /** The name as it was — still correct after the programme is renamed. */
  programmeName: string;
  programmeId: string | null;
  anchorDate: string | null;
  status: OnboardingStatus;
  statusLabel: string;
  isOpen: boolean;
  completedAt: string | null;
  /** Percentage of the *required* steps. */
  progress?: number;
  requiredComplete?: boolean;
  overdueCount?: number;
  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    startedOn: string | null;
  };
  buddy?: { id: string; name: string | null } | null;
  steps?: OnboardingStep[];
  createdAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Internships                                                         */
/* ------------------------------------------------------------------ */

export interface CohortOutcomes {
  placed: number;
  completed: number;
  withdrawn: number;
  offered: number;
  converted: number;
  declined: number;
  undecided: number;
}

export interface InternshipCohort {
  id: string;
  name: string;
  description: string | null;
  startsOn: string | null;
  endsOn: string | null;
  status: CohortStatus;
  statusLabel: string;
  acceptsPlacements: boolean;
  /** Null means uncapped — not zero. */
  capacity: number | null;
  placesRemaining: number | null;
  isFull: boolean;
  placementCount?: number;
  outcomes?: CohortOutcomes;
  placements?: InternshipPlacement[];
  createdAt: string | null;
}

export interface InternshipPlacement {
  id: string;
  employeeId: string;
  cohortId: string | null;
  institution: string | null;
  programmeOfStudy: string | null;
  focusArea: string | null;
  startsOn: string | null;
  endsOn: string | null;
  lengthInWeeks: number;
  status: PlacementStatus;
  statusLabel: string;
  isActive: boolean;
  conversion: ConversionOutcome;
  conversionLabel: string;
  awaitingDecision: boolean;
  wasOffered: boolean;
  decisionIsDue: boolean;
  convertedOn: string | null;
  conversionNote: string | null;
  intern?: { id: string; name: string | null; email: string | null };
  cohort?: { id: string; name: string } | null;
  mentor?: { id: string; name: string | null; jobTitle: string } | null;
  decidedAt: string | null;
  createdAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  The dashboard                                                       */
/* ------------------------------------------------------------------ */

export interface HrmOverview {
  headcount: {
    /** Permanent plus fixed term. The number you plan against. */
    headcount: number;
    /** Everybody with a live record, interns and casuals included. */
    peopleEngaged: number;
    permanent: number;
    contract: number;
    intern: number;
    casual: number;
    starters: number;
    onProbation: number;
  };
  byDepartment: { label: string; value: number }[];
  onboarding: {
    inProgress: number;
    withOverdueSteps: number;
    starters: {
      journeyId: string;
      employeeId: string;
      name: string | null;
      jobTitle: string | null;
      startsOn: string | null;
      programme: string;
      progress: number;
      overdueSteps: number;
    }[];
  };
  probation: {
    due: number;
    overdue: number;
    reviews: {
      reviewId: string;
      employeeId: string;
      name: string | null;
      jobTitle: string | null;
      dueOn: string | null;
      isOverdue: boolean;
      daysLate: number;
    }[];
  };
  contracts: {
    expiring: number;
    /** Already wrong, rather than coming up. Its own number for that reason. */
    overrunning: number;
    expiringSoon: ContractWatchRow[];
    overrun: ContractWatchRow[];
  };
  internships: {
    onProgramme: number;
    decisionsDue: number;
    awaitingDecision: number;
    due: {
      placementId: string;
      employeeId: string;
      name: string | null;
      cohort: string | null;
      mentor: string | null;
      endsOn: string | null;
    }[];
  };
  tasks: {
    open: number;
    overdue: number;
    /** Its own number: stuck is not the same as late. */
    blocked: number;
    inProgress: number;
    attention: {
      taskId: string;
      employeeId: string;
      title: string;
      name: string | null;
      dueOn: string | null;
      daysLate: number;
      isBlocked: boolean;
      blockedReason: string | null;
      priority: TaskPriority;
    }[];
  };
  timesheet: {
    expectedToday: number;
    signedInNow: number;
    recordedToday: number;
    lateToday: number;
    /** Not yet an absence — the day is not over. */
    notInYet: number;
    awaitingApproval: number;
  };
  performance: {
    reviewsOpen: number;
    awaitingSelf: number;
    awaitingManager: number;
    awaitingMeeting: number;
  };
  leave: {
    awayToday: number;
    awaitingDecision: number;
    /** How long the oldest undecided request has been sitting. */
    longestWaitDays: number;
    startingWithin14Days: number;
  };
  attendance: {
    swapsAwaitingApproval: number;
    swapsOpen: number;
    shiftsNext7Days: number;
    /** Planned but invisible to everybody it governs. */
    unpublishedShiftsAhead: number;
  };
  recruitment: {
    /** Everything not yet closed, drafts and on-hold roles included. */
    requisitionsOpen: number;
    /** Signed off, so candidates can actually be hired against them. */
    requisitionsApproved: number;
    requisitionsAwaitingApproval: number;
    applicationsActive: number;
    interviewsNext7Days: number;
    /** Held, and never written up. */
    interviewsAwaitingScorecards: number;
    offersAwaitingResponse: number;
  };
  payroll: {
    openRun: {
      id: string;
      reference: string;
      period: string;
      status: PayRunStatus;
      payDate: string | null;
      daysToPayDate: number | null;
    } | null;
    /** Counted from the employee side, because they appear on no list. */
    withoutPayProfile: number;
    cannotBePaid: number;
  };
  asAt: string;
}

/* ------------------------------------------------------------------ */
/*  One person, across the module                                      */
/* ------------------------------------------------------------------ */

/**
 * The sections of somebody's record that live in the other tranches.
 *
 * Fetched separately from the employee itself: every picker and list in the
 * module loads an employee, and none of them want a leave balance.
 */
export interface EmployeeDossier {
  leave: {
    onLeaveToday: boolean;
    currentAbsence: {
      id: string;
      type: string;
      startsOn: string;
      endsOn: string;
      isApproved: boolean;
    } | null;
    balances: {
      typeId: string;
      name: string;
      remainingDays: number;
      takenDays: number;
      pendingDays: number;
    }[];
    pendingRequests: number;
  };
  attendance: {
    from: string;
    to: string;
    attendanceRate: number;
    lateDays: number;
    unexplainedDays: number;
    workedMinutes: number;
    varianceMinutes: number;
    overtime: OvertimeTotal[];
    /** Only the days somebody has to account for. */
    exceptions: { date: string; expectedMinutes: number }[];
  };
  roster: {
    shifts: number;
    expectedMinutes: number;
    next: {
      id: string;
      worksOn: string;
      name: string | null;
      startsAt: string;
      endsAt: string;
      crossesMidnight: boolean;
    }[];
  };
  /** Null for somebody whose roles do not give HR's confidential records (roles redesign, phase 2b). */
  pay: null | {
    hasProfile: boolean;
    /** Named, not counted — "Pension PIN" is something to go and ask for. */
    missingDetails: string[];
    monthlyBasicKobo: number | null;
    lastPayslip: {
      id: string;
      period: string | null;
      grossKobo: number;
      netKobo: number;
      paidOn: string | null;
      isDistributed: boolean;
    } | null;
    loans: {
      count: number;
      outstandingKobo: number;
      /** Nil for a suspended loan: still owed, not being collected. */
      monthlyKobo: number;
    };
  };
  /** Who to ring, and anything that stops them working. Null without HR's confidential records. */
  welfare: null | {
    emergencyContact: {
      name: string;
      relationship: string | null;
      phone: string;
    } | null;
    /** Stated rather than inferred: a gap to close, not a blank to scroll past. */
    hasEmergencyContact: boolean;
    isBlockedByDocument: boolean;
    documentsExpiring: {
      id: string;
      title: string;
      kindLabel: string;
      expiresOn: string | null;
      daysUntilExpiry: number | null;
      blocksWork: boolean;
      hasExpired: boolean;
    }[];
  };
  /** Null for anybody entered by hand, which is most people during setup. */
  origin: {
    offerId: string;
    candidateId: string | null;
    applicationId: string | null;
    requisitionId: string | null;
    reference: string | null;
    jobTitle: string;
    source: CandidateSource | null;
    sourceLabel: string | null;
    appliedAt: string | null;
    acceptedAt: string | null;
    salaryKobo: number;
    daysFromApplication: number | null;
    wasReturningCandidate: boolean;
  } | null;
  asAt: string;
}

/* ------------------------------------------------------------------ */
/*  The person                                                         */
/* ------------------------------------------------------------------ */

export type DocumentKind =
  | "certification"
  | "right_to_work"
  | "identity"
  | "qualification"
  | "clearance"
  | "agreement"
  | "other";

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  /** Exactly one per person. Promoting one demotes the rest. */
  isPrimary: boolean;
}

export interface EmployeeDocument {
  id: string;
  kind: DocumentKind;
  kindLabel: string;
  title: string;
  reference: string | null;
  issuer: string | null;
  issuedOn: string | null;
  /** Null means it never expires — a degree certificate. */
  expiresOn: string | null;
  expires: boolean;
  hasExpired: boolean;
  /** Signed: negative once it has lapsed. */
  daysUntilExpiry: number | null;
  /** Inside this kind's own notice window. A visa is chased 90 days out. */
  needsRenewing: boolean;
  /** Expired *and* the kind that stops somebody working. */
  blocksWork: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  fileName: string | null;
  /** A scan is attached (H13); download it through `documentFileUrl`. */
  hasFile?: boolean;
  note: string | null;
}

export interface PersonalRecord {
  employeeId: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  nationalId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  postalAddress: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  emergencyContacts: EmergencyContact[];
  documents: EmployeeDocument[];
  isBlockedByDocument: boolean;
}

/**
 * What somebody may change about themselves.
 *
 * Mirrors `Employee::SELF_EDITABLE`. Their address and how to reach them
 * change often and only they know; a job title and a date of birth are terms
 * of employment and an identity fact that payroll depends on.
 */
export interface SelfEditableDetails {
  maritalStatus: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
}

/** The API sends `meta.editable` in column names; this maps them back. */
export const SELF_EDITABLE_COLUMNS: Record<string, keyof SelfEditableDetails> = {
  marital_status: "maritalStatus",
  address_line_1: "addressLine1",
  address_line_2: "addressLine2",
  city: "city",
  state: "state",
  postcode: "postcode",
  country: "country",
  personal_email: "personalEmail",
  personal_phone: "personalPhone",
};

export interface ExpiringDocument extends EmployeeDocument {
  employeeId: string;
  name: string | null;
  jobTitle: string | null;
}

/* ------------------------------------------------------------------ */
/*  Leaving                                                            */
/* ------------------------------------------------------------------ */

export type LeavingKind =
  | "resignation"
  | "dismissal"
  | "redundancy"
  | "retirement"
  | "end_of_contract"
  | "death_in_service";

export type OffboardingStatus = "in_progress" | "cleared" | "cancelled";

export interface OffboardingItem {
  id: string;
  kind: "task" | "asset";
  isAsset: boolean;
  title: string;
  description: string | null;
  ownerRole: string;
  assetTag: string | null;
  replacementCostKobo: number | null;
  isRequired: boolean;
  dueOn: string | null;
  /** Completed *or* waived with a reason. Either way it is off the list. */
  isClosed: boolean;
  /** Narrower: a waived asset is closed and not returned. */
  wasReturned: boolean;
  isOverdue: boolean;
  completedAt: string | null;
  completedBy: string | null;
  waivedReason: string | null;
  /** Raised by another module (`operations`: the exit clearance's deduction), or null when HR added it. */
  source?: string | null;
  /** When HR last changed the value by hand; a later sync never overwrites it. */
  costEditedAt?: string | null;
}

export interface Offboarding {
  id: string;
  employeeId: string;
  name: string | null;
  jobTitle: string | null;
  department: string | null;
  kind: LeavingKind;
  kindLabel: string;
  /** The distinction attrition analysis rests on. */
  isVoluntary: boolean;
  status: OffboardingStatus;
  statusLabel: string;
  noticeGivenOn: string | null;
  /** When they stop coming in. Often before the employment ends. */
  lastWorkingDay: string | null;
  leavingOn: string;
  noticeDays: number | null;
  hasGone: boolean;
  progress: number;
  outstandingItems: number;
  isClearable: boolean;
  /** Cleared, and the employment ends on the leaving date (a daily job ends it). */
  awaitsLeavingDate?: boolean;
  /** Sign-in is switched off on the leaving date. Ticked by default. */
  disableSignIn?: boolean;
  /** When their roles, project places and (if ticked) sign-in were taken away. */
  accessRevokedAt?: string | null;
  /* Only on the detail response. */
  reason?: string | null;
  isRehireable?: boolean | null;
  leavingFor?: string | null;
  warrantsExitInterview?: boolean;
  exitInterviewAt?: string | null;
  exitInterviewBy?: string | null;
  exitInterviewNotes?: string | null;
  exitRating?: number | null;
  outstandingLeaveDays?: number | null;
  finalSettlementKobo?: number | null;
  /** How HR reached the figure; printed on the payslip line (H15). */
  finalSettlementNote?: string | null;
  settledAt?: string | null;
  /** Where the settlement stands with payroll: waiting for the next run, or paid on one. */
  finalPay?: {
    amountKobo: number;
    status: "waiting" | "paid";
    runId: string | null;
    runReference: string | null;
    paidAt: string | null;
  } | null;
  unreturnedCostKobo?: number;
  /** What payroll gets: the figure owed less equipment not returned. */
  netSettlementKobo?: number | null;
  clearedAt?: string | null;
  items?: OffboardingItem[];
}

/* ------------------------------------------------------------------ */
/*  Workforce                                                          */
/* ------------------------------------------------------------------ */

export interface WorkforceInsights {
  window: { from: string; to: string };
  turnover: {
    leavers: number;
    /** Never summed with involuntary — they are different problems. */
    voluntary: number;
    involuntary: number;
    /** Excluded from every rate above, reported so the list adds up. */
    excludedDeathsInService: number;
    headcountStart: number;
    headcountEnd: number;
    /** The denominator that survives an institution changing size. */
    averageHeadcount: number;
    ratePercent: number;
    voluntaryRatePercent: number;
    byDepartment: {
      department: string;
      leavers: number;
      /** Against the department's own size, not the institution's. */
      ratePercent: number;
    }[];
    byTenureBand: { label: string; leavers: number }[];
    /** A hiring or induction problem, not a retention one. */
    leftWithinFirstYear: number;
  };
  movement: { joiners: number; leavers: number; net: number };
  tenure: { label: string; count: number; sharePercent: number }[];
  spanOfControl: {
    managers: number;
    averageSpan: number;
    widestSpan: number;
    /** Outliers, never a ranking. */
    wideSpans: { managerId: string; name: string | null; reports: number }[];
    /** More than one is an org chart somebody stopped maintaining. */
    unmanaged: number;
    wideSpanThreshold: number;
  };
  absence: {
    ratePercent: number;
    totalDays: number;
    spells: number;
    peopleAffected?: number;
    /** A distribution, never a league table. */
    bradford: { low: number; moderate: number; high: number; veryHigh: number };
    byDepartment: { department: string; days: number; spells: number }[];
  };
  leaveLiability: {
    days: number;
    kobo: number;
    peopleWithBalance: number;
    /** Balances with no salary on file — the money figure understates by this. */
    withoutSalary: number;
    byDepartment: { department: string; days: number; kobo: number }[];
  };
}

/* ------------------------------------------------------------------ */
/*  Employee relations                                                 */
/* ------------------------------------------------------------------ */

export type CaseKind = "disciplinary" | "grievance";

export type CaseStatus =
  | "open"
  | "investigating"
  | "hearing_scheduled"
  | "decided"
  | "under_appeal"
  | "closed"
  | "withdrawn";

export type CaseOutcome =
  | "no_case"
  | "informal_advice"
  | "verbal_warning"
  | "written_warning"
  | "final_written_warning"
  | "dismissal"
  | "upheld"
  | "partly_upheld"
  | "not_upheld";

export interface RelationsCaseEvent {
  id: string;
  kind: string;
  note: string | null;
  /** Absent on an employee's own view — they never receive HR-only entries. */
  visibility?: string;
  occurredAt: string;
  recordedBy?: string | null;
}

export interface RelationsCase {
  id: string;
  reference: string;
  kind: CaseKind;
  kindLabel: string;
  category: string | null;
  status: CaseStatus;
  statusLabel: string;
  summary: string;
  openedOn: string;
  ageInDays: number;
  subjectId: string | null;
  subjectName: string | null;
  /** "Raised anonymously" when nobody is named — a state, not a gap. */
  raisedByName: string | null;
  outcome: CaseOutcome | null;
  outcomeLabel: string | null;
  outcomeOn: string | null;
  hasLiveWarning: boolean;
  warningExpiresOn: string | null;
  isAppealable: boolean;
  appealedAt: string | null;
  daysToResolve: number | null;
  /* Detail only. */
  detail?: string | null;
  investigator?: string | null;
  /** Null unless the reader may see HR-only material. */
  investigationFindings?: string | null;
  hearingAt?: string | null;
  heardBy?: string | null;
  companionOffered?: boolean | null;
  outcomeReason?: string | null;
  decidedBy?: string | null;
  appealGrounds?: string | null;
  appealOutcome?: string | null;
  appealReason?: string | null;
  canSeePrivateNotes?: boolean;
  events?: RelationsCaseEvent[];
}

/**
 * What a party sees of their own case.
 *
 * Deliberately narrower than `RelationsCase`. The `me/` routes never send who
 * raised it, who else it names, or how long it took to resolve — those are the
 * institution's view of a case, not a party's, and one of them is the whole
 * point of anonymity. Typing this as `RelationsCase` would have let a screen
 * read `raisedByName` off a payload that never carries it.
 */
export interface MyCase {
  id: string;
  reference: string;
  kind: CaseKind;
  kindLabel: string;
  status: CaseStatus;
  statusLabel: string;
  summary: string;
  openedOn: string;
  outcome: CaseOutcome | null;
  outcomeLabel: string | null;
  outcomeOn: string | null;
  warningExpiresOn: string | null;
  hasLiveWarning: boolean;
  isAppealable: boolean;
  appealedAt: string | null;
  /* Detail only. */
  detail?: string | null;
  hearingAt?: string | null;
  companionOffered?: boolean | null;
  outcomeReason?: string | null;
  appealGrounds?: string | null;
  appealOutcome?: string | null;
  appealReason?: string | null;
  /** Served letters and procedural steps. Never the working notes. */
  events?: MyCaseEvent[];
}

export interface MyCaseEvent {
  id: string;
  kind: string;
  note: string | null;
  occurredAt: string;
}

export interface LiveWarning extends RelationsCase {
  expiresOn: string | null;
  daysUntilExpiry: number | null;
}

export interface RelationsInsights {
  volume: {
    open: number;
    openDisciplinaries: number;
    openGrievances: number;
    raisedLast90Days: number;
    /** The figure nobody looks at and everybody should. */
    runningOverNinetyDays: number;
  };
  resolution: {
    resolved: number;
    /** Median, not mean: one two-year case would drag a mean past recognition. */
    medianDays: number | null;
    longestDays: number | null;
  };
  outcomes: {
    outcome: CaseOutcome;
    label: string;
    count: number;
    sharePercent: number;
  }[];
  hotspots: {
    departments: {
      department: string;
      count: number;
      disciplinaries: number;
      grievances: number;
    }[];
    /** Said out loud: a category that vanishes reads as zero. */
    withheldGroups: number;
    minimumGroupSize: number;
  };
  liveWarnings: {
    total: number;
    byLevel: Record<string, number>;
    expiringWithin30Days: number;
  };
  /** Gaps, not a compliance percentage — 94% hides the six that get litigated. */
  procedure: {
    hearingsWithoutCompanionOffer: number;
    decisionsWithoutReasons: number;
    decidedWithoutInvestigation: number;
    appealsOutstanding: number;
  };
  asAt: string;
}

/* ------------------------------------------------------------------ */
/*  Performance                                                        */
/* ------------------------------------------------------------------ */

export interface KpiPoint {
  /**
   * The measurement behind this point.
   *
   * Carried so a reading typed in wrong can be taken back out from the chart
   * it is wrong on. Without it `DELETE /hrm/measurements/{id}` had no possible
   * caller: nothing else in the payload names a measurement.
   */
  id: string;
  date: string;
  label: string;
  value: number;
  /** Carried per point, so a mid-period revision shows as a step. */
  target: number;
  attainment: number;
  note: string | null;
}

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  change: number;
  /** Rising is only good when higher is better. */
  isImprovement: boolean;
}

export interface Kpi {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;

  metricType: MetricType;
  metricTypeLabel: string;
  direction: MetricDirection;
  directionLabel: string;
  unit: string | null;
  weight: number;

  target: number;
  baseline: number | null;
  current: number | null;
  /** Null when nothing has been measured. This is never 0%. */
  attainment: number | null;

  status: KpiStatus;
  statusLabel: string;
  countsTowardsScore: boolean;

  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  isCurrent: boolean;

  measurementCount?: number;
  employee?: { id: string; name: string | null; jobTitle: string };
  createdAt: string | null;
}

/** The detail behind a chart: a KPI plus its whole series. */
export interface KpiDetail extends Omit<Kpi, "measurementCount" | "employee"> {
  measurements: number;
  series: KpiPoint[];
  /** Null with fewer than two readings — one point is not a trend. */
  trend: KpiTrend | null;
}

export interface Milestone {
  id: string;
  employeeId: string;
  kpiId: string | null;
  title: string;
  description: string | null;
  dueOn: string;
  achievedOn: string | null;
  status: MilestoneStatus;
  statusLabel: string;
  isOpen: boolean;
  /** Open and past its date. */
  isOverdue: boolean;
  /** Delivered, but after the date. A different fact. */
  wasLate: boolean;
  daysLate: number;
  countsTowardsScore: boolean;
  weight: number;
  employee?: { id: string; name: string | null; jobTitle: string };
  createdAt: string | null;
}

export interface EmployeePerformance {
  employee: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  summary: {
    kpiAttainment: number | null;
    /** How much of the picture the attainment covers. */
    kpisMeasured: number;
    kpisTotal: number;
    milestoneAttainment: number | null;
    milestonesAchieved: number;
    milestonesCounted: number;
  };
  kpis: KpiDetail[];
  milestones: {
    planned: number;
    inProgress: number;
    achieved: number;
    missed: number;
    cancelled: number;
    overdue: number;
    /** Achieved, but after the date. */
    deliveredLate: number;
    items: {
      id: string;
      title: string;
      dueOn: string;
      achievedOn: string | null;
      status: MilestoneStatus;
      statusLabel: string;
      isOverdue: boolean;
      wasLate: boolean;
      daysLate: number;
      weight: number;
      kpiId: string | null;
    }[];
  };
  reviews: {
    id: string;
    cycle: string | null;
    periodEnd: string | null;
    label: string;
    selfRating: number | null;
    managerRating: number | null;
    /** Positive means they rated themselves higher. */
    gap: number | null;
    kpiAttainment: number | null;
    milestoneAttainment: number | null;
    metOn: string | null;
  }[];
}

export interface CohortPerformance {
  people: {
    employeeId: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
    attainment: number | null;
    measured: number;
    total: number;
  }[];
  distribution: { label: string; people: number; share: number }[];
  summary: {
    measured: number;
    total: number;
    /** Mean and median together — they disagree, and that is the point. */
    mean: number | null;
    median: number | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Reviews                                                            */
/* ------------------------------------------------------------------ */

export interface ReviewCycle {
  id: string;
  name: string;
  description: string | null;
  /** The period reviewed, not the window the paperwork is written in. */
  periodStart: string;
  periodEnd: string;
  dueOn: string | null;
  status: CycleStatus;
  statusLabel: string;
  acceptsReviews: boolean;
  isOverdue: boolean;
  reviewCount?: number;
  progress?: {
    total: number;
    awaitingSelf: number;
    awaitingManager: number;
    awaitingMeeting: number;
    complete: number;
  };
  reviews?: PerformanceReview[];
  createdAt: string | null;
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  status: ReviewStatus;
  statusLabel: string;
  isOpen: boolean;
  /** Whose turn it is: "employee", "manager", "meeting", or null. */
  waitingOn: "employee" | "manager" | "meeting" | null;

  selfRating: number | null;
  managerRating: number | null;
  /** Reported, never averaged away. */
  gap: number | null;

  kpiAttainment: number | null;
  milestoneAttainment: number | null;

  selfAssessment: string | null;
  managerComments: string | null;
  strengths: string | null;
  development: string | null;
  objectives: string | null;

  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  metOn: string | null;
  completedAt: string | null;

  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  cycle?: {
    id: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    dueOn: string | null;
  } | null;
  reviewer?: string | null;
  createdAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tasks                                                              */
/* ------------------------------------------------------------------ */

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  priority: TaskPriority;
  priorityLabel: string;
  status: TaskStatus;
  statusLabel: string;
  isOpen: boolean;
  isBlocked: boolean;
  /** Its own field, because "stuck on what" is the question. */
  blockedReason: string | null;
  isOverdue: boolean;
  daysLate: number;
  kpiId: string | null;
  milestoneId: string | null;
  assignee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  } | null;
  assignedBy?: string | null;
  completedAt: string | null;
  createdAt: string | null;
}

export interface TaskSummary {
  total: number;
  open: number;
  inProgress: number;
  blocked: number;
  done: number;
  cancelled: number;
  overdue: number;
  dueThisWeek: number;
  /** Null when there is nothing to rate. Excludes cancelled tasks. */
  completionRate: number | null;
}

/* ------------------------------------------------------------------ */
/*  Timesheets                                                         */
/* ------------------------------------------------------------------ */

export interface TimePolicy {
  id: string;
  workingDays: number;
  /** 1 = Monday … 7 = Sunday. Use this, not the bitmask. */
  workingDayNumbers: number[];
  workingDaysPerWeek: number;
  standardMinutes: number;
  standardHours: number;
  weeklyMinutes: number;
  weeklyHours: number;
  dayStartsAt: string;
  graceMinutes: number;
  breakMinutes: number;
  /** Null means a forgotten day stays open for a human. */
  autoCloseAfterMinutes: number | null;
  requiresApproval: boolean;
  allowsManualEntry: boolean;
  updatedAt: string | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  /** The reader's own day — only another HR manager may decide it. */
  isMine?: boolean;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockIn: string | null;
  clockOut: string | null;
  /** The counted figure — zero for an open or rejected day. */
  minutes: number;
  hours: number;
  lateMinutes: number;
  wasLate: boolean;
  status: TimeEntryStatus;
  statusLabel: string;
  isOpen: boolean;
  counts: boolean;
  isEditable: boolean;
  awaitsApproval: boolean;
  source: string;
  /** Typed in or auto-closed: a recollection, not a measurement. */
  isEstimated: boolean;
  workLocation: string | null;
  note: string | null;
  rejectionReason: string | null;
  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  approvedBy?: string | null;
  approvedAt: string | null;
}

/** One day in a week view, including the days with nothing on them. */
export interface TimesheetDay {
  date: string;
  label: string;
  isWorkingDay: boolean;
  expectedMinutes: number;
  entry: {
    id: string;
    clockInAt: string | null;
    clockOutAt: string | null;
    clockIn: string | null;
    clockOut: string | null;
    minutes: number;
    hours: number;
    lateMinutes: number;
    wasLate: boolean;
    status: TimeEntryStatus;
    statusLabel: string;
    isOpen: boolean;
    awaitsApproval: boolean;
    isEditable: boolean;
    isEstimated: boolean;
    source: string;
    workLocation: string | null;
    note: string | null;
    rejectionReason: string | null;
  } | null;
  /**
   * Approved leave or a public holiday on a working day. Expected minutes are
   * already reduced (to zero, or half for a half day).
   */
  off?: { kind: "leave" | "holiday"; name: string; isHalfDay: boolean } | null;
  /**
   * A working day, in the past, with nothing recorded and no approved leave
   * or holiday covering it. Today is never absent.
   */
  isAbsent: boolean;
}

export interface TimesheetTotals {
  workedMinutes: number;
  workedHours: number;
  expectedMinutes: number;
  expectedHours: number;
  /** Signed. Negative is a shortfall, and the sign is the finding. */
  balanceMinutes: number;
  balanceHours: number;
  lateDays: number;
  lateMinutes: number;
  absentDays: number;
  /** Days still signed in — they contribute nothing to the worked total. */
  openDays: number;
  estimatedDays: number;
  awaitingApproval: number;
  requiresApproval: boolean;
}

export interface TimesheetWeek {
  from: string;
  to: string;
  days: TimesheetDay[];
  totals: TimesheetTotals;
}

export interface MyTimesheet {
  employeeId: string;
  canRecordTime: boolean;
  /** Null when not signed in — a state, not a missing record. */
  openEntry: TimeEntry | null;
  week: TimesheetWeek;
  policy: TimePolicy;
}

export interface TimesheetRosterRow {
  employeeId: string;
  name: string | null;
  jobTitle: string;
  department: string | null;
  signedInNow: boolean;
  totals: TimesheetTotals;
}

export interface ContractWatchRow {
  contractId: string;
  employeeId: string;
  name: string | null;
  jobTitle: string;
  endsOn: string | null;
  daysRemaining: number | null;
}

/** Somebody holding a role on HR's roles board. */
export interface HrRoleHolder {
  userId: string;
  /** Null for somebody with no employment record (they can't be given a role from HR). */
  employeeId: string | null;
  name: string;
  email: string;
  /** Given by the system, not by a person: not removable here. */
  automatic: boolean;
  /** Why it was given automatically: `reporting_line` (the Line Manager role, with a first direct report). */
  source?: "reporting_line" | null;
}

/**
 * A role this person may give from HR's roles board (roles redesign, phase
 * 3a): only roles whose permissions they hold themselves, and a role carrying
 * Organisation admin or Confidential access only for an organisation admin.
 */
export interface HrRole {
  id: string;
  name: string;
  description: string | null;
  /** One of the roles every organisation is set up with. */
  seeded: boolean;
  /** The Line Manager role: the reporting line gives it to everybody with a direct report. */
  followsReportingLine: boolean;
  holders: HrRoleHolder[];
}

/* ------------------------------------------------------------------ */
/*  Leave                                                               */
/* ------------------------------------------------------------------ */

export type LeaveAccrual = "annual" | "monthly" | "none";

export type LeaveStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "recalled";

/**
 * A half day applies only to the first or last day of an absence.
 * Anything in between is a whole day by definition.
 */
export type DayPortion = "full" | "morning" | "afternoon";

/**
 * A kind of leave and its rules.
 *
 * Everything is in **days**. The API stores half-day units and converts on the
 * way out, so nothing on this side should ever multiply by two.
 */
export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  colour: string | null;
  isPaid: boolean;
  isActive: boolean;
  accrual: LeaveAccrual;
  accrualLabel: string;
  /** False for compassionate or unpaid leave: granted case by case. */
  hasBalance: boolean;
  daysPerYear: number;
  maxCarryOverDays: number | null;
  carryOverExpiresMonth: number | null;
  carryOverExpiresDay: number | null;
  requiresApproval: boolean;
  minNoticeDays: number | null;
  maxConsecutiveDays: number | null;
  allowsHalfDays: boolean;
  allowsNegativeBalance: boolean;
  /** H8: starters and leavers get a share of an up-front entitlement. On by default. */
  prorateForStarters?: boolean;
  minimumServiceMonths: number | null;
}

export interface PublicHoliday {
  id: string;
  name: string;
  observedOn: string;
  location: string | null;
  isNationwide: boolean;
  /** The office is shut but the day still comes out of an entitlement. */
  consumesLeave: boolean;
}

/**
 * One booked absence.
 *
 * `days` is the figure frozen when the request was made, not a recalculation —
 * changing the working week later must not move what somebody was already
 * granted. `leaveTypeName` is frozen for the same reason.
 */
export interface LeaveRequest {
  id: string;
  employeeId: string;
  /** The reader's own request — nobody decides their own leave. */
  isMine?: boolean;
  leaveTypeId: string | null;
  leaveTypeName: string;
  startsOn: string;
  endsOn: string;
  startPortion: DayPortion;
  endPortion: DayPortion;
  days: number;
  status: LeaveStatus;
  statusLabel: string;
  isOpen: boolean;
  isGranted: boolean;
  /** Whether these days are still counted against the balance. */
  holdsDays: boolean;
  reason: string | null;
  contactWhileAway: string | null;
  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  cover?: { id: string; name: string | null } | null;
  leaveType?: {
    id: string;
    name: string;
    colour: string | null;
    isPaid: boolean;
  } | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote: string | null;
  requestedAt: string | null;
}

/**
 * What one person has left of one type.
 *
 * `remainingDays` already nets off `pendingDays` — that is what stops somebody
 * booking the same fortnight twice — so it is the only figure to show as
 * "available". `carryOverLapsed` explains a zero that would otherwise look
 * like an error: "your 4 carried days expired in March" is a different
 * sentence from "you have 0 carried days".
 */
export interface LeaveBalance {
  typeId: string;
  name: string;
  code: string;
  colour: string | null;
  isPaid: boolean;
  tracksBalance: boolean;
  available: boolean;
  year: number;
  entitledDays: number;
  accruedDays: number;
  carriedDays: number;
  adjustmentDays: number;
  takenDays: number;
  pendingDays: number;
  remainingDays: number;
  carryOverLapsed: boolean;
  /** HR's view only: every manual adjustment, newest first (D5). They add up. */
  adjustments?: LeaveAdjustment[];
}

/** One manual change to a balance: who, when, how many days, and why. */
export interface LeaveAdjustment {
  id: string;
  /** Signed: negative takes days back. */
  days: number;
  note: string;
  by: string | null;
  at: string | null;
}

export interface MyLeave {
  year: number;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  /** The line manager a booking goes to; null means it goes to HR. */
  managerName?: string | null;
}

/** How many of a team are away on a given day. */
export interface LeaveCoverage {
  away: number;
  team: number;
  names: string[];
}

/**
 * What a range would actually cost, asked before committing to it.
 *
 * `calendarDays` and `days` differ for every absence that spans a weekend, and
 * showing only the first is how somebody finds out on their payslip.
 */
export interface LeaveQuote {
  days: number;
  calendarDays: number;
  workingDays: number;
  holidays: { name: string; observedOn: string }[];
  coverage: LeaveCoverage;
}

export interface LeaveTypeInput {
  name: string;
  code: string;
  description?: string;
  isPaid?: boolean;
  accrual: LeaveAccrual;
  /** In days. The API converts to the half-day units it stores. */
  daysPerYear: number;
  maxCarryOverDays?: number | null;
  carryOverExpiresMonth?: number | null;
  carryOverExpiresDay?: number | null;
  requiresApproval?: boolean;
  minNoticeDays?: number | null;
  maxConsecutiveDays?: number | null;
  allowsHalfDays?: boolean;
  allowsNegativeBalance?: boolean;
  prorateForStarters?: boolean;
  minimumServiceMonths?: number | null;
  colour?: string | null;
  isActive?: boolean;
}

export interface LeaveRequestInput {
  leaveTypeId: string;
  startsOn: string;
  endsOn: string;
  startPortion?: DayPortion;
  endPortion?: DayPortion;
  reason?: string;
  coveringEmployeeId?: string | null;
  contactWhileAway?: string;
}

/* ------------------------------------------------------------------ */
/*  Shifts, rosters and attendance                                      */
/* ------------------------------------------------------------------ */

export type SwapStatus =
  | "pending"
  | "accepted"
  | "approved"
  | "declined"
  | "cancelled";

export type OvertimeKind = "weekday" | "rest_day" | "public_holiday";

/**
 * What actually happened on one rostered day.
 *
 * The distinction that matters is `on_leave` against `absent`. Both mean "not
 * here"; only the second is anybody's problem, and a screen that colours them
 * the same either accuses people who booked their holiday properly or buries
 * the one person who has stopped turning up.
 */
export type AttendanceState =
  | "worked"
  | "late"
  | "on_leave"
  | "holiday"
  | "absent"
  | "scheduled"
  | "open";

/**
 * A named shift and its hours.
 *
 * `expectedMinutes` comes from the server. Subtracting `endsAt` from `startsAt`
 * in the browser gives minus sixteen hours for a night shift, and taking the
 * absolute value of that gives sixteen.
 */
export interface ShiftPattern {
  id: string;
  name: string;
  code: string;
  description: string | null;
  colour: string | null;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
  breakMinutes: number;
  expectedMinutes: number;
  expectedHours: number;
  spanMinutes: number;
  /** Set means a flat paid length regardless of the clock. */
  paidMinutes: number | null;
  location: string | null;
  isActive: boolean;
}

/**
 * One rostered day.
 *
 * The hours are the ones frozen when the shift was assigned, not the pattern's
 * current ones — editing a pattern must not rewrite what somebody was asked to
 * work last month.
 */
export interface RosterAssignment {
  id: string;
  employeeId: string;
  shiftPatternId: string;
  worksOn: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
  expectedMinutes: number;
  expectedHours: number;
  location: string | null;
  note: string | null;
  /** A draft is not something the person on it should plan around. */
  isPublished: boolean;
  publishedAt: string | null;
  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  shift?: {
    id: string;
    name: string;
    code: string;
    colour: string | null;
  } | null;
}

/**
 * A request to change shifts.
 *
 * `awaitsColleague` and `awaitsApproval` are separate because they are separate
 * queues read by different people. A manager should never be shown a sign-off
 * for something the colleague has not agreed to.
 */
export interface ShiftSwapRequest {
  id: string;
  requestedById: string;
  requestedToId: string;
  /** The reader asked, or was asked — so they can't sign it off. */
  involvesMe?: boolean;
  /**
   * The reader's part: the requester may withdraw, the colleague answers.
   * Null for anybody else (an HR manager reading the queue).
   */
  myRole?: "requester" | "colleague" | null;
  status: SwapStatus;
  statusLabel: string;
  isOpen: boolean;
  awaitsColleague: boolean;
  awaitsApproval: boolean;
  /** One shift handed over, nothing back. */
  isGiveaway: boolean;
  isFulfillable: boolean;
  reason: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  decidedBy?: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  requestedBy?: { id: string; name: string | null };
  requestedTo?: { id: string; name: string | null };
  offered?: RosterAssignment | null;
  wanted?: RosterAssignment | null;
  requestedAt: string | null;
}

/** What an hour past the expectation is worth. */
export interface OvertimeRule {
  id: string;
  kind: OvertimeKind;
  kindLabel: string;
  /** For display. Anything that has to round uses the basis points. */
  multiplier: number;
  multiplierBasisPoints: number;
  /** Null means uncapped. Minutes past a cap are still reported as worked. */
  dailyCapMinutes: number | null;
  weeklyCapMinutes: number | null;
  thresholdMinutes: number;
  requiresApproval: boolean;
  isActive: boolean;
}

export interface OvertimeForDay {
  kind: OvertimeKind;
  workedMinutes: number;
  payableMinutes: number;
  /** Worked but outside a cap. Kept visible rather than dropped. */
  uncappedMinutes: number;
}

/** One person, one day, reconciled. */
export interface AttendanceDay {
  employeeId: string;
  employeeName: string | null;
  department: string | null;
  location: string | null;
  date: string;
  state: AttendanceState;
  stateLabel: string;
  needsExplaining: boolean;
  expectedMinutes: number;
  workedMinutes: number;
  /** Negative is short, positive is over. */
  varianceMinutes: number;
  lateMinutes: number;
  isEstimated: boolean;
  shift: {
    id: string;
    name: string | null;
    startsAt: string;
    endsAt: string;
    crossesMidnight: boolean;
  } | null;
  leave: {
    id: string;
    type: string;
    status: string;
    isApproved: boolean;
  } | null;
  holiday: string | null;
  overtime: OvertimeForDay;
}

export interface OvertimeTotal {
  kind: OvertimeKind;
  label: string;
  workedMinutes: number;
  payableMinutes: number;
  uncappedMinutes: number;
  multiplier: number;
}

/**
 * Totals for a set of days.
 *
 * `attendanceRate` excludes leave and closures from its denominator entirely
 * rather than counting them as successes — a week with two public holidays
 * would otherwise flatter everybody. Null when nothing counted.
 */
export interface AttendanceTotals {
  days: number;
  counts: Record<AttendanceState, number>;
  expectedMinutes: number;
  workedMinutes: number;
  varianceMinutes: number;
  lateMinutes: number;
  lateDays: number;
  unexplainedDays: number;
  attendanceRate: number | null;
  overtime: OvertimeTotal[];
}

export interface AttendanceGroup extends AttendanceTotals {
  label: string;
  people: number;
}

export interface AttendanceReport {
  groups: AttendanceGroup[];
  totals: AttendanceTotals;
  from: string;
  to: string;
  groupedBy: "department" | "location" | null;
}

export interface ShiftCoverage {
  shiftPatternId: string;
  name: string;
  code: string | null;
  startsAt: string;
  endsAt: string;
  rostered: number;
  names: string[];
}

export interface ShiftPatternInput {
  name: string;
  code: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight?: boolean;
  breakMinutes?: number;
  paidMinutes?: number | null;
  location?: string | null;
  colour?: string | null;
  isActive?: boolean;
}

export interface RosterInput {
  shiftPatternId: string;
  from: string;
  to?: string | null;
  /** ISO weekday numbers, 1 (Mon) to 7. Empty means every day in the range. */
  weekdays?: number[];
  location?: string | null;
  note?: string;
  publish?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Recruitment                                                         */
/* ------------------------------------------------------------------ */

export type RequisitionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "declined"
  | "on_hold"
  | "filled"
  | "cancelled";

export type RequisitionReason =
  | "new_role"
  | "replacement"
  | "expansion"
  | "temporary";

/**
 * What a stage *means*, separately from what it is called.
 *
 * Stage names belong to the institution, so a board must never decide anything
 * by matching on one — the day somebody renames "Screening" to "Triage" is the
 * day that logic breaks.
 */
export type StageKind =
  | "applied"
  | "screening"
  | "interview"
  | "assessment"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export type ApplicationStatus = "active" | "hired" | "rejected" | "withdrawn";

export type CandidateSource =
  | "referral"
  | "job_board"
  | "agency"
  | "career_site"
  | "social_media"
  | "internal"
  | "outreach"
  | "other";

export type InterviewKind =
  | "phone"
  | "video"
  | "in_person"
  | "technical"
  | "panel"
  | "final";

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no_show";

/** No middle option, deliberately: a neutral verdict is where indecision hides. */
export type ScorecardVerdict = "strong_yes" | "yes" | "no" | "strong_no";

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";

export interface JobRequisition {
  id: string;
  reference: string;
  jobTitle: string;
  department: string | null;
  location: string | null;
  employmentType: EmploymentType;
  employmentTypeLabel: string;
  headcount: number;
  reason: RequisitionReason;
  reasonLabel: string;
  /** A replacement's salary is already in the payroll run. */
  isBudgeted: boolean;
  salaryMinKobo: number | null;
  salaryMaxKobo: number | null;
  description: string | null;
  justification: string | null;
  targetStartOn: string | null;
  status: RequisitionStatus;
  statusLabel: string;
  isOpen: boolean;
  canAdvertise: boolean;
  approvedAt: string | null;
  decisionNote: string | null;
  filledAt: string | null;
  /** From approval, not from the advert. */
  daysOpen: number | null;
  daysToFill: number | null;
  hiringManager?: { id: string; name: string | null } | null;
  replacing?: { id: string; name: string | null } | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  postings?: JobPosting[];
  applicationCount?: number;
  createdAt: string | null;
}

export interface JobPosting {
  id: string;
  requisitionId: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  channel: string | null;
  externalUrl: string | null;
  /** Per posting, so cost-per-hire is attributable to a channel. */
  costKobo: number;
  isPublished: boolean;
  isOpen: boolean;
  publishedAt: string | null;
  closesOn: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  kind: StageKind;
  kindLabel: string;
  position: number;
  colour: string | null;
  isTerminal: boolean;
  /** Days before an application sitting here counts as stale. */
  staleAfterDays: number | null;
  isActive: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  currentEmployer: string | null;
  currentTitle: string | null;
  location: string | null;
  cvPath: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  referredBy?: { id: string; name: string | null } | null;
  applications?: JobApplication[];
  createdAt: string | null;
}

export interface JobApplication {
  id: string;
  candidateId: string;
  requisitionId: string;
  postingId: string | null;
  stageId: string | null;
  status: ApplicationStatus;
  statusLabel: string;
  isOpen: boolean;
  source: CandidateSource;
  sourceLabel: string;
  appliedAt: string;
  stageChangedAt: string | null;
  daysInStage: number;
  /** Nobody has touched this in longer than the stage allows. */
  isStale: boolean;
  rating: number | null;
  coverNote: string | null;
  rejectionReason: string | null;
  closedAt: string | null;
  daysToClose: number | null;
  candidate?: {
    id: string;
    name: string;
    email: string;
    currentTitle: string | null;
  };
  stage?: {
    id: string;
    name: string;
    kind: StageKind;
    colour: string | null;
  } | null;
  requisition?: { id: string; reference: string; jobTitle: string } | null;
  interviews?: Interview[];
  offers?: JobOffer[];
}

export interface StageEvent {
  id: string;
  stage: string | null;
  kind: StageKind | null;
  daysInPrevious: number | null;
  movedBy: string | null;
  note: string | null;
  at: string | null;
}

export interface Interview {
  id: string;
  applicationId: string;
  kind: InterviewKind;
  kindLabel: string;
  needsLocation: boolean;
  status: InterviewStatus;
  statusLabel: string;
  isOpen: boolean;
  isUpcoming: boolean;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  location: string | null;
  meetingUrl: string | null;
  agenda: string | null;
  cancellationReason: string | null;
  /** What the hiring decision is actually waiting on. */
  scorecardsOutstanding: number;
  panel?: {
    id: string;
    employeeId: string;
    name: string | null;
    focus: string | null;
    isLead: boolean;
  }[];
  candidate?: { id: string; name: string } | null;
}

export interface ScorecardRating {
  criterion: string;
  rating: number;
  comment?: string | null;
}

export interface InterviewScorecard {
  id: string;
  interviewId: string;
  employeeId: string;
  verdict: ScorecardVerdict;
  verdictLabel: string;
  isPositive: boolean;
  /** Strong verdicts count double. */
  weight: number;
  ratings: ScorecardRating[] | null;
  averageRating: number | null;
  strengths: string | null;
  concerns: string | null;
  notes: string | null;
  isSubmitted: boolean;
  submittedAt: string | null;
  interviewer?: { id: string; name: string | null; jobTitle: string };
}

/**
 * What I am allowed to see of a panel.
 *
 * `visible` false is not an error: it means I have not written mine up yet, and
 * the screen has to say so rather than showing an empty list that reads as
 * nobody else having bothered either.
 */
export interface PanelView {
  visible: boolean;
  scorecards: InterviewScorecard[];
  outstanding: number;
  weight: number | null;
}

export interface JobOffer {
  id: string;
  applicationId: string;
  jobTitle: string;
  department: string | null;
  employmentType: EmploymentType;
  employmentTypeLabel: string;
  salaryKobo: number;
  salaryPeriod: string;
  signingBonusKobo: number | null;
  startsOn: string | null;
  expiresOn: string | null;
  /** Past its date, whether or not anybody has tried to act on it. */
  hasLapsed: boolean;
  status: OfferStatus;
  statusLabel: string;
  isOpen: boolean;
  isWithCandidate: boolean;
  isAccepted: boolean;
  terms: string | null;
  notes: string | null;
  approvedBy?: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  daysToRespond: number | null;
  /** Set only once somebody accepted. The bridge into employment. */
  employeeId: string | null;
  application?: {
    id: string;
    candidateName: string | null;
    reference: string | null;
  } | null;
}

export interface BoardColumn {
  stageId: string;
  name: string;
  kind: StageKind;
  colour: string | null;
  count: number;
  stale: number;
  applications: JobApplication[];
}

export interface FunnelStage {
  name: string;
  kind: StageKind;
  reached: number;
  /** Against the stage before it — where the process actually leaks. */
  conversionFromPrevious: number | null;
  averageDaysToReach: number | null;
}

export interface RecruitmentFunnel {
  stages: FunnelStage[];
  total: number;
  /** Reported beside the funnel, never inside it. */
  withdrawn: number;
}

export interface SourceRow {
  source: CandidateSource;
  label: string;
  applications: number;
  hires: number;
  hireRate: number;
  rejected: number;
  withdrawn: number;
  active: number;
  isPaid: boolean;
  /** Posting cost attributed to this source, in proportion to volume. */
  spendKobo: number;
  /** A good hire rate with a terrible cost per hire is still a bad channel. */
  costPerHireKobo: number | null;
}

export interface TimeToFill {
  filled: number;
  averageDays: number | null;
  /** The number a hiring manager's experience actually matches. */
  medianDays: number | null;
  fastestDays: number | null;
  slowestDays: number | null;
}

export interface CostPerHire {
  advertisingSpendKobo: number;
  hires: number;
  perHireKobo: number | null;
  /** Says what the figure covers, so nobody reports it as the cost of hiring. */
  basis: string;
}

export interface RecruitmentOverview {
  openRoles: number;
  awaitingApproval: number;
  activeCandidates: number;
  hires: number;
  timeToFill: TimeToFill;
  costPerHire: CostPerHire;
  longestOpen: {
    id: string;
    reference: string;
    jobTitle: string;
    daysOpen: number | null;
  }[];
}

/* ---- recruitment: the Monday-morning half -------------------------- */

export interface StaleApplication {
  applicationId: string;
  candidateId: string;
  candidateName: string | null;
  requisitionId: string;
  reference: string | null;
  jobTitle: string | null;
  stage: string | null;
  daysInStage: number;
  allowedDays: number | null;
}

export interface AwaitingScorecard {
  interviewId: string;
  applicationId: string;
  candidateName: string | null;
  heldOn: string;
  /** A scorecard written a fortnight later is a recollection. */
  daysWaiting: number;
  waitingOn: { employeeId: string; name: string | null }[];
}

export interface OfferQueueRow {
  offerId: string;
  applicationId?: string;
  candidateName: string | null;
  jobTitle?: string;
  salaryKobo?: number;
  waitingSince?: string | null;
  expiresOn?: string | null;
  daysLeft?: number | null;
}

/**
 * Everything waiting on a human, right now.
 *
 * Deliberately separate from the quarterly analytics: a recruiter opening this
 * on Monday wants names to phone, not a time-to-fill figure.
 */
export interface RecruitmentAttention {
  requisitionsAwaitingApproval: {
    requisitionId: string;
    reference: string;
    jobTitle: string;
    requestedBy: string | null;
    waitingSince: string | null;
  }[];
  staleApplications: StaleApplication[];
  interviewsAwaitingScorecards: AwaitingScorecard[];
  offersAwaitingApproval: OfferQueueRow[];
  /** Approved but never sent — a different problem from awaiting approval. */
  offersUnsent: OfferQueueRow[];
  offersExpiringSoon: OfferQueueRow[];
}

export interface OfferOutcomes {
  total: number;
  counts: Record<OfferStatus, number>;
  /** Offers the candidate actually saw. Withdrawn ones are excluded. */
  decided: number;
  accepted: number;
  acceptanceRate: number | null;
  medianDaysToRespond: number | null;
  declineReasons: {
    candidateName: string | null;
    reason: string | null;
    salaryKobo: number;
    respondedAt: string | null;
  }[];
}

export interface InterviewerLoad {
  employeeId: string;
  name: string | null;
  interviews: number;
  submitted: number;
  outstanding: number;
  averageTurnaroundHours: number | null;
  /** Not a performance measure — but never saying no is not screening. */
  positiveRate: number | null;
  verdicts: Record<ScorecardVerdict, number>;
}

export interface StageDuration {
  stage: string;
  moves: number;
  averageDays: number;
  medianDays: number;
  slowestDays: number;
}

export interface RequisitionAgeing {
  bands: {
    under30: number;
    from30to60: number;
    from60to90: number;
    over90: number;
  };
  roles: {
    requisitionId: string;
    reference: string;
    jobTitle: string;
    department: string | null;
    hiringManager: string | null;
    daysOpen: number;
    band: string;
    applications: number;
    activeApplications: number;
    /** Open a while with nobody in the pipeline: sourcing, not deciding. */
    isSourcingProblem: boolean;
  }[];
}

export interface RequisitionInput {
  jobTitle: string;
  department?: string | null;
  location?: string | null;
  employmentType: EmploymentType;
  headcount?: number;
  reason?: RequisitionReason;
  replacingEmployeeId?: string | null;
  salaryMinKobo?: number | null;
  salaryMaxKobo?: number | null;
  description?: string;
  justification?: string;
  targetStartOn?: string | null;
  hiringManagerId?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Payroll                                                             */
/* ------------------------------------------------------------------ */

export type PayElementKind = "earning" | "deduction" | "employer_contribution";

export type PayElementBasis = "fixed" | "percent_of_basic" | "percent_of_gross";

export type StatutoryKind = "paye" | "pension" | "nhf" | "nsitf";

export type PayRunKind = "regular" | "off_cycle" | "back_pay";

export type PayRunStatus =
  | "draft"
  | "calculated"
  | "approved"
  | "paid"
  | "cancelled";

export type LoanKind = "loan" | "salary_advance";

export type LoanStatus = "active" | "suspended" | "settled" | "cancelled";

export interface PayElement {
  id: string;
  name: string;
  code: string;
  description: string | null;
  kind: PayElementKind;
  kindLabel: string;
  addsToGross: boolean;
  reducesNet: boolean;
  basis: PayElementBasis;
  basisLabel: string;
  isPercentage: boolean;
  amountKobo: number;
  /** For arithmetic. `ratePercent` is for display only. */
  rateBasisPoints: number;
  ratePercent: number;
  /** Per element, so a non-taxable transport allowance needs no special case. */
  isTaxable: boolean;
  isPensionable: boolean;
  sequence: number;
  isActive: boolean;
}

export interface PayProfileElementRow {
  id: string;
  elementId: string;
  name: string | null;
  code: string | null;
  kind: PayElementKind | null;
  /** Null means "use the element's own figure". */
  amountKoboOverride: number | null;
  rateBasisPointsOverride: number | null;
  startsOn: string | null;
  endsOn: string | null;
}

export interface PayProfile {
  id: string;
  employeeId: string;
  basicSalaryKobo: number;
  salaryPeriod: "year" | "month";
  monthlyBasicKobo: number;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCode: string | null;
  taxIdentificationNumber: string | null;
  pensionPin: string | null;
  pensionAdministrator: string | null;
  nhfNumber: string | null;
  isPensionExempt: boolean;
  isNhfExempt: boolean;
  isPayeExempt: boolean;
  canBePaid: boolean;
  /** A list, not a flag: "no account number, no PIN" is actionable. */
  missingDetails: string[];
  isActive: boolean;
  employee?: {
    id: string;
    name: string | null;
    jobTitle: string;
    department: string | null;
  };
  elements?: PayProfileElementRow[];
}

export interface StatutoryBand {
  id: string;
  position: number;
  /** The *width* of the band, not its upper bound. Null is the top band. */
  widthKobo: number | null;
  isTopBand: boolean;
  rateBasisPoints: number;
  ratePercent: number;
}

/**
 * A version of a statutory rule.
 *
 * Versioned, never edited — a run picks the one in force on its pay date, so a
 * rate change cannot retroactively alter what a past run should have been.
 */
export interface StatutorySchedule {
  id: string;
  kind: StatutoryKind;
  kindLabel: string;
  name: string;
  /** Editing one of these creates the institution's own copy. */
  isPlatformDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  employeeRateBasisPoints: number;
  employerRateBasisPoints: number;
  employeeRatePercent: number;
  employerRatePercent: number;
  isTaxRelief: boolean;
  config: Record<string, unknown> | null;
  isActive: boolean;
  bands?: StatutoryBand[];
}

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  reference: string;
  kind: LoanKind;
  kindLabel: string;
  /** An advance comes back in one go; a loan is scheduled. */
  recoveredInFull: boolean;
  principalKobo: number;
  outstandingKobo: number;
  instalmentKobo: number;
  instalmentsTotal: number;
  instalmentsPaid: number;
  progressPercent: number;
  startsOn: string;
  status: LoanStatus;
  statusLabel: string;
  isCollecting: boolean;
  /** A paused loan is still owed and still on the books. */
  isOutstanding: boolean;
  purpose: string | null;
  note: string | null;
  employee?: { id: string; name: string | null };
  approvedBy?: string | null;
  approvedAt: string | null;
}

export interface PayslipLine {
  id: string;
  code: string;
  name: string;
  kind: PayElementKind;
  kindLabel: string;
  amountKobo: number;
  /** Zero for an employer contribution: it is not a charge to the employee. */
  signedKobo: number;
  /** "8% of 500,000.00" — the only question anybody asks about a line. */
  basisNote: string | null;
  sequence: number;
}

/**
 * One person's frozen result for one run.
 *
 * Every figure is a copy taken at calculation, including the name and bank
 * details — so somebody who leaves still appears correctly on last March's
 * payroll.
 */
export interface Payslip {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankCode: string | null;
  basicKobo: number;
  grossKobo: number;
  taxableKobo: number;
  reliefKobo: number;
  payeKobo: number;
  pensionEmployeeKobo: number;
  pensionEmployerKobo: number;
  nhfKobo: number;
  nsitfKobo: number;
  otherDeductionsKobo: number;
  loanRepaymentKobo: number;
  totalDeductionsKobo: number;
  netKobo: number;
  employerCostKobo: number;
  /** Deductions that could not be taken without pushing net below zero. */
  uncollectedKobo: number;
  hasShortfall: boolean;
  isPayable: boolean;
  /** Gross less deductions equals net, exactly. Published as a check. */
  balances: boolean;
  isDistributed: boolean;
  /** When the payslip was released to the employee — not when they were paid. */
  distributedAt: string | null;
  /**
   * The month it pays for and when the money moved. Present wherever the
   * run is loaded (My pay's list and detail); `paidOn` is null until HR
   * marks the run paid.
   */
  period?: {
    start: string;
    end: string;
    payDate: string | null;
    paidOn: string | null;
    reference: string;
  } | null;
  lines?: PayslipLine[];
}

export interface PayrollRun {
  id: string;
  reference: string;
  kind: PayRunKind;
  kindLabel: string;
  coversEverybody: boolean;
  status: PayRunStatus;
  statusLabel: string;
  isRecalculable: boolean;
  /** Once frozen, no figure on any payslip moves again. */
  isFrozen: boolean;
  canPay: boolean;
  /** Maker-checker: false for the person who last worked the figures out. */
  mayApprove?: boolean;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  /** Chooses the statutory schedule, and the date the bank file carries. */
  payDate: string;
  grossKobo: number;
  deductionsKobo: number;
  netKobo: number;
  employerCostKobo: number;
  /** Gross plus employer contributions — not net plus them. */
  totalCostKobo: number;
  headcount: number;
  note: string | null;
  calculatedBy?: string | null;
  calculatedAt: string | null;
  approvedBy?: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  /**
   * D6: overtime that needs approval is paid on approved days only. The days
   * left out when the figures were worked out, frozen with the run.
   */
  overtimeExcluded?: {
    days: number;
    minutes: number;
    rows: { employeeId: string; employeeName: string | null; date: string; kind: string; minutes: number }[];
  };
  /** H15: leavers' final settlements this run carries (with the payslips). */
  finalSettlements?: {
    payslipId: string;
    employeeId: string;
    employeeName: string;
    amountKobo: number;
    note: string | null;
  }[];
  payslips?: Payslip[];
}

export interface BankFileRow {
  employeeName: string;
  employeeNumber: string | null;
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  amountKobo: number;
  narration: string;
}

export interface JournalLine {
  account: string;
  type: "expense" | "liability" | "asset";
  side: "debit" | "credit";
  amountKobo: number;
}

export interface PayrollExport {
  bankFile: {
    rows: BankFileRow[];
    totalKobo: number;
    /** Named rather than dropped: a file quietly a row short is worse. */
    excluded: { payslipId: string; employeeName: string; netKobo: number; reason: string }[];
  };
  journal: {
    lines: JournalLine[];
    debitKobo: number;
    creditKobo: number;
    balanced: boolean;
  };
  remittances: { name: string; authority: string; amountKobo: number }[];
}

/* ---- payroll analytics --------------------------------------------- */

export interface PayrollCostPoint {
  runId: string;
  reference: string;
  period: string;
  payDate: string;
  kind: PayRunKind;
  grossKobo: number;
  netKobo: number;
  deductionsKobo: number;
  employerCostKobo: number;
  /** Gross plus employer contributions — the real wage bill. */
  totalCostKobo: number;
  headcount: number;
  /** A bill that rose because people joined is a different conversation. */
  costPerHeadKobo: number | null;
}

export interface DepartmentCost {
  department: string;
  headcount: number;
  grossKobo: number;
  netKobo: number;
  employerCostKobo: number;
  totalCostKobo: number;
  shareOfGross: number | null;
  costPerHeadKobo: number | null;
}

export interface StatutoryBurden {
  grossKobo: number;
  payeKobo: number;
  pensionEmployeeKobo: number;
  pensionEmployerKobo: number;
  nhfKobo: number;
  nsitfKobo: number;
  /** What comes out of people's pay. */
  employeeSideKobo: number;
  /** What the institution pays on top of it. */
  employerSideKobo: number;
  employeeSharePercent: number | null;
  employerSharePercent: number | null;
  /** Gross plus the employer's own statutory bill, over gross. */
  loadedCostMultiplier: number | null;
}

/**
 * Why this run differs from the last.
 *
 * Named per person, because "the bill went up four million" is not an answer
 * and "nine people joined and Ada's overtime tripled" is.
 */
export interface PayrollVariance {
  previousRunId: string;
  previousReference: string;
  previousPeriod: string;
  grossDeltaKobo: number;
  netDeltaKobo: number;
  headcountDelta: number;
  joiners: { employeeId: string; name: string; grossKobo: number }[];
  leavers: { employeeId: string; name: string; grossKobo: number }[];
  changes: {
    employeeId: string;
    name: string;
    wasKobo: number;
    nowKobo: number;
    deltaKobo: number;
  }[];
  changedCount: number;
}

export interface LoanExposure {
  count: number;
  outstandingKobo: number;
  advancedKobo: number;
  monthlyRecoveryKobo: number;
  suspended: number;
  /** Null when nothing is being collected, which is itself the finding. */
  monthsToClear: number | null;
  largest: {
    loanId: string;
    name: string | null;
    outstandingKobo: number;
    isCollecting: boolean;
  }[];
}

/**
 * What has to be cleared before anybody can be paid.
 *
 * `withoutProfile` is the worse list: somebody with no pay profile is
 * invisible on a list of profiles — they simply do not appear.
 */
export interface PayrollReadiness {
  profiles: number;
  incomplete: { employeeId: string; name: string | null; missing: string[] }[];
  withoutProfile: {
    employeeId: string;
    name: string | null;
    jobTitle: string;
  }[];
  readyToPay: number;
  /** H15: settlements waiting for the next run that pays the person. */
  finalSettlementsWaiting?: {
    id: string;
    employeeId: string;
    name: string | null;
    amountKobo: number;
    note: string | null;
    leavingOn: string | null;
    hasPayProfile: boolean;
  }[];
}

export interface RegisterRow {
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  basicKobo: number;
  grossKobo: number;
  payeKobo: number;
  pensionEmployeeKobo: number;
  nhfKobo: number;
  otherDeductionsKobo: number;
  loanRepaymentKobo: number;
  totalDeductionsKobo: number;
  netKobo: number;
  pensionEmployerKobo: number;
  nsitfKobo: number;
  employerCostKobo: number;
  /** Published so a register can be checked line by line, not only in total. */
  balances: boolean;
}

export interface PayProfileInput {
  basicSalaryKobo: number;
  salaryPeriod?: "year" | "month";
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankCode?: string | null;
  taxIdentificationNumber?: string | null;
  pensionPin?: string | null;
  pensionAdministrator?: string | null;
  nhfNumber?: string | null;
  isPensionExempt?: boolean;
  isNhfExempt?: boolean;
  isPayeExempt?: boolean;
}

export interface PayElementInput {
  name: string;
  code: string;
  description?: string;
  kind: PayElementKind;
  basis: PayElementBasis;
  amountKobo?: number;
  rateBasisPoints?: number;
  isTaxable?: boolean;
  isPensionable?: boolean;
  sequence?: number;
  isActive?: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number };
}

/* ------------------------------------------------------------------ */
/*  Calls                                                               */
/* ------------------------------------------------------------------ */

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    // Laravel's `boolean` rule takes 1/0, not the words "true"/"false":
    // sending String(true) made every yes/no filter a 422.
    search.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }

  const qs = search.toString();

  return qs === "" ? "" : `?${qs}`;
}

/** Where one of my reports is today, derived from leave, the clock and the rota. */
export type TeamTodayState = "away" | "in" | "signed_out" | "expected" | "not_in";

export interface TeamMember {
  employeeId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  jobTitle: string;
  department: string | null;
  status: EmploymentStatus;
  statusLabel: string;
  today: {
    state: TeamTodayState;
    leaveType: string | null;
    awayUntil: string | null;
    signedInAt: string | null;
    shift: { name: string | null; startsAt: string; endsAt: string } | null;
  };
}

/** My team (S9): my current direct reports and what is waiting on me. */
export interface TeamOverview {
  manager: { employeeId: string; jobTitle: string } | null;
  date: string;
  people: TeamMember[];
  today: { in: number; away: number; signedOut: number; expected: number; notIn: number };
  waiting: { leave: number; timesheets: number; swaps: number; reviews: number };
}

export interface HireInput {
  email: string;
  name?: string;
  jobTitle: string;
  department?: string;
  employmentType: EmploymentType;
  employeeNumber?: string;
  workLocation?: string;
  weeklyHours?: number;
  hiredOn: string;
  startedOn?: string;
  endedOn?: string;
  probationMonths?: number;
  managerId?: string | null;
  grossSalary?: number;
  salaryPeriod?: string;
  noticeDays?: number;
  startOnboarding?: boolean;
}

/** A hire returns the record plus, once, the password that was generated. */
export interface HireResult {
  data: Employee;
  meta: { invited: boolean; temporaryPassword: string | null };
}

export const hrm = {
  overview: () => request<{ data: HrmOverview }>("overview").then(unwrap),

  /* ------------------------------ people ------------------------------ */

  employees: {
    list: (filters: {
      status?: EmploymentStatus;
      employmentType?: EmploymentType;
      department?: string;
      managerId?: string;
      q?: string;
      includeDeparted?: boolean;
      perPage?: number;
      page?: number;
    } = {}) => request<Paginated<Employee>>(`employees${query(filters)}`),

    /**
     * Everybody matching, for a picker: every page of 100 (the most the API
     * serves at once). Asking for more in one go is refused, and a picker
     * that swallowed that refusal showed nobody at all.
     */
    listAll: async (filters: {
      status?: EmploymentStatus;
      employmentType?: EmploymentType;
      department?: string;
      managerId?: string;
      q?: string;
      includeDeparted?: boolean;
    } = {}): Promise<Employee[]> => {
      const people: Employee[] = [];

      for (let page = 1; page <= 50; page++) {
        const result = await request<Paginated<Employee>>(`employees${query({ ...filters, perPage: 100, page })}`);
        people.push(...result.data);
        if (!result.meta || page >= result.meta.last_page) break;
      }

      return people;
    },

    get: (id: string) =>
      request<{ data: Employee }>(`employees/${encodeURIComponent(id)}`).then(unwrap),

    /** Leave, attendance, rota, pay and how they were hired. */
    dossier: (id: string) =>
      request<{ data: EmployeeDossier }>(
        `employees/${encodeURIComponent(id)}/dossier`,
      ).then(unwrap),

    /* ----------------------------- the person ----------------------- */

    personal: (id: string) =>
      request<{ data: PersonalRecord }>(
        `employees/${encodeURIComponent(id)}/personal`,
      ).then(unwrap),

    savePersonal: (id: string, input: Partial<Record<string, unknown>>) =>
      request<{ data: PersonalRecord }>(
        `employees/${encodeURIComponent(id)}/personal`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    addContact: (
      id: string,
      input: {
        name: string;
        phone: string;
        relationship?: string | null;
        alternatePhone?: string | null;
        email?: string | null;
        address?: string | null;
        isPrimary?: boolean;
      },
    ) =>
      request<{ data: EmergencyContact }>(
        `employees/${encodeURIComponent(id)}/emergency-contacts`,
        { method: "POST", body: input },
      ).then(unwrap),

    updateContact: (contactId: string, input: Record<string, unknown>) =>
      request<{ data: EmergencyContact }>(
        `emergency-contacts/${encodeURIComponent(contactId)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    removeContact: (contactId: string) =>
      request<void>(`emergency-contacts/${encodeURIComponent(contactId)}`, {
        method: "DELETE",
      }),

    addDocument: (
      id: string,
      input: {
        kind: DocumentKind;
        title: string;
        reference?: string | null;
        issuer?: string | null;
        issuedOn?: string | null;
        expiresOn?: string | null;
        note?: string | null;
      },
      /** The scan, optional. Sent as multipart when present. */
      file?: File | null,
    ) => {
      if (!file) {
        return request<{ data: EmployeeDocument }>(
          `employees/${encodeURIComponent(id)}/documents`,
          { method: "POST", body: input },
        ).then(unwrap);
      }

      const form = new FormData();
      for (const [key, value] of Object.entries(input)) {
        if (value !== null && value !== undefined && value !== "") form.append(key, String(value));
      }
      form.append("file", file);

      return upload<{ data: EmployeeDocument }>(
        `employees/${encodeURIComponent(id)}/documents`,
        form,
      ).then(unwrap);
    },

    /** Attach, or replace, the scan on a document already recorded. */
    attachDocumentFile: (documentId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);

      return upload<{ data: EmployeeDocument }>(
        `documents/${encodeURIComponent(documentId)}/file`,
        form,
      ).then(unwrap);
    },

    /** HR's download link for a scan. A plain link: the proxy streams the bytes. */
    documentFileUrl: (documentId: string) =>
      `/api/hrm/documents/${encodeURIComponent(documentId)}/file`,

    verifyDocument: (documentId: string) =>
      request<{ data: EmployeeDocument }>(
        `documents/${encodeURIComponent(documentId)}/verify`,
        { method: "POST" },
      ).then(unwrap),

    removeDocument: (documentId: string) =>
      request<void>(`documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      }),

    /** The renewal watch list across the whole institution. */
    expiringDocuments: (withinDays = 60) =>
      request<{ data: ExpiringDocument[]; meta: { blockingWork: number } }>(
        `documents/expiring?withinDays=${withinDays}`,
      ),

    /* ------------------------------ leaving ------------------------- */

    hire: (input: HireInput) =>
      request<HireResult>("employees", { method: "POST", body: input }),

    update: (id: string, input: Partial<HireInput>) =>
      request<{ data: Employee }>(`employees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    exit: (
      id: string,
      input: {
        status: EmploymentStatus;
        reason: string;
        endedOn?: string;
        /** Switch sign-in off on the leaving date. The API defaults it to true. */
        disableSignIn?: boolean;
      },
    ) =>
      request<{ data: Employee }>(`employees/${encodeURIComponent(id)}/exit`, {
        method: "POST",
        body: input,
      }).then(unwrap),

    reinstate: (id: string, input: Partial<HireInput> & { startedOn: string }) =>
      request<{ data: Employee }>(`employees/${encodeURIComponent(id)}/reinstate`, {
        method: "POST",
        body: input,
      }).then(unwrap),
  },

  workforce: {
    get: (window: { from?: string; to?: string } = {}) =>
      request<{ data: WorkforceInsights }>(`workforce${query(window)}`).then(unwrap),

    /** The same report as a file, for a board pack. */
    csvUrl: (window: { from?: string; to?: string } = {}) =>
      `/api/hrm/workforce.csv${query(window)}`,
  },

  relations: {
    list: (filters: {
      kind?: CaseKind;
      status?: CaseStatus;
      employeeId?: string;
      includeClosed?: boolean;
    } = {}) =>
      request<{ data: RelationsCase[] }>(`relations${query(filters)}`).then(unwrap),

    get: (id: string) =>
      request<{ data: RelationsCase }>(`relations/${encodeURIComponent(id)}`)
        .then(unwrap),

    open: (input: {
      kind: CaseKind;
      summary: string;
      detail?: string | null;
      category?: string | null;
      subjectId?: string | null;
      raisedById?: string | null;
    }) =>
      request<{ data: RelationsCase }>("relations", {
        method: "POST",
        body: input,
      }).then(unwrap),

    /** Putting the allegation to them. `scheduleHearing` refuses without it. */
    serveAllegation: (id: string, note: string) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/allegation`,
        { method: "POST", body: { note } },
      ).then(unwrap),

    investigate: (id: string, input: Record<string, unknown>) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/investigate`,
        { method: "POST", body: input },
      ).then(unwrap),

    recordFindings: (id: string, findings: string) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/findings`,
        { method: "POST", body: { findings } },
      ).then(unwrap),

    scheduleHearing: (id: string, input: Record<string, unknown>) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/hearing`,
        { method: "POST", body: input },
      ).then(unwrap),

    decide: (
      id: string,
      input: {
        outcome: CaseOutcome;
        reason: string;
        decidedById?: string | null;
        /** 0 makes a warning permanent. */
        lifespanMonths?: number | null;
      },
    ) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/decide`,
        { method: "POST", body: input },
      ).then(unwrap),

    decideAppeal: (
      id: string,
      input: { upheld: boolean; reason: string; appealHeardById?: string | null },
    ) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/appeal/decide`,
        { method: "POST", body: input },
      ).then(unwrap),

    withdraw: (id: string, reason: string) =>
      request<{ data: RelationsCase }>(
        `relations/${encodeURIComponent(id)}/withdraw`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    /** The register for one person, plus what the ladder advises next. */
    warningsFor: (employeeId: string) =>
      request<{
        data: LiveWarning[];
        meta: {
          suggestedNextStep: CaseOutcome | null;
          suggestedNextStepLabel: string | null;
        };
      }>(`employees/${encodeURIComponent(employeeId)}/warnings`),

    analytics: () =>
      request<{ data: RelationsInsights }>("relations/analytics").then(unwrap),
  },

  /**
   * Somebody's own disciplinaries and grievances.
   *
   * Separate from `relations` above, which is HR's caseload and sits behind
   * HR's permission keys. These are the routes an employee reaches: the
   * subject of a disciplinary has to be able to read it, and the person with a
   * grievance has to be able to raise one — otherwise the confidential route
   * runs through the very function a grievance is most often about.
   */
  myCases: {
    list: () => request<{ data: MyCase[] }>("me/cases").then(unwrap),

    get: (id: string) =>
      request<{ data: MyCase }>(`me/cases/${encodeURIComponent(id)}`)
        .then(unwrap),

    /**
     * Raise a grievance. Only a grievance — an employee cannot open a
     * disciplinary against a colleague; that is a complaint, and this is what
     * it is for.
     */
    raise: (input: {
      summary: string;
      detail?: string | null;
      category?: string | null;
      subjectId?: string | null;
      /** A name is optional. Somebody reporting an unsafe ward run by their
       *  own manager needs to be able to leave it off. */
      anonymous?: boolean;
    }) =>
      request<{ data: MyCase }>("me/grievances", {
        method: "POST",
        body: input,
      }).then(unwrap),

    appeal: (id: string, grounds: string) =>
      request<{ data: MyCase }>(
        `me/cases/${encodeURIComponent(id)}/appeal`,
        { method: "POST", body: { grounds } },
      ).then(unwrap),
  },

  offboardings: {
    /**
     * Announce a departure.
     *
     * Posted against the employee rather than the collection, because it is
     * the employee who acquires a leaving date; the service refuses a second
     * open departure for the same person, since "when do they leave" cannot
     * have two answers.
     */
    start: (
      employeeId: string,
      input: {
        kind: LeavingKind;
        leavingOn: string;
        lastWorkingDay?: string | null;
        noticeGivenOn?: string | null;
        reason?: string | null;
        isRehireable?: boolean | null;
        leavingFor?: string | null;
        /** Switch sign-in off on the leaving date. The API defaults it to true. */
        disableSignIn?: boolean;
      },
    ) =>
      request<{ data: Offboarding }>(
        `employees/${encodeURIComponent(employeeId)}/offboarding`,
        { method: "POST", body: input },
      ).then(unwrap),

    list: (includeClosed = false) =>
      request<{ data: Offboarding[]; meta: { goneButNotCleared: number } }>(
        `offboardings?includeClosed=${includeClosed ? 1 : 0}`,
      ),

    get: (id: string) =>
      request<{ data: Offboarding }>(`offboardings/${encodeURIComponent(id)}`)
        .then(unwrap),

    addItem: (id: string, input: Record<string, unknown>) =>
      request<{ data: Offboarding }>(
        `offboardings/${encodeURIComponent(id)}/items`,
        { method: "POST", body: input },
      ).then(unwrap),

    completeItem: (itemId: string) =>
      request<{ data: Offboarding }>(
        `offboarding-items/${encodeURIComponent(itemId)}/complete`,
        { method: "POST" },
      ).then(unwrap),

    /** What an unreturned asset is deducted at (kobo; 0 waives the deduction). Final pay follows. */
    updateItemCost: (itemId: string, replacementCostKobo: number | null) =>
      request<{ data: Offboarding }>(
        `offboarding-items/${encodeURIComponent(itemId)}`,
        { method: "PATCH", body: { replacementCostKobo } },
      ).then(unwrap),

    /** Closing something that will never be done. The reason is required. */
    waiveItem: (itemId: string, reason: string) =>
      request<{ data: Offboarding }>(
        `offboarding-items/${encodeURIComponent(itemId)}/waive`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    recordExitInterview: (id: string, input: Record<string, unknown>) =>
      request<{ data: Offboarding }>(
        `offboardings/${encodeURIComponent(id)}/exit-interview`,
        { method: "POST", body: input },
      ).then(unwrap),

    /** The figure (kobo) goes to the leaver's next payroll run as "Final settlement" (H15). */
    settle: (id: string, finalSettlementKobo?: number | null, finalSettlementNote?: string | null) =>
      request<{ data: Offboarding }>(
        `offboardings/${encodeURIComponent(id)}/settle`,
        { method: "POST", body: { finalSettlementKobo, finalSettlementNote } },
      ).then(unwrap),

    /**
     * The only call that ends the employment record — on the leaving date.
     * Cleared early, the employment stays current until that morning.
     */
    clear: (id: string, input: { disableSignIn?: boolean } = {}) =>
      request<{ data: Offboarding }>(
        `offboardings/${encodeURIComponent(id)}/clear`,
        { method: "POST", body: input },
      ).then(unwrap),

    cancel: (id: string, reason: string) =>
      request<{ data: Offboarding }>(
        `offboardings/${encodeURIComponent(id)}/cancel`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

  },

  /* ---------------------------- agreements ---------------------------- */

  contracts: {
    forEmployee: (id: string) =>
      request<{ data: EmploymentContract[] }>(
        `employees/${encodeURIComponent(id)}/contracts`,
      ).then(unwrap),

    issue: (id: string, input: Record<string, unknown>) =>
      request<{ data: EmploymentContract }>(
        `employees/${encodeURIComponent(id)}/contracts`,
        { method: "POST", body: input },
      ).then(unwrap),

    renew: (id: string, input: { endsOn: string } & Record<string, unknown>) =>
      request<{ data: EmploymentContract }>(
        `employees/${encodeURIComponent(id)}/contracts/renew`,
        { method: "POST", body: input },
      ).then(unwrap),

    terminate: (
      contractId: string,
      input: { reason: string; endedOn?: string; employmentStatus?: EmploymentStatus },
    ) =>
      request<{ data: EmploymentContract }>(
        `contracts/${encodeURIComponent(contractId)}/terminate`,
        { method: "POST", body: input },
      ).then(unwrap),

    /** Two lists: expiring soon, and already overrun. */
    watchlist: (days?: number) =>
      request<{
        data: { expiring: EmploymentContract[]; overrunning: EmploymentContract[] };
        meta: { days: number; expiringCount: number; overrunningCount: number };
      }>(`contracts/watchlist${query({ days })}`),
  },

  /* ----------------------------- probation ---------------------------- */

  probation: {
    due: (days?: number) =>
      request<{
        data: ProbationReview[];
        meta: { days: number; total: number; overdue: number };
      }>(`probation${query({ days })}`),

    forEmployee: (id: string) =>
      request<{ data: ProbationReview[] }>(
        `employees/${encodeURIComponent(id)}/probation`,
      ).then(unwrap),

    raise: (id: string, input: { dueOn?: string; reviewerId?: string } = {}) =>
      request<{ data: ProbationReview }>(
        `employees/${encodeURIComponent(id)}/probation`,
        { method: "POST", body: input },
      ).then(unwrap),

    decide: (
      reviewId: string,
      input: {
        outcome: Exclude<ProbationOutcome, "pending">;
        heldOn?: string;
        extendedTo?: string;
        rating?: number;
        summary?: string;
        objectives?: string;
      },
    ) =>
      request<{ data: ProbationReview }>(
        `probation/${encodeURIComponent(reviewId)}/decide`,
        { method: "POST", body: input },
      ).then(unwrap),
  },

  /* ---------------------------- onboarding ---------------------------- */

  onboarding: {
    programmes: (includeArchived = false) =>
      request<{ data: OnboardingProgramme[] }>(
        `onboarding/programmes${query({ includeArchived })}`,
      ).then(unwrap),

    createProgramme: (input: {
      name: string;
      description?: string;
      employmentType?: EmploymentType | null;
      isDefault?: boolean;
      steps?: StepInput[];
    }) =>
      request<{ data: OnboardingProgramme }>("onboarding/programmes", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateProgramme: (id: string, input: Record<string, unknown>) =>
      request<{ data: OnboardingProgramme }>(
        `onboarding/programmes/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    /** The whole list at once — a reorder is one call, not N. */
    replaceSteps: (id: string, steps: StepInput[]) =>
      request<{ data: OnboardingProgramme }>(
        `onboarding/programmes/${encodeURIComponent(id)}/steps`,
        { method: "PUT", body: { steps } },
      ).then(unwrap),

    archiveProgramme: (id: string) =>
      request<{ data: OnboardingProgramme }>(
        `onboarding/programmes/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ).then(unwrap),

    journeys: (includeClosed = false) =>
      request<{
        data: OnboardingJourney[];
        meta: { total: number; withOverdueSteps: number };
      }>(`onboarding/journeys${query({ includeClosed })}`),

    start: (
      employeeId: string,
      input: { programmeId?: string; anchorDate?: string; buddyId?: string } = {},
    ) =>
      request<{ data: OnboardingJourney }>(
        `employees/${encodeURIComponent(employeeId)}/onboarding`,
        { method: "POST", body: input },
      ).then(unwrap),

    complete: (id: string) =>
      request<{ data: OnboardingJourney }>(
        `onboarding/journeys/${encodeURIComponent(id)}/complete`,
        { method: "POST", body: {} },
      ).then(unwrap),

    abandon: (id: string, reason: string) =>
      request<{ data: OnboardingJourney }>(
        `onboarding/journeys/${encodeURIComponent(id)}/abandon`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    reschedule: (id: string, anchorDate: string) =>
      request<{ data: OnboardingJourney }>(
        `onboarding/journeys/${encodeURIComponent(id)}/reschedule`,
        { method: "POST", body: { anchorDate } },
      ).then(unwrap),

    completeStep: (stepId: string, note?: string) =>
      request<{ data: OnboardingStep }>(
        `onboarding/steps/${encodeURIComponent(stepId)}/complete`,
        { method: "POST", body: { note } },
      ).then(unwrap),

    reopenStep: (stepId: string) =>
      request<{ data: OnboardingStep }>(
        `onboarding/steps/${encodeURIComponent(stepId)}/reopen`,
        { method: "POST", body: {} },
      ).then(unwrap),
  },

  /* ---------------------------- internships --------------------------- */

  internships: {
    cohorts: (status?: CohortStatus) =>
      request<{ data: InternshipCohort[] }>(
        `internships/cohorts${query({ status })}`,
      ).then(unwrap),

    cohort: (id: string) =>
      request<{ data: InternshipCohort }>(
        `internships/cohorts/${encodeURIComponent(id)}`,
      ).then(unwrap),

    createCohort: (input: {
      name: string;
      description?: string;
      startsOn: string;
      endsOn: string;
      capacity?: number;
      status?: CohortStatus;
    }) =>
      request<{ data: InternshipCohort }>("internships/cohorts", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateCohort: (id: string, input: Record<string, unknown>) =>
      request<{ data: InternshipCohort }>(
        `internships/cohorts/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    place: (
      cohortId: string,
      input: {
        employeeId: string;
        mentorId?: string;
        institution?: string;
        programmeOfStudy?: string;
        focusArea?: string;
        startsOn?: string;
        endsOn?: string;
      },
    ) =>
      request<{ data: InternshipPlacement }>(
        `internships/cohorts/${encodeURIComponent(cohortId)}/placements`,
        { method: "POST", body: input },
      ).then(unwrap),

    updatePlacement: (id: string, input: Record<string, unknown>) =>
      request<{ data: InternshipPlacement }>(
        `internships/placements/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    close: (
      id: string,
      input: { status: Exclude<PlacementStatus, "placed">; endedOn?: string },
    ) =>
      request<{ data: InternshipPlacement }>(
        `internships/placements/${encodeURIComponent(id)}/close`,
        { method: "POST", body: input },
      ).then(unwrap),

    decideConversion: (
      id: string,
      input: {
        conversion: Exclude<ConversionOutcome, "pending">;
        conversionNote?: string;
        convertedOn?: string;
        employmentType?: Exclude<EmploymentType, "intern">;
        jobTitle?: string;
        department?: string;
        endsOn?: string;
        probationMonths?: number;
        grossSalary?: number;
      },
    ) =>
      request<{ data: InternshipPlacement }>(
        `internships/placements/${encodeURIComponent(id)}/conversion`,
        { method: "POST", body: input },
      ).then(unwrap),

    decisionsDue: (days?: number) =>
      request<{ data: InternshipPlacement[]; meta: { days: number; total: number } }>(
        `internships/decisions-due${query({ days })}`,
      ),
  },

  /* ------------------------------ HR roles ----------------------------- */

  roles: {
    /** The roles you may give from HR, each with who holds it. */
    list: () => request<{ data: HrRole[] }>("roles").then(unwrap),

    /**
     * Set which of the roles you may give this employee holds. Their other
     * roles - ones only an admin gives, or the reporting line's Line Manager -
     * are left as they are.
     */
    sync: (employeeId: string, roleIds: string[]) =>
      request<{ data: { employeeId: string; userId: string; roleIds: string[] } }>(
        `employees/${encodeURIComponent(employeeId)}/roles`,
        { method: "PUT", body: { roleIds } },
      ).then(unwrap),
  },

  /* ----------------------------- performance -------------------------- */

  performance: {
    cohort: (window?: { from: string; to: string }) =>
      request<{ data: CohortPerformance }>(`performance${query(window ?? {})}`).then(
        unwrap,
      ),

    forEmployee: (employeeId: string, window?: { from: string; to: string }) =>
      request<{ data: EmployeePerformance }>(
        `employees/${encodeURIComponent(employeeId)}/performance${query(window ?? {})}`,
      ).then(unwrap),

    kpis: (filters: { employeeId?: string; status?: KpiStatus } = {}) =>
      request<{ data: Kpi[] }>(`kpis${query(filters)}`).then(unwrap),

    createKpi: (employeeId: string, input: KpiInput) =>
      request<{ data: Kpi }>(`employees/${encodeURIComponent(employeeId)}/kpis`, {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateKpi: (id: string, input: Partial<KpiInput>) =>
      request<{ data: Kpi }>(`kpis/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    setKpiStatus: (id: string, status: KpiStatus) =>
      request<{ data: Kpi }>(`kpis/${encodeURIComponent(id)}/status`, {
        method: "POST",
        body: { status },
      }).then(unwrap),

    /** Returns the whole series, so a chart redraws in one round trip. */
    record: (
      kpiId: string,
      input: { value: number; measuredOn?: string; note?: string },
    ) =>
      request<{ data: KpiDetail }>(
        `kpis/${encodeURIComponent(kpiId)}/measurements`,
        { method: "POST", body: input },
      ).then(unwrap),

    /**
     * Un-record a reading.
     *
     * Returns the series without it, so the chart redraws in one round trip —
     * and null if the KPI itself has gone, which the caller has to handle
     * rather than assume.
     *
     * Audited on the way out, because a removed reading moves the attainment
     * figure a review may later be argued over and leaves nothing behind.
     */
    removeMeasurement: (measurementId: string) =>
      request<{ data: KpiDetail | null }>(
        `measurements/${encodeURIComponent(measurementId)}`,
        { method: "DELETE" },
      ).then((res) => res.data),

    milestones: (
      filters: { employeeId?: string; status?: MilestoneStatus; days?: number } = {},
    ) =>
      request<{
        data: Milestone[];
        meta: { total: number; overdue: number };
      }>(`milestones${query(filters)}`),

    createMilestone: (
      employeeId: string,
      input: {
        title: string;
        description?: string;
        dueOn: string;
        kpiId?: string;
        weight?: number;
      },
    ) =>
      request<{ data: Milestone }>(
        `employees/${encodeURIComponent(employeeId)}/milestones`,
        { method: "POST", body: input },
      ).then(unwrap),

    setMilestoneStatus: (
      id: string,
      status: MilestoneStatus,
      achievedOn?: string,
    ) =>
      request<{ data: Milestone }>(
        `milestones/${encodeURIComponent(id)}/status`,
        { method: "POST", body: { status, achievedOn } },
      ).then(unwrap),
  },

  /* ------------------------------- reviews ---------------------------- */

  reviews: {
    cycles: (status?: CycleStatus) =>
      request<{ data: ReviewCycle[] }>(`reviews/cycles${query({ status })}`).then(
        unwrap,
      ),

    createCycle: (input: {
      name: string;
      description?: string;
      periodStart: string;
      periodEnd: string;
      dueOn?: string;
      status?: CycleStatus;
    }) =>
      request<{ data: ReviewCycle }>("reviews/cycles", {
        method: "POST",
        body: input,
      }).then(unwrap),

    /** Raises a review for everybody. Idempotent, so a grown cohort tops up. */
    openCycle: (id: string) =>
      request<{
        data: ReviewCycle;
        meta: { raised: number; skipped: number };
      }>(`reviews/cycles/${encodeURIComponent(id)}/open`, { method: "POST", body: {} }),

    closeCycle: (id: string) =>
      request<{ data: ReviewCycle }>(
        `reviews/cycles/${encodeURIComponent(id)}/close`,
        { method: "POST", body: {} },
      ).then(unwrap),

    list: (
      filters: { cycleId?: string; employeeId?: string; includeClosed?: boolean } = {},
    ) =>
      request<{
        data: PerformanceReview[];
        meta: {
          total: number;
          awaitingSelf: number;
          awaitingManager: number;
          awaitingMeeting: number;
        };
      }>(`reviews${query(filters)}`),

    get: (id: string) =>
      request<{ data: PerformanceReview }>(`reviews/${encodeURIComponent(id)}`).then(
        unwrap,
      ),

    /** The manager's half. Refused until the employee has written theirs. */
    submitManager: (
      id: string,
      input: {
        managerRating?: number;
        managerComments?: string;
        strengths?: string;
        development?: string;
        objectives?: string;
      },
    ) =>
      request<{ data: PerformanceReview }>(
        `reviews/${encodeURIComponent(id)}/manager`,
        { method: "POST", body: input },
      ).then(unwrap),

    complete: (id: string, metOn?: string) =>
      request<{ data: PerformanceReview }>(
        `reviews/${encodeURIComponent(id)}/complete`,
        { method: "POST", body: { metOn } },
      ).then(unwrap),

    reopen: (id: string, reason?: string) =>
      request<{ data: PerformanceReview }>(
        `reviews/${encodeURIComponent(id)}/reopen`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    /**
     * Abandon a review — the person left, the cycle was dropped.
     *
     * Not the same as reopening, and not a way to undo a completed one: the
     * API refuses that, because a completed review's score has been discussed
     * and signed off and cancelling it would take the rating out of the score
     * with nothing to put back.
     */
    cancel: (id: string, reason?: string) =>
      request<{ data: PerformanceReview }>(
        `reviews/${encodeURIComponent(id)}/cancel`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    /**
     * Everything this person has ever been reviewed on, newest period first.
     *
     * `list({ employeeId })` answers a different question: it is scoped to
     * open cycles and reports the cohort's counts alongside. This is the
     * record — what somebody opens before a promotion conversation, and the
     * one place a rating trend over three years is visible at all.
     */
    forEmployee: (employeeId: string) =>
      request<{ data: PerformanceReview[] }>(
        `employees/${encodeURIComponent(employeeId)}/reviews`,
      ).then(unwrap),
  },

  /* ------------------------------ payroll ----------------------------- */

  payroll: {
    /* --------------------------- analytics --------------------------- */

    analytics: (runs = 12) =>
      request<{
        data: {
          costTrend: PayrollCostPoint[];
          loans: LoanExposure;
          readiness: PayrollReadiness;
        };
      }>(`payroll/analytics${query({ runs })}`).then(unwrap),

    /** One run taken apart, including why it differs from the last. */
    runAnalytics: (id: string) =>
      request<{
        data: {
          departments: DepartmentCost[];
          statutory: StatutoryBurden;
          variance: PayrollVariance | null;
        };
      }>(`payroll/runs/${encodeURIComponent(id)}/analytics`).then(unwrap),

    register: (id: string) =>
      request<{ data: RegisterRow[] }>(
        `payroll/runs/${encodeURIComponent(id)}/register`,
      ).then(unwrap),

    registerCsvUrl: (id: string) =>
      `/api/hrm/payroll/runs/${encodeURIComponent(id)}/register.csv`,

    /* ---------------------------- elements --------------------------- */

    elements: () =>
      request<{ data: PayElement[] }>("payroll/elements").then(unwrap),

    createElement: (input: PayElementInput) =>
      request<{ data: PayElement }>("payroll/elements", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateElement: (id: string, input: Partial<PayElementInput>) =>
      request<{ data: PayElement }>(`payroll/elements/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /* ---------------------------- profiles --------------------------- */

    profiles: () =>
      request<{ data: PayProfile[]; meta: { total: number; incomplete: number } }>(
        "payroll/profiles",
      ),

    saveProfile: (employeeId: string, input: PayProfileInput) =>
      request<{ data: PayProfile }>(
        `employees/${encodeURIComponent(employeeId)}/pay-profile`,
        { method: "PUT", body: input },
      ).then(unwrap),

    attachElement: (
      employeeId: string,
      input: {
        elementId: string;
        amountKobo?: number | null;
        rateBasisPoints?: number | null;
        startsOn?: string | null;
        endsOn?: string | null;
      },
    ) =>
      request<{ data: PayProfile }>(
        `employees/${encodeURIComponent(employeeId)}/pay-elements`,
        { method: "POST", body: input },
      ).then(unwrap),

    detachElement: (rowId: string) =>
      request<void>(`payroll/profile-elements/${encodeURIComponent(rowId)}`, {
        method: "DELETE",
      }),

    /* --------------------------- statutory --------------------------- */

    schedules: () =>
      request<{ data: StatutorySchedule[] }>("payroll/schedules").then(unwrap),

    /** Supersedes rather than edits, so past runs stay explainable. */
    supersedeSchedule: (input: {
      kind: StatutoryKind;
      name?: string;
      effectiveFrom: string;
      employeeRateBasisPoints?: number;
      employerRateBasisPoints?: number;
      config?: Record<string, unknown>;
      bands?: { widthKobo: number | null; rateBasisPoints: number }[];
    }) =>
      request<{ data: StatutorySchedule }>("payroll/schedules", {
        method: "POST",
        body: input,
      }).then(unwrap),

    /* ----------------------------- loans ----------------------------- */

    loans: () =>
      request<{ data: EmployeeLoan[]; meta: LoanExposure }>("payroll/loans"),

    grantLoan: (
      employeeId: string,
      input: {
        kind?: LoanKind;
        principalKobo: number;
        instalmentsTotal?: number;
        startsOn?: string | null;
        purpose?: string;
      },
    ) =>
      request<{ data: EmployeeLoan }>(
        `employees/${encodeURIComponent(employeeId)}/loans`,
        { method: "POST", body: input },
      ).then(unwrap),

    updateLoan: (
      id: string,
      action: "suspend" | "resume" | "settle" | "cancel",
      reason?: string,
    ) =>
      request<{ data: EmployeeLoan }>(`payroll/loans/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { action, reason },
      }).then(unwrap),

    /* ------------------------------ runs ----------------------------- */

    runs: () =>
      request<{ data: PayrollRun[]; meta: { total: number } }>("payroll/runs"),

    /** One run, with the two checks worth making before approving. */
    run: (id: string) =>
      request<{
        data: PayrollRun;
        meta: { unbalanced: number; unpayable: number; withShortfall: number };
      }>(`payroll/runs/${encodeURIComponent(id)}`),

    openRun: (input: {
      kind?: PayRunKind;
      periodStart: string;
      periodEnd: string;
      payDate?: string;
      note?: string;
    }) =>
      request<{ data: PayrollRun }>("payroll/runs", {
        method: "POST",
        body: input,
      }).then(unwrap),

    /**
     * `calculate` may be repeated as often as anybody likes. `approve` freezes
     * every payslip and collects the loan instalments, and there is no way
     * back from it.
     */
    transitionRun: (
      id: string,
      action: "calculate" | "approve" | "pay" | "cancel" | "distribute",
      /** `paidOn` (YYYY-MM-DD) with `pay`: the day the money actually left. */
      body: { employeeIds?: string[]; reason?: string; paidOn?: string } = {},
    ) =>
      request<{ data: PayrollRun & { distributed?: number } }>(
        `payroll/runs/${encodeURIComponent(id)}/transition`,
        { method: "POST", body: { action, ...body } },
      ).then(unwrap),

    /** The bank file and the journal, from the same run. */
    exportRun: (id: string) =>
      request<{ data: PayrollExport }>(
        `payroll/runs/${encodeURIComponent(id)}/export`,
      ).then(unwrap),

    bankFileUrl: (id: string) =>
      `/api/hrm/payroll/runs/${encodeURIComponent(id)}/bank-file`,

    payslip: (id: string) =>
      request<{ data: Payslip }>(`payroll/payslips/${encodeURIComponent(id)}`).then(
        unwrap,
      ),
  },

  /* ---------------------------- recruitment --------------------------- */

  recruitment: {
    overview: () =>
      request<{ data: RecruitmentOverview }>("recruitment").then(unwrap),

    /** What is waiting on a human, as opposed to what a board asks quarterly. */
    attention: () =>
      request<{ data: RecruitmentAttention }>("recruitment/attention").then(unwrap),

    analytics: (params: { from?: string; to?: string } = {}) =>
      request<{
        data: {
          funnel: RecruitmentFunnel;
          sources: SourceRow[];
          timeToFill: TimeToFill;
          costPerHire: CostPerHire;
          offers: OfferOutcomes;
          interviewers: InterviewerLoad[];
          stageDurations: StageDuration[];
          ageing: RequisitionAgeing;
        };
      }>(`recruitment/analytics${query(params)}`).then(unwrap),

    /* ---------------------------- roles ----------------------------- */

    requisitions: (filters: { status?: RequisitionStatus; openOnly?: boolean } = {}) =>
      request<{ data: JobRequisition[]; meta: { total: number } }>(
        `recruitment/requisitions${query(filters)}`,
      ),

    /** One role, with its board and its own funnel. */
    requisition: (id: string) =>
      request<{
        data: JobRequisition;
        meta: { board: BoardColumn[]; funnel: RecruitmentFunnel };
      }>(`recruitment/requisitions/${encodeURIComponent(id)}`),

    createRequisition: (input: RequisitionInput) =>
      request<{ data: JobRequisition }>("recruitment/requisitions", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateRequisition: (id: string, input: Partial<RequisitionInput>) =>
      request<{ data: JobRequisition }>(
        `recruitment/requisitions/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    /** A reason is required to decline; the API insists, and so should the form. */
    transition: (
      id: string,
      action: "submit" | "approve" | "decline" | "hold" | "resume" | "cancel",
      reason?: string,
    ) =>
      request<{ data: JobRequisition }>(
        `recruitment/requisitions/${encodeURIComponent(id)}/transition`,
        { method: "POST", body: { action, reason } },
      ).then(unwrap),

    /* -------------------------- advertising -------------------------- */

    advertise: (
      requisitionId: string,
      input: {
        title?: string;
        summary?: string;
        description?: string;
        channel?: string;
        externalUrl?: string;
        costKobo?: number;
        closesOn?: string | null;
        publish?: boolean;
      },
    ) =>
      request<{ data: JobPosting }>(
        `recruitment/requisitions/${encodeURIComponent(requisitionId)}/postings`,
        { method: "POST", body: input },
      ).then(unwrap),

    updatePosting: (id: string, action: "publish" | "unpublish") =>
      request<{ data: JobPosting }>(
        `recruitment/postings/${encodeURIComponent(id)}`,
        { method: "PATCH", body: { action } },
      ).then(unwrap),

    /* ---------------------------- pipeline --------------------------- */

    stages: () =>
      request<{ data: PipelineStage[] }>("recruitment/stages").then(unwrap),

    createStage: (input: {
      name: string;
      kind: StageKind;
      position?: number;
      colour?: string | null;
      staleAfterDays?: number | null;
    }) =>
      request<{ data: PipelineStage }>("recruitment/stages", {
        method: "POST",
        body: input,
      }).then(unwrap),

    reorderStages: (stageIds: string[]) =>
      request<{ data: PipelineStage[] }>("recruitment/stages", {
        method: "PUT",
        body: { stageIds },
      }).then(unwrap),

    /* --------------------------- candidates -------------------------- */

    candidates: (q?: string) =>
      request<{ data: Candidate[] }>(`recruitment/candidates${query({ q })}`).then(
        unwrap,
      ),

    /** One person, with everything they have ever applied for. */
    candidate: (id: string) =>
      request<{ data: Candidate }>(
        `recruitment/candidates/${encodeURIComponent(id)}`,
      ).then(unwrap),

    /**
     * Details rather than an id: a recruiter typing somebody in from an email
     * does not know whether they already exist, and matching on the address is
     * what stops a second copy being made.
     */
    apply: (
      requisitionId: string,
      input: {
        name: string;
        email: string;
        phone?: string;
        currentEmployer?: string;
        currentTitle?: string;
        linkedinUrl?: string;
        source?: CandidateSource;
        postingId?: string | null;
        referredById?: string | null;
        coverNote?: string;
      },
    ) =>
      request<{ data: JobApplication }>(
        `recruitment/requisitions/${encodeURIComponent(requisitionId)}/applications`,
        { method: "POST", body: input },
      ).then(unwrap),

    application: (id: string) =>
      request<{ data: JobApplication; meta: { history: StageEvent[] } }>(
        `recruitment/applications/${encodeURIComponent(id)}`,
      ),

    moveApplication: (
      id: string,
      input:
        | { action: "move"; stageId: string; note?: string }
        | { action: "reject"; reason: string }
        | { action: "withdraw"; reason?: string },
    ) =>
      request<{ data: JobApplication }>(
        `recruitment/applications/${encodeURIComponent(id)}`,
        { method: "PATCH", body: input },
      ).then(unwrap),

    /* --------------------------- interviews -------------------------- */

    scheduleInterview: (
      applicationId: string,
      input: {
        scheduledAt: string;
        kind?: InterviewKind;
        durationMinutes?: number;
        location?: string | null;
        meetingUrl?: string | null;
        agenda?: string;
        panel?: { employeeId: string; focus?: string; isLead?: boolean }[];
      },
    ) =>
      request<{ data: Interview }>(
        `recruitment/applications/${encodeURIComponent(applicationId)}/interviews`,
        { method: "POST", body: input },
      ).then(unwrap),

    updateInterview: (
      id: string,
      action: "complete" | "cancel" | "no_show",
      reason?: string,
    ) =>
      request<{ data: Interview }>(
        `recruitment/interviews/${encodeURIComponent(id)}`,
        { method: "PATCH", body: { action, reason } },
      ).then(unwrap),

    /** A recruiter is not being assessed, so they see everything submitted. */
    scorecards: (interviewId: string) =>
      request<{
        data: InterviewScorecard[];
        meta: { outstanding: number; weight: number };
      }>(`recruitment/interviews/${encodeURIComponent(interviewId)}/scorecards`),

    /* ----------------------------- offers ---------------------------- */

    offers: () =>
      request<{ data: JobOffer[]; meta: { total: number } }>("recruitment/offers"),

    draftOffer: (
      applicationId: string,
      input: {
        jobTitle?: string;
        department?: string;
        employmentType?: EmploymentType;
        salaryKobo: number;
        salaryPeriod?: string;
        signingBonusKobo?: number | null;
        startsOn?: string | null;
        expiresOn?: string | null;
        terms?: string;
        notes?: string;
      },
    ) =>
      request<{ data: JobOffer }>(
        `recruitment/applications/${encodeURIComponent(applicationId)}/offers`,
        { method: "POST", body: input },
      ).then(unwrap),

    /**
     * Accepting does more than change a status — it creates the employment
     * record, so the response carries the new employee and whatever the
     * account provisioning produced.
     */
    updateOffer: (
      id: string,
      action: "submit" | "approve" | "send" | "accept" | "decline" | "withdraw",
      body: { reason?: string; note?: string } = {},
    ) =>
      request<{
        data: JobOffer;
        meta?: {
          employeeId: string;
          invited: boolean;
          temporaryPassword: string | null;
        };
      }>(`recruitment/offers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { action, ...body },
      }),
  },

  /* ----------------------------- rosters ------------------------------ */

  roster: {
    shifts: () => request<{ data: ShiftPattern[] }>("shifts").then(unwrap),

    createShift: (input: ShiftPatternInput) =>
      request<{ data: ShiftPattern }>("shifts", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateShift: (id: string, input: Partial<ShiftPatternInput>) =>
      request<{ data: ShiftPattern }>(`shifts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /** Drafts included — this is the manager's view, not the employee's. */
    list: (params: { from?: string; to?: string; days?: number } = {}) =>
      request<{
        data: RosterAssignment[];
        meta: { from: string; to: string; drafts: number };
      }>(`roster${query(params)}`),

    coverage: (date?: string) =>
      request<{ data: ShiftCoverage[]; meta: { date: string } }>(
        `roster/coverage${query({ date })}`,
      ),

    assign: (employeeId: string, input: RosterInput) =>
      request<{ data: RosterAssignment[]; meta: { assigned: number } }>(
        `employees/${encodeURIComponent(employeeId)}/roster`,
        { method: "POST", body: input },
      ),

    unassign: (assignmentId: string) =>
      request<void>(`roster/${encodeURIComponent(assignmentId)}`, {
        method: "DELETE",
      }),

    /**
     * Make a draft visible to the people on it. A deliberate step: a
     * half-built roster read as final is how somebody fails to turn up.
     */
    publish: (from: string, to: string) =>
      request<{
        data: { published: number; from: string; to: string };
      }>("roster/publish", { method: "POST", body: { from, to } }).then(unwrap),

    /** Only what is waiting on a manager, not what is waiting on a colleague. */
    swaps: (open = true) =>
      request<{ data: ShiftSwapRequest[]; meta: { total: number } }>(
        `swaps${query({ open })}`,
      ),

    approveSwap: (id: string) =>
      request<{ data: ShiftSwapRequest }>(`swaps/${encodeURIComponent(id)}/approve`, {
        method: "POST",
      }).then(unwrap),

    declineSwap: (id: string, reason: string) =>
      request<{ data: ShiftSwapRequest }>(`swaps/${encodeURIComponent(id)}/decline`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),
  },

  /* ---------------------------- attendance ---------------------------- */

  attendance: {
    report: (
      params: {
        from?: string;
        to?: string;
        days?: number;
        groupBy?: "department" | "location";
      } = {},
    ) => request<{ data: AttendanceReport }>(`attendance${query(params)}`).then(unwrap),

    /** Everything authorised is already filtered out. */
    exceptions: (params: { from?: string; to?: string; days?: number } = {}) =>
      request<{
        data: AttendanceDay[];
        meta: { from: string; to: string; total: number };
      }>(`attendance/exceptions${query(params)}`),

    forEmployee: (
      employeeId: string,
      params: { from?: string; to?: string; days?: number } = {},
    ) =>
      request<{
        data: { days: AttendanceDay[]; totals: AttendanceTotals };
      }>(`employees/${encodeURIComponent(employeeId)}/attendance${query(params)}`).then(
        unwrap,
      ),

    rules: () => request<{ data: OvertimeRule[] }>("overtime/rules").then(unwrap),

    /**
     * The multiplier goes up as a multiple because that is what a policy
     * document says; the server stores basis points so nothing rounds twice.
     */
    updateRule: (
      kind: OvertimeKind,
      input: {
        multiplier?: number;
        dailyCapMinutes?: number | null;
        weeklyCapMinutes?: number | null;
        thresholdMinutes?: number;
        requiresApproval?: boolean;
        isActive?: boolean;
      },
    ) =>
      request<{ data: OvertimeRule }>(`overtime/rules/${encodeURIComponent(kind)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),
  },

  /* -------------------------------- leave ----------------------------- */

  leave: {
    /**
     * The decision queue. Defaults to pending, because that is the reason to
     * open the screen; pass `status: null` for the whole history.
     */
    list: (
      filters: {
        status?: LeaveStatus | null;
        employeeId?: string;
        from?: string;
        to?: string;
      } = {},
    ) =>
      request<{ data: LeaveRequest[]; meta: { total: number } }>(
        `leave${query({
          ...filters,
          status: filters.status === null ? "" : filters.status,
        })}`,
      ),

    /** One request, with the coverage and balance that should inform the answer. */
    get: (id: string) =>
      request<{
        data: LeaveRequest;
        meta: { coverage: LeaveCoverage; balance: LeaveBalance | null };
      }>(`leave/${encodeURIComponent(id)}`),

    approve: (id: string, note?: string) =>
      request<{ data: LeaveRequest }>(`leave/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        body: { note },
      }).then(unwrap),

    /** A refusal carries a reason. The API insists, and so should the form. */
    decline: (id: string, reason: string) =>
      request<{ data: LeaveRequest }>(`leave/${encodeURIComponent(id)}/decline`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),

    /**
     * Take back leave already granted. Recorded under its own status, not as a
     * cancellation — the employer overriding a promise is not the employee
     * changing their mind.
     */
    recall: (id: string, reason: string) =>
      request<{ data: LeaveRequest }>(`leave/${encodeURIComponent(id)}/recall`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),

    calendar: (params: { from?: string; days?: number } = {}) =>
      request<{ data: LeaveRequest[]; meta: { from: string; to: string } }>(
        `leave/calendar${query(params)}`,
      ),

    balances: (employeeId: string, year?: number) =>
      request<{ data: LeaveBalance[]; meta: { year: number } }>(
        `employees/${encodeURIComponent(employeeId)}/leave${query({ year })}`,
      ),

    /**
     * Give somebody days, or take them away.
     *
     * A signed adjustment with a note rather than an editable balance: the
     * grant and the spending stay separate, so a balance can always be
     * explained from its parts.
     */
    adjust: (
      employeeId: string,
      input: { leaveTypeId: string; days: number; note: string; year?: number },
    ) =>
      request<{ data: LeaveBalance }>(
        `employees/${encodeURIComponent(employeeId)}/leave/adjust`,
        { method: "POST", body: input },
      ).then(unwrap),

    /* ------------------------------ policy --------------------------- */

    types: () => request<{ data: LeaveType[] }>("leave/types").then(unwrap),

    createType: (input: LeaveTypeInput) =>
      request<{ data: LeaveType }>("leave/types", {
        method: "POST",
        body: input,
      }).then(unwrap),

    updateType: (id: string, input: Partial<LeaveTypeInput>) =>
      request<{ data: LeaveType }>(`leave/types/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /**
     * The annual carry-over run. Idempotent — it assigns the carried figure
     * rather than adding to it, so running it twice in January is harmless.
     */
    carryOver: (id: string, fromYear: number) =>
      request<{
        data: {
          leaveTypeId: string;
          fromYear: number;
          toYear: number;
          employeesCarried: number;
        };
      }>(`leave/types/${encodeURIComponent(id)}/carry-over`, {
        method: "POST",
        body: { fromYear },
      }).then(unwrap),

    holidays: (year?: number) =>
      request<{ data: PublicHoliday[]; meta: { year: number } }>(
        `leave/holidays${query({ year })}`,
      ).then(unwrap),

    createHoliday: (input: {
      name: string;
      observedOn: string;
      location?: string | null;
      consumesLeave?: boolean;
    }) =>
      request<{ data: PublicHoliday }>("leave/holidays", {
        method: "POST",
        body: input,
      }).then(unwrap),

    deleteHoliday: (id: string) =>
      request<void>(`leave/holidays/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  /* -------------------------------- tasks ----------------------------- */

  tasks: {
    list: (
      filters: {
        assigneeId?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        overdue?: boolean;
        includeClosed?: boolean;
        q?: string;
      } = {},
    ) => request<{ data: Task[]; meta: TaskSummary }>(`tasks${query(filters)}`),

    get: (id: string) =>
      request<{ data: Task }>(`tasks/${encodeURIComponent(id)}`).then(unwrap),

    /** Several assignees means one task each, not one shared task. */
    assign: (input: {
      assigneeIds: string[];
      title: string;
      description?: string;
      dueOn?: string;
      priority?: TaskPriority;
      kpiId?: string;
      milestoneId?: string;
    }) =>
      request<{ data: Task[]; meta: { assigned: number } }>("tasks", {
        method: "POST",
        body: input,
      }),

    update: (id: string, input: Record<string, unknown>) =>
      request<{ data: Task }>(`tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /** Blocking requires a reason; the API refuses without one. */
    transition: (
      id: string,
      action: "start" | "block" | "unblock" | "complete" | "reopen" | "cancel",
      reason?: string,
    ) =>
      request<{ data: Task }>(`tasks/${encodeURIComponent(id)}/transition`, {
        method: "POST",
        body: { action, reason },
      }).then(unwrap),
  },

  /* ----------------------------- timesheets --------------------------- */

  timesheet: {
    policy: () => request<{ data: TimePolicy }>("timesheet/policy").then(unwrap),

    updatePolicy: (input: {
      workingDayNumbers?: number[];
      standardMinutes?: number;
      dayStartsAt?: string;
      graceMinutes?: number;
      breakMinutes?: number;
      autoCloseAfterMinutes?: number | null;
      requiresApproval?: boolean;
      allowsManualEntry?: boolean;
    }) =>
      request<{ data: TimePolicy }>("timesheet/policy", {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /** Everybody's week, worst first. */
    overview: (week?: string) =>
      request<{
        data: TimesheetRosterRow[];
        meta: { week: string; people: number };
      }>(`timesheet/overview${query({ week })}`),

    forEmployee: (employeeId: string, week?: string) =>
      request<{
        data: TimesheetWeek;
        meta: { employeeId: string; name: string | null; jobTitle: string };
      }>(`employees/${encodeURIComponent(employeeId)}/timesheet${query({ week })}`),

    pending: () =>
      request<{
        data: TimeEntry[];
        meta: { total: number; estimated: number };
      }>("timesheet/pending"),

    approve: (entryId: string) =>
      request<{ data: TimeEntry }>(
        `timesheet/entries/${encodeURIComponent(entryId)}/approve`,
        { method: "POST", body: {} },
      ).then(unwrap),

    reject: (entryId: string, reason: string) =>
      request<{ data: TimeEntry }>(
        `timesheet/entries/${encodeURIComponent(entryId)}/reject`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    record: (
      employeeId: string,
      input: {
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        workLocation?: string;
        note?: string;
      },
    ) =>
      request<{ data: TimeEntry }>(
        `employees/${encodeURIComponent(employeeId)}/timesheet`,
        { method: "POST", body: input },
      ).then(unwrap),
  },

  /* ------------------------------ my team ----------------------------- */

  /**
   * My team (S9): a line manager's direct reports, and only those. Every call
   * is bounded by the API to the signed-in person's current direct reports;
   * anything else answers 404. Self-service — no HR role needed.
   */
  team: {
    overview: () => request<{ data: TeamOverview }>("team").then(unwrap),

    /** Pending by default; `status: null` for the whole history. */
    leave: (status?: LeaveStatus | null) =>
      request<{ data: LeaveRequest[]; meta: { total: number } }>(
        status === null ? "team/leave?status=" : `team/leave${query({ status })}`,
      ),

    getLeave: (id: string) =>
      request<{
        data: LeaveRequest;
        meta: { coverage: LeaveCoverage; balance: LeaveBalance | null };
      }>(`team/leave/${encodeURIComponent(id)}`),

    approveLeave: (id: string, note?: string) =>
      request<{ data: LeaveRequest }>(`team/leave/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        body: { note },
      }).then(unwrap),

    declineLeave: (id: string, reason: string) =>
      request<{ data: LeaveRequest }>(`team/leave/${encodeURIComponent(id)}/decline`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),

    timesheets: () =>
      request<{ data: TimeEntry[]; meta: { total: number; estimated: number } }>("team/timesheets"),

    approveTimesheet: (entryId: string) =>
      request<{ data: TimeEntry }>(`team/timesheets/${encodeURIComponent(entryId)}/approve`, {
        method: "POST",
        body: {},
      }).then(unwrap),

    rejectTimesheet: (entryId: string, reason: string) =>
      request<{ data: TimeEntry }>(`team/timesheets/${encodeURIComponent(entryId)}/reject`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),

    swaps: (open = true) =>
      request<{ data: ShiftSwapRequest[]; meta: { total: number } }>(`team/swaps${query({ open })}`),

    approveSwap: (id: string) =>
      request<{ data: ShiftSwapRequest }>(`team/swaps/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        body: {},
      }).then(unwrap),

    declineSwap: (id: string, reason: string) =>
      request<{ data: ShiftSwapRequest }>(`team/swaps/${encodeURIComponent(id)}/decline`, {
        method: "POST",
        body: { reason },
      }).then(unwrap),

    reviews: (includeClosed = false) =>
      request<{
        data: PerformanceReview[];
        meta: { total: number; awaitingSelf: number; awaitingManager: number; awaitingMeeting: number };
      }>(`team/reviews${query({ includeClosed })}`),

    submitManagerReview: (
      id: string,
      input: {
        managerRating?: number;
        managerComments?: string;
        strengths?: string;
        development?: string;
        objectives?: string;
      },
    ) =>
      request<{ data: PerformanceReview }>(`team/reviews/${encodeURIComponent(id)}/manager`, {
        method: "POST",
        body: input,
      }).then(unwrap),
  },

  /* ------------------------------- mine ------------------------------- */

  me: {
    /**
     * `data` is null for somebody with an account but no employment record —
     * an examiner, a contractor billed through Finance. Not an error.
     */
    employment: () =>
      request<{ data: Employee | null; message?: string }>("me").then(
        (res) => res.data,
      ),

    completeStep: (stepId: string, note?: string) =>
      request<{ data: OnboardingStep }>(
        `me/onboarding/steps/${encodeURIComponent(stepId)}/complete`,
        { method: "POST", body: { note } },
      ).then(unwrap),

    /* -------------------------- my own details ----------------------- */

    /**
     * Their own record, including the parts they may not change.
     *
     * `meta.editable` is the API's own list of what self-service covers —
     * `Employee::SELF_EDITABLE`, in column names. The screen is driven from it
     * rather than from a second copy of the list here, so a field the backend
     * later stops trusting somebody with goes read-only without a release.
     */
    details: () =>
      request<{ data: PersonalRecord; meta: { editable: string[] } }>(
        "me/details",
      ),

    /**
     * Change the parts that are theirs to change.
     *
     * The API ignores anything outside `SELF_EDITABLE`; this signature is
     * narrowed to the same set so a caller never believes it changed a job
     * title and finds out from a support ticket.
     */
    saveDetails: (input: Partial<SelfEditableDetails>) =>
      request<{ data: PersonalRecord }>("me/details", {
        method: "PATCH",
        body: input,
      }).then(unwrap),

    /** Download link for the scan of one of my own documents. */
    documentFileUrl: (documentId: string) =>
      `/api/hrm/me/documents/${encodeURIComponent(documentId)}/file`,

    /* ---------------------------- my week ---------------------------- */

    timesheet: (week?: string) =>
      request<{ data: MyTimesheet | null }>(`me/timesheet${query({ week })}`).then(
        (res) => res.data,
      ),

    clockIn: (workLocation?: string) =>
      request<{ data: TimeEntry }>("me/timesheet/clock-in", {
        method: "POST",
        body: { workLocation },
      }).then(unwrap),

    clockOut: (note?: string) =>
      request<{ data: TimeEntry }>("me/timesheet/clock-out", {
        method: "POST",
        body: { note },
      }).then(unwrap),

    recordDay: (input: {
      workDate: string;
      clockInAt: string;
      clockOutAt: string;
      note?: string;
    }) =>
      request<{ data: TimeEntry }>("me/timesheet/entries", {
        method: "POST",
        body: input,
      }).then(unwrap),

    submitWeek: (from: string, to: string) =>
      request<{
        data: { submitted: number; skippedOpen: number };
        message: string;
      }>("me/timesheet/submit", { method: "POST", body: { from, to } }),

    /* ---------------------------- my work ---------------------------- */

    tasks: (includeClosed = false) =>
      request<{ data: Task[]; meta: TaskSummary }>(
        `me/tasks${query({ includeClosed })}`,
      ),

    moveTask: (
      taskId: string,
      action: "start" | "block" | "unblock" | "complete" | "reopen",
      reason?: string,
    ) =>
      request<{ data: Task }>(`me/tasks/${encodeURIComponent(taskId)}`, {
        method: "POST",
        body: { action, reason },
      }).then(unwrap),

    /* ----------------------------- my pay ---------------------------- */

    /** Distributed payslips only — approval freezes, distribution tells. */
    payslips: () =>
      request<{
        data: Payslip[];
        meta: {
          total: number;
          grossThisYearKobo: number;
          payeThisYearKobo: number;
        };
      }>("me/payslips"),

    payslip: (id: string) =>
      request<{ data: Payslip }>(`me/payslips/${encodeURIComponent(id)}`).then(unwrap),

    /** What I owe, and how it is being recovered. */
    loans: () =>
      request<{
        data: EmployeeLoan[];
        meta: { outstandingKobo: number; monthlyKobo: number };
      }>("me/loans"),

    /* -------------------------- my interviews ------------------------ */

    /** Panels I am on. No role needed — anybody can be asked. */
    interviews: (includePast = false) =>
      request<{
        data: Interview[];
        meta: { awaitingMyScorecard: number; submittedInterviewIds: string[] };
      }>(`me/interviews${query({ includePast })}`),

    /**
     * One interview, with whatever I am entitled to see of the panel.
     *
     * `panel.visible` false means I have not written mine up yet. It is not an
     * error and the screen has to say so, rather than showing an empty list
     * that reads as nobody else having bothered.
     */
    interview: (id: string) =>
      request<{
        data: Interview;
        meta: { mine: InterviewScorecard | null; panel: PanelView };
      }>(`me/interviews/${encodeURIComponent(id)}`),

    /** `draft` keeps it private and changeable. Without it, submitting is final. */
    submitScorecard: (
      interviewId: string,
      input: {
        verdict: ScorecardVerdict;
        ratings?: ScorecardRating[];
        strengths?: string;
        concerns?: string;
        notes?: string;
        draft?: boolean;
      },
    ) =>
      request<{ data: InterviewScorecard }>(
        `me/interviews/${encodeURIComponent(interviewId)}/scorecard`,
        { method: "POST", body: input },
      ).then(unwrap),

    /* ----------------------------- my rota --------------------------- */

    /** Published shifts only. A draft is not mine to plan around. */
    roster: (params: { from?: string; days?: number } = {}) =>
      request<{
        data: RosterAssignment[];
        meta: { from: string; to: string; expectedMinutes: number };
      }>(`me/roster${query(params)}`),

    /** The same figures the HR manager sees, deliberately. */
    attendance: (params: { from?: string; days?: number } = {}) =>
      request<{
        data: { days: AttendanceDay[]; totals: AttendanceTotals };
      }>(`me/attendance${query(params)}`).then(unwrap),

    swaps: () =>
      request<{ data: ShiftSwapRequest[]; meta: { awaitingMe: number } }>(
        "me/swaps",
      ),

    /**
     * Current colleagues to ask for a swap: names only. The HR employee list
     * is manager-only, so the picker can't use it.
     */
    colleagues: () =>
      request<{ data: { id: string; name: string | null; jobTitle: string | null }[] }>(
        "me/roster/colleagues",
      ).then(unwrap),

    /** `wantedAssignmentId` omitted is a giveaway. */
    requestSwap: (input: {
      offeredAssignmentId: string;
      requestedToId: string;
      wantedAssignmentId?: string | null;
      reason?: string;
    }) =>
      request<{ data: ShiftSwapRequest }>("me/swaps", {
        method: "POST",
        body: input,
      }).then(unwrap),

    /** My answer as the colleague. Agreeing is not approving. */
    respondToSwap: (id: string, accepted: boolean, note?: string) =>
      request<{ data: ShiftSwapRequest }>(
        `me/swaps/${encodeURIComponent(id)}/respond`,
        { method: "POST", body: { accepted, note } },
      ).then(unwrap),

    cancelSwap: (id: string) =>
      request<{ data: ShiftSwapRequest }>(
        `me/swaps/${encodeURIComponent(id)}/cancel`,
        { method: "POST" },
      ).then(unwrap),

    /* ---------------------------- my leave --------------------------- */

    /** Balances and requests together: one without the other reads as an error. */
    leave: (year?: number) =>
      request<{ data: MyLeave }>(`me/leave${query({ year })}`).then(unwrap),

    /** Only the types this person actually qualifies for. */
    leaveTypes: () =>
      request<{ data: LeaveType[] }>("me/leave/types").then(unwrap),

    /**
     * What a range would cost, before committing to it.
     *
     * Called as the date pickers move. Never writes, so it is safe to call on
     * every keystroke.
     */
    quoteLeave: (params: {
      startsOn: string;
      endsOn: string;
      startPortion?: DayPortion;
      endPortion?: DayPortion;
    }) => request<{ data: LeaveQuote }>(`me/leave/quote${query(params)}`).then(unwrap),

    requestLeave: (input: LeaveRequestInput) =>
      request<{ data: LeaveRequest }>("me/leave", {
        method: "POST",
        body: input,
      }).then(unwrap),

    cancelLeave: (id: string, reason?: string) =>
      request<{ data: LeaveRequest }>(
        `me/leave/${encodeURIComponent(id)}/cancel`,
        { method: "POST", body: { reason } },
      ).then(unwrap),

    /** Who on my team is away, so I can book around them. */
    leaveCalendar: (params: { from?: string; days?: number } = {}) =>
      request<{
        data: LeaveRequest[];
        meta: {
          from: string;
          to: string;
          holidays: { name: string; observedOn: string }[];
        };
      }>(`me/leave/calendar${query(params)}`),

    /* ------------------------- my performance ------------------------ */

    performance: () =>
      request<{ data: EmployeePerformance | null }>("me/performance").then(
        (res) => res.data,
      ),

    reviews: () =>
      request<{ data: PerformanceReview[] }>("me/reviews").then(unwrap),

    /** My own half of a review. The manager writes theirs afterwards. */
    submitSelf: (
      reviewId: string,
      input: { selfRating?: number; selfAssessment?: string },
    ) =>
      request<{ data: PerformanceReview }>(
        `me/reviews/${encodeURIComponent(reviewId)}/self`,
        { method: "POST", body: input },
      ).then(unwrap),
  },
};

export interface KpiInput {
  title: string;
  description?: string;
  metricType: MetricType;
  direction?: MetricDirection;
  /** The number a person typed. The API scales it for storage. */
  targetValue: number;
  baselineValue?: number;
  unit?: string;
  weight?: number;
  periodStart: string;
  periodEnd: string;
  status?: KpiStatus;
}

export interface StepInput {
  title: string;
  description?: string;
  ownerRole: StepOwner;
  category?: string;
  /**
   * Optional, and null on most steps.
   *
   * Naming a course makes the step answerable from the LMS instead of on
   * somebody's word — it is assigned when the journey starts, and ticks itself
   * off when they finish it. Issuing a laptop is not a course, and the
   * majority of onboarding steps are of that kind.
   */
  courseId?: string | null;
  dueOffsetDays?: number;
  isRequired?: boolean;
}
