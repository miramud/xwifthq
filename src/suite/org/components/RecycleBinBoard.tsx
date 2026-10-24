"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, RotateCcw, Trash, Trash2 } from "lucide-react";
import { Button, Chip, Empty, PageHeader, SearchField, cx, orbClass } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, moduleByKey, type Hue, type WorkspaceModuleKey } from "@/components/workspace/modules";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useAuth } from "@/lib/auth-store";
import { timeAgo } from "@/lib/console-data";
import {
  ApiError,
  recycleBin,
  type BinEntry,
  type BinModule,
  type BinSummary,
} from "@/lib/api/recycle-bin-client";
import type { Paginated } from "@/lib/api/users-client";
import { ErrorNote, FaceAvatar, IconTile, Skeleton } from "@/suite/lms/components/ui/ws";
import { organisations as organisationsApi } from "@/lib/api/saas-client";

const PER_PAGE = 25;

/** The bin's modules, in the suite's own names and colours. */
const MODULE_KEY: Record<BinModule, WorkspaceModuleKey> = {
  core: "org",
  lms: "lms",
  hrm: "hrm",
  projects: "projects",
};

function moduleName(m: BinModule): string {
  return moduleByKey(MODULE_KEY[m]).name;
}

function moduleHue(m: BinModule): Hue {
  return moduleByKey(MODULE_KEY[m]).hue;
}

/**
 * Everything deleted in this organisation, in one place.
 *
 * The owner's rule (26 Sep 2026): a delete anywhere in the suite is a soft
 * delete, and this is where it lands. Restoring is safe and needs no
 * confirmation, it puts something back exactly as it was. Deleting for good
 * is the one thing here that cannot be undone, so it always asks first, and
 * says so.
 *
 * A restore can be refused (a work item whose project is itself in the bin, an
 * email somebody else has since taken). The API's reason is shown on the row
 * it belongs to rather than in a banner that has to say which row it means.
 *
 * The platform owner belongs to no organisation; for them this is the
 * platform's own bin, deleted institutions and shared categories.
 */
export default function RecycleBinBoard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  // The platform-wide bin: the super admin, or platform staff, who belong to no
  // organisation. It lists platform items and every organisation's.
  const platform =
    (user?.role === "super_admin" || (user as { role?: string } | null)?.role === "platform_staff") &&
    !user?.organisationId;

  const [summary, setSummary] = useState<BinSummary | null>(null);
  const [list, setList] = useState<Paginated<BinEntry> | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [module, setModule] = useState<BinModule | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [organisation, setOrganisation] = useState("");
  const [orgOptions, setOrgOptions] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    if (!platform) return;
    let alive = true;
    organisationsApi
      .list()
      .then((list) => alive && setOrgOptions(list.map((o) => ({ slug: o.slug, name: o.name }))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [platform]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const requestKey = JSON.stringify([type, module, query, page, reloadKey, organisation]);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let alive = true;
    recycleBin
      .list({ type, module, search: query, page, perPage: PER_PAGE, organisation: platform ? organisation : undefined })
      .then((r) => {
        if (!alive) return;
        setList(r);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e.message : "The recycle bin didn't load."))
      .finally(() => alive && setSettledKey(requestKey));
    return () => {
      alive = false;
    };
  }, [type, module, query, page, reloadKey, requestKey, organisation, platform]);

  useEffect(() => {
    let alive = true;
    recycleBin
      .summary()
      .then((s) => alive && setSummary(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const drop = (id: string) => setList((l) => (l ? { ...l, data: l.data.filter((e) => e.id !== id) } : l));

  const restore = useCallback(async (entry: BinEntry) => {
    setBusy(entry.id);
    setRowError((r) => {
      const next = { ...r };
      delete next[entry.id];
      return next;
    });
    try {
      await recycleBin.restore(entry.id);
      drop(entry.id);
      setNotice(`${entry.label} was restored.`);
      refresh();
    } catch (e) {
      setRowError((r) => ({
        ...r,
        [entry.id]: e instanceof ApiError ? e.message : `${entry.label} wasn't restored. Try again.`,
      }));
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const purge = useCallback(
    async (entry: BinEntry) => {
      const ok = await confirm({
        title: `Delete “${entry.label}” permanently?`,
        body: "It's removed for good, along with anything stored with it. This can't be undone.",
        confirmLabel: "Delete permanently",
        recoverable: false,
      });
      if (!ok) return;
      setBusy(entry.id);
      setError(null);
      try {
        await recycleBin.purge(entry.id);
        drop(entry.id);
        setNotice(`${entry.label} was deleted permanently.`);
        refresh();
      } catch (e) {
        setRowError((r) => ({
          ...r,
          [entry.id]: e instanceof ApiError ? e.message : `${entry.label} wasn't deleted. Try again.`,
        }));
      } finally {
        setBusy(null);
      }
    },
    [confirm, refresh],
  );

  const total = summary?.total ?? 0;

  const emptyBin = useCallback(async () => {
    const ok = await confirm({
      title: "Empty the recycle bin?",
      body: `All ${total.toLocaleString()} item${total === 1 ? "" : "s"} in the bin will be deleted permanently. This can't be undone.`,
      confirmLabel: "Empty bin",
      recoverable: false,
    });
    if (!ok) return;
    setError(null);
    try {
      const { deleted, skipped = 0 } = await recycleBin.empty();
      setList((l) => (l ? { ...l, data: [] } : l));
      setNotice(
        `${deleted.toLocaleString()} item${deleted === 1 ? " was" : "s were"} deleted permanently.` +
          (skipped > 0
            ? ` ${skipped.toLocaleString()} stayed in the bin because other records still use ${skipped === 1 ? "it" : "them"}.`
            : ""),
      );
      setPage(1);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The bin wasn't emptied.");
    }
  }, [confirm, total, refresh]);

  const modules = useMemo(() => {
    const seen = new Map<BinModule, number>();
    for (const t of summary?.types ?? []) seen.set(t.module, (seen.get(t.module) ?? 0) + t.count);
    return [...seen.entries()];
  }, [summary]);

  const types = useMemo(
    () => (summary?.types ?? []).filter((t) => module === "" || t.module === module),
    [summary, module],
  );

  const columns: Column<BinEntry>[] = [
    {
      key: "item",
      header: "Item",
      primary: true,
      value: (e) => e.label,
      render: (e) => (
        <span className="flex min-w-0 max-w-[380px] items-start gap-3">
          <IconTile icon={Trash2} hue={moduleHue(e.module)} />
          <span className="block min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{e.label}</span>
            <span className="block truncate text-xs text-neutral-500">{e.typeLabel}</span>
            {rowError[e.id] && (
              <span role="alert" className="mt-1 block text-xs font-medium text-error-700">
                {rowError[e.id]}
              </span>
            )}
            {!e.restorable && e.blockedReason && !rowError[e.id] && (
              <span className="mt-1 flex items-start gap-1 text-xs text-sun-700">
                <Info size={12} className="mt-0.5 shrink-0" aria-hidden />
                {e.blockedReason}
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "module",
      header: "Module",
      hideOnMobile: true,
      value: (e) => moduleName(e.module),
      render: (e) => (
        <Chip hue={moduleHue(e.module)} dot>
          {moduleName(e.module)}
        </Chip>
      ),
    },
    ...(platform
      ? [
          {
            key: "organisation",
            header: "Organisation",
            hideOnMobile: true,
            value: (e: BinEntry) => e.organisation?.name ?? "Platform",
            render: (e: BinEntry) =>
              e.organisation ? (
                <span className="truncate text-neutral-700">{e.organisation.name}</span>
              ) : (
                <Chip hue="slate">Platform</Chip>
              ),
          } satisfies Column<BinEntry>,
        ]
      : []),
    {
      key: "by",
      header: "Deleted by",
      hideOnMobile: true,
      value: (e) => e.deletedBy?.name ?? "",
      render: (e) =>
        e.deletedBy ? (
          <span className="flex items-center gap-2">
            <FaceAvatar name={e.deletedBy.name} size={26} />
            <span className="truncate text-neutral-700">{e.deletedBy.name}</span>
          </span>
        ) : (
          <span className="text-neutral-500">Unknown</span>
        ),
    },
    {
      key: "when",
      header: "Deleted",
      value: (e) => e.deletedAt,
      render: (e) => (
        <time dateTime={e.deletedAt} title={new Date(e.deletedAt).toLocaleString("en-GB")} className="tabular-nums text-neutral-600">
          {timeAgo(e.deletedAt)}
        </time>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (e) => <RowActions entry={e} busy={busy === e.id} onRestore={restore} onPurge={purge} />,
    },
  ];

  const filtered = type !== "" || module !== "" || query !== "" || organisation !== "";

  return (
    <div>
      <PageHeader
        eyebrow={platform ? "Platform" : "Organisation"}
        title="Recycle bin"
        subtitle={
          platform
            ? "Everything deleted on the platform and in every organisation. Restore it, or delete it for good."
            : "Everything deleted in your organisation. Restore anything, or delete it for good."
        }
        actions={
          <Button variant="danger" icon={Trash} onClick={emptyBin} disabled={total === 0}>
            Empty bin
          </Button>
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-medium text-mint-700">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-semibold outline-none hover:bg-mint-100 focus-visible:ring-2 focus-visible:ring-mint-500"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---------- what's in here ---------- */}
      {summary ? (
        <div className="ws-card mb-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-4 text-sm text-neutral-600">
              <span className={cx("flex h-14 w-14 shrink-0 items-center justify-center rounded-full", orbClass("coral"))} aria-hidden>
                <Trash2 size={24} />
              </span>
              <span>
                <span className="block text-[26px] font-bold leading-tight tabular-nums text-neutral-900">{total.toLocaleString()}</span>
                item{total === 1 ? "" : "s"} in the bin
              </span>
            </p>
            {modules.length > 1 && (
              <div role="radiogroup" aria-label="Filter by module" className="flex flex-wrap gap-1.5">
                <FilterPill on={module === ""} onClick={() => { setModule(""); setType(""); setPage(1); }}>
                  All modules
                </FilterPill>
                {modules.map(([m, count]) => (
                  <FilterPill
                    key={m}
                    on={module === m}
                    hue={moduleHue(m)}
                    onClick={() => {
                      setModule(module === m ? "" : m);
                      setType("");
                      setPage(1);
                    }}
                  >
                    {moduleName(m)}
                    <span className="tabular-nums text-neutral-500">{count}</span>
                  </FilterPill>
                ))}
              </div>
            )}
          </div>
          {types.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-4" role="radiogroup" aria-label="Filter by type">
              <FilterPill on={type === ""} onClick={() => { setType(""); setPage(1); }}>
                Everything
              </FilterPill>
              {types.map((t) => (
                <FilterPill
                  key={t.type}
                  on={type === t.type}
                  hue={moduleHue(t.module)}
                  onClick={() => {
                    setType(type === t.type ? "" : t.type);
                    setPage(1);
                  }}
                >
                  {t.typeLabel}
                  <span className="tabular-nums text-neutral-500">{t.count}</span>
                </FilterPill>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Skeleton className="mb-6 h-[112px]" />
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search deleted items" label="Search the recycle bin" className="sm:w-80" />
        {platform && (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span id="recycle-bin-where" className="shrink-0">
              Where
            </span>
            <SearchableSelect
              aria-labelledby="recycle-bin-where"
              className="w-full sm:w-64"
              value={organisation}
              onChange={(v) => {
                setOrganisation(v);
                setPage(1);
              }}
              searchPlaceholder="Search organisations"
              options={[
                { value: "", label: "Everywhere" },
                { value: "platform", label: "Platform only" },
                ...orgOptions.map((o) => ({ value: o.slug, label: o.name })),
              ]}
            />
          </div>
        )}
      </div>

      {error && (
        <ErrorNote className="mb-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {error}
            <button type="button" onClick={refresh} className="cursor-pointer font-semibold underline underline-offset-2">
              Try again
            </button>
          </span>
        </ErrorNote>
      )}

      {loading && !list ? (
        <div aria-busy="true">
          <p className="sr-only">Loading the recycle bin…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : list ? (
        <div aria-busy={loading || undefined} className={cx(loading && "opacity-60 transition-opacity")}>
          <DataView
            rows={list.data}
            columns={columns}
            rowKey={(e) => e.id}
            storageKey="org.recycle-bin"
            views={["table", "list"]}
            caption="Deleted items"
            searchable={false}
            empty={
              filtered ? (
                <Empty icon={Trash2} title="Nothing deleted matches." hint="Clear a filter or try another word." />
              ) : (
                <Empty
                  icon={Trash2}
                  title="The recycle bin is empty."
                  hint={platform ? "Anything deleted on the platform or in an organisation lands here, and you can restore it." : "Anything deleted in your organisation lands here, and you can restore it."}
                  hue="mint"
                />
              )
            }
            renderListItem={(e) => (
              <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <IconTile icon={Trash2} hue={moduleHue(e.module)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{e.label}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {e.typeLabel} · {moduleName(e.module)} · deleted {timeAgo(e.deletedAt)}
                      {e.deletedBy ? ` by ${e.deletedBy.name}` : ""}
                    </p>
                    {rowError[e.id] && (
                      <p role="alert" className="mt-1 text-xs font-medium text-error-700">
                        {rowError[e.id]}
                      </p>
                    )}
                    {!e.restorable && e.blockedReason && !rowError[e.id] && (
                      <p className="mt-1 text-xs text-sun-700">{e.blockedReason}</p>
                    )}
                  </div>
                </div>
                <RowActions entry={e} busy={busy === e.id} onRestore={restore} onPurge={purge} />
              </div>
            )}
          />

          {list.meta.lastPage > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
              <span className="tabular-nums">
                Page {list.meta.currentPage} of {list.meta.lastPage}
              </span>
              <span className="flex gap-2">
                <Button size="sm" icon={ArrowLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" disabled={page >= list.meta.lastPage} onClick={() => setPage((p) => p + 1)}>
                  Next
                  <ArrowRight size={15} aria-hidden />
                </Button>
              </span>
            </nav>
          )}
        </div>
      ) : null}

      <p className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
        <Info size={14} className="shrink-0" aria-hidden />
        Deleted items stay here until an admin restores them or deletes them permanently.
      </p>
    </div>
  );
}

function RowActions({
  entry,
  busy,
  onRestore,
  onPurge,
}: {
  entry: BinEntry;
  busy: boolean;
  onRestore: (e: BinEntry) => void;
  onPurge: (e: BinEntry) => void;
}) {
  return (
    <span className="flex shrink-0 items-center justify-end gap-2">
      <Button
        size="sm"
        icon={RotateCcw}
        disabled={busy || !entry.restorable}
        onClick={() => onRestore(entry)}
        aria-label={`Restore ${entry.label}`}
        title={!entry.restorable ? entry.blockedReason ?? "Can't be restored yet" : undefined}
      >
        Restore
      </Button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPurge(entry)}
        aria-label={`Delete ${entry.label} permanently`}
        title="Delete permanently"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </span>
  );
}

function FilterPill({
  on,
  hue,
  onClick,
  children,
}: {
  on: boolean;
  hue?: Hue;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
        on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
      )}
    >
      {hue && <span className={cx("h-2 w-2 rounded-full", HUE[hue].dot)} aria-hidden />}
      {children}
    </button>
  );
}
