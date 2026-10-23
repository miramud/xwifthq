"use client";

import { memo, useMemo, useState } from "react";
import { ChevronDown, Clock3, Info, Lock, SlidersHorizontal } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import type { PermissionFeature, Scope } from "@/lib/api/roles-client";
import {
  LEVELS,
  LEVEL_LABEL,
  SCOPE_SHORT,
  applyBundle,
  applyScope,
  bundleScope,
  featureModel,
  heldSummary,
  leftOut,
  readState,
  setKeyScope,
  toggleKey,
  type GrantMap,
  type Level,
} from "./permission-model";
import { SegmentedRadio, type SegmentOption } from "./SegmentedRadio";

export type GrantUpdate = (update: (prev: GrantMap) => GrantMap) => void;

export interface FeatureRowProps {
  feature: PermissionFeature;
  moduleKey: string;
  moduleLabel: string;
  defaultScope: Scope;
  /** The scopes today's checks honour for this module. */
  liveScopes: readonly Scope[];
  scopeLabels: Readonly<Record<Scope, string>>;
  confidentialOk: boolean;
  readOnly: boolean;
  /** The held keys and scopes of this feature: the row re-renders only when it changes. */
  sig: string;
  grants: GrantMap;
  /** The bundle last clicked here, to break a tie between two bundles that grant the same set. */
  prefer: Level | null;
  /** Search matched an action, not the feature: show the actions. */
  forceCustomise: boolean;
  /** The search, lowercased, when it matched actions here: those actions are marked. */
  match: string;
  onChange: GrantUpdate;
  onPrefer: (featureId: string, level: Level | null) => void;
  onRequestConfidential?: (moduleKey: string) => void;
}

/*
  Rows are laid out by the matrix's container width, not the viewport: the
  permissions panel sits in a column, so "wide enough for one line" depends
  on the panel. One aligned line (label | bundle | scope | Customise) from
  44rem, with Customise as an icon until 58rem; two lines from 30rem, with
  the bundle in a fixed track so every row's segments line up; stacked
  below that.
*/
const GRID = cx(
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5",
  "[grid-template-areas:'label_custom'_'bundle_bundle'_'scope_scope']",
  "@min-[30rem]:grid-cols-[12rem_minmax(0,1fr)_auto]",
  "@min-[30rem]:[grid-template-areas:'label_label_custom'_'bundle_scope_scope']",
  "@min-[44rem]:grid-cols-[minmax(0,1fr)_12rem_11rem_3.5rem] @min-[44rem]:gap-x-3",
  "@min-[58rem]:grid-cols-[minmax(0,1fr)_12.5rem_11.5rem_7.25rem] @min-[58rem]:gap-x-4",
  "@min-[44rem]:[grid-template-areas:'label_bundle_scope_custom']",
);
const LOCKED_GRID = cx(
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5",
  "[grid-template-areas:'label_custom'_'lock_lock']",
  "@min-[44rem]:grid-cols-[minmax(0,1fr)_23.75rem_3.5rem] @min-[44rem]:gap-x-3",
  "@min-[58rem]:grid-cols-[minmax(0,1fr)_25rem_7.25rem] @min-[58rem]:gap-x-4",
  "@min-[44rem]:[grid-template-areas:'label_lock_custom']",
);

function FeatureRowImpl({
  feature,
  moduleKey,
  moduleLabel,
  defaultScope,
  liveScopes,
  scopeLabels,
  confidentialOk,
  readOnly,
  grants,
  prefer,
  forceCustomise,
  match,
  onChange,
  onPrefer,
  onRequestConfidential,
}: FeatureRowProps) {
  // Unset until somebody toggles it, so a search that matches an action opens it.
  const [open, setOpen] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Scope | null>(null);
  const model = useMemo(() => featureModel(feature, defaultScope, confidentialOk), [feature, defaultScope, confidentialOk]);
  const state = readState(model, grants, prefer);
  const id = `${moduleKey}.${feature.key}`;
  const panelId = `customise-${moduleKey}-${feature.key}`;
  const expanded = open ?? forceCustomise;
  const isLive = (s: Scope) => liveScopes.includes(s);
  const shownScope: Scope | "mixed" = state.held === 0 ? bundleScope(model, state, pending) : state.scope;
  const scopeForBundle = bundleScope(model, state, pending);

  const pickLevel = (level: Level) => {
    onPrefer(id, level === "none" ? null : level);
    onChange((prev) => applyBundle(prev, model, level, scopeForBundle));
  };
  const pickScope = (scope: Scope) => {
    if (state.held === 0) setPending(scope);
    else onChange((prev) => applyScope(prev, model, state, scope));
  };

  const levelOptions: SegmentOption<Level>[] = LEVELS.map((l) => ({
    key: l,
    label: LEVEL_LABEL[l],
    unavailable: l !== "none" && model.emptyLevels.has(l),
    note: l !== "none" && model.emptyLevels.has(l) ? "Nothing more in this feature" : undefined,
  }));
  const scopeOptions = (scopes: readonly Scope[]): SegmentOption<Scope>[] =>
    scopes.map((s) => ({
      key: s,
      label: SCOPE_SHORT[s],
      name: scopeLabels[s],
      icon: isLive(s) ? undefined : Clock3,
      note: isLive(s) ? undefined : `${scopeLabels[s]}: not checked yet. Takes effect when ${moduleLabel} switches to the new checks.`,
    }));

  const heldScopes = feature.permissions.filter((p) => grants[p.key] !== undefined).map((p) => grants[p.key]);
  const notLive = heldScopes.filter((s) => !isLive(s));
  const omitted = state.level !== "custom" && state.level !== "none" && state.scope !== "mixed" ? leftOut(model, state.level, state.scope) : [];
  const onlyOrgWide = omitted.every((p) => p.scopes.length === 1 && p.scopes[0] === "organisation");
  const lockedHeld = model.locked.filter((p) => grants[p.key] !== undefined).length;

  const summary =
    state.level === "custom" ? (
      <>
        <span className="font-semibold text-neutral-700">
          Custom · {state.held} of {state.total + lockedHeld}
        </span>
        <span aria-hidden> · </span>
        {heldSummary(feature, grants)}
      </>
    ) : (
      heldSummary(feature, grants)
    );

  const requestAccess = onRequestConfidential && !readOnly ? () => onRequestConfidential(moduleKey) : undefined;

  /* -------- the label cell, shared by both layouts -------- */
  const labelCell = (
    <div className="min-w-0 [grid-area:label]">
      <p className={cx("text-sm font-semibold", model.fullyLocked ? "text-neutral-500" : "text-neutral-900")}>
        {feature.label}
      </p>
      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-neutral-500">
        {model.confidential && !model.fullyLocked && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600"
            title={
              model.locked.length > 0
                ? "Some actions are confidential and need Confidential access for this module."
                : "Confidential: pay, discipline, personal records or bank details."
            }
          >
            <Lock size={10} aria-hidden />
            Confidential
          </span>
        )}
        <span
          className="line-clamp-2 min-w-0 basis-full @min-[30rem]:line-clamp-1 @min-[30rem]:flex-1 @min-[30rem]:basis-0"
          title={heldSummary(feature, grants, 99)}
        >
          {model.fullyLocked ? "Not available to this role" : summary}
        </span>
      </p>
    </div>
  );

  const customiseButton = (
    <button
      type="button"
      onClick={() => setOpen(!expanded)}
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={`Customise ${feature.label}`}
      title="Customise: pick single actions"
      className={cx(
        "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 justify-self-end rounded-xl px-2.5 text-xs font-semibold outline-none transition-colors [grid-area:custom]",
        "focus-visible:ring-2 focus-visible:ring-primary-300",
        expanded ? "bg-primary-50 text-primary-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <SlidersHorizontal size={13} aria-hidden />
      <span className="@min-[44rem]:hidden @min-[58rem]:inline">Customise</span>
      <ChevronDown size={13} aria-hidden className={cx("transition-transform duration-200", expanded && "rotate-180")} />
    </button>
  );

  return (
    <li
      className={cx(
        "px-4 py-3 transition-colors",
        model.fullyLocked ? "bg-neutral-50/80" : expanded ? "bg-primary-50/25" : "hover:bg-neutral-50/60",
      )}
    >
      {model.fullyLocked ? (
        <div className={LOCKED_GRID}>
          {labelCell}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 [grid-area:lock]">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <Lock size={13} aria-hidden />
              Confidential
            </span>
            {requestAccess ? (
              <button
                type="button"
                onClick={requestAccess}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg px-2 text-xs font-semibold text-primary-700 underline-offset-2 outline-none hover:bg-primary-50 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                Needs Confidential access for {moduleLabel}
              </button>
            ) : (
              <span className="text-xs text-neutral-500">Needs Confidential access for {moduleLabel}</span>
            )}
          </div>
          {customiseButton}
        </div>
      ) : (
        <div className={GRID}>
          {labelCell}
          <div className="min-w-0 [grid-area:bundle]">
            <SegmentedRadio
              label={`${feature.label} access level`}
              options={levelOptions}
              value={state.level === "custom" ? null : state.level}
              onChange={pickLevel}
              disabled={readOnly}
              size="sm"
            />
          </div>
          <div className="min-w-0 [grid-area:scope]">
            {model.scopes.length > 1 ? (
              <SegmentedRadio
                label={`${feature.label} scope`}
                options={scopeOptions(model.scopes)}
                value={shownScope === "mixed" ? null : shownScope}
                onChange={pickScope}
                disabled={readOnly}
                size="sm"
                tone="quiet"
                className="@min-[30rem]:max-w-[15rem]"
              />
            ) : (
              <span className="inline-flex h-8 items-center px-1 text-xs text-neutral-500">
                {model.scopes[0] === "organisation" ? "Organisation-wide" : scopeLabels[model.scopes[0]]}
              </span>
            )}
          </div>
          {customiseButton}
        </div>
      )}

      {/* Notes: calm, one line each, never error red. */}
      {!model.fullyLocked && (
        <RowNotes
          mixed={shownScope === "mixed"}
          notLive={state.held > 0 ? notLive.length : 0}
          allNotLive={notLive.length > 0 && notLive.length === heldScopes.length}
          moduleLabel={moduleLabel}
          omitted={omitted.length}
          onlyOrgWide={onlyOrgWide}
          scopeLabel={state.scope !== "mixed" ? scopeLabels[state.scope] : ""}
          onCustomise={expanded ? undefined : () => setOpen(true)}
          lockedCount={model.locked.length}
          lockedLabels={model.locked.map((p) => p.label.toLowerCase())}
          onRequestConfidential={requestAccess}
        />
      )}

      {expanded && (
        <div id={panelId} className="mt-3 rounded-xl border border-neutral-200/80 bg-white p-1.5">
          <ul className="divide-y divide-neutral-100">
            {feature.permissions.map((p) => {
              const held = grants[p.key];
              const locked = model.locked.includes(p);
              const offered = model.scopes.filter((s) => p.scopes.includes(s));
              const inputId = `perm-${p.key}`;
              const hit =
                match !== "" && [p.label, p.key, p.description ?? ""].some((t) => t.toLowerCase().includes(match));
              return (
                <li
                  key={p.key}
                  className={cx(
                    "flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg px-2.5 py-1",
                    hit ? "bg-sun-50" : held !== undefined ? "bg-primary-50/40" : "",
                  )}
                >
                  <label
                    htmlFor={inputId}
                    title={p.description ?? p.key}
                    className={cx(
                      "flex min-w-[9rem] flex-1 items-center gap-2.5 py-1.5 text-[13px] font-medium",
                      locked ? "cursor-not-allowed text-neutral-500" : readOnly ? "text-neutral-800" : "cursor-pointer text-neutral-800",
                    )}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={held !== undefined}
                      disabled={readOnly || locked}
                      onChange={(e) => {
                        onPrefer(id, null);
                        onChange((prev) => toggleKey(prev, p, e.target.checked, scopeForBundle));
                      }}
                      aria-label={`${feature.label}: ${p.label}`}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0">{p.label}</span>
                    {hit && (
                      <span className="shrink-0 rounded-full bg-sun-100 px-1.5 py-0.5 text-[11px] font-semibold text-sun-700">
                        Matches search
                      </span>
                    )}
                    {locked && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-neutral-500">
                        <Lock size={11} aria-hidden />
                        Confidential
                      </span>
                    )}
                  </label>
                  {offered.length > 1 && !locked && held !== undefined ? (
                    <SegmentedRadio
                      label={`${p.label} scope`}
                      options={scopeOptions(offered)}
                      value={held}
                      onChange={(s) => onChange((prev) => setKeyScope(prev, p.key, s))}
                      disabled={readOnly}
                      size="sm"
                      tone="quiet"
                      className="ml-auto w-auto"
                    />
                  ) : offered.length > 1 && !locked ? (
                    <span className="ml-auto text-xs text-neutral-500">{offered.map((s) => SCOPE_SHORT[s]).join(" · ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}


function RowNotes({
  mixed,
  notLive,
  allNotLive,
  moduleLabel,
  omitted,
  onlyOrgWide,
  scopeLabel,
  onCustomise,
  lockedCount,
  lockedLabels,
  onRequestConfidential,
}: {
  mixed: boolean;
  notLive: number;
  allNotLive: boolean;
  moduleLabel: string;
  omitted: number;
  onlyOrgWide: boolean;
  scopeLabel: string;
  onCustomise?: () => void;
  lockedCount: number;
  lockedLabels: string[];
  onRequestConfidential?: () => void;
}) {
  const notes: React.ReactNode[] = [];

  if (mixed) {
    notes.push(
      <span key="mixed" className="inline-flex items-start gap-1.5 text-neutral-600">
        <Info size={13} aria-hidden className="mt-0.5 shrink-0 text-neutral-500" />
        Mixed scopes: these actions sit at different scopes. Pick a scope to move the actions that offer it.
      </span>,
    );
  }

  if (notLive > 0) {
    notes.push(
      <span key="live" className="inline-flex items-start gap-1.5 rounded-lg bg-sun-50 px-2 py-1 text-sun-700">
        <Clock3 size={13} aria-hidden className="mt-px shrink-0" />
        <span>
          {allNotLive
            ? `${notLiveLineFull(moduleLabel)}. Until then this grant gives nothing.`
            : `${notLive} of these grants take effect when ${moduleLabel} switches to the new checks. Until then they give nothing.`}
        </span>
      </span>,
    );
  }

  if (omitted > 0) {
    notes.push(
      <span key="omitted" className="inline-flex items-start gap-1.5 text-neutral-600">
        <Info size={13} aria-hidden className="mt-0.5 shrink-0 text-neutral-500" />
        <span>
          {omitted} {omitted === 1 ? "action" : "actions"}{" "}
          {onlyOrgWide ? "only work organisation-wide" : `don't offer ${scopeLabel}`} and{" "}
          {omitted === 1 ? "was" : "were"} left out.{" "}
          {onCustomise && (
            <button type="button" onClick={onCustomise} className="inline cursor-pointer rounded px-0.5 py-1.5 font-semibold text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
              Customise to add {omitted === 1 ? "it" : "them"} at Organisation
            </button>
          )}
        </span>
      </span>,
    );
  }

  if (lockedCount > 0) {
    notes.push(
      <span key="locked" className="inline-flex items-start gap-1.5 text-neutral-600">
        <Lock size={12} aria-hidden className="mt-0.5 shrink-0 text-neutral-500" />
        <span>
          {lockedCount === 1
            ? `“${capitalise(lockedLabels[0])}” is confidential and left out of the bundles.`
            : `${lockedCount} confidential actions are left out of the bundles.`}{" "}
          {onRequestConfidential && (
            <button type="button" onClick={onRequestConfidential} className="inline cursor-pointer rounded px-0.5 py-1.5 font-semibold text-primary-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
              Needs Confidential access for {moduleLabel}
            </button>
          )}
        </span>
      </span>,
    );
  }

  if (notes.length === 0) return null;
  return <div className="mt-2 flex flex-col items-start gap-1.5 text-xs leading-relaxed">{notes}</div>;
}

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const notLiveLineFull = (moduleLabel: string) => `Takes effect when ${moduleLabel} switches to the new checks`;

/**
 * Memoised on the feature's held keys (`sig`), not on the whole grant map,
 * so a click re-renders one row rather than 134.
 */
export const FeatureRow = memo(FeatureRowImpl, (a, b) => {
  for (const k of Object.keys(a) as (keyof FeatureRowProps)[]) {
    if (k === "grants") continue;
    if (a[k] !== b[k]) return false;
  }
  return true;
});
