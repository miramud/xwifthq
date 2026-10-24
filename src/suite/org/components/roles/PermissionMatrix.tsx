"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Clock3, SearchX } from "lucide-react";
import { Chip, SearchField, cx } from "@/components/workspace/kit";
import { keysOf, type Catalogue, type PermissionFeature, type PermissionModule, type Scope } from "@/lib/api/roles-client";
import { FeatureRow, type GrantUpdate } from "./FeatureRow";
import {
  LEVELS,
  LEVEL_LABEL,
  applyBundle,
  featureModel,
  featureSignature,
  holdsBundle,
  type GrantMap,
  type Level,
} from "./permission-model";
import { SegmentedRadio } from "./SegmentedRadio";

/**
 * The permission matrix: module → feature, one row per feature.
 *
 * Each row offers a bundle (None · View · Work · Full) and, where the
 * feature reaches less far than the whole organisation, a scope. Customise
 * opens the individual actions. Confidential features stay locked until the
 * role has Confidential access for their module, and a scope the module's
 * checks don't honour yet is marked as such rather than hidden.
 *
 * Search narrows the matrix to matching features without losing what is held
 * outside the match; a module's "Set all" under a search only touches the
 * features shown.
 */
export function PermissionMatrix({
  catalogue,
  value,
  onChange,
  confidentialModules,
  readOnly = false,
  seededInert = false,
  onRequestConfidential,
}: {
  catalogue: Catalogue;
  /** Held keys and their scopes. */
  value: GrantMap;
  /** Takes an update function so every row can keep one stable handler. */
  onChange?: GrantUpdate;
  /** Modules this role has Confidential access for. Ignored when read-only. */
  confidentialModules: readonly string[];
  readOnly?: boolean;
  /**
   * A seeded role while seeded roles grant nothing: every module says so in
   * its header, so no grant further down the page reads as working today.
   */
  seededInert?: boolean;
  /** "Needs Confidential access for HR": take the admin to that setting. */
  onRequestConfidential?: (moduleKey: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [prefer, setPrefer] = useState<Record<string, Level | null>>({});
  const q = search.trim().toLowerCase();

  const scopeLabels = useMemo(() => {
    const out: Record<Scope, string> = { own: "Own", reports: "My reports", assigned: "Assigned projects", organisation: "Organisation" };
    for (const s of catalogue.scopes ?? []) out[s.key] = s.label;
    return out;
  }, [catalogue]);

  const visible = useMemo(() => {
    const has = (t: string | null | undefined) => (t ?? "").toLowerCase().includes(q);
    return catalogue.modules
      .map((m) => {
        if (q === "" || has(m.label)) return { module: m, features: m.features, actionHits: NO_HITS };
        const features: PermissionFeature[] = [];
        const actionHits = new Set<string>();
        for (const f of m.features) {
          if (has(f.label) || has(f.key)) features.push(f);
          else if (f.permissions.some((p) => has(p.label) || has(p.key) || has(p.description))) {
            features.push(f);
            actionHits.add(f.key);
          }
        }
        return { module: m, features, actionHits };
      })
      .filter((m) => m.features.length > 0);
  }, [catalogue, q]);

  const total = useMemo(() => keysOf(catalogue).length, [catalogue]);
  const selected = Object.keys(value).length;

  const noop = useCallback<GrantUpdate>(() => {}, []);
  const update = onChange && !readOnly ? onChange : noop;
  const onPrefer = useCallback((id: string, level: Level | null) => {
    setPrefer((p) => (p[id] === level ? p : { ...p, [id]: level }));
  }, []);

  return (
    <div className="@container">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search features and actions"
          label="Search permissions"
          className="sm:w-80"
        />
        <p className="text-sm text-neutral-600" aria-live="polite">
          <span className="font-semibold tabular-nums text-neutral-900">{selected}</span> of{" "}
          <span className="tabular-nums">{total}</span> permissions selected
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-dashed border-primary-200 bg-primary-50/30 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700" aria-hidden>
            <SearchX size={22} />
          </span>
          <p className="text-sm font-semibold text-neutral-900">No permission matches “{search}”.</p>
          <p className="text-xs text-neutral-500">Try a feature name such as “leave” or an action such as “approve”.</p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-1 inline-flex h-11 cursor-pointer items-center rounded-xl px-3 text-[13px] font-semibold text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(({ module: m, features, actionHits }) => (
            <ModuleBlock
              key={m.key}
              module={m}
              features={features}
              actionHits={actionHits}
              grants={value}
              liveScopes={catalogue.live?.scopes?.[m.key] ?? ORGANISATION_ONLY}
              scopeLabels={scopeLabels}
              confidentialOk={readOnly || confidentialModules.includes(m.key)}
              readOnly={readOnly}
              searching={q !== ""}
              query={q}
              seededInert={seededInert && !(catalogue.live?.seededModules ?? []).includes(m.key)}
              prefer={prefer}
              onChange={update}
              onPrefer={onPrefer}
              setPrefer={setPrefer}
              onRequestConfidential={onRequestConfidential}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ORGANISATION_ONLY: Scope[] = ["organisation"];
const NO_HITS: ReadonlySet<string> = new Set();

function ModuleBlock({
  module: m,
  features,
  actionHits,
  grants,
  liveScopes,
  scopeLabels,
  confidentialOk,
  readOnly,
  searching,
  query,
  seededInert,
  prefer,
  onChange,
  onPrefer,
  setPrefer,
  onRequestConfidential,
}: {
  module: PermissionModule;
  /** The features shown: all of them, or the search's matches. */
  features: PermissionFeature[];
  /** Features shown because an action matched, not the feature itself. */
  actionHits: ReadonlySet<string>;
  grants: GrantMap;
  liveScopes: readonly Scope[];
  scopeLabels: Readonly<Record<Scope, string>>;
  confidentialOk: boolean;
  readOnly: boolean;
  searching: boolean;
  /** The search, lowercased. */
  query: string;
  seededInert: boolean;
  prefer: Record<string, Level | null>;
  onChange: GrantUpdate;
  onPrefer: (id: string, level: Level | null) => void;
  setPrefer: React.Dispatch<React.SetStateAction<Record<string, Level | null>>>;
  onRequestConfidential?: (moduleKey: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const expanded = open || searching;
  const bodyId = `perm-module-${m.key}`;

  const keys = useMemo(() => keysOf(m), [m]);
  const count = keys.reduce((n, k) => (grants[k] !== undefined ? n + 1 : n), 0);

  const models = useMemo(
    () => features.map((f) => featureModel(f, m.defaultScope, confidentialOk)),
    [features, m.defaultScope, confidentialOk],
  );

  // "Set all" shows a bundle only when every available feature holds exactly
  // its set (a feature with nothing beyond View counts as View, Work and Full).
  const openFeatures = models.filter((md) => !md.fullyLocked);
  const common = openFeatures.length === 0 ? null : (LEVELS.find((l) => openFeatures.every((md) => holdsBundle(md, grants, l))) ?? null);

  const setAll = (level: Level) => {
    onChange((prev) => models.reduce((next, md) => (md.fullyLocked ? next : applyBundle(next, md, level, md.preferredScope)), prev));
    setPrefer((p) => {
      const next = { ...p };
      for (const md of models) next[`${m.key}.${md.feature.key}`] = level === "none" ? null : level;
      return next;
    });
  };

  return (
    <section aria-labelledby={`${bodyId}-title`} className="overflow-hidden rounded-[1.25rem] border border-neutral-200/80 bg-white shadow-sm shadow-primary-900/5">
      <div className="flex flex-col gap-2.5 bg-primary-50/40 px-4 py-3 @min-[34rem]:flex-row @min-[34rem]:items-center @min-[34rem]:justify-between">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <ChevronDown
            size={16}
            className={cx("shrink-0 text-neutral-500 transition-transform duration-200", !expanded && "-rotate-90")}
            aria-hidden
          />
          <span id={`${bodyId}-title`} className="truncate text-[15px] font-bold tracking-tight text-neutral-900">
            {m.label}
          </span>
          <Chip hue={count > 0 ? "blue" : "slate"} className="tabular-nums">
            {count} of {keys.length} permissions
          </Chip>
        </button>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-neutral-500" aria-hidden>
              {searching ? "Set shown" : "Set all"}
            </span>
            <SegmentedRadio
              label={`Set all ${searching ? "shown " : ""}${m.label} features`}
              options={LEVELS.map((l) => ({ key: l, label: LEVEL_LABEL[l] }))}
              value={common}
              onChange={setAll}
              size="sm"
              tone="quiet"
              className="w-full max-w-[13rem]"
            />
          </div>
        )}
      </div>
      {seededInert && (
        <p className="flex items-start gap-1.5 border-t border-sun-500/15 bg-sun-50/70 px-4 py-2 text-xs text-sun-700">
          <Clock3 size={13} aria-hidden className="mt-px shrink-0" />
          <span>
            Grants nothing in {m.label} yet: seeded roles take effect when {m.label} switches to the new checks.
          </span>
        </p>
      )}

      {expanded && (
        <ul id={bodyId} className="divide-y divide-neutral-100 border-t border-neutral-100">
          {models.map((md) => {
            const f = md.feature;
            const id = `${m.key}.${f.key}`;
            return (
              <FeatureRow
                key={f.key}
                feature={f}
                moduleKey={m.key}
                moduleLabel={m.label}
                defaultScope={m.defaultScope}
                liveScopes={liveScopes}
                scopeLabels={scopeLabels}
                confidentialOk={confidentialOk}
                readOnly={readOnly}
                sig={featureSignature(f, grants)}
                grants={grants}
                prefer={prefer[id] ?? null}
                forceCustomise={actionHits.has(f.key)}
                match={actionHits.has(f.key) ? query : ""}
                onChange={onChange}
                onPrefer={onPrefer}
                onRequestConfidential={onRequestConfidential}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * What a set of permissions adds up to, one collapsed row per module:
 * "Learning · 14 of 22". Opening a row lists the features and actions.
 */
/**
 * What an empty permission list means for a person. The Employee and User
 * roles grant no console permissions, yet those people still see and do their
 * own work, so "0 in total" read as "can do nothing".
 */
export const SELF_SERVICE_ONLY =
  "Self-service only: their own employment, learning and project work. No admin permissions.";

export function EffectivePermissions({
  catalogue,
  keys,
  empty = "No permissions yet.",
}: {
  catalogue: Catalogue;
  keys: string[];
  empty?: string;
}) {
  const held = new Set(keys);
  const modules = catalogue.modules
    .map((m) => ({
      ...m,
      features: m.features
        .map((f) => ({ ...f, permissions: f.permissions.filter((p) => held.has(p.key)) }))
        .filter((f) => f.permissions.length > 0),
      total: keysOf(m).length,
    }))
    .filter((m) => m.features.length > 0);

  if (modules.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;

  return (
    <ul className="space-y-2">
      {modules.map((m) => {
        const n = m.features.reduce((s, f) => s + f.permissions.length, 0);
        return (
          <li key={m.key}>
            <details className="group rounded-2xl border border-neutral-200/80 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-neutral-900">{m.label}</span>
                <span className="flex items-center gap-2 text-xs tabular-nums text-neutral-500">
                  {n} of {m.total}
                  <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />
                </span>
              </summary>
              <dl className="space-y-2 border-t border-neutral-100 px-3.5 py-3">
                {m.features.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                    <dt className="shrink-0 text-xs font-semibold text-neutral-700 sm:w-36">{f.label}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {f.permissions.map((p) => (
                        <Chip key={p.key} hue="slate">
                          {p.label}
                        </Chip>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
