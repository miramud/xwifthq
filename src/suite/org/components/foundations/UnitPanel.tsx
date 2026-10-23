"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRightLeft, Building, CircleDot, Coins, Crown, FolderTree, Hash, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { orgFoundations, type CostCentre, type OrgUnit, type UnitHead } from "@/lib/api/org-foundations-client";
import { Button, Chip, Panel, Segmented, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, FaceAvatar, InfoRow, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { dateLabel, moveTargets, pathOf, todayIso } from "./logic";
import { FieldError, PeoplePicker, PersonSelect, errorText, fieldErrors } from "./shared";
import { KindChip } from "./UnitTree";

/*
  One unit, beside the tree: its facts, who heads it (and who did), and the
  things you can do to it — edit, move, assign a head, add members, delete.
*/

const KINDS = ["division", "department", "unit", "team"] as const;
const ROLE_LABEL: Record<UnitHead["role"], string> = { head: "Head", deputy: "Deputy", acting: "Acting head" };

type Dialog = "edit" | "move" | "head" | "members" | null;

export default function UnitPanel({
  unit,
  units,
  costCentres,
  onChanged,
  onMoved,
  onDeleted,
}: {
  unit: OrgUnit;
  units: OrgUnit[];
  costCentres: CostCentre[];
  onChanged: (u: OrgUnit, notice: string) => void;
  onMoved: (notice: string) => void;
  onDeleted: (u: OrgUnit) => void;
}) {
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const path = pathOf(unit, units);
  const heads = useMemo(
    () => [...unit.heads].sort((a, b) => Number(Boolean(b.isCurrent)) - Number(Boolean(a.isCurrent)) || b.startsOn.localeCompare(a.startsOn)),
    [unit.heads],
  );

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${unit.name}?`,
      body: "It goes to the recycle bin. A unit can only be deleted once it has no units beneath it and nobody in it; to keep it on record, retire it instead.",
      confirmLabel: "Delete unit",
      recoverable: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await orgFoundations.units.remove(unit.id);
      onDeleted(unit);
    } catch (e) {
      setError(errorText(e, `${unit.name} wasn't deleted.`));
    }
  };

  const endHead = async (h: UnitHead) => {
    const ok = await confirm({
      title: `End ${h.name ?? "this person"}'s term as ${ROLE_LABEL[h.role].toLowerCase()}?`,
      body: `It ends today. Approvals that route to the head of ${unit.name} go to whoever holds it next, or up the tree if nobody does.`,
      confirmLabel: "End term",
      tone: "primary",
    });
    if (!ok) return;
    setError(null);
    try {
      const saved = await orgFoundations.units.endHead(unit.id, h.id, todayIso());
      onChanged(saved, `${h.name ?? "The head"}'s term ended.`);
    } catch (e) {
      setError(errorText(e, "The term wasn't ended."));
    }
  };

  return (
    <Panel
      title={unit.name}
      subtitle={path.length > 0 ? path.map((p) => p.name).join(" › ") : "Top level"}
      icon={FolderTree}
      actions={
        <Button size="sm" icon={Pencil} onClick={() => setDialog("edit")} aria-label={`Edit ${unit.name}`}>
          Edit
        </Button>
      }
    >
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <dl className="divide-y divide-neutral-100">
        <InfoRow icon={Hash} label="Code">
          <span className="font-mono">{unit.code}</span>
        </InfoRow>
        <InfoRow icon={Building} label="Kind">
          <KindChip kind={unit.kind} />
        </InfoRow>
        <InfoRow icon={Coins} label="Default cost centre" hue="mint">
          {unit.defaultCostCentre ? `${unit.defaultCostCentre.code} · ${unit.defaultCostCentre.name}` : "None"}
        </InfoRow>
        <InfoRow icon={Users} label="Members" hue="sky">
          {unit.memberCount ?? 0}
        </InfoRow>
        <InfoRow icon={CircleDot} label="Status">
          {unit.status === "active" ? (
            <Chip hue="mint" dot>
              Active
            </Chip>
          ) : (
            <Chip hue="slate" dot>
              Retired
            </Chip>
          )}
        </InfoRow>
      </dl>
      {unit.description && <p className="mt-2 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-600">{unit.description}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button size="sm" icon={ArrowRightLeft} onClick={() => setDialog("move")}>
          Move
        </Button>
        <Button size="sm" icon={UserPlus} onClick={() => setDialog("members")}>
          Add members
        </Button>
      </div>

      <section className="mt-6" aria-labelledby={`heads-${unit.id}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 id={`heads-${unit.id}`} className="text-sm font-semibold text-neutral-900">
            Heads
          </h4>
          <Button size="sm" variant="ghost" icon={Crown} onClick={() => setDialog("head")}>
            Assign head
          </Button>
        </div>
        {heads.length === 0 ? (
          <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-sm text-neutral-500">
            Nobody heads this unit. Approvals for its head go up to the unit above.
          </p>
        ) : (
          <ol className="relative space-y-1 border-l border-neutral-200 pl-4">
            {heads.map((h) => (
              <li key={h.id} className="relative py-1.5">
                <span
                  className={cx("absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full ring-4 ring-white", h.isCurrent ? "bg-primary-500" : "bg-neutral-300")}
                  aria-hidden
                />
                <div className="flex items-start gap-2.5">
                  <FaceAvatar name={h.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-neutral-900">
                      {h.name ?? "Someone"}
                      <Chip hue={h.role === "acting" ? "sun" : h.role === "deputy" ? "slate" : "blue"} className="!py-0.5">
                        {ROLE_LABEL[h.role]}
                      </Chip>
                      {h.isCurrent && (
                        <Chip hue="mint" className="!py-0.5">
                          Current
                        </Chip>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {dateLabel(h.startsOn)} – {h.endsOn ? dateLabel(h.endsOn) : "open-ended"}
                    </p>
                  </div>
                  {h.isCurrent && (
                    <Button size="sm" variant="ghost" onClick={() => void endHead(h)} aria-label={`End ${h.name ?? "this person"}'s term`}>
                      End
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-6 border-t border-neutral-100 pt-4">
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove()} className="text-error-700 hover:bg-error-500/10 hover:text-error-700">
          Delete unit
        </Button>
      </div>

      {dialog === "edit" && (
        <UnitFormDialog
          unit={unit}
          units={units}
          costCentres={costCentres}
          onClose={() => setDialog(null)}
          onSaved={(u) => {
            setDialog(null);
            onChanged(u, `${u.name} saved.`);
          }}
        />
      )}
      {dialog === "move" && (
        <MoveDialog
          unit={unit}
          units={units}
          onClose={() => setDialog(null)}
          onMoved={(notice) => {
            setDialog(null);
            onMoved(notice);
          }}
        />
      )}
      {dialog === "head" && (
        <HeadDialog
          unit={unit}
          onClose={() => setDialog(null)}
          onSaved={(u, who) => {
            setDialog(null);
            onChanged(u, `${who} now heads ${u.name}.`);
          }}
        />
      )}
      {dialog === "members" && (
        <MembersDialog
          unit={unit}
          onClose={() => setDialog(null)}
          onSaved={(moved) => {
            setDialog(null);
            onMoved(`${moved} ${moved === 1 ? "person" : "people"} moved into ${unit.name}.`);
          }}
        />
      )}
    </Panel>
  );
}

/* ------------------------------ dialogs ----------------------------- */

const label = "mb-1.5 block text-sm font-medium text-neutral-700";

export function UnitFormDialog({
  unit,
  units,
  costCentres,
  parentId: initialParent = null,
  onClose,
  onSaved,
}: {
  unit: OrgUnit | null;
  units: OrgUnit[];
  costCentres: CostCentre[];
  parentId?: string | null;
  onClose: () => void;
  onSaved: (u: OrgUnit) => void;
}) {
  const uid = useId();
  const [code, setCode] = useState(unit?.code ?? "");
  const [name, setName] = useState(unit?.name ?? "");
  const [kind, setKind] = useState<string>(unit?.kind ?? "department");
  const [parentId, setParentId] = useState<string>(initialParent ?? "");
  const [description, setDescription] = useState(unit?.description ?? "");
  const [ccId, setCcId] = useState(unit?.defaultCostCentre?.id ?? "");
  const [status, setStatus] = useState<"active" | "retired">(unit?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (code.trim() === "") found.code = "Give the unit a short code.";
    if (name.trim() === "") found.name = "Give the unit a name.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const body = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        kind,
        description: description.trim() || null,
        defaultCostCentreId: ccId || null,
      };
      const saved = unit
        ? await orgFoundations.units.update(unit.id, { ...body, status })
        : await orgFoundations.units.create({ ...body, parentId: parentId || null });
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, unit ? `${unit.name} wasn't saved.` : "The unit wasn't added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={unit ? `Edit ${unit.name}` : "New unit"}
      subtitle="Units are the divisions, departments and teams people belong to and approvals route through."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : unit ? "Save unit" : "Add unit"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div>
          <label htmlFor={`${uid}-code`} className={label}>
            Code
          </label>
          <input
            id={`${uid}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={16}
            placeholder="FIN"
            aria-invalid={errors.code ? true : undefined}
            className={cx(inputClass, "font-mono")}
          />
          <FieldError message={errors.code} />
        </div>
        <div>
          <label htmlFor={`${uid}-name`} className={label}>
            Name
          </label>
          <input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} aria-invalid={errors.name ? true : undefined} className={inputClass} />
          <FieldError message={errors.name} />
        </div>
      </div>
      <div>
        <span className={label}>Kind</span>
        <div className="overflow-x-auto">
          <Segmented label="Kind" value={kind} onChange={setKind} options={KINDS.map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))} />
        </div>
      </div>
      {!unit && (
        <div>
          <label htmlFor={`${uid}-parent`} className={label}>
            Sits under
          </label>
          <SearchableSelect
            id={`${uid}-parent`}
            value={parentId}
            onChange={setParentId}
            options={units.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name, hint: u.code }))}
            clearable
            clearLabel="Top level (no parent)"
            placeholder="Top level (no parent)"
          />
        </div>
      )}
      <div>
        <label htmlFor={`${uid}-cc`} className={label}>
          Default cost centre
        </label>
        <SearchableSelect
          id={`${uid}-cc`}
          value={ccId}
          onChange={setCcId}
          options={costCentres.filter((c) => c.status === "active" || c.id === ccId).map((c) => ({ value: c.id, label: c.name, hint: c.code }))}
          clearable
          placeholder="None"
          aria-describedby={`${uid}-cc-hint`}
        />
        <p id={`${uid}-cc-hint`} className="mt-1.5 text-xs text-neutral-500">
          Spending raised in this unit is charged here unless someone picks another.
        </p>
      </div>
      <div>
        <label htmlFor={`${uid}-desc`} className={label}>
          Description
        </label>
        <textarea id={`${uid}-desc`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      </div>
      {unit && (
        <div>
          <span className={label}>Status</span>
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { key: "active", label: "Active" },
              { key: "retired", label: "Retired" },
            ]}
          />
          <p className="mt-1.5 text-xs text-neutral-500">A retired unit keeps its history but stops being offered in pickers.</p>
        </div>
      )}
    </DialogFrame>
  );
}

function MoveDialog({ unit, units, onClose, onMoved }: { unit: OrgUnit; units: OrgUnit[]; onClose: () => void; onMoved: (notice: string) => void }) {
  const uid = useId();
  const [parentId, setParentId] = useState(unit.parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = moveTargets(unit, units);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await orgFoundations.units.move(unit.id, parentId || null);
      const to = units.find((u) => u.id === parentId);
      onMoved(to ? `${unit.name} moved under ${to.name}.` : `${unit.name} moved to the top level.`);
    } catch (err) {
      // 422: a loop, or the tree would be too deep.
      setError(errorText(err, `${unit.name} wasn't moved.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Move ${unit.name}`}
      subtitle="Everything beneath it moves too. A unit can't move under itself or anything beneath it."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || parentId === (unit.parentId ?? "")}>
            {busy ? "Moving…" : "Move unit"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div>
        <label htmlFor={`${uid}-parent`} className={label}>
          New parent
        </label>
        <SearchableSelect
          id={`${uid}-parent`}
          value={parentId}
          onChange={setParentId}
          options={targets.map((u) => ({ value: u.id, label: u.name, hint: u.code }))}
          clearable
          clearLabel="Top level (no parent)"
          placeholder="Top level (no parent)"
        />
      </div>
    </DialogFrame>
  );
}

function HeadDialog({ unit, onClose, onSaved }: { unit: OrgUnit; onClose: () => void; onSaved: (u: OrgUnit, who: string) => void }) {
  const uid = useId();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<UnitHead["role"]>("head");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [endsOn, setEndsOn] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!userId) found.userId = "Choose who heads the unit.";
    if (role === "acting" && !endsOn) found.endsOn = "Acting cover needs an end date.";
    if (endsOn && startsOn && endsOn < startsOn) found.endsOn = "The end date has to be after the start.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const saved = await orgFoundations.units.assignHead(unit.id, { userId, role, startsOn, endsOn: endsOn || null });
      const who = saved.heads.find((h) => h.userId === userId)?.name ?? "They";
      onSaved(saved, who);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorText(err, "The head wasn't assigned."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Assign a head to ${unit.name}`}
      subtitle="A new head ends the current one's term the day before. Acting cover takes over only while its dates last."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Assigning…" : "Assign head"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div>
        <label htmlFor={`${uid}-person`} className={label}>
          Person
        </label>
        <PersonSelect id={`${uid}-person`} value={userId} onChange={setUserId} invalid={Boolean(errors.userId)} />
        <FieldError message={errors.userId} />
      </div>
      <div>
        <span className={label}>Role</span>
        <Segmented
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { key: "head", label: "Head" },
            { key: "deputy", label: "Deputy" },
            { key: "acting", label: "Acting" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-from`} className={label}>
            Starts on
          </label>
          <input id={`${uid}-from`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-to`} className={label}>
            Ends on {role !== "acting" && <span className="font-normal text-neutral-500">(optional)</span>}
          </label>
          <input
            id={`${uid}-to`}
            type="date"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
            aria-invalid={errors.endsOn ? true : undefined}
            className={inputClass}
          />
          <FieldError message={errors.endsOn} />
        </div>
      </div>
    </DialogFrame>
  );
}

function MembersDialog({ unit, onClose, onSaved }: { unit: OrgUnit; onClose: () => void; onSaved: (moved: number) => void }) {
  const uid = useId();
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ids.length === 0) {
      setError("Choose at least one person.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await orgFoundations.units.addMembers(unit.id, ids);
      onSaved(r.moved);
    } catch (err) {
      setError(errorText(err, "Nobody was moved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${uid}-title`}
      title={`Add people to ${unit.name}`}
      subtitle="Each person belongs to one unit, so they move here from wherever they are now."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || ids.length === 0}>
            {busy ? "Adding…" : ids.length > 1 ? `Add ${ids.length} people` : "Add person"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div>
        <label htmlFor={`${uid}-people`} className={label}>
          People
        </label>
        <PeoplePicker id={`${uid}-people`} values={ids} onChange={setIds} />
      </div>
    </DialogFrame>
  );
}
