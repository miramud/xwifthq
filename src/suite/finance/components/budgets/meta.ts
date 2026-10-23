import { BadgeCheck, Ban, CircleDashed, Archive, Hourglass, ShieldAlert, ShieldX, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { BudgetStatus, BudgetSummary, ControlMode } from "@/lib/api/finance-budgets-client";

/* Budgets' words and colours: status, controls, and which version of a year counts. */

export const BUDGET_STATUS: Record<BudgetStatus, { label: string; hue: Hue; icon: LucideIcon }> = {
  draft: { label: "Draft", hue: "slate", icon: CircleDashed },
  pending_approval: { label: "In approval", hue: "sun", icon: Hourglass },
  approved: { label: "Approved", hue: "mint", icon: BadgeCheck },
  superseded: { label: "Superseded", hue: "slate", icon: Archive },
  rejected: { label: "Rejected", hue: "rose", icon: Ban },
};

export const budgetStatus = (s: string) => BUDGET_STATUS[s as BudgetStatus] ?? { label: s, hue: "slate" as Hue, icon: CircleDashed };

export const CONTROL_MODE: Record<ControlMode, { label: string; hue: Hue; icon: LucideIcon; says: string }> = {
  warn: { label: "Warn", hue: "sun", icon: ShieldAlert, says: "A voucher over budget goes ahead, flagged for the FCU and approvers." },
  block: { label: "Block", hue: "rose", icon: ShieldX, says: "A voucher over budget is refused until the budget is revised or the line recoded." },
};

/** The version that counts for a year: the approved one, else the newest. */
export function headlineVersion(versions: BudgetSummary[]): BudgetSummary | null {
  return versions.find((b) => b.status === "approved") ?? [...versions].sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
}

/** A version is being prepared (draft or in approval): no other may start. */
export const inPreparation = (versions: BudgetSummary[]) => versions.find((b) => b.status === "draft" || b.status === "pending_approval") ?? null;

/** Percent with one decimal and a sign: `+12.5%`, `−3%`. */
export function signedPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const t = Math.abs(v).toFixed(1).replace(/\.0$/, "");
  return v > 0 ? `+${t}%` : v < 0 ? `−${t}%` : "0%";
}
