"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Building2, CalendarClock, Clock, FileText, Landmark, MapPin, Save } from "lucide-react";
import { orgFoundations, type OrgProfile } from "@/lib/api/org-foundations-client";
import { Button, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, FormActions, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import {
  MONTHS,
  WEEKDAYS,
  changedPatch,
  hoursBetween,
  profileToForm,
  toggleDay,
  validateProfile,
  type ProfileForm,
} from "./logic";
import { CurrencySelect, FieldError, LoadError, Notice, errorText, fieldErrors } from "./shared";
import FxRatesPanel from "./FxRatesPanel";

/**
 * Organisation profile: who the organisation is on paper (legal name, tax
 * numbers, address, the footer every document carries), what money it keeps
 * its books in, when its year starts, and when it works. Working days and
 * hours are what approval deadlines are counted in.
 */

function timezones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Europe/London", "UTC"];
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export default function ProfileBoard() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [original, setOriginal] = useState<ProfileForm | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    orgFoundations.profile
      .get()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setOriginal(profileToForm(p));
        setForm(profileToForm(p));
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e, "The organisation profile didn't load.")));
    return () => {
      alive = false;
    };
  }, [reload]);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const dirty = useMemo(() => (form && original ? Object.keys(changedPatch(original, form)).length > 0 : false), [form, original]);
  const zones = useMemo(() => timezones(form?.timezone ?? ""), [form?.timezone]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !original) return;
    const found = validateProfile(form);
    setErrors(found);
    setSaveError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) {
      setSaveError("Some fields need fixing before the profile can be saved.");
      return;
    }
    const patch = changedPatch(original, form);
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    try {
      const saved = await orgFoundations.profile.update(patch);
      setProfile(saved);
      setOriginal(profileToForm(saved));
      setForm(profileToForm(saved));
      setNotice("Profile saved.");
    } catch (err) {
      // 422: e.g. the base currency can't change once money has been posted in it.
      setErrors(fieldErrors(err));
      setSaveError(errorText(err, "The profile wasn't saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="Organisation profile"
        subtitle="Your legal identity, address and working week. Documents, reference numbers and approval deadlines all read from here."
      />

      <Notice text={notice} />
      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      {form === null && !loadError ? (
        <div aria-busy="true" className="grid gap-5 lg:grid-cols-3">
          <p className="sr-only">Loading the organisation profile…</p>
          <Skeleton className="h-[520px] lg:col-span-2" />
          <Skeleton className="h-[360px]" />
        </div>
      ) : form !== null ? (
        <form onSubmit={save} noValidate aria-label="Organisation profile">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <IdentityPanel form={form} set={set} errors={errors} />
              <AddressPanel form={form} set={set} errors={errors} />
              <MoneyPanel form={form} set={set} errors={errors} />
              <WorkingTimePanel form={form} set={set} errors={errors} zones={zones} />
            </div>
            <div className="space-y-5">
              <div className="lg:sticky lg:top-20">
                <Letterhead form={form} />
              </div>
            </div>
          </div>

          {saveError && <ErrorNote className="mt-5">{saveError}</ErrorNote>}

          <div className="mt-5">
            <FormActions
              note={
                dirty
                  ? "You have unsaved changes."
                  : profile?.updatedAt
                    ? `Last saved ${new Date(profile.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}.`
                    : "Nothing changed yet."
              }
            >
              <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => original && (setForm(original), setErrors({}), setSaveError(null))}>
                Discard changes
              </Button>
              <Button type="submit" variant="primary" icon={Save} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </FormActions>
          </div>
        </form>
      ) : null}

      <div className="mt-8">
        <FxRatesPanel baseCurrency={profile?.baseCurrency ?? null} />
      </div>
    </div>
  );
}

type Setter = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;

/** One labelled text input with its error beneath. */
function TextField({
  name,
  label,
  form,
  set,
  errors,
  hint,
  maxLength,
  className,
  placeholder,
  upper,
}: {
  name: keyof ProfileForm;
  label: string;
  form: ProfileForm;
  set: Setter;
  errors: Record<string, string>;
  hint?: string;
  maxLength?: number;
  className?: string;
  placeholder?: string;
  upper?: boolean;
}) {
  const id = `profile-${name}`;
  const err = errors[name];
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        value={String(form[name] ?? "")}
        onChange={(e) => set(name, (upper ? e.target.value.toUpperCase() : e.target.value) as never)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={err ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : null, err ? `${id}-err` : null].filter(Boolean).join(" ") || undefined}
        className={cx(inputClass, err && "border-error-500")}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-neutral-500">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} message={err} />
    </div>
  );
}

type PanelProps = { form: ProfileForm; set: Setter; errors: Record<string, string> };

function IdentityPanel(p: PanelProps) {
  return (
    <Panel title="Legal and tax identity" subtitle="How the organisation is named on contracts, invoices and letters." icon={Building2}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...p} name="legalName" label="Legal name" maxLength={255} placeholder="As registered" />
        <TextField {...p} name="tradingName" label="Trading name" maxLength={255} hint="Leave blank to use the legal name." />
        <TextField
          {...p}
          name="shortCode"
          label="Short code"
          maxLength={8}
          upper
          placeholder="e.g. MPT"
          hint="Up to 8 letters and numbers. It fills the {ORG} part of reference numbers."
        />
        <TextField {...p} name="rcNumber" label="RC number" maxLength={32} />
        <TextField {...p} name="tin" label="Tax ID (TIN)" maxLength={32} />
        <TextField {...p} name="vatNumber" label="VAT number" maxLength={32} />
      </div>
    </Panel>
  );
}

function AddressPanel(p: PanelProps) {
  const footerId = "profile-documentFooter";
  return (
    <Panel title="Address and document footer" subtitle="Printed on the letterhead of every document the organisation issues." icon={MapPin} hue="coral">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...p} name="addressLine1" label="Address line 1" maxLength={255} className="sm:col-span-2" />
        <TextField {...p} name="addressLine2" label="Address line 2" maxLength={255} className="sm:col-span-2" />
        <TextField {...p} name="city" label="City" maxLength={120} />
        <TextField {...p} name="state" label="State" maxLength={120} />
        <TextField {...p} name="postalCode" label="Postal code" maxLength={24} />
        <TextField {...p} name="country" label="Country code" maxLength={2} upper placeholder="NG" hint="Two letters, like NG or GH." />
        <div className="sm:col-span-2">
          <label htmlFor={footerId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Document footer
          </label>
          <textarea
            id={footerId}
            rows={3}
            maxLength={1000}
            value={p.form.documentFooter}
            onChange={(e) => p.set("documentFooter", e.target.value)}
            placeholder="e.g. Registered office, bank details, or a line about how to check a document is genuine"
            aria-describedby={`${footerId}-hint`}
            className={textareaClass}
          />
          <p id={`${footerId}-hint`} className="mt-1.5 text-xs text-neutral-500">
            {p.form.documentFooter.length}/1000 characters. Shown at the bottom of every page.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function MoneyPanel({ form, set, errors }: PanelProps) {
  const curId = "profile-baseCurrency";
  const monthId = "profile-fyMonth";
  const dayId = "profile-fyDay";
  return (
    <Panel title="Currency and fiscal year" subtitle="The currency the books are kept in, and the day the financial year starts." icon={Landmark} hue="mint">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={curId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Base currency
          </label>
          <CurrencySelect
            id={curId}
            value={form.baseCurrency}
            onChange={(v) => set("baseCurrency", v)}
            invalid={Boolean(errors.baseCurrency)}
            describedBy={`${curId}-hint ${errors.baseCurrency ? `${curId}-err` : ""}`.trim()}
          />
          <p id={`${curId}-hint`} className="mt-1.5 text-xs text-neutral-500">
            Can&apos;t change once money has been posted in it.
          </p>
          <FieldError id={`${curId}-err`} message={errors.baseCurrency} />
        </div>
        <div>
          <label htmlFor={monthId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Year starts in
          </label>
          <SearchableSelect
            id={monthId}
            value={String(form.fiscalYearStartMonth)}
            onChange={(v) => set("fiscalYearStartMonth", Number(v))}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
        </div>
        <div>
          <label htmlFor={dayId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            On day
          </label>
          <SearchableSelect
            id={dayId}
            value={String(form.fiscalYearStartDay)}
            onChange={(v) => set("fiscalYearStartDay", Number(v))}
            options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            aria-describedby={`${dayId}-hint`}
          />
          <p id={`${dayId}-hint`} className="mt-1.5 text-xs text-neutral-500">
            1 to 28, so every month has it.
          </p>
          <FieldError message={errors.fiscalYearStartDay} />
        </div>
      </div>
    </Panel>
  );
}

function WorkingTimePanel({ form, set, errors, zones }: PanelProps & { zones: string[] }) {
  const tzId = "profile-timezone";
  const daysLabel = useId();
  const hours = hoursBetween(form.workStartsAt, form.workEndsAt);
  return (
    <Panel
      title="Working week"
      subtitle="Approval deadlines are counted in these days and hours, so a 24-hour deadline set on Friday evening falls on Monday."
      icon={CalendarClock}
      hue="grape"
    >
      <div className="space-y-5">
        <div>
          <label htmlFor={tzId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Time zone
          </label>
          <SearchableSelect
            id={tzId}
            value={form.timezone}
            onChange={(v) => set("timezone", v)}
            options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
            searchPlaceholder="Search time zones"
          />
        </div>

        <fieldset>
          <legend id={daysLabel} className="mb-2 text-sm font-medium text-neutral-700">
            Working days
          </legend>
          <div className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            {WEEKDAYS.map((d) => {
              const on = form.workingDays.includes(d.iso);
              return (
                <button
                  key={d.iso}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.long}
                  onClick={() => set("workingDays", toggleDay(form.workingDays, d.iso))}
                  className={cx(
                    "flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300 sm:w-16",
                    on
                      ? "border-primary-600 bg-primary-600 text-white shadow-sm shadow-primary-600/20"
                      : "ws-hatch border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800",
                  )}
                >
                  <span aria-hidden>{d.short}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {form.workingDays.length === 0
              ? "No working days picked."
              : `${form.workingDays.length} working ${form.workingDays.length === 1 ? "day" : "days"}: ${form.workingDays
                  .map((d) => WEEKDAYS.find((w) => w.iso === d)?.short)
                  .join(", ")}.`}
          </p>
          <FieldError message={errors.workingDays} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="profile-workStartsAt" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Day starts
            </label>
            <input
              id="profile-workStartsAt"
              type="time"
              value={form.workStartsAt}
              onChange={(e) => set("workStartsAt", e.target.value)}
              aria-invalid={errors.workStartsAt ? true : undefined}
              className={cx(inputClass, "tabular-nums")}
            />
            <FieldError message={errors.workStartsAt} />
          </div>
          <div>
            <label htmlFor="profile-workEndsAt" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Day ends
            </label>
            <input
              id="profile-workEndsAt"
              type="time"
              value={form.workEndsAt}
              onChange={(e) => set("workEndsAt", e.target.value)}
              aria-invalid={errors.workEndsAt ? true : undefined}
              className={cx(inputClass, "tabular-nums")}
            />
            <FieldError message={errors.workEndsAt} />
          </div>
          <div className="flex items-end">
            <p className="flex h-11 items-center gap-2 rounded-xl bg-neutral-100/80 px-3.5 text-sm text-neutral-700">
              <Clock size={16} aria-hidden className="text-neutral-500" />
              {hours === null ? "-" : `${hours} hours a day`}
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/**
 * How the organisation's documents will look: name, address and numbers at
 * the head, the footer at the foot, and a sample reference carrying the short
 * code. The body is hatched — the part each document fills in.
 */
export function Letterhead({ form }: { form: ProfileForm }) {
  const name = form.tradingName.trim() || form.legalName.trim() || "Your organisation";
  const legal = form.tradingName.trim() && form.legalName.trim() && form.legalName.trim() !== form.tradingName.trim() ? form.legalName.trim() : null;
  const address = [form.addressLine1, form.addressLine2, form.city, form.state, form.postalCode, form.country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const ids = [form.rcNumber.trim() && `RC ${form.rcNumber.trim()}`, form.tin.trim() && `TIN ${form.tin.trim()}`, form.vatNumber.trim() && `VAT ${form.vatNumber.trim()}`].filter(
    Boolean,
  ) as string[];
  const code = form.shortCode.trim().toUpperCase() || "ORG";
  const year = new Date().getFullYear();

  return (
    <section aria-labelledby="letterhead-title">
      <div className="mb-3 flex items-center gap-2">
        <FileText size={16} aria-hidden className="text-primary-600" />
        <h2 id="letterhead-title" className="text-[15px] font-semibold text-neutral-900">
          Letterhead preview
        </h2>
      </div>
      <div className="ws-card overflow-hidden">
        <div className="h-1.5 bg-primary-600" aria-hidden />
        <div className="flex aspect-[1/1.2] flex-col p-5 text-neutral-900">
          <header className="border-b border-neutral-200 pb-3">
            <p className="text-base font-bold leading-snug tracking-tight">{name}</p>
            {legal && <p className="text-[11px] text-neutral-600">{legal}</p>}
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">{address || "Your address appears here."}</p>
            {ids.length > 0 && <p className="mt-1 text-[11px] font-medium tabular-nums text-neutral-700">{ids.join(" · ")}</p>}
          </header>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-neutral-500">Reference</span>
            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono font-semibold tabular-nums text-neutral-800">
              INV/{code}/{year}/0042
            </span>
          </div>
          <div className="mt-4 flex-1 space-y-2" aria-hidden>
            {[92, 100, 84, 96, 60].map((w, i) => (
              <div key={i} className="ws-hatch h-2 rounded-full" style={{ width: `${w}%` }} />
            ))}
          </div>
          <footer className="mt-4 border-t border-neutral-200 pt-2">
            <p className="whitespace-pre-line text-[10.5px] leading-relaxed text-neutral-600">
              {form.documentFooter.trim() || "Your document footer appears here."}
            </p>
          </footer>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Updates as you type.</p>
    </section>
  );
}
