"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect, type SelectOption } from "@/components/workspace/SearchableSelect";
import { DialogFrame } from "@/suite/org/components/ui";
import { ErrorNote, Field, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { opsError, opsFieldErrors, type MeOptions } from "@/lib/api/operations-procurement-client";
import { stores, type Catalogue, type Requisition, type RequisitionInput } from "@/lib/api/operations-stores-client";
import { parseQty } from "@/suite/operations/components/procurement/meta";

/**
 * Ask a store for consumables: which store, what and how many (from the
 * catalogue, searchable by name or code), what for, and the project or cost
 * centre it is charged to. It goes for approval as soon as it is sent.
 */

interface Row {
  key: string;
  itemId: string;
  quantity: string;
}

let seq = 0;
const newRow = (): Row => ({ key: `r${++seq}`, itemId: "", quantity: "1" });

export interface RequisitionForm {
  storeId: string;
  purpose: string;
  funding: "project" | "costCentre";
  projectId: string;
  costCentreId: string;
  rows: Row[];
}

/** The requisition as the API takes it, or what is missing. Row errors are keyed `row.{key}`. Pure, for testing. */
export function toRequisition(f: RequisitionForm): { input: RequisitionInput | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!f.storeId) errors.storeId = "Choose the store to draw from.";
  const filled = f.rows.filter((r) => r.itemId || r.quantity.trim() !== "1");
  if (filled.length === 0) errors.lines = "Ask for at least one item.";
  const seen = new Set<string>();
  for (const r of filled) {
    const q = parseQty(r.quantity);
    if (!r.itemId) errors[`row.${r.key}`] = "Choose the item.";
    else if (seen.has(r.itemId)) errors[`row.${r.key}`] = "This item is already on the list. Change its quantity instead.";
    else if (q === null || q <= 0) errors[`row.${r.key}`] = "The quantity is a number above 0, like 2 or 0.5.";
    seen.add(r.itemId);
  }
  if (Object.keys(errors).length) return { input: null, errors };
  return {
    errors,
    input: {
      storeId: f.storeId,
      purpose: f.purpose.trim() || null,
      projectId: f.funding === "project" && f.projectId ? f.projectId : null,
      costCentreId: f.funding === "costCentre" && f.costCentreId ? f.costCentreId : null,
      lines: filled.map((r) => ({ itemId: r.itemId, quantity: parseQty(r.quantity) as number })),
    },
  };
}

export function NewRequisitionDialog({ catalogue, options, onDone, onClose }: { catalogue: Catalogue; options: MeOptions | null; onDone: (r: Requisition) => void; onClose: () => void }) {
  const uid = useId();
  const [form, setForm] = useState<RequisitionForm>(() => ({
    storeId: catalogue.stores.length === 1 ? catalogue.stores[0].id : "",
    purpose: "",
    funding: "costCentre",
    projectId: "",
    costCentreId: "",
    rows: [newRow()],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const itemOptions: SelectOption[] = useMemo(
    () => catalogue.items.map((i) => ({ value: i.id, label: i.name, hint: `${i.code} · ${i.unit}`, group: catalogue.categories[i.category] ?? i.category })),
    [catalogue],
  );
  const units = useMemo(() => Object.fromEntries(catalogue.items.map((i) => [i.id, i.unit])), [catalogue]);
  const set = <K extends keyof RequisitionForm>(k: K, v: RequisitionForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (key: string, patch: Partial<Row>) => setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const { input, errors: local } = toRequisition(form);
    if (!input) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      onDone(await stores.me.createRequisition(input));
    } catch (e) {
      const f = opsFieldErrors(e);
      const out: Record<string, string> = {};
      const sent = form.rows.filter((r) => r.itemId);
      for (const [k, v] of Object.entries(f)) {
        const m = /^lines\.(\d+)\./.exec(k);
        if (m && sent[Number(m[1])]) out[`row.${sent[Number(m[1])].key}`] = v;
        else if (k === "storeId" || k === "lines") out[k] = v;
        else if (k === "projectId" || k === "costCentreId") out.funding = v;
        else out.general = out.general ?? v;
      }
      setErrors(Object.keys(out).length ? out : { general: opsError(e) });
      setBusy(false);
    }
  };

  const projects: SelectOption[] = (options?.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined }));
  const costCentres: SelectOption[] = (options?.costCentres ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }));

  return (
    <DialogFrame
      as="form"
      size="lg"
      onSubmit={submit}
      titleId={`${uid}-t`}
      title="Ask the store for items"
      subtitle="Stationery, toner, refreshments and the like. Your head of unit approves it, then the store issues what it has."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send requisition"}
          </Button>
        </div>
      }
    >
      <Field id={`${uid}-store`} label="From store">
        <SearchableSelect
          id={`${uid}-store`}
          value={form.storeId}
          onChange={(v) => set("storeId", v)}
          options={catalogue.stores.map((s) => ({ value: s.id, label: s.name, hint: s.location ?? undefined }))}
          placeholder="Choose a store"
          searchPlaceholder="Search stores"
          noOptionsText="No store is open yet."
          aria-invalid={errors.storeId ? true : undefined}
        />
        <FieldError message={errors.storeId} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">What you need</legend>
        <ol className="space-y-2">
          {form.rows.map((r, i) => {
            const err = errors[`row.${r.key}`];
            return (
              <li key={r.key} className={cx("rounded-2xl border p-3", err ? "border-error-500/40" : "border-neutral-200/80")}>
                <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_110px_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={`${uid}-item-${r.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      Item {i + 1}
                    </label>
                    <SearchableSelect
                      id={`${uid}-item-${r.key}`}
                      value={r.itemId}
                      onChange={(v) => setRow(r.key, { itemId: v })}
                      options={itemOptions}
                      placeholder="Choose an item"
                      searchPlaceholder="Search by name or code"
                      noOptionsText="The stores have no items listed yet."
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-q-${r.key}`} className="mb-1 block text-xs font-medium text-neutral-600">
                      How many{r.itemId && units[r.itemId] ? ` (${units[r.itemId]})` : ""}, item {i + 1}
                    </label>
                    <input id={`${uid}-q-${r.key}`} inputMode="decimal" value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })} className={cx(inputClass, "text-right tabular-nums")} />
                  </div>
                  <button
                    type="button"
                    onClick={() => set("rows", form.rows.filter((x) => x.key !== r.key))}
                    disabled={form.rows.length === 1}
                    aria-label={`Remove item ${i + 1}`}
                    className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                <FieldError message={err} />
              </li>
            );
          })}
        </ol>
        <Button size="sm" icon={Plus} className="mt-2" onClick={() => set("rows", [...form.rows, newRow()])} disabled={form.rows.length >= 50}>
          Add another item
        </Button>
        <FieldError message={errors.lines} />
      </fieldset>

      <Field id={`${uid}-why`} label="What it is for" hint="Optional">
        <textarea id={`${uid}-why`} rows={2} maxLength={2000} className={textareaClass} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Exam week printing, the board meeting, the new starters' desks" />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">Charge to</p>
        <Segmented
          label="Charge to"
          value={form.funding}
          onChange={(v) => set("funding", v)}
          options={[
            { key: "costCentre", label: "Cost centre" },
            { key: "project", label: "Project" },
          ]}
        />
        <div className="mt-3">
          {form.funding === "project" ? (
            <SearchableSelect
              id={`${uid}-project`}
              aria-label="Project"
              value={form.projectId}
              onChange={(v) => set("projectId", v)}
              options={projects}
              clearable
              clearLabel="No project"
              placeholder="Choose the project"
              searchPlaceholder="Search projects"
              noOptionsText="No projects in this organisation."
            />
          ) : (
            <SearchableSelect
              id={`${uid}-cc`}
              aria-label="Cost centre"
              value={form.costCentreId}
              onChange={(v) => set("costCentreId", v)}
              options={costCentres}
              clearable
              clearLabel="My unit's cost centre"
              placeholder="My unit's cost centre"
              searchPlaceholder="Search cost centres"
              noOptionsText="No cost centres yet."
            />
          )}
        </div>
        <FieldError message={errors.funding} />
      </div>
      {errors.general && <ErrorNote>{errors.general}</ErrorNote>}
    </DialogFrame>
  );
}
