/* ------------------------------------------------------------------ */
/*  Browser-side client for Elevate Projects.                          */
/*  Calls the same-origin /api/projects/* proxy (token stays httpOnly).*/
/* ------------------------------------------------------------------ */

"use client";

import { ApiError } from "@/lib/api/admin-client";
import { messageFrom } from "@/lib/api/http-errors";

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/projects/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return {} as T;

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    /* The API's own words, or what the status means - never a bare "Request failed." */
    throw new ApiError(messageFrom(res.status, json), res.status, json?.errors);
  }

  return (json ?? {}) as T;
}

/**
 * A multipart POST.
 *
 * Separate from `request` because **no `Content-Type` may be set**: the
 * browser writes it with the multipart boundary, and setting it by hand is the
 * classic way to make a file unreadable at the other end.
 */
async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`/api/projects/${path}`, {
    method: 'POST',
    body,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(messageFrom(res.status, json, 'That file could not be uploaded.'), res.status, json?.errors);
  }

  return json as T;
}

/**
 * A multipart POST that reports how much of the body has been sent.
 *
 * `fetch` cannot report upload progress, so this one uses XMLHttpRequest. The
 * fraction is of the bytes the browser has handed to the network; the server
 * starts reading the file once it reaches 1.
 */
function uploadWithProgress<T>(path: string, body: FormData, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${path}`);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
    };
    xhr.upload.onload = () => onProgress(1);

    xhr.onload = () => {
      let json: ({ message?: string; errors?: Record<string, string[]> } & Record<string, unknown>) | null = null;
      try {
        json = JSON.parse(xhr.responseText || "null");
      } catch {
        /* A non-JSON body (a timeout page): the status says what happened. */
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((json ?? {}) as T);
      } else {
        reject(new ApiError(messageFrom(xhr.status, json ?? xhr.responseText, "That file could not be uploaded."), xhr.status, json?.errors));
      }
    };
    xhr.onerror = () => reject(new ApiError("The connection dropped before the server answered. Check your connection and try again.", 0));
    xhr.ontimeout = () => reject(new ApiError("The server took too long to answer.", 0));

    xhr.send(body);
  });
}

/** Unwrap a `{ data }` envelope. */
function unwrap<T>(res: { data: T }): T {
  return res.data;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }

  const s = qs.toString();

  return s === "" ? "" : `?${s}`;
}

export { ApiError };

/* ------------------------------------------------------------------ */
/*  Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export type ProjectType = "client" | "internal";

export type ProjectLifecycle =
  | "planning"
  | "active"
  | "on_hold"
  | "complete"
  | "cancelled";

/**
 * What somebody may do on **one** project.
 *
 * Organisation-wide reach comes from the roles a person holds, not a role here,
 * so it never appears in this union — somebody reaching a project that way has
 * no membership row and `viewerRole` is null while `can.*` is true. Read the permissions from
 * `can`, never from the role.
 */
/** `qa_analyst` and `security_analyst` run the project's testing (5 Oct 2026). */
export type ProjectRole =
  | "project_manager"
  | "product_manager"
  | "member"
  | "qa_analyst"
  | "security_analyst"
  /**
   * On every team through a role with Joins every project (roles redesign,
   * phase 2a); set by the system, never picked. The two leads' own labels
   * were folded into it in commit 8.
   */
  | "oversight";

export type WorkItemType = "epic" | "story" | "task" | "bug" | "spike";

export type SprintState = "planning" | "active" | "closed";

export type StakeholderRole =
  | "sponsor"
  | "decision_maker"
  | "contact"
  | "reviewer"
  | "end_user"
  | "observer";

/**
 * How much influence or interest somebody has. One scale, asked twice.
 *
 * Three levels on purpose: a five-point scale invites the middle, and a
 * stakeholder map whose every entry is a 3 has recorded nothing.
 */
export type StakeholderWeight = "high" | "medium" | "low";

/**
 * What to do about them - the Mendelow grid.
 *
 * **Derived server-side from influence and interest, never sent up.** A stored
 * strategy is a third fact that can disagree with the two it came from.
 */
export type EngagementStrategy =
  | "manage_closely"
  | "keep_satisfied"
  | "keep_informed"
  | "monitor";

/* ------------------------------------------------------------------ */
/*  Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface Portfolio {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  position: number;
  projectCount?: number;
  createdAt: string | null;
}

/** A colleague the add-somebody picker can offer. */
export interface MemberCandidate {
  userId: string;
  name: string | null;
  email: string | null;
  /** Their title from the organisation's list, when they are linked to one. */
  jobTitleId?: string | null;
  jobTitle: string | null;
}

export type ProjectSeat = "owner" | "member" | "oversight" | "viewer";

/** The seats a person can be given on the team page; Oversight comes only from a role. */
export type ChosenSeat = Exclude<ProjectSeat, "oversight">;

export interface ProjectMember {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  initials: string | null;
  role: ProjectRole;
  roleLabel: string;
  roleDescription: string;
  /**
   * How they sit on the project (roles redesign, phase 2a): Owner, Member or
   * Viewer as chosen on the team page, or Oversight from a role that joins
   * every project. What they may do here; the role is the label beside it.
   */
  seat?: ProjectSeat;
  seatLabel?: string;
  /** Owner or Member: one of the people doing the work. */
  working?: boolean;
  /** Their role joins every project: removing them puts their Oversight seat back. */
  joinsEveryProject?: boolean;
  /** The row is the person looking at it. */
  isYou?: boolean;
  /** The row itself is the system's: an Oversight seat from a role that joins every project. */
  systemManaged?: boolean;
  managesBoard: boolean;
  managesProject: boolean;
  managesMembers: boolean;
  /** Runs the project's testing: QA and security analysts, and both managers. */
  managesTesting?: boolean;
  /**
   * Their job title on this project — what their hours cost at. Stored in the
   * old `discipline_id` field, which since 27 Sep 2026 holds an id from the
   * organisation's job-title list; `jobTitleId` / `jobTitle` are the same
   * values under their new names.
   */
  disciplineId?: string | null;
  discipline?: string | null;
  jobTitleId?: string | null;
  jobTitle?: string | null;
  addedBy: string | null;
  addedAt: string | null;
}

/** Somebody at an external company, held once and mapped onto many projects. */
export interface ExternalPerson {
  id: string;
  companyId: string;
  company?: string | null;
  name: string;
  initials: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  /** People leave. Marked, never deleted - their placements are history. */
  isActive: boolean;
  createdAt: string | null;
}

/** An organisation this institution works for. Not a tenant, not a CRM record. */
export interface ExternalCompany {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  sector: string | null;
  notes: string | null;
  status: "active" | "former";
  isActive: boolean;
  /** Counted from what this viewer may see, so it never leaks an engagement. */
  projectCount?: number;
  stakeholderCount?: number;
  stakeholders?: ExternalPerson[];
  createdAt: string | null;
}

/**
 * One person on the other side of one project.
 *
 * Per project rather than per company: a finance director who signs off one
 * engagement and never hears about another is not the same stakeholder twice.
 */
export interface ProjectStakeholder {
  id: string;
  projectId: string;
  person: ExternalPerson;

  role: StakeholderRole;
  roleLabel: string;
  roleDescription: string;
  /** Can they hold delivery up by not answering? */
  canBlockDelivery: boolean;

  influence: StakeholderWeight;
  influenceLabel: string;
  interest: StakeholderWeight;
  interestLabel: string;

  strategy: EngagementStrategy;
  strategyLabel: string;
  /** The sentence somebody can act on. "Keep satisfied" alone means nothing. */
  guidance: string;

  /** Somebody who can stop this, who is not being managed closely. */
  isUnmanagedRisk: boolean;

  isPrimary: boolean;
  notes: string | null;
  addedBy?: string | null;
  addedAt: string | null;
}

export interface StakeholderMapMeta {
  canManage: boolean;
  company: { id: string; slug: string; name: string } | null;
  /** Counts per quadrant, for the grid. */
  grid: Record<EngagementStrategy, number>;
  unmanagedRisks: number;
  hasPrimary: boolean;
}

export interface Project {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  description: string | null;

  type: ProjectType;
  typeLabel: string;
  isBillable: boolean;

  status: ProjectLifecycle;
  statusLabel: string;
  isOpen: boolean;

  startsOn: string | null;
  targetEndsOn: string | null;
  actualEndsOn: string | null;

  /** Negative once overdue; **null means nobody set a target**, not zero. */
  daysToTarget: number | null;
  isOverdue: boolean;

  currency: string;
  /**
   * Why type and currency can no longer change, or null while they still may
   * (P16). Sent on a single project only; absent on list rows.
   */
  typeAndCurrencyLock?: string | null;

  portfolio?: { id: string; name: string } | null;

  /** Null on an internal project, which is an answer rather than missing data. */
  externalCompany?: { id: string; slug: string; name: string } | null;
  externalCompanyId: string | null;

  /**
   * Where sprint starts and closes are posted in the organisation's Slack: a
   * channel id or `#name`. Null posts nowhere.
   */
  slackChannel?: string | null;

  memberCount?: number;
  stakeholderCount?: number;
  members?: ProjectMember[];

  /** Null when the viewer reaches this through their roles, not membership. */
  viewerRole: ProjectRole | null;
  /** The viewer's seat here, or null when they hold none (roles redesign, phase 2a). */
  viewerSeat?: ProjectSeat | null;

  /**
   * Resolved server-side, because the rule is "roles OR membership" and
   * a client cannot work that out without shipping the policy twice. Hide a
   * control this denies — and never show one it denies, or somebody learns a
   * permission rule from an error message.
   */
  can: {
    update: boolean;
    manageMembers: boolean;
    manageBoard: boolean;
    delete: boolean;
    /**
     * Narrower than the board: a rate card says what each colleague costs per
     * hour, and a cost report gives the margin on the client's work. Read this
     * rather than inferring it from `manageBoard`.
     */
    viewCost: boolean;
    manageRates: boolean;
    logTimeForOthers: boolean;
    /*
      The finer abilities `manageBoard` and `update` were split into on
      2 Oct 2026, so a custom role is offered exactly what its keys allow
      (a scrum master: sprints, not Import or Generate). Optional only for
      an older API; read them with `??` falling back to the broad flag.
    */
    manageSprints?: boolean;
    manageDependencies?: boolean;
    estimate?: boolean;
    manageDocuments?: boolean;
    importBacklog?: boolean;
    generate?: boolean;
    exportPerformance?: boolean;
    manageCharter?: boolean;
    manageShares?: boolean;
    manageStakeholders?: boolean;
    manageChannels?: boolean;
    /** Test sprints, the case library and the test backlog. */
    manageTesting?: boolean;
    /** Draft test cases with the organisation's AI key. */
    generateTests?: boolean;
  };

  createdAt: string | null;
}

/** One column on a board. */
export interface WorkItemStatus {
  id: string;
  key: string;
  label: string;
  position: number;
  /** Only `Done` is true. `Partially Done` is deliberately not. */
  countsAsComplete: boolean;
  /** Where a new item lands. Exactly one per project. */
  isDefault?: boolean;
}

/**
 * A job title from the organisation's list, as the board sees it. Named for
 * the disciplines it replaced on 27 Sep 2026; the id is the job title's id.
 */
export interface Discipline {
  id: string;
  key: string;
  label: string;
  /** The job title's name (the same as `label`). */
  name?: string;
}

/**
 * Everything needed to draw a board and fill in a form about one item.
 *
 * One call, because nothing can use any part of it alone — and because the
 * first version derived columns from an existing item, which left a new
 * project with no columns to put a first item into.
 */
export interface BoardSetup {
  statuses: WorkItemStatus[];
  /** The organisation's job titles (kept under the old name). */
  disciplines: Discipline[];
  /** The same list under its new name. */
  jobTitles?: Discipline[];
  /** The people on this project. Assigning outside it loses tickets. */
  assignees: { id: string; name: string; role: ProjectRole }[];
}

export interface WorkItem {
  id: string;
  projectId: string;
  sprintId: string | null;
  parentId: string | null;

  /**
   * Bugs only: the work this bug was found in. Null on most bugs, and null
   * when the task it named has since been deleted. Set with
   * `workItems.create/update(..., { foundInItemId })`; the API refuses it on
   * anything but a bug, off the project, or pointing at itself.
   */
  foundInItemId?: string | null;
  /** Present when the API loaded it (every work-item endpoint does). */
  foundIn?: { id: string; title: string; externalRef: string | null; type: WorkItemType } | null;

  /**
   * The story (or epic) this sits under. Present when the API loaded the
   * relation — it does on `get` and on a story's tasks — and absent on list
   * rows, where `parentId` alone is what there is.
   */
  parent?: { id: string; title: string; type: WorkItemType } | null;

  type: WorkItemType;
  typeLabel: string;
  countsTowardsVelocity: boolean;

  title: string;
  description: string | null;
  expectedOutcome: string | null;
  /** One condition per line; what the test cases prove. */
  acceptanceCriteria?: string | null;

  /*
    A finding's fields: bugs raised by QA or a security analyst. Null on
    everything else, and on a bug nobody classified.
  */
  severity?: FindingSeverity | null;
  severityLabel?: string | null;
  findingCategory?: FindingCategory | null;
  findingCategoryLabel?: string | null;
  stepsToReproduce?: string | null;
  recommendation?: string | null;
  testSprintId?: string | null;
  testSprint?: { id: string; name: string } | null;
  testCaseId?: string | null;
  testCase?: { id: string; reference: string; title: string } | null;
  /** The sprint's name, where the API loaded it (the test backlog does). */
  sprint?: { id: string; name: string; sequence: number } | null;

  status?: WorkItemStatus;
  isComplete: boolean;

  discipline?: { id: string; key: string; label: string } | null;
  assignee?: { id: string; name: string | null } | null;

  /**
   * **Null means nobody estimated it, and that is the common case** — the real
   * backlog this was designed against had 118 tasks and no estimates at all.
   * Render "not estimated"; never render 0, and never sum as if it were.
   */
  estimateHours: number | null;
  estimatePoints: number | null;

  /**
   * When work on it is planned to start; `dueOn` is when it is planned to end.
   * Optional because items written before the planner carry neither, and the
   * API refuses a start after the due date (422 on `startsOn`).
   */
  startsOn?: string | null;
  dueOn: string | null;
  priority: number;
  /** Worth telling a client about. Any item can be one. */
  isMilestone: boolean;
  /** What the client page calls this milestone; null means its title (P13). */
  clientTitle?: string | null;
  /** Blocked **now**. Not the same thing as `possibleBlockers`. */
  blockedReason: string | null;
  /** Foreseeable risks to plan around — nothing is blocked yet. */
  possibleBlockers?: string | null;
  /**
   * Stories only: their children's hours. `hours` is null when no child is
   * estimated (never 0); `estimated` of `total` children carry an estimate.
   */
  rollup?: { hours: number | null; estimated: number; total: number } | null;
  externalRef: string | null;
  position: number;

  completedAt: string | null;

  /**
   * Times this moved backwards. A team signal per project and discipline; per
   * person only on that person's own `performance.mine`.
   */
  bounceBacks: number;

  can: { move: boolean; update: boolean; delete: boolean };

  createdAt: string | null;
}

/** A total, and how much of it is actually covered by estimates. */
export interface EffortTotals {
  count: number;
  hours: number;
  points: number;
  /** Of `count`, how many carried an estimate. Show it beside the hours. */
  estimated: number;
}

export interface SprintReport {
  committed: EffortTotals;
  completed: EffortTotals;
  carriedOver: EffortTotals;
  addedMidSprint: EffortTotals;
  bounceBacks: number;
  /** Null until the sprint closes. Zero would be a claim about a team. */
  velocityHours: number | null;
}

export interface Sprint {
  id: string;
  projectId: string;
  sequence: number;
  name: string;
  goal: string | null;

  startsOn: string;
  endsOn: string;
  lengthInDays: number;
  daysRemaining: number;
  /** Running past its end without being closed. Reported, never auto-fixed. */
  hasOverrun: boolean;

  status: SprintState;
  statusLabel: string;
  acceptsChanges: boolean;

  startedAt: string | null;
  closedAt: string | null;

  itemCount?: number;
  committed?: { hours: number; estimated: number; total: number };
}

/* ------------------------------------------------------------------ */
/*  Importing a backlog                                                 */
/* ------------------------------------------------------------------ */

export type ImportStatus =
  | "parsing"
  | "previewing"
  | "committed"
  | "discarded"
  | "failed";

/**
 * What a column in an uploaded sheet is taken to mean.
 *
 * `ignore` is a real answer, not a fallback: a sheet carries columns that are
 * nobody's business here, and marking one ignored is how somebody says "yes, I
 * saw it, leave it".
 */
export type ImportField =
  | "task_ref"
  | "title"
  | "user_story"
  | "epic"
  | "description"
  | "expected_outcome"
  | "assignee"
  | "discipline"
  | "estimate_hours"
  | "estimate_points"
  | "due_on"
  | "status"
  | "blockers"
  | "notes"
  | "type"
  | "ignore";

/**
 * What the importer has decided about one row.
 *
 * `warn` still imports. The field it could not work out is left unset rather
 * than guessed, and `reasons` says which — an unmatched name, a status with no
 * matching column, an unreadable date.
 */
export type RowVerdict = "import" | "warn" | "skip";

/** One row of the sheet, as read and as judged. */
export interface ImportRow {
  /** The spreadsheet's own row number, gaps and all, so it can be found. */
  row: number;
  verdict: RowVerdict;
  /** Shown beside the row. Empty when the verdict is a plain `import`. */
  reasons: string[];

  /** The row exactly as read, keyed by column letter. */
  cells: Record<string, string>;

  taskRef: string | null;
  title: string | null;
  /**
   * The epic the row's story sits under. Optional; filled down within one
   * story, never across stories, and always null on a row with no story.
   */
  epic?: string | null;
  story: string | null;
  description: string | null;
  expectedOutcome: string | null;
  type: WorkItemType;

  /** The cell as written: a name, `Discipline - Name`, or a user id. */
  assignee: string | null;
  /**
   * The project member it resolved to. Null when nobody matched — then
   * `reasons` says why (an unknown or non-member id is always reported).
   */
  assigneeId: string | null;
  /** That member's name, so a preview of an id reads as a person. */
  assigneeName?: string | null;
  disciplineId: string | null;

  statusText: string | null;
  statusId: string | null;

  /** **Null means nobody estimated it**, and that is the common case. */
  estimateHours: number | null;
  estimatePoints: number | null;

  dueOn: string | null;
  blockedReason: string | null;
}

export interface BacklogImport {
  id: string;
  projectId: string;
  sprintId: string | null;

  filename: string;
  sheetName: string | null;

  /**
   * Every tab in the workbook, with its row count.
   *
   * The one that was read is `sheetName`; this is what makes that visibly a
   * choice. Switching re-uploads the file the browser still holds, because the
   * upload itself is deliberately not kept server-side.
   */
  sheets: { name: string; rows: number }[];

  status: ImportStatus;
  statusLabel: string;
  isOpen: boolean;
  /** Why the file could not be read. Shown verbatim; it is written to be. */
  error: string | null;

  /** Column letter => field, beside the header text the file used. */
  mapping: Record<string, ImportField>;
  headers: Record<string, string>;

  counts: {
    rows: number;
    importable: number;
    skipped: number;
    /** Distinct epics named on rows that will import under a story. */
    epics?: number;
    stories: number;
    created: number;
  };

  /** The same two counts under the contract's names. */
  epicCount?: number;
  storyCount?: number;

  /**
   * An estimate column was mapped and left entirely empty.
   *
   * Said once about the file rather than on every row — the sheet this was
   * built against has 118 tasks and not one estimate, and a note per row would
   * bury the ones that matter.
   */
  estimatesAllEmpty: boolean;

  verdicts: Record<RowVerdict, number>;

  /** Omitted from the history list; present on a single import. */
  rows?: ImportRow[];

  uploadedBy?: string | null;
  committedAt: string | null;
  createdAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Money                                                               */
/* ------------------------------------------------------------------ */

/**
 * Which rule in the rate chain produced a rate.
 *
 * Carried on every logged hour so "why is this $35" is answerable from the row
 * rather than by re-deriving a resolution somebody has since changed.
 * `none` means nobody has set a rate: the hour costs zero and says so.
 */
export type RateSource =
  | "project_person"
  | "project_discipline"
  | "project_default"
  | "organisation_person"
  | "organisation_discipline"
  | "organisation_default"
  | "none";

/**
 * An amount in **minor units** — cents, kobo — and its currency.
 *
 * Never a float. A project's cost is a sum of thousands of rows, and a float
 * cent lost per row is a figure somebody reconciles by hand. Divide by 100 only
 * to render.
 */
export interface MoneyFigure {
  minor: number;
  currency: string;

  /**
   * The same amount in another currency, with the rate and date that produced
   * it. Present only when `?in=` was asked for and a rate exists.
   */
  converted?: {
    minor: number;
    currency: string;
    rate: number;
    asOf: string;
    /** Over thirty days old. Flagged, never used to refuse the conversion. */
    isStale: boolean;
    daysOld: number;
  };

  /** Set when `?in=` was asked for and no rate has been entered for the pair. */
  conversionUnavailable?: string;
}

export interface ProjectRate {
  id: string;
  projectId: string | null;
  disciplineId: string | null;
  discipline?: string | null;
  userId: string | null;
  user?: string | null;
  rateMinor: number;
  currency: string;
  source: RateSource;
  sourceLabel: string;
  /** Higher beats lower when the chain is resolved. */
  specificity: number;
  note: string | null;
  createdAt: string | null;
}

/** What a discipline actually resolves to on one project, overrides applied. */
export interface EffectiveRate {
  disciplineId: string;
  label: string;
  /** Null when nothing is set. The hour costs zero and the report says so. */
  rateMinor: number | null;
  currency: string;
  source: RateSource;
  sourceLabel: string;
}

export interface TimeLog {
  id: string;
  projectId: string;
  workItemId: string | null;
  workItem?: { id: string; title: string; externalRef: string | null } | null;

  userId: string;
  user?: string | null;
  disciplineId: string | null;
  discipline?: string | null;

  workedOn: string;
  /** What is stored and summed. `hours` is for reading. */
  minutes: number;
  hours: number;

  /** A fact about the hour, not the project. */
  isBillable: boolean;
  note: string | null;

  /**
   * **Absent unless this viewer may see cost**, rather than zeroed — a zero is
   * a claim and an absence is not.
   */
  rateMinor?: number;
  costMinor?: number;
  currency?: string;
  rateSource?: RateSource | null;
  rateSourceLabel?: string | null;

  createdAt: string | null;
}

export interface ProjectCost {
  currency: string;
  isBillable: boolean;

  spent: MoneyFigure;
  billableSpent: MoneyFigure;

  time: {
    minutes: number;
    hours: number;
    billableHours: number;
    /** Hours logged before anybody set a rate. Costed at zero. */
    unratedHours: number;
    people: number;
  };

  committed: MoneyFigure & {
    hours: number;
    /** Of the unfinished items, how many carry an estimate. */
    estimated: number;
    total: number;
    /** `estimated / total`, or null when there is no open work. */
    coverage: number | null;
  };

  forecast: MoneyFigure;

  /**
   * False when the remaining work carries no estimates at all.
   *
   * A forecast over twelve estimated items out of a hundred and eighteen is the
   * cost of twelve items wearing the name of a project. Show the caveat rather
   * than the number.
   */
  forecastIsMeaningful: boolean;

  rates: EffectiveRate[];
}

export interface ExchangeRateRow {
  id: string;
  base: string;
  quote: string;
  rateBp: number;
  /** For display. Conversions happen server-side in basis points. */
  rate: number;
  asOf: string;
  isStale: boolean;
  daysOld: number;
}

/* ------------------------------------------------------------------ */
/*  The AI                                                              */
/* ------------------------------------------------------------------ */

export type AiProviderKey = "openai" | "anthropic" | "gemini";

/**
 * One provider, as the settings screen sees it.
 *
 * **`keyHint` is four characters and `hasKey` is a boolean.** The key itself
 * never crosses the wire — the hint answers "is this the key I think it is"
 * without being enough to use, and the difference between "not configured" and
 * "configured, and I am not telling you" matters to somebody deciding whether
 * they still need to go and find it.
 */
export interface AiProviderSettings {
  provider: AiProviderKey;
  label: string;
  /** Where to go and get a key. */
  keysUrl: string;
  /** Suggestions, not a whitelist — any model the provider accepts works. */
  models: string[];
  defaultModel: string;

  id: string | null;
  keyHint: string | null;
  hasKey: boolean;
  model: string;
  isDefault: boolean;
  /** Null means no ceiling, which is a decision rather than an omission. */
  monthlyTokenBudget: number | null;
  verifiedAt: string | null;
  lastError: string | null;
  tokensThisMonth: number;
}

export interface AiUsageSummary {
  tokensThisMonth: number;
  callsThisMonth: number;
  /** Counted apart: a run of these is a rotated key. */
  failuresThisMonth: number;
  monthStartedOn: string;
  byFeature: Record<string, { calls: number; tokens: number }>;
}

export interface AiUsageRow {
  id: string;
  provider: AiProviderKey;
  model: string;
  feature: string;
  project: string | null;
  user: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  succeeded: boolean;
  error: string | null;
  at: string | null;
}

/** One generated item, before anybody has approved it. */
export interface AiItem {
  /** Ticked by default: most of what comes back is usable. */
  keep?: boolean;
  title: string;
  description: string | null;
  expectedOutcome?: string | null;
  /** What the model called it — kept even when it matched nothing. */
  discipline?: string | null;
  /** Null when the model invented a discipline. Never guessed. */
  disciplineId?: string | null;
  /** **Null, never 0.** A zero is a wrong number, not an absent one. */
  estimateHours?: number | null;
  /**
   * Drafted from the kind of system the brief names, not from its words.
   * Stories only; the first ones a reader should question.
   */
  assumed?: boolean;
}

/*
  The delivery plan: epics › stories › tasks, stored in the generation's
  `items` for feature `backlog`. Nodes are addressed by path — "e", "e.s",
  "e.s.t", 0-based — because a title is not unique and an index into a flat
  list does not survive a tree.
*/

/** One task in a drafted plan. Hours are **null, never 0**, as everywhere. */
export interface PlanTask {
  keep?: boolean;
  title: string;
  description?: string | null;
  /** What the model called it — kept even when it matched nothing. */
  discipline?: string | null;
  /** Null when the organisation has no such discipline. Never guessed. */
  disciplineId?: string | null;
  estimateHours?: number | null;
  /** The definition of done. */
  expectedOutcome?: string | null;
  possibleBlockers?: string | null;
  /**
   * Set only when somebody reassigned it in the preview. Otherwise the
   * scheduler picks (see `PlanSlot.assigneeId`).
   */
  assigneeId?: string | null;
}

export interface PlanStory {
  keep?: boolean;
  title: string;
  description?: string | null;
  /** Acceptance criteria; often several Given/When/Then lines. */
  expectedOutcome?: string | null;
  /** Fibonacci 1–13, or null when unsized. */
  points?: number | null;
  /** 1 most pressing … 4 least, as on work items. */
  priority?: number | null;
  /** Foreseeable risks to plan around — not "blocked now". */
  possibleBlockers?: string | null;
  assumed?: boolean;
  tasks: PlanTask[];
}

export interface PlanEpic {
  keep?: boolean;
  title: string;
  description?: string | null;
  assumed?: boolean;
  /** Whether its stories have had tasks generated yet. */
  brokenDown: boolean;
  stories: PlanStory[];
}

/** Where one node lands on the calendar, computed on read from the keeps. */
export interface PlanSlot {
  startsOn: string | null;
  dueOn: string | null;
  hours: number | null;
  inSprint: boolean;
  /**
   * Tasks only: who it lands with — the member of its job title free soonest,
   * or the person it was reassigned to. Null when nobody on the team holds
   * that job title.
   */
  assigneeId?: string | null;
}

/** Somebody on the project a planned task can be given to. */
export interface PlanTeamMember {
  userId: string;
  name: string;
  jobTitle: string | null;
}

/** The scheduler's reading of the current tree: dates, sprint fit, totals. */
/** One step of a plan being drafted, as the server reports it. */
export interface GenerationProgressStep {
  key: "read" | "check" | "plan" | "arrange";
  label: string;
  status: "pending" | "active" | "done" | "failed" | "attention";
  /** What it found when done ("2,140 words · 9 headings"), or why it failed. */
  detail: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** For the AI step: how long it usually takes, as an estimate. */
  expectedSeconds: number | null;
}

export interface GenerationProgress {
  status: "running" | "done" | "failed" | "attention";
  title: string;
  error: string | null;
  startedAt: string;
  updatedAt?: string;
  /** Set when done: the plan that was saved, for a browser whose connection dropped. */
  generationId?: string | null;
  steps: GenerationProgressStep[];
}

export interface BacklogPlan {
  window: {
    startsOn: string;
    endsOn: string;
    sprintId: string | null;
    sprintName: string;
    /** False when committing will create the sprint. */
    exists: boolean;
  };
  paths: Record<string, PlanSlot>;
  totals: {
    epics: number;
    stories: number;
    tasks: number;
    hours: number;
    points: number;
    storiesInSprint: number;
    hoursInSprint: number;
    capacityHours: number;
  };
  /** People per discipline key the plan uses. */
  capacity: Record<string, number>;
  /**
   * Each discipline's queue: planned hours, the people on it, and the last day
   * it has work. The latest `finishesOn` is the plan's bottleneck.
   */
  load?: Record<string, { hours: number; people: number; finishesOn: string | null }>;
  /** Everybody on the project, for reassigning a task. */
  team?: PlanTeamMember[];
}

/** One edit to a plan node. `keep:false` on a parent skips, never deletes, its subtree. */
export interface PlanChange {
  path: string;
  keep?: boolean;
  title?: string;
  estimateHours?: number | null;
  points?: number | null;
  /** Tasks only. Null hands the task back to the scheduler's choice. */
  assigneeId?: string | null;
}

/** The plan tree of a backlog generation; empty for the flat features. */
export function planEpics(generation: AiGeneration): PlanEpic[] {
  return generation.feature === "backlog" ? ((generation.items ?? []) as PlanEpic[]) : [];
}

export interface AiGeneration {
  id: string;
  projectId: string;
  feature: "stories" | "tasks" | "backlog";
  parentItemId: string | null;
  parentItem: string | null;
  sprintId: string | null;

  /** Reuses the import's states: previewing, committed, discarded, failed. */
  status: ImportStatus;
  statusLabel: string;
  isOpen: boolean;
  error: string | null;

  provider: AiProviderKey;
  model: string;

  itemCount: number;
  createdCount: number;
  keptCount: number;
  totalTokens: number;

  createdBy: string | null;
  committedAt: string | null;
  createdAt: string | null;

  /**
   * Present on a single generation; omitted from the history list. A flat
   * list for stories and tasks; the epic tree for `backlog` (see `planEpics`).
   */
  items?: AiItem[] | PlanEpic[];
  /** Backlog only: dates and sprint fit for the current keeps and edits. */
  plan?: BacklogPlan;
  /** What the model would want answered before trusting its own draft. */
  questions?: string[];
  prompt?: string;
  /** Only when the parse failed — otherwise it is a wall of JSON. */
  rawResponse?: string | null;
}

/* ------------------------------------------------------------------ */
/*  How it is going                                                     */
/* ------------------------------------------------------------------ */

/** One closed sprint, as a point on a series. */
export interface VelocityPoint {
  sprintId: string;
  sequence: number;
  name: string;
  startsOn: string;
  endsOn: string;

  committedHours: number;
  completedHours: number;
  carriedHours: number;
  addedHours: number;

  committedCount: number;
  completedCount: number;

  /**
   * What fraction of the commitment was met.
   *
   * **Null, not zero**, when nothing committed carried an estimate — a sprint
   * of unestimated work did not achieve 0%, it produced no measurement.
   */
  attainment: number | null;

  estimated: number;
  total: number;
  bounceBacks: number;
}

export interface VelocitySummary {
  sprintsMeasured: number;
  window: number;
  averageHours: number;
  lowHours: number;
  highHours: number;
  /**
   * Standard deviation over the mean — scale-free, so a team averaging 40 that
   * swings by 8 reads the same as one averaging 400 that swings by 80.
   */
  variability: number | null;
  estimateCoverage: number | null;
  /** Per project, never per person. */
  bounceBacks: number;
}

/**
 * When the project will finish — or why that cannot be said.
 *
 * `available: false` is the common case early on, and `reason` names which of
 * the four refusals it is so "we cannot tell you yet" never reads as
 * "something broke".
 */
export interface Forecast {
  available: boolean;
  reason:
    | "nothing_left"
    | "not_enough_history"
    | "nothing_estimated"
    | "no_velocity"
    | null;
  explanation?: string;

  sprintsRemaining: { optimistic: number; expected: number; pessimistic: number } | null;
  dates: { optimistic: string; expected: string; pessimistic: string } | null;

  /** The **weakest** of history, steadiness and estimate coverage. */
  confidence: "low" | "medium" | "high" | null;
  basis: {
    sprintsMeasured: number;
    averageHours: number;
    variability: number | null;
    sprintLengthDays: number;
  } | null;

  estimatedHours: number;
  estimated: number;
  total: number;
  coverage: number | null;

  /** What was promised, beside what is projected. Never conflated. */
  targetEndsOn: string | null;
  /** Only a slip is reported; finishing early is not a claim this supports. */
  slipsPastTarget: number | null;
}

/** One named finding. Never a score — see `HealthService`. */
export interface HealthSignal {
  key: string;
  label: string;
  verdict: "good" | "watch" | "bad" | "unknown";
  detail: string;
  value: number | null;
}

export interface Performance {
  velocity: {
    series: VelocityPoint[];
    /** Null below the minimum: not measured yet, which is not zero. */
    summary: VelocitySummary | null;
    minimumSprints: number;
    window: number;
  };
  forecast: Forecast;
  health: HealthSignal[];
}

/** Counts over one slice of the member's finished work. */
export interface MemberFigures {
  tasks: {
    /** Finished non-bug, non-epic items assigned to them. Partially Done is not finished. */
    completed: number;
    /** Of those, how many moved backwards at least once. */
    reopened: number;
    /** Total backward moves across those. */
    bounceBacks: number;
    /** Of those, how many had at least one bug recorded as found in them. */
    withBugsRaised: number;
    /** How many bugs were recorded against them in total. */
    bugsRaised: number;
  };
  bugs: { /** Finished bugs assigned to them. */ fixed: number };
}

/** Estimated hours on finished work, with its coverage. */
export interface MemberEstimatedHours {
  /** Sum of estimates over `estimatedItems`. Never implies the unestimated were 0. */
  estimatedDelivered: number;
  estimatedItems: number;
  finishedItems: number;
}

export interface MemberSprintFigures extends MemberFigures {
  id: string;
  name: string;
  sequence: number;
  status: SprintState;
  startsOn: string;
  endsOn: string;
  /** `logged` here is hours the person logged on days inside the sprint. */
  hours: MemberEstimatedHours & { logged: number };
}

export interface MemberPerformance extends MemberFigures {
  person: { id: string; name: string };
  project: { id: string; slug: string; name: string };
  open: {
    /** Unfinished items assigned to them now. */
    assigned: number;
    byType: Record<WorkItemType, number>;
    /** Of those, how many carry a blocked reason. */
    blocked: number;
  };
  /** `logged` is every hour they logged on this project. */
  hours: MemberEstimatedHours & { logged: number };
  /** Every sprint on the project, in sequence order. */
  sprints: MemberSprintFigures[];
  /** Work finished straight off the backlog, never in a sprint. */
  outsideSprints: MemberFigures & { hours: MemberEstimatedHours };
}

export interface MemberPerformanceMeta {
  selfOnly: true;
  /** Plain-English definition per figure, keyed like `tasks.completed`. */
  definitions: Record<string, string>;
}

export interface Burndown {
  sprintId: string;
  sequence: number;
  totalHours: number;
  /** How much of the sprint is drawable at all. */
  estimated: number;
  total: number;
  points: {
    date: string;
    idealHours: number;
    /** Null past today — a flat line would read as a forecast of failure. */
    remainingHours: number | null;
  }[];
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; perPage: number; currentPage: number; lastPage: number };
}

/* ------------------------------------------------------------------ */
/*  Calls                                                               */
/* ------------------------------------------------------------------ */

export const portfolios = {
  /** Flat, with `parentId`. The client builds whichever shape a view wants. */
  list: () => request<{ data: Portfolio[] }>("portfolios").then(unwrap),

  create: (input: { name: string; description?: string; parentId?: string | null }) =>
    request<{ data: Portfolio }>("portfolios", { method: "POST", body: input }).then(unwrap),

  update: (
    id: string,
    input: { name?: string; description?: string | null; parentId?: string | null; position?: number },
  ) =>
    request<{ data: Portfolio }>(`portfolios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }).then(unwrap),

  /** Refused while anything is on it — the API says what it holds. */
  remove: (id: string) =>
    request<unknown>(`portfolios/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const projects = {
  /**
   * The projects this person is on, and whether they may start another.
   *
   * `canCreate` comes from the server because it depends on the viewer's roles,
   * which membership cannot reveal — a client guessing would either hide the
   * button from the one person who may use it, or show it to everybody and
   * teach the rule through a 403.
   */
  list: (
    filters: {
      portfolioId?: string;
      /** The work for one client. Still narrowed by membership server-side. */
      externalCompanyId?: string;
      status?: ProjectLifecycle;
      openOnly?: boolean;
      q?: string;
    } = {},
  ) =>
    request<{ data: Project[]; meta: { canCreate: boolean; canManagePortfolios?: boolean } }>(
      `projects${query(filters)}`,
    ),

  get: (slug: string) =>
    request<{ data: Project }>(`projects/${encodeURIComponent(slug)}`).then(unwrap),

  /** The creator becomes its project manager, in the same transaction. */
  create: (input: {
    name: string;
    type?: ProjectType;
    code?: string;
    description?: string;
    startsOn?: string | null;
    targetEndsOn?: string | null;
    currency?: string;
    portfolioId?: string | null;
    externalCompanyId?: string | null;
  }) => request<{ data: Project }>("projects", { method: "POST", body: input }).then(unwrap),

  update: (slug: string, input: Record<string, unknown>) =>
    request<{ data: Project }>(`projects/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: input,
    }).then(unwrap),

  remove: (slug: string) =>
    request<unknown>(`projects/${encodeURIComponent(slug)}`, { method: "DELETE" }),

  /* ---------------------------- staffing --------------------------- */

  members: (slug: string) =>
    request<{ data: ProjectMember[] }>(`projects/${encodeURIComponent(slug)}/members`).then(unwrap),

  /**
   * Colleagues who could be added — current employees not already on it,
   * searched by name, email or job title. What the add form's picker searches.
   */
  memberCandidates: (slug: string, q = "") =>
    request<{ data: MemberCandidate[] }>(
      `projects/${encodeURIComponent(slug)}/members/candidates${q.trim() === "" ? "" : `?q=${encodeURIComponent(q.trim())}`}`,
    ).then(unwrap),

  /** Adding somebody already on it changes their role rather than failing. */
  /** `disciplineId` is their job title's id; left out, the server uses the person's own. */
  addMember: (slug: string, input: { userId: string; role: ProjectRole; seat?: ChosenSeat; disciplineId?: string | null }) =>
    request<{ data: ProjectMember }>(`projects/${encodeURIComponent(slug)}/members`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  setMemberRole: (slug: string, memberId: string, role: ProjectRole) =>
    request<{ data: ProjectMember }>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: { role } },
    ).then(unwrap),

  /**
   * Their job title on this project (null clears it). The role goes along
   * unchanged so the change is recorded against it.
   */
  setMemberJobTitle: (slug: string, memberId: string, role: ProjectRole, disciplineId: string | null) =>
    request<{ data: ProjectMember }>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: { role, disciplineId } },
    ).then(unwrap),

  /** Owner, Member or Viewer. Refused for the project's last owner — the API says so. */
  setMemberSeat: (slug: string, memberId: string, seat: ChosenSeat) =>
    request<{ data: ProjectMember }>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: { seat } },
    ).then(unwrap),

  /**
   * "Work on this project": an Oversight seat becomes a Member's, so they can
   * be given work and log time. Their own, or whoever staffs the project.
   */
  workOnProject: (slug: string, memberId: string) =>
    request<{ data: ProjectMember }>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}/work`,
      { method: "POST" },
    ).then(unwrap),

  /** Back to the Oversight seat their role gives them. */
  stopWorking: (slug: string, memberId: string) =>
    request<{ data: ProjectMember }>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}/work`,
      { method: "DELETE" },
    ).then(unwrap),

  /** Refused for the last owner — the API says so. Somebody whose role joins every project goes back to Oversight. */
  removeMember: (slug: string, memberId: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    ),
};

/**
 * The clients this institution works for, and the people at them.
 *
 * Readable by anybody in the module - an engineer needs to know whose logo is
 * on the thing they are building - and writable by whoever may start a
 * project. Read `meta.canManage` from `list`; never infer it.
 */
export const companies = {
  list: (filters: { q?: string; activeOnly?: boolean } = {}) =>
    request<{ data: ExternalCompany[]; meta: { canManage: boolean } }>(
      `companies${query(filters)}`,
    ),

  /** With its people. */
  get: (slug: string) =>
    request<{ data: ExternalCompany }>(`companies/${encodeURIComponent(slug)}`).then(unwrap),

  create: (input: { name: string; website?: string; sector?: string; notes?: string }) =>
    request<{ data: ExternalCompany }>("companies", { method: "POST", body: input }).then(unwrap),

  update: (slug: string, input: Record<string, unknown>) =>
    request<{ data: ExternalCompany }>(`companies/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: input,
    }).then(unwrap),

  /** Refused while any project is for them - the API says how many. */
  remove: (slug: string) =>
    request<unknown>(`companies/${encodeURIComponent(slug)}`, { method: "DELETE" }),

  addPerson: (
    slug: string,
    input: { name: string; jobTitle?: string; email?: string; phone?: string; notes?: string },
  ) =>
    request<{ data: ExternalPerson }>(`companies/${encodeURIComponent(slug)}/people`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  /** No delete: `{ isActive: false }` is how somebody who left is recorded. */
  updatePerson: (slug: string, personId: string, input: Record<string, unknown>) =>
    request<{ data: ExternalPerson }>(
      `companies/${encodeURIComponent(slug)}/people/${encodeURIComponent(personId)}`,
      { method: "PATCH", body: input },
    ).then(unwrap),
};

/**
 * The stakeholder map for one project.
 *
 * Read by any member; written by whoever staffs the project, because deciding
 * somebody has high influence is the project manager's judgement.
 */
export const stakeholders = {
  /** The map and its grid summary in one call. */
  list: (slug: string) =>
    request<{ data: ProjectStakeholder[]; meta: StakeholderMapMeta }>(
      `projects/${encodeURIComponent(slug)}/stakeholders`,
    ),

  /** Naming somebody already on the map changes their role rather than failing. */
  place: (
    slug: string,
    input: {
      externalStakeholderId: string;
      role?: StakeholderRole;
      influence?: StakeholderWeight;
      interest?: StakeholderWeight;
      isPrimary?: boolean;
      notes?: string;
    },
  ) =>
    request<{ data: ProjectStakeholder }>(`projects/${encodeURIComponent(slug)}/stakeholders`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  /**
   * `isPrimary: true` moves the primary contact here. There is no way to clear
   * it - a project with nobody to ring is worse than the state being left, so
   * it is moved by naming the new one.
   */
  update: (slug: string, id: string, input: Record<string, unknown>) =>
    request<{ data: ProjectStakeholder }>(
      `projects/${encodeURIComponent(slug)}/stakeholders/${encodeURIComponent(id)}`,
      { method: "PATCH", body: input },
    ).then(unwrap),

  /** Takes them off this project. The person themselves is untouched. */
  remove: (slug: string, id: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/stakeholders/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
};

export const board = {
  get: (slug: string) =>
    request<{ data: BoardSetup }>(`projects/${encodeURIComponent(slug)}/board`).then(unwrap),
};

export const workItems = {
  /**
   * All three backlogs, because they are one table:
   *   `{ backlog: true }`               the product backlog
   *   `{ sprintId }`                    that sprint's backlog
   *   `{ backlog: true, type: "bug" }`  the bug backlog
   */
  list: (
    slug: string,
    filters: {
      backlog?: boolean;
      sprintId?: string;
      type?: WorkItemType;
      statusId?: string;
      disciplineId?: string;
      assigneeId?: string;
      /** Only work under no story: tasks, bugs and spikes with no parent. */
      loose?: boolean;
      q?: string;
      page?: number;
      perPage?: number;
    } = {},
  ) =>
    request<Paginated<WorkItem>>(
      `projects/${encodeURIComponent(slug)}/items${query(filters)}`,
    ),

  /**
   * One item, by id.
   *
   * This did not exist until the schedule did, and the reason is worth
   * keeping: the board, the list and My work all come from `list` and already
   * hold the whole item, so a fetch by id would have been a second request for
   * data in hand. The critical path is the first screen that holds only ids —
   * it is derived from the graph, not from a backlog page — so opening an item
   * from it genuinely needs this.
   */
  get: (id: string) =>
    request<{ data: WorkItem }>(`items/${encodeURIComponent(id)}`).then(unwrap),

  create: (slug: string, input: Record<string, unknown>) =>
    request<{ data: WorkItem }>(`projects/${encodeURIComponent(slug)}/items`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  update: (id: string, input: Record<string, unknown>) =>
    request<{ data: WorkItem }>(`items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }).then(unwrap),

  /**
   * A drag on a board.
   *
   * Separate from `update` because it carries a different permission — the
   * assignee may move their own item — and because it does bookkeeping of its
   * own: the completion stamp, and the bounce-back counter when the move is
   * backwards.
   *
   * `sprintId: null` sends it back to the product backlog; omitting the key
   * leaves it where it is. Those are different instructions.
   */
  move: (
    id: string,
    input: { statusId?: string; position?: number; sprintId?: string | null },
  ) =>
    request<{ data: WorkItem }>(`items/${encodeURIComponent(id)}/move`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  /**
   * Tick a task done, or untick it.
   *
   * Not a `move` with a guessed column: the server resolves "done" to the
   * project's completion column and "not done" to its default one, and goes
   * through the same bookkeeping a drag does (completion stamp, bounce-backs).
   * Needs `can.move`. A story or an epic is refused with 422 on `done` — a
   * story moves on the board; its tasks are what get ticked.
   */
  complete: (id: string, done: boolean) =>
    request<{ data: WorkItem }>(`items/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      body: { done },
    }).then(unwrap),

  remove: (id: string) =>
    request<unknown>(`items/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /**
   * Estimate many items at once.
   *
   * The path somebody actually takes with a hundred unestimated tasks. Send
   * `hours: null` to *remove* an estimate — a zero would be a wrong number
   * rather than an absent one, and is treated as null for the same reason.
   *
   * All or nothing: one unknown id writes none of them, because a bulk edit
   * that applied to sixty of a hundred rows leaves nobody able to say which.
   */
  estimate: (
    slug: string,
    estimates: { id: string; hours: number | null; points?: number | null }[],
  ) =>
    request<{ meta: { changed: number; estimated: number; total: number } }>(
      `projects/${encodeURIComponent(slug)}/items/estimates`,
      { method: "POST", body: { estimates } },
    ),
};

/**
 * A user story as the board draws it: the story itself, plus what is inside.
 *
 * `progress` counts every child (tasks, bugs, spikes) — done over all — and
 * `assignees` is everybody working inside it, then the story's own owner.
 * `tasks` is the full children list, ordered as the team ordered it, each
 * with its own `can` so the drawer can tell who may tick what.
 */
export type StoryRow = WorkItem & {
  epic: { id: string; title: string } | null;
  progress: { total: number; done: number; percent: number };
  assignees: { id: string; name: string | null }[];
  bugCount: number;
  /** The sum of the tasks' story points (D22); null when none is pointed. */
  taskPoints?: number | null;
  tasks: WorkItem[];
};

/** A page of stories, plus the loose work in the same scope. */
export interface StoriesPage extends Paginated<StoryRow> {
  meta: Paginated<StoryRow>["meta"] & {
    /** Tasks, bugs and spikes under no story, in the same sprint or backlog. */
    loose?: WorkItem[];
  };
}

export const stories = {
  /**
   * The stories of one sprint (`{ sprintId }`) or of the product backlog
   * (`{ backlog: true }`), each with its tasks and progress, and the loose
   * work beside them in `meta.loose`.
   */
  list: (
    slug: string,
    filters: { sprintId?: string; backlog?: boolean; q?: string; page?: number; perPage?: number } = {},
  ) =>
    request<StoriesPage>(`projects/${encodeURIComponent(slug)}/stories${query(filters)}`),
};

/**
 * A backlog out of a spreadsheet, in four steps.
 *
 *   `upload`  read the file and get back what it would do — creates nothing
 *   `remap`   correct a column and have every row judged again
 *   `commit`  create the work items
 *   `discard` throw the preview away
 *
 * The middle two are the point. A one-shot import would put a hundred wrong
 * items on a board, and somebody would delete them one at a time.
 */
export const imports = {
  /**
   * Download the backlog template (.xlsx): a `Backlog` tab whose headers the
   * importer maps without correction, plus a `Members` tab listing everybody
   * on the project (User ID, Name, Email, Project role, Discipline). The
   * Assignee column takes a User ID from that tab, or a name.
   *
   * Needs `manageBoard` on the project (403 otherwise). Resolves to the file
   * and the filename the API suggested; hand both to an `<a download>`.
   *
   * **Requires the same-origin proxy to pass binary through** — the generic
   * GET branch of `app/api/projects/[...path]/route.ts` decodes as text and
   * would corrupt the file. The check below turns that into a clear error.
   */
  template: async (slug: string): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch(
      `/api/projects/projects/${encodeURIComponent(slug)}/imports/template`,
      { cache: "no-store" },
    );

    const type = res.headers.get("content-type") ?? "";

    if (!res.ok || !type.includes("spreadsheetml")) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(
        json?.message ?? "The template could not be downloaded.",
        res.ok ? 502 : res.status,
        json?.errors,
      );
    }

    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);

    return {
      blob: await res.blob(),
      filename: match?.[1] ?? `${slug}-backlog-template.xlsx`,
    };
  },

  /** Past imports, without their rows, plus the fields a column can map to. */
  list: (slug: string) =>
    request<{ data: BacklogImport[]; meta: { fields: { value: ImportField; label: string }[] } }>(
      `projects/${encodeURIComponent(slug)}/imports`,
    ),

  get: (slug: string, id: string) =>
    request<{ data: BacklogImport; meta: { fields: { value: ImportField; label: string }[] } }>(
      `projects/${encodeURIComponent(slug)}/imports/${encodeURIComponent(id)}`,
    ),

  /**
   * Upload a sheet. Nothing is created.
   *
   * Sent as `FormData`, so **no `Content-Type` is set** — the browser writes it
   * with the multipart boundary, and setting it by hand is the classic way to
   * make the file unreadable at the other end.
   *
   * A 422 here still carries a `data` with `status: "failed"` and an `error`
   * saying what was wrong with the file, which is worth showing rather than a
   * generic failure.
   */
  upload: async (
    slug: string,
    file: File,
    options: { sheet?: string; sprintId?: string } = {},
  ) => {
    const form = new FormData();
    form.append("file", file);

    if (options.sheet !== undefined) form.append("sheet", options.sheet);
    if (options.sprintId !== undefined) form.append("sprintId", options.sprintId);

    const res = await fetch(`/api/projects/projects/${encodeURIComponent(slug)}/imports`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      /* The recorded reason, when there is one, beats a generic message. */
      const reason = (json as { data?: { error?: string | null } })?.data?.error;

      throw new ApiError(
        reason ?? (json as { message?: string })?.message ?? "That file could not be read.",
        res.status,
        (json as { errors?: Record<string, string[]> })?.errors,
      );
    }

    return json as { data: BacklogImport; meta: { fields: { value: ImportField; label: string }[] } };
  },

  /**
   * Change one column, or the target sprint, and re-judge every row.
   *
   * Partial: send only what changed. The mapping is merged over what is there,
   * so a form that moves one dropdown does not wipe the other nine columns.
   */
  remap: (
    slug: string,
    id: string,
    input: { mapping?: Record<string, ImportField>; sprintId?: string | null },
  ) =>
    request<{ data: BacklogImport; meta: { fields: { value: ImportField; label: string }[] } }>(
      `projects/${encodeURIComponent(slug)}/imports/${encodeURIComponent(id)}`,
      { method: "PATCH", body: input },
    ),

  /** Create the work items. One transaction; cannot be run twice. */
  commit: (slug: string, id: string) =>
    request<{ data: BacklogImport }>(
      `projects/${encodeURIComponent(slug)}/imports/${encodeURIComponent(id)}/commit`,
      { method: "POST", body: {} },
    ).then(unwrap),

  /** Marked discarded, not deleted — the record answers "did that run?". */
  discard: (slug: string, id: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/imports/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
};

/**
 * The rate card, and one project's overrides of it.
 *
 * Reading a rate needs the same authority as reading a cost — it says what each
 * colleague is charged out at. Read `project.can.viewCost`; never infer it.
 */
export const rates = {
  /** The organisation's card. Seeded with $20 per job title on first read. */
  card: () =>
    request<{
      data: ProjectRate[];
      meta: {
        /** The organisation's job titles, under their old name. */
        disciplines: { id: string; key: string; label: string }[];
        jobTitles?: { id: string; key: string; label: string; name?: string }[];
        defaultMinor: number;
        defaultCurrency: string;
      };
    }>("rates"),

  set: (input: {
    rateMinor: number;
    currency: string;
    disciplineId?: string | null;
    userId?: string | null;
    note?: string;
  }) => request<{ data: ProjectRate }>("rates", { method: "POST", body: input }).then(unwrap),

  /** The row goes and the chain falls through to whatever is underneath. */
  remove: (id: string) =>
    request<unknown>(`rates/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /**
   * One project's overrides, the card underneath, and what each discipline
   * actually resolves to.
   *
   * All three, because most disciplines will have no override and a screen
   * showing only overrides reads as though nothing were set.
   */
  forProject: (slug: string) =>
    request<{
      data: ProjectRate[];
      meta: {
        card: ProjectRate[];
        effective: EffectiveRate[];
        canManage: boolean;
        projectCurrency: string;
        members: { userId: string; name: string | null; disciplineId: string | null }[];
      };
    }>(`projects/${encodeURIComponent(slug)}/rates`),

  setForProject: (
    slug: string,
    input: {
      rateMinor: number;
      currency: string;
      disciplineId?: string | null;
      userId?: string | null;
      note?: string;
    },
  ) =>
    request<{ data: ProjectRate }>(`projects/${encodeURIComponent(slug)}/rates`, {
      method: "POST",
      body: input,
    }).then(unwrap),
};

/**
 * Said, never enforced (X1): time logged on a day the person was on approved
 * leave, or on a public holiday, is saved — and comes back with one of these.
 */
export interface TimeLogWarning {
  code: "on_leave" | "public_holiday";
  message: string;
}

/** A saved time log and anything worth a second look about its day. */
export interface SavedTimeLog {
  log: TimeLog;
  warnings: TimeLogWarning[];
}

/** What repricing zero-cost hours would do, or did (D21). */
export interface RepriceResult {
  /** Logs priced (or that would be). */
  logs: number;
  hours: number;
  costMinor: number;
  currency: string;
  /** Still no rate (or no exchange rate) for these; left at zero. */
  unpriceable: number;
  unpriceableHours: number;
  applied: boolean;
}

function saved(res: { data: TimeLog; meta?: { warnings?: TimeLogWarning[] } }): SavedTimeLog {
  return { log: res.data, warnings: res?.meta?.warnings ?? [] };
}

/**
 * The hours actually worked.
 *
 * Anybody on the project logs their own; logging somebody else's is a separate
 * permission and seeing the money is a third. `meta.canSeeCost` is the server's
 * answer to the last.
 */
export const time = {
  list: (
    slug: string,
    filters: {
      userId?: string;
      workItemId?: string;
      sprintId?: string;
      mine?: boolean;
      billableOnly?: boolean;
      from?: string;
      to?: string;
    } = {},
  ) =>
    request<{
      data: TimeLog[];
      meta: {
        canSeeCost: boolean;
        canLogForOthers: boolean;
        hours: number;
        billableHours: number;
        /** Null to somebody who may not see money. */
        costMinor: number | null;
        currency: string;
        unratedHours: number | null;
      };
    }>(`projects/${encodeURIComponent(slug)}/time${query(filters)}`),

  /**
   * Log an hour.
   *
   * `hours` or `minutes` — minutes are what is stored, and sending hours lets a
   * form ask the question the way a person thinks about it.
   */
  log: (
    slug: string,
    input: {
      hours?: number;
      minutes?: number;
      workedOn?: string;
      workItemId?: string | null;
      userId?: string | null;
      isBillable?: boolean;
      note?: string;
    },
  ) =>
    request<{ data: TimeLog; meta?: { warnings?: TimeLogWarning[] } }>(`projects/${encodeURIComponent(slug)}/time`, {
      method: "POST",
      body: input,
    }).then(saved),

  /**
   * Re-priced at the rate that applied then, never today's. Warnings come
   * back only when the date moved.
   */
  update: (slug: string, id: string, input: Record<string, unknown>) =>
    request<{ data: TimeLog; meta?: { warnings?: TimeLogWarning[] } }>(
      `projects/${encodeURIComponent(slug)}/time/${encodeURIComponent(id)}`,
      { method: "PATCH", body: input },
    ).then(saved),

  /**
   * Hours costed at zero because no rate existed when they were logged (D21).
   * `GET` previews what repricing at today's rates would do; `POST` does it,
   * audited. Both need `can.manageRates`.
   */
  repricePreview: (slug: string) =>
    request<{ data: RepriceResult }>(`projects/${encodeURIComponent(slug)}/time-reprice`).then(unwrap),

  reprice: (slug: string) =>
    request<{ data: RepriceResult }>(`projects/${encodeURIComponent(slug)}/time-reprice`, {
      method: "POST",
    }).then(unwrap),

  remove: (slug: string, id: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/time/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
};

/**
 * What a project has cost.
 *
 * `in` converts every figure and labels each with the rate and date that
 * produced it. `meta.convertibleTo` lists the currencies a rate exists for, so
 * a dropdown never leads to a dead end.
 */
export const cost = {
  forProject: (slug: string, options: { in?: string } = {}) =>
    request<{
      data: ProjectCost;
      meta: {
        byPerson: {
          userId: string;
          name: string | null;
          hours: number;
          billableHours: number;
          costMinor: number;
        }[];
        byDiscipline: {
          disciplineId: string | null;
          label: string;
          hours: number;
          costMinor: number;
        }[];
        canManageRates: boolean;
        convertibleTo: string[];
      };
    }>(`projects/${encodeURIComponent(slug)}/cost${query(options)}`),

  forSprint: (id: string, options: { in?: string } = {}) =>
    request<{
      data: {
        currency: string;
        spent: MoneyFigure;
        hours: number;
        unratedHours: number;
        people: number;
      };
    }>(`sprints/${encodeURIComponent(id)}/cost${query(options)}`).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Project financials: expected expense against actual (9 Oct 2026)   */
/* ------------------------------------------------------------------ */

/** RAG from Finance's portfolio. `stale` overrides the rest; `grey` = no budget. */
export type FinanceRag = "green" | "amber" | "red" | "grey" | "stale";

export interface FinanceCategoryRow {
  key: string;
  label: string;
  expected: number;
  expectedToDate: number;
  actual: number;
  committed: number;
  remaining: number;
  variance: number;
  /** (actual + committed) / expected, in basis points; null with no expected figure. */
  usedBp: number | null;
  /** actual / expected-to-date, in basis points. */
  toDateBp: number | null;
  /** Labour only: the same hours priced from payroll, shown beside — never added. */
  payroll: number | null;
}

export interface FinanceMonth {
  /** `YYYY-MM`. */
  month: string;
  expected: number;
  actual: number;
  labour: number;
  cumulativeExpected: number;
  cumulativeActual: number;
}

export interface FinanceMemberRow {
  userId: string;
  name: string;
  role: string;
  jobTitle: string | null;
  hours: number;
  billableHours: number;
  /** The rate that applies now, in `rateCurrency` minor units; null when none is set. */
  rate: number | null;
  rateCurrency: string;
  rateSource: string;
  /** Logged hours at the rate card, in the sheet's currency; null when it could not be converted. */
  rateCard: number | null;
  payroll: number | null;
  payrollHours: number | null;
}

export interface FinanceSprintRow {
  name: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  hours: number;
  people: number;
  unratedHours: number;
  cost: number | null;
}

export interface SpendRequestRow {
  register: string;
  registerLabel: string;
  id: string;
  reference: string | null;
  title: string | null;
  raisedOn: string | null;
  status: string;
  statusLabel: string;
  requesterId: string | null;
  requester: string | null;
  department: string | null;
  projectId: string | null;
  project: string | null;
  costCentre: string | null;
  category: string | null;
  currency: string | null;
  estimated: number | null;
  approved: number | null;
  actual: number | null;
  live: boolean;
  /** The parent request this one belongs to (`EVT-…`); counted there, not here. */
  partOf: string | null;
  inTotals: boolean;
  note: string | null;
}

export interface SpendRequester {
  name: string;
  department: string | null;
  requests: number;
  live: number;
  byRegister: Record<string, number>;
  estimated: number;
  approved: number;
  actual: number;
}

export interface FinanceKpis {
  pctBp?: number | null;
  pv?: number | null;
  ev?: number | null;
  ac?: number | null;
  cpi?: number | null;
  spi?: number | null;
  eac?: number | null;
  bac?: number | null;
  [key: string]: unknown;
}

export interface ProjectFinancials {
  /** Every amount below is integer minor units of this currency. */
  currency: string;
  projectCurrency: string;
  hasFinance: boolean;
  /** Labour could not be converted from `projectCurrency` to `currency`. */
  conversionUnavailable: boolean;
  budget: {
    version: number;
    approvedAt: string | null;
    contractValue: number;
    bac: number;
    targetMarginBp: number | null;
    rebaselineReason: string | null;
    /** Category × month ("YYYY-MM"), minor units. */
    lines: { category: string; month: string; amount: number }[];
  } | null;
  pendingBudget: { version: number; status: string; bac: number } | null;
  categories: FinanceCategoryRow[];
  totals: {
    expected: number;
    expectedToDate: number;
    committed: number;
    actual: number;
    remaining: number;
    usedBp: number | null;
    forecastAtCompletion: number;
    varianceAtCompletion: number | null;
  };
  labour: {
    hours: number;
    billableHours: number;
    unratedHours: number;
    rateCard: number | null;
    rateCardProjectCurrency: number;
    payroll: number | null;
    payrollProvisional: number | null;
    toComplete: number | null;
    toCompleteHours: number;
    /** 0..1 — the share of the remaining work that carries an estimate. */
    estimateCoverage: number | null;
    members: FinanceMemberRow[];
    sprints: FinanceSprintRow[];
    jobTitles: { label: string; hours: number; cost: number | null }[];
    months: Record<string, number | null>;
  };
  reconciliation: {
    booksNonLabour: number | null;
    vouchersNonLabour: number | null;
    difference: number | null;
    booksLabour: number | null;
  };
  months: FinanceMonth[];
  position: Record<string, number | null> | null;
  kpis: FinanceKpis | null;
  status: FinanceRag | null;
  reasons: { dimension: string; status: FinanceRag; reason: string }[];
  revenue: {
    contractValue: number;
    invoiced: number;
    collected: number;
    receivable: number;
    overdue: number;
    marginToDate: number | null;
    marginAtCompletion: number | null;
    contract: unknown;
    invoices: {
      id?: string;
      invoiceNo: string | null;
      date: string | null;
      dueOn: string | null;
      total: number;
      settled: number;
      outstanding: number;
      status: string;
      currency?: string | null;
      daysLate: number;
    }[];
  } | null;
  releases: {
    id?: string;
    tranche: number;
    amount: number;
    revoked: number | null;
    scope: string | null;
    status: string;
    requestedBy: string | null;
    conditions: string | null;
  }[];
  commitments: {
    id?: string;
    reference: string | null;
    title: string | null;
    category: string | null;
    amount: number;
    consumed: number;
    outstanding: number;
    expiresAt: string | null;
    ageing: boolean;
  }[];
  alerts: {
    id: string;
    dimension: string;
    severity: string;
    message: string;
    raisedAt: string | null;
    acknowledgedBy: string | null;
    acknowledgedAt: string | null;
  }[];
  /** The 50 newest ledger lines; `ledgerCount` is how many there are in all. */
  ledger: {
    journalNo: string;
    date: string;
    source?: string | null;
    account: string;
    accountType?: string | null;
    narration: string | null;
    person: string | null;
    debit: number;
    credit: number;
  }[];
  ledgerCount: number;
  registers: Record<string, { label: string; count: number; estimated: number; approved: number; actual: number }>;
  requests: SpendRequestRow[];
  requesters: SpendRequester[];
}

export interface ProjectBudgetDraft {
  /** Minor units. */
  contractValue: number;
  targetMarginBp?: number | null;
  /** Required by Finance when an approved budget is being replaced. */
  reason?: string | null;
  /** Send for approval as well as saving. */
  submit?: boolean;
  lines: { category: string; month: string; amount: number }[];
}

/**
 * Expected expense (Finance's approved budget) against actual, for cost
 * viewers (`can.viewCost`). `meta.canDraftBudget` is false without a Finance
 * licence, when there is no budget to set.
 */
export const financials = {
  forProject: (slug: string) =>
    request<{
      data: ProjectFinancials;
      meta: { categories: Record<string, string>; canDraftBudget: boolean };
    }>(`projects/${encodeURIComponent(slug)}/financials`),

  /**
   * Drafts a new budget version in Finance and, with `submit`, sends it for
   * approval. `notice` says why a submitted draft was kept as a draft.
   */
  draftBudget: (slug: string, body: ProjectBudgetDraft) =>
    request<{ data: { id: string; version: number; status: string; bac: number; notice: string | null } }>(
      `projects/${encodeURIComponent(slug)}/budget`,
      { method: "POST", body },
    ).then(unwrap),
};

/**
 * The institution's own exchange rates.
 *
 * **Entered, never guessed and never fetched.** The rate an agency invoices at
 * is the one their bank gave them, not a mid-market feed — and a wrong rate
 * does not fail, it produces a plausible number somebody quotes to a client.
 */
export const fx = {
  list: () => request<{ data: ExchangeRateRow[]; meta: { note: string } }>("exchange-rates"),

  set: (input: { base: string; quote: string; rateBp: number; asOf?: string }) =>
    request<{ data: ExchangeRateRow }>("exchange-rates", {
      method: "POST",
      body: input,
    }).then(unwrap),
};

/**
 * The institution's model providers, and what they have spent.
 *
 * **Their key, our software spending it.** Generation runs on the
 * institution's own provider account; there is no shared key and nothing is
 * billed to Elevate. The obligation that comes with that is telling them what
 * we spent it on, which is what `usage` is for.
 */
export const ai = {
  providers: () =>
    request<{
      data: AiProviderSettings[];
      meta: { note: string; usage: AiUsageSummary };
    }>("ai/providers"),

  /**
   * Save a key, a model, a budget — or all three.
   *
   * Send the mask back for a key nobody edited; it means "leave it alone".
   * Sending an empty string means the same.
   */
  saveProvider: (input: {
    provider: AiProviderKey;
    apiKey?: string;
    model?: string;
    isDefault?: boolean;
    monthlyTokenBudget?: number | null;
  }) =>
    request<{ data: AiProviderSettings[]; meta: { note: string; usage: AiUsageSummary } }>(
      "ai/providers",
      { method: "POST", body: input },
    ),

  /** Makes the cheapest possible real call — the only way to be sure. */
  verify: (id: string) =>
    request<{ data: { verified: boolean; verifiedAt: string | null; error: string | null } }>(
      `ai/providers/${encodeURIComponent(id)}/verify`,
      { method: "POST", body: {} },
    ).then(unwrap),

  removeProvider: (id: string) =>
    request<{ data: AiProviderSettings[]; meta: { note: string; usage: AiUsageSummary } }>(
      `ai/providers/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),

  /** Rows, not just a total: "on what" and "by whom" are the real questions. */
  usage: () => request<{ data: AiUsageRow[]; meta: AiUsageSummary }>("ai/usage"),
};

/**
 * Generating a backlog.
 *
 * Four steps, like the import: ask, read, untick what is wrong, commit. A
 * language model is a **less** reliable source than a spreadsheet — it invents
 * plausible work and is equally confident either way — so nothing it writes
 * reaches the board unread.
 */
export const generate = {
  history: (slug: string) =>
    request<{
      data: AiGeneration[];
      meta: {
        canGenerate: boolean;
        provider: { provider: AiProviderKey; model: string } | null;
        /**
         * People in delivery roles (member, QA, security). Nothing can be
         * generated while it is zero: there is nobody to give tasks to.
         */
        team?: { delivery: number };
      };
    }>(`projects/${encodeURIComponent(slug)}/ai`),

  get: (slug: string, id: string) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}`,
    ).then(unwrap),

  /** Requirements in, user stories out. Nothing is created. */
  stories: (slug: string, requirements: string) =>
    request<{ data: AiGeneration }>(`projects/${encodeURIComponent(slug)}/ai/stories`, {
      method: "POST",
      body: { requirements },
    }).then(unwrap),

  /**
   * Requirements in, a delivery plan out: epics and stories now, tasks per
   * epic afterwards (`breakdown`), because one call for the whole tree
   * outruns the provider's time limit. Nothing is created.
   */
  backlog: (
    slug: string,
    requirements: string,
    file?: File | null,
    track?: {
      /** A UUID the caller made; `progress` reads what the server is doing under it. */
      progressKey?: string;
      /** How much of the file has been sent, 0 to 1. */
      onUpload?: (fraction: number) => void;
    },
  ) => {
    const path = `projects/${encodeURIComponent(slug)}/ai/backlog`;

    if (file) {
      /*
        A PRD, a story sheet or a project sheet. Typed text alongside it is
        sent as the person's notes about the document.
      */
      const form = new FormData();
      form.append("file", file);
      if (requirements.trim() !== "") form.append("requirements", requirements);
      if (track?.progressKey) form.append("progressKey", track.progressKey);

      return (track?.onUpload
        ? uploadWithProgress<{ data: AiGeneration }>(path, form, track.onUpload)
        : upload<{ data: AiGeneration }>(path, form)
      ).then(unwrap);
    }

    return request<{ data: AiGeneration }>(path, {
      method: "POST",
      body: { requirements, ...(track?.progressKey ? { progressKey: track.progressKey } : {}) },
    }).then(unwrap);
  },

  /**
   * What a plan being drafted under `key` is doing right now, or null when
   * the server has nothing for it (not started yet, expired, not yours).
   */
  progress: (slug: string, key: string) =>
    request<{ data: GenerationProgress }>(`projects/${encodeURIComponent(slug)}/ai/progress/${encodeURIComponent(key)}`)
      .then(unwrap)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),

  /** Tasks for one epic's stories. Idempotent: running it again replaces them. */
  breakdown: (slug: string, id: string, epicIndex: number) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}/epics/${epicIndex}/breakdown`,
      { method: "POST", body: {} },
    ).then(unwrap),

  /** Edit plan nodes by path. The answer carries a re-computed `plan`. */
  reviseTree: (slug: string, id: string, changes: PlanChange[]) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}`,
      { method: "PATCH", body: { changes } },
    ).then(unwrap),

  /**
   * One story in, tasks across the disciplines out.
   *
   * The half that earns its keep: the QA task is the one always missing from a
   * hand-written backlog.
   */
  tasks: (slug: string, itemId: string, input: { context?: string; sprintId?: string } = {}) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/items/${encodeURIComponent(itemId)}/tasks`,
      { method: "POST", body: input },
    ).then(unwrap),

  /**
   * Untick what is wrong, or fix a title before it lands.
   *
   * Editing here rather than on the board, because fixing a title afterwards
   * means finding it again among eleven others.
   */
  revise: (
    slug: string,
    id: string,
    input: {
      items: {
        index: number;
        keep?: boolean;
        title?: string;
        description?: string | null;
        estimateHours?: number | null;
      }[];
      sprintId?: string | null;
    },
  ) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}`,
      { method: "PATCH", body: input },
    ).then(unwrap),

  commit: (slug: string, id: string) =>
    request<{ data: AiGeneration }>(
      `projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}/commit`,
      { method: "POST", body: {} },
    ).then(unwrap),

  discard: (slug: string, id: string) =>
    request<unknown>(`projects/${encodeURIComponent(slug)}/ai/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

/**
 * Velocity, forecast and health.
 *
 * All derived on read from the frozen sprint snapshots — nothing is stored,
 * because a velocity written to a column outlives the evidence that produced
 * it and goes on looking authoritative while being wrong.
 */
export const performance = {
  forProject: (slug: string) =>
    request<{ data: Performance; meta: { canSeeCost: boolean; currency: string } }>(
      `projects/${encodeURIComponent(slug)}/performance`,
    ),

  /**
   * The signed-in person's own figures on this project. Always the caller's:
   * there is no parameter for anybody else, by design (PROJECTS_MODULE § 3.7,
   * amended 24 Sep 2026). Counts, never a score — render them as counts with
   * their denominators, not as percentages or a rating.
   */
  mine: (slug: string) =>
    request<{ data: MemberPerformance; meta: MemberPerformanceMeta }>(
      `projects/${encodeURIComponent(slug)}/performance/me`,
    ),

  /** One sprint's curve. Its own call: the project screen rarely wants it. */
  burndown: (sprintId: string) =>
    request<{ data: Burndown }>(`sprints/${encodeURIComponent(sprintId)}/burndown`).then(unwrap),

  /**
   * The project's performance workbook (.xlsx): Summary, Sprints, Members,
   * Bugs and Stories sheets with native Excel charts. Per-member figures are
   * allowed here and only here — it is a manager's export, gated on
   * `manageBoard` (403 otherwise).
   *
   * Same shape and same proxy requirement as `imports.template`: the proxy
   * must pass the bytes through, and a non-spreadsheet answer is an error.
   */
  export: async (slug: string): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch(
      `/api/projects/projects/${encodeURIComponent(slug)}/performance/export`,
      { cache: "no-store" },
    );

    const type = res.headers.get("content-type") ?? "";

    if (!res.ok || !type.includes("spreadsheetml")) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(
        json?.message ?? "The performance workbook could not be downloaded.",
        res.ok ? 502 : res.status,
        json?.errors,
      );
    }

    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);

    return {
      blob: await res.blob(),
      filename: match?.[1] ?? `${slug}-performance.xlsx`,
    };
  },
};

/* ------------------------------------------------------------------ */
/*  Project assistant                                                  */
/* ------------------------------------------------------------------ */

export type AssistantMessage = { role: "user" | "assistant"; content: string };

export interface AssistantReply {
  answer: string;
  /** Work items the answer leans on; open them with the item panel. */
  references: { id: string; title: string; type: WorkItemType }[];
  provider: AiProviderKey | string;
  model: string;
  tokens: number | null;
}

/**
 * Ask about one project, answered from its live data.
 *
 * Stateless on the server: the conversation lives in the browser and the last
 * 1–20 turns go with every question (the last must be the user's). Nothing is
 * written except the usage row. No provider configured → 422 with
 * `errors.provider`.
 */
export const assistant = {
  ask: (slug: string, messages: AssistantMessage[]) =>
    request<{ data: AssistantReply }>(`projects/${encodeURIComponent(slug)}/assistant`, {
      method: "POST",
      body: { messages },
    }).then(unwrap),
};

export const sprints = {
  list: (slug: string) =>
    request<{ data: Sprint[] }>(`projects/${encodeURIComponent(slug)}/sprints`).then(unwrap),

  /** With the report, computed from the frozen snapshots. */
  get: (id: string) =>
    request<{ data: Sprint; meta: { report: SprintReport } }>(
      `sprints/${encodeURIComponent(id)}`,
    ),

  /** Dates optional: 14 days from the day after the last sprint ended. */
  create: (
    slug: string,
    input: { name?: string; goal?: string; startsOn?: string; endsOn?: string } = {},
  ) =>
    request<{ data: Sprint }>(`projects/${encodeURIComponent(slug)}/sprints`, {
      method: "POST",
      body: input,
    }).then(unwrap),

  update: (id: string, input: Record<string, unknown>) =>
    request<{ data: Sprint }>(`sprints/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }).then(unwrap),

  /** Freezes what was committed. Cannot be undone or repeated. */
  start: (id: string) =>
    request<{ data: Sprint }>(`sprints/${encodeURIComponent(id)}/start`, {
      method: "POST",
      body: {},
    }).then(unwrap),

  /**
   * Freezes what was finished, and carries the rest.
   *
   * Without `carryToSprintId` the unfinished work returns to the product
   * backlog, which is the honest default — where it goes next is a planning
   * decision, not a side effect of closing.
   */
  close: (id: string, carryToSprintId?: string) =>
    request<{ data: Sprint }>(`sprints/${encodeURIComponent(id)}/close`, {
      method: "POST",
      body: { carryToSprintId },
    }).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Dependencies and the schedule                                       */
/* ------------------------------------------------------------------ */

/** One item's place in the schedule. Offsets in days, not dates. */
export interface ScheduleItem {
  id: string;
  title: string;
  externalRef: string | null;
  durationDays: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  /** How long this can slip before the project's end date moves. */
  slackDays: number;
  isCritical: boolean;
  /** False means zero duration — a hole in the path, and the screen says so. */
  isEstimated: boolean;
  isComplete: boolean;
  /** Drawn as a marker rather than a bar. */
  isMilestone: boolean;
  dependsOn: string[];
  /**
   * The same two offsets as dates, resolved server-side.
   *
   * Not re-derived here: the finish offset is an *exclusive* boundary, so
   * `endsOn` is the last day work occupies rather than the day after it. A
   * client doing that arithmetic is a client drawing every bar a day too long.
   * Null past the calendar's horizon, never a guess.
   */
  startsOn: string | null;
  endsOn: string | null;
  latestStartsOn: string | null;
  latestEndsOn: string | null;
}

export interface ScheduleSummary {
  durationDays: number;
  itemCount: number;
  criticalCount: number;
  dependencyCount: number;
  /** The caveat that keeps the path honest. */
  unestimated: number;
  coverage: number | null;
  hoursPerDay: number;
  startsOn: string | null;
  endsOn: string | null;
  /** What somebody promised, for comparison — never scored against. */
  targetEndsOn: string | null;
}

/**
 * How the dates were arrived at, and what was not allowed for.
 *
 * `weekends_only` has two causes with two entirely different remedies — HRM
 * is not part of the subscription, or it is and nobody has entered this
 * year's holidays — so `reason` carries the sentence rather than the screen
 * guessing which applies.
 */
export interface ScheduleCalendar {
  basis: "weekends_and_holidays" | "weekends_only";
  reason: string | null;
  /** False means the dates hang off today rather than a real start date. */
  anchored: boolean;
  anchor: string;
  holidays: { name: string; date: string; location: string | null }[];
  /** Days off somewhere but not everywhere; these moved nothing. */
  localHolidays: { name: string; date: string; location: string | null }[];
}

/**
 * A schedule, or a named reason there isn't one.
 *
 * `schedulable: false` is a statement, not a failure — `nothing_to_schedule`
 * and `cycle` are different situations with different remedies, and a screen
 * that rendered both as an empty panel would leave a team looking for a bug
 * that isn't there.
 */
export interface Schedule {
  schedulable: boolean;
  reason: "nothing_to_schedule" | "cycle" | null;
  explanation: string | null;
  /** Populated only when `reason` is `cycle`: the actual items in the loop. */
  cycle: { id: string; title: string; externalRef: string | null }[];
  items: ScheduleItem[];
  criticalPath: string[];
  summary: ScheduleSummary | null;
  calendar: ScheduleCalendar | null;
}

export interface Dependency {
  id: string;
  itemId: string | null;
  title: string | null;
  externalRef: string | null;
  /** Negative is a lead: the successor may overlap the predecessor's tail. */
  lagDays: number;
  type: DependencyTypeKey;
  typeLabel: string;
  /** The sentence, worded once on the server so three screens agree. */
  describes: string;
  note: string | null;
}

/** The four relations. Finish-to-start is the default and the common one. */
export type DependencyTypeKey =
  | "finish_to_start"
  | "start_to_start"
  | "finish_to_finish"
  | "start_to_finish";

export interface DependencyTypeOption {
  value: DependencyTypeKey;
  label: string;
  /** How it reads with no lag, as the picker's hint. */
  describes: string;
}

/**
 * One day of a project, in four layers that each say where they came from.
 *
 * A due date is a commitment somebody typed in; `starting`/`finishing` are
 * *derived* from estimates and move when those do. Flattening them into
 * "things on the 14th" would lose the only interesting thing about them.
 */
export interface CalendarDay {
  date: string;
  isWeekend: boolean;
  holiday: {
    name: string;
    date: string;
    location: string | null;
    /** False means it closes one office — it moved no dates. */
    closesEverywhere: boolean;
  } | null;
  due: {
    id: string;
    dueOn: string;
    title: string;
    externalRef: string | null;
    type: WorkItemType;
    isComplete: boolean;
    scheduledEndsOn: string | null;
    /** The commitment and the derivation disagree. A comparison, not a verdict. */
    lateAgainstPlan: boolean;
  }[];
  starting: CalendarMark[];
  finishing: CalendarMark[];
  sprintStarts: CalendarSprintMark[];
  sprintEnds: CalendarSprintMark[];
}

export interface CalendarMark {
  id: string;
  title: string;
  externalRef: string | null;
  isCritical: boolean;
  isEstimated: boolean;
}

export interface CalendarSprintMark {
  id: string;
  name: string;
  sequence: number;
  status: SprintState;
}

export interface ProjectMonth {
  year: number;
  month: number;
  from: string;
  to: string;
  days: CalendarDay[];
  meta: {
    /** False means the derived layer is missing, and why. */
    scheduled: boolean;
    scheduleReason: "nothing_to_schedule" | "cycle" | null;
    calendar: ScheduleCalendar | null;
    counts: { due: number; holidays: number };
  };
}

export const schedule = {
  /**
   * Derived on read, never stored.
   *
   * A stored start date outlives the estimate that produced it, and a plan
   * nobody can reconcile with the board is worse than no plan.
   */
  forProject: (slug: string) =>
    request<{ data: Schedule }>(`projects/${encodeURIComponent(slug)}/schedule`).then(unwrap),

  /** One month of the same four layers. Defaults to now when not given. */
  month: (slug: string, when: { year?: number; month?: number } = {}) =>
    request<{ data: ProjectMonth }>(
      `projects/${encodeURIComponent(slug)}/calendar${query(when)}`,
    ).then(unwrap),
};

export const dependencies = {
  /** Both directions, plus everything this item could wait for. */
  forItem: (slug: string, itemId: string) =>
    request<{
      data: { dependsOn: Dependency[]; blocks: Dependency[] };
      meta: {
        canManage: boolean;
        candidates: { id: string; title: string; externalRef: string | null }[];
        /** From the server, so no screen hardcodes four strings and a wording. */
        types: DependencyTypeOption[];
      };
    }>(
      `projects/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/dependencies`,
    ),

  /**
   * Refused with a 422 naming the loop if it would close one.
   *
   * The message is the remedy — it lists the items in the cycle, so nobody
   * has to work out which of a dozen links to remove.
   */
  add: (
    slug: string,
    itemId: string,
    input: {
      predecessorId: string;
      lagDays?: number;
      /** Absent means finish-to-start, as every row written before sprint 8 is. */
      type?: DependencyTypeKey;
      note?: string | null;
    },
  ) =>
    request<{ data: Dependency }>(
      `projects/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/dependencies`,
      { method: "POST", body: input },
    ).then(unwrap),

  remove: (slug: string, itemId: string, dependencyId: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/dependencies/${encodeURIComponent(dependencyId)}`,
      { method: "DELETE" },
    ),
};

/* ------------------------------------------------------------------ */
/*  Documents, charter and client links                                 */
/* ------------------------------------------------------------------ */

export type DocumentKindKey =
  | "charter"
  | "contract"
  | "specification"
  | "design"
  | "report"
  | "minutes"
  | "other";

export interface DocumentKindOption {
  value: DocumentKindKey;
  label: string;
  hint: string;
  /** Where the sharing toggle starts. Never a decision — see the enum. */
  sharedByDefault: boolean;
}

export interface ProjectDocument {
  id: string;
  title: string;
  description: string | null;
  kind: DocumentKindKey;
  kindLabel: string;
  /** Whether a client holding the link can see it. False unless chosen. */
  isShared: boolean;
  /**
   * Whether the file behind the record still exists.
   *
   * A document whose asset was purged keeps its row — losing the record that
   * a signed contract existed is worse than holding one that no longer opens
   * — so the screen has to tell the two apart rather than offering a 404.
   */
  isReadable: boolean;
  sizeBytes: number | null;
  mime: string | null;
  fileName: string | null;
  streamUrl: string | null;
  uploadedBy: string | null;
  addedOn: string | null;
}

export interface CharterNarrative {
  purpose: string | null;
  background: string | null;
  scopeIn: string | null;
  scopeOut: string | null;
  successCriteria: string | null;
  assumptions: string | null;
  constraints: string | null;
}

/**
 * A charter, assembled from live data rather than transcribed.
 *
 * Only `narrative` is stored. Everything else is read fresh, which means a
 * stakeholder who leaves disappears from it — correct, and the opposite of
 * what a signed PDF does, which is why the approval records the words.
 */
export interface Charter {
  narrative: CharterNarrative;
  approval: {
    isApproved: boolean;
    by: string | null;
    /** In their own words, stored as typed. */
    as: string | null;
    at: string | null;
  };
  project: {
    name: string;
    company: string | null;
    startsOn: string | null;
    targetEndsOn: string | null;
    currency: string | null;
  };
  stakeholders: {
    name: string | null;
    role: string;
    roleLabel: string;
    influence: StakeholderWeight;
    interest: StakeholderWeight;
    strategy: string;
    isPrimary: boolean;
  }[];
  team: { name: string | null; role: ProjectRole; roleLabel: string }[];
  milestones: {
    id: string;
    title: string;
    dueOn: string | null;
    isComplete: boolean;
  }[];
  /** Null when the project cannot be scheduled — an absence, not a blank. */
  schedule: {
    startsOn: string | null;
    endsOn: string | null;
    durationDays: number;
    itemCount: number;
    unestimated: number;
    coverage: number | null;
  } | null;
}

export interface ProjectShare {
  id: string;
  label: string;
  /** The last few characters. The token itself is shown once and never again. */
  hint: string;
  expiresOn: string;
  isLive: boolean;
  /** "revoked" and "expired" have different remedies, so they are named apart. */
  deadReason: "revoked" | "expired" | null;
  daysLeft: number;
  viewCount: number;
  lastViewedAt: string | null;
  createdBy: string | null;
  createdOn: string | null;
}

export const documents = {
  forProject: (slug: string) =>
    request<{
      data: ProjectDocument[];
      meta: { canManage: boolean; canShare?: boolean; kinds: DocumentKindOption[] };
    }>(`projects/${encodeURIComponent(slug)}/documents`),

  /**
   * Multipart, so it goes through the upload forwarder rather than `request`.
   *
   * `isShared` is the form's "Share on the client page" box (P14), ticked by
   * default for a status report. Sharing needs `canShare`; the server refuses
   * it otherwise.
   */
  upload: (
    slug: string,
    file: File,
    input: { title?: string; kind?: DocumentKindKey; description?: string; isShared?: boolean } = {},
  ) => {
    const body = new FormData();

    body.append("file", file);

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === "boolean") body.append(key, value ? "1" : "0");
      else if (value !== undefined && value !== "") body.append(key, value);
    }

    return upload<{ data: ProjectDocument }>(
      `projects/${encodeURIComponent(slug)}/documents`,
      body,
    ).then(unwrap);
  },

  update: (
    slug: string,
    id: string,
    input: { title?: string; kind?: DocumentKindKey; description?: string | null },
  ) =>
    request<{ data: ProjectDocument }>(
      `projects/${encodeURIComponent(slug)}/documents/${encodeURIComponent(id)}`,
      { method: "PATCH", body: input },
    ).then(unwrap),

  /**
   * Put a file in front of the client, or take it back.
   *
   * Its own call because it is the one action here with consequences outside
   * the building, and the server gives it its own audit line.
   */
  setShared: (slug: string, id: string, isShared: boolean) =>
    request<{ data: ProjectDocument }>(
      `projects/${encodeURIComponent(slug)}/documents/${encodeURIComponent(id)}/share`,
      { method: "POST", body: { isShared } },
    ).then(unwrap),

  remove: (slug: string, id: string) =>
    request<unknown>(
      `projects/${encodeURIComponent(slug)}/documents/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
};

export const charter = {
  forProject: (slug: string) =>
    request<{ data: Charter; meta: { canEdit: boolean; isStarted: boolean } }>(
      `projects/${encodeURIComponent(slug)}/charter`,
    ),

  /**
   * Editing an approved charter clears the sign-off, and `meta.approvalCleared`
   * says so at the moment it happens. An approval is of a text, not of a
   * project.
   */
  save: (slug: string, narrative: Partial<CharterNarrative>) =>
    request<{ data: Charter; meta: { approvalCleared: boolean } }>(
      `projects/${encodeURIComponent(slug)}/charter`,
      { method: "PATCH", body: narrative },
    ),

  approve: (slug: string, approvedAs: string) =>
    request<{ data: Charter }>(`projects/${encodeURIComponent(slug)}/charter/approve`, {
      method: "POST",
      body: { approvedAs },
    }).then(unwrap),

  unapprove: (slug: string) =>
    request<{ data: Charter }>(`projects/${encodeURIComponent(slug)}/charter/unapprove`, {
      method: "POST",
      body: {},
    }).then(unwrap),
};

export const shares = {
  forProject: (slug: string) =>
    request<{
      data: ProjectShare[];
      meta: {
        defaultDays: number;
        maxDays: number;
        /** What the link carries, from the server so it cannot drift. */
        shows: string[];
        hides: string[];
      };
    }>(`projects/${encodeURIComponent(slug)}/shares`),

  /**
   * The only call that ever returns a token, and it returns it once.
   *
   * A secret a screen can re-display is one sitting in a database in plain
   * text. The caller has to show it immediately or lose it.
   */
  create: (slug: string, input: { label: string; days?: number }) =>
    request<{ data: ProjectShare; meta: { token: string; shownOnce: boolean } }>(
      `projects/${encodeURIComponent(slug)}/shares`,
      { method: "POST", body: input },
    ),

  revoke: (slug: string, id: string) =>
    request<{ data: ProjectShare }>(
      `projects/${encodeURIComponent(slug)}/shares/${encodeURIComponent(id)}/revoke`,
      { method: "POST", body: {} },
    ).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  Testing: test sprints, the case library, AI drafts, findings       */
/*  (5 Oct 2026, PROJECTS_MODULE.md § 9k)                              */
/* ------------------------------------------------------------------ */

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory =
  | "functional"
  | "security"
  | "performance"
  | "usability"
  | "accessibility"
  | "compatibility"
  | "data";
export type TestLevel = "api" | "ui";
export type TestCaseCategory =
  | "functional"
  | "negative"
  | "boundary"
  | "security"
  | "performance"
  | "accessibility"
  | "integration";
export type TestRunStatus = "not_run" | "passed" | "failed" | "blocked" | "skipped";
export type TestSprintFocus = "functional" | "security" | "regression" | "full";

export interface TestCase {
  id: string;
  projectId: string;
  /** "TC-14": per project, never reused. */
  reference: string;
  number: number;
  title: string;
  level: TestLevel;
  levelLabel: string;
  category: TestCaseCategory;
  categoryLabel: string;
  priority: number;
  acceptanceCriterion: string | null;
  preconditions: string | null;
  steps: string[];
  testData: string | null;
  expectedResult: string;
  apiMethod: string | null;
  apiPath: string | null;
  expectedStatus: number | null;
  workItemId: string | null;
  workItem?: { id: string; title: string; type: WorkItemType; externalRef: string | null } | null;
  sprintId: string | null;
  source: "ai" | "manual";
  isDeleted: boolean;
  /** The last judged outcome in any test sprint. */
  lastRun?: { status: TestRunStatus; statusLabel: string; executedAt: string | null; testSprintId: string } | null;
  createdAt: string | null;
}

export interface TestSprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  focus: TestSprintFocus;
  focusLabel: string;
  environment: string | null;
  startsOn: string;
  endsOn: string;
  status: SprintState;
  statusLabel: string;
  sequence: number;
  targetSprintId: string | null;
  targetSprint?: { id: string; name: string; sequence: number } | null;
  lead?: { id: string; name: string | null } | null;
  summary: string | null;
  recommendations: string | null;
  runCount?: number;
  findingCount?: number;
  /** By outcome; on the list only. */
  runCounts?: Record<TestRunStatus, number>;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

export interface TestRun {
  id: string;
  testSprintId: string;
  testCaseId: string;
  testCase?: TestCase | null;
  status: TestRunStatus;
  statusLabel: string;
  actualResult: string | null;
  notes: string | null;
  attempts: number;
  assignee?: { id: string; name: string | null } | null;
  executedBy?: { id: string; name: string | null } | null;
  executedAt: string | null;
  findingId: string | null;
  finding?: { id: string; title: string; severity: FindingSeverity | null; isComplete: boolean } | null;
}

type Tally = { total: number; passed: number; failed: number };

export interface FindingTally {
  total: number;
  open: number;
  bySeverity: Record<FindingSeverity, { open: number; resolved: number }>;
}

export interface TestSprintReport {
  runs: Record<TestRunStatus, number> & { total: number; executed: number };
  /** Of what was judged. Null when nothing was - never 0%. */
  passRate: number | null;
  executionRate: number | null;
  byLevel: Partial<Record<TestLevel, Tally>>;
  byCategory: Partial<Record<TestCaseCategory, Tally>>;
  /** Null when the test sprint tests no delivery sprint. */
  coverage: {
    items: number;
    covered: number;
    uncovered: { id: string; title: string; type: WorkItemType }[];
  } | null;
  findings: FindingTally;
  /** Closed: the numbers are the frozen record. */
  frozen: boolean;
  /** On a closed sprint: its findings as they stand today. */
  findingsNow?: FindingTally;
}

export interface FindingsSummary {
  open: number;
  unscheduled: number;
  resolved: number;
  openBySeverity: Record<FindingSeverity | "unclassified", number>;
}

/** One case in an AI draft, before it is in the library. */
export interface DraftCase {
  keep: boolean;
  title: string;
  level: TestLevel;
  category: TestCaseCategory;
  priority: number;
  criterion: string | null;
  preconditions: string | null;
  steps: string[];
  testData: string | null;
  expectedResult: string;
  apiMethod: string | null;
  apiPath: string | null;
  expectedStatus: number | null;
}

/** One story (or loose task) in a draft, and its drafted cases. */
export interface DraftSource {
  itemId: string;
  type: WorkItemType;
  title: string;
  focus: TestSprintFocus;
  keep: boolean;
  generated: boolean;
  error: string | null;
  /** The story already had criteria; the draft uses them as written. */
  hadCriteria: boolean;
  acceptanceCriteria: string[];
  cases: DraftCase[];
}

export interface TestCaseDraft {
  id: string;
  status: ImportStatus;
  statusLabel: string;
  isOpen: boolean;
  summary: string;
  sprint: { id: string; name: string } | null;
  sourceCount: number;
  draftedCount: number;
  caseCount: number;
  keptCount: number;
  createdCount: number;
  provider: AiProviderKey;
  model: string;
  totalTokens: number;
  createdBy: string | null;
  committedAt: string | null;
  createdAt: string | null;
  sources?: DraftSource[];
}

export interface FindingInput {
  title: string;
  severity: FindingSeverity;
  findingCategory?: FindingCategory | null;
  description?: string | null;
  stepsToReproduce?: string | null;
  expectedOutcome?: string | null;
  recommendation?: string | null;
  priority?: number;
  assigneeId?: string | null;
  estimateHours?: number | null;
  estimatePoints?: number | null;
  startsOn?: string | null;
  dueOn?: string | null;
  foundInItemId?: string | null;
  testSprintId?: string | null;
}

const slugPath = (slug: string) => `projects/${encodeURIComponent(slug)}`;

export const testSprints = {
  list: (slug: string) => request<{ data: TestSprint[] }>(`${slugPath(slug)}/test-sprints`).then(unwrap),

  /** With its runs (each carrying its case) and the report. */
  get: (id: string) =>
    request<{ data: TestSprint; meta: { runs: TestRun[]; report: TestSprintReport } }>(
      `test-sprints/${encodeURIComponent(id)}`,
    ),

  /** Naming `targetSprintId` brings that sprint's cases in unless `includeTargetCases` is false. */
  create: (slug: string, input: Record<string, unknown>) =>
    request<{ data: TestSprint }>(`${slugPath(slug)}/test-sprints`, { method: "POST", body: input }).then(unwrap),

  update: (id: string, input: Record<string, unknown>) =>
    request<{ data: TestSprint }>(`test-sprints/${encodeURIComponent(id)}`, { method: "PATCH", body: input }).then(unwrap),

  start: (id: string) =>
    request<{ data: TestSprint }>(`test-sprints/${encodeURIComponent(id)}/start`, { method: "POST", body: {} }).then(unwrap),

  /** Freezes the report; the written summary and recommendations go with it. */
  close: (id: string, input: { summary?: string | null; recommendations?: string | null }) =>
    request<{ data: TestSprint }>(`test-sprints/${encodeURIComponent(id)}/close`, { method: "POST", body: input }).then(unwrap),

  addRuns: (id: string, input: { caseIds?: string[]; fromTargetSprint?: boolean }) =>
    request<{ data: { added: number } }>(`test-sprints/${encodeURIComponent(id)}/runs`, { method: "POST", body: input }).then(unwrap),
};

export const testRuns = {
  update: (id: string, input: Record<string, unknown>) =>
    request<{ data: TestRun }>(`test-runs/${encodeURIComponent(id)}`, { method: "PATCH", body: input }).then(unwrap),

  remove: (id: string) => request<unknown>(`test-runs/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** Marks the run failed and files a finding in the test backlog. */
  raiseFinding: (id: string, input: FindingInput) =>
    request<{ data: WorkItem }>(`test-runs/${encodeURIComponent(id)}/finding`, { method: "POST", body: input }).then(unwrap),
};

export const testCases = {
  list: (
    slug: string,
    filters: { itemId?: string; sprintId?: string; level?: TestLevel; category?: TestCaseCategory; q?: string } = {},
  ) =>
    request<{
      data: TestCase[];
      meta: { total: number; canManage: boolean; canGenerate: boolean; provider: { provider: AiProviderKey; model: string } | null };
    }>(`${slugPath(slug)}/test-cases${query(filters)}`),

  create: (slug: string, input: Record<string, unknown>) =>
    request<{ data: TestCase }>(`${slugPath(slug)}/test-cases`, { method: "POST", body: input }).then(unwrap),

  update: (id: string, input: Record<string, unknown>) =>
    request<{ data: TestCase }>(`test-cases/${encodeURIComponent(id)}`, { method: "PATCH", body: input }).then(unwrap),

  /** To the recycle bin. */
  remove: (id: string) => request<unknown>(`test-cases/${encodeURIComponent(id)}`, { method: "DELETE" }),

  drafts: (slug: string) => request<{ data: TestCaseDraft[] }>(`${slugPath(slug)}/test-cases/drafts`).then(unwrap),

  /** No model call yet: one source per story or loose task. */
  startDraft: (slug: string, input: { sprintId?: string; itemIds?: string[]; focus?: TestSprintFocus }) =>
    request<{ data: TestCaseDraft }>(`${slugPath(slug)}/test-cases/drafts`, { method: "POST", body: input }).then(unwrap),

  getDraft: (slug: string, id: string) =>
    request<{ data: TestCaseDraft }>(`${slugPath(slug)}/test-cases/drafts/${encodeURIComponent(id)}`).then(unwrap),

  /** One story's cases from the model. Re-running replaces them. */
  draftSource: (slug: string, id: string, index: number) =>
    request<{ data: TestCaseDraft }>(`${slugPath(slug)}/test-cases/drafts/${encodeURIComponent(id)}/sources/${index}`, {
      method: "POST",
      body: {},
    }).then(unwrap),

  /** Paths: "2" is a source, "2.5" its sixth case. */
  reviseDraft: (
    slug: string,
    id: string,
    changes: { path: string; keep?: boolean; title?: string; expectedResult?: string; priority?: number; acceptanceCriteria?: string[] }[],
  ) =>
    request<{ data: TestCaseDraft }>(`${slugPath(slug)}/test-cases/drafts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { changes },
    }).then(unwrap),

  commitDraft: (slug: string, id: string) =>
    request<{ data: TestCaseDraft }>(`${slugPath(slug)}/test-cases/drafts/${encodeURIComponent(id)}/commit`, {
      method: "POST",
      body: {},
    }).then(unwrap),

  discardDraft: (slug: string, id: string) =>
    request<unknown>(`${slugPath(slug)}/test-cases/drafts/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const findings = {
  /** The test backlog. `state` defaults to open. */
  list: (
    slug: string,
    filters: {
      state?: "open" | "unscheduled" | "scheduled" | "resolved" | "all";
      severity?: FindingSeverity;
      category?: FindingCategory;
      testSprintId?: string;
      q?: string;
    } = {},
  ) =>
    request<{ data: WorkItem[]; meta: { summary: FindingsSummary; canManage: boolean; canSchedule: boolean } }>(
      `${slugPath(slug)}/findings${query(filters)}`,
    ),

  /** A finding outside a test run: exploratory testing, a security review. */
  create: (slug: string, input: FindingInput) =>
    request<{ data: WorkItem }>(`${slugPath(slug)}/findings`, { method: "POST", body: input }).then(unwrap),
};
