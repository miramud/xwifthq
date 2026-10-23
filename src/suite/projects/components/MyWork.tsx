"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  CalendarClock,
  Clock,
  FolderKanban,
  ListTodo,
  PartyPopper,
} from "lucide-react";
import {
  ButtonLink,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PriorityChip,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  projects as projectsApi,
  workItems as itemsApi,
  type Project,
  type WorkItem,
} from "@/lib/api/projects-client";
import {
  ItemRef,
  Notice,
  Skeleton,
  StatusChip,
  TYPE_META,
  fmtDate,
  priorityName,
} from "./ui/pkit";

/**
 * Everything assigned to this person, across every project they are on.
 *
 * The question a board cannot answer. An engineer on three projects has three
 * boards and one working day, and "what am I meant to be doing" is not
 * answerable by opening each of them in turn.
 *
 * Fetched per project rather than from one endpoint: the API scopes work items
 * to a project by design, and a cross-project query would need its own route
 * and its own authorisation story. Three or four small calls in parallel is
 * the right trade at this size — and if somebody is on twenty projects, that
 * is the signal for the endpoint rather than the reason to have built it now.
 *
 * **Finished work is hidden by default.** A list of what to do next that opens
 * with three months of completed tickets is a list nobody reads twice.
 */

type Row = { project: Project; item: WorkItem };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MyWork() {
  const { user } = useAuth();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    if (user === null) return;

    let cancelled = false;

    projectsApi
      .list({ openOnly: true })
      .then(async (page) => {
        const perProject = await Promise.all(
          page.data.map(async (project) => {
            const items = await itemsApi.list(project.slug, {
              assigneeId: user.id,
              perPage: 100,
            });

            return items.data.map((item) => ({ project, item }));
          }),
        );

        if (!cancelled) {
          setRows(perProject.flat());
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const visible = useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (showDone || !r.item.isComplete) && (projectFilter === "" || r.project.id === projectFilter),
      ),
    [rows, showDone, projectFilter],
  );

  /* The projects somebody has work on, for the filter — by name, once each. */
  const projectsWithWork = useMemo(() => {
    const map = new Map<string, Project>();
    for (const { project } of rows ?? []) map.set(project.id, project);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const figures = useMemo(() => {
    const today = todayIso();
    const week = isoIn(7);
    const open = (rows ?? []).filter((r) => !r.item.isComplete);
    const overdue = open.filter((r) => r.item.dueOn !== null && r.item.dueOn.slice(0, 10) < today);
    const thisWeek = open.filter(
      (r) => r.item.dueOn !== null && r.item.dueOn.slice(0, 10) >= today && r.item.dueOn.slice(0, 10) <= week,
    );
    const blocked = open.filter((r) => r.item.blockedReason);
    /* Absent, never zero: only estimated items are summed, and the rest are counted as such. */
    const estimated = open.filter((r) => r.item.estimateHours !== null);
    const hours = estimated.reduce((s, r) => s + (r.item.estimateHours ?? 0), 0);
    return { open, overdue, thisWeek, blocked, hours, unestimated: open.length - estimated.length, today };
  }, [rows]);

  const header = (
    <PageHeader
      eyebrow="Projects"
      title="My work"
      subtitle="Everything assigned to you, across every project you are on."
      actions={
        <ButtonLink href="/suite/projects" icon={FolderKanban}>
          All projects
        </ButtonLink>
      }
    />
  );

  if (rows === null) {
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

  const doneCount = rows.filter((r) => r.item.isComplete).length;

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Work item",
      primary: true,
      sortable: true,
      value: (r) => r.item.title,
      render: (r) => <ItemTitle row={r} />,
    },
    {
      key: "project",
      header: "Project",
      sortable: true,
      value: (r) => r.project.name,
      render: (r) => (
        <Chip hue={hueFor(r.project.name)} dot>
          {r.project.name}
        </Chip>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.item.status?.label ?? "",
      render: (r) => (r.item.status !== undefined ? <StatusChip status={r.item.status} /> : <span className="text-neutral-400">-</span>),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.item.priority,
      render: (r) => <PriorityChip priority={priorityName(r.item.priority) || null} />,
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      value: (r) => r.item.dueOn ?? "9999",
      render: (r) => <Due item={r.item} today={figures.today} />,
    },
    {
      key: "estimate",
      header: "Estimate",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (r) => r.item.estimateHours ?? -1,
      /* Absent, never zero — see the board. */
      render: (r) =>
        r.item.estimateHours === null ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <span className="tabular-nums">{r.item.estimateHours}h</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      <StatGrid>
        <StatCard
          featured
          label="Outstanding"
          value={figures.open.length}
          icon={ListTodo}
          hint={
            figures.unestimated > 0
              ? `${figures.hours}h estimated · ${figures.unestimated} not estimated`
              : `${figures.hours}h estimated`
          }
        />
        <StatCard
          label="Past due"
          value={figures.overdue.length}
          icon={CalendarClock}
          hue="rose"
          hint={figures.overdue.length === 0 ? "Nothing late" : "Open, with a due date gone"}
        />
        <StatCard label="Due this week" value={figures.thisWeek.length} icon={Clock} hue="sun" hint="In the next seven days" />
        <StatCard
          label="Blocked"
          value={figures.blocked.length}
          icon={AlertOctagon}
          hue="coral"
          hint={figures.blocked.length === 0 ? "Nothing waiting on others" : "With a reason recorded"}
        />
      </StatGrid>

      {rows.length === 0 ? (
        <Panel>
          <Empty
            icon={ListTodo}
            title="Nothing is assigned to you"
            hint="Work assigned to you on any project you are staffed on appears here."
          />
        </Panel>
      ) : (
        <DataView
          rows={visible}
          columns={columns}
          rowKey={(r) => r.item.id}
          rowHref={(r) => `/suite/projects/${r.project.slug}`}
          storageKey="projects.mywork"
          searchPlaceholder="Search your work"
          caption="Work assigned to you"
          matches={(r, q) =>
            r.item.title.toLowerCase().includes(q) ||
            r.project.name.toLowerCase().includes(q) ||
            (r.item.externalRef ?? "").toLowerCase().includes(q)
          }
          toolbar={
            <>
              {projectsWithWork.length > 1 && (
                <SearchableSelect
                  value={projectFilter}
                  onChange={setProjectFilter}
                  aria-label="Project"
                  size="sm"
                  className="w-48"
                  searchPlaceholder="Search projects"
                  options={[
                    { value: "", label: "Every project" },
                    ...projectsWithWork.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              )}
              <Segmented
                label="Which work"
                options={[
                  { key: "open", label: "Outstanding" },
                  { key: "all", label: doneCount > 0 ? `Show finished (${doneCount})` : "Show finished" },
                ]}
                value={showDone ? "all" : "open"}
                onChange={(v) => setShowDone(v === "all")}
              />
            </>
          }
          empty={
            visible.length === 0 ? (
              <Empty
                icon={PartyPopper}
                hue="mint"
                title="Nothing outstanding"
                hint="Everything assigned to you is finished. Choose “Show finished” above to see it."
              />
            ) : undefined
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <Chip hue={hueFor(r.project.name)} dot>
                  {r.project.name}
                </Chip>
                <PriorityChip priority={priorityName(r.item.priority) || null} />
              </div>
              <ItemTitle row={r} />
              {r.item.blockedReason && (
                <p className="line-clamp-2 rounded-xl bg-coral-50 px-3 py-2 text-xs text-coral-700">
                  <span className="font-semibold">Blocked: </span>
                  {r.item.blockedReason}
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs">
                {r.item.status !== undefined ? <StatusChip status={r.item.status} /> : <span />}
                <span className="flex items-center gap-3">
                  <Due item={r.item} today={figures.today} />
                  <span className={r.item.estimateHours === null ? "text-neutral-400" : "font-semibold tabular-nums text-neutral-700"}>
                    {r.item.estimateHours === null ? "Not estimated" : `${r.item.estimateHours}h`}
                  </span>
                </span>
              </div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <ItemTitle row={r} />
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Chip hue={hueFor(r.project.name)} dot className="!px-2 !py-0.5 text-[11px]">
                    {r.project.name}
                  </Chip>
                  {r.item.status !== undefined && <StatusChip status={r.item.status} />}
                </div>
              </div>
              <Due item={r.item} today={figures.today} />
            </div>
          )}
        />
      )}
    </div>
  );
}

function ItemTitle({ row }: { row: Row }) {
  const meta = TYPE_META[row.item.type];
  const Icon = meta?.icon ?? ListTodo;
  return (
    <span className="flex min-w-0 items-start gap-2.5">
      <span
        className={cx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", HUE[meta?.hue ?? "slate"].soft)}
        title={row.item.typeLabel}
      >
        <Icon size={14} aria-hidden />
        <span className="sr-only">{row.item.typeLabel}</span>
      </span>
      <span className="min-w-0">
        <span className={cx("block text-sm font-semibold", row.item.isComplete ? "text-neutral-500 line-through" : "text-neutral-900")}>
          {row.item.title}
        </span>
        {row.item.externalRef && (
          <span className="mt-0.5 block">
            <ItemRef value={row.item.externalRef} />
          </span>
        )}
      </span>
    </span>
  );
}

function Due({ item, today }: { item: WorkItem; today: string }) {
  if (item.dueOn === null) return <span className="text-xs text-neutral-500">No due date</span>;
  const late = !item.isComplete && item.dueOn.slice(0, 10) < today;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs",
        late ? "font-semibold text-error-700" : "text-neutral-600",
      )}
    >
      <CalendarClock size={12} aria-hidden />
      {fmtDate(item.dueOn, false)}
      {late && <span>· late</span>}
    </span>
  );
}
