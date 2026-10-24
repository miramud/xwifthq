"use client";

import { useId, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Percent, Plus, Repeat, Trash2 } from "lucide-react";
import { Button, Chip, Empty, Panel, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amountInput, day, parseAmount } from "@/suite/finance/lib/format";
import { ApiError, cashForecast, errorText, type CashForecast, type Frequency, type RecurringInput, type RecurringItem } from "@/lib/api/finance-budgets-client";
import { FREQUENCY } from "./meta";

/* The two things Finance types into the forecast: recurring items, and the two collection probabilities. */

/* ------------------------------------------------------------------ */
/*  Recurring items                                                    */
/* ------------------------------------------------------------------ */

export function RecurringPanel({
  items,
  can,
  onChanged,
}: {
  items: RecurringItem[];
  can: { create: boolean; update: boolean; remove: boolean };
  onChanged: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<RecurringItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (r: RecurringItem) => {
    const ok = await confirm({
      title: `Remove ${r.name}?`,
      body: "It comes out of the forecast from now on. To pause it instead, edit it and switch it off.",
      confirmLabel: "Remove item",
    });
    if (!ok) return;
    setBusy(r.id);
    setError(null);
    try {
      await cashForecast.removeItem(r.id);
      onChanged(`${r.name} removed from the forecast.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Recurring items"
      subtitle="Rent, subscriptions, loan repayments: what the books can't see coming"
      icon={Repeat}
      hue="slate"
      actions={
        can.create && (
          <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
            Add item
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <Empty icon={Repeat} hue="slate" title="No recurring items" hint="Add the regular payments and receipts the ledger doesn't know about yet, so the forecast counts them." />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((r) => (
            <li key={r.id} className={cx("flex items-center gap-3 py-3 first:pt-0 last:pb-0", !r.active && "opacity-60")}>
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", r.direction === "in" ? "bg-mint-50 text-mint-700" : "bg-coral-50 text-coral-700")}>
                {r.direction === "in" ? <ArrowDownLeft size={17} aria-hidden /> : <ArrowUpRight size={17} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{r.name}</p>
                <p className="text-xs text-neutral-500">
                  {FREQUENCY[r.frequency] ?? r.frequency} · next {day(r.nextOn)}
                  {!r.active && " · switched off"}
                </p>
              </div>
              <div className="text-right">
                <Money value={r.direction === "in" ? r.amount : -r.amount} signed className="text-sm font-semibold" />
                <span className="sr-only">{r.direction === "in" ? " in" : " out"}</span>
              </div>
              {(can.update || can.remove) && (
                <span className="flex shrink-0 gap-0.5">
                  {can.update && (
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      aria-label={`Edit ${r.name}`}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <Pencil size={15} aria-hidden />
                    </button>
                  )}
                  {can.remove && (
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busy !== null}
                      aria-label={`Remove ${r.name}`}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-50 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-40"
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
      {editing && (
        <RecurringDialog
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            setEditing(null);
            onChanged(m);
          }}
        />
      )}
    </Panel>
  );
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function RecurringDialog({ item, onClose, onDone }: { item: RecurringItem | null; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [direction, setDirection] = useState<"in" | "out">(item?.direction ?? "out");
  const [amount, setAmount] = useState(amountInput(item?.amount));
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "monthly");
  const [nextOn, setNextOn] = useState(item?.nextOn?.slice(0, 10) ?? todayIso());
  const [active, setActive] = useState(item?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const a = parseAmount(amount);
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Name it: Office rent, say.";
    if (a === null || a <= 0) local.amount = "Type the amount each time, like 2,500,000.00.";
    if (!nextOn) local.nextOn = "Choose when it next falls.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: RecurringInput = { name: name.trim(), direction, amount: a!, frequency, nextOn, active };
    setBusy(true);
    setErrors({});
    try {
      if (item) await cashForecast.updateItem(item.id, input);
      else await cashForecast.addItem(input);
      onDone(item ? `${input.name} saved.` : `${input.name} added to the forecast.`);
    } catch (e) {
      const out: Record<string, string> = {};
      if (e instanceof ApiError && e.errors)
        for (const [k, v] of Object.entries(e.errors)) {
          const first = Array.isArray(v) ? v[0] : v;
          if (typeof first === "string") out[k] = first;
        }
      setErrors(Object.keys(out).length ? out : { general: errorText(e) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={item ? `Edit ${item.name}` : "Add a recurring item"}
      subtitle="A regular payment or receipt the forecast should count. It repeats from the next date until you switch it off."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : item ? "Save item" : "Add item"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Direction</p>
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { key: "out", label: "Money out" },
              { key: "in", label: "Money in" },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${uid}-amt`} label="Amount each time">
            <input id={`${uid}-amt`} inputMode="decimal" className={cx(inputClass, "text-right tabular-nums")} value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={errors.amount ? true : undefined} placeholder="0.00" />
            <FieldError message={errors.amount} />
          </Field>
          <Field id={`${uid}-freq`} label="How often">
            <SearchableSelect
              id={`${uid}-freq`}
              value={frequency}
              onChange={(v) => setFrequency(v as Frequency)}
              options={(Object.keys(FREQUENCY) as Frequency[]).map((f) => ({ value: f, label: FREQUENCY[f] }))}
              searchPlaceholder="Search"
            />
          </Field>
        </div>
        <Field id={`${uid}-next`} label="Next falls on">
          <input id={`${uid}-next`} type="date" className={inputClass} value={nextOn} onChange={(e) => setNextOn(e.target.value)} aria-invalid={errors.nextOn ? true : undefined} />
          <FieldError message={errors.nextOn} />
        </Field>
        {item && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-neutral-800">Count it in the forecast</p>
              <p className="text-xs text-neutral-500">Switch off to pause without removing it.</p>
            </div>
            <Switch checked={active} onChange={setActive} label="Count it in the forecast" />
          </div>
        )}
        {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      </div>
    </DialogFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Probabilities                                                      */
/* ------------------------------------------------------------------ */

export function SettingsPanel({ settings, canUpdate, onChanged }: { settings: CashForecast["settings"]; canUpdate: boolean; onChanged: (message: string) => void }) {
  const uid = useId();
  const [overdue, setOverdue] = useState(settings.overdueCollectionPct);
  const [pipeline, setPipeline] = useState(settings.pipelinePct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = overdue !== settings.overdueCollectionPct || pipeline !== settings.pipelinePct;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await cashForecast.updateSettings({ overdueCollectionPct: overdue, pipelinePct: pipeline });
      onChanged(`The forecast now expects ${overdue}% of overdue invoices and ${pipeline}% of the contract pipeline.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const slider = (id: string, label: string, help: string, value: number, set: (v: number) => void) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
        <span className="flex items-center gap-1">
          <input
            aria-label={`${label}, percent`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={!canUpdate}
            onChange={(e) => set(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))}
            className="h-9 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
          />
          <span className="text-sm text-neutral-500">%</span>
        </span>
      </div>
      <input id={id} type="range" min={0} max={100} step={5} value={value} disabled={!canUpdate} onChange={(e) => set(Number(e.target.value))} className="w-full cursor-pointer accent-primary-600 disabled:cursor-not-allowed" />
      <p className="mt-1 text-xs text-neutral-500">{help}</p>
    </div>
  );

  return (
    <Panel title="Collection probabilities" subtitle="The only two guesses in the forecast" icon={Percent} hue="sky">
      <div className="space-y-6">
        {slider(`${uid}-o`, "Overdue invoices collected", "How much of an invoice already past its due date is expected this week.", overdue, setOverdue)}
        {slider(`${uid}-p`, "Contract pipeline collected", "How much of a milestone not yet invoiced is expected, about 30 days after it falls due.", pipeline, setPipeline)}
        {canUpdate ? (
          <div className="flex items-center justify-end gap-2">
            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOverdue(settings.overdueCollectionPct);
                  setPipeline(settings.pipelinePct);
                }}
              >
                Undo
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={!dirty || busy}>
              {busy ? "Saving…" : "Save and recalculate"}
            </Button>
          </div>
        ) : (
          <Chip hue="slate">Set by Finance</Chip>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
  );
}
