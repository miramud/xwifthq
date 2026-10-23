/* ------------------------------------------------------------------ */
/*  Finance › Company budgets and the 13-week cash forecast. Shapes    */
/*  follow `BudgetController` / `Budgets` and `CashForecastController` */
/*  / `CashForecast` in api-lms. Money is integer kobo; months are     */
/*  `YYYY-MM`; dates `YYYY-MM-DD`.                                     */
/*                                                                    */
/*  Budgets: account × (project or cost centre) × month lines, in      */
/*  versions (ORIGINAL, REVISED_1…) of which one per fiscal year is    */
/*  approved. Contract revenue is generated from the contract register */
/*  and never typed. Controls put an account under WARN or BLOCK: a    */
/*  voucher that would take it over its year's budget is flagged or    */
/*  refused (`BUDGET_EXCEEDED: …`).                                    */
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText } from "./finance-request";

const enc = encodeURIComponent;

/* ------------------------------ budgets ----------------------------- */

export type BudgetStatus = "draft" | "pending_approval" | "approved" | "superseded" | "rejected";
export type ControlMode = "warn" | "block";

export interface BudgetTotals {
  income: number;
  expense: number;
  net: number;
}

export interface BudgetSummary {
  id: string;
  fiscalYear: number;
  name: string;
  /** `ORIGINAL`, `REVISED_1`, … */
  version: string;
  versionNo: number;
  status: BudgetStatus;
  currency: string;
  approvalId: string | null;
  approvedAt: string | null;
  totals: BudgetTotals;
  createdBy: string | null;
}

export interface BudgetControl {
  accountId: string;
  code: string | null;
  name: string | null;
  mode: ControlMode;
}

export interface BudgetsIndex {
  /** The fiscal year today falls in. */
  currentYear: number;
  /** Newest year first, newest version first. */
  budgets: BudgetSummary[];
  controls: BudgetControl[];
}

export interface BudgetRow {
  accountId: string;
  code: string | null;
  name: string | null;
  type: string | null;
  projectId: string | null;
  costCentreId: string | null;
  /** `contracts` rows come from the contract register and are read-only. */
  source: "manual" | "contracts";
  /** `YYYY-MM` → kobo, all twelve months. */
  months: Record<string, number>;
  total: number;
}

export interface VarianceRow {
  accountId: string;
  code: string;
  name: string;
  type: string;
  /** Credit-normal (revenue, other income): actual over budget is good. */
  income: boolean;
  budget: number[];
  actual: number[];
  budgetYtd: number;
  actualYtd: number;
  /** Positive is favourable, whichever side the account is on. */
  varianceYtd: number;
  /** (actual − budget) ÷ budget, one decimal; null with no budget. */
  variancePct: number | null;
  budgetYear: number;
  actualYear: number;
}

export interface VersusActual {
  months: string[];
  /** How many of the twelve months are closed and counted in year to date. */
  ytdMonths: number;
  rows: VarianceRow[];
  totals: {
    incomeBudgetYtd: number;
    incomeActualYtd: number;
    expenseBudgetYtd: number;
    expenseActualYtd: number;
    incomeBudgetYear: number;
    expenseBudgetYear: number;
    monthlyIncomeBudget: number[];
    monthlyIncomeActual: number[];
    monthlyExpenseBudget: number[];
    monthlyExpenseActual: number[];
  };
}

export interface BudgetDetail extends BudgetSummary {
  months: string[];
  rows: BudgetRow[];
  versusActual: VersusActual;
  /** Projects the lines name. */
  projects: { id: string; name: string; code: string | null }[];
  costCentres: { id: string; code: string; name: string }[];
}

export interface BudgetRowInput {
  accountId: string;
  projectId?: string | null;
  costCentreId?: string | null;
  months: Record<string, number>;
}

export interface BudgetCheckLine {
  accountId?: string;
  /** `6100 Travel`. */
  account: string;
  projectId?: string | null;
  costCentreId?: string | null;
  budget: number;
  /** Spent this year so far. */
  actual: number;
  /** This voucher. */
  request: number;
  over: number;
  mode: ControlMode;
}

export interface BudgetCheck {
  result: "ok" | "warn" | "block";
  lines: BudgetCheckLine[];
}

export interface CheckLineInput {
  accountId: string;
  projectId?: string | null;
  costCentreId?: string | null;
  amount: number;
}

/** `lines[0][accountId]=…&lines[0][amount]=…` - the array query Laravel reads. */
export function checkQuery(lines: CheckLineInput[], on?: string): string {
  const p = new URLSearchParams();
  lines.forEach((l, i) => {
    p.set(`lines[${i}][accountId]`, l.accountId);
    if (l.projectId) p.set(`lines[${i}][projectId]`, l.projectId);
    if (l.costCentreId) p.set(`lines[${i}][costCentreId]`, l.costCentreId);
    p.set(`lines[${i}][amount]`, String(Math.max(0, Math.round(l.amount))));
  });
  if (on) p.set("on", on);
  return p.toString();
}

export const budgets = {
  list: () => unwrap(financeRequest<{ data: BudgetsIndex }>("budgets")),
  /** The ORIGINAL draft for a year, or a REVISED copy of the approved one. */
  create: (input: { fiscalYear: number; name?: string | null }) => unwrap(financeRequest<{ data: BudgetSummary }>("budgets", { method: "POST", body: input })),
  get: (id: string, f: { projectId?: string | null; costCentreId?: string | null } = {}) =>
    unwrap(financeRequest<{ data: BudgetDetail }>(`budgets/${enc(id)}`, { query: { projectId: f.projectId ?? undefined, costCentreId: f.costCentreId ?? undefined } })),
  /** Replace one row's twelve months (a draft only; contract revenue is refused). */
  saveRow: (id: string, row: BudgetRowInput) => unwrap(financeRequest<{ data: BudgetSummary }>(`budgets/${enc(id)}/rows`, { method: "PUT", body: row })),
  /** Regenerate revenue from the contract register. */
  refreshRevenue: (id: string) => unwrap(financeRequest<{ data: BudgetSummary & { milestones: number } }>(`budgets/${enc(id)}/revenue`, { method: "POST", body: {} })),
  submit: (id: string) => unwrap(financeRequest<{ data: BudgetSummary }>(`budgets/${enc(id)}/submit`, { method: "POST", body: {} })),
  setControl: (accountId: string, mode: ControlMode | "off") =>
    unwrap(financeRequest<{ data: { accountId: string; mode: string } }>("budgets/controls", { method: "PUT", body: { accountId, mode } })),
  /** What the check would say for these lines. */
  check: (lines: CheckLineInput[], on?: string) => unwrap(financeRequest<{ data: BudgetCheck }>(`budgets/check?${checkQuery(lines, on)}`)),
};

/* ---------------------------- budget helpers ------------------------- */

/** `ORIGINAL` → `Original`; `REVISED_2` → `Revision 2`. */
export function versionText(version: string): string {
  if (version === "ORIGINAL") return "Original";
  const m = /^REVISED_(\d+)$/.exec(version);
  return m ? `Revision ${m[1]}` : version;
}

/** Twelve equal months from an annual figure; the odd kobo go to the first months so the year adds up exactly. */
export function spreadAnnual(total: number, months: string[]): Record<string, number> {
  const n = months.length;
  const out: Record<string, number> = {};
  if (n === 0) return out;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(total));
  const each = Math.floor(abs / n);
  const left = abs - each * n;
  months.forEach((m, i) => (out[m] = sign * (each + (i < left ? 1 : 0))));
  return out;
}

/** Running totals. */
export const cumulative = (values: number[]): number[] => {
  let s = 0;
  return values.map((v) => (s += v));
};

/** Positive variance is favourable: income above budget, expense below it. */
export const favourable = (r: Pick<VarianceRow, "varianceYtd">) => r.varianceYtd >= 0;

/** A month's variance with the favourable sign: income actual − budget; expense budget − actual. */
export const monthVariance = (r: Pick<VarianceRow, "income" | "budget" | "actual">, i: number) =>
  r.income ? (r.actual[i] ?? 0) - (r.budget[i] ?? 0) : (r.budget[i] ?? 0) - (r.actual[i] ?? 0);

export const INCOME_TYPES = ["revenue", "other_income"];
export const PROFIT_AND_LOSS = ["revenue", "cost_of_revenue", "expense", "other_income", "other_expense"];

/** Did the API refuse a voucher on a BLOCK control? */
export const isBudgetExceeded = (text: string | null | undefined) => typeof text === "string" && /^BUDGET_EXCEEDED:/.test(text.trim());

/* ---------------------------- cash forecast -------------------------- */

export type ForecastKind = "receipts" | "pipeline" | "vouchers" | "memos" | "payroll" | "statutory" | "recurring";
export type Frequency = "weekly" | "monthly" | "quarterly" | "annual" | "once";

export interface ForecastWeek {
  /** 1–13. */
  week: number;
  from: string;
  to: string;
  opening: number;
  inflows: number;
  outflows: number;
  closing: number;
  byKind: Partial<Record<ForecastKind, number>>;
  /** Closing below the banks' low-balance thresholds. */
  low: boolean;
  negative: boolean;
}

export interface ForecastItem {
  kind: ForecastKind;
  direction: "in" | "out";
  amount: number;
  on: string;
  /** 0-based: week 1 is 0. */
  week: number;
  label: string;
  reference: string | null;
  link: string | null;
  /** Was due before today; counted this week. */
  late: boolean;
}

export interface RecurringItem {
  id: string;
  name: string;
  direction: "in" | "out";
  amount: number;
  frequency: Frequency;
  nextOn: string;
  active: boolean;
}

export interface CashForecast {
  asOf: string;
  opening: number;
  /** The sum of active bank accounts' low-balance thresholds; 0 for none. */
  threshold: number;
  weeks: ForecastWeek[];
  items: ForecastItem[];
  accounts: { code: string; name: string; balance: number }[];
  settings: { overdueCollectionPct: number; pipelinePct: number };
  lowest: ForecastWeek | null;
  recurring: RecurringItem[];
}

export interface RecurringInput {
  name: string;
  direction: "in" | "out";
  amount: number;
  frequency: Frequency;
  nextOn: string;
  active?: boolean;
}

export const cashForecast = {
  get: () => unwrap(financeRequest<{ data: CashForecast }>("cash-forecast")),
  addItem: (input: RecurringInput) => unwrap(financeRequest<{ data: { id: string } }>("cash-forecast/items", { method: "POST", body: input })),
  /** The API takes the whole item each time. */
  updateItem: (id: string, input: RecurringInput) => unwrap(financeRequest<{ data: { id: string } }>(`cash-forecast/items/${enc(id)}`, { method: "PATCH", body: input })),
  removeItem: (id: string) => financeRequest<void>(`cash-forecast/items/${enc(id)}`, { method: "DELETE" }),
  updateSettings: (s: { overdueCollectionPct?: number; pipelinePct?: number }) =>
    unwrap(financeRequest<{ data: { overdueCollectionPct?: number; pipelinePct?: number } }>("cash-forecast/settings", { method: "PATCH", body: s })),
};

export const KIND_ORDER: ForecastKind[] = ["receipts", "pipeline", "vouchers", "memos", "payroll", "statutory", "recurring"];

/** A week's items, grouped by kind in a fixed order. */
export function itemsByKind(items: ForecastItem[], week: number): { kind: ForecastKind; total: number; items: ForecastItem[] }[] {
  const mine = items.filter((i) => i.week === week);
  return KIND_ORDER.map((kind) => {
    const of = mine.filter((i) => i.kind === kind);
    return { kind, total: of.reduce((s, i) => s + (i.direction === "in" ? i.amount : -i.amount), 0), items: of };
  }).filter((g) => g.items.length > 0);
}

/** Thirteen weeks' totals by kind (outflows negative). */
export function kindTotals(items: ForecastItem[]): Record<ForecastKind, number> {
  const out = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<ForecastKind, number>;
  for (const i of items) out[i.kind] = (out[i.kind] ?? 0) + (i.direction === "in" ? i.amount : -i.amount);
  return out;
}

/* ------------------------ Operations' compliance --------------------- */

export interface ComplianceSummary {
  dueSoon: number;
  overdue: number;
  expired: number;
  expiring: number;
  /** Names of mandatory certificates that have expired. */
  expiredMandatory: string[];
}

/**
 * Operations' compliance summary for the MD's flag, or null when the
 * organisation has no Admin & Operations, the person may not see it, or it
 * failed for any reason: the flag is a courtesy, never an error.
 */
export async function operationsCompliance(): Promise<ComplianceSummary | null> {
  try {
    const res = await fetch("/api/operations/overview", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { data?: { compliance?: Partial<ComplianceSummary> } } | null;
    const c = json?.data?.compliance;
    if (!c) return null;
    return {
      dueSoon: Number(c.dueSoon ?? 0),
      overdue: Number(c.overdue ?? 0),
      expired: Number(c.expired ?? 0),
      expiring: Number(c.expiring ?? 0),
      expiredMandatory: Array.isArray(c.expiredMandatory) ? c.expiredMandatory.filter((n): n is string => typeof n === "string") : [],
    };
  } catch {
    return null;
  }
}

