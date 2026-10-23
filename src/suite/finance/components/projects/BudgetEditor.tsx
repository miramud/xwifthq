"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { fieldMessages, plainError, spend, type ProjectFundsDetail } from "@/lib/api/finance-payments-client";
import { Button, Card, cx } from "@/components/workspace/kit";
import { ErrorNote, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { accounting, amount, monthLabel, parseAmount } from "@/suite/finance/lib/format";
import { COST_CATEGORIES, addMonths, monthRange, monthStart, thisMonth } from "./meta";
import { pct } from "../vouchers/meta";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Drafting a project budget: cost categories down the side, months across,
 * an amount in each cell. Row totals, month totals and the budget at
 * completion (BAC) update as you type, beside the contract value and the
 * margin they leave. A project that already has an approved budget is being
 * rebaselined, and that needs a reason. Arrow keys move between cells.
 */

type Grid = Record<string, Record<string, string>>;

/** "15", "-2.5", "12%" → basis points; null when it isn't a margin. */
function marginBp(text: string): number | null {
  const t = text.replace(/[%\s]/g, "");
  if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return Math.abs(bp) <= 10_000 ? bp : null;
}

export default function BudgetEditor({ project, onClose, onSaved }: { project: ProjectFundsDetail; onClose: () => void; onSaved: (message: string) => void }) {
  const uid = useId();
  const catalogue = Object.keys(project.categories_catalogue ?? {}).length ? project.categories_catalogue : COST_CATEGORIES;
  const current = project.budget;
  const rebaseline = current !== null;

  const initialMonths = useMemo(() => {
    const ms = (current?.lines ?? []).map((l) => l.month).sort();
    if (ms.length) return { from: ms[0], to: ms[ms.length - 1] };
    const from = thisMonth();
    return { from, to: addMonths(from, 5) };
  }, [current]);

  const [from, setFrom] = useState(initialMonths.from);
  const [to, setTo] = useState(initialMonths.to);
  const [cats, setCats] = useState<string[]>(() => {
    const used = [...new Set((current?.lines ?? []).map((l) => l.category))];
    return used.length ? used : ["labour", "hardware", "licences", "travel"].filter((c) => c in catalogue);
  });
  const [grid, setGrid] = useState<Grid>(() => {
    const g: Grid = {};
    for (const l of current?.lines ?? []) {
      g[l.category] = { ...g[l.category], [l.month]: accounting(l.amount) };
    }
    return g;
  });
  const [contract, setContract] = useState(current ? accounting(current.contractValue) : project.contractValue ? accounting(project.contractValue) : "");
  const [margin, setMargin] = useState(current?.targetMarginBp != null ? pct(current.targetMarginBp).replace("%", "") : "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "send" | null>(null);

  const months = monthRange(from, to);
  const cell = (c: string, m: string) => parseAmount(grid[c]?.[m] ?? "") ?? 0;
  const rowTotal = (c: string) => months.reduce((s, m) => s + cell(c, m), 0);
  const colTotal = (m: string) => cats.reduce((s, c) => s + cell(c, m), 0);
  const bac = cats.reduce((s, c) => s + rowTotal(c), 0);
  const contractValue = parseAmount(contract) ?? 0;
  const impliedBp = contractValue > 0 ? Math.round(((contractValue - bac) * 10_000) / contractValue) : null;

  const set = (c: string, m: string, v: string) => setGrid((g) => ({ ...g, [c]: { ...g[c], [m]: v } }));
  const tidy = (c: string, m: string) => {
    const v = parseAmount(grid[c]?.[m] ?? "");
    if (v !== null) set(c, m, v === 0 ? "" : accounting(v));
  };
  const spare = Object.keys(catalogue).filter((c) => !cats.includes(c));

  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, ci: number, mi: number) => {
    const go = (r: number, k: number) => document.getElementById(`${uid}-${r}-${k}`)?.focus();
    if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) go(ci, mi + 1);
    else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) go(ci, mi - 1);
    else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      go(ci + 1, mi);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      go(ci - 1, mi);
    }
  };

  const save = async (send: boolean) => {
    const errs: Record<string, string> = {};
    if (parseAmount(contract) === null) errs.contractValue = "Enter the contract value, like 420,000,000.00.";
    if (margin.trim() && marginBp(margin) === null) errs.targetMarginBp = "Enter the margin as a percentage, like 15.";
    if (rebaseline && !reason.trim()) errs.reason = "Say why the project is being rebaselined.";
    const lines = cats.flatMap((c) => months.map((m) => ({ category: c, month: monthStart(m), amount: cell(c, m) })).filter((l) => l.amount > 0));
    if (lines.length === 0) errs.lines = "Put an amount in at least one month.";
    if (months.length === 0) errs.lines = "The last month comes after the first.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(send ? "send" : "save");
    try {
      const b = await spend.funds.draftBudget(project.id, { contractValue, currency: "NGN", targetMarginBp: margin.trim() ? marginBp(margin) : null, reason: rebaseline ? reason.trim() : null, lines });
      if (send) {
        try {
          const r = await spend.funds.submitBudget(b.id);
          onSaved(r.status === "approved" ? `Budget v${b.version} approved. It now sets the project's fund control.` : `Budget v${b.version} sent for approval.`);
        } catch (e) {
          onSaved(`Budget v${b.version} saved as a draft, not sent: ${plainError(e)}`);
        }
      } else onSaved(`Budget v${b.version} saved as a draft.`);
    } catch (e) {
      const f = fieldMessages(e);
      setErrors({ ...f, general: Object.keys(f).length ? "" : plainError(e, "The budget wasn't saved.") });
      setBusy(null);
    }
  };

  const cellCls =
    "h-9 w-full min-w-[6.5rem] rounded-lg border border-neutral-200 bg-white px-2 text-right text-[13px] tabular-nums text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";

  return (
    <section aria-labelledby={`${uid}-title`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{project.name}</p>
          <h1 id={`${uid}-title`} className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
            {rebaseline ? `Rebaseline the budget (v${current!.version} is approved)` : "Draft the budget"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Each category by month. The total is the budget at completion; it controls what can be released.</p>
        </div>
        <Button icon={X} onClick={onClose}>
          Close without saving
        </Button>
      </div>

      {errors.general && <ErrorNote className="mb-4">{errors.general}</ErrorNote>}

      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor={`${uid}-cv`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Contract value (₦)
            </label>
            <input
              id={`${uid}-cv`}
              inputMode="decimal"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              onBlur={() => {
                const v = parseAmount(contract);
                if (v !== null) setContract(accounting(v));
              }}
              aria-invalid={Boolean(errors.contractValue) || undefined}
              className={cx(inputClass, "text-right tabular-nums")}
            />
            <FieldError message={errors.contractValue} />
          </div>
          <div>
            <label htmlFor={`${uid}-mg`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Target margin (%)
            </label>
            <input
              id={`${uid}-mg`}
              inputMode="decimal"
              value={margin}
              placeholder={impliedBp != null ? pct(impliedBp).replace("%", "") : ""}
              onChange={(e) => setMargin(e.target.value)}
              aria-describedby={`${uid}-mg-hint`}
              aria-invalid={Boolean(errors.targetMarginBp) || undefined}
              className={cx(inputClass, "text-right tabular-nums")}
            />
            {errors.targetMarginBp ? (
              <FieldError message={errors.targetMarginBp} />
            ) : (
              <p id={`${uid}-mg-hint`} className="mt-1.5 text-xs text-neutral-500">
                Leave empty to use what the budget leaves: {impliedBp != null ? pct(impliedBp) : "-"}.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${uid}-from`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              First month
            </label>
            <input id={`${uid}-from`} type="month" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${uid}-to`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Last month
            </label>
            <input id={`${uid}-to`} type="month" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={inputClass} />
          </div>
        </div>
        {rebaseline && (
          <div className="mt-4">
            <label htmlFor={`${uid}-why`} className="mb-1.5 block text-sm font-medium text-neutral-700">
              Why the project is being rebaselined <span className="text-error-700">*</span>
            </label>
            <RichTextEditor
              id={`${uid}-why`}
              minHeight={72}
              value={reason}
              onChange={setReason}
              placeholder="e.g. Client added the mobile app to the scope in a variation order"
              invalid={Boolean(errors.reason)}
            />
            <FieldError message={errors.reason} />
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 260 + months.length * 120 }}>
            <caption className="sr-only">Budget by category and month</caption>
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/70 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th scope="col" className="sticky left-0 z-[1] bg-neutral-50 py-3 pl-4 pr-2 text-left">
                  Category
                </th>
                {months.map((m) => (
                  <th key={m} scope="col" className="px-1.5 py-3 text-right">
                    {monthLabel(m, true)}
                  </th>
                ))}
                <th scope="col" className="py-3 pl-2 pr-4 text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c, ci) => (
                <tr key={c} className="border-b border-neutral-100">
                  <th scope="row" className="sticky left-0 z-[1] bg-white py-2 pl-4 pr-2 text-left font-medium text-neutral-900">
                    <span className="flex items-center justify-between gap-2">
                      {catalogue[c] ?? c}
                      <button
                        type="button"
                        onClick={() => setCats((cs) => cs.filter((x) => x !== c))}
                        aria-label={`Remove ${catalogue[c] ?? c}`}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </span>
                  </th>
                  {months.map((m, mi) => (
                    <td key={m} className="px-1.5 py-2">
                      <input
                        id={`${uid}-${ci}-${mi}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={grid[c]?.[m] ?? ""}
                        onChange={(e) => set(c, m, e.target.value)}
                        onBlur={() => tidy(c, m)}
                        onKeyDown={(e) => onCellKey(e, ci, mi)}
                        placeholder="0.00"
                        aria-label={`${catalogue[c] ?? c}, ${monthLabel(m)}`}
                        className={cx(cellCls, (grid[c]?.[m] ?? "").trim() && parseAmount(grid[c][m]) === null && "border-error-500")}
                      />
                    </td>
                  ))}
                  <td className="py-2 pl-2 pr-4 text-right font-semibold tabular-nums text-neutral-900">{accounting(rowTotal(c))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50/70 font-semibold">
                <th scope="row" className="sticky left-0 z-[1] bg-neutral-50 py-3 pl-4 pr-2 text-left text-neutral-900">
                  Month total
                </th>
                {months.map((m) => (
                  <td key={m} className="px-1.5 py-3 text-right tabular-nums text-neutral-700">
                    {accounting(colTotal(m), true)}
                  </td>
                ))}
                <td className="py-3 pl-2 pr-4 text-right tabular-nums text-neutral-900">{accounting(bac)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {spare.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3">
            <span className="text-xs text-neutral-500">Add a category:</span>
            {spare.map((c) => (
              <Button key={c} size="sm" variant="ghost" icon={Plus} onClick={() => setCats((cs) => [...cs, c])}>
                {catalogue[c]}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-neutral-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <dl className="flex flex-wrap gap-x-8 gap-y-2" aria-live="polite">
            <div>
              <dt className="text-xs text-neutral-500">Budget at completion</dt>
              <dd className="text-lg font-bold tabular-nums text-neutral-900">{amount(bac)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Contract value</dt>
              <dd className="text-lg font-bold tabular-nums text-neutral-900">{amount(contractValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Margin it leaves</dt>
              <dd className={cx("text-lg font-bold tabular-nums", impliedBp != null && impliedBp < 0 ? "text-rose-700" : "text-neutral-900")}>
                {impliedBp != null ? `${pct(impliedBp)} · ${amount(contractValue - bac)}` : "-"}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(false)} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
            <Button variant="primary" icon={Send} onClick={() => save(true)} disabled={busy !== null}>
              {busy === "send" ? "Sending…" : "Send for approval"}
            </Button>
          </div>
        </div>
        {errors.lines && (
          <p role="alert" className="mt-3 text-sm font-medium text-error-700">
            {errors.lines}
          </p>
        )}
        {project.drafts.some((d) => d.status === "draft") && (
          <p className="mt-2 text-xs text-neutral-500">Saving replaces the draft already on this project; a budget awaiting approval is not affected.</p>
        )}
      </div>
    </section>
  );
}
