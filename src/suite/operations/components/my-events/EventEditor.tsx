"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Calculator, ListOrdered, Plus, Save, Trash2, Wallet } from "lucide-react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { BackLink, ErrorNote, Field, FormActions, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount } from "@/suite/finance/lib/format";
import { ApiError, events, opsError, opsFieldErrors, travel, type EventFull, type EventInput, type OpsOptions } from "@/lib/api/operations-travel-client";
import { ChargeTo, MoneyInput, optionsFrom, type Funding } from "../travel/shared";
import { eventBudget } from "../events/budget";
import BudgetTotals from "./BudgetTotals";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * A new event, or a draft being finished: what and when, who pays, who
 * comes, and the budget line by line, with the total and the contingency
 * cap worked out as it is typed. Sending it for approval happens on its page.
 */

interface LineRow {
  key: number;
  category: string;
  description: string;
  amount: number | null;
}

interface Form {
  name: string;
  type: string;
  funding: Funding;
  projectId: string;
  costCentreId: string;
  startsOn: string;
  endsOn: string;
  location: string;
  participantsInternal: string;
  participantsExternal: string;
  objectives: string;
  lines: LineRow[];
}

let rowKey = 0;
const next = () => ++rowKey;

const blankLine = (category = ""): LineRow => ({ key: next(), category, description: "", amount: null });

export default function EventEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("id");

  const [options, setOptions] = useState<OpsOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<EventFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftReload, setDraftReload] = useState(0);
  const [form, setForm] = useState<Form>(() => ({
    name: "",
    type: "",
    funding: "project",
    projectId: "",
    costCentreId: "",
    startsOn: "",
    endsOn: "",
    location: "",
    participantsInternal: "",
    participantsExternal: "",
    objectives: "",
    lines: [blankLine("venue"), blankLine("meals")],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    travel.options().then(
      (o) => {
        if (!alive) return;
        setOptions(o);
        setOptionsError(null);
      },
      (e: unknown) => alive && setOptionsError(`The event types and pickers didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!draftId) return;
    let alive = true;
    events.me.get(draftId).then(
      (ev) => {
        if (!alive) return;
        setDraft(ev);
        setLoadError(null);
        setForm({
          name: ev.name,
          type: ev.type,
          funding: ev.project ? "project" : "costCentre",
          projectId: ev.project?.id ?? "",
          costCentreId: ev.costCentreId ?? "",
          startsOn: ev.startsOn,
          endsOn: ev.endsOn,
          location: ev.location ?? "",
          participantsInternal: String(ev.participantsInternal ?? ""),
          participantsExternal: String(ev.participantsExternal ?? ""),
          objectives: ev.objectives ?? "",
          lines: ev.lines.map((l) => ({ key: next(), category: l.category, description: l.description, amount: l.amount })),
        });
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This event wasn't found among yours." : `This event didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [draftId, draftReload]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (key: number, patch: Partial<LineRow>) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const summary = useMemo(() => eventBudget(form.lines), [form.lines]);
  const categories = useMemo(() => optionsFrom(options?.eventCategories), [options]);
  const types = useMemo(() => optionsFrom(options?.eventTypes), [options]);

  const count = (s: string) => (s.trim() === "" ? 0 : Number(s));

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Give the event a name.";
    if (!form.type) e.type = "Choose the kind of event.";
    if (!form.startsOn) e.startsOn = "Choose the first day.";
    if (!form.endsOn) e.endsOn = "Choose the last day.";
    else if (form.startsOn && form.endsOn < form.startsOn) e.endsOn = "The last day is on or after the first.";
    if (form.funding === "project" ? !form.projectId : !form.costCentreId) e.projectId = "Every event is for a project or a cost centre.";
    for (const k of ["participantsInternal", "participantsExternal"] as const) {
      const n = count(form[k]);
      if (!Number.isInteger(n) || n < 0) e[k] = "A whole number, 0 or more.";
    }
    if (form.lines.length === 0) e.lines = "Add the budget lines.";
    form.lines.forEach((l, i) => {
      if (!l.category) e[`lines.${i}.category`] = "Choose a budget category.";
      if (l.amount === null) e[`lines.${i}.amount`] = "Enter the amount.";
    });
    if (summary.overCap) e.lines = `Contingency is capped at 10% of the other lines: ${amount(summary.cap)} at most.`;
    return e;
  };

  const save = async () => {
    const found = validate();
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length > 0) {
      setSaveError("Some details need fixing. They are marked below.");
      return;
    }
    const input: EventInput = {
      name: form.name.trim(),
      type: form.type,
      projectId: form.funding === "project" ? form.projectId : null,
      costCentreId: form.funding === "costCentre" ? form.costCentreId : null,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      location: form.location.trim() || null,
      participantsInternal: count(form.participantsInternal),
      participantsExternal: count(form.participantsExternal),
      objectives: form.objectives.trim() || null,
      lines: form.lines.map((l) => ({ category: l.category, ...(l.description.trim() ? { description: l.description.trim() } : {}), amount: l.amount ?? 0 })),
    };
    setSaving(true);
    try {
      const ev = draftId ? await events.me.update(draftId, input) : await events.me.create(input);
      router.push(`/suite/operations/my/events/${ev.id}`);
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setSaveError(`The event wasn't saved. ${opsError(e)}`);
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/operations/my/events" label="My events" />
        <LoadError
          text={loadError}
          onRetry={() => {
            setLoadError(null);
            setDraftReload((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (draftId && draft && draft.status !== "draft") {
    return (
      <div>
        <BackLink href={`/suite/operations/my/events/${draft.id}`} label="Back to the event" />
        <ErrorNote>This event has been sent, so its budget can no longer be edited.</ErrorNote>
      </div>
    );
  }

  if ((draftId && !draft) || (options === null && !optionsError)) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the event form…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-[520px] xl:col-span-2" />
          <Skeleton className="h-[260px]" />
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];

  return (
    <div>
      <BackLink href={draftId ? `/suite/operations/my/events/${draftId}` : "/suite/operations/my/events"} label={draftId ? "Back to the event" : "My events"} />
      <PageHeader
        title={draftId ? "Finish your event" : "Plan an event"}
        subtitle="The budget is approved as a whole. Once approved, raise the purchase requests, trips and advance for each line from the event's page."
      />

      {optionsError && <LoadError text={optionsError} onRetry={() => setReload((k) => k + 1)} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="The event" icon={CalendarRange} hue="sky">
            <div className="space-y-4">
              <Field id="ev-name" label="Name" hint="Required">
                <input
                  id="ev-name"
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Scholarship portal training for board staff"
                  aria-invalid={err("name") ? true : undefined}
                  aria-describedby={err("name") ? "ev-name-err" : undefined}
                />
                <FieldError id="ev-name-err" message={err("name")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="ev-type" label="Kind of event">
                  <SearchableSelect
                    id="ev-type"
                    value={form.type}
                    onChange={(v) => set("type", v)}
                    options={types}
                    placeholder="Choose the kind"
                    searchPlaceholder="Search kinds of event"
                    aria-invalid={err("type") ? true : undefined}
                  />
                  <FieldError message={err("type")} />
                </Field>
                <Field id="ev-location" label="Location" hint="Optional">
                  <input id="ev-location" className={inputClass} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Eastgate Hotel, Ibadan" />
                </Field>
                <Field id="ev-starts" label="First day">
                  <input id="ev-starts" type="date" className={inputClass} value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} aria-invalid={err("startsOn") ? true : undefined} />
                  <FieldError message={err("startsOn")} />
                </Field>
                <Field id="ev-ends" label="Last day">
                  <input id="ev-ends" type="date" className={inputClass} value={form.endsOn} min={form.startsOn || undefined} onChange={(e) => set("endsOn", e.target.value)} aria-invalid={err("endsOn") ? true : undefined} />
                  <FieldError message={err("endsOn")} />
                </Field>
                <Field id="ev-internal" label="Staff taking part">
                  <input id="ev-internal" type="number" min={0} inputMode="numeric" className={inputClass} value={form.participantsInternal} onChange={(e) => set("participantsInternal", e.target.value)} placeholder="0" aria-invalid={err("participantsInternal") ? true : undefined} />
                  <FieldError message={err("participantsInternal")} />
                </Field>
                <Field id="ev-external" label="External participants">
                  <input id="ev-external" type="number" min={0} inputMode="numeric" className={inputClass} value={form.participantsExternal} onChange={(e) => set("participantsExternal", e.target.value)} placeholder="0" aria-invalid={err("participantsExternal") ? true : undefined} />
                  <FieldError message={err("participantsExternal")} />
                </Field>
              </div>
              <Field id="ev-objectives" label="Objectives" hint="Optional">
                <RichTextEditor id="ev-objectives" minHeight={102} value={form.objectives} onChange={(html) => set("objectives", html)} placeholder="What participants can do afterwards that they can't now." />
              </Field>
            </div>
          </Panel>

          <Panel title="Charge to" subtitle="The project's funds are checked against the whole budget when you send it" icon={Wallet} hue="grape">
            <ChargeTo
              idPrefix="ev"
              options={options}
              funding={form.funding}
              projectId={form.projectId}
              costCentreId={form.costCentreId}
              onFunding={(v) => set("funding", v)}
              onProject={(v) => set("projectId", v)}
              onCostCentre={(v) => set("costCentreId", v)}
              error={err("projectId") ?? err("costCentreId")}
            />
          </Panel>

          <Panel
            title="Budget lines"
            subtitle="Venue, meals, printing, travel… each is paid through its own channel once approved"
            icon={ListOrdered}
            hue="mint"
            actions={
              <Button size="sm" icon={Plus} onClick={() => set("lines", [...form.lines, blankLine()])}>
                Add a line
              </Button>
            }
          >
            <ol className="space-y-3">
              {form.lines.map((l, i) => (
                <li key={l.key} className="rounded-2xl border border-neutral-200/80 p-3.5">
                  <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_10rem_auto] sm:items-end">
                    <Field id={`line-${l.key}-cat`} label={`Line ${i + 1}`}>
                      <SearchableSelect
                        id={`line-${l.key}-cat`}
                        value={l.category}
                        onChange={(v) => setLine(l.key, { category: v })}
                        options={categories}
                        placeholder="Category"
                        searchPlaceholder="Search categories"
                        aria-invalid={err(`lines.${i}.category`) ? true : undefined}
                      />
                    </Field>
                    <Field id={`line-${l.key}-desc`} label="Description">
                      <input
                        id={`line-${l.key}-desc`}
                        className={inputClass}
                        value={l.description}
                        maxLength={255}
                        onChange={(e) => setLine(l.key, { description: e.target.value })}
                        placeholder={options?.eventCategories[l.category] ?? "What it pays for"}
                      />
                    </Field>
                    <Field id={`line-${l.key}-amt`} label="Amount (₦)">
                      <MoneyInput id={`line-${l.key}-amt`} value={l.amount} onChange={(v) => setLine(l.key, { amount: v })} invalid={Boolean(err(`lines.${i}.amount`))} />
                    </Field>
                    <button
                      type="button"
                      onClick={() => set("lines", form.lines.filter((x) => x.key !== l.key))}
                      aria-label={`Remove line ${i + 1}`}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center justify-self-end rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                    >
                      <Trash2 size={17} aria-hidden />
                    </button>
                  </div>
                  <FieldError message={err(`lines.${i}.category`) ?? err(`lines.${i}.amount`) ?? err(`lines.${i}.description`)} />
                </li>
              ))}
            </ol>
            <FieldError message={err("lines")} />
            <button
              type="button"
              onClick={() => set("lines", [...form.lines, blankLine("contingency")])}
              disabled={form.lines.some((l) => l.category === "contingency")}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
            >
              <Plus size={15} aria-hidden />
              Add contingency
            </button>
          </Panel>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Budget total">
          <Panel title="Budget" icon={Calculator} hue="blue">
            <BudgetTotals summary={summary} />
          </Panel>
        </aside>
      </div>

      {saveError && <ErrorNote className="mt-6">{saveError}</ErrorNote>}

      <div className="mt-6">
        <FormActions note={<span className="tabular-nums">Total <Money value={summary.total} className="font-semibold text-neutral-900" /></span>}>
          <ButtonLink href={draftId ? `/suite/operations/my/events/${draftId}` : "/suite/operations/my/events"} variant="ghost">
            Cancel
          </ButtonLink>
          <Button variant="primary" icon={Save} disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save the draft"}
          </Button>
        </FormActions>
      </div>
    </div>
  );
}
