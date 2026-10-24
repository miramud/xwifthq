"use client";

import { useId } from "react";
import { AlertTriangle, CircleCheckBig, Plus, Trash2 } from "lucide-react";
import { Button, Chip, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount as money, amountInput, parseAmount } from "@/suite/finance/lib/format";
import { memoStatus } from "@/suite/finance/components/requests/labels";
import type { PaymentTerm, PaymentTermInput, TermTrigger } from "@/lib/api/operations-procurement-client";
import { checkTerms, parsePct, pctText } from "./meta";

/*
  An order's payment terms: each a label, what makes it due, and a share of
  the order or a fixed amount. The editor checks, as it is typed, that the
  terms add up to the order's total (the API refuses them otherwise).
*/

export interface TermRow {
  key: string;
  label: string;
  trigger: TermTrigger | "";
  mode: "pct" | "amount";
  value: string;
  days: string;
}

let seq = 0;
const nextKey = () => `t${++seq}`;

export const blankTerm = (): TermRow => ({ key: nextKey(), label: "", trigger: "", mode: "pct", value: "", days: "" });

export function termRows(terms: PaymentTerm[]): TermRow[] {
  return terms.map((t) => ({
    key: nextKey(),
    label: t.label,
    trigger: t.trigger,
    mode: t.pctBp != null ? "pct" : "amount",
    value: t.pctBp != null ? String(t.pctBp / 100) : amountInput(t.amount),
    days: t.days != null ? String(t.days) : "",
  }));
}

/** The rows as the API takes them, with each row's problem (index → message). */
export function termInputs(rows: TermRow[]): { terms: PaymentTermInput[]; problems: Record<number, string> } {
  const problems: Record<number, string> = {};
  const terms: PaymentTermInput[] = rows.map((r, i) => {
    const pctBp = r.mode === "pct" ? parsePct(r.value) : null;
    const amount = r.mode === "amount" ? parseAmount(r.value) : null;
    const days = r.days.trim() === "" ? null : Number(r.days);
    if (!r.label.trim()) problems[i] = "Give the term a label, like “Advance (30%)”.";
    else if (!r.trigger) problems[i] = "Choose what makes this payment due.";
    else if (r.mode === "pct" && pctBp === null) problems[i] = "A share is a percentage above 0 and up to 100.";
    else if (r.mode === "amount" && (amount === null || amount <= 0)) problems[i] = "Type the amount, like 250,000.00.";
    else if (r.trigger === "net_days" && (days === null || !Number.isInteger(days) || days < 0 || days > 365)) problems[i] = "Say how many days after the invoice (0 to 365).";
    return { label: r.label.trim(), trigger: (r.trigger || "on_delivery") as TermTrigger, pctBp, amount, days: r.trigger === "net_days" ? days : null };
  });
  return { terms, problems };
}

/** How the rows add up against the total, read as they are typed. */
export function rowsCheck(rows: TermRow[], total: number) {
  return checkTerms(
    rows.map((r) => ({ pctBp: r.mode === "pct" ? parsePct(r.value) : null, amount: r.mode === "amount" ? parseAmount(r.value) ?? 0 : null })),
    total,
  );
}

/** Adds up / short / over, as a bar with the remainder hatched. */
export function TermsMeter({ sum, total, currency = "NGN" }: { sum: number; total: number; currency?: string }) {
  const gap = total - sum;
  const ok = Math.abs(gap) <= 100;
  const pct = total > 0 ? Math.min(100, (sum / total) * 100) : 0;
  return (
    <div aria-live="polite" className={cx("rounded-2xl border p-4", ok ? "border-mint-500/30 bg-mint-50/50" : "border-sun-500/30 bg-sun-50/50")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-neutral-700">
          Terms add up to <Money value={sum} currency={currency} className="font-bold text-neutral-900" />
        </span>
        <span className="text-neutral-500">
          of <Money value={total} currency={currency} />
        </span>
      </div>
      <div className="ws-hatch mt-2 h-2.5 overflow-hidden rounded-full" aria-hidden>
        <div className={cx("h-full rounded-full", ok ? "bg-mint-500" : gap < 0 ? "bg-rose-500" : "bg-sun-500")} style={{ width: `${pct}%` }} />
      </div>
      <p className={cx("mt-2 flex items-center gap-1.5 text-xs font-semibold", ok ? "text-mint-700" : "text-sun-700")}>
        {ok ? <CircleCheckBig size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
        {ok ? "The terms add up to the order." : gap > 0 ? `${money(gap)} short of the order total.` : `${money(-gap)} more than the order total.`}
      </p>
    </div>
  );
}

export function PaymentTermsEditor({
  rows,
  onChange,
  total,
  triggers,
  problems = {},
  currency = "NGN",
}: {
  rows: TermRow[];
  onChange: (rows: TermRow[]) => void;
  total: number;
  triggers: Record<string, string>;
  problems?: Record<number, string>;
  currency?: string;
}) {
  const uid = useId();
  const check = rowsCheck(rows, total);
  const options = Object.entries(triggers).map(([value, label]) => ({ value, label }));
  const set = (i: number, patch: Partial<TermRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className={cx("rounded-2xl border bg-white p-4", problems[i] ? "border-error-500/40" : "border-neutral-200/80")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-neutral-500">Term {i + 1}</p>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">
                  <Money value={check.amounts[i] ?? 0} currency={currency} />
                </span>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, k) => k !== i))}
                  disabled={rows.length === 1}
                  aria-label={`Remove term ${i + 1}`}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-l${i}`} className="mb-1 block text-xs font-medium text-neutral-600">
                  Label, term {i + 1}
                </label>
                <input id={`${uid}-l${i}`} className={inputClass} value={r.label} maxLength={120} onChange={(e) => set(i, { label: e.target.value })} placeholder="Advance (30%)" />
              </div>
              <div>
                <label htmlFor={`${uid}-t${i}`} className="mb-1 block text-xs font-medium text-neutral-600">
                  Due, term {i + 1}
                </label>
                <SearchableSelect id={`${uid}-t${i}`} value={r.trigger} onChange={(v) => set(i, { trigger: v as TermTrigger })} options={options} placeholder="What makes it due" searchPlaceholder="Search" />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
                <Segmented
                  label={`Term ${i + 1} as`}
                  value={r.mode}
                  onChange={(m) => set(i, { mode: m, value: "" })}
                  options={[
                    { key: "pct", label: "Share %" },
                    { key: "amount", label: "Amount ₦" },
                  ]}
                />
                <div className="min-w-[8rem] flex-1">
                  <label htmlFor={`${uid}-v${i}`} className="mb-1 block text-xs font-medium text-neutral-600">
                    {r.mode === "pct" ? `Share (%), term ${i + 1}` : `Amount (₦), term ${i + 1}`}
                  </label>
                  <input
                    id={`${uid}-v${i}`}
                    inputMode="decimal"
                    className={cx(inputClass, "text-right tabular-nums")}
                    value={r.value}
                    onChange={(e) => set(i, { value: e.target.value })}
                    placeholder={r.mode === "pct" ? "30" : "0.00"}
                  />
                </div>
                {r.trigger === "net_days" && (
                  <div className="w-28">
                    <label htmlFor={`${uid}-d${i}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      Days after
                    </label>
                    <input id={`${uid}-d${i}`} inputMode="numeric" className={cx(inputClass, "text-right tabular-nums")} value={r.days} onChange={(e) => set(i, { days: e.target.value })} placeholder="30" />
                  </div>
                )}
              </div>
            </div>
            <FieldError message={problems[i]} />
          </li>
        ))}
      </ol>
      <Button size="sm" icon={Plus} onClick={() => onChange([...rows, blankTerm()])} disabled={rows.length >= 12}>
        Add a term
      </Button>
      <TermsMeter sum={check.sum} total={total} currency={currency} />
    </div>
  );
}

const TERM_STATUS: Record<string, { label: string; hue: "slate" | "sky" | "mint" | "sun" }> = {
  pending: { label: "Not due yet", hue: "slate" },
  awaiting_finance: { label: "Waiting for Finance", hue: "sun" },
  memo_raised: { label: "Payment memo raised", hue: "sky" },
  paid: { label: "Paid", hue: "mint" },
};

/** The terms as agreed, read-only, with where each payment is. */
export function PaymentTermsList({ terms, triggers, total, currency = "NGN" }: { terms: PaymentTerm[]; triggers: Record<string, string>; total: number; currency?: string }) {
  if (terms.length === 0) return <p className="text-sm text-neutral-500">No payment terms set.</p>;
  const sum = terms.reduce((s, t) => s + t.amount, 0);
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {terms.map((t) => {
          const st = TERM_STATUS[t.status] ?? { label: memoStatus(t.status).label, hue: "slate" as const };
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-100 bg-white px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">{t.label}</span>
                <span className="block text-xs text-neutral-500">
                  {triggers[t.trigger] ?? t.trigger}
                  {t.trigger === "net_days" && t.days != null ? ` · ${t.days} days` : ""}
                  {t.pctBp != null ? ` · ${pctText(t.pctBp)}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Chip hue={st.hue} className="!text-[11px]">
                  {st.label}
                </Chip>
                <Money value={t.amount} currency={currency} className="text-sm font-bold text-neutral-900" />
              </span>
            </li>
          );
        })}
      </ol>
      <TermsMeter sum={sum} total={total} currency={currency} />
    </div>
  );
}
