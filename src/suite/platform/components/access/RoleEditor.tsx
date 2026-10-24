"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileText, Lock, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button, Chip, PageHeader, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, FaceAvatar, ListRow, Skeleton, inputClass, labelClass, textareaClass } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  platformPermissions,
  platformRoles,
  type Catalogue,
  type PlatformRoleDetail,
} from "@/lib/api/platform-access-client";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice } from "../ui";
import PermissionMatrix from "./PermissionMatrix";

/**
 * One platform role: its name, what it is for, and the permissions it grants.
 *
 * `roleId` null is a new role. A system role opens read only, with Duplicate
 * as the way to build on it.
 */
export default function RoleEditor({ roleId }: { roleId: string | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const id = useId();
  const canManage = canPlatform(user, PERM.rolesManage);

  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [role, setRole] = useState<PlatformRoleDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([platformPermissions.catalogue(), roleId ? platformRoles.get(roleId) : Promise.resolve(null)])
      .then(([cat, r]) => {
        setCatalogue(cat);
        setRole(r);
        setName(r?.name ?? "");
        setDescription(r?.description ?? "");
        setPermissions(r?.permissions ?? []);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "The role didn't load."));
  }, [roleId]);

  useEffect(() => {
    load();
  }, [load]);

  const readOnly = !canManage || role?.kind === "system";

  const dirty = useMemo(() => {
    if (!roleId) return name.trim() !== "" || permissions.length > 0;
    if (!role) return false;
    const a = [...role.permissions].sort().join("|");
    const b = [...permissions].sort().join("|");
    return name !== role.name || description !== (role.description ?? "") || a !== b;
  }, [roleId, role, name, description, permissions]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly || saving || name.trim().length < 2) return;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    const body = { name: name.trim(), description: description.trim() || null, permissions };
    try {
      if (roleId) {
        const updated = await platformRoles.update(roleId, body);
        setRole((prev) => (prev ? { ...prev, ...updated } : prev));
        setNotice(`${updated.name} saved.`);
      } else {
        const created = await platformRoles.create(body);
        router.push(`/suite/platform/roles/${encodeURIComponent(created.id)}`);
        return;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
        setFieldErrors(err.errors ?? {});
      } else {
        setSaveError("The role wasn't saved.");
      }
    }
    setSaving(false);
  }

  async function duplicate() {
    if (!role) return;
    try {
      const copy = await platformRoles.duplicate(role.id);
      router.push(`/suite/platform/roles/${encodeURIComponent(copy.id)}`);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "The role wasn't duplicated.");
    }
  }

  async function remove() {
    if (!role) return;
    if (
      !(await confirm({
        title: `Delete the ${role.name} role?`,
        body:
          role.usersCount > 0
            ? `${role.usersCount} ${role.usersCount === 1 ? "person loses" : "people lose"} what it grants straight away. The role moves to the recycle bin; restoring it gives their access back.`
            : undefined,
        confirmLabel: "Delete role",
        recoverable: true,
      }))
    )
      return;
    try {
      await platformRoles.remove(role.id);
      router.push("/suite/platform/roles");
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "The role wasn't deleted.");
    }
  }

  const title = roleId ? (role?.name ?? "Role") : "New platform role";

  const heading = (
    <>
      <BackLink href="/suite/platform/roles" label="All roles" />
      <PageHeader
        eyebrow="Roles & permissions"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {title}
            {role && (
              <Chip hue={role.kind === "system" ? "slate" : "grape"} icon={role.kind === "system" ? Lock : undefined}>
                {role.kind === "system" ? "System" : "Custom"}
              </Chip>
            )}
          </span>
        }
        subtitle={
          role?.kind === "system"
            ? "Ships with the platform and can't be changed. Duplicate it to make your own version."
            : "Choose exactly what people with this role can do on the platform."
        }
        actions={
          role && canManage ? (
            <>
              <Button size="sm" icon={Copy} onClick={duplicate}>
                Duplicate
              </Button>
              {role.kind === "custom" && (
                <Button size="sm" variant="danger" icon={Trash2} onClick={remove}>
                  Delete
                </Button>
              )}
            </>
          ) : undefined
        }
      />
    </>
  );

  if (error) {
    return (
      <div>
        {heading}
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      </div>
    );
  }

  if (!catalogue || (roleId && !role)) {
    return (
      <div>
        {heading}
        <div className="space-y-6" aria-busy="true" aria-label="Loading role">
          <Skeleton className="h-40 rounded-[1.25rem]" />
          <Skeleton className="h-96 rounded-[1.25rem]" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {heading}

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="About this role" icon={FileText} hue="grape">
          <div className="space-y-4">
            <div>
              <label htmlFor={`${id}-name`} className={labelClass}>
                Name <span className="text-error-600">*</span>
              </label>
              <input
                id={`${id}-name`}
                value={name}
                readOnly={readOnly}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="For example, Billing support"
                aria-describedby={fieldErrors.name ? `${id}-name-error` : undefined}
              />
              {fieldErrors.name?.[0] && (
                <p id={`${id}-name-error`} className="mt-1.5 text-xs text-error-700">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-desc`} className={labelClass}>
                What it&apos;s for
              </label>
              <textarea
                id={`${id}-desc`}
                value={description}
                readOnly={readOnly}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={textareaClass}
                placeholder="One sentence, so the next person knows when to give it."
              />
            </div>
          </div>
        </Panel>

        <Panel title="People with this role" icon={Users} hue="sky">
          {!role || role.users.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {roleId ? "Nobody holds it yet. Assign it from System users." : "Assign it from System users once it's saved."}
            </p>
          ) : (
            <ul className="-mx-2 space-y-0.5">
              {role.users.slice(0, 8).map((u) => (
                <ListRow key={u.id} leading={<FaceAvatar name={u.name} size={36} />} title={u.name} meta={u.email} />
              ))}
              {role.users.length > 8 && <li className="px-2 pt-1 text-xs text-neutral-500">and {role.users.length - 8} more</li>}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Permissions"
        subtitle="Built from the platform's own features, so this is exactly what it enforces."
        icon={ShieldCheck}
        hue="blue"
      >
        <PermissionMatrix catalogue={catalogue} value={permissions} onChange={setPermissions} readOnly={readOnly} />
        {fieldErrors.permissions?.[0] && <p className="mt-3 text-sm text-error-700">{fieldErrors.permissions[0]}</p>}
      </Panel>

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500" aria-live="polite">
              {dirty ? "Unsaved changes." : "Everything is saved."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {saveError && <ErrorNote className="py-2">{saveError}</ErrorNote>}
              <Button type="submit" variant="primary" icon={Save} disabled={!dirty || saving || name.trim().length < 2}>
                {saving ? "Saving…" : roleId ? "Save role" : "Create role"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
