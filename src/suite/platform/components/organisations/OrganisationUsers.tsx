"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Users } from "lucide-react";
import { Card, Chip, Empty, SearchField, Toolbar } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { FaceAvatar, Skeleton } from "@/suite/lms/components/ui/ws";
import { ApiError, platformOrganisations, type Paginated } from "@/lib/api/platform-client";
import type { OrgUser } from "@/lib/api/users-client";
import { LoadError, Pager, When } from "../ui";

const ROLE_HUE = { admin: "blue", user: "grape" } as const;

/**
 * One organisation's users, read only.
 *
 * For support and governance: the platform owner can see who is in an
 * institution and whether they are active, but managing them is the
 * organisation's own job, in its own console.
 */
export default function OrganisationUsers({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Paginated<OrgUser> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The API searches; wait for a pause in typing before asking it.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    platformOrganisations
      .users(slug, { search: query || undefined, page, perPage: 25 })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "The users didn't load."));
  }, [slug, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<OrgUser>[] = [
    {
      key: "name",
      header: "User",
      primary: true,
      value: (u) => u.name,
      render: (u) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={u.name} src={u.avatarUrl} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">{u.name}</span>
            <span className="block truncate text-xs text-neutral-500">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      value: (u) => u.roleLabel,
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          <Chip hue={ROLE_HUE[u.role] ?? "slate"}>{u.roleLabel}</Chip>
          {(u.roles ?? [])
            .filter((r) => r.kind === "custom")
            .slice(0, 2)
            .map((r) => (
              <Chip key={r.id} hue="slate">
                {r.name}
              </Chip>
            ))}
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
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        <Eye size={16} className="mt-0.5 shrink-0" aria-hidden />
        Read only. The organisation manages its own users from its console.
      </div>

      <Toolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Search name or email…" label="Search users" />
      </Toolbar>

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : data === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading users">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : (
        <>
          <DataView
            rows={data.data}
            columns={columns}
            rowKey={(u) => u.id}
            views={["table", "list"]}
            storageKey="platform.org-users"
            caption="Users in this organisation"
            searchable={false}
            empty={
              <Card>
                <Empty
                  icon={Users}
                  title={query ? "No users match" : "No users yet"}
                  hint={query ? "Try part of a name or an email address." : "Its admin adds people from the organisation console."}
                />
              </Card>
            }
          />
          <Pager
            page={data.meta.currentPage}
            lastPage={data.meta.lastPage}
            total={data.meta.total}
            onPage={setPage}
            noun="users"
          />
        </>
      )}
    </div>
  );
}
