"use client";

import { useEffect, useId, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { Account } from "@/lib/api/finance-ledger-client";
import { Button, Card, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { CurrencySelect } from "@/suite/org/components/foundations/shared";
import { accounting, parseAmount } from "@/suite/finance/lib/format";
import { DIMENSIONS, DimensionSelect, requiredDimensions, type Dimension } from "./dimensions";
import { blankRow, rowCurrency, type EntryRow } from "./entry";

/**
 * The journal entry grid: account, a description, a debit or a credit, and
 * the dimensions an account asks for, one line per row. Shared by a manual
 * journal and a recurring journal template, which take the same lines.
 * Enter on a line's last field starts the next line.
 *
 * The rows live with the caller (`onChange` takes an updater, like
 * `setRows`), so the caller keeps the totals, the beam and the saving.
 */
export function JournalLinesGrid({
  rows,
  onChange,
  accounts,
  options,
  rowErrors,
  caption = "Journal lines",
}: {
  rows: EntryRow[];
  onChange: (update: (rows: EntryRow[]) => EntryRow[]) => void;
  accounts: Map<string, Account>;
  options: SelectOption[];
  rowErrors: Record<string, Partial<Record<string, string>>>;
  caption?: string;
}) {
  const uid = useId();
  const focusNext = useRef<string | null>(null);

  /* After "add a line", put the cursor in its account picker. */
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(`${uid}-${focusNext.current}-account`)?.focus();
    focusNext.current = null;
  }, [rows, uid]);

  const patch = (key: string, p: Partial<EntryRow>) => onChange((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const addRow = (after?: string) => {
    const row = blankRow();
    focusNext.current = row.key;
    onChange((rs) => {
      const i = after ? rs.findIndex((r) => r.key === after) : rs.length - 1;
      return [...rs.slice(0, i + 1), row, ...rs.slice(i + 1)];
    });
  };
  const removeRow = (key: string) =>
    onChange((rs) => (rs.length <= 2 ? rs.map((r) => (r.key === key ? { ...blankRow(), key: r.key } : r)) : rs.filter((r) => r.key !== key)));
  const setAmount = (key: string, side: "debit" | "credit", text: string) =>
    patch(key, side === "debit" ? { debit: text, ...(text.trim() ? { credit: "" } : {}) } : { credit: text, ...(text.trim() ? { debit: "" } : {}) });
  const tidy = (key: string, side: "debit" | "credit", text: string) => {
    const v = parseAmount(text);
    if (v !== null) patch(key, { [side]: v === 0 ? "" : accounting(v) });
  };

  const onLineKey = (e: React.KeyboardEvent, key: string) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const last = rows[rows.length - 1]?.key === key;
    if (last) addRow(key);
    else {
      const i = rows.findIndex((r) => r.key === key);
      document.getElementById(`${uid}-${rows[i + 1]?.key}-account`)?.focus();
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="w-10 py-3 pl-4 pr-2 text-right">
                #
              </th>
              <th scope="col" className="w-[34%] px-2 py-3">
                Account
              </th>
              <th scope="col" className="px-2 py-3">
                Description
              </th>
              <th scope="col" className="w-36 px-2 py-3 text-right">
                Debit
              </th>
              <th scope="col" className="w-36 px-2 py-3 text-right">
                Credit
              </th>
              <th scope="col" className="w-24 py-3 pl-2 pr-4">
                <span className="sr-only">Line actions</span>
              </th>
            </tr>
          </thead>
          {rows.map((r, i) => (
            <LineRows
              key={r.key}
              uid={uid}
              n={i + 1}
              row={r}
              account={accounts.get(r.accountId)}
              options={options}
              errors={rowErrors[r.key] ?? {}}
              onPatch={(p) => patch(r.key, p)}
              onAmount={(side, t) => setAmount(r.key, side, t)}
              onTidy={(side, t) => tidy(r.key, side, t)}
              onKey={(e) => onLineKey(e, r.key)}
              onRemove={() => removeRow(r.key)}
            />
          ))}
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-4 py-3">
        <Button size="sm" icon={Plus} onClick={() => addRow()}>
          Add a line
        </Button>
        <span className="text-xs text-neutral-500">Press Enter in a line to start the next one.</span>
      </div>
    </Card>
  );
}

function LineRows({
  uid,
  n,
  row: r,
  account,
  options,
  errors,
  onPatch,
  onAmount,
  onTidy,
  onKey,
  onRemove,
}: {
  uid: string;
  n: number;
  row: EntryRow;
  account: Account | undefined;
  options: SelectOption[];
  errors: Partial<Record<string, string>>;
  onPatch: (p: Partial<EntryRow>) => void;
  onAmount: (side: "debit" | "credit", text: string) => void;
  onTidy: (side: "debit" | "credit", text: string) => void;
  onKey: (e: React.KeyboardEvent) => void;
  onRemove: () => void;
}) {
  const id = (f: string) => `${uid}-${r.key}-${f}`;
  const required = requiredDimensions(account?.requires ?? []);
  const optional = DIMENSIONS.map((d) => d.key).filter((d) => !required.includes(d));
  const currency = rowCurrency(r, account);
  const showDetail = required.length > 0 || r.more || Boolean(errors.currency);
  const amountCls = "h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-right text-sm tabular-nums text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";
  const err = (f: string) =>
    errors[f] ? (
      <p id={id(`${f}-err`)} role="alert" className="mt-1 text-xs font-medium text-error-700">
        {errors[f]}
      </p>
    ) : null;

  return (
    <tbody className="border-b border-neutral-100 last:border-b-0">
      <tr className="align-top">
        <td className="py-2.5 pl-4 pr-2 pt-[1.15rem] text-right text-xs font-semibold tabular-nums text-neutral-400">{n}</td>
        <td className="px-2 py-2.5">
          <SearchableSelect
            id={id("account")}
            size="sm"
            value={r.accountId}
            onChange={(v) => onPatch({ accountId: v })}
            options={options}
            placeholder="Choose an account"
            searchPlaceholder="Search code or name"
            aria-label={`Account, line ${n}`}
            aria-invalid={Boolean(errors.accountId) || undefined}
            aria-describedby={errors.accountId ? id("accountId-err") : undefined}
          />
          {err("accountId")}
          {account?.currency && (
            <p className="mt-1 text-xs text-neutral-500">
              Amounts in {account.currency}, converted at the rate recorded for the date.
            </p>
          )}
        </td>
        <td className="px-2 py-2.5">
          <input
            id={id("narration")}
            value={r.narration}
            maxLength={255}
            onChange={(e) => onPatch({ narration: e.target.value })}
            onKeyDown={onKey}
            placeholder="Optional"
            aria-label={`Description, line ${n}`}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
        </td>
        {(["debit", "credit"] as const).map((side) => (
          <td key={side} className="px-2 py-2.5">
            <div className="relative">
              {currency && (
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-neutral-400" aria-hidden>
                  {currency}
                </span>
              )}
              <input
                id={id(side)}
                inputMode="decimal"
                autoComplete="off"
                value={r[side]}
                onChange={(e) => onAmount(side, e.target.value)}
                onBlur={(e) => onTidy(side, e.target.value)}
                onKeyDown={onKey}
                placeholder="0.00"
                aria-label={`${side === "debit" ? "Debit" : "Credit"}${currency ? ` in ${currency}` : ""}, line ${n}`}
                aria-invalid={(side === "debit" && Boolean(errors.debit)) || undefined}
                aria-describedby={side === "debit" && errors.debit ? id("debit-err") : undefined}
                className={cx(amountCls, currency && "pl-10", side === "debit" && errors.debit && "border-error-500")}
              />
            </div>
            {side === "debit" && err("debit")}
          </td>
        ))}
        <td className="py-2.5 pl-2 pr-4">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => onPatch({ more: !r.more })}
              aria-expanded={showDetail}
              aria-controls={id("detail")}
              aria-label={`${r.more ? "Hide" : "Show"} more detail, line ${n}`}
              title="Unit, project, currency…"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              {r.more ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove line ${n}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        </td>
      </tr>
      {showDetail && (
        <tr id={id("detail")}>
          <td />
          <td colSpan={5} className="px-2 pb-3">
            <div className="grid gap-3 rounded-xl bg-neutral-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...required, ...(r.more ? optional : [])].map((d: Dimension) => {
                const isReq = required.includes(d);
                const label = DIMENSIONS.find((x) => x.key === d)!.label;
                return (
                  <div key={d}>
                    <label htmlFor={id(d)} className="mb-1 block text-xs font-medium text-neutral-600">
                      {label}
                      {isReq && (
                        <span className="text-error-700">
                          {" "}
                          *<span className="sr-only"> required</span>
                        </span>
                      )}
                    </label>
                    <DimensionSelect
                      kind={d}
                      id={id(d)}
                      size="sm"
                      value={r[d]}
                      onChange={(v) => onPatch({ [d]: v })}
                      required={isReq}
                      invalid={Boolean(errors[d])}
                      describedBy={errors[d] ? id(`${d}-err`) : undefined}
                    />
                    {err(d)}
                  </div>
                );
              })}
              {r.more && !account?.currency && (
                <div>
                  <label htmlFor={id("currency")} className="mb-1 block text-xs font-medium text-neutral-600">
                    Currency
                  </label>
                  <CurrencySelect
                    id={id("currency")}
                    value={r.currency}
                    onChange={(v) => onPatch({ currency: v })}
                    clearable
                    placeholder="Base currency"
                    invalid={Boolean(errors.currency)}
                    describedBy={errors.currency ? id("currency-err") : undefined}
                  />
                  {err("currency")}
                </div>
              )}
              {!r.more && errors.currency && <div className="sm:col-span-2">{err("currency")}</div>}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}
