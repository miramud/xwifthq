import type { Catalogue, Grant, Permission, PermissionFeature, PermissionModule, RoleSettings, Scope } from "@/lib/api/roles-client";

/*
  The rules behind the role editor's matrix, kept apart from the markup so
  each one is a plain function a test can call.

  A role's permissions are a map of key → scope. A feature is read back as a
  bundle (View, Work, Full) at one scope when the held keys are exactly that
  bundle's set, and as Custom otherwise. A bundle at scope S grants every key
  of the feature whose bundle is no bigger than it and which offers S, except
  confidential keys the role has no Confidential access for.
*/

export type GrantMap = Readonly<Record<string, Scope>>;

export const LEVELS = ["none", "view", "work", "full"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = { none: "None", view: "View", work: "Work", full: "Full" };

const RANK: Record<Level, number> = { none: 0, view: 1, work: 2, full: 3 };

export const SCOPE_ORDER: Scope[] = ["own", "reports", "assigned", "organisation"];

/** Short visible names for the compact scope picker; the full name is the radio's accessible name. */
export const SCOPE_SHORT: Record<Scope, string> = {
  own: "Own",
  reports: "Reports",
  assigned: "Assigned",
  organisation: "Organisation",
};

export const DEFAULT_SETTINGS: RoleSettings = {
  joinsEveryProject: false,
  projectActivity: "digest",
  confidentialModules: [],
  organisationAdmin: false,
};

export function toGrantMap(grants: Grant[]): GrantMap {
  const out: Record<string, Scope> = {};
  for (const g of grants) out[g.key] = g.scope;
  return out;
}

export function toGrants(map: GrantMap): Grant[] {
  return Object.keys(map)
    .sort()
    .map((key) => ({ key, scope: map[key] }));
}

export function sameGrants(a: GrantMap, b: GrantMap): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

export function sameSettings(a: RoleSettings | null, b: RoleSettings | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.joinsEveryProject === b.joinsEveryProject &&
    a.projectActivity === b.projectActivity &&
    a.organisationAdmin === b.organisationAdmin &&
    [...a.confidentialModules].sort().join() === [...b.confidentialModules].sort().join()
  );
}

/* ------------------------------------------------------------------ */
/*  One feature                                                        */
/* ------------------------------------------------------------------ */

export interface FeatureModel {
  feature: PermissionFeature;
  /** Keys the role may hold now. */
  available: Permission[];
  /** Confidential keys the role has no Confidential access for. */
  locked: Permission[];
  /** Every key is locked: the whole row is unavailable. */
  fullyLocked: boolean;
  /** Has confidential keys at all, locked or not. */
  confidential: boolean;
  /** The scopes the available keys offer, narrowest first. */
  scopes: Scope[];
  /** Levels that add nothing over the level below. */
  emptyLevels: ReadonlySet<Level>;
  /** The scope a bundle takes when nothing is held yet. */
  preferredScope: Scope;
}

export function featureModel(feature: PermissionFeature, defaultScope: Scope, confidentialOk: boolean): FeatureModel {
  const available = feature.permissions.filter((p) => !p.confidential || confidentialOk);
  const locked = feature.permissions.filter((p) => p.confidential && !confidentialOk);
  const offered = new Set(available.flatMap((p) => p.scopes));
  const scopes = SCOPE_ORDER.filter((s) => offered.has(s));
  const bundles = new Set(available.map((p) => p.bundle));
  const emptyLevels = new Set<Level>((["view", "work", "full"] as const).filter((l) => !bundles.has(l)));
  return {
    feature,
    available,
    locked,
    fullyLocked: available.length === 0 && locked.length > 0,
    confidential: feature.permissions.some((p) => p.confidential),
    scopes: scopes.length > 0 ? scopes : ["organisation"],
    emptyLevels,
    preferredScope: offered.has(defaultScope) ? defaultScope : "organisation",
  };
}

const within = (p: Permission, level: Level) => RANK[p.bundle] <= RANK[level];

/** The keys bundle `level` grants at `scope`. */
export function bundleKeys(model: FeatureModel, level: Level, scope: Scope): Permission[] {
  if (level === "none") return [];
  return model.available.filter((p) => within(p, level) && p.scopes.includes(scope));
}

/** The keys bundle `level` would grant but leaves out because they don't offer `scope`. */
export function leftOut(model: FeatureModel, level: Level, scope: Scope): Permission[] {
  if (level === "none") return [];
  return model.available.filter((p) => within(p, level) && !p.scopes.includes(scope));
}

export interface FeatureState {
  /** The bundle the held keys add up to, or custom. */
  level: Level | "custom";
  /** The one scope every held key sits at, or mixed. With nothing held: the preferred scope. */
  scope: Scope | "mixed";
  /** Keys of this feature the role holds. */
  held: number;
  /** Keys of this feature the role could hold now. */
  total: number;
}

/**
 * What the held keys add up to. When two bundles grant the same set at this
 * scope, `prefer` (the one last clicked) wins, else the smallest.
 */
export function readState(model: FeatureModel, grants: GrantMap, prefer?: Level | null): FeatureState {
  const all = model.feature.permissions;
  const heldKeys = all.filter((p) => grants[p.key] !== undefined);
  const total = model.available.length;
  if (heldKeys.length === 0) return { level: "none", scope: model.preferredScope, held: 0, total };

  const scopes = new Set(heldKeys.map((p) => grants[p.key]));
  if (scopes.size > 1) return { level: "custom", scope: "mixed", held: heldKeys.length, total };
  const scope = grants[heldKeys[0].key];

  const matches = (level: Level) => {
    const set = bundleKeys(model, level, scope);
    return set.length === heldKeys.length && set.every((p) => grants[p.key] !== undefined);
  };
  if (prefer && prefer !== "none" && !model.emptyLevels.has(prefer) && matches(prefer)) return { level: prefer, scope, held: heldKeys.length, total };
  for (const level of ["view", "work", "full"] as const) {
    if (matches(level)) return { level, scope, held: heldKeys.length, total };
  }
  return { level: "custom", scope, held: heldKeys.length, total };
}

/** Whether the feature holds exactly bundle `level`'s set, at one scope. */
export function holdsBundle(model: FeatureModel, grants: GrantMap, level: Level): boolean {
  const state = readState(model, grants);
  if (level === "none") return state.held === 0;
  if (state.held === 0 || state.scope === "mixed") return false;
  const set = bundleKeys(model, level, state.scope);
  return set.length === state.held && set.every((p) => grants[p.key] !== undefined);
}

/** The feature's keys, without the ones this role may hold now. */
function clearAvailable(prev: GrantMap, model: FeatureModel): Record<string, Scope> {
  const next: Record<string, Scope> = { ...prev };
  for (const p of model.available) delete next[p.key];
  return next;
}

/**
 * Normalises the feature to bundle `level` at `scope`. When none of the
 * bundle's keys offers the scope, it is granted organisation-wide instead,
 * so a click never silently grants nothing.
 */
export function applyBundle(prev: GrantMap, model: FeatureModel, level: Level, scope: Scope): GrantMap {
  const next = clearAvailable(prev, model);
  if (level === "none") return next;
  let keys = bundleKeys(model, level, scope);
  let at = scope;
  if (keys.length === 0) {
    at = "organisation";
    keys = bundleKeys(model, level, at);
  }
  for (const p of keys) next[p.key] = at;
  return next;
}

/** The scope a bundle would use for this feature right now. */
export function bundleScope(model: FeatureModel, state: FeatureState, pending?: Scope | null): Scope {
  if (state.held > 0 && state.scope !== "mixed" && model.scopes.includes(state.scope)) return state.scope;
  if (state.held === 0 && pending && model.scopes.includes(pending)) return pending;
  return model.preferredScope;
}

/**
 * The feature-level scope picker. A bundle is re-applied at the new scope
 * (so keys that don't offer it drop out, and come back on the way back);
 * a custom set moves every held key that offers the new scope.
 */
export function applyScope(prev: GrantMap, model: FeatureModel, state: FeatureState, scope: Scope): GrantMap {
  if (state.level !== "custom") return state.level === "none" ? prev : applyBundle(prev, model, state.level, scope);
  const next: Record<string, Scope> = { ...prev };
  for (const p of model.available) {
    if (next[p.key] !== undefined && p.scopes.includes(scope)) next[p.key] = scope;
  }
  return next;
}

/** Customise: one action on or off. It joins at the feature's scope when it offers it. */
export function toggleKey(prev: GrantMap, p: Permission, on: boolean, scope: Scope): GrantMap {
  const next: Record<string, Scope> = { ...prev };
  if (on) next[p.key] = p.scopes.includes(scope) ? scope : "organisation";
  else delete next[p.key];
  return next;
}

export function setKeyScope(prev: GrantMap, key: string, scope: Scope): GrantMap {
  if (prev[key] === undefined || prev[key] === scope) return prev;
  return { ...prev, [key]: scope };
}

/** "View, Create, Edit +2": the held actions, in catalogue order. */
export function heldSummary(feature: PermissionFeature, grants: GrantMap, max = 3): string {
  const labels = feature.permissions.filter((p) => grants[p.key] !== undefined).map((p) => p.label);
  if (labels.length === 0) return "No access";
  return labels.length > max ? `${labels.slice(0, max).join(", ")} +${labels.length - max}` : labels.join(", ");
}

/** A signature of the feature's held keys and scopes: rows re-render only when it changes. */
export function featureSignature(feature: PermissionFeature, grants: GrantMap): string {
  let sig = "";
  for (const p of feature.permissions) {
    const s = grants[p.key];
    if (s !== undefined) sig += `${p.key}:${s}|`;
  }
  return sig;
}

/* ------------------------------------------------------------------ */
/*  Modules and confidential access                                    */
/* ------------------------------------------------------------------ */

/** Modules with confidential features, each listing them: "Payroll, …, Offboarding (settle)". */
export function confidentialCatalogue(catalogue: Catalogue): { key: string; label: string; features: string[] }[] {
  return catalogue.modules
    .map((m) => ({
      key: m.key,
      label: m.label,
      features: m.features
        .filter((f) => f.permissions.some((p) => p.confidential))
        .map((f) => {
          const conf = f.permissions.filter((p) => p.confidential);
          return conf.length === f.permissions.length
            ? f.label
            : `${f.label} (${conf.map((p) => p.label.toLowerCase()).join(", ")})`;
        }),
    }))
    .filter((m) => m.features.length > 0);
}

/** The confidential keys of a module the role holds, and the features they belong to. */
export function heldConfidential(module: PermissionModule, grants: GrantMap): { keys: string[]; features: string[] } {
  const keys: string[] = [];
  const features: string[] = [];
  for (const f of module.features) {
    const held = f.permissions.filter((p) => p.confidential && grants[p.key] !== undefined);
    if (held.length > 0) {
      keys.push(...held.map((p) => p.key));
      features.push(f.label);
    }
  }
  return { keys, features };
}

export function withoutKeys(prev: GrantMap, keys: string[]): GrantMap {
  const next: Record<string, Scope> = { ...prev };
  for (const k of keys) delete next[k];
  return next;
}

/** "HR" → "Takes effect when HR switches to the new checks". */
export function notLiveLine(moduleLabel: string): string {
  return `Takes effect when ${moduleLabel} switches to the new checks`;
}
