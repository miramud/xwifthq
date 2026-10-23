import type { AuthUser } from "@/lib/auth-store";
import { holdsFeature } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";

/**
 * Finance features as the API names them (`finance.{feature}.{action}`,
 * `Finance/Access/permissions.php`).
 */
export type FinanceFeature =
  | "accounts"
  | "periods"
  | "journals"
  | "reports"
  | "period_end"
  | "banking"
  | "statements"
  | "bank_rules"
  | "reconciliation"
  | "payroll"
  | "memos"
  | "fcu"
  | "vouchers"
  | "payments"
  | "project_funds"
  | "spend_settings"
  | "contracts"
  | "invoices"
  | "receipts"
  | "labour"
  | "labour_people"
  | "fixed_assets"
  | "budgets"
  | "cash_forecast"
  | "wht"
  | "recurring_journals"
  | "lookups";

/**
 * May this person see a Finance page? Admins, and anybody whose role holds a
 * key of the feature (the Accountant, the Financial controller, the Finance
 * viewer). Presentation only - the API refuses regardless.
 */
export function mayUseFinance(user: AuthUser | null, ...features: FinanceFeature[]): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;
  return holdsFeature(user, "finance", ...features);
}

/** Holds this exact action, e.g. `mayDo(u, "journals", "post")`. Admins always. */
export function mayDo(user: AuthUser | null, feature: FinanceFeature, action: string): boolean {
  if (!user) return false;
  if (isAdminRole(user)) return true;
  return (user.permissions ?? []).includes(`finance.${feature}.${action}`);
}
