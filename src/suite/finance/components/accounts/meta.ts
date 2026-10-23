import type { Hue } from "@/components/workspace/modules";
import type { Account, AccountType, CashFlowClass, TrialBalanceRow } from "@/lib/api/finance-ledger-client";
import type { SelectOption } from "@/components/workspace/SearchableSelect";

/*
  The words the chart of accounts is read in. The API speaks in keys
  (`cost_of_revenue`, `non_current_asset`, `bank_charges`); nobody keying a
  journal should have to.
*/

export const ACCOUNT_TYPES: { key: AccountType; label: string; family: Family }[] = [
  { key: "asset", label: "Asset", family: "assets" },
  { key: "liability", label: "Liability", family: "liabilities" },
  { key: "equity", label: "Equity", family: "equity" },
  { key: "revenue", label: "Revenue", family: "income" },
  { key: "other_income", label: "Other income", family: "income" },
  { key: "cost_of_revenue", label: "Cost of revenue", family: "costs" },
  { key: "expense", label: "Expense", family: "costs" },
  { key: "other_expense", label: "Other expense", family: "costs" },
];

export type Family = "assets" | "liabilities" | "equity" | "income" | "costs";

/** Statement families, in the order a chart is read. */
export const FAMILIES: { key: Family; label: string; hue: Hue }[] = [
  { key: "assets", label: "Assets", hue: "sky" },
  { key: "liabilities", label: "Liabilities", hue: "coral" },
  { key: "equity", label: "Net assets and reserves", hue: "grape" },
  { key: "income", label: "Income", hue: "mint" },
  { key: "costs", label: "Expenditure", hue: "sun" },
];

export const typeLabel = (t: AccountType | string) => ACCOUNT_TYPES.find((x) => x.key === t)?.label ?? t;
export const familyOf = (t: AccountType | string): Family => ACCOUNT_TYPES.find((x) => x.key === t)?.family ?? "assets";
export const familyMeta = (f: Family) => FAMILIES.find((x) => x.key === f) ?? FAMILIES[0];

/** Subtypes the balance sheet sorts by; only assets, liabilities and equity have them. */
export const SUBTYPES: Partial<Record<AccountType, { key: string; label: string }[]>> = {
  asset: [
    { key: "cash", label: "Cash and bank" },
    { key: "current_asset", label: "Current asset" },
    { key: "non_current_asset", label: "Non-current asset" },
  ],
  liability: [
    { key: "current_liability", label: "Current liability" },
    { key: "non_current_liability", label: "Non-current liability" },
  ],
  equity: [{ key: "equity", label: "Equity" }],
};

export const subtypeLabel = (s: string | null) =>
  s ? (Object.values(SUBTYPES).flat().find((x) => x?.key === s)?.label ?? s.replace(/_/g, " ")) : null;

export const CASH_FLOW: { key: CashFlowClass; label: string }[] = [
  { key: "operating", label: "Operating" },
  { key: "investing", label: "Investing" },
  { key: "financing", label: "Financing" },
];

/** What each automatic-posting purpose is for (`CoaTemplates::REQUIRED_SYSTEM_KEYS`). */
export const SYSTEM_KEYS: Record<string, string> = {
  cash_in_transit: "Cash in transit",
  bank_charges: "Bank charges",
  vat_bank_charges: "VAT on bank charges",
  stamp_duty: "Stamp duty",
  retained_earnings: "Accumulated surplus",
  fx_gain_unrealised: "Unrealised FX gain",
  fx_loss_unrealised: "Unrealised FX loss",
  fx_gain_realised: "Realised FX gain",
  fx_loss_realised: "Realised FX loss",
  salaries: "Salaries",
  employer_pension: "Employer pension",
  employer_nsitf: "Employer NSITF",
  employer_other: "Other employer costs",
  paye_payable: "PAYE payable",
  pension_payable: "Pension payable",
  nhf_payable: "NHF payable",
  nsitf_payable: "NSITF payable",
  other_employer_payable: "Other employer contributions payable",
  payroll_deductions_payable: "Payroll deductions payable",
  staff_loans: "Staff loans",
  net_salaries_payable: "Net salaries payable",
  cit_payable: "Income tax payable",
  suspense: "Suspense",
};

export const systemKeyLabel = (k: string) => SYSTEM_KEYS[k] ?? k.replace(/_/g, " ");

export const DIMENSION_LABEL: Record<string, string> = {
  project: "Project",
  "cost centre": "Cost centre",
  counterparty: "Client or vendor",
  person: "Person",
};

/* ------------------------------------------------------------------ */

export interface TreeNode {
  account: Account;
  children: TreeNode[];
}

/** Accounts as a forest, children in code order. Orphans (parent missing) become roots. */
export function buildTree(accounts: Account[]): TreeNode[] {
  const byId = new Map(accounts.map((a) => [a.id, { account: a, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.account.parentId ? byId.get(node.account.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/**
 * Closing balance per account from a trial balance, debit-positive, with each
 * heading carrying the sum of everything beneath it.
 */
export function balancesById(accounts: Account[], rows: TrialBalanceRow[]): Map<string, number> {
  const own = new Map(rows.map((r) => [r.accountId, r.closingDebit - r.closingCredit]));
  const out = new Map<string, number>();
  const walk = (n: TreeNode): number => {
    const sum = (own.get(n.account.id) ?? 0) + n.children.reduce((s, c) => s + walk(c), 0);
    out.set(n.account.id, sum);
    return sum;
  };
  buildTree(accounts).forEach(walk);
  return out;
}

/** A balance the way the account is read: credit-normal accounts show credits as positive. */
export const normalSigned = (a: Pick<Account, "normalBalance">, debitPositive: number) =>
  a.normalBalance === "credit" ? -debitPositive : debitPositive;

/** Options for an account picker: postable, active accounts, grouped by family. */
export function accountOptions(accounts: Account[]): SelectOption[] {
  return accounts
    .filter((a) => a.isPostable && a.active)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((a) => ({
      value: a.id,
      label: `${a.code} ${a.name}`,
      hint: [a.currency ? `${a.currency} only` : null, a.requires.length ? `Needs ${a.requires.join(", ")}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      group: familyMeta(familyOf(a.type)).label,
    }));
}
