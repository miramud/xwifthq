"use client";

import { useEffect, useId, useState } from "react";
import { CalendarClock, Gavel, Landmark, Pencil, Plus, Trash2, UserRoundCheck, Users } from "lucide-react";
import {
  ApiError,
  orgFoundations,
  type ApprovalRole,
  type AuthorityLimit,
  type Committee,
} from "@/lib/api/org-foundations-client";
import { formatMoney, type Delegation } from "@/lib/api/approvals-client";
import { AvatarStack, Button, Chip, Empty, Panel, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { ActionMenu } from "@/components/dashboard/ui";
import { ErrorNote, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { invalidateLookup } from "./lookups";
import { ApprovalsHeader, FieldError, LookupSelect, MoneyInput, MultiLookup, NumberInput, shortDate, smallLabel } from "./parts";

/*
  Authority: how much each person or approval role may approve (limits),
  the committees that decide together, and cover for people who are away
  (delegations an administrator sets on somebody's behalf).
*/

type Errors = Record<string, string[]>;
type ProcessOption = { value: string; label: string };

const DELEGATION_STATUS: Record<Delegation["status"], { label: string; hue: "mint" | "sky" | "slate" | "rose" }> = {
  running: { label: "Covering now", hue: "mint" },
  scheduled: { label: "Starts later", hue: "sky" },
  ended: { label: "Ended", hue: "slate" },
  revoked: { label: "Ended early", hue: "rose" },
};

function errorsOf(e: unknown): { fields: Errors; message: string | null } {
  if (e instanceof ApiError && e.errors) return { fields: e.errors, message: e.status === 422 && Object.keys(e.errors).length > 0 ? null : e.message };
  return { fields: {}, message: e instanceof ApiError ? e.message : "That wasn't saved. Try again." };
}

export default function AuthorityBoard() {
  const confirm = useConfirm();
  const [limits, setLimits] = useState<AuthorityLimit[] | null>(null);
  const [committees, setCommittees] = useState<Committee[] | null>(null);
  const [delegations, setDelegations] = useState<Delegation[] | null>(null);
  const [roles, setRoles] = useState<ApprovalRole[]>([]);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limitDialog, setLimitDialog] = useState<AuthorityLimit | "new" | null>(null);
  const [committeeDialog, setCommitteeDialog] = useState<Committee | "new" | null>(null);
  const [coverDialog, setCoverDialog] = useState(false);

  useEffect(() => {
    let alive = true;
    const a = orgFoundations.approvals;
    Promise.all([a.limits.list(), a.committees.list(), a.delegations.list(), a.roles.list().catch(() => []), a.processes().catch(() => ({ data: [] }))])
      .then(([l, c, d, r, p]) => {
        if (!alive) return;
        setLimits(l);
        setCommittees(c);
        setDelegations(d);
        setRoles(r);
        setProcesses(p.data.map((x) => ({ value: x.code, label: x.name })));
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof ApiError ? e.message : "Authority settings didn't load."));
    return () => {
      alive = false;
    };
  }, []);

  const processName = (code: string | null) => (code ? processes.find((p) => p.value === code)?.label ?? code : "All processes");

  const removeLimit = async (l: AuthorityLimit) => {
    const who = l.user?.name ?? l.role?.name ?? "this limit";
    if (!(await confirm({ title: `Remove ${who}'s limit?`, body: "Without a limit, the rules alone decide what they may approve.", confirmLabel: "Remove limit" }))) return;
    try {
      await orgFoundations.approvals.limits.remove(l.id);
      setLimits((x) => x?.filter((y) => y.id !== l.id) ?? x);
      setNotice("Limit removed.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The limit wasn't removed.");
    }
  };

  const removeCommittee = async (c: Committee) => {
    if (!(await confirm({ title: `Delete ${c.name}?`, body: "Policies that route to this committee will no longer find anybody for that stage.", confirmLabel: "Delete committee" }))) return;
    try {
      await orgFoundations.approvals.committees.remove(c.id);
      setCommittees((x) => x?.filter((y) => y.id !== c.id) ?? x);
      invalidateLookup("committees");
      setNotice(`${c.name} deleted.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.errors?.committee?.[0] ?? e.message : "The committee wasn't deleted.");
    }
  };

  const endCover = async (d: Delegation) => {
    const ok = await confirm({
      title: `End ${d.delegate?.name ?? "this"} covering for ${d.delegator?.name ?? "them"}?`,
      body: "New approvals go back to the person they were covering for.",
      confirmLabel: "End cover",
    });
    if (!ok) return;
    try {
      const updated = await orgFoundations.approvals.delegations.revoke(d.id);
      setDelegations((x) => x?.map((y) => (y.id === d.id ? updated : y)) ?? x);
      setNotice("Cover ended.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The cover wasn't ended.");
    }
  };

  const limitColumns: Column<AuthorityLimit>[] = [
    {
      key: "who",
      header: "Who",
      primary: true,
      sortable: true,
      value: (l) => l.user?.name ?? l.role?.name ?? "",
      render: (l) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">{l.user?.name ?? l.role?.name}</span>
          <Chip hue={l.user ? "sky" : "grape"}>{l.user ? "Person" : "Role"}</Chip>
        </span>
      ),
    },
    { key: "process", header: "For", sortable: true, value: (l) => processName(l.process) },
    { key: "max", header: "Up to", align: "right", sortable: true, value: (l) => l.maxAmount, render: (l) => <span className="font-semibold tabular-nums text-neutral-900">{formatMoney(l.maxAmount)}</span> },
    { key: "valid", header: "Valid", value: (l) => l.validFrom ?? "", render: (l) => validity(l.validFrom, l.validTo), hideOnMobile: true },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (l) => (
        <ActionMenu
          label="Limit actions"
          items={[
            { label: "Edit", icon: Pencil, onClick: () => setLimitDialog(l) },
            { label: "Remove", icon: Trash2, danger: true, onClick: () => void removeLimit(l) },
          ]}
        />
      ),
    },
  ];

  const committeeColumns: Column<Committee>[] = [
    {
      key: "name",
      header: "Committee",
      primary: true,
      sortable: true,
      value: (c) => c.name,
      render: (c) => (
        <span className="block">
          <span className="block font-semibold text-neutral-900">{c.name}</span>
          <span className="font-mono text-xs text-neutral-500">{c.code}</span>
        </span>
      ),
    },
    { key: "members", header: "Members", value: (c) => c.members.length, render: (c) => (c.members.length ? <AvatarStack people={c.members.map((m) => ({ name: m.name }))} size={26} /> : <span className="text-neutral-500">Nobody yet</span>) },
    {
      key: "quorum",
      header: "Quorum",
      align: "right",
      sortable: true,
      value: (c) => c.quorum,
      render: (c) => (
        <span className={cx("tabular-nums", c.members.length < c.quorum && "font-semibold text-rose-700")}>
          {c.quorum} of {c.members.length}
          {c.members.length < c.quorum && <span className="sr-only"> (not enough members)</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (c) => (
        <ActionMenu
          label={`Actions for ${c.name}`}
          items={[
            { label: "Edit", icon: Pencil, onClick: () => setCommitteeDialog(c) },
            { label: "Delete", icon: Trash2, danger: true, onClick: () => void removeCommittee(c) },
          ]}
        />
      ),
    },
  ];

  const coverColumns: Column<Delegation>[] = [
    { key: "away", header: "Away", primary: true, sortable: true, value: (d) => d.delegator?.name ?? "", render: (d) => <span className="font-semibold text-neutral-900">{d.delegator?.name ?? "—"}</span> },
    { key: "cover", header: "Covered by", sortable: true, value: (d) => d.delegate?.name ?? "" },
    { key: "when", header: "When", sortable: true, value: (d) => d.startsAt, render: (d) => `${shortDate(d.startsAt)} – ${shortDate(d.endsAt)}` },
    {
      key: "scope",
      header: "Covers",
      value: (d) => (d.processes?.length ? d.processes.map(processName).join(", ") : "Everything"),
      render: (d) => (
        <span className="text-xs text-neutral-600">
          {d.processes?.length ? d.processes.map(processName).join(", ") : "Every process"}
          {d.maxAmount != null ? ` · up to ${formatMoney(d.maxAmount)}` : ""}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      value: (d) => DELEGATION_STATUS[d.status]?.label ?? d.status,
      render: (d) => (
        <Chip hue={DELEGATION_STATUS[d.status]?.hue ?? "slate"} dot>
          {DELEGATION_STATUS[d.status]?.label ?? d.status}
        </Chip>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (d) =>
        d.status === "running" || d.status === "scheduled" ? (
          <Button size="sm" variant="ghost" onClick={() => void endCover(d)}>
            End cover
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <ApprovalsHeader active="authority" />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {loadError && <ErrorNote className="mb-4">{loadError}</ErrorNote>}

      {limits === null && !loadError ? (
        <Skeleton className="h-[480px]" />
      ) : (
        <div className="space-y-6">
          <Panel
            title="Approval limits"
            subtitle="The most a person or role may approve. Above it, the route moves on to somebody with more authority."
            icon={Landmark}
            hue="blue"
            actions={
              <Button size="sm" icon={Plus} onClick={() => setLimitDialog("new")}>
                Add limit
              </Button>
            }
          >
            <DataView
              rows={limits ?? []}
              columns={limitColumns}
              rowKey={(l) => l.id}
              storageKey="org.approvals.limits"
              views={["table", "list"]}
              caption="Approval limits"
              searchPlaceholder="Search limits"
              empty={<Empty icon={Landmark} title="No limits set" hint="Without limits, the rules alone decide who approves what." />}
            />
          </Panel>

          <Panel
            title="Committees"
            subtitle="Groups that decide together, with the number who must agree."
            icon={Gavel}
            hue="grape"
            actions={
              <Button size="sm" icon={Plus} onClick={() => setCommitteeDialog("new")}>
                New committee
              </Button>
            }
          >
            <DataView
              rows={committees ?? []}
              columns={committeeColumns}
              rowKey={(c) => c.id}
              storageKey="org.approvals.committees"
              views={["table", "list"]}
              caption="Committees"
              searchPlaceholder="Search committees"
              empty={<Empty icon={Users} title="No committees yet" hint="Create one for decisions that need several people, like a tenders board." />}
            />
          </Panel>

          <Panel
            title="Cover for people away"
            subtitle="While somebody is on leave, their approvals go to the person covering for them."
            icon={CalendarClock}
            hue="sun"
            actions={
              <Button size="sm" icon={Plus} onClick={() => setCoverDialog(true)}>
                Arrange cover
              </Button>
            }
          >
            <DataView
              rows={delegations ?? []}
              columns={coverColumns}
              rowKey={(d) => d.id}
              storageKey="org.approvals.cover"
              views={["table", "list"]}
              caption="Cover for people away"
              searchPlaceholder="Search cover"
              empty={<Empty icon={UserRoundCheck} title="Nobody is covering for anybody" hint="Arrange cover when an approver goes on leave, so nothing waits for them." />}
            />
          </Panel>
        </div>
      )}

      {limitDialog && (
        <LimitDialog
          limit={limitDialog === "new" ? null : limitDialog}
          roles={roles}
          processes={processes}
          onClose={() => setLimitDialog(null)}
          onSaved={(l) => {
            setLimits((x) => (x ? (x.some((y) => y.id === l.id) ? x.map((y) => (y.id === l.id ? l : y)) : [...x, l]) : [l]));
            setNotice("Limit saved.");
            setLimitDialog(null);
          }}
        />
      )}
      {committeeDialog && (
        <CommitteeDialog
          committee={committeeDialog === "new" ? null : committeeDialog}
          onClose={() => setCommitteeDialog(null)}
          onSaved={(c) => {
            setCommittees((x) => (x ? (x.some((y) => y.id === c.id) ? x.map((y) => (y.id === c.id ? c : y)) : [...x, c]) : [c]));
            invalidateLookup("committees");
            setNotice(`${c.name} saved.`);
            setCommitteeDialog(null);
          }}
        />
      )}
      {coverDialog && (
        <CoverDialog
          processes={processes}
          onClose={() => setCoverDialog(false)}
          onSaved={(d) => {
            setDelegations((x) => [d, ...(x ?? [])]);
            setNotice(`${d.delegate?.name ?? "Cover"} will cover for ${d.delegator?.name ?? "them"}.`);
            setCoverDialog(false);
          }}
        />
      )}
    </div>
  );
}

function validity(from: string | null, to: string | null) {
  if (!from && !to) return <span className="text-neutral-500">Always</span>;
  return `${from ? shortDate(from) : "Now"} – ${to ? shortDate(to) : "open-ended"}`;
}

function LimitDialog({
  limit,
  roles,
  processes,
  onClose,
  onSaved,
}: {
  limit: AuthorityLimit | null;
  roles: ApprovalRole[];
  processes: ProcessOption[];
  onClose: () => void;
  onSaved: (l: AuthorityLimit) => void;
}) {
  const id = useId();
  const [who, setWho] = useState<"user" | "role">(limit?.role ? "role" : "user");
  const [userId, setUserId] = useState(limit?.user?.id ?? "");
  const [roleId, setRoleId] = useState(limit?.role?.id ?? "");
  const [process, setProcess] = useState(limit?.process ?? "");
  const [max, setMax] = useState<number | null>(limit?.maxAmount ?? null);
  const [validFrom, setValidFrom] = useState(limit?.validFrom?.slice(0, 10) ?? "");
  const [validTo, setValidTo] = useState(limit?.validTo?.slice(0, 10) ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (max == null) {
      setErrors({ maxAmount: ["Say the most they may approve."] });
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    const input = {
      userId: who === "user" ? userId || null : null,
      roleId: who === "role" ? roleId || null : null,
      process: process || null,
      maxAmount: max,
      validFrom: validFrom || null,
      validTo: validTo || null,
    };
    try {
      onSaved(limit ? await orgFoundations.approvals.limits.update(limit.id, input) : await orgFoundations.approvals.limits.create(input));
    } catch (err) {
      const r = errorsOf(err);
      setErrors(r.fields);
      setError(r.message);
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title={limit ? "Edit limit" : "Add a limit"}
      onClose={onClose}
      as="form"
      onSubmit={save}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || (who === "user" ? !userId : !roleId)}>
            {busy ? "Saving…" : "Save limit"}
          </Button>
        </div>
      }
    >
      <div>
        <p className={smallLabel}>Limit for</p>
        <Segmented
          label="Limit for"
          value={who}
          onChange={setWho}
          options={[
            { key: "user", label: "A person" },
            { key: "role", label: "An approval role" },
          ]}
        />
      </div>
      <div>
        <label htmlFor={`${id}-who`} className={smallLabel}>
          {who === "user" ? "Person" : "Approval role"}
        </label>
        {who === "user" ? (
          <LookupSelect id={`${id}-who`} lookup="people" value={userId} onChange={setUserId} placeholder="Choose a person" invalid={Boolean(errors.userId)} />
        ) : (
          <SearchableSelect
            id={`${id}-who`}
            value={roleId}
            onChange={setRoleId}
            options={roles.map((r) => ({ value: r.id, label: r.name, hint: r.code }))}
            placeholder="Choose an approval role"
            aria-invalid={Boolean(errors.roleId) || undefined}
          />
        )}
        <FieldError message={errors.userId?.[0] ?? errors.roleId?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-process`} className={smallLabel}>
          For
        </label>
        <SearchableSelect id={`${id}-process`} value={process} onChange={setProcess} options={processes} clearable clearLabel="All processes" placeholder="All processes" />
        <FieldError message={errors.process?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-max`} className={smallLabel}>
          Up to (naira)
        </label>
        <MoneyInput id={`${id}-max`} value={max} onChange={setMax} invalid={Boolean(errors.maxAmount)} />
        <FieldError message={errors.maxAmount?.[0]} />
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
    </DialogFrame>
  );
}

/** Members must be at least the quorum, or the committee could never decide. */
export function committeeProblem(memberCount: number, quorum: number | null): string | null {
  if (quorum == null || quorum < 1) return "Say how many must agree (at least 1).";
  if (memberCount < quorum) return `Add at least ${quorum - memberCount} more ${quorum - memberCount === 1 ? "member" : "members"}, or lower the quorum: ${quorum} must agree but there ${memberCount === 1 ? "is" : "are"} only ${memberCount}.`;
  return null;
}

function CommitteeDialog({ committee, onClose, onSaved }: { committee: Committee | null; onClose: () => void; onSaved: (c: Committee) => void }) {
  const id = useId();
  const [code, setCode] = useState(committee?.code ?? "");
  const [name, setName] = useState(committee?.name ?? "");
  const [quorum, setQuorum] = useState<number | null>(committee?.quorum ?? 2);
  const [memberIds, setMemberIds] = useState<string[]>(committee?.members.map((m) => m.id) ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const problem = committeeProblem(memberIds.length, quorum);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onSaved(
        committee
          ? await orgFoundations.approvals.committees.update(committee.id, { name, quorum: quorum!, memberIds })
          : await orgFoundations.approvals.committees.create({ code, name, quorum: quorum!, memberIds }),
      );
    } catch (err) {
      const r = errorsOf(err);
      setErrors(r.fields);
      setError(r.message);
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title={committee ? `Edit ${committee.name}` : "New committee"}
      onClose={onClose}
      as="form"
      onSubmit={save}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim() === "" || (!committee && code.trim() === "")}>
            {busy ? "Saving…" : "Save committee"}
          </Button>
        </div>
      }
    >
      {!committee && (
        <div>
          <label htmlFor={`${id}-code`} className={smallLabel}>
            Code
          </label>
          <input
            id={`${id}-code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            maxLength={48}
            placeholder="TENDERS_BOARD"
            aria-invalid={Boolean(errors.code) || undefined}
            className={cx(inputClass, "font-mono")}
          />
          <FieldError message={errors.code?.[0]} />
        </div>
      )}
      <div>
        <label htmlFor={`${id}-name`} className={smallLabel}>
          Name
        </label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Tenders board" aria-invalid={Boolean(errors.name) || undefined} className={inputClass} />
        <FieldError message={errors.name?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-members`} className={smallLabel}>
          Members
        </label>
        <MultiLookup id={`${id}-members`} lookup="people" values={memberIds} onChange={setMemberIds} addLabel="Add a member" invalid={Boolean(errors.memberIds)} />
        <FieldError message={errors.memberIds?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-quorum`} className={smallLabel}>
          How many must agree (quorum)
        </label>
        <NumberInput
          id={`${id}-quorum`}
          min={1}
          max={50}
          value={quorum}
          onChange={setQuorum}
          invalid={Boolean((touched && problem) || errors.quorum)}
          describedBy={`${id}-quorum-msg`}
          className="w-32"
        />
        <FieldError id={`${id}-quorum-msg`} message={errors.quorum?.[0] ?? (touched || memberIds.length > 0 ? problem ?? undefined : undefined)} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function CoverDialog({ processes, onClose, onSaved }: { processes: ProcessOption[]; onClose: () => void; onSaved: (d: Delegation) => void }) {
  const id = useId();
  const [delegatorId, setDelegatorId] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState("");
  const [scope, setScope] = useState<string[]>([]);
  const [max, setMax] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      onSaved(
        await orgFoundations.approvals.delegations.create({
          delegatorId,
          delegateId,
          startsAt,
          endsAt,
          processes: scope.length ? scope : null,
          maxAmount: max,
          reason: reason || null,
        }),
      );
    } catch (err) {
      const r = errorsOf(err);
      setErrors(r.fields);
      setError(r.message);
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${id}-title`}
      title="Arrange cover"
      subtitle="Approvals that would go to the person away go to the cover instead, marked as on their behalf."
      onClose={onClose}
      as="form"
      onSubmit={save}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !delegatorId || !delegateId || !endsAt}>
            {busy ? "Saving…" : "Arrange cover"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-away`} className={smallLabel}>
            Person away
          </label>
          <LookupSelect id={`${id}-away`} lookup="people" value={delegatorId} onChange={setDelegatorId} placeholder="Choose a person" invalid={Boolean(errors.delegatorId)} />
          <FieldError message={errors.delegatorId?.[0]} />
        </div>
        <div>
          <label htmlFor={`${id}-cover`} className={smallLabel}>
            Covered by
          </label>
          <LookupSelect id={`${id}-cover`} lookup="people" value={delegateId} onChange={setDelegateId} placeholder="Choose a person" exclude={delegatorId ? [delegatorId] : []} invalid={Boolean(errors.delegateId)} />
          <FieldError message={errors.delegateId?.[0]} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className={smallLabel}>
            From
          </label>
          <input id={`${id}-start`} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-invalid={Boolean(errors.startsAt) || undefined} className={inputClass} />
          <FieldError message={errors.startsAt?.[0]} />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className={smallLabel}>
            Until
          </label>
          <input id={`${id}-end`} type="date" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} aria-invalid={Boolean(errors.endsAt) || undefined} className={inputClass} />
          <FieldError message={errors.endsAt?.[0]} />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-scope`} className={smallLabel}>
          Only for (optional)
        </label>
        <ScopePicker id={`${id}-scope`} options={processes} values={scope} onChange={setScope} />
        <p className="mt-1 text-xs text-neutral-500">Leave empty to cover every process.</p>
      </div>
      <div>
        <label htmlFor={`${id}-max`} className={smallLabel}>
          Up to (optional)
        </label>
        <MoneyInput id={`${id}-max`} value={max} onChange={setMax} placeholder="No limit" invalid={Boolean(errors.maxAmount)} />
        <FieldError message={errors.maxAmount?.[0]} />
      </div>
      <div>
        <label htmlFor={`${id}-reason`} className={smallLabel}>
          Reason
        </label>
        <textarea id={`${id}-reason`} rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Annual leave" className={textareaClass} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function ScopePicker({ id, options, values, onChange }: { id: string; options: ProcessOption[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full bg-primary-50 px-3 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                aria-label={`Remove ${options.find((o) => o.value === v)?.label ?? v}`}
              >
                {options.find((o) => o.value === v)?.label ?? v} ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <SearchableSelect id={id} value="" onChange={(v) => v && onChange([...values, v])} options={options.filter((o) => !values.includes(o.value))} placeholder="Add a process" />
    </div>
  );
}
