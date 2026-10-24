"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Save } from "lucide-react";
import { ledger, type Account } from "@/lib/api/finance-ledger-client";
import { errorText, recurring, type RecurringFrequency, type RecurringJournalDetail, type RecurringLine } from "@/lib/api/finance-recurring-client";
import { Button, Card, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { accounting, amountInput, day as dayLabel } from "@/suite/finance/lib/format";
import { accountOptions } from "../../accounts/meta";
import { BalanceMeter } from "../BalanceMeter";
import { blankRow, errorsByRow, prepare, totals, type EntryRow } from "../entry";
import { JournalLinesGrid } from "../JournalLinesGrid";
import { hasErrors, journalErrors, type JournalErrors } from "../meta";
import { dayKey } from "../../periods/PeriodStrip";
import { FREQUENCY_LABEL, dayOptions, scheduleLabel, upcoming } from "./schedule";

/**
 * Setting up (or changing) a recurring journal: what it is called, what
 * each journal says, the schedule, and the lines - keyed in the same grid
 * as a manual journal and checked by the same ledger rules when saved.
 */

type Ends = "never" | "date" | "count";

/** A template's saved lines back into grid rows, amounts in each line's own currency. */
export function rowsFromTemplate(lines: RecurringLine[], base: string): EntryRow[] {
  return lines.map((l) => {
    const foreign = l.currency && l.currency !== base ? l.currency : "";
    return {
      ...blankRow(),
      accountId: l.account.id,
      debit: amountInput(l.debit),
      credit: amountInput(l.credit),
      narration: l.narration ?? "",
      currency: foreign,
      projectId: l.project?.id ?? "",
      costCentreId: l.costCentre?.id ?? "",
      counterpartyId: l.counterparty?.id ?? "",
      personId: l.person?.id ?? "",
      unitId: l.unitId ?? "",
      more: Boolean(l.unitId || foreign),
    };
  });
}

const FIELD: Record<string, "name" | "schedule" | "ends"> = {
  name: "name",
  frequency: "schedule",
  dayOfMonth: "schedule",
  startDate: "schedule",
  endDate: "ends",
  maxOccurrences: "ends",
};

export default function RecurringJournalEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const uid = useId();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [saved, setSaved] = useState<RecurringJournalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [name, setName] = useState("");
  const [narration, setNarration] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("31");
  const [startDate, setStartDate] = useState(() => dayKey(new Date()));
  const [ends, setEnds] = useState<Ends>("never");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("12");
  const [autoReverse, setAutoReverse] = useState(false);
  const [rows, setRows] = useState<EntryRow[]>(() => [blankRow(), blankRow()]);

  const [errors, setErrors] = useState<JournalErrors>({ lines: {} });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "schedule" | "ends", string>>>({});
  const [rowErrors, setRowErrors] = useState<ReturnType<typeof errorsByRow>>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([ledger.accounts.list({ postableOnly: true }), templateId ? recurring.get(templateId) : Promise.resolve(null)])
      .then(([a, t]) => {
        if (!alive) return;
        setAccounts(a.accounts);
        setLoadError(null);
        if (t) {
          setSaved(t);
          setName(t.name);
          setNarration(t.narration);
          setFrequency(t.frequency);
          setDayOfMonth(String(t.dayOfMonth));
          setStartDate(t.startDate);
          setEnds(t.endDate ? "date" : t.maxOccurrences ? "count" : "never");
          setEndDate(t.endDate ?? "");
          setCount(t.maxOccurrences ? String(t.maxOccurrences) : "12");
          setAutoReverse(t.autoReverse);
          const r = rowsFromTemplate(t.lines, t.baseCurrency);
          setRows(r.length >= 2 ? r : [...r, ...Array.from({ length: 2 - r.length }, blankRow)]);
        }
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e) || "The template didn't load."));
    return () => {
      alive = false;
    };
  }, [templateId, reload]);

  /* Leaving with unsaved changes asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const byId = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const options = useMemo<SelectOption[]>(() => {
    const base = accountOptions(accounts ?? []);
    for (const l of saved?.lines ?? [])
      if (!base.some((o) => o.value === l.account.id)) base.unshift({ value: l.account.id, label: `${l.account.code ?? ""} ${l.account.name ?? ""}`.trim(), hint: "Switched off" });
    return base;
  }, [accounts, saved]);

  const sums = useMemo(() => totals(rows, byId), [rows, byId]);
  const currencies = [...sums.keys()];
  const single = currencies.length <= 1;
  const only = sums.get(currencies[0] ?? "") ?? { debits: 0, credits: 0 };

  // Once it has made a journal, the schedule it was counted on is fixed.
  const scheduleFixed = (saved?.occurrences ?? 0) > 0;
  const schedule = {
    startDate,
    frequency,
    dayOfMonth: Number(dayOfMonth),
    endDate: ends === "date" ? endDate || null : null,
    maxOccurrences: ends === "count" ? Number(count) || null : null,
  };
  const preview = upcoming(schedule, 6, saved?.occurrences ?? 0);

  const touch = () => setDirty(true);
  const set =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      touch();
      fn(v);
    };

  const save = async () => {
    if (!accounts) return;
    const local: typeof fieldErrors = {};
    if (!name.trim()) local.name = "Give the template a name you will recognise in a list.";
    if (!startDate) local.schedule = "Choose the date it starts from.";
    if (ends === "date" && !endDate) local.ends = "Choose the last date, or pick another way for it to end.";
    if (ends === "count" && !(Number(count) >= 1)) local.ends = "At least one occurrence.";
    const { input, errors: lineErrs, sent } = prepare({ date: startDate || "2000-01-01", narration, type: "manual" }, rows, byId);
    setErrors(lineErrs);
    setRowErrors(errorsByRow(lineErrs, sent));
    setFieldErrors(local);
    if (!input || Object.keys(local).length) return;

    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        narration: narration.trim(),
        frequency,
        dayOfMonth: Number(dayOfMonth),
        startDate,
        endDate: ends === "date" ? endDate : null,
        maxOccurrences: ends === "count" ? Number(count) : null,
        autoReverse,
        lines: input.lines,
      };
      const t = templateId
        ? await recurring.update(templateId, scheduleFixed ? { ...body, frequency: undefined, dayOfMonth: undefined, startDate: undefined } : body)
        : await recurring.create(body);
      setDirty(false);
      router.push(`/suite/finance/journals/recurring/${t.id}?notice=${templateId ? "saved" : "created"}`);
    } catch (e) {
      const mapped = journalErrors(e);
      // Fields the journal form does not have: put them beside their own inputs.
      const fe: typeof fieldErrors = {};
      const err = e as { errors?: Record<string, string[]> };
      for (const [k, msgs] of Object.entries(err.errors ?? {})) {
        const f = FIELD[k] ?? FIELD[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
        if (f) fe[f] = String(msgs[0] ?? "");
      }
      if (Object.keys(fe).length) mapped.general = undefined;
      setFieldErrors(fe);
      setErrors(mapped);
      setRowErrors(errorsByRow(mapped, sent));
      setBusy(false);
    }
  };

  const backHref = templateId ? `/suite/finance/journals/recurring/${templateId}` : "/suite/finance/journals/recurring";

  if (loadError)
    return (
      <div>
        <BackLink href={backHref} label="Back" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!accounts) return <Skeleton className="h-[28rem]" />;

  const label = (f: string, text: string) => (
    <label htmlFor={`${uid}-${f}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
      {text}
    </label>
  );
  const fieldError = (f: "name" | "schedule" | "ends") =>
    fieldErrors[f] ? (
      <p id={`${uid}-${f}-err`} role="alert" className="mt-1.5 text-xs font-medium text-error-700">
        {fieldErrors[f]}
      </p>
    ) : null;

  return (
    <div>
      <BackLink href={backHref} label={templateId ? "Back to the template" : "Recurring journals"} />
      <PageHeader
        title={templateId ? `Edit ${saved?.name ?? "recurring journal"}` : "New recurring journal"}
        subtitle="On each date below a journal is made with these lines and sent for approval. A second person posts it: never the software, and never you."
      />

      {errors.general && <ErrorNote className="mb-4">{errors.general}</ErrorNote>}

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {label("name", "Name")}
              <input
                id={`${uid}-name`}
                value={name}
                maxLength={160}
                placeholder="e.g. Office rent - prepayment release"
                onChange={(e) => set(setName)(e.target.value)}
                aria-invalid={Boolean(fieldErrors.name) || undefined}
                aria-describedby={fieldErrors.name ? `${uid}-name-err` : undefined}
                className={cx(inputClass, fieldErrors.name && "border-error-500")}
              />
              {fieldError("name")}
            </div>
            <div>
              {label("narr", "Narration on each journal")}
              <input
                id={`${uid}-narr`}
                value={narration}
                maxLength={400}
                placeholder="e.g. Release of prepaid office rent"
                onChange={(e) => set(setNarration)(e.target.value)}
                aria-invalid={Boolean(errors.narration) || undefined}
                aria-describedby={`${uid}-narr-hint${errors.narration ? ` ${uid}-narr-err` : ""}`}
                className={cx(inputClass, errors.narration && "border-error-500")}
              />
              <p id={`${uid}-narr-hint`} className="mt-1.5 text-xs text-neutral-500">
                The month is added to each one, e.g. “… - October 2026”.
              </p>
              {errors.narration && (
                <p id={`${uid}-narr-err`} role="alert" className="mt-1 text-xs font-medium text-error-700">
                  {errors.narration}
                </p>
              )}
            </div>
          </div>

          <fieldset className="mt-5 border-t border-neutral-100 pt-5" disabled={scheduleFixed}>
            <legend className="sr-only">Schedule</legend>
            <div className="grid gap-4 md:grid-cols-[auto_12rem_11rem]">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-neutral-700">How often</span>
                <div className="flex h-11 items-center">
                  <Segmented
                    label="How often"
                    value={frequency}
                    onChange={set(setFrequency)}
                    options={(Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((k) => ({ key: k, label: FREQUENCY_LABEL[k] }))}
                  />
                </div>
              </div>
              <div>
                <span id={`${uid}-day-label`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                  On the
                </span>
                <SearchableSelect
                  id={`${uid}-day`}
                  aria-labelledby={`${uid}-day-label`}
                  value={dayOfMonth}
                  onChange={set(setDayOfMonth)}
                  options={dayOptions()}
                  searchPlaceholder="Search days"
                  disabled={scheduleFixed}
                />
              </div>
              <div>
                {label("start", "Starting from")}
                <input
                  id={`${uid}-start`}
                  type="date"
                  value={startDate}
                  onChange={(e) => set(setStartDate)(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.schedule) || undefined}
                  aria-describedby={fieldErrors.schedule ? `${uid}-schedule-err` : undefined}
                  className={cx(inputClass, fieldErrors.schedule && "border-error-500")}
                />
              </div>
            </div>
            {fieldError("schedule")}
            {scheduleFixed && (
              <p className="mt-2 text-xs text-neutral-500">
                This template has made {saved?.occurrences} {saved?.occurrences === 1 ? "journal" : "journals"}, so its schedule is fixed. End it and set up a new one to change the schedule.
              </p>
            )}
          </fieldset>

          <div className="mt-6 grid gap-4 border-t border-neutral-100 pt-5 md:grid-cols-[auto_1fr]">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-neutral-700">Ends</span>
              <div className="flex h-11 items-center">
                <Segmented
                  label="When it ends"
                  value={ends}
                  onChange={set(setEnds)}
                  options={[
                    { key: "never", label: "No end" },
                    { key: "date", label: "On a date" },
                    { key: "count", label: "After a number" },
                  ]}
                />
              </div>
            </div>
            <div>
              {ends === "date" && (
                <>
                  {label("end", "Last date")}
                  <input
                    id={`${uid}-end`}
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => set(setEndDate)(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.ends) || undefined}
                    aria-describedby={fieldErrors.ends ? `${uid}-ends-err` : undefined}
                    className={cx(inputClass, "max-w-[11rem]", fieldErrors.ends && "border-error-500")}
                  />
                </>
              )}
              {ends === "count" && (
                <>
                  {label("count", "Number of journals")}
                  <input
                    id={`${uid}-count`}
                    type="number"
                    inputMode="numeric"
                    min={Math.max(1, saved?.occurrences ?? 1)}
                    max={600}
                    value={count}
                    onChange={(e) => set(setCount)(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.ends) || undefined}
                    aria-describedby={fieldErrors.ends ? `${uid}-ends-err` : undefined}
                    className={cx(inputClass, "max-w-[8rem]", fieldErrors.ends && "border-error-500")}
                  />
                </>
              )}
              {fieldError("ends")}
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3.5 hover:bg-neutral-50">
            <input type="checkbox" checked={autoReverse} onChange={(e) => set(setAutoReverse)(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary-600" />
            <span>
              <span className="block text-sm font-medium text-neutral-800">Reverse each journal on the 1st of the next month</span>
              <span className="block text-xs text-neutral-500">For accruals: once posted, each journal is reversed automatically on the first day of the following month.</span>
            </span>
          </label>
        </Card>

        <Panel title="Next dates" subtitle={scheduleLabel(frequency, Number(dayOfMonth))} icon={CalendarClock} hue="sky">
          {preview.length === 0 ? (
            <p className="text-sm text-neutral-500">No dates: the end comes before the first occurrence.</p>
          ) : (
            <ol className="space-y-2 text-sm" aria-label="Next dates a journal is made">
              {preview.map((d, i) => (
                <li key={d} className="flex items-center justify-between gap-3">
                  <span className="tabular-nums text-neutral-800">{dayLabel(d)}</span>
                  <span className="text-xs text-neutral-500">#{(saved?.occurrences ?? 0) + i + 1}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-neutral-500">A date in a locked month waits, and is made once the month is reopened.</p>
        </Panel>
      </div>

      <JournalLinesGrid
        rows={rows}
        onChange={(update) => {
          touch();
          setRows(update);
        }}
        accounts={byId}
        options={options}
        rowErrors={rowErrors}
        caption="Template lines"
      />

      <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-neutral-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {single ? (
            <BalanceMeter debits={only.debits} credits={only.credits} currency={currencies[0] || undefined} />
          ) : (
            <p className="min-w-0 flex-1 text-sm text-neutral-600">
              Lines in {currencies.length} currencies: {currencies.map((c) => `${c || "Base"} Dr ${accounting(sums.get(c)!.debits)} / Cr ${accounting(sums.get(c)!.credits)}`).join(" · ")}. Each journal converts at the rate recorded for its date.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="primary" icon={Save} onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : templateId ? "Save changes" : "Create recurring journal"}
            </Button>
          </div>
        </div>
        {(errors.grid || (hasErrors(errors) && Object.keys(errors.lines).length > 0)) && (
          <p role="alert" className="mt-3 text-sm font-medium text-error-700">
            {errors.grid ?? "Some lines need attention. They are marked above."}
          </p>
        )}
      </div>
    </div>
  );
}
