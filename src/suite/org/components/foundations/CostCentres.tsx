"use client";

import { useId, useState } from "react";
import { Coins, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { orgFoundations, type CostCentre, type OrgUnit } from "@/lib/api/org-foundations-client";
import { Button, Chip, Empty } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ActionMenu } from "@/components/dashboard/ui";
import { ErrorNote, FaceAvatar, IconTile, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { dateLabel } from "./logic";
import { FieldError, PersonSelect, errorText, fieldErrors } from "./shared";

/*
  Cost centres: where spending is charged. Each may belong to a unit and name
  a budget holder; one can be closed (no new charges) or limited to dates.
*/

export function centreState(c: CostCentre): { label: string; hue: "mint" | "slate" | "sun" } {
  if (c.status === "closed") return { label: "Closed", hue: "slate" };
  if (!c.isOpen) return { label: "Outside its dates", hue: "sun" };
  return { label: "Open", hue: "mint" };
}

function validity(c: CostCentre): string {
  if (!c.validFrom && !c.validTo) return "Any time";
  if (c.validFrom && c.validTo) return `${dateLabel(c.validFrom)} to ${dateLabel(c.validTo)}`;
  return c.validFrom ? `From ${dateLabel(c.validFrom)}` : `Until ${dateLabel(c.validTo)}`;
}

export default function CostCentres({
  rows,
  units,
  onSaved,
  onDeleted,
  onEdit,
  onError,
}: {
  rows: CostCentre[];
  units: OrgUnit[];
  onSaved: (c: CostCentre, notice: string) => void;
  onDeleted: (c: CostCentre) => void;
  onEdit: (c: CostCentre) => void;
  onError: (message: string) => void;
}) {
  const confirm = useConfirm();

  const toggle = async (c: CostCentre) => {
    const closing = c.status === "active";
    if (closing) {
      const ok = await confirm({
        title: `Close ${c.code}?`,
        body: "Nothing new can be charged to it. What's already charged stays. You can reopen it later.",
        confirmLabel: "Close cost centre",
        tone: "primary",
      });
      if (!ok) return;
    }
    try {
      const saved = await orgFoundations.costCentres.update(c.id, { status: closing ? "closed" : "active" });
      onSaved(saved, closing ? `${saved.code} closed.` : `${saved.code} reopened.`);
    } catch (e) {
      onError(errorText(e, `${c.code} wasn't changed.`));
    }
  };

  const remove = async (c: CostCentre) => {
    const ok = await confirm({
      title: `Delete ${c.code} · ${c.name}?`,
      body: "It goes to the recycle bin. It can't be deleted while a unit uses it as its default; close it instead to stop new charges.",
      confirmLabel: "Delete cost centre",
      recoverable: true,
    });
    if (!ok) return;
    try {
      await orgFoundations.costCentres.remove(c.id);
      onDeleted(c);
    } catch (e) {
      onError(errorText(e, `${c.code} wasn't deleted.`));
    }
  };

  const actions = (c: CostCentre) => (
    <ActionMenu
      label={`Actions for ${c.code}`}
      items={[
        { label: "Edit", icon: Pencil, onClick: () => onEdit(c) },
        c.status === "active" ? { label: "Close", icon: Lock, onClick: () => void toggle(c) } : { label: "Reopen", icon: LockOpen, onClick: () => void toggle(c) },
        { label: "Delete", icon: Trash2, danger: true, onClick: () => void remove(c) },
      ]}
    />
  );

  const state = (c: CostCentre) => {
    const s = centreState(c);
    return (
      <Chip hue={s.hue} dot>
        {s.label}
      </Chip>
    );
  };

  const holder = (c: CostCentre) =>
    c.budgetHolder ? (
      <span className="flex items-center gap-2">
        <FaceAvatar name={c.budgetHolder.name} size={24} />
        <span className="truncate text-sm text-neutral-700">{c.budgetHolder.name}</span>
      </span>
    ) : (
      <span className="text-sm text-neutral-500">Nobody</span>
    );

  const columns: Column<CostCentre>[] = [
    { key: "code", header: "Code", sortable: true, value: (c) => c.code, render: (c) => <span className="font-mono text-[13px] font-semibold text-neutral-800">{c.code}</span> },
    { key: "name", header: "Name", primary: true, sortable: true, value: (c) => c.name },
    { key: "unit", header: "Unit", sortable: true, value: (c) => c.orgUnit?.name ?? "", render: (c) => c.orgUnit?.name ?? <span className="text-neutral-500">No unit</span> },
    { key: "holder", header: "Budget holder", sortable: true, value: (c) => c.budgetHolder?.name ?? "", render: holder, hideOnMobile: true },
    { key: "state", header: "Status", value: (c) => centreState(c).label, render: state },
    { key: "valid", header: "Valid", value: (c) => validity(c), hideOnMobile: true },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(c) => c.id}
      storageKey="org.cost-centres"
      caption="Cost centres"
      searchPlaceholder="Search cost centres"
      empty={
        <Empty
          icon={Coins}
          hue="mint"
          title={units.length === 0 && rows.length === 0 ? "No cost centres yet." : "No cost centre matches."}
          hint={rows.length === 0 ? "Add the first with New cost centre. Units can then charge to it by default." : "Try another word."}
        />
      }
      renderCard={(c) => (
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <IconTile icon={Coins} hue="mint" size={38} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-semibold text-neutral-500">{c.code}</p>
              <p className="truncate text-[15px] font-semibold text-neutral-900">{c.name}</p>
            </div>
            {actions(c)}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {state(c)}
            {c.orgUnit && <Chip hue="sky">{c.orgUnit.name}</Chip>}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            {holder(c)}
            <span>{validity(c)}</span>
          </div>
        </div>
      )}
    />
  );
}

export function CostCentreDialog({
  centre,
  units,
  onClose,
  onSaved,
}: {
  centre: CostCentre | null;
  units: OrgUnit[];
  onClose: () => void;
  onSaved: (c: CostCentre) => void;
}) {
  const uid = useId();
  const [code, setCode] = useState(centre?.code ?? "");
  const [name, setName] = useState(centre?.name ?? "");
  const [description, setDescription] = useState(centre?.description ?? "");
  const [unitId, setUnitId] = useState(centre?.orgUnit?.id ?? "");
  const [holderId, setHolderId] = useState(centre?.budgetHolder?.id ?? "");
  const [validFrom, setValidFrom] = useState(centre?.validFrom?.slice(0, 10) ?? "");
  const [validTo, setValidTo] = useState(centre?.validTo?.slice(0, 10) ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lbl = "mb-1.5 block text-sm font-medium text-neutral-700";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (code.trim() === "") found.code = "Give the cost centre a code.";
    if (name.trim() === "") found.name = "Give the cost centre a name.";
    if (validFrom && validTo && validTo < validFrom) found.validTo = "The end date has to be after the start.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const body = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      orgUnitId: unitId || null,
      budgetHolderId: holderId || null,
      validFrom: validFrom || null,
      validTo: validTo || null,
    };
    try {
      const saved = centre ? await orgFoundations.costCentres.update(centre.id, body) : await orgFoundations.costCentres.create(body);
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, centre ? `${centre.code} wasn't saved.` : "The cost centre wasn't added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={centre ? `Edit ${centre.code}` : "New cost centre"}
      subtitle="Where spending is charged, and who answers for its budget."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : centre ? "Save cost centre" : "Add cost centre"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor={`${uid}-code`} className={lbl}>
            Code
          </label>
          <input
            id={`${uid}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={32}
            placeholder="CC-FIN-01"
            aria-invalid={errors.code ? true : undefined}
            className={`${inputClass} font-mono`}
          />
          <FieldError message={errors.code} />
        </div>
        <div>
          <label htmlFor={`${uid}-name`} className={lbl}>
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-unit`} className={lbl}>
            Unit
          </label>
          <SearchableSelect
            id={`${uid}-unit`}
            value={unitId}
            onChange={setUnitId}
            options={units.filter((u) => u.status === "active" || u.id === unitId).map((u) => ({ value: u.id, label: u.name, hint: u.code }))}
            clearable
            placeholder="No unit"
          />
        </div>
        <div>
          <label htmlFor={`${uid}-holder`} className={lbl}>
            Budget holder
          </label>
          <PersonSelect id={`${uid}-holder`} value={holderId} onChange={setHolderId} clearable placeholder="Nobody" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-from`} className={lbl}>
            Valid from <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input id={`${uid}-from`} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-to`} className={lbl}>
            Valid to <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id={`${uid}-to`}
            type="date"
            value={validTo}
            min={validFrom || undefined}
            onChange={(e) => setValidTo(e.target.value)}
            aria-invalid={errors.validTo ? true : undefined}
            className={inputClass}
          />
          <FieldError message={errors.validTo} />
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-desc`} className={lbl}>
          Description
        </label>
        <textarea id={`${uid}-desc`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      </div>
    </DialogFrame>
  );
}
