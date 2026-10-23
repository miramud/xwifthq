"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  GitBranch,
  History,
  Layers,
  Lock,
  Plus,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import {
  ApiError,
  orgFoundations,
  type PolicyDefinition,
  type PolicyDetail,
  type PolicyRule,
  type PolicySummary,
  type ProcessSetup,
  type ResolverInfo,
} from "@/lib/api/org-foundations-client";
import type { ContextFieldDef } from "@/lib/api/approvals-client";
import { Button, Chip, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { ConditionBuilder } from "./ConditionBuilder";
import { LockedStage, ResolverPicker, StageEditor } from "./StageEditor";
import { Simulator } from "./Simulator";
import {
  builderFields,
  describePath,
  errorAt,
  flagsUsed,
  hasErrorUnder,
  moveItem,
  newComparison,
  newRule,
  newStage,
  normaliseErrors,
  uniqueSlug,
  type FieldErrors,
} from "./policy-logic";
import { FieldError, NumberInput, shortDate, smallLabel } from "./parts";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/*
  The policy builder (/suite/org/approvals/policies/[id]).

  Left: the version — its rules (each a condition and the stages it adds), the
  automatic approvals, the policy-wide fallbacks, anti-splitting, and the
  process's locked control stages at the end. Right: the simulator and the
  version history. A draft is edited and saved; anything else is read-only
  with "Start a new version".
*/

export const POLICY_STATUS: Record<PolicySummary["status"], { label: string; hue: "slate" | "sun" | "mint" | "rose" | "sky" }> = {
  draft: { label: "Draft", hue: "sky" },
  pending_approval: { label: "Awaiting approval", hue: "sun" },
  active: { label: "In force", hue: "mint" },
  superseded: { label: "Superseded", hue: "slate" },
  rejected: { label: "Rejected", hue: "rose" },
};

export function PolicyStatusChip({ status }: { status: PolicySummary["status"] }) {
  const s = POLICY_STATUS[status] ?? { label: status, hue: "slate" as const };
  return (
    <Chip hue={s.hue} dot>
      {s.label}
    </Chip>
  );
}

function blankDefinition(): PolicyDefinition {
  return { schema: 1, rules: [], bypass: [], fallback: null, independent: null, splitting: { enabled: false, windowDays: 30 } };
}

export default function PolicyBuilder({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [setup, setSetup] = useState<ProcessSetup | null>(null);
  const [resolvers, setResolvers] = useState<ResolverInfo[]>([]);
  const [soleAdmin, setSoleAdmin] = useState<boolean | null>(null);
  const [history, setHistory] = useState<PolicySummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [def, setDef] = useState<PolicyDefinition>(blankDefinition);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [busy, setBusy] = useState<null | "save" | "submit" | "discard" | "new">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const adopt = useCallback((p: PolicyDetail) => {
    setPolicy(p);
    setDef({ ...blankDefinition(), ...p.definition });
    setEffectiveFrom(p.effectiveFrom ? p.effectiveFrom.slice(0, 10) : "");
    setNotes(p.notes ?? "");
    setDirty(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await orgFoundations.approvals.policy(id);
        if (!alive) return;
        adopt(p);
        // The process list carries its fields, amendable fields and the open draft/pending ids;
        // the version list is only for the history rail.
        const [procs, versions] = await Promise.all([
          orgFoundations.approvals.processes(),
          orgFoundations.approvals.policies(p.process).catch(() => []),
        ]);
        if (!alive) return;
        setSetup(procs.data.find((x) => x.code === p.process) ?? null);
        setResolvers(procs.resolvers);
        setSoleAdmin(procs.meta?.soleAdmin ?? null);
        setHistory(versions);
      } catch (e) {
        if (alive) setLoadError(e instanceof ApiError ? e.message : "This version didn't load.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, adopt]);

  const fields: ContextFieldDef[] = useMemo(() => uniqueFields(setup?.fields ?? []), [setup]);
  const amendable: string[] = setup?.amendable ?? [];
  const editable = policy?.status === "draft";
  const readOnly = !editable;
  const bFields = useMemo(() => builderFields(fields, def), [fields, def]);
  const flags = useMemo(() => flagsUsed(def), [def]);
  const hasControls = (setup?.controlStages.length ?? 0) > 0;

  const change = (next: PolicyDefinition) => {
    setDef(next);
    setDirty(true);
    setNotice(null);
  };
  const setRule = (i: number, rule: PolicyRule) => change({ ...def, rules: def.rules.map((r, j) => (j === i ? rule : r)) });

  /** Saves the draft. Resolves false (and shows each problem in place) on a 422. */
  const save = async (quiet = false): Promise<boolean> => {
    if (!policy) return false;
    setBusy((b) => b ?? "save");
    setActionError(null);
    try {
      const saved = await orgFoundations.approvals.saveDraft(policy.id, { definition: def, effectiveFrom: effectiveFrom || null, notes: notes || null });
      adopt({ ...policy, ...saved });
      setErrors(null);
      if (!quiet) setNotice("Draft saved.");
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.errors) {
        setErrors(normaliseErrors(e.errors));
        setActionError(`The draft wasn't saved: ${Object.keys(e.errors).length === 1 ? "one thing needs" : `${Object.keys(e.errors).length} things need`} fixing.`);
      } else {
        setActionError(e instanceof ApiError ? e.message : "The draft wasn't saved. Try again.");
      }
      return false;
    } finally {
      setBusy((b) => (b === "save" ? null : b));
    }
  };

  const submit = async () => {
    if (!policy) return;
    const ok = await confirm({
      title: `Submit version ${policy.version} for approval?`,
      body:
        soleAdmin === true
          ? "You are the organisation's only administrator, so this version takes effect immediately and replaces the rules in force."
          : soleAdmin === false
            ? "Another administrator must approve it before it takes effect. The current rules stay in force until then."
            : "Another administrator must approve it before it takes effect. If you are the organisation's only administrator, it takes effect immediately.",
      confirmLabel: soleAdmin ? "Put into force" : "Submit for approval",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("submit");
    try {
      if (dirty && !(await save(true))) return;
      const summary = await orgFoundations.approvals.submit(policy.id);
      setPolicy((p) => (p ? { ...p, ...summary } : p));
      setHistory((h) => h.map((v) => (v.id === summary.id ? summary : v)));
      setNotice(summary.status === "active" ? `Version ${summary.version} is now in force.` : `Version ${summary.version} is waiting for another administrator to approve it.`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.errors) setErrors(normaliseErrors(e.errors));
      setActionError(e instanceof ApiError ? e.message : "It wasn't submitted. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!policy) return;
    const ok = await confirm({
      title: `Discard draft version ${policy.version}?`,
      body: "Its rules are deleted. The version in force is not affected.",
      confirmLabel: "Discard draft",
    });
    if (!ok) return;
    setBusy("discard");
    try {
      await orgFoundations.approvals.discardDraft(policy.id);
      router.push("/suite/org/approvals");
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "The draft wasn't discarded.");
      setBusy(null);
    }
  };

  const startNew = async () => {
    if (!policy) return;
    const openId = setup?.draftPolicyId ?? setup?.pendingPolicyId ?? history.find((v) => v.status === "draft" || v.status === "pending_approval")?.id;
    if (openId && openId !== policy.id) {
      router.push(`/suite/org/approvals/policies/${openId}`);
      return;
    }
    setBusy("new");
    try {
      const made = await orgFoundations.approvals.newDraft(policy.process, "active");
      router.push(`/suite/org/approvals/policies/${made.id}`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "A new version wasn't started.");
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <div>
        <BackToProcesses />
        <ErrorNote>{loadError}</ErrorNote>
      </div>
    );
  }

  if (!policy) {
    return (
      <div aria-busy="true">
        <p className="sr-only">Loading the policy…</p>
        <Skeleton className="mb-4 h-24" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );
  }

  const errorList = Object.entries(errors ?? {});

  return (
    <div>
      <BackToProcesses />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-600">Approval rules</p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
            {policy.processName}
            <span className="text-neutral-400">·</span>
            <span>Version {policy.version}</span>
            <PolicyStatusChip status={policy.status} />
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {editable
              ? "Every rule that matches a request adds its stages. Stages run in order; the same person in several single-approver stages approves once."
              : "This version can't be changed. Start a new version to make changes."}
            {dirty && <span className="ml-2 font-semibold text-sun-700">Unsaved changes.</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <Button variant="ghost" icon={Trash2} onClick={() => void discard()} disabled={busy !== null}>
                Discard draft
              </Button>
              <Button icon={Save} onClick={() => void save()} disabled={busy !== null || !dirty}>
                {busy === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button variant="primary" icon={Send} onClick={() => void submit()} disabled={busy !== null}>
                {busy === "submit" ? "Submitting…" : "Submit for approval"}
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={GitBranch} onClick={() => void startNew()} disabled={busy !== null}>
              {setup?.draftPolicyId || setup?.pendingPolicyId || history.some((v) => v.status === "draft" || v.status === "pending_approval") ? "Open the version in progress" : "Start a new version"}
            </Button>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>}
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {policy.problems && Object.keys(policy.problems).length > 0 && (
        <div className="mb-5 rounded-xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700" role="note">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} aria-hidden /> This template names things your organisation doesn&apos;t have yet
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {Object.entries(policy.problems).map(([path, msgs]) => (
              <li key={path}>
                {describePath(path, def)}: {msgs[0]}
              </li>
            ))}
          </ul>
          <p className="mt-1.5">Create those approval roles or committees, or choose others below, before submitting.</p>
        </div>
      )}

      {errorList.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-error-500/25 bg-error-500/5 px-4 py-3 text-sm text-error-700">
          <p className="font-semibold">Fix these before saving:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">
            {errorList.map(([path, msgs]) => (
              <li key={path}>
                <span className="font-medium">{describePath(path, def)}</span>: {msgs[0]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Version */}
          <Panel title="This version" icon={Settings2} hue="slate">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <div>
                <label htmlFor="policy-effective" className={smallLabel}>
                  Takes effect from
                </label>
                {readOnly ? (
                  <p className="text-sm text-neutral-800">{policy.effectiveFrom ? shortDate(policy.effectiveFrom) : "As soon as it's approved"}</p>
                ) : (
                  <input
                    id="policy-effective"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => {
                      setEffectiveFrom(e.target.value);
                      setDirty(true);
                    }}
                    className={inputClass}
                    aria-describedby="policy-effective-hint"
                  />
                )}
                {!readOnly && (
                  <p id="policy-effective-hint" className="mt-1 text-xs text-neutral-500">
                    Leave empty to apply once approved.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="policy-notes" className={smallLabel}>
                  What changed, and why
                </label>
                {readOnly ? (
                  policy.notes ? <RichTextView value={policy.notes} size="sm" className="text-neutral-800" /> : <p className="text-sm text-neutral-800">No notes.</p>
                ) : (
                  <RichTextEditor id="policy-notes" minHeight={76} value={notes} onChange={(html) => {
                      setNotes(html);
                      setDirty(true);
                    }} placeholder="e.g. Raised the Bursar's limit to ₦5m after the Council meeting of 2 October." />
                )}
              </div>
            </div>
          </Panel>

          {/* Rules */}
          <section aria-labelledby="rules-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="rules-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight text-neutral-900">
                <Layers size={18} className="text-primary-600" aria-hidden /> Rules
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-600">{def.rules.length}</span>
              </h2>
              {editable && (
                <Button size="sm" icon={Plus} onClick={() => change({ ...def, rules: [...def.rules, newRule(def)] })}>
                  Add rule
                </Button>
              )}
            </div>
            <FieldError message={errorAt(errors, "rules")} />

            {def.rules.length === 0 && (
              <div className="ws-card flex flex-col items-center gap-2 px-6 py-10 text-center">
                <p className="text-[15px] font-semibold text-neutral-900">No rules yet</p>
                <p className="max-w-sm text-sm text-neutral-500">
                  {hasControls ? "Only the control stages below would run." : "Add a rule, or nothing would ever be approved."}
                </p>
                {editable && (
                  <Button variant="primary" icon={Plus} className="mt-2" onClick={() => change({ ...def, rules: [newRule(def)] })}>
                    Add the first rule
                  </Button>
                )}
              </div>
            )}

            {def.rules.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={i}
                count={def.rules.length}
                onChange={(r) => setRule(i, r)}
                onMove={(dir) => change({ ...def, rules: moveItem(def.rules, i, i + dir) })}
                onRemove={async () => {
                  const ok = await confirm({ title: `Remove “${rule.label}”?`, body: "Its condition and stages leave this draft. Nothing changes until the draft is saved.", confirmLabel: "Remove rule" });
                  if (ok) change({ ...def, rules: def.rules.filter((_, j) => j !== i) });
                }}
                fields={bFields}
                resolvers={resolvers}
                amendable={amendable}
                errors={errors}
                readOnly={readOnly}
              />
            ))}
          </section>

          {/* Control stages */}
          {hasControls && (
            <Panel title="Control stages" subtitle="Always added at the end of every route. No policy can remove or change them." icon={Lock} hue="slate">
              <ol className="space-y-2">
                {setup!.controlStages.map((c) => (
                  <li key={c.key}>
                    <LockedStage name={c.name} who={c.who} />
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {/* Bypass */}
          <Panel
            title="Automatic approvals"
            subtitle="Requests matching one of these are approved without anybody being asked."
            icon={Zap}
            hue="mint"
            actions={
              editable && !hasControls ? (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() =>
                    change({
                      ...def,
                      bypass: [...def.bypass, { id: uniqueSlug(`auto-${def.bypass.length + 1}`, def.bypass.map((b) => b.id)), label: "Approved automatically", when: { all: [newComparison(bFields)] } }],
                    })
                  }
                >
                  Add
                </Button>
              ) : undefined
            }
          >
            {hasControls && (
              <p className="mb-3 flex items-start gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
                This process has control stages, so the engine never approves it automatically.
              </p>
            )}
            {def.bypass.length === 0 ? (
              !hasControls && <p className="text-sm text-neutral-500">None. Every request goes to somebody.</p>
            ) : (
              <ol className="space-y-3">
                {def.bypass.map((b, i) => (
                  <li key={b.id} className={cx("rounded-2xl border p-4", hasErrorUnder(errors, `bypass.${i}`) ? "border-error-500/50" : "border-neutral-200")}>
                    <div className="mb-3 flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`bypass-${i}-label`} className={smallLabel}>
                          Name
                        </label>
                        {readOnly ? (
                          <p className="text-sm font-semibold text-neutral-900">{b.label}</p>
                        ) : (
                          <input
                            id={`bypass-${i}-label`}
                            value={b.label}
                            onChange={(e) => change({ ...def, bypass: def.bypass.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                            className={inputClass}
                          />
                        )}
                        <FieldError message={errorAt(errors, `bypass.${i}.label`)} />
                      </div>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => change({ ...def, bypass: def.bypass.filter((_, j) => j !== i) })}
                          aria-label={`Remove ${b.label}`}
                          className="mt-6 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-700"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className={smallLabel}>Approved automatically when</p>
                    <ConditionBuilder
                      value={b.when}
                      onChange={(c) => change({ ...def, bypass: def.bypass.map((x, j) => (j === i ? { ...x, when: c } : x)) })}
                      fields={bFields}
                      path={`bypass.${i}.when`}
                      errors={errors}
                      readOnly={readOnly}
                      allowAlways={false}
                    />
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {/* Policy-wide */}
          <Panel title="When the rules run out" icon={ShieldCheck} hue="sky">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <ResolverPicker
                  value={def.fallback ?? null}
                  onChange={(r) => change({ ...def, fallback: r })}
                  resolvers={resolvers}
                  path="fallback"
                  errors={errors}
                  idPrefix="policy-fallback"
                  label="If a stage finds nobody, ask"
                  clearable
                  readOnly={readOnly}
                />
                <p className="mt-1.5 text-xs text-neutral-500">Used when a stage has no fallback of its own and its role is vacant.</p>
              </div>
              <div>
                <ResolverPicker
                  value={def.independent ?? null}
                  onChange={(r) => change({ ...def, independent: r })}
                  resolvers={resolvers}
                  path="independent"
                  errors={errors}
                  idPrefix="policy-independent"
                  label="Independent approver"
                  clearable
                  readOnly={readOnly}
                />
                <p className="mt-1.5 text-xs text-neutral-500">Stands in when the person asking is at the top, so nobody approves their own request (e.g. the Chair of Council).</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">Catch split requests</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Adds up a person&apos;s similar requests over the window, so ten requests of ₦90,000 can&apos;t dodge a ₦500,000 rule.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {def.splitting.enabled && (
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="sr-only">Window in days</span>
                    <NumberInput
                      ariaLabel="Window in days"
                      min={1}
                      max={365}
                      value={def.splitting.windowDays}
                      onChange={(v) => change({ ...def, splitting: { ...def.splitting, windowDays: v ?? 30 } })}
                      className="w-24"
                    />
                    days
                  </label>
                )}
                {readOnly ? (
                  <Chip hue={def.splitting.enabled ? "mint" : "slate"}>{def.splitting.enabled ? `On, ${def.splitting.windowDays} days` : "Off"}</Chip>
                ) : (
                  <Switch checked={def.splitting.enabled} onChange={(v) => change({ ...def, splitting: { ...def.splitting, enabled: v } })} label="Catch split requests" />
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right rail */}
        <aside className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pb-4" aria-label="Simulator and history">
          <Simulator
            policyId={policy.id}
            fields={fields}
            flags={flags}
            definition={editable ? def : undefined}
            onErrors={(e) => {
              setErrors(e);
              if (e) setActionError("The simulation found problems in the rules. They are marked below.");
              else setActionError(null);
            }}
          />
          <Panel title="Versions" icon={History} hue="slate" bodyClassName="p-3">
            {history.length === 0 ? (
              <p className="px-2 py-3 text-sm text-neutral-500">No other versions.</p>
            ) : (
              <ol className="space-y-1">
                {[...history]
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/suite/org/approvals/policies/${v.id}`}
                        aria-current={v.id === policy.id ? "page" : undefined}
                        className={cx(
                          "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300",
                          v.id === policy.id && "bg-primary-50/70",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-neutral-900">Version {v.version}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {v.publishedAt ? `In force from ${shortDate(v.effectiveFrom ?? v.publishedAt)}` : v.createdBy ? `By ${v.createdBy}` : `${v.ruleCount} rules`}
                          </span>
                        </span>
                        <PolicyStatusChip status={v.status} />
                      </Link>
                    </li>
                  ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function BackToProcesses() {
  return (
    <Link
      href="/suite/org/approvals"
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-neutral-600 outline-none hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <ArrowLeft size={16} aria-hidden /> All processes
    </Link>
  );
}

function RuleCard({
  rule,
  index,
  count,
  onChange,
  onMove,
  onRemove,
  fields,
  resolvers,
  amendable,
  errors,
  readOnly,
}: {
  rule: PolicyRule;
  index: number;
  count: number;
  onChange: (r: PolicyRule) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  fields: ReturnType<typeof builderFields>;
  resolvers: ResolverInfo[];
  amendable: string[];
  errors: FieldErrors | null;
  readOnly: boolean;
}) {
  const path = `rules.${index}`;
  const stages = rule.stages;
  const labelErr = errorAt(errors, `${path}.label`) ?? errorAt(errors, `${path}.id`) ?? errorAt(errors, path);

  return (
    <article
      aria-label={rule.label || `Rule ${index + 1}`}
      className={cx("ws-card overflow-hidden", hasErrorUnder(errors, path) && "!border-error-500/50 ring-2 ring-error-500/10")}
    >
      <header className="flex items-start gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:px-5">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold tabular-nums text-white" aria-hidden>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {readOnly ? (
            <h3 className="pt-1.5 text-[15px] font-semibold text-neutral-900">{rule.label}</h3>
          ) : (
            <>
              <label htmlFor={`rule-${index}-label`} className="sr-only">
                Rule name
              </label>
              <input
                id={`rule-${index}-label`}
                value={rule.label}
                onChange={(e) => onChange({ ...rule, label: e.target.value })}
                maxLength={160}
                placeholder="e.g. Spending over ₦5 million"
                aria-invalid={Boolean(labelErr) || undefined}
                className={cx(inputClass, "font-semibold")}
              />
            </>
          )}
          <FieldError message={labelErr} />
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${rule.label} up`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowUp size={16} aria-hidden />
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${rule.label} down`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
              <ArrowDown size={16} aria-hidden />
            </button>
            <button type="button" onClick={onRemove} aria-label={`Remove ${rule.label}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-700">
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        )}
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        <div>
          <p className={smallLabel}>Applies when</p>
          <ConditionBuilder value={rule.when} onChange={(when) => onChange({ ...rule, when })} fields={fields} path={`${path}.when`} errors={errors} readOnly={readOnly} />
        </div>

        <div>
          <p className={smallLabel}>Then ask, in order</p>
          <FieldError message={errorAt(errors, `${path}.stages`)} />
          {stages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">No stages: this rule adds nobody yet.</p>
          ) : (
            <ol className="space-y-3">
              {stages.map((s, j) => (
                <li key={s.key}>
                  <StageEditor
                    stage={s}
                    index={j}
                    count={stages.length}
                    onChange={(next) => onChange({ ...rule, stages: stages.map((x, k) => (k === j ? next : x)) })}
                    onRemove={() => onChange({ ...rule, stages: stages.filter((_, k) => k !== j) })}
                    onMove={(dir) => {
                      const moved = moveItem(stages, j, j + dir);
                      if (moved === stages) return;
                      // Moving swaps the two stages' order numbers too, so the move means something to the engine.
                      const a = stages[j];
                      const b = stages[j + dir];
                      onChange({ ...rule, stages: moved.map((x) => (x === a ? { ...a, order: b.order } : x === b ? { ...b, order: a.order } : x)) });
                    }}
                    resolvers={resolvers}
                    amendable={amendable}
                    path={`${path}.stages.${j}`}
                    errors={errors}
                    readOnly={readOnly}
                  />
                </li>
              ))}
            </ol>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange({ ...rule, stages: [...stages, newStage(rule, resolvers)] })}
              className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 text-sm font-semibold text-neutral-600 transition hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-700"
            >
              <Plus size={16} aria-hidden /> Add stage
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * One field per key. A process can redefine a common field (the memo's
 * "category" is a fixed list, not free text); the later, more specific
 * definition wins and keeps the first one's place.
 */
function uniqueFields(list: ContextFieldDef[]): ContextFieldDef[] {
  const byKey = new Map<string, ContextFieldDef>();
  for (const f of list) byKey.set(f.key, f); // a Map keeps the first insertion's place
  return [...byKey.values()];
}
