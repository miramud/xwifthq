"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, Eye, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { ActionMenu } from "@/components/dashboard/ui";
import { ButtonLink, Empty, PageHeader, SearchField, Segmented } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ApiError, roles as rolesApi, type Role, type RoleKind } from "@/lib/api/roles-client";
import { ErrorNote, IconTile, Skeleton } from "@/suite/lms/components/ui/ws";
import { RoleKindChip, roleKind } from "./RoleKindChip";

/**
 * Roles & permissions: the built-in roles every organisation has, and the
 * custom ones this organisation made.
 *
 * The built-in role is what the platform already enforces — User, which
 * everybody in the organisation holds — shown so an admin can see
 * exactly what it allows. It can't be edited, only duplicated into a
 * custom role that can.
 */
export default function RolesBoard() {
  const router = useRouter();
  const confirm = useConfirm();

  const [rows, setRows] = useState<Role[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState<RoleKind | "all">("all");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    rolesApi
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "Roles didn't load."));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((r) => kind === "all" || r.kind === kind)
      .filter((r) => q === "" || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
  }, [rows, kind, search]);

  const duplicate = useCallback(
    async (role: Role) => {
      setError(null);
      try {
        const copy = await rolesApi.duplicate(role.id);
        router.push(`/suite/org/roles/${copy.id}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `${role.name} wasn't duplicated.`);
      }
    },
    [router],
  );

  const remove = useCallback(
    async (role: Role) => {
      const ok = await confirm({
        title: `Delete “${role.name}”?`,
        body: (
          <>
            It moves to the recycle bin.{" "}
            {role.usersCount > 0 ? (
              <>
                The {role.usersCount === 1 ? "user who holds it loses" : `${role.usersCount} users who hold it lose`} its
                permissions while it&apos;s there, and get them back if it&apos;s restored.
              </>
            ) : (
              <>Nobody holds it, so no one loses access.</>
            )}
          </>
        ),
        confirmLabel: "Delete role",
        recoverable: true,
      });
      if (!ok) return;
      setError(null);
      try {
        await rolesApi.remove(role.id);
        setRows((r) => (r ? r.filter((x) => x.id !== role.id) : r));
        setNotice(`${role.name} moved to the recycle bin.`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `${role.name} wasn't deleted.`);
      }
    },
    [confirm],
  );

  const actions = (r: Role) => (
    <ActionMenu
      label={`Actions for ${r.name}`}
      items={[
        { label: "View", href: `/suite/org/roles/${r.id}`, icon: Eye },
        ...(r.editable ? [{ label: "Edit", href: `/suite/org/roles/${r.id}`, icon: Pencil }] : []),
        { label: "Duplicate", onClick: () => duplicate(r), icon: Copy },
        ...(r.kind === "custom" ? [{ label: "Delete", onClick: () => remove(r), icon: Trash2, danger: true }] : []),
      ]}
    />
  );

  const columns: Column<Role>[] = [
    {
      key: "role",
      header: "Role",
      primary: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-3">
          <IconTile icon={roleKind(r).icon} hue={roleKind(r).hue} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">{r.name}</span>
            <span className="block max-w-[360px] truncate text-xs text-neutral-500">{r.description ?? "No description"}</span>
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Type",
      value: (r) => r.kind,
      render: (r) => <RoleKindChip role={r} />,
    },
    {
      key: "users",
      header: "Users",
      align: "right",
      sortable: true,
      value: (r) => r.usersCount,
      render: (r) => <span className="tabular-nums text-neutral-700">{r.usersCount.toLocaleString()}</span>,
    },
    {
      key: "permissions",
      header: "Permissions",
      align: "right",
      sortable: true,
      value: (r) => r.permissions.length,
      render: (r) => <span className="tabular-nums text-neutral-700">{r.permissions.length}</span>,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: (r) => actions(r) },
  ];

  const customCount = (rows ?? []).filter((r) => r.kind === "custom").length;

  return (
    <div>
      <PageHeader
        eyebrow="User management"
        title="Roles & permissions"
        subtitle="What each role lets people do. Built-in roles come with the platform; custom roles are yours to shape."
        actions={
          <ButtonLink href="/suite/org/roles/new" variant="primary" icon={Plus}>
            New role
          </ButtonLink>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-50 px-4 py-3.5 text-sm text-sky-700">
        <Building2 size={17} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Ready-made roles are added for every module you use; edit, rename or delete them as you like. They and your
          custom roles belong to this organisation only. No other organisation can see or use them.
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <p className="mb-5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">{notice}</p>
      )}
      {error && (
        <ErrorNote className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {error}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="cursor-pointer font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </span>
        </ErrorNote>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField value={search} onChange={setSearch} placeholder="Search roles" label="Search roles" className="sm:w-80" />
        <Segmented
          label="Filter by type"
          value={kind}
          onChange={setKind}
          options={[
            { key: "all", label: "All" },
            { key: "system", label: "Built in" },
            { key: "custom", label: `Custom${rows ? ` (${customCount})` : ""}` },
          ]}
        />
      </div>

      {rows === null && !error ? (
        <div aria-busy="true">
          <p className="sr-only">Loading roles…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="org.roles"
          views={["table", "grid"]}
          rowHref={(r) => `/suite/org/roles/${r.id}`}
          caption="Roles in this organisation"
          searchable={false}
          empty={
            kind === "custom" && search === "" ? (
              <Empty
                icon={ShieldCheck}
                title="No custom roles yet."
                hint="Create one from scratch, or duplicate a built-in role and adjust it."
                hue="grape"
                action={
                  <ButtonLink href="/suite/org/roles/new" size="sm" variant="primary" icon={Plus}>
                    New role
                  </ButtonLink>
                }
              />
            ) : (
              <Empty icon={ShieldCheck} title="No role matches." hint="Try another word or clear the filter." />
            )
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <IconTile icon={roleKind(r).icon} hue={roleKind(r).hue} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{r.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{r.description ?? "No description"}</p>
                </div>
                {actions(r)}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <span className="tabular-nums">
                  {r.usersCount} user{r.usersCount === 1 ? "" : "s"} · {r.permissions.length} permissions
                </span>
                <RoleKindChip role={r} />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
