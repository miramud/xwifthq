/*
  An event's budget, worked as the API works it (`Events::fill`): the total
  of every line, and contingency capped at a share of the other lines -
  10% unless the organisation says otherwise. Above the cap, saving is
  refused; the editor shows the cap as the lines are typed.
*/

export const CONTINGENCY = "contingency";

/** The cap the API applies by default, in basis points (1000 = 10%). */
export const DEFAULT_CONTINGENCY_CAP_BP = 1000;

export interface BudgetSummary {
  total: number;
  contingency: number;
  /** Every line that is not contingency. */
  others: number;
  /** The most contingency the other lines allow. */
  cap: number;
  overCap: boolean;
}

export function eventBudget(lines: readonly { category: string; amount: number | null | undefined }[], capBp = DEFAULT_CONTINGENCY_CAP_BP): BudgetSummary {
  let total = 0;
  let contingency = 0;
  for (const l of lines) {
    const a = Math.max(0, l.amount ?? 0);
    total += a;
    if (l.category === CONTINGENCY) contingency += a;
  }
  const others = total - contingency;
  return {
    total,
    contingency,
    others,
    cap: Math.floor((others * capBp) / 10_000),
    // Same test as the API: contingency × 10000 > others × cap.
    overCap: total > 0 && contingency * 10_000 > others * capBp,
  };
}

export interface LineBars {
  /** Width of each bar as a percentage of the widest figure on the line. */
  budgetPct: number;
  committedPct: number;
  paidPct: number;
  /** Committed beyond the line's budget. */
  over: boolean;
  /** What is left uncommitted (negative when over). */
  available: number;
}

/**
 * Budget, committed and paid for one line as three bars on one scale: the
 * budget's own width is 100% unless the commitments have gone past it.
 */
export function lineBars(line: { budget: number; committed: number; paid: number }): LineBars {
  const scale = Math.max(line.budget, line.committed, line.paid, 1);
  const pct = (v: number) => Math.round((Math.max(0, v) / scale) * 1000) / 10;
  return {
    budgetPct: pct(line.budget),
    committedPct: pct(line.committed),
    paidPct: pct(line.paid),
    over: line.committed > line.budget,
    available: line.budget - line.committed,
  };
}
