"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, FileStack, GitBranch, Lock, Pencil, Workflow, X } from "lucide-react";
import {
  ApiError,
  orgFoundations,
  type PolicySummary,
  type ProcessSetup,
} from "@/lib/api/org-foundations-client";
import { Button, ButtonLink, Chip, Empty, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { HUE, hueFor } from "@/components/workspace/modules";
import { ErrorNote, Skeleton, Switch } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { ApprovalsHeader, FieldError, NumberInput, smallLabel } from "./parts";
import StepUpPanel from "./StepUpPanel";

/*
  Processes: every kind of request that can need approval in this
  organisation — whether it is switched on, which rules are in force, what
  is being drafted, the stages no policy can remove, and how long approvers
  have. "Edit rules" opens the draft, starting one first if there isn't.
*/

export const POLICY_CHANGE_PROCESS = "core.approval_policy_change";

const MODULE_LABEL: Record<string, string> = {
  core: "Core",
  hrm: "HR",
  projects: "Projects",
  lms: "Learning",
  operations: "Operations",
  finance: "Finance",
  admin: "Admin",
};

export function moduleLabel(m: string): string {
  return MODULE_LABEL[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
}

export default function ProcessesBoard() {
  const router = useRouter();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ProcessSetup[] | null>(null);
  const [versions, setVersions] = useState<PolicySummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [chooser, setChooser] = useState<ProcessSetup | null>(null);
  const [timing, setTiming] = useState<ProcessSetup | null>(null);

  useEffect(() => {
    let alive = true;
    // Versions only for the "Rules in force" link; drafts and pending versions come with each process.
    Promise.all([orgFoundations.approvals.processes(), orgFoundations.approvals.policies().catch(() => [])])
      .then(([p, v]) => {
        if (!alive) return;
        setRows(p.data);
        setVersions(v);
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof ApiError ? e.message : "The processes didn't load."));
    return () => {
      alive = false;
    };
  }, []);

  const versionOf = (code: string, status: PolicySummary["status"]) => versions.find((v) => v.process === code && v.status === status) ?? null;

  const put = (code: string, patch: Partial<ProcessSetup>) => setRows((r) => r?.map((p) => (p.code === code ? { ...p, ...patch } : p)) ?? r);

  const toggle = async (p: ProcessSetup, enabled: boolean) => {
    if (!enabled) {
      const ok = await confirm({
        title: `Switch off approval for ${p.name}?`,
        body: (
          <>
            New {p.name.toLowerCase()} requests will no longer go to anybody for approval. Requests already waiting carry on to a decision
            {p.openRequests > 0 ? ` (${p.openRequests} open now)` : ""}.
          </>
        ),
        confirmLabel: "Switch off",
      });
      if (!ok) return;
    }
    setBusy(p.code);
    setError(null);
    try {
      const r = await orgFoundations.approvals.updateProcess(p.code, { enabled });
      put(p.code, { enabled: r.enabled });
      setNotice(r.enabled ? `${p.name} now needs approval.` : `${p.name} no longer needs approval.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.errors?.enabled?.[0] ?? e.message : `${p.name} wasn't changed.`);
    } finally {
      setBusy(null);
    }
  };

  const editRules = (p: ProcessSetup) => {
    const openId = p.draftPolicyId ?? p.pendingPolicyId;
    if (openId) router.push(`/suite/org/approvals/policies/${openId}`);
    else setChooser(p);
  };

  const columns: Column<ProcessSetup>[] = [
      {
        key: "name",
        header: "Process",
        primary: true,
        sortable: true,
        value: (p) => p.name,
        render: (p) => (
          <span className="block min-w-0">
            <span className="block font-semibold text-neutral-900">{p.name}</span>
            <span className="block max-w-md truncate text-xs text-neutral-500">{p.description}</span>
          </span>
        ),
      },
      { key: "module", header: "Module", sortable: true, value: (p) => moduleLabel(p.module), render: (p) => <Chip hue={hueFor(p.module)}>{moduleLabel(p.module)}</Chip>, hideOnMobile: true },
      { key: "rules", header: "Rules", value: (p) => (p.usingDefault ? "Default rules" : `Version ${p.activeVersion}`), render: (p) => <RulesCell p={p} /> },
      { key: "open", header: "Open", align: "right", sortable: true, value: (p) => p.openRequests, render: (p) => <span className="tabular-nums">{p.openRequests}</span> },
      { key: "sla", header: "Time allowed", align: "right", sortable: true, value: (p) => p.settings.slaHours, render: (p) => <span className="tabular-nums">{p.settings.slaHours} h</span>, hideOnMobile: true },
      {
        key: "enabled",
        header: "Needs approval",
        value: (p) => (p.enabled ? "On" : "Off"),
        render: (p) => (
          <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={p.enabled}
              onChange={(v) => void toggle(p, v)}
              label={`${p.name} needs approval`}
              disabled={busy === p.code || (p.code === POLICY_CHANGE_PROCESS && p.enabled)}
            />
            <span className="text-xs text-neutral-600">{p.enabled ? "On" : "Off"}</span>
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        tableOnly: true,
        render: (p) => (
          <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={Clock} onClick={() => setTiming(p)} aria-label={`Timing for ${p.name}`}>
              <span className="hidden xl:inline">Timing</span>
            </Button>
            <Button size="sm" icon={Pencil} onClick={() => editRules(p)}>
              Edit rules
            </Button>
          </span>
        ),
      },
  ];

  return (
    <div>
      <ApprovalsHeader active="processes" />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {loadError && <ErrorNote className="mb-4">{loadError}</ErrorNote>}

      <StepUpPanel />

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading processes…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : rows !== null ? (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(p) => p.code}
          storageKey="org.approvals.processes"
          defaultView="grid"
          gridCols={2}
          caption="Processes that can need approval"
          searchPlaceholder="Search processes"
          empty={<Empty icon={Workflow} title="No processes yet" hint="Processes appear here as the modules that raise them are switched on." />}
          renderCard={(p) => (
            <ProcessCard
              p={p}
              busy={busy === p.code}
              onToggle={(v) => void toggle(p, v)}
              onEdit={() => editRules(p)}
              onTiming={() => setTiming(p)}
              activeId={versionOf(p.code, "active")?.id ?? null}

            />
          )}
        />
      ) : null}

      {chooser && (
        <NewVersionDialog
          process={chooser}
          onClose={() => setChooser(null)}
          onCreated={(id) => router.push(`/suite/org/approvals/policies/${id}`)}
        />
      )}
      {timing && (
        <TimingDialog
          process={timing}
          onClose={() => setTiming(null)}
          onSaved={(settings) => {
            put(timing.code, { settings });
            setNotice(`${timing.name}: timing saved.`);
            setTiming(null);
          }}
        />
      )}
    </div>
  );
}

function RulesCell({ p }: { p: ProcessSetup }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Chip hue={p.usingDefault ? "slate" : "mint"} dot>
        {p.usingDefault ? "Default rules" : `Version ${p.activeVersion} in force`}
      </Chip>
      {p.draftVersion != null && <Chip hue="sky">Draft v{p.draftVersion}</Chip>}
      {p.pendingVersion != null && <Chip hue="sun">v{p.pendingVersion} awaiting approval</Chip>}
    </span>
  );
}

function ProcessCard({
  p,
  busy,
  onToggle,
  onEdit,
  onTiming,
  activeId,
}: {
  p: ProcessSetup;
  busy: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onTiming: () => void;
  activeId: string | null;
}) {
  const locked = p.code === POLICY_CHANGE_PROCESS;
  return (
    <div className={cx("flex h-full flex-col gap-4 p-5", !p.enabled && "opacity-80")}>
      <div className="flex items-start gap-3">
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[hueFor(p.module)].soft)}>
          <Workflow size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-neutral-900">{p.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{moduleLabel(p.module)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch checked={p.enabled} onChange={onToggle} label={`${p.name} needs approval`} disabled={busy || (locked && p.enabled)} />
          <span className="text-[11px] font-medium text-neutral-500">{locked ? "Always on" : p.enabled ? "On" : "Off"}</span>
        </div>
      </div>
      <p className="text-sm text-neutral-600">{p.description}</p>

      <RulesCell p={p} />

      {p.controlStages.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Always added</p>
          <ul className="flex flex-wrap gap-1.5">
            {p.controlStages.map((c) => (
              <li key={c.key}>
                <Chip hue="slate" icon={Lock}>
                  {c.name}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-neutral-50 p-3 text-center">
        <div>
          <dt className="text-[11px] text-neutral-500">Open now</dt>
          <dd className="text-lg font-bold tabular-nums text-neutral-900">{p.openRequests}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-neutral-500">Time allowed</dt>
          <dd className="text-lg font-bold tabular-nums text-neutral-900">
            {p.settings.slaHours}
            <span className="text-xs font-medium text-neutral-500"> h</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-neutral-500">Split window</dt>
          <dd className="text-lg font-bold tabular-nums text-neutral-900">
            {p.settings.splitWindowDays}
            <span className="text-xs font-medium text-neutral-500"> d</span>
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
        <Button size="sm" variant="primary" icon={Pencil} onClick={onEdit}>
          {p.draftPolicyId ? "Continue draft" : p.pendingPolicyId ? "View pending version" : "Edit rules"}
        </Button>
        {activeId && (
          <ButtonLink size="sm" href={`/suite/org/approvals/policies/${activeId}`} icon={FileStack}>
            Rules in force
          </ButtonLink>
        )}
        <Button size="sm" variant="ghost" icon={Clock} onClick={onTiming}>
          Timing
        </Button>
      </div>
    </div>
  );
}

/** Starting a new version: from the rules in force, the process default, or a template. */
export function NewVersionDialog({
  process,
  onClose,
  onCreated,
}: {
  process: ProcessSetup;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const titleId = useId();
  const [from, setFrom] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = [
    {
      value: "active",
      label: process.usingDefault ? "The rules used now (the default)" : `The rules in force (version ${process.activeVersion})`,
      hint: "Start from what applies today and change what you need.",
    },
    ...(process.usingDefault ? [] : [{ value: "default", label: "The process default", hint: "The rules this process comes with, before any changes." }]),
    ...process.templates.map((t) => ({ value: `template:${t.key}`, label: t.name, hint: t.description })),
  ];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const made = await orgFoundations.approvals.newDraft(process.code, from);
      onCreated(made.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.process?.[0] ?? err.errors?.from?.[0] ?? err.message : "The draft wasn't started.");
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={titleId}
      title={`New rules for ${process.name}`}
      subtitle="A draft is private until you submit it. The current rules stay in force meanwhile."
      onClose={onClose}
      as="form"
      onSubmit={create}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={GitBranch} disabled={busy}>
            {busy ? "Starting…" : "Start draft"}
          </Button>
        </div>
      }
    >
      <fieldset>
        <legend className={smallLabel}>Start from</legend>
        <div className="space-y-2">
          {choices.map((c) => (
            <label
              key={c.value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
                from === c.value ? "border-primary-400 bg-primary-50/60 ring-2 ring-primary-100" : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <input type="radio" name="from" value={c.value} checked={from === c.value} onChange={() => setFrom(c.value)} className="mt-1 h-4 w-4 accent-primary-600" />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{c.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-600">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}

function TimingDialog({
  process,
  onClose,
  onSaved,
}: {
  process: ProcessSetup;
  onClose: () => void;
  onSaved: (s: ProcessSetup["settings"]) => void;
}) {
  const titleId = useId();
  const [sla, setSla] = useState<number | null>(process.settings.slaHours);
  const [win, setWin] = useState<number | null>(process.settings.splitWindowDays);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await orgFoundations.approvals.updateProcess(process.code, { slaHours: sla ?? undefined, splitWindowDays: win ?? undefined });
      onSaved({ slaHours: sla ?? process.settings.slaHours, splitWindowDays: win ?? process.settings.splitWindowDays });
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      else setError(err instanceof ApiError ? err.message : "The timing wasn't saved.");
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={titleId}
      title={`Timing for ${process.name}`}
      onClose={onClose}
      as="form"
      onSubmit={save}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} icon={X}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={Check} disabled={busy}>
            {busy ? "Saving…" : "Save timing"}
          </Button>
        </div>
      }
    >
      <div>
        <label htmlFor={`${titleId}-sla`} className={smallLabel}>
          Time allowed per stage (working hours)
        </label>
        <NumberInput id={`${titleId}-sla`} min={1} max={720} value={sla} onChange={setSla} invalid={Boolean(errors.slaHours)} />
        <p className="mt-1 text-xs text-neutral-500">Approvers are reminded halfway, and the request shows as overdue after this. A stage can set its own.</p>
        <FieldError message={errors.slaHours?.[0]} />
      </div>
      <div>
        <label htmlFor={`${titleId}-win`} className={smallLabel}>
          Split-request window (days)
        </label>
        <NumberInput id={`${titleId}-win`} min={1} max={365} value={win} onChange={setWin} invalid={Boolean(errors.splitWindowDays)} />
        <p className="mt-1 text-xs text-neutral-500">How far back similar requests from the same person are added together.</p>
        <FieldError message={errors.splitWindowDays?.[0]} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </DialogFrame>
  );
}
