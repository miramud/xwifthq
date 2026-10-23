/* ------------------------------------------------------------------ */
/*  Browser-side client for the organisation's roles & permissions.    */
/*  Same-origin /api/admin/{roles,permissions} proxy.                  */
/* ------------------------------------------------------------------ */

import { ApiError } from "@/lib/api/admin-client";

export { ApiError };

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }

  return json as T;
}

/* ---------- Types ---------- */

/**
 * How far a grant reaches, narrowest first: the holder's own records, their
 * reports, the projects they are assigned to, or the whole organisation.
 */
export type Scope = "own" | "reports" | "assigned" | "organisation";

/** The three bundles a feature offers, smallest first. */
export type Bundle = "view" | "work" | "full";

/** One thing somebody may do: `module.feature.action`, e.g. `lms.courses.create`. */
export interface Permission {
  key: string;
  action: string;
  label: string;
  description: string | null;
  /** The smallest bundle that includes this action. */
  bundle: Bundle;
  /** The scopes this key may be granted at, narrowest first; always includes `organisation`. */
  scopes: Scope[];
  /** Pay, discipline, personal records, bank details: needs Confidential access for its module. */
  confidential: boolean;
}

export interface PermissionFeature {
  key: string;
  label: string;
  permissions: Permission[];
}

export interface PermissionModule {
  key: string;
  label: string;
  /** The scope a key of this module takes by default, when the key offers it. */
  defaultScope: Scope;
  features: PermissionFeature[];
}

/** Generated from the routes, so it always matches what the API enforces. */
export interface Catalogue {
  modules: PermissionModule[];
  scopes: { key: Scope; label: string }[];
  bundles: { key: Bundle; label: string }[];
  /**
   * What today's checks honour. A grant at a scope not listed for its module
   * gives nothing until that module switches to the new checks. Seeded roles
   * act in the modules `seededModules` names (those switched already, Projects
   * first) and nowhere else while `seededRoles` is false.
   */
  live: { scopes: Record<string, Scope[]>; seededRoles: boolean; seededModules?: string[] };
}

/** One permission key held at one scope. */
export interface Grant {
  key: string;
  scope: Scope;
}

export type ProjectActivity = "none" | "digest" | "everything";

/** What a role does besides grant permissions. Built-in roles have none. */
export interface RoleSettings {
  /** Holders get an Oversight seat on every project. */
  joinsEveryProject: boolean;
  /** What those seats are told. */
  projectActivity: ProjectActivity;
  /** Modules whose confidential features this role's grants may reach. */
  confidentialModules: string[];
  /** Manages users, roles and the organisation console. */
  organisationAdmin: boolean;
}

export type RoleKind = "system" | "custom";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  kind: RoleKind;
  /** For system roles: `user` in an organisation, `super_admin` on the platform. */
  systemKey: string | null;
  /** A ready-made starter role the organisation was given (custom roles only). */
  starter?: boolean;
  /** For starter roles: the module it was made for (`core`, `projects`, `hrm`, `lms`). */
  module?: string | null;
  /** One of the roles every organisation is set up with. */
  seeded?: boolean;
  /** The key the product recognises a seeded or starter role by; renaming doesn't change it. */
  templateKey?: string | null;
  permissions: string[];
  /** Each held key with its scope (built-in roles: all organisation-wide). */
  grants?: Grant[];
  settings?: RoleSettings | null;
  usersCount: number;
  editable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoleDetail extends Role {
  users: { id: string; name: string; email: string }[];
}

export interface RoleInput {
  name: string;
  description?: string | null;
  grants: Grant[];
  settings?: RoleSettings;
}

/* ---------- Endpoints ---------- */

export const permissions = {
  catalogue: () => request<{ data: Catalogue }>("permissions").then((r) => r.data),
};

export const roles = {
  list: (filters: { kind?: RoleKind | ""; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (filters.kind) q.set("kind", filters.kind);
    if (filters.search) q.set("search", filters.search);
    const s = q.toString();
    return request<{ data: Role[] }>(`roles${s ? `?${s}` : ""}`).then((r) => r.data);
  },
  get: (id: string) => request<{ data: RoleDetail }>(`roles/${encodeURIComponent(id)}`).then((r) => r.data),
  create: (body: RoleInput) => request<{ data: Role }>("roles", { method: "POST", body }).then((r) => r.data),
  update: (id: string, body: Partial<RoleInput>) =>
    request<{ data: Role }>(`roles/${encodeURIComponent(id)}`, { method: "PATCH", body }).then((r) => r.data),
  /** Soft delete: the role goes to the recycle bin and its holders lose it until it's restored. */
  remove: (id: string) => request<unknown>(`roles/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** A custom copy; works on system roles too. */
  duplicate: (id: string) =>
    request<{ data: Role }>(`roles/${encodeURIComponent(id)}/duplicate`, { method: "POST" }).then((r) => r.data),
};

/* ---------- Catalogue helpers ---------- */

/** Every permission key in a feature / module / catalogue. */
export function keysOf(node: PermissionFeature | PermissionModule | Catalogue): string[] {
  if ("permissions" in node) return node.permissions.map((p) => p.key);
  if ("features" in node) return node.features.flatMap(keysOf);
  return node.modules.flatMap(keysOf);
}

/** Permission keys grouped by module key, for "3 of 12 in Learning" summaries. */
export function countByModule(catalogue: Catalogue, held: Iterable<string>): { key: string; label: string; held: number; total: number }[] {
  const set = new Set(held);
  return catalogue.modules.map((m) => {
    const all = keysOf(m);
    return { key: m.key, label: m.label, held: all.filter((k) => set.has(k)).length, total: all.length };
  });
}
