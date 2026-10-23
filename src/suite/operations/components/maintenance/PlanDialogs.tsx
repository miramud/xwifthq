"use client";

import { useEffect, useId, useState } from "react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, Switch, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { assets, type AssetCategory } from "@/lib/api/operations-assets-client";
import { maintenance, opsError, opsFieldErrors, type MaintenancePlan, type PlanInput, type UsageUnit } from "@/lib/api/operations-maintenance-client";
import { useMaintenancePickers } from "./parts";
import { ymdOf } from "./labels";

type Errors = Record<string, string>;
type Scope = "asset" | "category" | "facility";

function apiErrors(e: unknown): Errors {
  const f = opsFieldErrors(e);
  return Object.keys(f).length ? f : { general: opsError(e) };
}

function Footer({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
    </div>
  );
}

const wholeOrNull = (s: string): number | null | "bad" => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : "bad";
};

/**
 * A preventive plan: what it covers (one asset, every asset of a category,
 * or a facility), how often (every so many months, hours or km, or both —
 * whichever comes first), how many days ahead its work order is raised, and
 * who does it.
 */
export function PlanDialog({ plan, onClose, onDone }: { plan: MaintenancePlan | null; onClose: () => void; onDone: (message: string) => void }) {
  const uid = useId();
  const pickers = useMaintenancePickers();
  const [categories, setCategories] = useState<AssetCategory[] | null>(null);
  const [name, setName] = useState(plan?.name ?? "");
  const [scope, setScope] = useState<Scope>(plan?.facilityId ? "facility" : plan?.categoryId ? "category" : "asset");
  const [assetId, setAssetId] = useState(plan?.assetId ?? "");
  const [categoryId, setCategoryId] = useState(plan?.categoryId ?? "");
  const [facilityId, setFacilityId] = useState(plan?.facilityId ?? "");
  const [months, setMonths] = useState(plan?.everyMonths ? String(plan.everyMonths) : "");
  const [usage, setUsage] = useState(plan?.everyUsage ? String(plan.everyUsage) : "");
  const [unit, setUnit] = useState<UsageUnit>(plan?.usageUnit ?? "hours");
  const [lead, setLead] = useState(String(plan?.leadDays ?? 7));
  const [assigneeId, setAssigneeId] = useState(plan?.assigneeId ?? "");
  const [vendorId, setVendorId] = useState(plan?.vendorId ?? "");
  const [checklist, setChecklist] = useState(plan?.checklist ?? "");
  const [lastDone, setLastDone] = useState("");
  const [active, setActive] = useState(plan?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    assets.categories().then(
      (c) => alive && setCategories(c.filter((x) => x.active)),
      () => alive && setCategories([]),
    );
    return () => {
      alive = false;
    };
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!name.trim()) local.name = "Name the plan, like “Generator 250-hour service”.";
    if (scope === "asset" && !assetId) local.assetId = "Choose the asset.";
    if (scope === "category" && !categoryId) local.categoryId = "Choose the category.";
    if (scope === "facility" && !facilityId) local.facilityId = "Choose the facility.";
    const m = wholeOrNull(months);
    const u = wholeOrNull(usage);
    if (m === "bad") local.everyMonths = "Months are a whole number, like 3.";
    if (u === "bad") local.everyUsage = `A whole number of ${unit}, like 250.`;
    if (m === null && u === null) local.everyMonths = "Say how often: every so many months, hours or km, or both.";
    const ld = Number(lead.trim() || "0");
    if (!Number.isInteger(ld) || ld < 0 || ld > 90) local.leadDays = "Between 0 and 90 days.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: PlanInput = {
      name: name.trim(),
      assetId: scope === "asset" ? assetId : null,
      categoryId: scope === "category" ? categoryId : null,
      facilityId: scope === "facility" ? facilityId : null,
      everyMonths: m as number | null,
      everyUsage: u as number | null,
      usageUnit: u === null ? null : unit,
      leadDays: ld,
      assigneeId: assigneeId || null,
      vendorId: vendorId || null,
      checklist: checklist.trim() || null,
      ...(plan ? { active } : lastDone ? { lastDoneOn: lastDone } : {}),
    };
    setBusy(true);
    setErrors({});
    try {
      if (plan) await maintenance.updatePlan(plan.id, input);
      else await maintenance.createPlan(input);
      onDone(plan ? `${input.name} saved.` : `${input.name} added. Its work orders are raised ${ld} days before each due date.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code }));

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-t`}
      title={plan ? `Edit ${plan.name}` : "Add a maintenance plan"}
      subtitle="Planned servicing, raised as a work order ahead of each due date or as soon as a meter reading reaches the limit."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={plan ? "Save plan" : "Add plan"} />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <Field id={`${uid}-name`} label="Name">
        <input id={`${uid}-name`} className={inputClass} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} placeholder="Generator 250-hour service" aria-invalid={errors.name ? true : undefined} />
        <FieldError message={errors.name} />
      </Field>

      <div className="space-y-3">
        <Segmented
          label="The plan covers"
          value={scope}
          onChange={setScope}
          options={[
            { key: "asset", label: "One asset" },
            { key: "category", label: "A category" },
            { key: "facility", label: "A facility" },
          ]}
        />
        {scope === "asset" && (
          <Field id={`${uid}-asset`} label="Asset">
            <SearchableSelect
              id={`${uid}-asset`}
              value={assetId}
              onChange={setAssetId}
              options={pickers.assets ?? []}
              placeholder={pickers.assets === null ? "Loading the register…" : "Choose the asset"}
              searchPlaceholder="Search by name or tag"
              aria-invalid={errors.assetId ? true : undefined}
            />
            <FieldError message={errors.assetId} />
          </Field>
        )}
        {scope === "category" && (
          <Field id={`${uid}-cat`} label="Category" hint="Every asset in it, and new ones as they arrive">
            <SearchableSelect
              id={`${uid}-cat`}
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder={categories === null ? "Loading categories…" : "Choose the category"}
              searchPlaceholder="Search categories"
              aria-invalid={errors.categoryId ? true : undefined}
            />
            <FieldError message={errors.categoryId} />
          </Field>
        )}
        {scope === "facility" && (
          <Field id={`${uid}-fac`} label="Facility">
            <SearchableSelect
              id={`${uid}-fac`}
              value={facilityId}
              onChange={setFacilityId}
              options={pickers.facilities ?? []}
              placeholder={pickers.facilities === null ? "Loading sites…" : "Choose the facility"}
              searchPlaceholder="Search sites"
              noOptionsText="No facilities set up yet."
              aria-invalid={errors.facilityId ? true : undefined}
            />
            <FieldError message={errors.facilityId} />
          </Field>
        )}
      </div>

      <fieldset className="rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">How often</legend>
        <p className="mb-3 text-xs text-neutral-500">Fill one or both. With both, whichever comes first.</p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <Field id={`${uid}-months`} label="Every … months">
            <input id={`${uid}-months`} inputMode="numeric" className={inputClass} value={months} onChange={(e) => setMonths(e.target.value)} placeholder="3" aria-invalid={errors.everyMonths ? true : undefined} />
            <FieldError message={errors.everyMonths} />
          </Field>
          <Field id={`${uid}-usage`} label={`Every … ${unit}`}>
            <input id={`${uid}-usage`} inputMode="numeric" className={inputClass} value={usage} onChange={(e) => setUsage(e.target.value)} placeholder={unit === "km" ? "5000" : "250"} aria-invalid={errors.everyUsage ? true : undefined} />
            <FieldError message={errors.everyUsage ?? errors.usageUnit} />
          </Field>
          <div className="sm:pt-7">
            <Segmented
              label="Usage counted in"
              value={unit}
              onChange={setUnit}
              options={[
                { key: "hours", label: "Hours" },
                { key: "km", label: "km" },
              ]}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-lead`} label="Raise the work order" hint="Days before it is due">
          <input id={`${uid}-lead`} inputMode="numeric" className={inputClass} value={lead} onChange={(e) => setLead(e.target.value)} aria-invalid={errors.leadDays ? true : undefined} />
          <FieldError message={errors.leadDays} />
        </Field>
        {!plan ? (
          <Field id={`${uid}-last`} label="Last done on" hint="Optional; the first due date counts from it">
            <input id={`${uid}-last`} type="date" className={inputClass} value={lastDone} max={ymdOf(new Date())} onChange={(e) => setLastDone(e.target.value)} />
          </Field>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-neutral-800">Active</span>
              <span className="block text-xs text-neutral-500">Paused plans raise nothing</span>
            </span>
            <Switch checked={active} onChange={setActive} label="Plan is active" />
          </div>
        )}
        <Field id={`${uid}-who`} label="Assign its work to" hint="Optional">
          <SearchableSelect id={`${uid}-who`} value={assigneeId} onChange={setAssigneeId} options={pickers.staff ?? []} clearable clearLabel="Nobody" placeholder="Nobody" searchPlaceholder="Search staff" />
        </Field>
        <Field id={`${uid}-vendor`} label="Vendor" hint="Optional">
          <SearchableSelect id={`${uid}-vendor`} value={vendorId} onChange={setVendorId} options={pickers.vendors ?? []} clearable clearLabel="No vendor" placeholder="No vendor" searchPlaceholder="Search vendors" />
        </Field>
      </div>

      <Field id={`${uid}-check`} label="Checklist" hint="Optional; copied onto each work order">
        <textarea id={`${uid}-check`} className={textareaClass} rows={4} maxLength={5000} value={checklist} onChange={(e) => setChecklist(e.target.value)} placeholder={"Change oil and filter\nCheck belts and coolant\nLoad test 30 minutes"} />
      </Field>
    </DialogFrame>
  );
}

/** A meter reading: running hours or the odometer. Readings never go backwards. */
export function ReadingDialog({
  asset,
  unit,
  last,
  onClose,
  onDone,
}: {
  asset: { id: string; tagNo: string | null; name: string | null };
  unit: UsageUnit;
  last: number | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const uid = useId();
  const [reading, setReading] = useState("");
  const [readOn, setReadOn] = useState(ymdOf(new Date()));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = Number(reading.trim().replace(/,/g, ""));
    if (!reading.trim() || !Number.isFinite(n) || n < 0) {
      setErrors({ reading: `Enter the ${unit === "km" ? "odometer" : "hour meter"} reading, like ${unit === "km" ? "48210" : "1250"}.` });
      return;
    }
    if (last !== null && n < last) {
      setErrors({ reading: `The last reading was ${last} ${unit}; a reading can't go backwards.` });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await maintenance.addReading(asset.id, { reading: n, unit, readOn });
      onDone(`Reading recorded for ${asset.tagNo ?? asset.name ?? "the asset"}. If it reached a plan's limit, its work order is raised.`);
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Record a reading"
      subtitle={`${asset.tagNo ?? ""} ${asset.name ?? ""}`.trim()}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Record reading" />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-r`} label={unit === "km" ? "Odometer (km)" : "Hour meter (hours)"}>
          <input id={`${uid}-r`} inputMode="decimal" className={inputClass} value={reading} onChange={(e) => setReading(e.target.value)} placeholder={last !== null ? String(last) : undefined} aria-invalid={errors.reading ? true : undefined} />
          <FieldError message={errors.reading} />
          {last !== null && <p className="mt-1.5 text-xs text-neutral-500">Last reading {last} {unit}</p>}
        </Field>
        <Field id={`${uid}-on`} label="Read on">
          <input id={`${uid}-on`} type="date" className={inputClass} value={readOn} max={ymdOf(new Date())} onChange={(e) => setReadOn(e.target.value)} />
          <FieldError message={errors.readOn} />
        </Field>
      </div>
    </DialogFrame>
  );
}
