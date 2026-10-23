"use client";

import { useId } from "react";
import { Coins, Plus, Trash2 } from "lucide-react";
import type { CurrencyShare } from "@/lib/api/finance-revenue-client";
import { Button, Card, cx } from "@/components/workspace/kit";
import { HUE, hueFor } from "@/components/workspace/modules";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { inputClass } from "@/suite/lms/components/ui/ws";
import { CURRENCIES } from "@/suite/org/components/foundations/shared";
import { amount } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { apportion, bpFromPct, pct, pctInput, share, splitProblem, type SplitRow } from "./meta";

/**
 * How a client pays a contract across currencies (Finance PRD §12: "EMMS
 * paid 60% NGN / 40% USD"). Each row is a currency, its share of every
 * milestone and the rate the contract was priced at; the ribbon fills as
 * shares are typed, the unshared rest hatched, and each row shows what the
 * contract value comes to in that currency. Milestones are invoiced in
 * these shares unless one says otherwise.
 */

export interface SplitDraft {
  key: string;
  currency: string;
  share: string;
  rate: string;
}

let seq = 0;
export const splitKey = () => `s${++seq}`;

export const draftsFrom = (split: CurrencyShare[] | null | undefined): SplitDraft[] =>
  (split ?? []).map((r) => ({ key: splitKey(), currency: r.currency, share: pctInput(r.shareBp), rate: r.planningRate && r.planningRate !== "1" ? r.planningRate : "" }));

/** The rows as the API takes them (shares in basis points). */
export const splitRows = (drafts: SplitDraft[]): SplitRow[] =>
  drafts.map((d) => ({ currency: d.currency, shareBp: bpFromPct(d.share, 10_000) ?? 0, planningRate: d.rate.trim() || undefined }));

export const splitInput = (drafts: SplitDraft[], base: string): CurrencyShare[] =>
  splitRows(drafts).map((r) => ({ currency: r.currency, shareBp: r.shareBp, ...(r.currency !== base && r.planningRate ? { planningRate: r.planningRate.replace(/,/g, "") } : {}) }));

export default function CurrencySplitEditor({
  drafts,
  onChange,
  value,
  currency,
  base,
  readOnly = false,
  error,
}: {
  drafts: SplitDraft[];
  onChange: (next: SplitDraft[]) => void;
  /** The contract value, in `currency`. */
  value: number;
  currency: string;
  base: string;
  readOnly?: boolean;
  error?: string;
}) {
  const uid = useId();
  const on = drafts.length > 0;
  const rows = splitRows(drafts);
  const parts = apportion(value, currency, rows, base);
  const total = rows.reduce((s, r) => s + Math.max(0, r.shareBp), 0);
  const problem = on ? error ?? splitProblem(rows, currency, base) : null;
  const baseTotal = parts.every((p) => p.base !== null) ? parts.reduce((s, p) => s + (p.base ?? 0), 0) : null;

  const patch = (key: string, p: Partial<SplitDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const turnOn = () => {
    const other = currency === base ? "USD" : base;
    onChange([
      { key: splitKey(), currency, share: "60", rate: "" },
      { key: splitKey(), currency: other, share: "40", rate: "" },
    ]);
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
            <Coins size={16} className="text-neutral-500" aria-hidden />
            How the client pays
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {on
              ? "Every milestone is invoiced in these shares, a part per currency, unless the milestone says otherwise."
              : `Everything is paid in ${currency}. Split it when part is paid in another currency.`}
          </p>
        </div>
        {!readOnly && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => (e.target.checked ? turnOn() : onChange([]))}
              className="h-4 w-4 accent-primary-600"
            />
            Paid in more than one currency
          </label>
        )}
      </div>

      {on && (
        <>
          <div className="mt-4" aria-hidden>
            <div className="ws-hatch flex h-3 overflow-hidden rounded-full">
              {rows.map((r, i) =>
                r.shareBp > 0 ? (
                  <span key={drafts[i].key} className={cx("h-full transition-[width] duration-300", HUE[hueFor(r.currency)].bar)} style={{ width: `${share(Math.min(r.shareBp, 10_000), Math.max(total, 10_000))}%` }} />
                ) : null,
              )}
            </div>
          </div>
          <p className={cx("mt-2 text-xs tabular-nums", total === 10_000 ? "text-neutral-500" : "font-semibold text-rose-700")} aria-live="polite">
            Shares add up to {pct(total)}
            {total !== 10_000 && (total < 10_000 ? `, ${pct(10_000 - total)} still to place` : `, ${pct(total - 10_000)} too much`)}
          </p>

          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200/80">
            {drafts.map((d, i) => {
              const f = (k: string) => `${uid}-${d.key}-${k}`;
              const isBase = d.currency === base;
              const p = parts[i];
              return (
                <li key={d.key} className="grid gap-3 px-4 py-3 sm:grid-cols-[8rem_6rem_minmax(0,1fr)] lg:grid-cols-[8rem_6rem_9rem_minmax(0,1fr)_2.5rem] lg:items-end">
                  <div>
                    <label htmlFor={f("cur")} className="mb-1 block text-xs font-medium text-neutral-600">
                      Currency
                    </label>
                    <SearchableSelect id={f("cur")} size="sm" value={d.currency} onChange={(v) => patch(d.key, { currency: v })} options={CURRENCIES} disabled={readOnly} searchPlaceholder="Search currencies" />
                  </div>
                  <div>
                    <label htmlFor={f("share")} className="mb-1 block text-xs font-medium text-neutral-600">
                      Share %
                    </label>
                    <input
                      id={f("share")}
                      inputMode="decimal"
                      value={d.share}
                      disabled={readOnly}
                      onChange={(e) => patch(d.key, { share: e.target.value })}
                      className={cx(inputClass, "h-10 text-right tabular-nums")}
                    />
                  </div>
                  <div>
                    <label htmlFor={f("rate")} className="mb-1 block text-xs font-medium text-neutral-600">
                      Priced at ({base} per 1)
                    </label>
                    <input
                      id={f("rate")}
                      inputMode="decimal"
                      value={isBase ? "1" : d.rate}
                      disabled={readOnly || isBase}
                      placeholder="e.g. 1600"
                      onChange={(e) => patch(d.key, { rate: e.target.value })}
                      className={cx(inputClass, "h-10 text-right tabular-nums")}
                    />
                  </div>
                  <p className="text-sm tabular-nums text-neutral-600 lg:pb-2.5">
                    {p?.amount !== null && p?.amount !== undefined ? (
                      <>
                        <span className="font-semibold text-neutral-900">{amount(p.amount, d.currency as CurrencyCode)}</span>
                        {!isBase && p.base !== null && <span className="text-neutral-500"> · {amount(p.base, base as CurrencyCode)}</span>}
                      </>
                    ) : (
                      <span className="text-neutral-500">Give the rate to see its part</span>
                    )}
                  </p>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                      aria-label={`Remove ${d.currency || "this currency"} from the split`}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {!readOnly && drafts.length < 6 && (
              <Button size="sm" icon={Plus} onClick={() => onChange([...drafts, { key: splitKey(), currency: "", share: pctInput(Math.max(0, 10_000 - total)), rate: "" }])}>
                Add a currency
              </Button>
            )}
            {baseTotal !== null && (
              <p className="text-sm text-neutral-600">
                Contract value in {base} at these rates <span className="font-semibold tabular-nums text-neutral-900">{amount(baseTotal, base as CurrencyCode)}</span>
              </p>
            )}
          </div>
          {problem && (
            <p role="alert" className="mt-2 text-sm font-medium text-error-700">
              {problem}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
