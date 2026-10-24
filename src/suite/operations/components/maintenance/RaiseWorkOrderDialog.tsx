"use client";

import { useId, useState } from "react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { maintenance, opsError, opsFieldErrors, SLA_HOURS, type WorkOrderFull, type WorkOrderPriority } from "@/lib/api/operations-maintenance-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "./labels";
import { useMaintenancePickers } from "./parts";

type Errors = Record<string, string>;

const slaText = (p: WorkOrderPriority) => {
  const h = SLA_HOURS[p];
  return h >= 48 ? `${h / 24} days` : `${h} hours`;
};

/**
 * A fault becomes a corrective work order: on an asset or a facility, with
 * a priority that sets its SLA, and optionally somebody (or a vendor) to do
 * it. Opened from the board, or from an asset's card with the asset chosen.
 */
export default function RaiseWorkOrderDialog({
  asset,
  onClose,
  onDone,
}: {
  /** Raising it from an asset's card: the asset is fixed. */
  asset?: { id: string; tagNo: string | null; name: string; categoryCode?: string | null };
  onClose: () => void;
  onDone: (wo: WorkOrderFull) => void;
}) {
  const uid = useId();
  const pickers = useMaintenancePickers();
  const [on, setOn] = useState<"asset" | "facility">("asset");
  const [assetId, setAssetId] = useState(asset?.id ?? "");
  const [facilityId, setFacilityId] = useState("");
  const [title, setTitle] = useState("");
  const [fault, setFault] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("normal");
  const [assigneeId, setAssigneeId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!asset && on === "asset" && !assetId) local.assetId = "Choose the asset that needs the work.";
    if (!asset && on === "facility" && !facilityId) local.facilityId = "Choose the facility that needs the work.";
    if (!title.trim()) local.title = "Say what is wrong in a few words.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const wo = await maintenance.create({
        assetId: asset ? asset.id : on === "asset" ? assetId : null,
        facilityId: !asset && on === "facility" ? facilityId : null,
        title: title.trim(),
        fault: fault.trim() || null,
        priority,
        assigneeId: assigneeId || null,
        vendorId: vendorId || null,
      });
      onDone(wo);
    } catch (e) {
      const f = opsFieldErrors(e);
      setErrors(Object.keys(f).length ? f : { general: opsError(e) });
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={asset ? "Report a fault" : "Raise a work order"}
      subtitle="Say what is wrong. The priority sets how soon it must be fixed."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Raising…" : "Raise work order"}
          </Button>
        </div>
      }
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}

      {asset ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-50 px-3.5 py-3">
          <AssetTag tagNo={asset.tagNo} code={asset.categoryCode} />
          <span className="text-sm font-medium text-neutral-800">{asset.name}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <Segmented
            label="The work is on"
            value={on}
            onChange={setOn}
            options={[
              { key: "asset", label: "An asset" },
              { key: "facility", label: "A facility" },
            ]}
          />
          {on === "asset" ? (
            <Field id={`${uid}-asset`} label="Asset">
              <SearchableSelect
                id={`${uid}-asset`}
                value={assetId}
                onChange={setAssetId}
                options={pickers.assets ?? []}
                placeholder={pickers.assets === null ? "Loading the register…" : "Choose the asset"}
                searchPlaceholder="Search by name or tag"
                noOptionsText={pickers.assets === null ? "Loading the register…" : "Nothing on the asset register yet."}
                aria-invalid={errors.assetId ? true : undefined}
                aria-describedby={errors.assetId ? `${uid}-asset-err` : undefined}
              />
              <FieldError id={`${uid}-asset-err`} message={errors.assetId} />
            </Field>
          ) : (
            <Field id={`${uid}-facility`} label="Facility">
              <SearchableSelect
                id={`${uid}-facility`}
                value={facilityId}
                onChange={setFacilityId}
                options={pickers.facilities ?? []}
                placeholder={pickers.facilities === null ? "Loading sites…" : "Choose the facility"}
                searchPlaceholder="Search sites"
                noOptionsText={pickers.facilities === null ? "Loading sites…" : "No facilities set up yet."}
                aria-invalid={errors.facilityId ? true : undefined}
                aria-describedby={errors.facilityId ? `${uid}-facility-err` : undefined}
              />
              <FieldError id={`${uid}-facility-err`} message={errors.facilityId} />
            </Field>
          )}
        </div>
      )}

      <Field id={`${uid}-title`} label="What is wrong">
        <input
          id={`${uid}-title`}
          className={inputClass}
          value={title}
          maxLength={255}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Generator won't start"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${uid}-title-err` : undefined}
        />
        <FieldError id={`${uid}-title-err`} message={errors.title} />
      </Field>

      <Field id={`${uid}-fault`} label="Details" hint="Optional">
        <textarea
          id={`${uid}-fault`}
          className={textareaClass}
          rows={3}
          maxLength={5000}
          value={fault}
          onChange={(e) => setFault(e.target.value)}
          placeholder="When it started, what you have tried, anything unusual."
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-700">Priority</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORITY_ORDER.map((p) => (
            <label
              key={p}
              className={cx(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-2xl border px-3 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-300",
                priority === p ? "border-primary-500 bg-primary-50/60 text-primary-800" : "border-neutral-200/80 text-neutral-700 hover:border-neutral-300",
              )}
            >
              <input type="radio" name={`${uid}-priority`} value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
              <span className="font-semibold">{PRIORITY_LABEL[p]}</span>
              <span className="text-xs text-neutral-500">Fix within {slaText(p)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-assignee`} label="Assign to" hint="Optional">
          <SearchableSelect
            id={`${uid}-assignee`}
            value={assigneeId}
            onChange={setAssigneeId}
            options={pickers.staff ?? []}
            clearable
            clearLabel="Nobody yet"
            placeholder="Nobody yet"
            searchPlaceholder="Search staff"
            noOptionsText={pickers.staff === null ? "Loading staff…" : "No staff found."}
          />
          <FieldError message={errors.assigneeId} />
        </Field>
        <Field id={`${uid}-vendor`} label="Vendor" hint="Optional">
          <SearchableSelect
            id={`${uid}-vendor`}
            value={vendorId}
            onChange={setVendorId}
            options={pickers.vendors ?? []}
            clearable
            clearLabel="No vendor"
            placeholder="No vendor"
            searchPlaceholder="Search vendors"
            noOptionsText={pickers.vendors === null ? "Loading vendors…" : "No vendors yet."}
          />
          <FieldError message={errors.vendorId} />
        </Field>
      </div>
    </DialogFrame>
  );
}
