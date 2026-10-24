"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  CalendarClock,
  CalendarDays,
  Clock,
  FolderKanban,
  KanbanSquare,
  ListTodo,
  PartyPopper,
  PieChart,
} from "lucide-react";
import {
  AvatarStack,
  Chip,
  Empty,
  Panel,
  PriorityChip,
  Progress,
  Segmented,
  StatCard,
  StatGrid,
  WelcomeBanner,
  bannerButtonClass,
  cx,
} from "@/components/workspace/kit";
import { Donut } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
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
  plural,
  priorityName,
  statusVisual,
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
 * the right trade at this size, and if somebody is on twenty projects, that
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A board column's wash, in the hue its status is drawn in. */
const COLUMN_BG: Record<Hue, string> = {
  blue: "bg-primary-50/70",
  coral: "bg-coral-50/70",
  mint: "bg-mint-50/70",
  grape: "bg-grape-50/70",
  sun: "bg-sun-50/80",
  sky: "bg-sky-50/80",
  rose: "bg-rose-50/70",
  slate: "bg-neutral-100/80",
};

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

  /* The projects somebody has work on, for the filter, by name, once each. */
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

  /*
    Presentation only: the same rows, grouped for the landing panels (status
    ring, progress per project, the next seven days and the board).
  */
  const layout = useMemo(() => {
    const all = rows ?? [];
    const open = all.filter((r) => !r.item.isComplete);

    const statuses = new Map<string, { label: string; hue: Hue; position: number; all: number; open: Row[] }>();
    for (const r of all) {
      const st = r.item.status;
      const key = st?.key ?? "";
      const seen = statuses.get(key) ?? {
        label: st?.label ?? "No column",
        hue: statusVisual(st).hue,
        position: st?.position ?? Number.MAX_SAFE_INTEGER,
        all: 0,
        open: [],
      };
      seen.all += 1;
      seen.position = Math.min(seen.position, st?.position ?? Number.MAX_SAFE_INTEGER);
      if (!r.item.isComplete) seen.open.push(r);
      statuses.set(key, seen);
    }
    const byStatus = [...statuses.entries()]
      .sort((a, b) => a[1].position - b[1].position)
      .map(([key, v]) => ({ key, ...v }));

    const perProject = new Map<string, { project: Project; total: number; done: number }>();
    for (const r of all) {
      const seen = perProject.get(r.project.id) ?? { project: r.project, total: 0, done: 0 };
      seen.total += 1;
      if (r.item.isComplete) seen.done += 1;
      perProject.set(r.project.id, seen);
    }
    const byProject = [...perProject.values()].sort((a, b) => b.total - a.total).slice(0, 6);

    const now = new Date();
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        key,
        day: d.getDate(),
        weekday: WEEKDAYS[d.getDay()],
        count: open.filter((r) => r.item.dueOn?.slice(0, 10) === key).length,
      };
    });
    const agenda = [...figures.thisWeek].sort((a, b) => (a.item.dueOn ?? "").localeCompare(b.item.dueOn ?? ""));

    return { byStatus, byProject, week, agenda, board: byStatus.filter((s) => s.open.length > 0) };
  }, [rows, figures.thisWeek]);

  const header = (
    <WelcomeBanner
      name={user?.name}
      eyebrow="My work"
      art="projects"
      subtitle="Everything assigned to you, across every project you are on."
      figure={
        rows !== null ? { label: "Outstanding", value: figures.open.length, hint: `${figures.hours}h estimated` } : undefined
      }
      actions={
        <Link href="/suite/projects" className={bannerButtonClass("glass")}>
          <FolderKanban size={17} aria-hidden />
          All projects
        </Link>
      }
    />
  );

  if (rows === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[112px]" />
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
      /* Absent, never zero, see the board. */
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
            hint="Work assigned to you on any project you are staffed on shows here."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Progress by project"
              subtitle="Your items finished, out of those assigned to you"
              icon={FolderKanban}
              hue="blue"
              bodyClassName="px-3 pb-4 pt-3"
            >
              <ul>
                {layout.byProject.map(({ project, total, done }) => {
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/suite/projects/${project.slug}`}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <ProjectTile name={project.name} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-neutral-900">{project.name}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                              {Math.round(pct)}%
                            </span>
                          </span>
                          <span className="mt-1.5 block">
                            <Progress
                              value={pct}
                              hue={hueFor(project.name)}
                              size="sm"
                              label={`${done} of ${total} finished on ${project.name}`}
                            />
                          </span>
                          <span className="mt-1 block text-xs text-neutral-500">
                            {done} of {plural(total, "item")} finished
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            <Panel title="Tasks overview" subtitle="Everything assigned to you, by column" icon={PieChart} hue="mint">
              <Donut
                data={layout.byStatus.map((s) => ({ label: s.label, value: s.all, hue: s.hue }))}
                total={rows.length}
                centerLabel={rows.length === 1 ? "item" : "items"}
                caption="Work assigned to you, by board column"
                legend="below"
                size={168}
              />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="This week" subtitle="Due in the next seven days" icon={CalendarDays} hue="grape">
              <ol className="grid grid-cols-7 gap-1" aria-label="The next seven days">
                {layout.week.map((d, i) => (
                  <li
                    key={d.key}
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-xl py-2 text-center",
                      i === 0 ? "bg-primary-600 text-white shadow-md shadow-primary-600/25" : "bg-neutral-50 text-neutral-700",
                    )}
                  >
                    <span className={cx("text-[11px] font-medium", i === 0 ? "text-white/85" : "text-neutral-500")}>
                      {d.weekday}
                    </span>
                    <span className="text-sm font-bold tabular-nums">{d.day}</span>
                    <span
                      aria-hidden
                      className={cx(
                        "h-1.5 w-1.5 rounded-full",
                        d.count === 0 ? "bg-transparent" : i === 0 ? "bg-white" : "bg-primary-500",
                      )}
                    />
                    {d.count > 0 && <span className="sr-only">{plural(d.count, "item")} due</span>}
                  </li>
                ))}
              </ol>
              {layout.agenda.length === 0 ? (
                <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
                  Nothing of yours is due in the next seven days.
                </p>
              ) : (
                <ul className="mt-4 space-y-1">
                  {layout.agenda.slice(0, 6).map((r) => (
                    <li key={r.item.id}>
                      <Link
                        href={`/suite/projects/${r.project.slug}`}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <DateLeaf value={r.item.dueOn} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{r.item.title}</span>
                          <span className="block truncate text-xs text-neutral-500">{r.project.name}</span>
                        </span>
                        <PriorityChip priority={priorityName(r.item.priority) || null} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Your board"
              subtitle="Outstanding work, by column"
              icon={KanbanSquare}
              hue="blue"
              bodyClassName="px-5 pb-5 pt-4"
            >
              {layout.board.length === 0 ? (
                <Empty icon={PartyPopper} hue="mint" title="Nothing outstanding" hint="Everything assigned to you is finished." />
              ) : (
                <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                  {layout.board.map((col) => {
                    const shown = col.open.slice(0, 5);
                    const rest = col.open.length - shown.length;
                    return (
                      <section
                        key={col.key || "none"}
                        aria-label={col.label}
                        className={cx("flex w-64 shrink-0 flex-col rounded-2xl p-3", COLUMN_BG[col.hue])}
                      >
                        <header className="mb-3 flex items-center justify-between gap-2 px-1">
                          <span className={cx("truncate text-sm font-bold", HUE[col.hue].text)}>{col.label}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-700 shadow-sm">
                            {col.open.length}
                          </span>
                        </header>
                        <ul className="space-y-2.5">
                          {shown.map((r) => (
                            <li key={r.item.id}>
                              <Link
                                href={`/suite/projects/${r.project.slug}`}
                                className="block rounded-xl bg-white p-3.5 shadow-sm outline-none ring-1 ring-neutral-200/60 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
                              >
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <PriorityChip priority={priorityName(r.item.priority) || null} />
                                  <Chip hue={hueFor(r.project.name)} dot className="!px-2 !py-0.5 text-[11px]">
                                    {r.project.name}
                                  </Chip>
                                </span>
                                <span className="mt-2.5 block">
                                  <ItemTitle row={r} />
                                </span>
                                <span className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                                  <Due item={r.item} today={figures.today} />
                                  {r.item.assignee ? (
                                    <AvatarStack people={[{ name: r.item.assignee.name }]} size={24} />
                                  ) : null}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        {rest > 0 && (
                          <p className="mt-2.5 px-1 text-xs font-medium text-neutral-500">
                            {plural(rest, "more item")} in the list below
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

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
        </>
      )}
    </div>
  );
}

/** The project's colour, the same as on the projects page: initials on its hue. */
function ProjectTile({ name }: { name: string }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "P";
  return (
    <span
      aria-hidden
      className={cx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
        HUE[hueFor(name)].tile,
      )}
    >
      {letters}
    </span>
  );
}

/** A date as a small calendar leaf: month above, day below. */
function DateLeaf({ value }: { value: string | null }) {
  if (!value) return null;
  const [, m, d] = value.slice(0, 10).split("-").map(Number);
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 text-primary-700">
      <span aria-hidden className="text-[10px] font-bold uppercase leading-none tracking-wide">
        {MONTHS[(m ?? 1) - 1]}
      </span>
      <span aria-hidden className="mt-0.5 text-base font-bold leading-none tabular-nums">
        {d}
      </span>
      <span className="sr-only">{fmtDate(value)}</span>
    </span>
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
