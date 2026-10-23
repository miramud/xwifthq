/* ------------------------------------------------------------------ */
/*  Finance › WHT: withholding tax we deducted from suppliers, the     */
/*  monthly remittance to the tax authority (raised as a system memo   */
/*  that goes through FCU → PV → payment), and supplier certificates. */
/*  Shapes follow `WhtController` / `WhtRemittances` in api-lms.       */
/*  Money is integer minor units in the base currency; rates are       */
/*  basis points (1000 = 10%). A line belongs to the month its WHT     */
/*  was recognised: the voucher's accrual (approval) date.            */
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";

export { ApiError, errorText } from "./finance-request";

const enc = encodeURIComponent;

/**
 * nothing: no WHT that month · open: the month is still running ·
 * due: ended, not raised · memo_raised: memo to the tax authority raised ·
 * paid: the voucher paying it is confirmed.
 */
export type WhtStatus = "nothing" | "open" | "due" | "memo_raised" | "paid" | "cancelled" | "draft";

export interface WhtMonth {
  /** `YYYY-MM`. */
  period: string;
  label: string;
  status: WhtStatus | string;
  dueOn: string;
  overdue: boolean;
  lineCount: number;
  supplierCount: number;
  gross: number;
  wht: number;
  remittanceId: string | null;
  memoId: string | null;
  memoReference: string | null;
}

export interface WhtYear {
  year: number;
  currency: string;
  /** Newest first, up to this month. */
  months: WhtMonth[];
  totals: { gross: number; wht: number; remitted: number; outstanding: number };
}

export interface WhtLine {
  lineId: string;
  pvId: string;
  pvNo: string;
  memoReference: string | null;
  /** The accrual journal date. */
  date: string;
  description: string;
  whtCode: string;
  rateBp: number;
  currency: string;
  gross: number;
  wht: number;
  counterpartyId: string | null;
  userId: string | null;
  supplier: string;
  tin: string | null;
}

export interface WhtSupplier {
  key: string;
  counterpartyId: string | null;
  userId: string | null;
  name: string;
  tin: string | null;
  lineCount: number;
  gross: number;
  wht: number;
  lines: WhtLine[];
}

export interface WhtRemittanceInfo {
  id: string;
  status: WhtStatus | string;
  memoId: string | null;
  memoReference: string | null;
  memoStatus: string | null;
  raisedAt: string | null;
  raisedBy: string | null;
  paidAt: string | null;
  pvId: string | null;
  pvNo: string | null;
  bankReference: string | null;
  wht: number;
}

export interface WhtMonthDetail {
  period: string;
  label: string;
  currency: string;
  status: WhtStatus | string;
  dueOn: string;
  monthEnded: boolean;
  totals: { gross: number; wht: number; lineCount: number };
  suppliers: WhtSupplier[];
  missingTin: number;
  /** Recognised in a remitted month after it was raised; not in the remittance. */
  lateLines: WhtLine[];
  remittance: WhtRemittanceInfo | null;
  authority: { id: string; name: string; tin: string | null; hasBankAccount: boolean } | null;
}

export interface WhtCertificateSupplier {
  counterpartyId: string;
  name: string;
  tin: string | null;
  gross: number;
  wht: number;
  lineCount: number;
  months: { period: string; wht: number; remitted: boolean; raised: boolean }[];
}

export interface WhtCertificates {
  year: number;
  currency: string;
  suppliers: WhtCertificateSupplier[];
}

export const wht = {
  year: (year: number) => unwrap(financeRequest<{ data: WhtYear }>("wht/remittances", { query: { year } })),
  month: (period: string) => unwrap(financeRequest<{ data: WhtMonthDetail }>(`wht/remittances/${enc(period)}`)),
  /** Freeze the month's lines and raise the system memo to the tax authority. Once per month. */
  remit: (period: string) => unwrap(financeRequest<{ data: WhtMonthDetail }>(`wht/remittances/${enc(period)}/remit`, { method: "POST", body: {} })),
  certificates: (year: number) => unwrap(financeRequest<{ data: WhtCertificates }>("wht/certificates", { query: { year } })),
  /** The certificate PDF for a month (1–12) or the whole year. */
  certificateUrl: (counterpartyId: string, year: number, month?: number | null) =>
    `/api/finance/wht/certificates/${enc(counterpartyId)}?year=${year}${month ? `&month=${month}` : ""}`,
};

/** `1000` → `10%`; `250` → `2.5%`. */
export function whtRate(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/** `2026-09` → [2026, 9]. */
export function splitPeriod(period: string): [number, number] {
  const [y, m] = period.split("-").map(Number);
  return [y, m];
}

/** Can this month be raised for remittance? Ended, with WHT, not yet raised. */
export const canRaise = (m: Pick<WhtMonth, "status" | "wht">) => m.status === "due" && m.wht > 0;
