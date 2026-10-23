/* ------------------------------------------------------------------ */
/*  Finance › Fixed assets: the asset classes and their accounts, the  */
/*  books (cost, accumulated depreciation, net book value), the        */
/*  monthly straight-line depreciation run, and disposal. Shapes       */
/*  follow `FixedAssetController` and `FixedAssets` in api-lms. Money  */
/*  is integer kobo; rates are basis points a year (2500 = 25%).       */
/*                                                                    */
/*  An asset Operations holds (`source: "ops_asset"`) is disposed of   */
/*  from Operations; the API refuses it here.                          */
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText } from "./finance-request";

const enc = encodeURIComponent;

export type BookStatus = "active" | "fully_depreciated" | "disposed";

export interface AccountRef {
  id: string;
  code: string;
  name: string;
}

export interface AssetClassRow {
  id: string;
  /** `ict`, `office_equipment`, `furniture`, `vehicles`, `buildings`, … */
  key: string;
  name: string;
  rateBp: number;
  assetAccount: AccountRef | null;
  accumulatedAccount: AccountRef | null;
  expenseAccount: AccountRef | null;
  /** Of the books not disposed of. */
  cost: number;
  accumulated: number;
  count: number;
}

export interface AssetBook {
  id: string;
  tag: string | null;
  description: string;
  classId: string;
  class: string | null;
  cost: number;
  residual: number;
  rateBp: number;
  capitalisedOn: string | null;
  accumulated: number;
  nbv: number;
  status: BookStatus | string;
  /** `manual`, `ops_asset`, `voucher`. */
  source: string | null;
  assetRef: string | null;
  projectId: string | null;
  disposedOn: string | null;
  proceeds: number | null;
  gainLoss: number | null;
  /** Next month's charge on today's figures. */
  monthly: number;
}

export interface DepreciationRunRow {
  id: string;
  /** `YYYY-MM`. */
  month: string;
  total: number;
  status: "posted" | "reversed" | string;
  journalId: string | null;
  journalNo: string | null;
  postedAt: string | null;
}

export interface ForecastMonth {
  month: string;
  charge: number;
  nbv: number;
}

export interface FixedAssetsOverview {
  classes: AssetClassRow[];
  books: AssetBook[];
  totals: { cost: number; accumulated: number; nbv: number; count: number };
  runs: DepreciationRunRow[];
  /** This month and the eleven after, on today's books. */
  forecast: ForecastMonth[];
}

export interface DepreciationPreview {
  month: string;
  total: number;
  classes: { classId: string; class: string; amount: number; assets: number }[];
  /** Books considered. */
  books: number;
  /** A run already posted for the month, which posting again reverses and replaces. */
  existingRunId: string | null;
  /** Classes charged this month without an expense or accumulated-depreciation account. */
  missingAccounts: string[];
}

export interface DepreciationPosted {
  id: string;
  month: string;
  total: number;
  journalId: string | null;
}

export interface ScheduleMonth {
  month: string;
  charge: number;
  accumulated: number;
  nbv: number;
}

export type AssetBookDetail = AssetBook & { schedule: ScheduleMonth[] };

export interface BookInput {
  classKey: string;
  description: string;
  tag?: string | null;
  cost: number;
  residual?: number;
  /** Defaults to the class's rate. */
  rateBp?: number;
  capitalisedOn: string;
  projectId?: string | null;
}

export interface ClassPatch {
  name?: string;
  rateBp?: number;
  assetAccountId?: string | null;
  accumulatedAccountId?: string | null;
  expenseAccountId?: string | null;
}

export interface DisposeInput {
  on: string;
  proceeds: number;
  reason: string;
}

export const fixedAssets = {
  overview: (f: { status?: string | null; classId?: string | null } = {}) =>
    unwrap(financeRequest<{ data: FixedAssetsOverview }>("fixed-assets", { query: { status: f.status ?? undefined, classId: f.classId ?? undefined } })),
  /** Book an asset by hand: one bought before the system, or without Operations. */
  book: (input: BookInput) => unwrap(financeRequest<{ data: AssetBook }>("fixed-assets", { method: "POST", body: input })),
  updateClass: (id: string, patch: ClassPatch) => unwrap(financeRequest<{ data: { id: string } }>(`fixed-assets/classes/${enc(id)}`, { method: "PATCH", body: patch })),
  preview: (month: string) => unwrap(financeRequest<{ data: DepreciationPreview }>(`fixed-assets/depreciation/${enc(month)}`)),
  /** Post the month; a rerun reverses the earlier run first. */
  run: (month: string) => unwrap(financeRequest<{ data: DepreciationPosted }>(`fixed-assets/depreciation/${enc(month)}`, { method: "POST", body: {} })),
  get: (id: string) => unwrap(financeRequest<{ data: AssetBookDetail }>(`fixed-assets/${enc(id)}`)),
  dispose: (id: string, input: DisposeInput) => unwrap(financeRequest<{ data: AssetBook }>(`fixed-assets/${enc(id)}/dispose`, { method: "POST", body: input })),
};

/** `2500` → `25%`; `1250` → `12.5%`. */
export function rateText(bp: number | null | undefined): string {
  if (bp == null) return "-";
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** A typed percentage ("25", "12.5%") as basis points, or null. */
export function parseRate(input: string): number | null {
  const t = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return bp >= 0 && bp <= 10_000 ? bp : null;
}

/** Proceeds less net book value: positive is a gain. */
export const gainOrLoss = (proceeds: number, nbv: number) => proceeds - nbv;

/** How many whole months until a book reaches its residual at its current monthly charge (null when it isn't depreciating). */
export function monthsLeft(b: Pick<AssetBook, "cost" | "residual" | "accumulated" | "monthly" | "status">): number | null {
  if (b.status !== "active" || b.monthly <= 0) return null;
  return Math.ceil(Math.max(0, b.cost - b.residual - b.accumulated) / b.monthly);
}
