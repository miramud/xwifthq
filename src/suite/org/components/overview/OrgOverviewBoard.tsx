"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  BellRing,
  BookOpen,
  Briefcase,
  Building,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock,
  FolderKanban,
  GraduationCap,
  ListTodo,
  Plane,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Progress, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { AreaLine, Legend, type LinePoint } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { formatCompact, formatDate, timeAgo } from "@/lib/console-data";
import { MODULE_LABEL, previewHref, type SuiteModuleKey } from "@/lib/module-access";
import {
  getOrgOverview,
  type HrmOverview,
  type LmsOverview,
  type OrgOverview,
  type OverviewWindow,
  type ProjectsOverview,
} from "@/lib/api/org-overview-client";
import {
  LoadError,
  PageSkeleton,
  SEVERITY_ORDER,
  SeverityIcon,
  naira,
  useLoad,
} from "@/suite/platform/components/ui";
import { auditActionLabel, auditActionSentence } from "../auditLabels";

/**
 * The organisation overview: what is happening across every module this
 * organisation has switched on, on one page.
 *
 * Laid out as a data-dense operations dashboard — the owner reads it to decide
 * where to look next, not to be impressed. Three rules shape it:
 *
 * - **The module strip comes first.** Which modules are live and which are
 *   previews is the frame for every number below it, so it is the first thing
 *   on the page and the one element in colour.
 * - **One section per live module, in the same shape**: four figures, the
 *   trend against its opposite (joiners against leavers, enrolments against
 *   completions), and the list that needs attention. The same shape three
 *   times is what makes the page scannable.
 * - **No invented figures.** A module that isn't live gets a preview card, not
 *   a zero-filled section that would read as "nothing happened".
 *
 * The window lives in the URL (`?window=90`), so a view can be shared.
 */

const WINDOWS: { key: string; label: string }[] = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

const MODULE_META: Record<SuiteModuleKey, { icon: LucideIcon; hue: Hue; href: string; blurb: string }> = {
  lms: { icon: GraduationCap, hue: "grape", href: "/suite/lms", blurb: "Courses, paths and compliance" },
  hrm: { icon: Users, hue: "coral", href: "/suite/hrm", blurb: "People, leave, payroll and hiring" },
  projects: { icon: FolderKanban, hue: "blue", href: "/suite/projects", blurb: "Boards, sprints and delivery" },
  finance: { icon: Wallet, hue: "sun", href: previewHref("finance"), blurb: "Ledger, receivables and budgets" },
  admin: { icon: Building, hue: "slate", href: previewHref("admin"), blurb: "Assets, approvals and policy" },
};

const MODULE_ORDER: SuiteModuleKey[] = ["lms", "hrm", "projects", "finance", "admin"];

export default function OrgOverviewBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const window: OverviewWindow = params.get("window") === "90" ? 90 : 30;

  const setWindow = (w: string) => {
    const next = new URLSearchParams(params.toString());
    if (w === "30") next.delete("window");
    else next.set("window", w);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const fetcher = useCallback(() => getOrgOverview(window), [window]);
  const { data, error, loading, reload } = useLoad(fetcher, "The overview didn't load.");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title={data?.organisation.name ?? "Overview"}
        subtitle={`Everything happening across your live modules, over the last ${window} days.`}
        actions={<Segmented label="Reporting window" options={WINDOWS} value={String(window)} onChange={setWindow} />}
      />

      {error && <LoadError message={error} onRetry={reload} />}

      {!data && loading && <PageSkeleton stats={4} rows={2} />}

      {data && (
        <div className={cx("space-y-6 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <ModuleStrip modules={data.modules} />
          <PeopleAndAlerts data={data} window={window} />
          {data.lms && <LmsSection lms={data.lms} window={window} />}
          {data.hrm && <HrmSection hrm={data.hrm} window={window} />}
          {data.projects && <ProjectsSection projects={data.projects} window={window} />}
          <PreviewModules modules={data.modules} />
          <ActivityFeed activity={data.activity} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Module strip                                                       */
/* ------------------------------------------------------------------ */

function ModuleStrip({ modules }: { modules: OrgOverview["modules"] }) {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const live = modules.filter((m) => m.status === "active").length;

  return (
    <section aria-labelledby="org-modules">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="org-modules" className="text-lg font-semibold text-neutral-900">
          Modules
        </h2>
        <p className="text-xs text-neutral-500">
          {live} of {MODULE_ORDER.length} live · the platform administrator activates modules
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MODULE_ORDER.map((key) => {
          const meta = MODULE_META[key];
          const m = byKey.get(key);
          const active = m?.status === "active";
          const Icon = meta.icon;
          return (
            <li key={key}>
              <Link
                href={active ? meta.href : previewHref(key)}
                className={cx(
                  "group flex h-full flex-col gap-3 rounded-2xl border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300",
                  active
                    ? "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
                    : "border-dashed border-neutral-300 bg-neutral-50/60 hover:bg-white",
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cx(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      active ? HUE[meta.hue].tile : "bg-neutral-100 text-neutral-400",
                    )}
                  >
                    <Icon size={19} aria-hidden />
                  </span>
                  {active ? (
                    <Chip hue="mint" dot>
                      Live
                    </Chip>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      <CircleDashed size={12} aria-hidden />
                      Preview
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className={cx("block text-sm font-semibold", active ? "text-neutral-900" : "text-neutral-600")}>
                    {m?.label ?? key.toUpperCase()}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{meta.blurb}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  People + alerts                                                    */
/* ------------------------------------------------------------------ */

function PeopleAndAlerts({ data, window }: { data: OrgOverview; window: OverviewWindow }) {
  const { people } = data;
  const activeShare = people.users > 0 ? Math.round((people.activeLast30Days / people.users) * 100) : 0;
  const alerts = [...data.alerts].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section aria-labelledby="org-people" className="xl:col-span-2">
        <SectionHead id="org-people" icon={Users} hue="sun" title="People" href="/suite/org/users" hrefLabel="User management" />
        <StatGrid cols={2}>
          <StatCard
            featured
            hue="sun"
            label="Users"
            value={formatCompact(people.users)}
            icon={Users}
            hint={`${people.admins} admin${people.admins === 1 ? "" : "s"}${people.invited > 0 ? ` · ${people.invited} invited` : ""}`}
            href="/suite/org/users"
          />
          <StatCard
            label="Active in the last 30 days"
            value={formatCompact(people.activeLast30Days)}
            icon={UserCheck}
            hint={`${activeShare}% of everyone who can sign in`}
          />
          <StatCard
            label={`New in the last ${window} days`}
            value={formatCompact(people.newThisPeriod)}
            icon={UserPlus}
            href="/suite/org/users?sort=-createdAt"
          />
          <StatCard
            label="Seats in use"
            value={formatCompact(people.seatsUsed)}
            unit={people.seatsTotal !== null ? `of ${formatCompact(people.seatsTotal)}` : undefined}
            icon={Award}
            hint={people.seatsTotal === null ? "No seat limit on this licence" : undefined}
            href="/suite/org/seats"
          />
        </StatGrid>
      </section>

      <Panel
        title="Needs attention"
        subtitle={alerts.length === 0 ? "Nothing flagged right now" : `${alerts.length} flagged, most urgent first`}
        icon={BellRing}
        hue="coral"
        bodyClassName="p-0"
      >
        {alerts.length === 0 ? (
          <Empty icon={CheckCircle2} hue="mint" title="All clear." hint="When a module needs a decision from you, it appears here." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={`${a.module}-${i}`} className="flex items-start gap-3 px-5 py-3.5">
                <SeverityIcon severity={a.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-neutral-800">{a.message}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{a.module === "core" ? "Organisation" : MODULE_LABEL[a.module]}</p>
                </div>
                {a.href && (
                  <Link
                    href={a.href}
                    aria-label={`Open: ${a.message}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Module sections                                                    */
/* ------------------------------------------------------------------ */

function LmsSection({ lms, window }: { lms: LmsOverview; window: OverviewWindow }) {
  return (
    <section aria-labelledby="org-lms" className="space-y-4">
      <SectionHead id="org-lms" icon={GraduationCap} hue="grape" title="Learning" href="/suite/lms" hrefLabel="Open Learning" />
      <StatGrid>
        <StatCard
          label="Learners"
          value={formatCompact(lms.learners)}
          icon={Users}
          hint={`${formatCompact(lms.enrolments)} enrolments`}
          href="/suite/lms/progress"
        />
        <StatCard label="Completion rate" value={`${Math.round(lms.completionRate)}%`} icon={CheckCircle2} hint={`Average progress ${Math.round(lms.averageProgress)}%`} />
        <StatCard
          label="Courses published"
          value={formatCompact(lms.published)}
          unit={`of ${formatCompact(lms.courses)}`}
          icon={BookOpen}
          href="/suite/lms/courses"
        />
        <StatCard
          label="Certificates issued"
          value={formatCompact(lms.certificatesIssued)}
          icon={Award}
          hint={lms.overdueMandatory > 0 ? `${lms.overdueMandatory} mandatory course${lms.overdueMandatory === 1 ? "" : "s"} overdue` : "No mandatory courses overdue"}
          href={lms.overdueMandatory > 0 ? "/suite/lms/compliance" : "/suite/lms/certificates"}
        />
      </StatGrid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendPanel
          className="lg:col-span-2"
          title="Enrolments and completions"
          window={window}
          hue="grape"
          series={lms.series}
          primary={{ key: "enrolments", label: "Enrolments" }}
          secondary={{ key: "completions", label: "Completions" }}
        />
        <Panel title="Top courses" subtitle="By learners on them" icon={TrendingUp} hue="grape" bodyClassName="p-0">
          {lms.topCourses.length === 0 ? (
            <Empty icon={BookOpen} hue="grape" title="No learners on any course yet." hint="Assign a course to see it here." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {lms.topCourses.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/suite/lms/courses/${encodeURIComponent(c.slug)}?tab=learners`}
                    className="block px-5 py-3 outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-neutral-900">{c.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">{formatCompact(c.learners)} learners</span>
                    </span>
                    <span className="mt-2 flex items-center gap-3">
                      <Progress value={c.completionRate} hue="grape" />
                      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700">
                        {Math.round(c.completionRate)}%
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function HrmSection({ hrm, window }: { hrm: HrmOverview; window: OverviewWindow }) {
  const payroll = hrm.lastPayrollRun;
  return (
    <section aria-labelledby="org-hrm" className="space-y-4">
      <SectionHead id="org-hrm" icon={Users} hue="coral" title="HR" href="/suite/hrm" hrefLabel="Open HR" />
      <StatGrid>
        <StatCard label="Headcount" value={formatCompact(hrm.headcount)} icon={Users} href="/suite/hrm/people" />
        <StatCard label="On leave today" value={formatCompact(hrm.onLeaveToday)} icon={Plane} hint={`${hrm.pendingLeave} request${hrm.pendingLeave === 1 ? "" : "s"} waiting`} href="/suite/hrm/leave" />
        <StatCard label="Open requisitions" value={formatCompact(hrm.openRequisitions)} icon={Briefcase} href="/suite/hrm/recruitment" />
        <StatCard
          label="Probation ending soon"
          value={formatCompact(hrm.probationEndingSoon)}
          icon={CalendarClock}
          hint="Within the next 30 days"
          href="/suite/hrm/probation"
        />
      </StatGrid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendPanel
          className="lg:col-span-2"
          title="Joiners and leavers"
          window={window}
          hue="coral"
          series={hrm.series}
          primary={{ key: "joiners", label: "Joiners" }}
          secondary={{ key: "leavers", label: "Leavers" }}
        />
        <Panel title="Last payroll run" icon={Wallet} hue="coral">
          {payroll ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{payroll.period}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{naira(payroll.netKobo)}</p>
              <p className="mt-0.5 text-xs text-neutral-500">Net pay</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Chip hue={payroll.status === "released" || payroll.status === "paid" ? "mint" : "sun"} dot>
                  {payroll.status.charAt(0).toUpperCase() + payroll.status.slice(1)}
                </Chip>
                <Link href="/suite/hrm/payroll" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline">
                  Payroll
                  <ArrowUpRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <Empty icon={Wallet} hue="coral" title="No payroll run yet." hint="Your first run will show here once it's approved." />
          )}
        </Panel>
      </div>
    </section>
  );
}

function ProjectsSection({ projects, window }: { projects: ProjectsOverview; window: OverviewWindow }) {
  return (
    <section aria-labelledby="org-projects" className="space-y-4">
      <SectionHead id="org-projects" icon={FolderKanban} hue="blue" title="Projects" href="/suite/projects" hrefLabel="Open Projects" />
      <StatGrid>
        <StatCard label="Active projects" value={formatCompact(projects.activeProjects)} icon={FolderKanban} href="/suite/projects" />
        <StatCard
          label="Open work items"
          value={formatCompact(projects.openItems)}
          icon={ListTodo}
          hint={projects.overdueItems > 0 ? `${projects.overdueItems} overdue` : "Nothing overdue"}
        />
        <StatCard label={`Completed in ${window} days`} value={formatCompact(projects.completedThisPeriod)} icon={CheckCircle2} />
        <StatCard label="Hours logged" value={formatCompact(Math.round(projects.hoursLogged))} icon={Clock} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendPanel
          className="lg:col-span-2"
          title="Work created and completed"
          window={window}
          hue="blue"
          series={projects.series}
          primary={{ key: "created", label: "Created" }}
          secondary={{ key: "completed", label: "Completed" }}
        />
        <Panel title="At risk" subtitle="Projects that need a look" icon={BellRing} hue="blue" bodyClassName="p-0">
          {projects.atRisk.length === 0 ? (
            <Empty icon={CheckCircle2} hue="mint" title="Nothing at risk." hint="Projects slipping on dates or overdue work show up here." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {projects.atRisk.slice(0, 5).map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/suite/projects/${encodeURIComponent(p.slug)}`}
                    className="block px-5 py-3 outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50"
                  >
                    <span className="block truncate text-sm font-medium text-neutral-900">{p.name}</span>
                    <span className="mt-0.5 block text-xs text-error-700">{p.reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Trend panel                                                        */
/* ------------------------------------------------------------------ */

type SeriesRow = { date: string };

const value = (row: SeriesRow, key: string) => Number((row as Record<string, unknown>)[key] ?? 0);

/**
 * One series against its opposite, solid against dashed so the two read apart
 * without colour. Fewer than four points isn't a trend, so it shows the two
 * totals instead of a line that would imply one; a table of the same figures
 * is always there for screen readers.
 */
function TrendPanel({
  title,
  window,
  hue,
  series,
  primary,
  secondary,
  className,
}: {
  title: string;
  window: OverviewWindow;
  hue: Hue;
  series: readonly SeriesRow[];
  primary: { key: string; label: string };
  secondary: { key: string; label: string };
  className?: string;
}) {
  const a: LinePoint[] = useMemo(
    () => series.map((r) => ({ label: formatDate(r.date), value: value(r, primary.key) })),
    [series, primary.key],
  );
  const b: LinePoint[] = useMemo(
    () => series.map((r) => ({ label: formatDate(r.date), value: value(r, secondary.key) })),
    [series, secondary.key],
  );
  const totalA = a.reduce((n, p) => n + p.value, 0);
  const totalB = b.reduce((n, p) => n + p.value, 0);

  return (
    <Panel
      title={title}
      subtitle={`Last ${window} days · ${formatCompact(totalA)} ${primary.label.toLowerCase()}, ${formatCompact(totalB)} ${secondary.label.toLowerCase()}`}
      icon={Activity}
      hue={hue}
      className={className}
      actions={<Legend items={[{ label: primary.label, hue }, { label: secondary.label, hue: "slate", dashed: true }]} />}
    >
      {series.length >= 4 ? (
        <AreaLine
          data={a}
          compare={b}
          hue={hue}
          caption={`${title} over the last ${window} days`}
          format={(v) => formatCompact(v)}
        />
      ) : series.length === 0 || totalA + totalB === 0 ? (
        <Empty icon={Activity} hue={hue} title="Nothing in this window yet." hint="Activity shows here as it happens." />
      ) : (
        <div className="grid grid-cols-2 gap-4 py-4 text-center">
          <div>
            <p className="text-3xl font-bold tabular-nums text-neutral-900">{formatCompact(totalA)}</p>
            <p className="text-xs text-neutral-500">{primary.label}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums text-neutral-900">{formatCompact(totalB)}</p>
            <p className="text-xs text-neutral-500">{secondary.label}</p>
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{primary.label}</th>
            <th scope="col">{secondary.label}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((r) => (
            <tr key={r.date}>
              <th scope="row">{formatDate(r.date)}</th>
              <td>{value(r, primary.key)}</td>
              <td>{value(r, secondary.key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Previews + activity                                                */
/* ------------------------------------------------------------------ */

function PreviewModules({ modules }: { modules: OrgOverview["modules"] }) {
  const previews = MODULE_ORDER.filter((k) => modules.find((m) => m.key === k)?.status !== "active");
  if (previews.length === 0) return null;

  return (
    <section aria-labelledby="org-previews">
      <h2 id="org-previews" className="mb-1 text-lg font-semibold text-neutral-900">
        Not switched on
      </h2>
      <p className="mb-4 text-sm text-neutral-500">
        These modules are previews for everyone here. Your platform administrator activates them.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {previews.map((key) => {
          const meta = MODULE_META[key];
          const Icon = meta.icon;
          const label = modules.find((m) => m.key === key)?.label ?? key;
          return (
            <li key={key}>
              <Card className="flex h-full items-center gap-4 border-dashed p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-900">{label}</span>
                  <span className="block truncate text-xs text-neutral-500">{meta.blurb}</span>
                </span>
                <Link
                  href={previewHref(key)}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[13px] font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  See preview
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivityFeed({ activity }: { activity: OrgOverview["activity"] }) {
  return (
    <Panel title="Recent activity" subtitle="Across every live module" icon={Activity} hue="slate" bodyClassName="p-0">
      {activity.length === 0 ? (
        <Empty icon={Activity} hue="slate" title="No activity yet." hint="Sign-ins, enrolments, approvals and changes will appear here." />
      ) : (
        <ol className="divide-y divide-neutral-100">
          {activity.slice(0, 12).map((a, i) => {
            const meta = a.module === "core" ? null : MODULE_META[a.module];
            const Icon = meta?.icon ?? Activity;
            return (
              <li key={`${a.at}-${i}`} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    meta ? HUE[meta.hue].soft : HUE.slate.soft,
                  )}
                  aria-hidden
                >
                  <Icon size={15} />
                </span>
                <p className="min-w-0 flex-1 text-sm leading-snug text-neutral-700">
                  {a.actor && <span className="font-semibold text-neutral-900">{a.actor.name} </span>}
                  {a.actor ? auditActionLabel(a.action) : auditActionSentence(a.action)}
                  {a.subject && <span className="font-medium text-neutral-900"> {a.subject}</span>}
                </p>
                <time dateTime={a.at} title={formatDate(a.at)} className="shrink-0 text-xs text-neutral-500">
                  {timeAgo(a.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function SectionHead({
  id,
  icon: Icon,
  hue,
  title,
  href,
  hrefLabel,
}: {
  id: string;
  icon: LucideIcon;
  hue: Hue;
  title: string;
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2.5 text-lg font-semibold text-neutral-900">
        <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", HUE[hue].tile)} aria-hidden>
          <Icon size={16} />
        </span>
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
      >
        {hrefLabel}
        <ArrowUpRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
