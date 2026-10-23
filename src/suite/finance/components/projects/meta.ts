import { AlertOctagon, AlertTriangle, CheckCircle2, Clock3, MinusCircle, type LucideIcon } from "lucide-react";
import type { Hue } from "@/components/workspace/modules";
import type { ProjectFunds, Rag } from "@/lib/api/finance-payments-client";

/*
  Words and colours for project funds. RAG is never colour alone: every
  chip says Red / Amber / Green / No budget / Stale data and carries its
  own icon. Stale (progress over 14 days old) sits between amber and green:
  nothing is known to be wrong, but nothing can be trusted either.
*/

export const RAG: Record<Rag, { label: string; hue: Hue; icon: LucideIcon; rank: number }> = {
  red: { label: "Red", hue: "rose", icon: AlertOctagon, rank: 3 },
  amber: { label: "Amber", hue: "sun", icon: AlertTriangle, rank: 2 },
  green: { label: "Green", hue: "mint", icon: CheckCircle2, rank: 1 },
  grey: { label: "No budget", hue: "slate", icon: MinusCircle, rank: 0 },
  stale: { label: "Stale data", hue: "slate", icon: Clock3, rank: 1.5 },
};

export const DIMENSION_LABEL: Record<string, string> = {
  funds: "Funds",
  budget: "Budget by category",
  discipline: "Spend discipline",
  cost: "Cost efficiency",
  schedule: "Schedule",
  margin: "Margin",
  collections: "Collections",
  progress: "Progress data",
};

/** The budget categories (`ProjectBudget::CATEGORIES`); the detail endpoint sends the live list. */
export const COST_CATEGORIES: Record<string, string> = {
  labour: "Labour",
  travel: "Travel",
  licences: "Licences and tokens",
  hardware: "Hardware",
  consultants: "Consultants",
  workshops: "Workshops and events",
  other: "Other",
};

export const SCOPE_LABEL: Record<string, string> = {
  non_labour: "Non-labour spend",
  all: "All spend, labour included",
};

export const RELEASE_STATUS: Record<string, { label: string; hue: Hue }> = {
  requested: { label: "Awaiting approval", hue: "grape" },
  approved: { label: "Released", hue: "mint" },
  rejected: { label: "Rejected", hue: "rose" },
  revoked: { label: "Revoked", hue: "slate" },
};

export const PROJECT_STATUS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  in_progress: "In progress",
};

/**
 * The one sentence the portfolio shows beside a project's chip: the reason
 * behind its worst dimension (the first one, when several share it).
 */
export function headline(p: Pick<ProjectFunds, "status" | "reasons">): string {
  const worst = p.reasons.find((r) => r.status === p.status) ?? p.reasons[0];
  return worst?.reason ?? "";
}

/** Red first, then amber, stale, green, no budget; then by name. */
export function byRisk(a: ProjectFunds, b: ProjectFunds): number {
  return RAG[b.status].rank - RAG[a.status].rank || a.name.localeCompare(b.name);
}

/** `2026-09` → the first day of that month, as the API takes budget months. */
export const monthStart = (ym: string) => `${ym}-01`;

/** Months from `from` to `to` inclusive, as `YYYY-MM`. */
export function monthRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !fm || !ty || !tm) return [];
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function thisMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
