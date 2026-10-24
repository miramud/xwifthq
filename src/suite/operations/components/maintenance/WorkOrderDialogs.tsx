"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button, Segmented } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { MoneyInput } from "@/suite/operations/components/travel/shared";
import { maintenance, opsError, opsFieldErrors, type WorkOrderFull } from "@/lib/api/operations-maintenance-client";
import { stores, type StockDesk } from "@/lib/api/operations-stores-client";
import { useMaintenancePickers } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/* The work order's forms: assign, add a part, raise the purchase request, complete, cancel. */

type Errors = Record<string, string>;

function apiErrors(e: unknown): Errors {
  const f = opsFieldErrors(e);
  return Object.keys(f).length ? f : { general: opsError(e) };
}

function Footer({ onClose, busy, label, busyLabel, danger = false }: { onClose: () => void; busy: boolean; label: string; busyLabel: string; danger?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>{danger ? "Keep it" : "Cancel"}</Button>
      <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
        {busy ? busyLabel : label}
      </Button>
    </div>
  );
}

const numberOrNull = (s: string): number | null => {
  const t = s.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

interface DialogProps {
  wo: WorkOrderFull;
  onClose: () => void;
  onDone: (wo: WorkOrderFull, message: string) => void;
}

/* ------------------------------ assign ------------------------------ */

export function AssignDialog({ wo, onClose, onDone }: DialogProps) {
  const uid = useId();
  const pickers = useMaintenancePickers();
  const [assigneeId, setAssigneeId] = useState(wo.assigneeId ?? "");
  const [vendorId, setVendorId] = useState(wo.vendorId ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!assigneeId && !vendorId) {
      setErrors({ assigneeId: "Choose somebody on the team, a vendor, or both." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const next = await maintenance.assign(wo.id, { assigneeId: assigneeId || null, vendorId: vendorId || null });
      onDone(next, "Assigned.");
    } catch (e) {
      setErrors(apiErrors(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame as="form" onSubmit={submit} titleId={`${uid}-t`} title="Assign the work" subtitle="Somebody on the team, an outside vendor, or both." onClose={onClose} footer={<Footer onClose={onClose} busy={busy} label="Assign" busyLabel="Assigning…" />}>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <Field id={`${uid}-who`} label="Technician">
        <SearchableSelect
          id={`${uid}-who`}
          value={assigneeId}
          onChange={setAssigneeId}
          options={pickers.staff ?? []}
          clearable
          clearLabel="Nobody"
          placeholder="Nobody"
          searchPlaceholder="Search staff"
          noOptionsText={pickers.staff === null ? "Loading staff…" : "No staff found."}
          aria-invalid={errors.assigneeId ? true : undefined}
          aria-describedby={errors.assigneeId ? `${uid}-who-err` : undefined}
        />
        <FieldError id={`${uid}-who-err`} message={errors.assigneeId} />
      </Field>
      <Field id={`${uid}-vendor`} label="Vendor">
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
    </DialogFrame>
  );
}

/* ------------------------------- part ------------------------------- */

export function PartDialog({ wo, onClose, onDone }: DialogProps) {
  const uid = useId();
  const [source, setSource] = useState<"store" | "purchase">("store");
  const [desk, setDesk] = useState<StockDesk | null>(null);
  const [deskFailed, setDeskFailed] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    stores.desk().then(
      (d) => {
        if (!alive) return;
        setDesk(d);
        const first = d.stores.find((s) => s.active);
        if (first) setStoreId((cur) => cur || first.id);
      },
      () => alive && setDeskFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  const storeOptions = useMemo(() => (desk?.stores ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: s.name, hint: s.location ?? undefined })), [desk]);
  const itemOptions = useMemo(
    () =>
      (desk?.items ?? [])
        .filter((i) => i.active)
        .map((i) => {
          const held = storeId ? (i.byStore[storeId] ?? 0) : i.onHand;
          return { value: i.id, label: `${i.code} ${i.name}`, hint: `${held} ${i.unit} in this store`, disabled: source === "store" && held <= 0 };
        }),
    [desk, storeId, source],
  );
  const item = desk?.items.find((i) => i.id === itemId) ?? null;

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    const qty = numberOrNull(quantity);
    if (qty === null || Number.isNaN(qty) || qty <= 0) local.quantity = "How many? A number above nought.";
    if (source === "store") {
      if (!storeId) local.storeId = "Choose the store it comes from.";
      if (!itemId) local.itemId = "Choose the item.";
      if (item && qty && storeId && qty > (item.byStore[storeId] ?? 0)) local.quantity = `Only ${item.byStore[storeId] ?? 0} ${item.unit} in that store.`;
    } else if (!description.trim() && !itemId) {
      local.description = "Say what to buy.";
    }
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const next = await maintenance.addPart(
        wo.id,
        source === "store"
          ? { source, storeId, itemId, quantity: qty as number }
          : { source, itemId: itemId || null, description: description.trim() || (item ? `${item.code} ${item.name}` : null), quantity: qty as number, unitCost: unitCost ?? 0 },
      );
      onDone(next, source === "store" ? "Part issued from the store." : "Part added to buy. Raise the purchase request when the list is complete.");
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
      title="Add a part"
      subtitle="From a store it is issued now at average cost. To buy, it goes on the purchase request."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label={source === "store" ? "Issue part" : "Add part to buy"} busyLabel="Adding…" />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <Segmented
        label="Where the part comes from"
        value={source}
        onChange={(s) => {
          setSource(s);
          setErrors({});
        }}
        options={[
          { key: "store", label: "From a store" },
          { key: "purchase", label: "To buy" },
        ]}
      />
      {deskFailed && source === "store" && <ErrorNote>The stores didn&apos;t load. Close this and try again, or add the part to buy.</ErrorNote>}

      {source === "store" && (
        <Field id={`${uid}-store`} label="Store">
          <SearchableSelect
            id={`${uid}-store`}
            value={storeId}
            onChange={(v) => {
              setStoreId(v);
              setItemId("");
            }}
            options={storeOptions}
            placeholder={desk === null ? "Loading stores…" : "Choose the store"}
            searchPlaceholder="Search stores"
            noOptionsText={desk === null ? "Loading stores…" : "No stores set up yet."}
            aria-invalid={errors.storeId ? true : undefined}
          />
          <FieldError message={errors.storeId} />
        </Field>
      )}

      <Field id={`${uid}-item`} label={source === "store" ? "Item" : "Item from the master"} hint={source === "purchase" ? "Optional" : undefined}>
        <SearchableSelect
          id={`${uid}-item`}
          value={itemId}
          onChange={(v) => {
            setItemId(v);
            const it = desk?.items.find((i) => i.id === v);
            if (it && source === "purchase") {
              if (!description.trim()) setDescription(`${it.code} ${it.name}`);
              if (unitCost === null) setUnitCost(it.avgCost || null);
            }
          }}
          options={itemOptions}
          clearable={source === "purchase"}
          clearLabel="Not on the item master"
          placeholder={desk === null ? "Loading items…" : "Choose the item"}
          searchPlaceholder="Search by code or name"
          noOptionsText={desk === null ? "Loading items…" : "No items on the master yet."}
          aria-invalid={errors.itemId ? true : undefined}
        />
        <FieldError message={errors.itemId} />
      </Field>

      {source === "purchase" && (
        <Field id={`${uid}-desc`} label="What to buy">
          <input id={`${uid}-desc`} className={inputClass} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} placeholder="Alternator, 12V 90A" aria-invalid={errors.description ? true : undefined} />
          <FieldError message={errors.description} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-qty`} label="Quantity">
          <input id={`${uid}-qty`} inputMode="decimal" className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={errors.quantity ? true : undefined} />
          <FieldError message={errors.quantity} />
        </Field>
        {source === "purchase" ? (
          <Field id={`${uid}-cost`} label="Estimated unit cost">
            <MoneyInput id={`${uid}-cost`} value={unitCost} onChange={setUnitCost} />
            <FieldError message={errors.unitCost} />
          </Field>
        ) : (
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">Average cost</p>
            <p className="flex h-11 items-center rounded-xl bg-neutral-50 px-3.5 text-sm text-neutral-700">{item ? <Money value={item.avgCost} /> : "Choose an item"}</p>
          </div>
        )}
      </div>
    </DialogFrame>
  );
}

/* ----------------------------- purchase ----------------------------- */

export function PurchaseDialog({ wo, onClose, onDone }: DialogProps) {
  const uid = useId();
  const [estimate, setEstimate] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const toBuy = wo.parts.filter((p) => p.source === "purchase");

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (toBuy.length === 0 && !estimate) {
      setErrors({ serviceEstimate: "Add the parts to buy first, or enter the vendor's service estimate." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const next = await maintenance.purchase(wo.id, estimate);
      const n = next.purchaseRequest?.number ?? next.pr;
      onDone(next, `${n ? `Purchase request ${n}` : "A purchase request"} drafted. Send it for approval from your requests.`);
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
      title="Raise a purchase request"
      subtitle="The parts to buy and the vendor's service go on one draft request, charged to this work."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Draft purchase request" busyLabel="Drafting…" />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      {errors.warrantyClaim && <ErrorNote>{errors.warrantyClaim}</ErrorNote>}
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Parts to buy</p>
        {toBuy.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">None listed. Add parts &ldquo;to buy&rdquo; first, or request the service only.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200/80">
            {toBuy.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 truncate text-neutral-800">
                  {p.quantity} × {p.description}
                </span>
                <Money value={p.cost} className="font-semibold" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Field id={`${uid}-est`} label="Vendor's service estimate" hint="Optional">
        <MoneyInput id={`${uid}-est`} value={estimate} onChange={setEstimate} invalid={Boolean(errors.serviceEstimate)} />
        <FieldError message={errors.serviceEstimate} />
      </Field>
    </DialogFrame>
  );
}

/* ----------------------------- complete ----------------------------- */

export function CompleteDialog({ wo, onClose, onDone }: DialogProps) {
  const uid = useId();
  const [resolution, setResolution] = useState("");
  const [usage, setUsage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const local: Errors = {};
    if (!resolution.trim()) local.resolution = "Say what was done.";
    const u = numberOrNull(usage);
    if (Number.isNaN(u)) local.usageAt = "The reading is a number, like 1250.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const next = await maintenance.complete(wo.id, resolution.trim(), u);
      onDone(next, "Marked complete. Whoever reported it confirms it is back in service.");
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
      title="Mark the work complete"
      subtitle="Downtime stops now. The asset goes back into service when the work is confirmed."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Mark complete" busyLabel="Saving…" />}
    >
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
      <Field id={`${uid}-res`} label="What was done">
        <RichTextEditor id={`${uid}-res`} minHeight={128} value={resolution} onChange={setResolution} placeholder="Replaced the starter relay and tested under load for 30 minutes." invalid={Boolean(errors.resolution ? true : undefined)} />
        <FieldError message={errors.resolution} />
      </Field>
      {wo.assetId && (
        <Field id={`${uid}-usage`} label="Hours or km on the meter" hint="Optional">
          <input id={`${uid}-usage`} inputMode="decimal" className={inputClass} value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="1250" aria-invalid={errors.usageAt ? true : undefined} />
          <FieldError message={errors.usageAt} />
          <p className="mt-1.5 text-xs text-neutral-500">For planned servicing, the next service is counted from this reading.</p>
        </Field>
      )}
    </DialogFrame>
  );
}

/* ------------------------------ cancel ------------------------------ */

export function CancelDialog({ wo, onClose, onDone }: DialogProps) {
  const uid = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!reason.trim()) {
      setError("Say why it is cancelled.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await maintenance.cancel(wo.id, reason.trim());
      onDone(next, "Work order cancelled.");
    } catch (e) {
      setError(opsError(e));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title={`Cancel ${wo.number ?? "this work order"}?`}
      subtitle="It closes without being done. Parts already issued stay issued. This can't be undone."
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Cancel work order" busyLabel="Cancelling…" danger />}
    >
      <Field id={`${uid}-reason`} label="Why">
        <input id={`${uid}-reason`} className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Raised twice; see WO-0041" aria-invalid={error ? true : undefined} />
        <FieldError message={error ?? undefined} />
      </Field>
    </DialogFrame>
  );
}
