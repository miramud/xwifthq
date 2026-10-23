"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Lock, Trash2, UserCheck } from "lucide-react";
import type { ResolverInfo, ResolverSpec, StageSpec } from "@/lib/api/org-foundations-client";
import type { Completion, StageType } from "@/lib/api/approvals-client";
import { Chip, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Switch, inputClass } from "@/suite/lms/components/ui/ws";
import { errorAt, hasErrorUnder, resolverFor, type FieldErrors } from "./policy-logic";
import { labelFor, lookupForParam, useLookup } from "./lookups";
import { FieldError, LookupSelect, NumberInput, smallLabel } from "./parts";

/*
  One stage of a rule: who is asked, how many of them must answer, how long
  they have, and what they may change. The resolver picker is driven by the
  API's resolver list — each kind says which parameters it needs (a role, a
  person, a unit, a committee) and the picker shows exactly those.
*/

export const STAGE_TYPES: { value: StageType; label: string; hint: string }[] = [
  { value: "approval", label: "Approves", hint: "Can approve, reject or send back" },
  { value: "review", label: "Reviews", hint: "Checks it before the approvers" },
  { value: "acknowledge", label: "Acknowledges", hint: "Is told and confirms they have seen it" },
  { value: "prepare", label: "Prepares", hint: "Gets it ready (e.g. raises the voucher)" },
];

export const COMPLETIONS: { value: Completion; label: string }[] = [
  { value: "one", label: "Any one of them" },
  { value: "all", label: "Every one of them" },
  { value: "quorum", label: "A set number of them" },
  { value: "all_projects", label: "One per project" },
];

const PARAM_LABEL: Record<string, string> = {
  role: "Approval role",
  user: "Person",
  unit: "Unit",
  committee: "Committee",
};

/** Who approves: a kind, then whatever that kind needs. */
export function ResolverPicker({
  value,
  onChange,
  resolvers,
  path,
  errors,
  idPrefix,
  label = "Who approves",
  clearable = false,
  readOnly,
}: {
  value: ResolverSpec | null;
  onChange: (r: ResolverSpec | null) => void;
  resolvers: ResolverInfo[];
  path: string;
  errors?: FieldErrors | null;
  idPrefix: string;
  label?: string;
  clearable?: boolean;
  readOnly?: boolean;
}) {
  const info = value ? resolvers.find((r) => r.kind === value.kind) : undefined;
  const kindErr = errorAt(errors, `${path}.kind`) ?? errorAt(errors, path);

  if (readOnly) {
    return <ResolverSummary value={value} resolvers={resolvers} label={label} />;
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-kind`} className={smallLabel}>
          {label}
        </label>
        <SearchableSelect
          id={`${idPrefix}-kind`}
          value={value?.kind ?? ""}
          onChange={(kind) => onChange(kind === "" ? null : resolverFor(kind, resolvers, value))}
          options={resolvers.map((r) => ({ value: r.kind, label: r.label }))}
          placeholder="Choose how approvers are found"
          clearable={clearable}
          clearLabel="Nobody (no fallback)"
          aria-invalid={Boolean(kindErr) || undefined}
        />
        <FieldError message={kindErr} />
      </div>
      {value &&
        Object.entries(info?.params ?? {}).map(([param, type]) => {
          const lookup = lookupForParam(type);
          const err = errorAt(errors, `${path}.${param}`);
          const pid = `${idPrefix}-${param}`;
          const usesField = param === "unitId" && Boolean(value.field);
          return (
            <div key={param}>
              <label htmlFor={pid} className={smallLabel}>
                {PARAM_LABEL[type] ?? param}
              </label>
              {usesField ? (
                <p className="rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">Taken from the request’s “{value.field}”.</p>
              ) : lookup ? (
                <LookupSelect
                  id={pid}
                  lookup={lookup}
                  value={value[param] ?? ""}
                  onChange={(v) => onChange({ ...value, [param]: v })}
                  placeholder={`Choose the ${(PARAM_LABEL[type] ?? param).toLowerCase()}`}
                  invalid={Boolean(err)}
                />
              ) : (
                <input id={pid} value={value[param] ?? ""} onChange={(e) => onChange({ ...value, [param]: e.target.value })} className={inputClass} aria-invalid={Boolean(err) || undefined} />
              )}
              <FieldError message={err} />
            </div>
          );
        })}
    </div>
  );
}

/** "Approval role: Bursar" in words, for read-only views. */
export function ResolverSummary({ value, resolvers, label }: { value: ResolverSpec | null; resolvers: ResolverInfo[]; label?: string }) {
  if (!value) return <p className="text-sm text-neutral-500">{label ? `${label}: ` : ""}nobody</p>;
  const info = resolvers.find((r) => r.kind === value.kind);
  return (
    <p className="text-sm text-neutral-800">
      {label && <span className="text-neutral-500">{label}: </span>}
      <span className="font-semibold">{info?.label ?? value.kind}</span>
      {Object.entries(info?.params ?? {}).map(([param, type]) => (
        <ParamValue key={param} type={type} value={value[param] ?? ""} />
      ))}
    </p>
  );
}

function ParamValue({ type, value }: { type: string; value: string }) {
  const lookup = lookupForParam(type);
  const state = useLookup(lookup);
  if (!value) return null;
  return <span> · {lookup ? labelFor(state.options, value) : value}</span>;
}

export function StageEditor({
  stage,
  onChange,
  onRemove,
  onMove,
  index,
  count,
  resolvers,
  amendable,
  path,
  errors,
  readOnly,
}: {
  stage: StageSpec;
  onChange: (s: StageSpec) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  index: number;
  count: number;
  resolvers: ResolverInfo[];
  amendable: string[];
  path: string;
  errors?: FieldErrors | null;
  readOnly?: boolean;
}) {
  const id = useId();
  const set = <K extends keyof StageSpec>(k: K, v: StageSpec[K]) => onChange({ ...stage, [k]: v });
  const nameErr = errorAt(errors, `${path}.name`) ?? errorAt(errors, `${path}.key`);
  const flagged = hasErrorUnder(errors, path);

  if (readOnly) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-neutral-900 px-2 text-xs font-bold tabular-nums text-white">{stage.order}</span>
          <p className="text-sm font-semibold text-neutral-900">{stage.name}</p>
          <Chip hue="sky">{STAGE_TYPES.find((t) => t.value === stage.type)?.label ?? stage.type}</Chip>
          <Chip hue="slate">{COMPLETIONS.find((c) => c.value === stage.completion)?.label ?? stage.completion}{stage.completion === "quorum" && stage.quorum ? ` (${stage.quorum})` : ""}</Chip>
          {stage.slaHours && <Chip hue="sun">{stage.slaHours} working hours</Chip>}
          {stage.distinctPerson && <Chip hue="grape" icon={UserCheck}>Different person</Chip>}
        </div>
        <div className="mt-2 space-y-1">
          <ResolverSummary value={stage.resolver} resolvers={resolvers} label="Who" />
          {stage.fallback && <ResolverSummary value={stage.fallback} resolvers={resolvers} label="If nobody is found" />}
          {stage.canAmend.length > 0 && <p className="text-xs text-neutral-500">May change: {stage.canAmend.join(", ")}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cx("rounded-2xl border bg-white p-4", flagged ? "border-error-500/50 ring-2 ring-error-500/10" : "border-neutral-200")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-1 sm:flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${stage.name || "this stage"} up`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Move ${stage.name || "this stage"} down`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowDown size={16} aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <div>
              <label htmlFor={`${id}-name`} className={smallLabel}>
                Stage name
              </label>
              <input
                id={`${id}-name`}
                value={stage.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Head of department"
                maxLength={160}
                aria-invalid={Boolean(nameErr) || undefined}
                className={inputClass}
              />
              <FieldError message={nameErr} />
            </div>
            <div>
              <label htmlFor={`${id}-order`} className={smallLabel}>
                Order
              </label>
              <NumberInput id={`${id}-order`} min={1} max={999} value={stage.order} onChange={(v) => set("order", v ?? 1)} invalid={Boolean(errorAt(errors, `${path}.order`))} />
              <FieldError message={errorAt(errors, `${path}.order`)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-type`} className={smallLabel}>
                What they do
              </label>
              <select id={`${id}-type`} value={stage.type} onChange={(e) => set("type", e.target.value as StageType)} className={cx(inputClass, "cursor-pointer")}>
                {stage.type === "control" && <option value="control">Controls — checks it independently</option>}
                {STAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {t.hint}
                  </option>
                ))}
              </select>
              <FieldError message={errorAt(errors, `${path}.type`)} />
            </div>
            <div>
              <label htmlFor={`${id}-completion`} className={smallLabel}>
                Who must answer
              </label>
              <div className="flex gap-2">
                <select
                  id={`${id}-completion`}
                  value={stage.completion}
                  onChange={(e) => {
                    const c = e.target.value as Completion;
                    onChange({ ...stage, completion: c, quorum: c === "quorum" ? stage.quorum ?? 2 : null });
                  }}
                  className={cx(inputClass, "cursor-pointer")}
                >
                  {COMPLETIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {stage.completion === "quorum" && (
                  <NumberInput
                    ariaLabel="How many must approve"
                    min={1}
                    max={50}
                    value={stage.quorum}
                    onChange={(v) => set("quorum", v)}
                    className="w-24 shrink-0"
                    invalid={Boolean(errorAt(errors, `${path}.quorum`))}
                  />
                )}
              </div>
              <FieldError message={errorAt(errors, `${path}.quorum`) ?? errorAt(errors, `${path}.completion`)} />
            </div>
          </div>

          <ResolverPicker
            value={stage.resolver}
            onChange={(r) => r && set("resolver", r)}
            resolvers={resolvers}
            path={`${path}.resolver`}
            errors={errors}
            idPrefix={`${id}-resolver`}
          />

          <details className="group rounded-xl bg-neutral-50/70 p-3 [&_summary::-webkit-details-marker]:hidden" open={Boolean(stage.fallback || stage.slaHours || stage.distinctPerson || stage.canAmend.length || hasErrorUnder(errors, `${path}.fallback`) || errorAt(errors, `${path}.slaHours`))}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-neutral-700">More options: fallback, time allowed, changes</summary>
            <div className="mt-3 space-y-4">
              <ResolverPicker
                value={stage.fallback}
                onChange={(r) => set("fallback", r)}
                resolvers={resolvers}
                path={`${path}.fallback`}
                errors={errors}
                idPrefix={`${id}-fallback`}
                label="If nobody is found, ask"
                clearable
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${id}-sla`} className={smallLabel}>
                    Time allowed (working hours)
                  </label>
                  <NumberInput id={`${id}-sla`} min={1} max={720} value={stage.slaHours} onChange={(v) => set("slaHours", v)} placeholder="Process default" invalid={Boolean(errorAt(errors, `${path}.slaHours`))} />
                  <FieldError message={errorAt(errors, `${path}.slaHours`)} />
                </div>
                <div className="flex items-end">
                  <div className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3">
                    <span className="text-sm text-neutral-700" id={`${id}-distinct`}>
                      Different person required
                    </span>
                    <Switch checked={stage.distinctPerson} onChange={(v) => set("distinctPerson", v)} label="Different person required" />
                  </div>
                </div>
              </div>
              {amendable.length > 0 && (
                <fieldset>
                  <legend className={smallLabel}>May change before approving</legend>
                  <div className="flex flex-wrap gap-2">
                    {amendable.map((f) => {
                      const on = stage.canAmend.includes(f);
                      return (
                        <label key={f} className={cx("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm", on ? "border-primary-300 bg-primary-50 text-primary-700" : "border-neutral-200 bg-white text-neutral-700")}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => set("canAmend", on ? stage.canAmend.filter((x) => x !== f) : [...stage.canAmend, f])}
                            className="h-4 w-4 accent-primary-600"
                          />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </details>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${stage.name || "this stage"}`}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-end rounded-xl text-neutral-500 hover:bg-error-500/10 hover:text-error-700 sm:self-start"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** A process's control stage: always added, never edited. Hatched to read as fixed. */
export function LockedStage({ name, who }: { name: string; who: string }) {
  return (
    <div className="ws-hatch flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-600 ring-1 ring-neutral-200">
        <Lock size={16} aria-hidden />
      </span>
      <div className="min-w-0 rounded-lg bg-white/90 px-2 py-1">
        <p className="text-sm font-semibold text-neutral-900">{name}</p>
        <p className="text-xs text-neutral-600">{who} · control stage, always added</p>
      </div>
    </div>
  );
}
