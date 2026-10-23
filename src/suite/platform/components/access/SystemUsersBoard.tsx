"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Mail, Pencil, ShieldCheck, Trash2, UserCog, UserPlus } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Segmented, SearchField, Toolbar, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, FaceAvatar, Skeleton, inputClass, labelClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type { Paginated } from "@/lib/api/platform-client";
import {
  ApiError,
  platformRoles,
  SYSTEM_ROLE_LABEL,
  systemUsers,
  type PlatformRole,
  type SystemRole,
  type SystemUser,
  type SystemUserInput,
} from "@/lib/api/platform-access-client";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, Pager, When } from "../ui";

type RoleFilter = "" | SystemRole;

/**
 * The people who operate the platform — never an organisation's users.
 *
 * Super admins hold everything. Platform staff hold only what their platform
 * roles grant, so a support agent can read tickets without touching money.
 * Two guards come from the API and are shown as it words them: nobody deletes
 * themselves, and the platform always keeps one super admin.
 */
export default function SystemUsersBoard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManage = canPlatform(user, PERM.usersManage);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SystemUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<SystemUser | "new" | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    systemUsers
      .list({ search: query || undefined, role, page, perPage: 25 })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "System users didn't load."));
  }, [query, role, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(u: SystemUser) {
    if (
      !(await confirm({
        title: `Delete ${u.name}?`,
        body: "They lose access to the platform console straight away. The account moves to the platform recycle bin, where it can be restored.",
        confirmLabel: "Delete user",
        recoverable: true,
      }))
    )
      return;
    setActionError(null);
    try {
      await systemUsers.remove(u.id);
      setNotice(`${u.name} was moved to the recycle bin.`);
      load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : `${u.name} wasn't deleted.`);
    }
  }

  async function resend(u: SystemUser) {
    setActionError(null);
    try {
      await systemUsers.resendInvite(u.id);
      setNotice(`A new invitation is on its way to ${u.email}.`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "The invitation wasn't sent.");
    }
  }

  const columns: Column<SystemUser>[] = [
    {
      key: "name",
      header: "User",
      primary: true,
      value: (u) => u.name,
      render: (u) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={u.name} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium text-neutral-900">
              <span className="truncate">{u.name}</span>
              {u.id === user?.id && <Chip hue="blue">You</Chip>}
            </span>
            <span className="block truncate text-xs text-neutral-500">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Access",
      value: (u) => u.role,
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          <Chip hue={u.role === "super_admin" ? "slate" : "sky"} icon={u.role === "super_admin" ? ShieldCheck : undefined}>
            {SYSTEM_ROLE_LABEL[u.role] ?? u.role}
          </Chip>
          {u.role !== "super_admin" &&
            u.roles.map((r) => (
              <Chip key={r.id} hue="grape">
                {r.name}
              </Chip>
            ))}
          {u.role !== "super_admin" && u.roles.length === 0 && <span className="text-xs text-neutral-500">No roles yet</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      value: (u) => u.status,
      render: (u) => (
        <Chip hue={u.status === "active" ? "mint" : "sun"} dot>
          {u.status === "active" ? "Active" : "Invited"}
        </Chip>
      ),
    },
    {
      key: "lastActive",
      header: "Last active",
      hideOnMobile: true,
      value: (u) => u.lastActiveAt ?? "",
      render: (u) => <When at={u.lastActiveAt} className="text-neutral-600" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (u) =>
        !canManage ? null : (
          <span className="flex justify-end gap-1.5">
            {u.status === "invited" && (
              <Button size="sm" variant="ghost" icon={Mail} onClick={() => resend(u)} aria-label={`Resend invitation to ${u.name}`}>
                <span className="hidden xl:inline">Resend</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
              <span className="hidden xl:inline">Edit</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              disabled={u.id === user?.id}
              title={u.id === user?.id ? "You can't delete your own account" : undefined}
              onClick={() => remove(u)}
              aria-label={u.id === user?.id ? "You can't delete your own account" : `Delete ${u.name}`}
              className="!text-error-700 hover:!bg-error-500/5"
            >
              <span className="hidden xl:inline">Delete</span>
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Access"
        title="System users"
        subtitle="People who run the platform. Organisation users are managed in each organisation's console."
        actions={
          canManage ? (
            <Button variant="primary" icon={UserPlus} onClick={() => setEditing("new")}>
              Add system user
            </Button>
          ) : undefined
        }
      />

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Toolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Search name or email…" label="Search system users" />
        <Segmented<RoleFilter>
          label="Access"
          value={role}
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={[
            { key: "", label: "Everyone" },
            { key: "super_admin", label: "Super admins" },
            { key: "platform_staff", label: "Staff" },
          ]}
        />
      </Toolbar>

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !data ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading system users">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          <DataView
            rows={data.data}
            columns={columns}
            rowKey={(u) => u.id}
            views={["table", "list"]}
            storageKey="platform.system-users"
            caption="System users"
            searchable={false}
            empty={
              <Card>
                <Empty
                  icon={UserCog}
                  title={query || role ? "No system users match" : "No system users yet"}
                  hint={query || role ? "Clear the search or filter." : "Add the people who help run the platform."}
                />
              </Card>
            }
          />
          <Pager page={data.meta.currentPage} lastPage={data.meta.lastPage} total={data.meta.total} onPage={setPage} noun="system users" />
        </>
      )}

      {editing && (
        <SystemUserDialog
          target={editing === "new" ? null : editing}
          isSelf={editing !== "new" && editing.id === user?.id}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setEditing(null);
            setNotice(created ? `${saved.name} was added and invited by email.` : `${saved.name} was updated.`);
            load();
          }}
        />
      )}
    </div>
  );
}

function SystemUserDialog({
  target,
  isSelf,
  onClose,
  onSaved,
}: {
  target: SystemUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (u: SystemUser, created: boolean) => void;
}) {
  const id = useId();
  const [name, setName] = useState(target?.name ?? "");
  const [email, setEmail] = useState(target?.email ?? "");
  const [role, setRole] = useState<SystemRole>(target?.role ?? "platform_staff");
  const [roleIds, setRoleIds] = useState<string[]>(target?.roles.filter((r) => r.kind === "custom").map((r) => r.id) ?? []);
  const [roles, setRoles] = useState<PlatformRole[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    platformRoles
      .list()
      .then((all) => setRoles(all.filter((r) => r.kind === "custom")))
      .catch(() => setRoles([]));
  }, []);

  const valid = name.trim().length > 1 && email.includes("@");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body: SystemUserInput = {
      name: name.trim(),
      email: email.trim(),
      role,
      roleIds: role === "platform_staff" ? roleIds : [],
    };
    // Nobody changes their own level of access.
    const payload: Partial<SystemUserInput> = isSelf ? { name: body.name, email: body.email } : body;
    try {
      const saved = target ? await systemUsers.update(target.id, payload) : await systemUsers.create(body);
      onSaved(saved, target === null);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.errors ?? {});
      } else {
        setError("That wasn't saved.");
      }
    }
  }

  const fieldError = (key: string) =>
    fieldErrors[key]?.[0] ? (
      <p id={`${id}-${key}-error`} className="mt-1.5 text-xs text-error-700">
        {fieldErrors[key][0]}
      </p>
    ) : null;

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      titleId={`${id}-title`}
      title={target ? `Edit ${target.name}` : "Add system user"}
      subtitle={target ? "Their name, email and platform access." : "They get an email to set their password."}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!valid || saving}>
              {saving ? "Saving…" : target ? "Save changes" : "Add and invite"}
            </Button>
          </div>
        </div>
      }
    >
      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>
          Name <span className="text-error-600">*</span>
        </label>
        <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" aria-describedby={fieldErrors.name ? `${id}-name-error` : undefined} />
        {fieldError("name")}
      </div>
      <div>
        <label htmlFor={`${id}-email`} className={labelClass}>
          Email <span className="text-error-600">*</span>
        </label>
        <input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" aria-describedby={fieldErrors.email ? `${id}-email-error` : undefined} />
        {fieldError("email")}
      </div>
      <div>
        <label htmlFor={`${id}-role`} className={labelClass}>
          Access
        </label>
        <SearchableSelect
          id={`${id}-role`}
          value={role}
          disabled={isSelf}
          onChange={(v) => setRole(v as SystemRole)}
          aria-describedby={`${id}-role-help`}
          options={[
            { value: "platform_staff", label: "Platform staff: only what their roles allow" },
            { value: "super_admin", label: "Super admin: everything" },
          ]}
        />
        <p id={`${id}-role-help`} className="mt-1.5 text-xs text-neutral-500">
          {isSelf ? "You can't change your own access." : "Give super admin sparingly: it includes money, deletion and other super admins."}
        </p>
        {fieldError("role")}
      </div>

      {role === "platform_staff" && (
        <fieldset>
          <legend className={labelClass}>Platform roles</legend>
          {roles === null ? (
            <Skeleton className="h-24" />
          ) : roles.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-600">
              No platform roles yet. Create one under Roles &amp; permissions, then come back to assign it.
            </p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-neutral-200 p-2">
              {roles.map((r) => {
                const on = roleIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={cx("flex cursor-pointer items-start gap-3 rounded-lg p-2", on ? "bg-primary-50/70" : "hover:bg-neutral-50")}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={isSelf}
                      onChange={(e) =>
                        setRoleIds((prev) => (e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">{r.name}</span>
                      <span className="block text-xs text-neutral-500">
                        {r.permissions.length} permissions{r.description ? ` · ${r.description}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {fieldError("roleIds")}
        </fieldset>
      )}
    </DialogFrame>
  );
}
