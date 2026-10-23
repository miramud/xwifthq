/* ------------------------------------------------------------------ */
/*  Elevate Finance › the company report: every analysis Finance can   */
/*  give for a period in one answer - statements, budget, projects,    */
/*  spend, every request and who raised it, receivables, payables,     */
/*  tax, assets, labour and approvals.                                 */
/*                                                                    */
/*  `GET /finance/reports/company?from&to` → `{ data: CompanyReport }` */
/*  with `/pdf` (branded, landscape) and `/xlsx` beside it. Money is   */
/*  integer minor units of `currency` unless a field says otherwise.   */
/* ------------------------------------------------------------------ */

import { financeRequest, unwrap } from "./finance-request";

export interface CompanyRange {
  from?: string | null;
  to?: string | null;
}

export interface CrAccountRow {
  code: string;
  name: string;
  group: string | null;
  amount: number;
}

export interface CrSection {
  rows: CrAccountRow[];
  total: number;
}

export interface CrHeadline {
  income: number;
  costs: number;
  netSurplus: number;
  /** Surplus over income in basis points; null without income. */
  marginBp: number | null;
  openingCash: number;
  closingCash: number;
  netCashFlow: number;
  receivable: number;
  overdue: number;
  payable: number;
  advancesOut: number;
  committed: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  paidOut: number;
  requests: number;
  requesters: number;
  projects: number;
  projectsRed: number;
}

export interface CrMonth {
  month: string;
  label: string;
  income: number;
  directCosts: number;
  expenses: number;
  surplus: number;
}

export interface CrIncome {
  revenue: CrSection;
  costOfRevenue: CrSection;
  grossSurplus: number;
  expenses: CrSection;
  operatingSurplus: number;
  otherIncome: CrSection;
  otherExpenses: CrSection;
  netSurplus: number;
  monthly: CrMonth[];
}

export interface CrPosition {
  asAt: string;
  currentAssets: CrSection;
  nonCurrentAssets: CrSection;
  totalAssets: number;
  currentLiabilities: CrSection;
  nonCurrentLiabilities: CrSection;
  totalLiabilities: number;
  equity: CrSection;
  unclosedSurplus: number;
  totalEquity: number;
  balanced: boolean;
}

export interface CrFlowBlock {
  rows: { label: string; amount: number }[];
  inflows: number;
  outflows: number;
  total: number;
}

export interface CrCashFlow {
  openingCash: number;
  operating: CrFlowBlock;
  investing: CrFlowBlock;
  financing: CrFlowBlock;
  netChange: number;
  closingCash: number;
}

export interface CrBank {
  code: string;
  name: string;
  currency: string;
  /** In the base currency. */
  balance: number;
  /** In the account's own currency when it is not the base one. */
  currencyBalance: number | null;
}

export interface CrBudget {
  fiscalYear: number | string;
  version: string | number | null;
  months: string[];
  ytdMonths: number;
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
  rows: {
    code: string;
    name: string;
    income: boolean;
    budgetYear: number;
    budgetYtd: number;
    actualYtd: number;
    varianceYtd: number;
    variancePct: number | null;
  }[];
}

export type CrRag = "green" | "amber" | "red" | "stale" | "grey";

export interface CrProject {
  id: string;
  name: string;
  code: string | null;
  client: string | null;
  contractValue: number;
  bac: number;
  hasBudget: boolean;
  released: number;
  committed: number;
  spent: number;
  available: number;
  invoiced: number;
  collected: number;
  projectedProfit: number | null;
  status: CrRag;
  reasons: { dimension: string; status: string; reason: string }[];
  categories: { category: string; label: string; budget: number; budgetToDate: number; spent: number }[];
  cpi: number | null;
  spi: number | null;
  /** Percent complete in basis points. */
  pctBp: number | null;
}

export interface CrPortfolio {
  totals: {
    contractValue: number;
    bac: number;
    released: number;
    committed: number;
    spent: number;
    available: number;
    invoiced: number;
    collected: number;
    projectedProfit: number;
    red: number;
    amber: number;
    stale: number;
    [k: string]: number;
  };
  projects: CrProject[];
}

export interface CrSpendRow {
  label: string;
  count: number;
  amount: number;
  wht: number;
}

export interface CrSpend {
  byCategory: CrSpendRow[];
  byCostCentre: CrSpendRow[];
  byProject: CrSpendRow[];
  byAccount: CrSpendRow[];
  byPayee: (CrSpendRow & { net: number })[];
  byPreparer: { label: string; count: number; amount: number }[];
  vouchers: {
    pvNo: string;
    date: string;
    payee: string;
    narration: string | null;
    gross: number;
    vat: number;
    wht: number;
    net: number;
    status: string;
    preparedBy: string | null;
  }[];
}

export interface CrRegister {
  label: string;
  count: number;
  live: number;
  estimated: number;
  approved: number;
  actual: number;
}

export interface CrRequest {
  register: string;
  registerLabel: string;
  id: string;
  reference: string | null;
  title: string;
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
  /** The parent request this one belongs to; its money is counted there. */
  partOf: string | null;
  inTotals: boolean;
  note: string | null;
}

export interface CrPersonRow {
  name: string;
  requests: number;
  live: number;
  byRegister: Record<string, number>;
  estimated: number;
  approved: number;
  actual: number;
}

export interface CrAging {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  over90: number;
  retention: number;
  total: number;
}

export interface CrReceivables {
  asOf: string;
  totals: CrAging;
  clients: (CrAging & { client: string; invoices: unknown[] })[];
}

export interface CompanyReport {
  organisation: string;
  from: string;
  to: string;
  periodLabel: string;
  currency: string;
  headline: CrHeadline;
  income: CrIncome;
  position: CrPosition;
  cashFlow: CrCashFlow;
  banks: CrBank[];
  budget: CrBudget | null;
  portfolio: CrPortfolio;
  spend: CrSpend;
  registers: Record<string, CrRegister>;
  requests: CrRequest[];
  requesters: (CrPersonRow & { department: string | null })[];
  departments: CrPersonRow[];
  receivables: CrReceivables;
  payables: { pvNo: string; date: string; payee: string; narration: string | null; net: number; status: string; days: number }[];
  advances: { reference: string | null; title: string; person: string | null; department: string | null; project: string | null; outstanding: number; days: number }[];
  commitments: { project: string; category: string; count: number; outstanding: number }[];
  tax: { vat: number; whtWithheld: number; remitted: number; byCode: { code: string; base: number; wht: number; lines: number }[] };
  assets: { count: number; cost: number; accumulated: number; nbv: number; byClass: { label: string; count: number; cost: number; accumulated: number; nbv: number }[] };
  labour: { allocated: number; bench: number; hours: number; byProject: { label: string; hours: number; amount: number; people: number }[] };
  approvals: {
    byProcess: { process: string; submitted: number; approved: number; rejected: number; open: number; amount: number; avgDays: number | null }[];
    byApprover: { name: string; decisions: number; approved: number; rejected: number; returned: number; avgHours: number | null }[];
  };
}

function rangeQuery(r: CompanyRange): string {
  const p = new URLSearchParams();
  if (r.from) p.set("from", r.from);
  if (r.to) p.set("to", r.to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const companyReport = {
  get: (r: CompanyRange = {}) =>
    unwrap(financeRequest<{ data: CompanyReport }>("reports/company", { query: { from: r.from ?? undefined, to: r.to ?? undefined } })),
  /** The branded landscape PDF, streamed through the proxy. */
  pdfUrl: (r: CompanyRange = {}) => `/api/finance/reports/company/pdf${rangeQuery(r)}`,
  /** The workbook, one sheet per section. */
  xlsxUrl: (r: CompanyRange = {}) => `/api/finance/reports/company/xlsx${rangeQuery(r)}`,
};
