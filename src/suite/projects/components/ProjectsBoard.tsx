"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BellRing,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FolderKanban,
  FolderTree,
  KanbanSquare,
  ListTodo,
  Loader,
  PauseCircle,
  PieChart,
  Plug,
  Plus,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  AvatarStack,
  Button,
  Chip,
  Empty,
  Panel,
  Progress,
  QuickActions,
  Segmented,
  StatCard,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  cx,
  type QuickAction,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, Donut, StatusBars } from "@/components/workspace/charts";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import {
  ApiError,
  companies as companiesApi,
  portfolios as portfoliosApi,
  projects as projectsApi,
  type ExternalCompany,
  type Portfolio,
  type Project,
  type ProjectLifecycle,
  type ProjectMember,
} from "@/lib/api/projects-client";
import NewProjectDialog from "./NewProjectDialog";
import { NameAvatar, Notice, Skeleton, fmtDate, plural } from "./ui/pkit";
import { richExcerpt } from "@/lib/richText";

/**
 * Every project this person is on.
 *
 * **The empty state is the important one.** Visibility here is membership, so
 * a new engineer's first view of the module is legitimately empty, and an
 * empty page that says nothing reads as a broken deployment. It says why, and
 * who to ask.
 *
 * The figures above the list are all counted from the projects themselves,
 * lifecycle, target dates, clients, never from sprint history, which a new
 * installation does not have. A wall of `-` teaches people to ignore a page.
 */

const STATUS: Record<ProjectLifecycle, { hue: Hue; icon: LucideIcon }> = {
  planning: { hue: "sky", icon: CircleDashed },
  active: { hue: "mint", icon: Loader },
  on_hold: { hue: "sun", icon: PauseCircle },
  complete: { hue: "blue", icon: CheckCircle2 },
  cancelled: { hue: "slate", icon: XCircle },
};

const LIFECYCLE_ORDER: ProjectLifecycle[] = ["planning", "active", "on_hold", "complete", "cancelled"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A status board column's wash, in the status's own hue. */
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

/** A bare `YYYY-MM-DD` as local midnight, so no timezone moves the day. */
function bareDay(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/**
 * How much of the promised window has gone, **time, not work**. There is no
 * per-project completion figure on the list, and inventing one from nothing
 * would be worse than showing the calendar honestly. Null when there is no
 * window to measure against.
 */
function scheduleUsed(p: Project): number | null {
  if (p.status === "complete") return 100;
  if (!p.startsOn || !p.targetEndsOn) return null;
  const from = bareDay(p.startsOn);
  const to = bareDay(p.targetEndsOn);
  if (to <= from) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.min(100, ((today - from) / (to - from)) * 100));
}

export default function ProjectsBoard() {
  const { user } = useAuth();

  /*
    The folders screen links here with ?portfolioId=…, and this ignored it,
    so "Open" on a folder showed every project and looked like it had done
    nothing. Read from the URL rather than held in state, so the link is
    shareable and the back button works.
  */
  const params = useSearchParams();
  const shelfFilter = params.get("portfolioId");
  /*
    The External Companies screen links here with ?companyId=…, so the project
    count on a client card is something a reader can follow. Same reasoning as
    the folder filter above, and the same lesson: the count was readable and
    not followable, which sends somebody looking by hand.
  */
  const companyFilter = params.get("companyId");
  /*
    /suite/projects/new lands here with ?new=1 ("new" is a reserved slug, so it
    is never a project). The form opens once, after the first load says this
    person may start a project; a later reload must not reopen it.
  */
  const wantsNew = params.get("new") === "1";
  const offeredNew = useRef(false);

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [companies, setCompanies] = useState<ExternalCompany[]>([]);
  const [creating, setCreating] = useState(false);
  const [reloads, setReloads] = useState(0);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  /*
    The promise form with a cancellation flag rather than `void load()`.
    Navigating away mid-fetch would otherwise set state on an unmounted
    component, and React 19 rightly objects to a setState the linter can trace
    synchronously into an effect body.
  */
  useEffect(() => {
    let cancelled = false;

    Promise.all([projectsApi.list(), portfoliosApi.list(), companiesApi.list()])
      .then(([page, shelves, clients]) => {
        if (cancelled) return;

        setProjects(page.data);
        setCanCreate(page.meta.canCreate);
        if (wantsNew && page.meta.canCreate && !offeredNew.current) {
          offeredNew.current = true;
          setCreating(true);
        }
        setPortfolios(shelves);
        /*
          All of them, including former clients. The new-project form is given
          only the current ones - see below - but the filter banner has to be
          able to name a former client whose projects somebody has just opened,
          and filtering here left it reading "one client".
        */
        setCompanies(clients.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
        setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [reloads, wantsNew]);

  /*
    Filtered here rather than re-fetched. The list is one page of the projects
    somebody is staffed on, tens, not thousands, and a round trip per
    keystroke is latency for nothing.

    `scoped` is what the URL narrowed to (a folder, a client); the figures are
    counted from it, so a folder's dashboard is that folder's. `visible` adds
    the open/all choice, which only the list below follows.
  */
  const scoped = useMemo(
    () =>
      (projects ?? []).filter((p) => {
        if (shelfFilter !== null && p.portfolio?.id !== shelfFilter) return false;
        if (companyFilter !== null && p.externalCompanyId !== companyFilter) return false;
        return true;
      }),
    [projects, shelfFilter, companyFilter],
  );

  const visible = useMemo(() => scoped.filter((p) => !openOnly || p.isOpen), [scoped, openOnly]);

  const figures = useMemo(() => {
    const open = scoped.filter((p) => p.isOpen);
    const overdue = open.filter((p) => p.isOverdue);
    const dueSoon = open.filter((p) => !p.isOverdue && p.daysToTarget !== null && p.daysToTarget <= 30);
    const clientIds = new Set(scoped.map((p) => p.externalCompanyId).filter((id): id is string => id !== null));
    const internal = scoped.filter((p) => !p.isBillable).length;
    const active = scoped.filter((p) => p.status === "active").length;

    const byStatus = LIFECYCLE_ORDER.map((s) => ({
      label: scoped.find((p) => p.status === s)?.statusLabel ?? s.replace("_", " ").replace(/^./, (c) => c.toUpperCase()),
      value: scoped.filter((p) => p.status === s).length,
      hue: STATUS[s].hue,
    }));

    /* The next six months of promised dates, this month first. */
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()] };
    });
    const due = months.map((m) => ({
      label: m.label,
      value: open.filter((p) => p.targetEndsOn?.slice(0, 7) === m.key).length,
    }));

    /* Where the open work sits: by folder when there are folders, else by client. */
    const shelfName = (p: Project) => p.portfolio?.name ?? "Unfiled";
    const clientName = (p: Project) => p.externalCompany?.name ?? (p.isBillable ? "No client set" : "Internal");
    const groupBy = portfolios.length > 0 ? shelfName : clientName;
    const buckets = new Map<string, number>();
    for (const p of open) buckets.set(groupBy(p), (buckets.get(groupBy(p)) ?? 0) + 1);
    const spread = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value, hue: hueFor(label) }));

    const attention = [
      ...overdue,
      ...open.filter((p) => p.status === "on_hold" && !p.isOverdue),
    ].slice(0, 5);

    return { open, overdue, dueSoon, clients: clientIds.size, internal, active, byStatus, due, spread, attention };
  }, [scoped, portfolios.length]);

  /*
    Presentation only: the same scoped projects, arranged for the landing
    panels (progress list, the next seven days, the team and the status
    board). Nothing here is fetched; it is the list above, sorted and grouped.
  */
  const layout = useMemo(() => {
    const open = scoped.filter((p) => p.isOpen);

    const progress = [...open]
      .sort((a, b) => (scheduleUsed(b) ?? -1) - (scheduleUsed(a) ?? -1))
      .slice(0, 6);

    const now = new Date();
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        key,
        day: d.getDate(),
        weekday: WEEKDAYS[d.getDay()],
        projects: open.filter((p) => p.targetEndsOn?.slice(0, 10) === key),
      };
    });
    const agenda = week.flatMap((d) => d.projects);

    const people = new Map<string, { member: ProjectMember; projects: number }>();
    for (const p of scoped) {
      for (const m of p.members ?? []) {
        const seen = people.get(m.userId);
        people.set(m.userId, { member: seen?.member ?? m, projects: (seen?.projects ?? 0) + 1 });
      }
    }
    const team = [...people.values()].sort((a, b) => b.projects - a.projects).slice(0, 6);

    const board = LIFECYCLE_ORDER.map((s) => ({ status: s, projects: scoped.filter((p) => p.status === s) })).filter(
      (c) => c.projects.length > 0,
    );

    return { progress, week, agenda, team, teamSize: people.size, board };
  }, [scoped]);

  const quickLinks: QuickAction[] = [
    { label: "My work", href: "/suite/projects/me", icon: ListTodo, hue: "blue" },
    { label: "Portfolios", href: "/suite/projects/portfolios", icon: FolderTree, hue: "grape" },
    { label: "External companies", href: "/suite/projects/companies", icon: Building2, hue: "sky" },
    { label: "My notifications", href: "/suite/projects/notifications", icon: BellRing, hue: "sun" },
    { label: "Rates", href: "/suite/projects/rates", icon: Wallet, hue: "mint" },
    { label: "Integrations", href: "/suite/projects/integrations", icon: Plug, hue: "coral" },
  ];

  const header = (
    <WelcomeBanner
      name={user?.name}
      eyebrow="Projects"
      art="projects"
      subtitle="Every project you are staffed on: what is moving, what is late and what is due next."
      figure={
        projects !== null && projects.length > 0
          ? { label: "Open projects", value: figures.open.length, hint: `${figures.active} active now` }
          : undefined
      }
      actions={
        <>
          <Link href="/suite/projects/me" className={bannerButtonClass("glass")}>
            <ListTodo size={17} aria-hidden />
            My work
          </Link>
          {/*
            Hidden rather than disabled. Starting a project needs a role
            most people do not hold, and a permanently greyed control reads as a
            fault in the software rather than a decision about who does what.
          */}
          {canCreate && (
            <button type="button" className={bannerButtonClass("solid")} onClick={() => setCreating(true)}>
              <Plus size={17} aria-hidden />
              New project
            </button>
          )}
        </>
      }
    />
  );

  if (projects === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {header}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[112px]" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 lg:col-span-2" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const shelfName = portfolios.find((p) => p.id === shelfFilter)?.name;

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      primary: true,
      sortable: true,
      value: (p) => p.name,
      render: (p) => <ProjectName project={p} />,
    },
    {
      key: "client",
      header: "Client",
      sortable: true,
      value: (p) => p.externalCompany?.name ?? (p.isBillable ? "" : "Internal"),
      render: (p) => <ClientChip project={p} />,
    },
    {
      key: "folder",
      header: "Folder",
      sortable: true,
      hideOnMobile: true,
      value: (p) => p.portfolio?.name ?? "",
      render: (p) =>
        p.portfolio ? (
          <span className="inline-flex items-center gap-1.5 text-neutral-700">
            <FolderTree size={13} className="text-neutral-400" aria-hidden />
            {p.portfolio.name}
          </span>
        ) : (
          <span className="text-neutral-500">Unfiled</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (p) => p.statusLabel,
      render: (p) => <StatusChip project={p} />,
    },
    {
      key: "schedule",
      header: "Schedule used",
      sortable: true,
      hideOnMobile: true,
      tableOnly: true,
      value: (p) => scheduleUsed(p) ?? -1,
      render: (p) => <ScheduleBar project={p} compact />,
    },
    {
      key: "people",
      header: "People",
      sortable: true,
      hideOnMobile: true,
      align: "right",
      value: (p) => p.memberCount ?? 0,
      render: (p) => <People project={p} />,
    },
    {
      key: "target",
      header: "Target",
      sortable: true,
      value: (p) => p.daysToTarget ?? Number.MAX_SAFE_INTEGER,
      render: (p) => <Deadline project={p} />,
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && <Notice>{error}</Notice>}

      {companyFilter !== null && (
        <Notice
          tone="info"
          action={
            <Link href="/suite/projects" className="text-sm font-semibold underline underline-offset-2">
              Show everything
            </Link>
          }
        >
          {/*
            Named, not "one company". A filter that does not say what it is
            filtering to is one somebody has to clear to find out.
          */}
          Showing work for{" "}
          <span className="font-semibold">
            {companies.find((c) => c.id === companyFilter)?.name ?? "one client"}
          </span>
        </Notice>
      )}

      {shelfFilter !== null && (
        <Notice
          tone="info"
          action={
            /* A filter with no way out is a page somebody thinks is broken. */
            <Link href="/suite/projects" className="text-sm font-semibold underline underline-offset-2">
              Show everything
            </Link>
          }
        >
          Showing one folder{shelfName ? <>: <span className="font-semibold">{shelfName}</span></> : null}
        </Notice>
      )}

      {projects.length === 0 ? (
        <>
          <QuickActions items={quickLinks} />
          <Panel>
            <Empty
              icon={Briefcase}
              title="You are not on any projects yet"
              hint="You see the projects you are staffed on. A project manager or delivery lead can add you to one."
              action={
                canCreate ? (
                  <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                    New project
                  </Button>
                ) : undefined
              }
            />
          </Panel>
        </>
      ) : (
        <>
          {/* ---------------------------- figures ------------------------ */}

          <StatGrid>
            <StatCard
              label="Open projects"
              value={figures.open.length}
              icon={FolderKanban}
              hue="blue"
              hint={`${figures.active} active now`}
            />
            <StatCard
              label="Past their target"
              value={figures.overdue.length}
              icon={AlertTriangle}
              hue="rose"
              hint={figures.overdue.length === 0 ? "Nothing overdue" : "Open and past the promised date"}
            />
            <StatCard
              label="Due in 30 days"
              value={figures.dueSoon.length}
              icon={CalendarClock}
              hue="sun"
              hint="Open, with a target in the next 30 days"
            />
            <StatCard
              label="Clients"
              value={figures.clients}
              icon={Building2}
              hue="grape"
              hint={plural(figures.internal, "internal project")}
              href="/suite/projects/companies"
            />
          </StatGrid>

          <QuickActions items={quickLinks} />

          {/* ------------------------ progress and status ------------------ */}

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Project progress"
              subtitle="How much of each open project's window has gone (time, not work)"
              icon={FolderKanban}
              hue="blue"
              actions={<ViewAllLink href="#projects-list-heading" />}
              bodyClassName="px-3 pb-4 pt-3"
            >
              {layout.progress.length === 0 ? (
                <Empty icon={FolderKanban} title="No open projects" hint="Closed projects are counted in the status ring." />
              ) : (
                <ul>
                  {layout.progress.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/suite/projects/${p.slug}`}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <ProjectTile project={p} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-neutral-900">{p.name}</span>
                            <ScheduleFigure project={p} />
                          </span>
                          <span className="mt-1.5 block">
                            <ScheduleBar project={p} compact fill />
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="By status" subtitle="Every project in view" icon={PieChart} hue="mint">
              <Donut
                data={figures.byStatus.filter((s) => s.value > 0)}
                total={scoped.length}
                centerLabel={scoped.length === 1 ? "project" : "projects"}
                caption="Projects by lifecycle status"
                legend="below"
                size={168}
              />
            </Panel>
          </div>

          {/* --------------------------- dates ahead ----------------------- */}

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Target dates ahead"
              subtitle="Open projects due in each of the next six months"
              icon={CalendarRange}
              hue="sky"
            >
              <ColumnChart
                data={figures.due}
                hue="blue"
                caption="Open projects by the month of their target date"
                format={(v) => plural(v, "project")}
              />
            </Panel>
            <Panel title="This week" subtitle="Target dates in the next seven days" icon={CalendarDays} hue="grape">
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
                        d.projects.length === 0 ? "bg-transparent" : i === 0 ? "bg-white" : "bg-primary-500",
                      )}
                    />
                    {d.projects.length > 0 && <span className="sr-only">{plural(d.projects.length, "target date")}</span>}
                  </li>
                ))}
              </ol>
              {layout.agenda.length === 0 ? (
                <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
                  No open project is due in the next seven days.
                </p>
              ) : (
                <ul className="mt-4 space-y-1">
                  {layout.agenda.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/suite/projects/${p.slug}`}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-1 py-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <DateLeaf value={p.targetEndsOn} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{p.name}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {p.externalCompany?.name ?? (p.isBillable ? "Client project" : "Internal")}
                          </span>
                        </span>
                        <StatusChip project={p} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* ------------------------ attention and team ------------------- */}

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              title="Needs attention"
              subtitle="Past their target, or on hold"
              icon={AlertTriangle}
              hue="coral"
              bodyClassName="px-2 pb-3 pt-2"
            >
              {figures.attention.length === 0 ? (
                <Empty
                  icon={CheckCircle2}
                  hue="mint"
                  title="Nothing is late or stalled"
                  hint="Every open project is inside its promised date."
                />
              ) : (
                <ul>
                  {figures.attention.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/suite/projects/${p.slug}`}
                        className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <ProjectTile project={p} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{p.name}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {p.externalCompany?.name ?? (p.isBillable ? "Client project" : "Internal")}
                          </span>
                        </span>
                        {p.isOverdue ? <Deadline project={p} /> : <StatusChip project={p} />}
                        <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title={portfolios.length > 0 ? "Open work by folder" : "Open work by client"}
              subtitle="Where the open projects sit"
              icon={portfolios.length > 0 ? FolderTree : Building2}
              hue="grape"
              actions={
                portfolios.length > 0 ? <ViewAllLink href="/suite/projects/portfolios">Portfolios</ViewAllLink> : undefined
              }
            >
              {figures.spread.length === 0 ? (
                <Empty icon={FolderTree} hue="grape" title="No open projects" hint="Closed projects are counted in the status ring." />
              ) : (
                <StatusBars
                  data={figures.spread}
                  format={(v) => plural(v, "project")}
                  caption={portfolios.length > 0 ? "Open projects by folder" : "Open projects by client"}
                />
              )}
            </Panel>
            <Panel
              title="Team"
              subtitle={
                layout.teamSize > 0 ? `${plural(layout.teamSize, "person", "people")} across these projects` : "Who you work with"
              }
              icon={Users}
              hue="sky"
              bodyClassName="px-3 pb-3 pt-2"
            >
              {layout.team.length === 0 ? (
                <Empty icon={Users} hue="sky" title="No team shown here" hint="Open a project to see who is on it." />
              ) : (
                <ul>
                  {layout.team.map(({ member, projects: count }) => (
                    <li key={member.userId} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2">
                      <NameAvatar name={member.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">
                          {member.name ?? member.email ?? "Unnamed"}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">{plural(count, "project")}</span>
                      </span>
                      <Chip hue={member.isYou ? "blue" : hueFor(member.roleLabel)}>
                        {member.isYou ? "You" : member.roleLabel}
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* ---------------------------- status board --------------------- */}

          <Panel
            title="Status board"
            subtitle="Every project in view, by lifecycle"
            icon={KanbanSquare}
            hue="blue"
            bodyClassName="px-5 pb-5 pt-4"
          >
            <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
              {layout.board.map((col) => {
                const meta = STATUS[col.status];
                const shown = col.projects.slice(0, 4);
                const rest = col.projects.length - shown.length;
                return (
                  <section
                    key={col.status}
                    aria-label={col.projects[0]?.statusLabel ?? col.status}
                    className={cx("flex w-64 shrink-0 flex-col rounded-2xl p-3 sm:w-72", COLUMN_BG[meta.hue])}
                  >
                    <header className="mb-3 flex items-center justify-between gap-2 px-1">
                      <span className={cx("inline-flex items-center gap-2 text-sm font-bold", HUE[meta.hue].text)}>
                        <meta.icon size={15} aria-hidden />
                        {col.projects[0]?.statusLabel}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-700 shadow-sm">
                        {col.projects.length}
                      </span>
                    </header>
                    <ul className="space-y-2.5">
                      {shown.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/suite/projects/${p.slug}`}
                            className="block rounded-xl bg-white p-3.5 shadow-sm outline-none ring-1 ring-neutral-200/60 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
                          >
                            <span className="flex items-start gap-2.5">
                              <ProjectTile project={p} size={30} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-neutral-900">{p.name}</span>
                                <span className="block truncate text-xs text-neutral-500">{p.code ?? p.slug}</span>
                              </span>
                            </span>
                            <span className="mt-3 flex flex-wrap items-center gap-1.5">
                              <ClientChip project={p} />
                            </span>
                            <span className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                              <Deadline project={p} />
                              <People project={p} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {rest > 0 && (
                      <p className="mt-2.5 px-1 text-xs font-medium text-neutral-500">
                        {plural(rest, "more project")} in the list below
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </Panel>

          {/* ---------------------------- the list ----------------------- */}

          <section aria-labelledby="projects-list-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="projects-list-heading" className="text-lg font-bold tracking-tight text-neutral-900">
                  All projects
                </h2>
                <p className="mt-0.5 text-sm text-neutral-500">Open one for its board, schedule, team and cost.</p>
              </div>
            </div>
            <DataView
              rows={visible}
              columns={columns}
              rowKey={(p) => p.id}
              rowHref={(p) => `/suite/projects/${p.slug}`}
              storageKey="projects.home"
              defaultView="grid"
              searchPlaceholder="Search by name or code…"
              matches={(p, q) =>
                p.name.toLowerCase().includes(q) ||
                (p.code ?? "").toLowerCase().includes(q) ||
                (p.externalCompany?.name ?? "").toLowerCase().includes(q)
              }
              caption="Your projects"
              toolbar={
                <Segmented
                  label="Which projects"
                  options={[
                    { key: "open", label: "Open only" },
                    { key: "all", label: "All" },
                  ]}
                  value={openOnly ? "open" : "all"}
                  onChange={(v) => setOpenOnly(v === "open")}
                />
              }
              empty={
                visible.length === 0 ? (
                  <Empty
                    icon={Briefcase}
                    title="Nothing matches that"
                    hint="Try part of the project name, or show all projects, not just open ones."
                  />
                ) : undefined
              }
              renderCard={(p) => <ProjectCard project={p} />}
              renderListItem={(p) => <ProjectListItem project={p} />}
            />
          </section>
        </>
      )}

      {creating && canCreate && (
        <NewProjectDialog
          portfolios={portfolios}
          /* Current clients only: offering a former one for new work is how a
             dead relationship gets reopened by a dropdown. */
          companies={companies.filter((c) => c.isActive)}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */

/** The project's colour, the same on every screen: its initials on its hue. */
function ProjectTile({ project, size = 40 }: { project: Project; size?: number }) {
  const hue = hueFor(project.name);
  const letters =
    project.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "P";
  return (
    <span
      aria-hidden
      className={cx("flex shrink-0 items-center justify-center rounded-xl font-bold", HUE[hue].tile)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {letters}
    </span>
  );
}

function ProjectName({ project }: { project: Project }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <ProjectTile project={project} size={34} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-neutral-900">{project.name}</span>
        <span className="block truncate text-xs font-normal text-neutral-500">{project.code ?? project.slug}</span>
      </span>
    </span>
  );
}

function StatusChip({ project }: { project: Project }) {
  const s = STATUS[project.status] ?? STATUS.planning;
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {project.statusLabel}
    </Chip>
  );
}

function ClientChip({ project }: { project: Project }) {
  if (project.externalCompany) {
    return (
      <Chip hue={hueFor(project.externalCompany.name)} icon={Building2}>
        {project.externalCompany.name}
      </Chip>
    );
  }
  return project.isBillable ? (
    <Chip hue="slate" icon={Briefcase}>
      Client not set
    </Chip>
  ) : (
    <Chip hue="slate">Internal</Chip>
  );
}

/** Faces when the API sent the roster; otherwise the headcount, never a guess. */
function People({ project }: { project: Project }) {
  if (project.members && project.members.length > 0) {
    return (
      <span className="inline-flex justify-end">
        <AvatarStack people={project.members.map((m) => ({ name: m.name }))} size={26} />
      </span>
    );
  }
  if (project.memberCount === undefined) return <span className="text-neutral-400">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-neutral-700">
      <Users size={14} className="text-neutral-400" aria-hidden />
      <span className="tabular-nums">{project.memberCount}</span>
      <span className="sr-only">{project.memberCount === 1 ? "person" : "people"}</span>
    </span>
  );
}

function ScheduleBar({
  project,
  compact = false,
  fill = false,
}: {
  project: Project;
  compact?: boolean;
  /** Stretch a compact bar across its row, for the progress list. */
  fill?: boolean;
}) {
  const used = scheduleUsed(project);
  if (used === null) {
    return <span className="text-xs text-neutral-500">{compact ? "No window set" : "No start and target dates yet"}</span>;
  }
  const hue: Hue = project.isOverdue ? "rose" : project.status === "complete" ? "mint" : hueFor(project.name);
  return (
    <div className={compact && !fill ? "w-32" : undefined}>
      <Progress
        value={used}
        hue={hue}
        size={compact ? "sm" : "md"}
        label={compact ? `Schedule used for ${project.name}` : "Schedule used"}
        showValue={!compact}
      />
    </div>
  );
}

/** The share of the window gone, as a figure beside the progress bar. */
function ScheduleFigure({ project }: { project: Project }) {
  const used = scheduleUsed(project);
  if (used === null) return null;
  return (
    <span className={cx("shrink-0 text-sm font-bold tabular-nums", project.isOverdue ? "text-error-700" : "text-neutral-900")}>
      {Math.round(used)}%
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

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <ProjectTile project={project} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-neutral-900">{project.name}</h3>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {project.code ?? project.slug}
            {project.viewerRole !== null && <> · {project.viewerRole.replace("_", " ")}</>}
          </p>
        </div>
        <StatusChip project={project} />
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-sm text-neutral-600">
        {project.description ? richExcerpt(project.description, 180) : "No description yet."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ClientChip project={project} />
        {project.portfolio && (
          <Chip hue="slate" icon={FolderTree}>
            {project.portfolio.name}
          </Chip>
        )}
      </div>

      <div className="mt-auto space-y-4">
        <ScheduleBar project={project} />
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3.5 text-xs">
          <People project={project} />
          <Deadline project={project} />
        </div>
      </div>
    </div>
  );
}

function ProjectListItem({ project }: { project: Project }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <ProjectTile project={project} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{project.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusChip project={project} />
          <ClientChip project={project} />
        </div>
      </div>
      <div className="hidden w-40 sm:block">
        <ScheduleBar project={project} compact />
      </div>
      <div className="hidden md:block">
        <People project={project} />
      </div>
      <div className="shrink-0 text-xs">
        <Deadline project={project} />
      </div>
    </div>
  );
}

/**
 * The promised date, and how it is going.
 *
 * `daysToTarget` is **null when nobody set a target**, which is a different
 * fact from a target that has passed, so this says "no target date" rather
 * than showing a zero that reads as "due today".
 */
function Deadline({ project }: { project: Project }) {
  if (project.targetEndsOn === null) {
    return <span className="text-xs text-neutral-500">No target date</span>;
  }

  const days = project.daysToTarget;

  return (
    <span
      title={fmtDate(project.targetEndsOn)}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        project.isOverdue
          ? "bg-error-500/10 text-error-700"
          : days !== null && days <= 14
            ? HUE.sun.soft
            : "bg-neutral-100 text-neutral-700",
      )}
    >
      <CalendarClock size={12} aria-hidden="true" />
      {project.isOverdue
        ? `${Math.abs(days ?? 0)} days over`
        : days === null
          ? "No target date"
          : `${days} days left`}
    </span>
  );
}
