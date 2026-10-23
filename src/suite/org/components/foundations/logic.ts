import type { BankAccount, FxRate, OrgProfile, OrgUnit } from "@/lib/api/org-foundations-client";

/*
  The pure parts of the organisation foundations pages: the profile form's
  mapping to the API, the unit tree built from the API's flat list, the
  maker-checker reading of a bank account, and reference-format editing.
  Kept apart from the components so each rule is tested on its own.
*/

/* ------------------------------ profile ----------------------------- */

export const WEEKDAYS: { iso: number; short: string; long: string }[] = [
  { iso: 1, short: "Mon", long: "Monday" },
  { iso: 2, short: "Tue", long: "Tuesday" },
  { iso: 3, short: "Wed", long: "Wednesday" },
  { iso: 4, short: "Thu", long: "Thursday" },
  { iso: 5, short: "Fri", long: "Friday" },
  { iso: 6, short: "Sat", long: "Saturday" },
  { iso: 7, short: "Sun", long: "Sunday" },
];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The profile form: every field as the text somebody types. */
export interface ProfileForm {
  legalName: string;
  tradingName: string;
  shortCode: string;
  rcNumber: string;
  tin: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  timezone: string;
  workingDays: number[];
  workStartsAt: string;
  workEndsAt: string;
  documentFooter: string;
}

export type ProfilePatch = Partial<Omit<OrgProfile, "address" | "displayName" | "updatedAt">>;

export function profileToForm(p: OrgProfile): ProfileForm {
  return {
    legalName: p.legalName ?? "",
    tradingName: p.tradingName ?? "",
    shortCode: p.shortCode ?? "",
    rcNumber: p.rcNumber ?? "",
    tin: p.tin ?? "",
    vatNumber: p.vatNumber ?? "",
    addressLine1: p.addressLine1 ?? "",
    addressLine2: p.addressLine2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    postalCode: p.postalCode ?? "",
    country: p.country ?? "",
    baseCurrency: p.baseCurrency ?? "",
    fiscalYearStartMonth: p.fiscalYearStartMonth ?? 1,
    fiscalYearStartDay: p.fiscalYearStartDay ?? 1,
    timezone: p.timezone ?? "",
    workingDays: [...(p.workingDays ?? [])].sort((a, b) => a - b),
    workStartsAt: p.workStartsAt ?? "08:00",
    workEndsAt: p.workEndsAt ?? "17:00",
    documentFooter: p.documentFooter ?? "",
  };
}

const blank = (s: string): string | null => (s.trim() === "" ? null : s.trim());

/** The whole form as the PATCH body: blanks become null, codes are upper-cased, days sorted and unique. */
export function formToPatch(f: ProfileForm): ProfilePatch {
  return {
    legalName: blank(f.legalName),
    tradingName: blank(f.tradingName),
    shortCode: blank(f.shortCode)?.toUpperCase() ?? null,
    rcNumber: blank(f.rcNumber),
    tin: blank(f.tin),
    vatNumber: blank(f.vatNumber),
    addressLine1: blank(f.addressLine1),
    addressLine2: blank(f.addressLine2),
    city: blank(f.city),
    state: blank(f.state),
    postalCode: blank(f.postalCode),
    country: f.country.trim().toUpperCase(),
    baseCurrency: f.baseCurrency.trim().toUpperCase(),
    fiscalYearStartMonth: f.fiscalYearStartMonth,
    fiscalYearStartDay: f.fiscalYearStartDay,
    timezone: f.timezone,
    workingDays: Array.from(new Set(f.workingDays)).sort((a, b) => a - b),
    workStartsAt: f.workStartsAt,
    workEndsAt: f.workEndsAt,
    documentFooter: blank(f.documentFooter),
  };
}

/** Only the fields that changed, so an unchanged base currency is never re-sent (and refused). */
export function changedPatch(original: ProfileForm, next: ProfileForm): ProfilePatch {
  const a = formToPatch(original) as Record<string, unknown>;
  const b = formToPatch(next) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(b)) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out[key] = b[key];
  }
  // The API checks the end against the start, so they always travel together.
  if ("workStartsAt" in out || "workEndsAt" in out) {
    out.workStartsAt = b.workStartsAt;
    out.workEndsAt = b.workEndsAt;
  }
  return out as ProfilePatch;
}

export function toggleDay(days: number[], iso: number): number[] {
  return days.includes(iso) ? days.filter((d) => d !== iso) : [...days, iso].sort((a, b) => a - b);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Field -> message, for what the browser can tell before the API does. */
export function validateProfile(f: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (f.shortCode.trim() !== "" && !/^[A-Za-z0-9]{1,8}$/.test(f.shortCode.trim())) {
    errors.shortCode = "Use up to 8 letters and numbers, no spaces.";
  }
  if (!/^[A-Za-z]{2}$/.test(f.country.trim())) errors.country = "Use the two-letter country code, like NG.";
  if (!/^[A-Za-z]{3}$/.test(f.baseCurrency.trim())) errors.baseCurrency = "Use the three-letter currency code, like NGN.";
  if (f.workingDays.length === 0) errors.workingDays = "Pick at least one working day.";
  if (!HHMM.test(f.workStartsAt)) errors.workStartsAt = "Use a time like 08:00.";
  if (!HHMM.test(f.workEndsAt)) errors.workEndsAt = "Use a time like 17:00.";
  else if (HHMM.test(f.workStartsAt) && f.workEndsAt <= f.workStartsAt) errors.workEndsAt = "The day has to end after it starts.";
  if (f.fiscalYearStartDay < 1 || f.fiscalYearStartDay > 28) errors.fiscalYearStartDay = "Pick a day from 1 to 28.";
  return errors;
}

/** Hours in the working day, for the summary line ("8.5 hours a day"). */
export function hoursBetween(start: string, end: string): number | null {
  if (!HHMM.test(start) || !HHMM.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : null;
}

/* ---------------------------- exchange rates ------------------------ */

/** A rate as decimal text: up to ten whole digits, up to eight decimals, more than zero. */
export function isRateText(s: string): boolean {
  const t = s.trim();
  return /^\d{1,10}(\.\d{1,8})?$/.test(t) && Number(t) > 0;
}

/** Each currency's rates, oldest first, and the currencies in order of most recent rate. */
export function ratesByCurrency(rates: FxRate[]): { currency: string; rates: FxRate[]; latest: FxRate }[] {
  const groups = new Map<string, FxRate[]>();
  for (const r of rates) {
    const list = groups.get(r.currency) ?? [];
    list.push(r);
    groups.set(r.currency, list);
  }
  return Array.from(groups.entries())
    .map(([currency, list]) => {
      const sorted = [...list].sort((a, b) => a.asOf.localeCompare(b.asOf));
      return { currency, rates: sorted, latest: sorted[sorted.length - 1] };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/* ------------------------------ structure --------------------------- */

export interface UnitNode {
  unit: OrgUnit;
  children: UnitNode[];
  /** Depth as drawn here (an orphan whose parent was filtered out starts again at 0). */
  level: number;
}

/** The API's flat list as a tree. A unit whose parent is missing is drawn at the top level. */
export function buildTree(units: OrgUnit[]): UnitNode[] {
  const ids = new Set(units.map((u) => u.id));
  const byParent = new Map<string | null, OrgUnit[]>();
  for (const u of units) {
    const key = u.parentId && ids.has(u.parentId) ? u.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(u);
    byParent.set(key, list);
  }
  const order = (a: OrgUnit, b: OrgUnit) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const seen = new Set<string>();
  const grow = (parent: string | null, level: number): UnitNode[] =>
    (byParent.get(parent) ?? [])
      .slice()
      .sort(order)
      .filter((u) => !seen.has(u.id) && (seen.add(u.id), true))
      .map((u) => ({ unit: u, level, children: grow(u.id, level + 1) }));
  return grow(null, 0);
}

/** Depth-first rows of the tree, skipping the children of collapsed units. */
export function visibleRows(tree: UnitNode[], collapsed: Set<string>): UnitNode[] {
  const out: UnitNode[] = [];
  const walk = (nodes: UnitNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (!collapsed.has(n.unit.id)) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/** Every unit beneath this one, at any depth. */
export function descendantIds(id: string, units: OrgUnit[]): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const u of units) {
      if (u.parentId === current && !out.has(u.id)) {
        out.add(u.id);
        stack.push(u.id);
      }
    }
  }
  return out;
}

/** Where a unit may be moved: anywhere except itself and its own descendants (that would make a loop). */
export function moveTargets(unit: OrgUnit, units: OrgUnit[]): OrgUnit[] {
  const banned = descendantIds(unit.id, units);
  banned.add(unit.id);
  return units.filter((u) => !banned.has(u.id) && u.status === "active");
}

/** Parent -> grandparent ... names, for "Finance › Accounts" breadcrumbs. */
export function pathOf(unit: OrgUnit, units: OrgUnit[]): OrgUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: OrgUnit[] = [];
  const seen = new Set<string>();
  let next = unit.parentId ? byId.get(unit.parentId) : undefined;
  while (next && !seen.has(next.id)) {
    out.unshift(next);
    seen.add(next.id);
    next = next.parentId ? byId.get(next.parentId) : undefined;
  }
  return out;
}

/* ---------------------------- bank accounts ------------------------- */

export type BankStage = "pending" | "active" | "rejected" | "retired";

export interface BankStep {
  key: "entered" | "decided" | "waiting" | "retired";
  label: string;
  who: string | null;
  when: string | null;
  tone: "done" | "waiting" | "refused";
}

export function bankStage(a: BankAccount): BankStage {
  switch (a.status) {
    case "pending_approval":
      return "pending";
    case "active":
      return "active";
    case "rejected":
      return "rejected";
    default:
      return "retired";
  }
}

/** The maker-checker story of one account: who entered it, and who decided (or that nobody has yet). */
export function bankTimeline(a: BankAccount): BankStep[] {
  const steps: BankStep[] = [
    { key: "entered", label: "Entered", who: a.requestedBy?.name ?? null, when: a.requestedAt, tone: "done" },
  ];
  const stage = bankStage(a);
  if (stage === "pending") {
    steps.push({ key: "waiting", label: "Waiting for a second person to check", who: null, when: null, tone: "waiting" });
  } else if (stage === "rejected") {
    steps.push({ key: "decided", label: "Rejected", who: a.decidedBy?.name ?? null, when: a.decidedAt, tone: "refused" });
  } else {
    steps.push({ key: "decided", label: "Approved", who: a.decidedBy?.name ?? null, when: a.decidedAt, tone: "done" });
    if (stage === "retired") steps.push({ key: "retired", label: "Retired", who: null, when: null, tone: "refused" });
  }
  return steps;
}

/** The person who entered bank details may not approve them. */
export function mayCheck(a: BankAccount, userId: string | null | undefined): boolean {
  return bankStage(a) === "pending" && Boolean(userId) && a.requestedBy?.id !== userId;
}

/** The API's refusal when bank changes run through the approval engine. */
export function goesThroughApprovals(message: string | null | undefined): boolean {
  return /approval/i.test(message ?? "") && /decide/i.test(message ?? "");
}

/* ------------------------------ numbering --------------------------- */

/** A client or vendor short code, as the API accepts it for {CLIENT}: up to 12 letters, digits and dashes. */
export const SHORT_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,11}$/;
export const SHORT_CODE_HINT = "Printed in reference numbers as {CLIENT}, e.g. EMMS. Leave empty to use the initials.";
export const SHORT_CODE_ERROR = "Use letters, digits and dashes only, starting with a letter or digit.";

export const TOKENS: { token: string; label: string }[] = [
  { token: "{ORG}", label: "Organisation short code" },
  { token: "{SERIES}", label: "Series code" },
  { token: "{DEPT}", label: "Unit code" },
  { token: "{CC}", label: "Cost centre code" },
  { token: "{CAT}", label: "Asset category code" },
  { token: "{CLIENT}", label: "Client or vendor short code" },
  { token: "{YYYY}", label: "Year, four digits" },
  { token: "{YY}", label: "Year, two digits" },
  { token: "{MM}", label: "Month" },
  { token: "{MMYYYY}", label: "Month and year" },
  { token: "{FY}", label: "Fiscal year" },
  { token: "{NNNN}", label: "Running number (one N per digit)" },
];

/** Puts a token where the caret is (replacing any selection) and says where the caret goes next. */
export function insertToken(
  format: string,
  token: string,
  selectionStart: number | null | undefined,
  selectionEnd?: number | null,
): { value: string; caret: number } {
  const start = selectionStart == null ? format.length : Math.max(0, Math.min(format.length, selectionStart));
  const end = selectionEnd == null ? start : Math.max(start, Math.min(format.length, selectionEnd));
  // Only one running number per format: a second {N…} replaces the first.
  if (/^\{N+\}$/.test(token) && /\{N+\}/.test(format)) {
    const at = format.search(/\{N+\}/);
    const value = format.replace(/\{N+\}/, token);
    return { value, caret: at + token.length };
  }
  const value = format.slice(0, start) + token + format.slice(end);
  return { value, caret: start + token.length };
}

/** What the browser can tell about a format before asking the server. */
export function formatProblem(format: string): string | null {
  if (format.trim() === "") return "Type a format.";
  const runs = format.match(/\{N+\}/g) ?? [];
  if (runs.length === 0) return "Add a running number, like {NNNN}.";
  if (runs.length > 1) return "Use one running number only.";
  return null;
}

export const RESETS: { value: "never" | "yearly" | "fiscal_yearly" | "monthly"; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "yearly", label: "Every calendar year" },
  { value: "fiscal_yearly", label: "Every fiscal year" },
  { value: "monthly", label: "Every month" },
];

/* -------------------------------- misc ------------------------------ */

/** "2026-10-05" or an ISO time -> "5 Oct 2026". */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
