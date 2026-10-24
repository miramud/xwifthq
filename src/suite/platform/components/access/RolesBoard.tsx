"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, KeyRound, Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Segmented } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, IconTile, Skeleton } from "@/suite/lms/components/ui/ws";
import { ApiError, platformRoles, type PlatformRole } from "@/lib/api/platform-access-client";
import { useAuth } from "@/lib/auth-store";
import { canPlatform, PERM } from "@/suite/platform/access";
import { LoadError, Notice, When } from "../ui";

type KindFilter = "" | "system" | "custom";

/**
 * Platform roles: bundles of platform permissions given to platform staff.
 *
 * System roles ship with the platform and can't be edited: duplicate one to
 * start a custom role from it. Custom roles are this platform's own and are
 * never visible to any organisation.
 */
export default function RolesBoard() {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const canManage = canPlatform(user, PERM.rolesManage);

  const [kind, setKind] = useState<KindFilter>("");
  const [roles, setRoles] = useState<PlatformRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    platformRoles
      .list()
      .then((r) => {
        setRoles(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Roles didn't load."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => (roles ?? []).filter((r) => !kind || r.kind === kind), [roles, kind]);

  async function duplicate(r: PlatformRole) {
    setActionError(null);
    try {
      const copy = await platformRoles.duplicate(r.id);
      router.push(`/suite/platform/roles/${encodeURIComponent(copy.id)}`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : `${r.name} wasn't duplicated.`);
    }
  }

  async function remove(r: PlatformRole) {
    if (
      !(await confirm({
        title: `Delete the ${r.name} role?`,
        body:
          r.usersCount > 0
            ? `${r.usersCount} ${r.usersCount === 1 ? "person loses" : "people lose"} what it grants straight away. The role moves to the recycle bin; restoring it gives their access back.`
            : undefined,
        confirmLabel: "Delete role",
        recoverable: true,
      }))
    )
      return;
    setActionError(null);
    try {
      await platformRoles.remove(r.id);
      setRoles((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      setNotice(`${r.name} was moved to the recycle bin.`);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : `${r.name} wasn't deleted.`);
    }
  }

  const columns: Column<PlatformRole>[] = [
    {
      key: "name",
      header: "Role",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={r.kind === "system" ? Lock : KeyRound} hue={r.kind === "system" ? "slate" : "grape"} size={36} />
          <span className="min-w-0">
            <Link
              href={`/suite/platform/roles/${encodeURIComponent(r.id)}`}
              className="flex items-center gap-2 font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
            >
              {r.name}
            </Link>
            {r.description && <span className="block truncate text-xs text-neutral-500">{r.description}</span>}
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Type",
      sortable: true,
      value: (r) => r.kind,
      render: (r) => <Chip hue={r.kind === "system" ? "slate" : "grape"}>{r.kind === "system" ? "System" : "Custom"}</Chip>,
    },
    { key: "permissions", header: "Permissions", align: "right", sortable: true, value: (r) => r.permissions.length, render: (r) => <span className="tabular-nums">{r.permissions.length}</span> },
    { key: "users", header: "Users", align: "right", sortable: true, value: (r) => r.usersCount, render: (r) => <span className="tabular-nums">{r.usersCount}</span> },
    {
      key: "updated",
      header: "Updated",
      hideOnMobile: true,
      value: (r) => r.updatedAt ?? "",
      render: (r) => <When at={r.updatedAt} className="text-neutral-600" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) =>
        !canManage ? null : (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" icon={Copy} onClick={() => duplicate(r)} aria-label={`Duplicate ${r.name}`}>
              <span className="hidden xl:inline">Duplicate</span>
            </Button>
            {r.kind === "custom" && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => remove(r)}
                aria-label={`Delete ${r.name}`}
                className="!text-error-700 hover:!bg-error-500/5"
              >
                <span className="hidden xl:inline">Delete</span>
              </Button>
            )}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access"
        title="Roles & permissions"
        subtitle="What each kind of platform staff can do. Organisations manage their own roles."
        actions={
          canManage ? (
            <ButtonLink href="/suite/platform/roles/new" variant="primary" icon={Plus}>
              New role
            </ButtonLink>
          ) : undefined
        }
      />

      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !roles ? (
        <Skeleton className="h-72 rounded-[1.25rem]" />
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          views={["table", "list"]}
          storageKey="platform.roles"
          caption="Platform roles"
          searchPlaceholder="Search roles…"
          toolbar={
            <Segmented<KindFilter>
              label="Type"
              value={kind}
              onChange={setKind}
              options={[
                { key: "", label: "All" },
                { key: "system", label: "System" },
                { key: "custom", label: "Custom" },
              ]}
            />
          }
          empty={
            <Card>
              <Empty
                icon={KeyRound}
                hue="grape"
                title={kind === "custom" ? "No custom roles yet" : "No roles yet"}
                hint="Create a role, or duplicate a system role and change what it grants."
                action={
                  canManage ? (
                    <ButtonLink href="/suite/platform/roles/new" size="sm" variant="primary" icon={Plus}>
                      New role
                    </ButtonLink>
                  ) : undefined
                }
              />
            </Card>
          }
        />
      )}
    </div>
  );
}
