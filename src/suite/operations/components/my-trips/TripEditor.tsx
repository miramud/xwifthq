"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPinned, Plus, Route, Save, Trash2, Users, Wallet } from "lucide-react";
import { Button, ButtonLink, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { todayYmd } from "@/components/workspace/Calendar";
import { BackLink, ErrorNote, Field, FormActions, Skeleton, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  opsError,
  opsFieldErrors,
  travel,
  type OpsOptions,
  type TravelMode,
  type TripFull,
  type TripInput,
} from "@/lib/api/operations-travel-client";
import { leadTime, tripCost } from "../travel/cost";
import { MODE, gradeOnRecord } from "../travel/labels";
import { ChargeTo, MoneyInput, optionsFrom, type Funding } from "../travel/shared";
import CostPreview from "./CostPreview";

/**
 * A new trip, or a draft being finished: where and why, who pays, the legs,
 * who travels at which grade, and the flights estimate - with the cost
 * worked out from the policy as it is typed. Saving keeps it as a draft;
 * sending it for approval happens on the trip's page.
 */

interface LegRow {
  key: number;
  from: string;
  to: string;
  travelOn: string;
  mode: TravelMode;
}

interface TravellerRow {
  key: number;
  userId: string;
  grade: string;
  /** DTA and hotel set by hand for the whole trip. */
  adjust: boolean;
  dta: number | null;
  hotel: number | null;
}

interface Form {
  purpose: string;
  funding: Funding;
  projectId: string;
  costCentreId: string;
  destinationClass: string;
  destination: string;
  departsOn: string;
  returnsOn: string;
  legs: LegRow[];
  travellers: TravellerRow[];
  flightsEstimate: number | null;
  justification: string;
  lateBookingReason: string;
}

/** Row keys for the lists below; never reused within a page's life. */
let rowKey = 0;
const next = () => ++rowKey;

const MODE_OPTIONS: SelectOption[] = Object.entries(MODE).map(([value, m]) => ({ value, label: m.label }));

export default function TripEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("id");
  const { user } = useAuth();

  const [options, setOptions] = useState<OpsOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<TripFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftReload, setDraftReload] = useState(0);
  const [form, setForm] = useState<Form>(() => ({
    purpose: "",
    funding: "project",
    projectId: "",
    costCentreId: "",
    destinationClass: "",
    destination: "",
    departsOn: "",
    returnsOn: "",
    legs: [],
    travellers: [],
    flightsEstimate: null,
    justification: "",
    lateBookingReason: "",
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
        // A new trip starts with the person raising it as the first traveller.
        const me = user?.id;
        if (!draftId && me) {
          setForm((f) => (f.travellers.length > 0 ? f : { ...f, travellers: [{ key: next(), userId: me, grade: gradeOnRecord(o, me), adjust: false, dta: null, hotel: null }] }));
        }
      },
      (e: unknown) => alive && setOptionsError(`The travel policy and pickers didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload, draftId, user?.id]);

  // A draft opens with what was saved.
  useEffect(() => {
    if (!draftId) return;
    let alive = true;
    travel.me.get(draftId).then(
      (t) => {
        if (!alive) return;
        setDraft(t);
        setLoadError(null);
        setForm({
          purpose: t.purpose,
          funding: t.project ? "project" : "costCentre",
          projectId: t.project?.id ?? "",
          costCentreId: t.costCentreId ?? "",
          destinationClass: t.destinationClass,
          destination: t.destination,
          departsOn: t.departsOn,
          returnsOn: t.returnsOn,
          legs: t.legs.map((l) => ({ key: next(), from: l.from, to: l.to, travelOn: l.travelOn, mode: l.mode })),
          travellers: t.travellers.map((p) => {
            const adjust = p.total !== p.policyTotal;
            return { key: next(), userId: p.userId, grade: p.grade, adjust, dta: adjust ? p.dta : null, hotel: adjust ? p.hotel : null };
          }),
          flightsEstimate: t.flightsEstimate || null,
          justification: t.justification ?? "",
          lateBookingReason: t.lateBookingReason ?? "",
        });
      },
      (e: unknown) =>
        alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This trip wasn't found among yours." : `This trip didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [draftId, draftReload]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLeg = (key: number, patch: Partial<LegRow>) => setForm((f) => ({ ...f, legs: f.legs.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const setTraveller = (key: number, patch: Partial<TravellerRow>) =>
    setForm((f) => ({ ...f, travellers: f.travellers.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
  /** Choosing who travels brings their grade on record; it stays editable. */
  const chooseTraveller = (key: number, userId: string) => setTraveller(key, { userId, grade: gradeOnRecord(options, userId) });

  const cost = useMemo(
    () =>
      tripCost({
        rates: options?.travelPolicy ?? [],
        destinationClass: form.destinationClass,
        departsOn: form.departsOn,
        returnsOn: form.returnsOn,
        legs: form.legs,
        travellers: form.travellers.map((t) => ({ userId: t.userId, grade: t.grade, dta: t.adjust ? t.dta : null, hotel: t.adjust ? t.hotel : null })),
        flightsEstimate: form.flightsEstimate,
      }),
    [options, form],
  );
  const lead = useMemo(() => leadTime(form.departsOn, form.destinationClass, todayYmd()), [form.departsOn, form.destinationClass]);

  const names = useMemo(() => Object.fromEntries((options?.staff ?? []).map((s) => [s.id, s.name])), [options]);
  const staffOptions: SelectOption[] = useMemo(() => (options?.staff ?? []).map((s) => ({ value: s.id, label: s.name })), [options]);
  const gradeOptions = useMemo(() => optionsFrom(options?.travelGrades), [options]);
  const classOptions = useMemo(() => optionsFrom(options?.destinationClasses), [options]);
  const grades = options?.travelGrades ?? {};

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.purpose.trim()) e.purpose = "Say what the trip is for.";
    if (!form.destinationClass) e.destinationClass = "Choose the destination class from the policy.";
    if (!form.destination.trim()) e.destination = "Say where you are going.";
    if (!form.departsOn) e.departsOn = "Choose the departure date.";
    if (!form.returnsOn) e.returnsOn = "Choose the return date.";
    else if (form.departsOn && form.returnsOn < form.departsOn) e.returnsOn = "The return is after the departure.";
    if (form.funding === "project" ? !form.projectId : !form.costCentreId) e.projectId = "Every trip is for a project or a cost centre.";
    if (form.travellers.length === 0) e.travellers = "Add who is travelling.";
    const seen = new Set<string>();
    form.travellers.forEach((t, i) => {
      if (!t.userId) e[`travellers.${i}.userId`] = "Choose a member of staff.";
      else if (seen.has(t.userId)) e[`travellers.${i}.userId`] = "Already travelling on this trip.";
      seen.add(t.userId);
    });
    form.legs.forEach((l, i) => {
      if (!l.from.trim()) e[`legs.${i}.from`] = "Where from?";
      if (!l.to.trim()) e[`legs.${i}.to`] = "Where to?";
      if (!l.travelOn) e[`legs.${i}.travelOn`] = "Which day?";
    });
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
    const input: TripInput = {
      purpose: form.purpose.trim(),
      projectId: form.funding === "project" ? form.projectId : null,
      costCentreId: form.funding === "costCentre" ? form.costCentreId : null,
      destinationClass: form.destinationClass,
      destination: form.destination.trim(),
      departsOn: form.departsOn,
      returnsOn: form.returnsOn,
      flightsEstimate: form.flightsEstimate ?? 0,
      justification: form.justification.trim() || null,
      lateBookingReason: form.lateBookingReason.trim() || null,
      legs: form.legs.map((l) => ({ from: l.from.trim(), to: l.to.trim(), travelOn: l.travelOn, mode: l.mode })),
      travellers: form.travellers.map((t) => ({
        userId: t.userId,
        grade: t.grade,
        ...(t.adjust && t.dta != null ? { dta: t.dta } : {}),
        ...(t.adjust && t.hotel != null ? { hotel: t.hotel } : {}),
      })),
    };
    setSaving(true);
    try {
      const trip = draftId ? await travel.me.update(draftId, input) : await travel.me.create(input);
      router.push(`/suite/operations/my/trips/${trip.id}`);
    } catch (e) {
      setErrors(opsFieldErrors(e));
      setSaveError(`The trip wasn't saved. ${opsError(e)}`);
      setSaving(false);
    }
  };

  const addLeg = () =>
    setForm((f) => {
      const last = f.legs[f.legs.length - 1];
      // The next leg starts where the last one ended; the second defaults to the way home.
      const leg: LegRow = last
        ? { key: next(), from: last.to, to: f.legs.length === 1 ? last.from : "", travelOn: f.legs.length === 1 ? f.returnsOn : "", mode: last.mode }
        : { key: next(), from: "", to: f.destination, travelOn: f.departsOn, mode: "air" };
      return { ...f, legs: [...f.legs, leg] };
    });

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/operations/my/trips" label="My trips" />
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
        <BackLink href={`/suite/operations/my/trips/${draft.id}`} label="Back to the trip" />
        <ErrorNote>This trip has been sent, so it can no longer be edited. Ask for a change or a cancellation from its page.</ErrorNote>
      </div>
    );
  }

  if ((draftId && !draft) || (options === null && !optionsError)) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the trip form…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-[520px] xl:col-span-2" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];

  return (
    <div>
      <BackLink href={draftId ? `/suite/operations/my/trips/${draftId}` : "/suite/operations/my/trips"} label={draftId ? "Back to the trip" : "My trips"} />
      <PageHeader
        title={draftId ? "Finish your trip" : "Plan a trip"}
        subtitle="Costed from the travel policy as you type. Save it as a draft, then send it for approval from its page."
      />

      {optionsError && <LoadError text={optionsError} onRetry={() => setReload((k) => k + 1)} />}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="Where and why" icon={MapPinned} hue="sky">
            <div className="space-y-4">
              <Field id="trip-purpose" label="Purpose" hint="Required">
                <textarea
                  id="trip-purpose"
                  rows={2}
                  className={textareaClass}
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                  placeholder="Requirements sign-off with the Eastgate board"
                  aria-invalid={err("purpose") ? true : undefined}
                  aria-describedby={err("purpose") ? "trip-purpose-err" : undefined}
                />
                <FieldError id="trip-purpose-err" message={err("purpose")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="trip-class" label="Destination class" hint="Sets the rates">
                  <SearchableSelect
                    id="trip-class"
                    value={form.destinationClass}
                    onChange={(v) => set("destinationClass", v)}
                    options={classOptions}
                    placeholder="Choose the class"
                    searchPlaceholder="Search destination classes"
                    aria-invalid={err("destinationClass") ? true : undefined}
                    aria-describedby={err("destinationClass") ? "trip-class-err" : undefined}
                  />
                  <FieldError id="trip-class-err" message={err("destinationClass")} />
                </Field>
                <Field id="trip-destination" label="Destination">
                  <input
                    id="trip-destination"
                    className={inputClass}
                    value={form.destination}
                    onChange={(e) => set("destination", e.target.value)}
                    placeholder="Abuja"
                    autoComplete="off"
                    aria-invalid={err("destination") ? true : undefined}
                    aria-describedby={err("destination") ? "trip-destination-err" : undefined}
                  />
                  <FieldError id="trip-destination-err" message={err("destination")} />
                </Field>
                <Field id="trip-departs" label="Departure">
                  <input
                    id="trip-departs"
                    type="date"
                    className={inputClass}
                    value={form.departsOn}
                    onChange={(e) => set("departsOn", e.target.value)}
                    aria-invalid={err("departsOn") ? true : undefined}
                    aria-describedby={err("departsOn") ? "trip-departs-err" : undefined}
                  />
                  <FieldError id="trip-departs-err" message={err("departsOn")} />
                </Field>
                <Field id="trip-returns" label="Return">
                  <input
                    id="trip-returns"
                    type="date"
                    className={inputClass}
                    value={form.returnsOn}
                    min={form.departsOn || undefined}
                    onChange={(e) => set("returnsOn", e.target.value)}
                    aria-invalid={err("returnsOn") ? true : undefined}
                    aria-describedby={err("returnsOn") ? "trip-returns-err" : undefined}
                  />
                  <FieldError id="trip-returns-err" message={err("returnsOn")} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Charge to" subtitle="The project's funds are checked when you send it" icon={Wallet} hue="grape">
            <ChargeTo
              idPrefix="trip"
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
            title="Itinerary"
            subtitle="Each leg of the journey. A leg by air adds the airport taxi."
            icon={Route}
            hue="coral"
            actions={
              <Button size="sm" icon={Plus} onClick={addLeg}>
                Add a leg
              </Button>
            }
          >
            {form.legs.length === 0 ? (
              <button
                type="button"
                onClick={addLeg}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 px-4 py-6 text-sm font-semibold text-neutral-600 outline-none transition hover:border-primary-300 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <Plus size={16} aria-hidden />
                Add the first leg
              </button>
            ) : (
              <ol className="space-y-3">
                {form.legs.map((l, i) => (
                  <li key={l.key} className="rounded-2xl border border-neutral-200/80 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Leg {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => set("legs", form.legs.filter((x) => x.key !== l.key))}
                        aria-label={`Remove leg ${i + 1}`}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field id={`leg-${l.key}-from`} label="From">
                        <input id={`leg-${l.key}-from`} className={inputClass} value={l.from} autoComplete="off" onChange={(e) => setLeg(l.key, { from: e.target.value })} aria-invalid={err(`legs.${i}.from`) ? true : undefined} />
                        <FieldError message={err(`legs.${i}.from`)} />
                      </Field>
                      <Field id={`leg-${l.key}-to`} label="To">
                        <input id={`leg-${l.key}-to`} className={inputClass} value={l.to} autoComplete="off" onChange={(e) => setLeg(l.key, { to: e.target.value })} aria-invalid={err(`legs.${i}.to`) ? true : undefined} />
                        <FieldError message={err(`legs.${i}.to`)} />
                      </Field>
                      <Field id={`leg-${l.key}-on`} label="Date">
                        <input id={`leg-${l.key}-on`} type="date" className={inputClass} value={l.travelOn} onChange={(e) => setLeg(l.key, { travelOn: e.target.value })} aria-invalid={err(`legs.${i}.travelOn`) ? true : undefined} />
                        <FieldError message={err(`legs.${i}.travelOn`)} />
                      </Field>
                      <Field id={`leg-${l.key}-mode`} label="Mode">
                        <SearchableSelect id={`leg-${l.key}-mode`} value={l.mode} onChange={(v) => setLeg(l.key, { mode: v as TravelMode })} options={MODE_OPTIONS} searchPlaceholder="Search modes" />
                      </Field>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            title="Who is travelling"
            subtitle="Each person's grade sets their DTA, hotel and taxi"
            icon={Users}
            hue="mint"
            actions={
              <Button size="sm" icon={Plus} onClick={() => set("travellers", [...form.travellers, { key: next(), userId: "", grade: "officer", adjust: false, dta: null, hotel: null }])}>
                Add a traveller
              </Button>
            }
          >
            {form.travellers.length === 0 && <p className="text-sm text-neutral-500">Add at least one traveller.</p>}
            <FieldError message={err("travellers")} />
            <ul className="space-y-3">
              {form.travellers.map((t, i) => {
                const c = cost.travellers[i];
                return (
                  <li key={t.key} className={cx("rounded-2xl border p-3.5", c?.over ? "border-sun-500/40 bg-sun-50/30" : "border-neutral-200/80")}>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
                      <Field id={`trav-${t.key}-who`} label={`Traveller ${i + 1}`}>
                        <SearchableSelect
                          id={`trav-${t.key}-who`}
                          value={t.userId}
                          onChange={(v) => chooseTraveller(t.key, v)}
                          options={staffOptions}
                          placeholder="Choose a member of staff"
                          searchPlaceholder="Search staff"
                          noOptionsText="No staff loaded."
                          aria-invalid={err(`travellers.${i}.userId`) ? true : undefined}
                        />
                      </Field>
                      <Field id={`trav-${t.key}-grade`} label="Grade">
                        <SearchableSelect
                          id={`trav-${t.key}-grade`}
                          value={t.grade}
                          onChange={(v) => setTraveller(t.key, { grade: v })}
                          options={gradeOptions}
                          searchPlaceholder="Search grades"
                          aria-describedby={t.userId ? `trav-${t.key}-grade-note` : undefined}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => set("travellers", form.travellers.filter((x) => x.key !== t.key))}
                        aria-label={`Remove traveller ${i + 1}`}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center justify-self-end rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
                      >
                        <Trash2 size={17} aria-hidden />
                      </button>
                    </div>
                    {t.userId && (
                      <p id={`trav-${t.key}-grade-note`} className="mt-1.5 text-xs text-neutral-500">
                        {t.grade === gradeOnRecord(options, t.userId)
                          ? "Their grade on record."
                          : `Changed from their grade on record, ${grades[gradeOnRecord(options, t.userId)] ?? gradeOnRecord(options, t.userId)}.`}
                      </p>
                    )}
                    <FieldError message={err(`travellers.${i}.userId`) ?? err(`travellers.${i}.grade`)} />
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                      <span className="text-sm text-neutral-700">
                        Set DTA or hotel by hand
                      </span>
                      <Switch
                        checked={t.adjust}
                        label={`Set DTA or hotel by hand for traveller ${i + 1}`}
                        onChange={(on) => setTraveller(t.key, on ? { adjust: true, dta: c?.policyDta ?? null, hotel: c?.policyHotel ?? null } : { adjust: false, dta: null, hotel: null })}
                      />
                    </div>
                    {t.adjust && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field id={`trav-${t.key}-dta`} label="DTA for the whole trip (₦)">
                          <MoneyInput id={`trav-${t.key}-dta`} value={t.dta} onChange={(v) => setTraveller(t.key, { dta: v })} describedBy={`trav-${t.key}-dta-hint`} />
                          <p id={`trav-${t.key}-dta-hint`} className={cx("mt-1.5 text-xs", c?.dtaOver ? "font-semibold text-sun-700" : "text-neutral-500")}>
                            Policy <Money value={c?.policyDta ?? 0} />
                            {c?.dtaOver ? ": above policy" : ""}
                          </p>
                        </Field>
                        <Field id={`trav-${t.key}-hotel`} label="Hotel for the whole trip (₦)">
                          <MoneyInput id={`trav-${t.key}-hotel`} value={t.hotel} onChange={(v) => setTraveller(t.key, { hotel: v })} describedBy={`trav-${t.key}-hotel-hint`} />
                          <p id={`trav-${t.key}-hotel-hint`} className={cx("mt-1.5 text-xs", c?.hotelOver ? "font-semibold text-sun-700" : "text-neutral-500")}>
                            Policy <Money value={c?.policyHotel ?? 0} />
                            {c?.hotelOver ? ": above policy" : ""}
                          </p>
                        </Field>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Flights and reasons" icon={Wallet} hue="sun">
            <div className="space-y-4">
              <Field id="trip-flights" label="Flights estimate (₦)" hint="Booked by the travel desk">
                <MoneyInput id="trip-flights" value={form.flightsEstimate} onChange={(v) => set("flightsEstimate", v)} describedBy="trip-flights-hint" />
                <p id="trip-flights-hint" className="mt-1.5 text-xs text-neutral-500">
                  For everyone, both ways. It goes on the estimate, not on the advance.
                </p>
              </Field>
              <Field id="trip-justification" label="Justification" hint={cost.overPolicy ? "Needed: above policy" : "Optional"}>
                <textarea
                  id="trip-justification"
                  rows={3}
                  className={textareaClass}
                  value={form.justification}
                  onChange={(e) => set("justification", e.target.value)}
                  placeholder={cost.overPolicy ? "Why the costs above policy are needed. The MD reads this." : "Anything the approvers should know"}
                  aria-invalid={err("justification") ? true : undefined}
                  aria-describedby={err("justification") ? "trip-justification-err" : undefined}
                />
                <FieldError id="trip-justification-err" message={err("justification")} />
              </Field>
              {(lead?.late || form.lateBookingReason) && (
                <Field id="trip-late" label="Why it is booked late" hint={lead?.late ? "Needed: inside the lead time" : "Optional"}>
                  <textarea
                    id="trip-late"
                    rows={2}
                    className={textareaClass}
                    value={form.lateBookingReason}
                    onChange={(e) => set("lateBookingReason", e.target.value)}
                    placeholder="The client moved the meeting forward at short notice"
                    aria-invalid={err("lateBookingReason") ? true : undefined}
                    aria-describedby={err("lateBookingReason") ? "trip-late-err" : undefined}
                  />
                  <FieldError id="trip-late-err" message={err("lateBookingReason")} />
                </Field>
              )}
            </div>
          </Panel>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Cost preview">
          <CostPreview cost={cost} lead={lead} names={names} grades={grades} />
        </aside>
      </div>

      {saveError && <ErrorNote className="mt-5">{saveError}</ErrorNote>}

      <div className="mt-6">
        <FormActions note={<span className="tabular-nums">Trip estimate <Money value={cost.estimate} className="font-semibold text-neutral-900" /></span>}>
          <ButtonLink href={draftId ? `/suite/operations/my/trips/${draftId}` : "/suite/operations/my/trips"} variant="ghost">
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
