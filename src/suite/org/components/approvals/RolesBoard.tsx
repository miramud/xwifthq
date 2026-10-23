"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, ChevronRight, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { ApiError, orgFoundations, type ApprovalRole, type ApprovalRoleHolder } from "@/lib/api/org-foundations-client";
import { AvatarStack, Button, Chip, Empty, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ActionMenu } from "@/components/dashboard/ui";
import { ErrorNote, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { invalidateLookup, type LookupKey } from "./lookups";
import { ApprovalsHeader, FieldError, LookupSelect, shortDate, smallLabel } from "./parts";

/*
  Approval roles: the named positions a policy routes to (Bursar, Dean,
  Head of Procurement), separate from access roles so "who approves" never
  depends on "who can open a screen". Each role names who holds it — a
  person, everybody with a job title, the head of a unit, or everybody with
  an access role — and a superior that a vacant stage falls back to.
*/

export const HOLDER_TYPES: { value: ApprovalRoleHolder["type"]; label: string; field: string; lookup: LookupKey; pick: string }[] = [
  { value: "user", label: "A person", field: "Person", lookup: "people", pick: "Choose a person" },
  { value: "job_title", label: "Everyone with a job title", field: "Job title", lookup: "jobTitles", pick: "Choose a job title" },
  { value: "unit_head", label: "The head of a unit", field: "Unit", lookup: "units", pick: "Choose a unit" },
  { value: "access_role", label: "Everyone with an access role", field: "Access role", lookup: "accessRoles", pick: "Choose an access role" },
];

/** Role → superior → superior's superior, stopping at a repeat. */
export function chainOf(role: ApprovalRole, all: ApprovalRole[]): ApprovalRole[] {
  const out: ApprovalRole[] = [role];
  const seen = new Set([role.id]);
  let next = role.parent ? all.find((r) => r.id === role.parent!.id) : undefined;
  while (next && !seen.has(next.id) && out.length < 12) {
    out.push(next);
    seen.add(next.id);
    next = next.parent ? all.find((r) => r.id === next!.parent!.id) : undefined;
  }
  return out;
}

export default function RolesBoard() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<ApprovalRole[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApprovalRole | "new" | null>(null);
  const [holdersOf, setHoldersOf] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    orgFoundations.approvals.roles
      .list()
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setLoadError(e instanceof ApiError ? e.message : "The approval roles didn't load."));
    return () => {
      alive = false;
    };
  }, []);

  const put = (role: ApprovalRole) => {
    setRows((r) => (r ? (r.some((x) => x.id === role.id) ? r.map((x) => (x.id === role.id ? role : x)) : [...r, role]) : [role]));
    invalidateLookup("approvalRoles");
  };

  const remove = async (role: ApprovalRole) => {
    const ok = await confirm({
      title: `Delete ${role.name}?`,
      body: "Approvals stop routing to it. A role that a policy still uses, or that other roles fall back to, can't be deleted.",
      confirmLabel: "Delete role",
    });
    if (!ok) return;
    setError(null);
    try {
      await orgFoundations.approvals.roles.remove(role.id);
      setRows((r) => r?.filter((x) => x.id !== role.id) ?? r);
      invalidateLookup("approvalRoles");
      setNotice(`${role.name} deleted.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.errors?.role?.[0] ?? e.message : `${role.name} wasn't deleted.`);
    }
  };

  const all = rows ?? [];
  const vacant = all.filter((r) => r.vacant).length;

  const holdersCell = (r: ApprovalRole) =>
    r.currentPeople.length > 0 ? (
      <span className="flex items-center gap-2">
        <AvatarStack people={r.currentPeople.map((p) => ({ name: p.name }))} size={26} />
        <span className="truncate text-xs text-neutral-600">{r.currentPeople.length === 1 ? r.currentPeople[0].name : `${r.currentPeople.length} people`}</span>
      </span>
    ) : (
      <Chip hue="rose" icon={AlertTriangle}>
        Vacant
      </Chip>
    );

  const actions = (r: ApprovalRole) => (
    <ActionMenu
      label={`Actions for ${r.name}`}
      items={[
        { label: "Holders", icon: UserPlus, onClick: () => setHoldersOf(r.id) },
        { label: "Edit", icon: Pencil, onClick: () => setEditing(r) },
        { label: "Delete", icon: Trash2, danger: true, onClick: () => void remove(r) },
      ]}
    />
  );

  const columns: Column<ApprovalRole>[] = [
    {
      key: "name",
      header: "Role",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="block">
          <span className="block font-semibold text-neutral-900">{r.name}</span>
          <span className="font-mono text-xs text-neutral-500">{r.code}</span>
        </span>
      ),
    },
    { key: "parent", header: "Falls back to", sortable: true, value: (r) => r.parent?.name ?? "", render: (r) => (r.parent ? r.parent.name : <span className="text-neutral-500">Nobody (top)</span>) },
    { key: "holders", header: "Held by", value: (r) => r.currentPeople.map((p) => p.name).join(", "), render: holdersCell },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <div>
      <ApprovalsHeader
        active="roles"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
            New approval role
          </Button>
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {loadError && <ErrorNote className="mb-4">{loadError}</ErrorNote>}
      {vacant > 0 && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          {vacant === 1 ? "One role has" : `${vacant} roles have`} nobody holding it today. Requests reaching them go to the superior, or wait for an administrator.
        </p>
      )}

      {rows === null && !loadError ? (
        <Skeleton className="h-[320px]" />
      ) : rows !== null ? (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="org.approvals.roles"
          caption="Approval roles"
          searchPlaceholder="Search roles"
          onRowClick={(r) => setHoldersOf(r.id)}
          empty={
            <Empty
              icon={Users}
              title="No approval roles yet"
              hint="Create the positions your approvals go to, like Bursar or Head of Department, then say who holds them."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                  New approval role
                </Button>
              }
            />
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-neutral-900">{r.name}</p>
                  <p className="font-mono text-xs text-neutral-500">{r.code}</p>
                </div>
                <span onClick={(e) => e.stopPropagation()}>{actions(r)}</span>
              </div>
              {r.description && <p className="text-sm text-neutral-600">{r.description}</p>}
              <Chain chain={chainOf(r, all)} />
              <div className="mt-auto border-t border-neutral-100 pt-3">{holdersCell(r)}</div>
            </div>
          )}
        />
      ) : null}

      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          all={all}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            put(r);
            setNotice(editing === "new" ? `${r.name} created. Now say who holds it.` : `${r.name} saved.`);
            setEditing(null);
            if (editing === "new") setHoldersOf(r.id);
          }}
        />
      )}
      {holdersOf && rows && (
        <HoldersDialog role={rows.find((r) => r.id === holdersOf)!} all={all} onClose={() => setHoldersOf(null)} onChanged={put} />
      )}
    </div>
  );
}

/** The fallback chain as chips with arrows: Dean › Provost › Rector. */
export function Chain({ chain }: { chain: ApprovalRole[] }) {
  if (chain.length <= 1) return <p className="text-xs text-neutral-500">Top of its chain: nobody above it.</p>;
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Falls back to, in order">
      {chain.map((r, i) => (
        <li key={r.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-neutral-400" aria-hidden />}
          <span
            className={cx(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              i === 0 ? "bg-primary-600 text-white" : r.vacant ? "bg-rose-50 text-rose-700" : "bg-neutral-100 text-neutral-700",
            )}
          >
            {r.name}
            {r.vacant && i > 0 ? " (vacant)" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RoleDialog({ role, all, onClose, onSaved }: { role: ApprovalRole | null; all: ApprovalRole[]; onClose: () => void; onSaved: (r: ApprovalRole) => void }) {
  const id = useId();
  const [code, setCode] = useState(role?.code ?? "");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [parentId, setParentId] = useState(role?.parent?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A role can't fall back to itself or to anything that already falls back to it.
  const below = new Set(role ? all.filter((r) => chainOf(r, all).some((x) => x.id === role.id)).map((r) => r.id) : []);
  const options = all.filter((r) => !below.has(r.id)).map((r) => ({ value: r.id, label: r.name, hint: r.code }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const saved = role
        ? await orgFoundations.approvals.roles.update(role.id, { name, description: description || null, parentId: parentId || null })
        : await orgFoundations.approvals.roles.create({ code, name, description: description || null, parentId: parentId || null });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      else setError(err instanceof ApiError ? err.message : "The role wasn't saved.");
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title={role ? `Edit ${role.name}` : "New approval role"}
      onClose={onClose}
      as="form"
      onSubmit={save}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === "" || (!role && code.trim() === "")}>
            {busy ? "Saving…" : role ? "Save role" : "Create role"}
          </Button>
        </div>
      }
    >
      {!role && (
        <div>
          <label htmlFor={`${id}-code`} className={smallLabel}>
            Code
          </label>
          <input
            id={`${id}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            maxLength={48}
            placeholder="BURSAR"
            aria-describedby={`${id}-code-hint`}
            aria-invalid={Boolean(errors.code) || undefined}
            className={cx(inputClass, "font-mono")}
          />
          <p id={`${id}-code-hint`} className="mt-1 text-xs text-neutral-500">
            Letters, digits and underscores, starting with a letter. Policies name the role by this; it can&apos;t change later.
          </p>
          <FieldError message={errors.code?.[0]} />
        </div>
      )}
      <div>
        <label htmlFor={`${id}-name`} className={smallLabel}>
          Name
        </label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Bursar" aria-invalid={Boolean(errors.name) || undefined} className={inputClass} />
        <FieldError message={errors.name?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-desc`} className={smallLabel}>
          Description
        </label>
        <textarea id={`${id}-desc`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={textareaClass} />
      </div>
      <div>
        <label htmlFor={`${id}-parent`} className={smallLabel}>
          Falls back to (superior)
        </label>
        <SearchableSelect
          id={`${id}-parent`}
          value={parentId}
          onChange={setParentId}
          options={options}
          clearable
          clearLabel="Nobody: this is the top"
          placeholder="Nobody: this is the top"
          aria-invalid={Boolean(errors.parentId) || undefined}
          aria-describedby={`${id}-parent-hint`}
        />
        <p id={`${id}-parent-hint`} className="mt-1 text-xs text-neutral-500">
          When nobody holds this role, its stages go to the superior instead.
        </p>
        <FieldError message={errors.parentId?.[0]} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function HoldersDialog({ role, all, onClose, onChanged }: { role: ApprovalRole; all: ApprovalRole[]; onClose: () => void; onChanged: (r: ApprovalRole) => void }) {
  const id = useId();
  const confirm = useConfirm();
  const [type, setType] = useState<ApprovalRoleHolder["type"]>("user");
  const [holderId, setHolderId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const holderType = HOLDER_TYPES.find((t) => t.value === type)!;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holderId) return;
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const updated = await orgFoundations.approvals.roles.addHolder(role.id, {
        type,
        holderId,
        unitId: unitId || null,
        validFrom: validFrom || null,
        validTo: validTo || null,
      });
      onChanged(updated);
      setHolderId("");
      setUnitId("");
      setValidFrom("");
      setValidTo("");
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      else setError(err instanceof ApiError ? err.message : "The holder wasn't added.");
    } finally {
      setBusy(false);
    }
  };

  const removeHolder = async (h: ApprovalRoleHolder) => {
    const ok = await confirm({ title: `Remove ${h.label} from ${role.name}?`, body: "New requests stop routing to them through this role.", confirmLabel: "Remove holder" });
    if (!ok) return;
    try {
      onChanged(await orgFoundations.approvals.roles.removeHolder(role.id, h.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The holder wasn't removed.");
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title={`Who holds ${role.name}`}
      subtitle={role.vacant ? "Nobody holds it today." : `Today: ${role.currentPeople.map((p) => p.name).join(", ")}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <Chain chain={chainOf(role, all)} />

      {role.holders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">No holders yet. Add one below.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
          {role.holders.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{h.label}</p>
                <p className="text-xs text-neutral-500">
                  {HOLDER_TYPES.find((t) => t.value === h.type)?.label}
                  {h.unit ? ` · only for ${h.unit}` : ""}
                  {h.validFrom || h.validTo ? ` · ${h.validFrom ? shortDate(h.validFrom) : "now"} to ${h.validTo ? shortDate(h.validTo) : "open-ended"}` : ""}
                </p>
              </div>
              <Chip hue={h.current ? "mint" : "slate"} dot>
                {h.current ? "Current" : "Not current"}
              </Chip>
              <button
                type="button"
                onClick={() => void removeHolder(h)}
                aria-label={`Remove ${h.label}`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-700"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-4 rounded-2xl bg-neutral-50/70 p-4" aria-label="Add a holder">
        <fieldset>
          <legend className={smallLabel}>Add a holder</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HOLDER_TYPES.map((t) => (
              <label
                key={t.value}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 text-sm",
                  type === t.value ? "border-primary-400 text-primary-700 ring-2 ring-primary-100" : "border-neutral-200 text-neutral-700",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-type`}
                  checked={type === t.value}
                  onChange={() => {
                    setType(t.value);
                    setHolderId("");
                  }}
                  className="h-4 w-4 accent-primary-600"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}-holder`} className={smallLabel}>
            {holderType.field}
          </label>
          <LookupSelect key={type} id={`${id}-holder`} lookup={holderType.lookup} value={holderId} onChange={setHolderId} placeholder={holderType.pick} invalid={Boolean(errors.holderId)} />
          <FieldError message={errors.holderId?.[0] ?? errors.type?.[0]} />
        </div>
        <div>
          <label htmlFor={`${id}-unit`} className={smallLabel}>
            Only for requests from (optional)
          </label>
          <LookupSelect id={`${id}-unit`} lookup="units" value={unitId} onChange={setUnitId} placeholder="Any unit" clearable />
          <p className="mt-1 text-xs text-neutral-500">E.g. the Dean of Engineering holds “Dean” only for requests from the Faculty of Engineering.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-from`} className={smallLabel}>
              From
            </label>
            <input id={`${id}-from`} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className={smallLabel}>
              Until
            </label>
            <input id={`${id}-to`} type="date" value={validTo} min={validFrom || undefined} onChange={(e) => setValidTo(e.target.value)} aria-invalid={Boolean(errors.validTo) || undefined} className={inputClass} />
            <FieldError message={errors.validTo?.[0]} />
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" variant="primary" icon={UserPlus} disabled={busy || !holderId}>
          {busy ? "Adding…" : "Add holder"}
        </Button>
      </form>
    </DialogFrame>
  );
}
