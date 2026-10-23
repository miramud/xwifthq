"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, CornerDownRight, FolderOpen, FolderPlus, FolderTree, Layers, Pencil, Trash2, Inbox } from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  buttonClass,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  portfolios as portfoliosApi,
  projects as projectsApi,
  type Portfolio,
} from "@/lib/api/projects-client";
import { Modal, Notice, Skeleton, inputCls, labelCls, plural, hintCls } from "./ui/pkit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

/**
 * The shelves.
 *
 * This screen exists because the endpoints for it already did and nothing
 * called them: folders could be read, and never created, so the "Folder"
 * field on a new project was permanently empty and no project could ever be
 * filed anywhere.
 *
 * A shelf holds projects and other shelves and nothing else — no dates, no
 * status, no budget. The moment a folder has a delivery date it is a project
 * with extra steps, and then two things half-mean "the work".
 *
 * Deleting is refused while anything is on it rather than cascading. A folder
 * that silently took four projects and their sprints with it is the most
 * destructive thing a misclick could do here.
 */

/** A folder placed in the tree: how deep it sits and the path down to it. */
interface Placed {
  shelf: Portfolio;
  depth: number;
  path: string[];
  /** Folders directly inside this one. */
  children: number;
  order: number;
}

export default function PortfolioManager() {
  const confirm = useConfirm();
  const [shelves, setShelves] = useState<Portfolio[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState({ projects: 0, unfiled: 0 });
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [editing, setEditing] = useState<Portfolio | null>(null);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([portfoliosApi.list(), projectsApi.list()])
      .then(([list, page]) => {
        if (cancelled) return;

        setShelves(list);
        /*
          Counted from the projects this viewer can see, not from a total on
          the folder: a shelf must never advertise work somebody is not on.
        */
        const tally: Record<string, number> = {};
        let unfiled = 0;

        for (const project of page.data) {
          const key = project.portfolio?.id;

          if (key !== undefined) tally[key] = (tally[key] ?? 0) + 1;
          else unfiled += 1;
        }

        setCounts(tally);
        setTotals({ projects: page.data.length, unfiled });
        setCanManage(page.meta.canManagePortfolios ?? page.meta.canCreate);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setShelves([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reloads]);

  /*
    Every level, not two. The first version rendered roots and their children
    only, so a folder nested one deeper was creatable and invisible — and the
    API allows arbitrary depth, refusing only cycles.

    Flattened depth-first, so the table reads as the tree does: each folder
    directly under its parent, indented by how deep it sits. Recursive rather
    than unrolled, because the depth is the institution's choice: an agency
    files by client then engagement then phase.
  */
  const placed = useMemo<Placed[]>(() => {
    if (shelves === null) return [];
    const out: Placed[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number, path: string[]) => {
      for (const shelf of shelves.filter((s) => s.parentId === parent)) {
        if (seen.has(shelf.id)) continue;
        seen.add(shelf.id);
        out.push({
          shelf,
          depth,
          path,
          children: shelves.filter((s) => s.parentId === shelf.id).length,
          order: out.length,
        });
        walk(shelf.id, depth + 1, [...path, shelf.name]);
      }
    };
    walk(null, 0, []);
    return out;
  }, [shelves]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);

    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
    setName("");
    setParentId("");
  };

  const startEdit = (shelf: Portfolio) => {
    setEditing(shelf);
    setAdding(false);
    setName(shelf.name);
    setParentId(shelf.parentId ?? "");
  };

  const remove = async (shelf: Portfolio) => {
    const ok = await confirm({
      title: `Delete the ${shelf.name} portfolio?`,
      body: "Only an empty portfolio can be deleted; move its projects and folders out first. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Delete portfolio",
      recoverable: true,
    });
    if (ok) await run(shelf.id, () => portfoliosApi.remove(shelf.id));
  };

  const header = (
    <PageHeader
      eyebrow="Projects"
      title="Portfolios"
      subtitle="Where projects live. A folder holds projects and other folders — nothing else."
      actions={
        canManage ? (
          <Button
            variant="primary"
            icon={FolderPlus}
            onClick={() => {
              setAdding(true);
              setEditing(null);
              setName("");
              setParentId("");
            }}
          >
            New folder
          </Button>
        ) : undefined
      }
    />
  );

  if (shelves === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[124px]" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const filed = totals.projects - totals.unfiled;

  const actions = (p: Placed) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/suite/projects?portfolioId=${encodeURIComponent(p.shelf.id)}`}
        onClick={(e) => e.stopPropagation()}
        className={cx(buttonClass("ghost", "sm"), "text-primary-700")}
      >
        Open
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
      {canManage && (
        <>
          <button
            type="button"
            onClick={() => startEdit(p.shelf)}
            aria-label={`Rename ${p.shelf.name}`}
            title="Rename"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Pencil size={15} aria-hidden />
          </button>
          <button
            type="button"
            disabled={busy === p.shelf.id}
            onClick={() => void remove(p.shelf)}
            className={cx(buttonClass("ghost", "sm"), "text-error-700 hover:bg-error-500/10 hover:text-error-700")}
          >
            <Trash2 size={14} aria-hidden />
            Remove
          </button>
        </>
      )}
    </div>
  );

  const columns: Column<Placed>[] = [
    {
      key: "name",
      header: "Folder",
      primary: true,
      value: (p) => p.shelf.name,
      render: (p) => (
        <span className="flex min-w-0 items-center gap-2.5" style={{ paddingLeft: p.depth * 20 }}>
          {p.depth > 0 && <CornerDownRight size={14} className="shrink-0 text-neutral-400" aria-hidden />}
          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE[hueFor(p.shelf.name)].soft)}>
            <FolderTree size={15} aria-hidden />
          </span>
          <span className="truncate font-semibold text-neutral-900">{p.shelf.name}</span>
        </span>
      ),
    },
    {
      key: "inside",
      header: "Inside",
      hideOnMobile: true,
      value: (p) => p.path.join(" / "),
      render: (p) =>
        p.path.length === 0 ? (
          <span className="text-neutral-500">Top level</span>
        ) : (
          <span className="text-neutral-700">{p.path.join(" / ")}</span>
        ),
    },
    {
      key: "projects",
      header: "Projects",
      align: "right",
      value: (p) => counts[p.shelf.id] ?? 0,
      render: (p) => {
        const count = counts[p.shelf.id] ?? 0;
        return <span className="tabular-nums">{count === 0 ? "No projects" : plural(count, "project")}</span>;
      },
    },
    {
      key: "folders",
      header: "Subfolders",
      align: "right",
      hideOnMobile: true,
      value: (p) => p.children,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      tableOnly: true,
      render: actions,
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      <StatGrid>
        <StatCard featured label="Folders" value={shelves.length} icon={FolderTree} hint={`${placed.filter((p) => p.depth === 0).length} at the top level`} />
        <StatCard label="Projects filed" value={filed} icon={FolderOpen} hue="mint" hint="Of the projects you are on" />
        <StatCard label="Unfiled projects" value={totals.unfiled} icon={Inbox} hue="sun" hint={totals.unfiled === 0 ? "Everything has a shelf" : "Not in any folder yet"} />
        <StatCard
          label="Deepest nesting"
          value={placed.length === 0 ? 0 : Math.max(...placed.map((p) => p.depth)) + 1}
          unit="levels"
          icon={Layers}
          hue="grape"
        />
      </StatGrid>

      {shelves.length === 0 ? (
        <Panel>
          <Empty
            icon={FolderTree}
            title="No folders yet"
            hint={
              canManage
                ? "Group projects by client, by department, or by whatever your team looks for them under."
                : "A delivery lead can create folders to group projects."
            }
            action={
              canManage ? (
                <Button variant="primary" icon={FolderPlus} onClick={() => setAdding(true)}>
                  New folder
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <DataView
          rows={placed}
          columns={columns}
          rowKey={(p) => p.shelf.id}
          storageKey="projects.portfolios"
          searchPlaceholder="Search folders"
          caption="Project folders"
          renderCard={(p) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", HUE[hueFor(p.shelf.name)].tile)}>
                  <FolderTree size={20} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold text-neutral-900">{p.shelf.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {p.path.length === 0 ? "Top level" : p.path.join(" / ")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip hue={(counts[p.shelf.id] ?? 0) > 0 ? "blue" : "slate"} icon={FolderOpen}>
                  {(counts[p.shelf.id] ?? 0) === 0 ? "No projects" : plural(counts[p.shelf.id] ?? 0, "project")}
                </Chip>
                {p.children > 0 && (
                  <Chip hue="grape" icon={FolderTree}>
                    {plural(p.children, "subfolder")}
                  </Chip>
                )}
              </div>
              <div className="mt-auto border-t border-neutral-100 pt-3">{actions(p)}</div>
            </div>
          )}
          renderListItem={(p) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="flex min-w-0 flex-1 items-center gap-2.5" style={{ paddingLeft: p.depth * 16 }}>
                {p.depth > 0 && <CornerDownRight size={14} className="shrink-0 text-neutral-400" aria-hidden />}
                <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE[hueFor(p.shelf.name)].soft)}>
                  <FolderTree size={15} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-900">{p.shelf.name}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {(counts[p.shelf.id] ?? 0) === 0 ? "No projects" : plural(counts[p.shelf.id] ?? 0, "project")}
                  </span>
                </span>
              </span>
              {actions(p)}
            </div>
          )}
        />
      )}

      {(adding || editing !== null) && canManage && (
        <Modal
          title={editing !== null ? "Rename folder" : "New folder"}
          subtitle={editing !== null ? editing.name : "A shelf for projects and other folders."}
          icon={editing !== null ? Pencil : FolderPlus}
          hue={editing !== null ? "grape" : "blue"}
          onClose={closeForm}
          width="sm"
          onSubmit={(e) => {
            e.preventDefault();

            if (name.trim() === "") return;

            void run("save", async () => {
              if (editing !== null) {
                await portfoliosApi.update(editing.id, {
                  name: name.trim(),
                  parentId: parentId === "" ? null : parentId,
                });
              } else {
                await portfoliosApi.create({
                  name: name.trim(),
                  parentId: parentId === "" ? null : parentId,
                });
              }

              closeForm();
            });
          }}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={closeForm} className="ml-auto">
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy !== null || name.trim() === ""}>
                {editing !== null ? "Save" : "Create"}
              </Button>
            </>
          }
        >
          {error !== null && <Notice className="mb-4">{error}</Notice>}
          <div className="space-y-4">
            <div>
              <label htmlFor="pf-name" className={labelCls}>
                Name
              </label>
              <input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={160}
                autoFocus
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="pf-parent" className={labelCls}>
                Inside
              </label>
              <SearchableSelect
                id="pf-parent"
                value={parentId}
                onChange={setParentId}
                searchPlaceholder="Search folders"
                options={[
                  { value: "", label: "Nothing — a top-level folder" },
                  ...shelves
                    /* A folder cannot be its own parent. Deeper cycles are
                       refused by the API, which can see the whole tree. */
                    .filter((s) => s.id !== editing?.id)
                    .map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <p className={hintCls}>A folder can sit inside another, as deep as your filing needs.</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
