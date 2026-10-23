/* ------------------------------------------------------------------ */
/*  Platform console: system users (platform staff, never organisation */
/*  users) and platform roles & permissions.                          */
/* ------------------------------------------------------------------ */

import { platformRequest, queryString, type Paginated } from "@/lib/api/platform-client";

export { ApiError } from "@/lib/api/platform-client";

const unwrap = <T,>(r: { data: T }) => r.data;

/* ------------------------------------------------------------------ */
/*  Permission catalogue + roles (shapes shared with the org console)  */
/* ------------------------------------------------------------------ */

export interface Permission {
  key: string;
  action: string;
  label: string;
  description: string | null;
}

export interface PermissionFeature {
  key: string;
  label: string;
  permissions: Permission[];
}

export interface PermissionModule {
  key: string;
  label: string;
  features: PermissionFeature[];
}

export interface Catalogue {
  modules: PermissionModule[];
}

export interface PlatformRole {
  id: string;
  name: string;
  description: string | null;
  kind: "system" | "custom";
  systemKey: string | null;
  permissions: string[];
  usersCount: number;
  editable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PlatformRoleDetail extends PlatformRole {
  users: { id: string; name: string; email: string }[];
}

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export const platformPermissions = {
  catalogue: () => platformRequest<{ data: Catalogue }>("permissions").then(unwrap),
};

export const platformRoles = {
  list: (q: { kind?: "system" | "custom" | ""; search?: string } = {}) =>
    platformRequest<{ data: PlatformRole[] }>(`roles${queryString({ ...q })}`).then(unwrap),
  get: (id: string) =>
    platformRequest<{ data: PlatformRoleDetail }>(`roles/${encodeURIComponent(id)}`).then(unwrap),
  create: (body: RoleInput) =>
    platformRequest<{ data: PlatformRole }>("roles", { method: "POST", body }).then(unwrap),
  update: (id: string, body: Partial<RoleInput>) =>
    platformRequest<{ data: PlatformRole }>(`roles/${encodeURIComponent(id)}`, { method: "PATCH", body }).then(
      unwrap,
    ),
  /** Soft delete: the role moves to the recycle bin and its assignments are suspended. */
  remove: (id: string) => platformRequest<void>(`roles/${encodeURIComponent(id)}`, { method: "DELETE" }),
  duplicate: (id: string) =>
    platformRequest<{ data: PlatformRole }>(`roles/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
    }).then(unwrap),
};

/* ------------------------------------------------------------------ */
/*  System users                                                       */
/* ------------------------------------------------------------------ */

export type SystemRole = "super_admin" | "platform_staff";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  roles: { id: string; name: string; kind: "system" | "custom" }[];
  status: "active" | "invited";
  lastActiveAt: string | null;
  createdAt: string;
}

export interface SystemUserInput {
  name: string;
  email: string;
  role: SystemRole;
  roleIds?: string[];
}

export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = {
  super_admin: "Super admin",
  platform_staff: "Platform staff",
};

export const systemUsers = {
  list: (q: { search?: string; role?: SystemRole | ""; status?: string; page?: number; perPage?: number } = {}) =>
    platformRequest<Paginated<SystemUser>>(`users${queryString({ ...q })}`),
  get: (id: string) => platformRequest<{ data: SystemUser }>(`users/${encodeURIComponent(id)}`).then(unwrap),
  create: (body: SystemUserInput) =>
    platformRequest<{ data: SystemUser }>("users", { method: "POST", body }).then(unwrap),
  update: (id: string, body: Partial<SystemUserInput>) =>
    platformRequest<{ data: SystemUser }>(`users/${encodeURIComponent(id)}`, { method: "PATCH", body }).then(
      unwrap,
    ),
  /** Soft delete into the platform recycle bin. */
  remove: (id: string) => platformRequest<void>(`users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  resendInvite: (id: string) =>
    platformRequest<void>(`users/${encodeURIComponent(id)}/resend-invite`, { method: "POST" }),
};
