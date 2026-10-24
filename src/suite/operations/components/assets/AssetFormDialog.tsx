"use client";

import { useId, useState } from "react";
import { Button } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { todayYmd } from "@/components/workspace/Calendar";
import { assets, opsError, opsFieldErrors, type AssetCategory, type AssetCondition, type AssetFull, type AssetInput } from "@/lib/api/operations-assets-client";
import { CONDITION, CONDITION_ORDER } from "./labels";
import { usePickerOptions } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Put an asset on the register by hand (one already owned, or a gift), or
 * change an asset's physical details. A new asset is tagged at once and
 * goes into store; cost and the date it was acquired are set only then,
 * because Finance books them.
 */
export default function AssetFormDialog({
  asset,
  categories,
  onDone,
  onClose,
}: {
  /** Absent to add a new asset. */
  asset?: AssetFull;
  categories: AssetCategory[] | null;
  onDone: (asset: AssetFull) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const editing = Boolean(asset);
  const { projects } = usePickerOptions();
  const [f, setF] = useState({
    categoryId: asset?.categoryId ?? "",
    name: asset?.name ?? "",
    make: asset?.make ?? "",
    model: asset?.model ?? "",
    serialNo: asset?.serialNo ?? "",
    condition: (asset?.condition ?? "new") as AssetCondition,
    location: asset?.location ?? "",
    projectId: asset?.project?.id ?? "",
    acquiredOn: asset?.acquiredOn ?? todayYmd(),
    warrantyUntil: asset?.warrantyUntil ?? "",
    warrantyProvider: asset?.warrantyProvider ?? "",
    insurancePolicy: asset?.insurancePolicy ?? "",
    insuranceUntil: asset?.insuranceUntil ?? "",
    notes: asset?.notes ?? "",
  });
  const [cost, setCost] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!f.categoryId) local.categoryId = "Choose the category.";
    if (!f.name.trim()) local.name = 'Name the asset, e.g. "Dell Latitude 5440".';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const blank = (s: string) => (s.trim() === "" ? null : s.trim());
    const input: AssetInput = {
      name: f.name.trim(),
      make: blank(f.make),
      model: blank(f.model),
      serialNo: blank(f.serialNo),
      condition: f.condition,
      location: blank(f.location),
      projectId: f.projectId || null,
      warrantyUntil: f.warrantyUntil || null,
      warrantyProvider: blank(f.warrantyProvider),
      insurancePolicy: blank(f.insurancePolicy),
      insuranceUntil: f.insuranceUntil || null,
      notes: blank(f.notes),
    };
    if (!editing || !asset?.tagNo) input.categoryId = f.categoryId;
    if (!editing) {
      input.cost = cost ?? 0;
      input.acquiredOn = f.acquiredOn || null;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onDone(asset ? await assets.update(asset.id, input) : await assets.create(input));
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
      setBusy(false);
    }
  };

  const catOptions = (categories ?? []).filter((c) => c.active || c.id === f.categoryId).map((c) => ({ value: c.id, label: c.name, hint: c.code }));

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      size="lg"
      titleId={`${uid}-title`}
      title={editing ? "Edit the asset's details" : "Add an asset"}
      subtitle={editing ? "What it is, where it lives, its warranty and its cover." : "It is tagged straight away and goes into store, ready to hand over."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add and tag the asset"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-cat`} label="Category">
          <SearchableSelect
            id={`${uid}-cat`}
            value={f.categoryId}
            onChange={(v) => set("categoryId", v)}
            options={catOptions}
            disabled={Boolean(asset?.tagNo)}
            placeholder={categories === null ? "Loading categories…" : "Choose the category"}
            searchPlaceholder="Search categories"
            noOptionsText={categories === null ? "Loading categories…" : "No categories yet. Add one under categories and kits."}
            aria-invalid={errors.categoryId ? true : undefined}
            aria-describedby={asset?.tagNo ? `${uid}-cat-hint` : undefined}
          />
          {asset?.tagNo && (
            <p id={`${uid}-cat-hint`} className="mt-1.5 text-xs text-neutral-500">
              A tagged asset keeps its category: its tag says what it is.
            </p>
          )}
          <FieldError message={errors.categoryId} />
        </Field>
        <Field id={`${uid}-name`} label="Name">
          <input id={`${uid}-name`} className={inputClass} value={f.name} maxLength={255} onChange={(e) => set("name", e.target.value)} placeholder="Dell Latitude 5440" aria-invalid={errors.name ? true : undefined} />
          <FieldError message={errors.name} />
        </Field>
        <Field id={`${uid}-make`} label="Make" hint="Optional">
          <input id={`${uid}-make`} className={inputClass} value={f.make} maxLength={120} onChange={(e) => set("make", e.target.value)} placeholder="Dell" />
        </Field>
        <Field id={`${uid}-model`} label="Model" hint="Optional">
          <input id={`${uid}-model`} className={inputClass} value={f.model} maxLength={120} onChange={(e) => set("model", e.target.value)} placeholder="Latitude 5440" />
        </Field>
        <Field id={`${uid}-serial`} label="Serial number" hint="Optional">
          <input id={`${uid}-serial`} className={`${inputClass} font-mono`} value={f.serialNo} maxLength={120} autoComplete="off" onChange={(e) => set("serialNo", e.target.value)} />
          <FieldError message={errors.serialNo} />
        </Field>
        <Field id={`${uid}-cond`} label="Condition">
          <SearchableSelect
            id={`${uid}-cond`}
            value={f.condition}
            onChange={(v) => set("condition", v as AssetCondition)}
            options={CONDITION_ORDER.map((c) => ({ value: c, label: CONDITION[c].label }))}
            searchPlaceholder="Search conditions"
          />
        </Field>
        <Field id={`${uid}-loc`} label="Location" hint="Optional">
          <input id={`${uid}-loc`} className={inputClass} value={f.location} maxLength={255} onChange={(e) => set("location", e.target.value)} placeholder="Abuja office, store room" />
        </Field>
        <Field id={`${uid}-project`} label="Project" hint="Optional">
          <SearchableSelect
            id={`${uid}-project`}
            value={f.projectId}
            onChange={(v) => set("projectId", v)}
            options={projects ?? []}
            clearable
            clearLabel="No project"
            placeholder={projects === null ? "Loading projects…" : "No project"}
            searchPlaceholder="Search projects"
            noOptionsText={projects === null ? "Loading projects…" : "No open projects."}
          />
          <FieldError message={errors.projectId} />
        </Field>
        {!editing && (
          <>
            <Field id={`${uid}-cost`} label="Cost (₦)">
              <MoneyInput id={`${uid}-cost`} value={cost} onChange={setCost} invalid={Boolean(errors.cost)} />
              <FieldError message={errors.cost} />
            </Field>
            <Field id={`${uid}-acq`} label="Acquired on">
              <input id={`${uid}-acq`} type="date" className={inputClass} value={f.acquiredOn} max={todayYmd()} onChange={(e) => set("acquiredOn", e.target.value)} />
              <FieldError message={errors.acquiredOn} />
            </Field>
          </>
        )}
      </div>

      <fieldset className="grid gap-4 rounded-2xl border border-neutral-200/80 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-neutral-800">Warranty and insurance</legend>
        <Field id={`${uid}-wu`} label="Warranty until" hint="Optional">
          <input id={`${uid}-wu`} type="date" className={inputClass} value={f.warrantyUntil} onChange={(e) => set("warrantyUntil", e.target.value)} />
        </Field>
        <Field id={`${uid}-wp`} label="Warranty provider" hint="Optional">
          <input id={`${uid}-wp`} className={inputClass} value={f.warrantyProvider} maxLength={160} onChange={(e) => set("warrantyProvider", e.target.value)} />
        </Field>
        <Field id={`${uid}-ip`} label="Insurance policy" hint="Optional">
          <input id={`${uid}-ip`} className={`${inputClass} font-mono`} value={f.insurancePolicy} maxLength={120} onChange={(e) => set("insurancePolicy", e.target.value)} />
        </Field>
        <Field id={`${uid}-iu`} label="Insured until" hint="Optional">
          <input id={`${uid}-iu`} type="date" className={inputClass} value={f.insuranceUntil} onChange={(e) => set("insuranceUntil", e.target.value)} />
        </Field>
      </fieldset>

      <Field id={`${uid}-notes`} label="Notes" hint="Optional">
        <RichTextEditor id={`${uid}-notes`} minHeight={76} value={f.notes} onChange={(html) => set("notes", html)} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
