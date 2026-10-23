"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Eye,
  MailCheck,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  Sparkles,
} from "lucide-react";
import { ActionMenu } from "@/components/dashboard/ui";
import { Button, Empty, PageHeader, Panel, Progress, SearchField, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useAuth } from "@/lib/auth-store";
import { formatDate, timeAgo } from "@/lib/console-data";
import { ErrorNote, FaceAvatar, PersonCard, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  managesAdmins,
  users,
  type OrgRole,
  type OrgUser,
  type OrgUserSort,
  type OrgUserStatus,
  type OrgUserSummary,
  type Paginated,
} from "@/lib/api/users-client";
import { AddUserDialog } from "./AddUserDialog";
import { ROLE_HUE, ROLE_NAME, RoleChip, RoleChips, StatusPill, extraRoles } from "./usersUi";
import { roles as rolesApi, type Role } from "@/lib/api/roles-client";
import { useSearchParams } from "next/navigation";
import { SignInDetailsDialog } from "./SignInDetails";

const PER_PAGE = 25;

const SORTS: { key: OrgUserSort; label: string }[] = [
  { key: "name", label: "Name, A to Z" },
  { key: "-createdAt", label: "Newest first" },
  { key: "-lastActiveAt", label: "Recently active" },
];

/**
 * The organisation's users: everybody who can sign in here, whatever they do.
 *
 * One list for the whole organisation, because role and designations are
 * properties of a user, not separate rosters: the HR manager, the instructor
 * and the new learner are all rows here, each with what they are, what they
 * do and how their learning is going.
 *
 * Search, filters, sort and paging run on the server — an institution of a
 * few thousand users is not a list to ship to the browser — so DataView's own
 * client-side search is switched off and the toolbar drives the query.
 */
export default function UsersBoard() {
  const { user: me } = useAuth();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<OrgRole | "">("");
  const [status, setStatus] = useState<OrgUserStatus | "">("");
  // A role filter can arrive in the URL: "See all" on a role's page links here.
  const params = useSearchParams();
  const [roleId, setRoleId] = useState(params?.get("roleId") ?? "");
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  // So can a sort: the Overview's "New in the last N days" card links to ?sort=-createdAt.
  const [sort, setSort] = useState<OrgUserSort>(() => {
    const wanted = params?.get("sort");
    return SORTS.find((s) => s.key === wanted)?.key ?? "name";
  });
  const [page, setPage] = useState(1);

  const [list, setList] = useState<Paginated<OrgUser> | null>(null);
  const [summary, setSummary] = useState<OrgUserSummary | null>(null);
  // Loading is "the latest request hasn't answered yet", derived rather than
  // set, so the effect below only ever sets state from its callbacks.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [details, setDetails] = useState<{ email: string; password: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [adding, setAdding] = useState(false);

  // Typing settles for a moment before it becomes a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const requestKey = JSON.stringify([query, role, status, roleId, sort, page, reloadKey]);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let alive = true;
    users
      .list({ search: query, role, status, roleId, sort, page, perPage: PER_PAGE })
      .then((r) => {
        if (!alive) return;
        setList(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "Users didn't load."))
      .finally(() => alive && setSettledKey(requestKey));
    return () => {
      alive = false;
    };
  }, [query, role, status, roleId, sort, page, reloadKey, requestKey]);

  useEffect(() => {
    let alive = true;
    rolesApi
      .list()
      .then((r) => alive && setAllRoles(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    users
      .summary()
      .then((s) => alive && setSummary(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const remove = useCallback(
    async (account: OrgUser) => {
      const ok = await confirm({
        title: `Delete ${account.name}?`,
        body: (
          <>
            They lose access straight away and move to the organisation&apos;s recycle bin, where an admin can
            restore them with their learning history intact.
          </>
        ),
        confirmLabel: "Delete user",
        recoverable: true,
      });
      if (!ok) return;
      setError(null);
      try {
        await users.remove(account.id);
        setList((l) => (l ? { ...l, data: l.data.filter((p) => p.id !== account.id) } : l));
        setNotice(`${account.name} moved to the recycle bin.`);
        reload();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `${account.name} wasn't deleted.`);
      }
    },
    [confirm, reload],
  );

  const resend = useCallback(async (account: OrgUser) => {
    setError(null);
    try {
      const { temporaryPassword } = await users.resendInvite(account.id);
      if (temporaryPassword) setDetails({ email: account.email, password: temporaryPassword });
      else setNotice(`Invitation sent again to ${account.email}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The invitation wasn't sent.");
    }
  }, []);

  const rows = list?.data ?? [];
  const filtered = query !== "" || role !== "" || status !== "" || roleId !== "";

  const actions = (p: OrgUser) => {
    const self = me?.id === p.id;
    // Somebody managing users through a custom role can't touch an admin.
    const locked = p.role === "admin" && !managesAdmins(me?.role);
    return (
      <ActionMenu
        label={`Actions for ${p.name}`}
        items={[
          { label: "View profile", href: `/suite/org/users/${p.id}`, icon: Eye },
          ...(locked ? [] : [{ label: "Edit user", href: `/suite/org/users/${p.id}/edit`, icon: Pencil }]),
          ...(p.status === "invited" && !locked ? [{ label: "Resend invite", onClick: () => resend(p), icon: MailCheck }] : []),
          // You can't delete yourself — somebody else has to, so an
          // organisation can never delete its way to no admin at all.
          ...(self || locked ? [] : [{ label: "Delete", onClick: () => remove(p), icon: Trash2, danger: true }]),
        ]}
      />
    );
  };

  const columns: Column<OrgUser>[] = [
    {
      key: "user",
      header: "User",
      primary: true,
      value: (p) => p.name,
      render: (p) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={p.name} src={p.avatarUrl} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">
              {p.name}
              {me?.id === p.id && <span className="ml-1.5 text-xs font-medium text-neutral-500">(you)</span>}
            </span>
            <span className="block truncate text-xs text-neutral-500">{p.email}</span>
          </span>
        </span>
      ),
    },
    { key: "role", header: "Role", value: (p) => p.roleLabel, render: (p) => <RoleChip role={p.role} label={p.roleLabel} /> },
    {
      key: "roles",
      header: "Roles",
      hideOnMobile: true,
      value: (p) => extraRoles(p).map((r) => r.name).join(" "),
      render: (p) => <RoleChips roles={extraRoles(p)} />,
    },
    {
      key: "title",
      header: "Job title",
      hideOnMobile: true,
      value: (p) => p.jobTitle ?? "",
      render: (p) => <span className="text-neutral-700">{p.jobTitle ?? "—"}</span>,
    },
    {
      key: "learning",
      header: "Learning",
      hideOnMobile: true,
      value: (p) => p.stats.averageProgress,
      render: (p) =>
        p.stats.enrolments === 0 ? (
          <span className="text-xs text-neutral-500">No courses</span>
        ) : (
          <span className="block w-40">
            <Progress value={p.stats.averageProgress} size="sm" hue="mint" label={`${p.name}'s average progress`} />
            <span className="mt-1 block text-xs tabular-nums text-neutral-500">
              {p.stats.completed}/{p.stats.enrolments} done · {p.stats.certificates} cert
              {p.stats.certificates === 1 ? "" : "s"}
            </span>
          </span>
        ),
    },
    { key: "status", header: "Status", value: (p) => p.status, render: (p) => <StatusPill status={p.status} /> },
    {
      key: "active",
      header: "Last active",
      value: (p) => p.lastActiveAt ?? "",
      render: (p) => (
        <span className="tabular-nums text-neutral-600" title={p.lastActiveAt ? formatDate(p.lastActiveAt) : undefined}>
          {p.lastActiveAt ? timeAgo(p.lastActiveAt) : "Never"}
        </span>
      ),
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: (p) => actions(p) },
  ];

  const roleMix = useMemo(() => {
    if (!summary || summary.total === 0) return [];
    return (["user", "admin"] as OrgRole[]).map((r) => ({
      role: r,
      count: summary.byRole[r] ?? 0,
      share: ((summary.byRole[r] ?? 0) / summary.total) * 100,
    }));
  }, [summary]);

  return (
    <div>
      {details && (
        <SignInDetailsDialog email={details.email} password={details.password} onClose={() => setDetails(null)} />
      )}
      <PageHeader
        eyebrow="Organisation"
        title="Users"
        subtitle="Everyone who can sign in here: their role, what they do and how their learning is going."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add user
          </Button>
        }
      />

      <AddUserDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(p) => {
          setAdding(false);
          setNotice(`${p.name} was added. They'll get an email to set a password.`);
          reload();
        }}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold hover:bg-mint-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {summary ? (
        <div className="mb-6 space-y-4">
          <StatGrid cols={4}>
            <StatCard
              featured
              featuredHue="blue"
              label="Users"
              value={summary.total.toLocaleString()}
              icon={Users}
              hint={`${summary.byRole.admin} admin${summary.byRole.admin === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Active in the last 30 days"
              value={summary.activeLast30Days.toLocaleString()}
              unit={summary.total > 0 ? `${Math.round((summary.activeLast30Days / summary.total) * 100)}%` : undefined}
              icon={Activity}
              hue="mint"
            />
            <StatCard label="New this month" value={summary.newThisMonth.toLocaleString()} icon={Sparkles} hue="grape" />
            <StatCard
              label="Invited, not signed in"
              value={summary.invited.toLocaleString()}
              icon={MailCheck}
              hue="sun"
              hint={summary.invited > 0 ? "Resend from their row" : undefined}
            />
          </StatGrid>

          {roleMix.length > 0 && (
            <Panel title="Role mix" subtitle="Everyone, by what they are on the platform" icon={Users}>
              <div className="flex h-3 w-full overflow-hidden rounded-full ws-hatch" aria-hidden>
                {roleMix.map((m) =>
                  m.count > 0 ? (
                    <span key={m.role} className={HUE[ROLE_HUE[m.role]].bar} style={{ width: `${m.share}%` }} />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {roleMix.map((m) => (
                  <li key={m.role}>
                    <button
                      type="button"
                      onClick={() => {
                        setRole(role === m.role ? "" : m.role);
                        setPage(1);
                      }}
                      aria-pressed={role === m.role}
                      className={cx(
                        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition",
                        role === m.role
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                      )}
                    >
                      <span className={cx("h-2.5 w-2.5 rounded-full", HUE[ROLE_HUE[m.role]].dot)} aria-hidden />
                      {ROLE_NAME[m.role]}s
                      <span className="font-semibold tabular-nums text-neutral-900">{m.count.toLocaleString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by name or email"
          label="Search users"
          className="lg:w-80"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-1 lg:justify-end">
          <FilterSelect
            label="Admins"
            value={role}
            onChange={(v) => {
              setRole(v as OrgRole | "");
              setPage(1);
            }}
            options={[
              { key: "", label: "Admins and everyone else" },
              { key: "admin", label: "Admins only" },
              { key: "user", label: "Everyone but admins" },
            ]}
          />
          <FilterSelect
            label="Role"
            value={roleId}
            onChange={(v) => {
              setRoleId(v);
              setPage(1);
            }}
            options={[
              { key: "", label: "Any role" },
              ...allRoles.map((r) => ({ key: r.id, label: r.kind === "custom" ? `${r.name} (custom)` : r.name })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as OrgUserStatus | "");
              setPage(1);
            }}
            options={[
              { key: "", label: "Any status" },
              { key: "active", label: "Active" },
              { key: "invited", label: "Invited" },
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(v) => {
              setSort(v as OrgUserSort);
              setPage(1);
            }}
            options={SORTS}
          />
        </div>
      </div>

      {error && (
        <ErrorNote className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {error}
            <button type="button" onClick={reload} className="cursor-pointer font-semibold underline underline-offset-2">
              Try again
            </button>
          </span>
        </ErrorNote>
      )}

      {loading && !list ? (
        <div aria-busy="true">
          <p className="sr-only">Loading users…</p>
          <Skeleton className="h-[420px]" />
        </div>
      ) : list ? (
        <div aria-busy={loading || undefined} className={cx(loading && "opacity-60 transition-opacity")}>
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(p) => p.id}
            storageKey="org.users"
            rowHref={(p) => `/suite/org/users/${p.id}`}
            caption="Users in this organisation"
            searchable={false}
            empty={
              filtered ? (
                <Empty
                  icon={Users}
                  title="Nobody matches these filters."
                  hint="Clear a filter or try a shorter search."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setRole("");
                        setStatus("");
                        setRoleId("");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <Empty
                  icon={Users}
                  title="Nobody here yet."
                  hint="Add the first account. They get an email with a link to sign in."
                  action={
                    <Button variant="primary" size="sm" icon={UserPlus} onClick={() => setAdding(true)}>
                      Add user
                    </Button>
                  }
                />
              )
            }
            renderCard={(p) => (
              <PersonCard
                name={p.name}
                src={p.avatarUrl}
                subtitle={p.jobTitle ?? p.email}
                trailing={actions(p)}
                chips={
                  <>
                    <RoleChip role={p.role} label={p.roleLabel} />
                    <StatusPill status={p.status} />
                  </>
                }
                footer={
                  <>
                    <span className="tabular-nums">
                      {p.stats.enrolments} course{p.stats.enrolments === 1 ? "" : "s"} · {p.stats.averageProgress}% avg
                    </span>
                    <span className="tabular-nums">{p.lastActiveAt ? timeAgo(p.lastActiveAt) : "Never active"}</span>
                  </>
                }
              >
                {extraRoles(p).length > 0 && <RoleChips roles={extraRoles(p)} max={3} />}
              </PersonCard>
            )}
            renderListItem={(p) => (
              <div className="flex items-center gap-4 px-5 py-3.5">
                <FaceAvatar name={p.name} src={p.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{p.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {p.email} · {p.stats.enrolments} course{p.stats.enrolments === 1 ? "" : "s"}
                  </p>
                </div>
                <RoleChip role={p.role} label={p.roleLabel} />
              </div>
            )}
          />

          {list.meta.lastPage > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
              <span className="tabular-nums">
                Page {list.meta.currentPage} of {list.meta.lastPage} · {list.meta.total.toLocaleString()} users
              </span>
              <span className="flex gap-2">
                <Button size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  disabled={page >= list.meta.lastPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ArrowRight size={15} aria-hidden />
                </Button>
              </span>
            </nav>
          )}
        </div>
      ) : null}

      <p className="mt-6 text-xs text-neutral-500">
        Looking for someone you deleted?{" "}
        <Link href="/suite/org/recycle-bin" className="font-semibold text-primary-700 hover:underline">
          Open the recycle bin
        </Link>
        .
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      aria-label={label}
      className="w-full lg:w-44"
      options={options.map((o) => ({ value: o.key, label: o.label }))}
    />
  );
}

