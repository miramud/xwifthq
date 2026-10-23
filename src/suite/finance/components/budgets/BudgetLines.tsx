"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { FileSignature, Pencil, Plus, RefreshCw, Rows3, SplitSquareHorizontal, Trash2 } from "lucide-react";
import { Button, Card, Chip, Empty, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { accounting, amountInput, compact, monthLabel, parseAmount } from "@/suite/finance/lib/format";
import { familyMeta, familyOf } from "@/suite/finance/components/accounts/meta";
import { pickerText, useProjectOptions } from "@/suite/finance/components/revenue/ui";
import { ledger } from "@/lib/api/finance-ledger-client";
import { ApiError, INCOME_TYPES, PROFIT_AND_LOSS, budgets, errorText, spreadAnnual, type BudgetDetail, type BudgetRow } from "@/lib/api/finance-budgets-client";

/**
 * The budget's lines: one row per account and project or cost centre, twelve
 * months across, totals down and across. Revenue from the contract register
 * is read-only (change the contracts, then refresh). In a draft, a row opens
 * for editing in place and saves on its own; the year's figure can be spread
 * evenly across the months.
 */

export const rowKey = (r: Pick<BudgetRow, "accountId" | "projectId" | "costCentreId" | "source">) => `${r.accountId}|${r.projectId ?? ""}|${r.costCentreId ?? ""}|${r.source}`;
const shortMonth = (m: string) => monthLabel(m, true).split(" ")[0];

export function BudgetLines({
  budget,
  rows,
  canEdit,
  canRefresh,
  onSaved,
}: {
  budget: BudgetDetail;
  /** The rows to show (already filtered). */
  rows: BudgetRow[];
  canEdit: boolean;
  canRefresh: boolean;
  onSaved: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [annual, setAnnual] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const months = budget.months;

  const projectName = useMemo(() => new Map(budget.projects.map((p) => [p.id, p.name])), [budget.projects]);
  const centreName = useMemo(() => new Map(budget.costCentres.map((c) => [c.id, `${c.code} ${c.name}`])), [budget.costCentres]);
  const income = rows.filter((r) => INCOME_TYPES.includes(r.type ?? ""));
  const expense = rows.filter((r) => !INCOME_TYPES.includes(r.type ?? ""));
  const sum = (rs: BudgetRow[], m?: string) => rs.reduce((s, r) => s + (m ? (r.months[m] ?? 0) : r.total), 0);

  const open = (r: BudgetRow) => {
    setEditing(rowKey(r));
    setDraft(Object.fromEntries(months.map((m) => [m, amountInput(r.months[m] ?? 0)])));
    setAnnual(amountInput(r.total));
    setError(null);
  };
  const close = () => {
    setEditing(null);
    setDraft({});
    setError(null);
  };

  const save = async (r: BudgetRow, values: Record<string, number>, message: string) => {
    setBusy(rowKey(r));
    setError(null);
    try {
      await budgets.saveRow(budget.id, { accountId: r.accountId, projectId: r.projectId, costCentreId: r.costCentreId, months: values });
      close();
      onSaved(message);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = (r: BudgetRow) => {
    const values: Record<string, number> = {};
    for (const m of months) {
      const v = draft[m]?.trim() ? parseAmount(draft[m]) : 0;
      if (v === null) {
        setError(`${monthLabel(m)} isn't an amount. Type figures like 250,000.00.`);
        return;
      }
      values[m] = v;
    }
    save(r, values, `${r.code} ${r.name} saved: ${compact(Object.values(values).reduce((a, b) => a + b, 0))} for the year.`);
  };

  const remove = async (r: BudgetRow) => {
    const ok = await confirm({
      title: `Remove ${r.code} ${r.name}${dimension(r) ? ` (${dimension(r)})` : ""}?`,
      body: "All twelve months of this line are cleared from the draft. You can add it again before the budget is sent.",
      confirmLabel: "Remove line",
    });
    if (ok) save(r, Object.fromEntries(months.map((m) => [m, 0])), `${r.code} ${r.name} removed from the draft.`);
  };

  const refresh = async () => {
    const ok = await confirm({
      title: "Refresh revenue from the contract register?",
      body: "Revenue lines are rebuilt from each active contract's milestones due this year. Lines you typed are not touched.",
      confirmLabel: "Refresh revenue",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("refresh");
    setError(null);
    try {
      const r = await budgets.refreshRevenue(budget.id);
      onSaved(`Revenue refreshed from ${r.milestones === 1 ? "1 contract milestone" : `${r.milestones} contract milestones`}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  function dimension(r: BudgetRow): string | null {
    if (r.projectId) return projectName.get(r.projectId) ?? "A project";
    if (r.costCentreId) return centreName.get(r.costCentreId) ?? "A cost centre";
    return null;
  }

  const section = (title: string, rs: BudgetRow[], tone: "mint" | "coral") => (
    <>
      <tr className="bg-neutral-50/70">
        <th scope="rowgroup" colSpan={months.length + 3} className="sticky left-0 py-2 pl-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <span className={cx("mr-2 inline-block h-2 w-2 rounded-full align-middle", tone === "mint" ? "bg-mint-500" : "bg-coral-500")} aria-hidden />
          {title}
        </th>
      </tr>
      {rs.length === 0 && (
        <tr>
          <td colSpan={months.length + 3} className="py-3 pl-5 text-sm text-neutral-500">
            {tone === "mint" ? "No income budgeted." : "No costs budgeted."}
          </td>
        </tr>
      )}
      {rs.map((r) => {
        const key = rowKey(r);
        const isEditing = editing === key;
        const fromContracts = r.source === "contracts";
        const dim = dimension(r);
        return (
          <Fragment key={key}>
            <tr className={cx("border-b border-neutral-100 align-top", isEditing && "bg-primary-50/40")}>
              <th scope="row" className={cx("sticky left-0 z-[1] min-w-[15rem] max-w-[18rem] py-3 pl-5 pr-3 text-left font-normal", isEditing ? "bg-primary-50" : "bg-white")}>
                <span className="block truncate text-sm font-semibold text-neutral-900" title={`${r.code} ${r.name}`}>
                  <span className="font-mono text-[12px] font-normal text-neutral-500">{r.code}</span> {r.name}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  {dim && <span className="truncate text-xs text-neutral-500">{dim}</span>}
                  {fromContracts && (
                    <Chip hue="grape" icon={FileSignature} className="!px-2 !py-0.5 text-[11px]">
                      From the contract register
                    </Chip>
                  )}
                </span>
              </th>
              {months.map((m) =>
                isEditing ? (
                  <td key={m} className="px-1 py-2">
                    <input
                      aria-label={`${r.code} ${r.name}, ${monthLabel(m)}`}
                      inputMode="decimal"
                      value={draft[m] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [m]: e.target.value }))}
                      className="h-9 w-24 rounded-lg border border-neutral-200 bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </td>
                ) : (
                  <td key={m} className={cx("px-2 py-3 text-right text-[13px] tabular-nums", (r.months[m] ?? 0) === 0 ? "text-neutral-400" : "text-neutral-700")}>
                    {accounting(r.months[m] ?? 0, true)}
                  </td>
                ),
              )}
              <td className="px-2 py-3 text-right text-[13px] font-semibold tabular-nums text-neutral-900">
                {isEditing ? accounting(months.reduce((s, m) => s + (parseAmount(draft[m] ?? "") ?? 0), 0)) : accounting(r.total)}
              </td>
              <td className="py-2 pl-2 pr-5 text-right">
                {canEdit && !fromContracts && !isEditing && (
                  <span className="inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => open(r)}
                      disabled={editing !== null}
                      aria-label={`Edit ${r.code} ${r.name}${dim ? `, ${dim}` : ""}`}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Pencil size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={editing !== null || busy !== null}
                      aria-label={`Remove ${r.code} ${r.name}${dim ? `, ${dim}` : ""}`}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-50 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </span>
                )}
              </td>
            </tr>
            {isEditing && (
              <tr className="border-b border-neutral-100 bg-primary-50/40">
                <td colSpan={months.length + 3} className="px-5 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">The year</span>
                        <input inputMode="decimal" value={annual} onChange={(e) => setAnnual(e.target.value)} className="h-9 w-40 rounded-lg border border-neutral-200 bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                      </label>
                      <Button
                        size="sm"
                        icon={SplitSquareHorizontal}
                        onClick={() => {
                          const v = parseAmount(annual);
                          if (v === null) {
                            setError("Type the year's amount, like 1,200,000.00, to spread it.");
                            return;
                          }
                          setError(null);
                          const s = spreadAnnual(v, months);
                          setDraft(Object.fromEntries(months.map((m) => [m, amountInput(s[m])])));
                        }}
                      >
                        Spread evenly
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={close} disabled={busy !== null}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => saveEdit(r)} disabled={busy !== null}>
                        {busy === key ? "Saving…" : "Save line"}
                      </Button>
                    </div>
                  </div>
                  {error && <p role="alert" className="mt-2 text-sm font-medium text-error-700">{error}</p>}
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {rs.length > 0 && (
        <tr className="border-b border-neutral-200 font-semibold text-neutral-900">
          <th scope="row" className="sticky left-0 z-[1] bg-white py-2.5 pl-5 pr-3 text-left text-sm">
            Total {title.toLowerCase()}
          </th>
          {months.map((m) => (
            <td key={m} className="px-2 py-2.5 text-right text-[13px] tabular-nums">
              {accounting(sum(rs, m), true)}
            </td>
          ))}
          <td className="px-2 py-2.5 text-right text-[13px] tabular-nums">{accounting(sum(rs))}</td>
          <td />
        </tr>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">
          {canEdit
            ? "Edit a line in place; each saves on its own. Revenue on contract accounts comes from the contract register."
            : budget.status === "draft"
              ? "This draft is read-only for you."
              : "Only a draft changes. To change an approved budget, start a revision."}
        </p>
        {(canEdit || canRefresh) && (
          <div className="flex flex-wrap gap-2">
            {canRefresh && (
              <Button icon={RefreshCw} onClick={refresh} disabled={busy !== null || editing !== null}>
                {busy === "refresh" ? "Refreshing…" : "Refresh revenue"}
              </Button>
            )}
            {canEdit && (
              <Button icon={Plus} onClick={() => setAdding(true)} disabled={editing !== null}>
                Add a line
              </Button>
            )}
          </div>
        )}
      </div>
      {error && editing === null && <ErrorNote>{error}</ErrorNote>}

      {budget.rows.length === 0 ? (
        <Card>
          <Empty
            icon={Rows3}
            title="No lines yet"
            hint={canEdit ? "Add a line for each income or cost account, by project or cost centre. Contract revenue arrives when you refresh it." : "Nothing is budgeted in this version."}
            action={
              canEdit ? (
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add a line
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <caption className="sr-only">Budget lines by month, FY{budget.fiscalYear}</caption>
              <thead>
                <tr className="border-b border-neutral-100 text-xs font-semibold text-neutral-500">
                  <th scope="col" className="sticky left-0 z-[1] bg-white py-3 pl-5 pr-3 text-left uppercase tracking-wide">
                    Line
                  </th>
                  {months.map((m) => (
                    <th key={m} scope="col" className="px-2 py-3 text-right">
                      <abbr title={monthLabel(m)} className="no-underline">
                        {shortMonth(m)}
                      </abbr>
                      <span className="block text-[10px] font-medium text-neutral-400">{m.slice(0, 4)}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-3 text-right uppercase tracking-wide">
                    Year
                  </th>
                  <th scope="col" className="py-3 pl-2 pr-5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {section("Income", income, "mint")}
                {section("Expense", expense, "coral")}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 font-bold text-neutral-900">
                  <th scope="row" className="sticky left-0 z-[1] bg-neutral-50 py-3 pl-5 pr-3 text-left">
                    Net
                  </th>
                  {months.map((m) => {
                    const v = sum(income, m) - sum(expense, m);
                    return (
                      <td key={m} className={cx("px-2 py-3 text-right text-[13px] tabular-nums", v < 0 && "text-error-700")}>
                        {accounting(v, true)}
                      </td>
                    );
                  })}
                  <td className={cx("px-2 py-3 text-right text-[13px] tabular-nums", sum(income) - sum(expense) < 0 && "text-error-700")}>{accounting(sum(income) - sum(expense))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length < budget.rows.length && <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">Showing the lines for the chosen project or cost centre. Clear the filter to see every line.</p>}
        </Card>
      )}

      {adding && (
        <AddLineDialog
          budget={budget}
          onClose={() => setAdding(false)}
          onDone={(m) => {
            setAdding(false);
            onSaved(m);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add a line                                                         */
/* ------------------------------------------------------------------ */

type Dim = "none" | "cost_centre" | "project";

function AddLineDialog({ budget, onClose, onDone }: { budget: BudgetDetail; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const projects = useProjectOptions();
  const [accounts, setAccounts] = useState<SelectOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [dim, setDim] = useState<Dim>("cost_centre");
  const [costCentreId, setCostCentreId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [annual, setAnnual] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    ledger.accounts.list({ postableOnly: true }).then(
      (r) => {
        if (!alive) return;
        setAccounts(
          r.accounts
            .filter((a) => a.isPostable && a.active && PROFIT_AND_LOSS.includes(a.type))
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
            .map((a) => ({ value: a.id, label: `${a.code} ${a.name}`, group: familyMeta(familyOf(a.type)).label })),
        );
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  const centres = budget.costCentres.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }));
  const amount = parseAmount(annual);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!accountId) local.accountId = "Choose the income or expense account.";
    if (dim === "cost_centre" && !costCentreId) local.costCentreId = "Choose the cost centre.";
    if (dim === "project" && !projectId) local.projectId = "Choose the project.";
    if (amount === null || amount <= 0) local.annual = "Type the year's amount, like 1,200,000.00. It is spread over the twelve months; change any month after.";
    const p = dim === "project" ? projectId : null;
    const c = dim === "cost_centre" ? costCentreId : null;
    if (!Object.keys(local).length && budget.rows.some((r) => r.source === "manual" && r.accountId === accountId && (r.projectId ?? null) === p && (r.costCentreId ?? null) === c))
      local.accountId = "That account already has a line for this cost centre or project. Edit it in the grid instead.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await budgets.saveRow(budget.id, { accountId, projectId: p, costCentreId: c, months: spreadAnnual(amount!, budget.months) });
      const label = accounts?.find((a) => a.value === accountId)?.label ?? "Line";
      onDone(`${label} added: ${compact(amount!)} for the year, spread evenly.`);
    } catch (e) {
      if (e instanceof ApiError && e.errors) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.errors)) {
          const first = Array.isArray(v) ? v[0] : v;
          if (typeof first === "string") out[k === "months" || k === "budget" ? "general" : k] = first;
        }
        setErrors(Object.keys(out).length ? out : { general: errorText(e) });
      } else setErrors({ general: errorText(e) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Add a budget line"
      subtitle="An income or cost account for a cost centre or a project, with the year's amount. Contract revenue comes from the contract register instead."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Adding…" : "Add line"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field id={`${uid}-acc`} label="Account">
          <SearchableSelect
            id={`${uid}-acc`}
            value={accountId}
            onChange={setAccountId}
            options={accounts ?? []}
            placeholder={accounts ? "Choose an account" : failed ? "Accounts didn't load" : "Loading accounts…"}
            searchPlaceholder="Search by code or name"
            noOptionsText={failed ? "The chart of accounts didn't load. Close and try again." : "Loading accounts…"}
            aria-invalid={errors.accountId ? true : undefined}
          />
          <FieldError message={errors.accountId} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">For</p>
          <Segmented<Dim>
            label="What the line is for"
            value={dim}
            onChange={setDim}
            options={[
              { key: "cost_centre", label: "A cost centre" },
              { key: "project", label: "A project" },
              { key: "none", label: "The whole company" },
            ]}
          />
        </div>
        {dim === "cost_centre" && (
          <Field id={`${uid}-cc`} label="Cost centre">
            <SearchableSelect
              id={`${uid}-cc`}
              value={costCentreId}
              onChange={setCostCentreId}
              options={centres}
              placeholder="Choose a cost centre"
              searchPlaceholder="Search cost centres"
              noOptionsText="No cost centres yet. Add them in the organisation settings."
              aria-invalid={errors.costCentreId ? true : undefined}
            />
            <FieldError message={errors.costCentreId} />
          </Field>
        )}
        {dim === "project" && (
          <Field id={`${uid}-pr`} label="Project">
            <SearchableSelect
              id={`${uid}-pr`}
              value={projectId}
              onChange={setProjectId}
              options={projects.items}
              placeholder="Choose a project"
              searchPlaceholder="Search projects"
              noOptionsText={pickerText(projects, "projects")}
              aria-invalid={errors.projectId ? true : undefined}
            />
            <FieldError message={errors.projectId} />
          </Field>
        )}
        <Field id={`${uid}-amt`} label="The year's amount" hint={amount && amount > 0 ? `About ${compact(Math.round(amount / 12))} a month` : "Spread evenly"}>
          <input id={`${uid}-amt`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={annual} onChange={(e) => setAnnual(e.target.value)} aria-invalid={errors.annual ? true : undefined} placeholder="0.00" />
          <FieldError message={errors.annual} />
        </Field>
        {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      </div>
    </DialogFrame>
  );
}
