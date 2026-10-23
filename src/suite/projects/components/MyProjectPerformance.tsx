"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bug,
  BugOff,
  CheckCircle2,
  Clock,
  Info,
  ListChecks,
  ListTodo,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Chip, Panel, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { ColumnChart, Donut, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import {
  ApiError,
  performance as performanceApi,
  type MemberFigures,
  type MemberPerformance,
  type MemberPerformanceMeta,
  type Project,
  type SprintState,
} from "@/lib/api/projects-client";
import { HUE } from "@/components/workspace/modules";
import { hours } from "./money";
import { MiniStat, Notice, SectionHeading, Skeleton, TYPE_META, TYPE_ORDER, fmtRange, plural } from "./ui/pkit";

/**
 * The signed-in person's own figures on this project.
 *
 * **Always the caller's, and only ever theirs.** There is no parameter for
 * anybody else (PROJECTS_MODULE § 3.7): a colleague's reopen count is a thing
 * to talk to them about, not a column to sort a team by.
 *
 * **Counts, never a score.** Every figure is printed with the number it is
 * out of — "2 of 9 tasks" — and never as a percentage or a rating. A rate
 * over nine tasks is noise dressed up as a judgement, and a count with its
 * denominator is the thing somebody can actually reflect on.
 *
 * Refused (403) or missing (404) means "nothing to show you here", so the
 * section simply is not drawn; anything else says it failed.
 */

type Metric = "tasks" | "bugs" | "hours";

/** One row of the sprint table: a sprint, or the work done straight off the backlog. */
interface SprintRow extends MemberFigures {
  id: string;
  label: string;
  sequence: number | null;
  status: SprintState | null;
  range: string | null;
  logged: number | null;
  estimatedDelivered: number;
  estimatedItems: number;
  finishedItems: number;
}

const STATE_CHIP: Record<SprintState, { label: string; hue: "blue" | "mint" | "slate" }> = {
  active: { label: "Running", hue: "blue" },
  closed: { label: "Closed", hue: "mint" },
  planning: { label: "Planning", hue: "slate" },
};

export default function MyProjectPerformance({ project }: { project: Project }) {
  const [data, setData] = useState<MemberPerformance | null>(null);
  const [meta, setMeta] = useState<MemberPerformanceMeta | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("tasks");

  useEffect(() => {
    let cancelled = false;

    performanceApi
      .mine(project.slug)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setHidden(true);
          return;
        }
        setError(e instanceof ApiError ? e.message : "Your figures did not load.");
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug]);

  const rows = useMemo<SprintRow[]>(() => {
    if (data === null) return [];

    const sprintRows: SprintRow[] = data.sprints.map((s) => ({
      id: s.id,
      label: s.name,
      sequence: s.sequence,
      status: s.status,
      range: fmtRange(s.startsOn, s.endsOn),
      tasks: s.tasks,
      bugs: s.bugs,
      logged: s.hours.logged,
      estimatedDelivered: s.hours.estimatedDelivered,
      estimatedItems: s.hours.estimatedItems,
      finishedItems: s.hours.finishedItems,
    }));

    /* Backlog work is shown only when there is some: an all-zero row is noise. */
    const o = data.outsideSprints;
    if (o.tasks.completed + o.bugs.fixed + o.hours.finishedItems > 0) {
      sprintRows.push({
        id: "outside-sprints",
        label: "Outside sprints",
        sequence: null,
        status: null,
        range: null,
        tasks: o.tasks,
        bugs: o.bugs,
        /* Logged hours are attributed by day, and backlog work has no days of its own. */
        logged: null,
        estimatedDelivered: o.hours.estimatedDelivered,
        estimatedItems: o.hours.estimatedItems,
        finishedItems: o.hours.finishedItems,
      });
    }

    return sprintRows;
  }, [data]);

  if (hidden) return null;

  const define = (key: string): string | undefined => meta?.definitions[key];

  const heading = (
    <SectionHeading
      title="My performance"
      hint="Your own figures on this project. Counts with what they are out of, never a score, and nobody else sees them."
      actions={
        data !== null ? (
          <Chip hue="slate" icon={UserRound}>
            {data.person.name}
          </Chip>
        ) : undefined
      }
    />
  );

  if (data === null) {
    return (
      <section aria-label="My performance" className="pt-2">
        {heading}
        {error !== null ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[124px]" />
            ))}
          </div>
        )}
      </section>
    );
  }

  const { tasks, bugs, open } = data;
  const clean = Math.max(0, tasks.completed - tasks.withBugsRaised);

  /* ------------------------------ charts ------------------------------ */

  const chartRows = rows.filter((r) => metric !== "hours" || r.logged !== null);
  const chartData = chartRows.map((r) => ({
    label: r.sequence === null ? "Backlog" : `S${r.sequence}`,
    value: metric === "tasks" ? r.tasks.completed : metric === "bugs" ? r.bugs.fixed : (r.logged ?? 0),
    /* Hours logged sit inside the estimate delivered, when that is the larger. */
    ...(metric === "hours" ? { max: Math.max(r.logged ?? 0, r.estimatedDelivered) } : {}),
  }));
  const chartHue = metric === "tasks" ? "blue" : metric === "bugs" ? "grape" : "sky";
  const chartCaption =
    metric === "tasks"
      ? "Tasks you completed, per sprint"
      : metric === "bugs"
        ? "Bugs you fixed, per sprint"
        : "Hours you logged, per sprint, inside the estimate you delivered";

  const openSlices = TYPE_ORDER.map((type) => ({
    label: TYPE_META[type].label,
    value: open.byType[type] ?? 0,
    hue: TYPE_META[type].hue,
  })).filter((s) => s.value > 0);

  /* ------------------------------ table ------------------------------- */

  const columns: Column<SprintRow>[] = [
    {
      key: "sprint",
      header: "Sprint",
      primary: true,
      sortable: true,
      value: (r) => r.sequence ?? Number.MAX_SAFE_INTEGER,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 font-semibold text-neutral-900">
            {r.label}
            {r.status !== null && (
              <Chip hue={STATE_CHIP[r.status].hue} className="!px-2 !py-0.5 text-[11px]">
                {STATE_CHIP[r.status].label}
              </Chip>
            )}
          </span>
          {r.range !== null && <span className="text-xs text-neutral-500">{r.range}</span>}
        </span>
      ),
    },
    { key: "completed", header: "Tasks completed", align: "right", sortable: true, value: (r) => r.tasks.completed },
    {
      key: "reopened",
      header: "Reopened",
      align: "right",
      sortable: true,
      value: (r) => r.tasks.reopened,
      render: (r) => <OutOf n={r.tasks.reopened} of={r.tasks.completed} />,
    },
    {
      key: "withBugs",
      header: "With bugs raised",
      align: "right",
      sortable: true,
      value: (r) => r.tasks.withBugsRaised,
      render: (r) => <OutOf n={r.tasks.withBugsRaised} of={r.tasks.completed} />,
    },
    { key: "bugsRaised", header: "Bugs raised", align: "right", sortable: true, value: (r) => r.tasks.bugsRaised, hideOnMobile: true },
    { key: "bugsFixed", header: "Bugs fixed", align: "right", sortable: true, value: (r) => r.bugs.fixed },
    {
      key: "logged",
      header: "Logged",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.logged,
      render: (r) => (r.logged === null ? <span className="text-neutral-400">-</span> : hours(r.logged)),
    },
    {
      key: "estimated",
      header: "Estimate delivered",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.estimatedDelivered,
      render: (r) => (
        <span className="flex flex-col items-end">
          <span>{hours(r.estimatedDelivered)}</span>
          <span className="text-[11px] text-neutral-500">
            {r.estimatedItems} of {plural(r.finishedItems, "item")} estimated
          </span>
        </span>
      ),
    },
  ];

  return (
    <section aria-label="My performance" className="space-y-6 pt-2">
      {heading}

      {/* ----------------------------- stat row ---------------------------- */}

      <StatGrid>
        <Defined text={define("tasks.completed")}>
          <StatCard
            featured
            icon={ListChecks}
            label="Tasks completed"
            value={tasks.completed}
            hint={`${clean} with no bug raised against them`}
          />
        </Defined>
        <Defined text={define("bugs.fixed")}>
          <StatCard icon={BugOff} hue="grape" label="Bugs fixed" value={bugs.fixed} hint="Bugs assigned to you, finished" />
        </Defined>
        <Defined text={define("tasks.withBugsRaised")}>
          <StatCard
            icon={Bug}
            hue="coral"
            label="Bugs raised against my work"
            value={tasks.bugsRaised}
            hint={`Across ${tasks.withBugsRaised} of ${plural(tasks.completed, "task")}`}
          />
        </Defined>
        <Defined text={define("open.assigned")}>
          <StatCard
            icon={ListTodo}
            hue="sky"
            label="Open and assigned"
            value={open.assigned}
            hint={open.blocked > 0 ? `${open.blocked} blocked` : "None blocked"}
          />
        </Defined>
      </StatGrid>

      {/* ------------------------ hero + quality -------------------------- */}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Sprint by sprint"
          subtitle={chartCaption}
          icon={BarChart3}
          actions={
            <Segmented<Metric>
              label="Figure to chart"
              value={metric}
              onChange={setMetric}
              options={[
                { key: "tasks", label: "Tasks" },
                { key: "bugs", label: "Bugs fixed" },
                { key: "hours", label: "Hours" },
              ]}
            />
          }
        >
          {chartData.length === 0 ? (
            <p className="py-14 text-center text-sm text-neutral-500">
              No sprint has been planned on this project yet.
            </p>
          ) : (
            <div className="pt-8">
              <ColumnChart
                data={chartData}
                hue={chartHue}
                height={200}
                highlight="last"
                caption={chartCaption}
                format={metric === "hours" ? hours : (v) => String(v)}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Finished tasks"
          subtitle={`Out of the ${plural(tasks.completed, "task")} you completed`}
          icon={ShieldCheck}
          hue="mint"
        >
          {tasks.completed === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              Nothing finished yet. Completed tasks are counted here as they close.
            </p>
          ) : (
            <StatusBars
              caption="Your completed tasks, and how many went back or had bugs raised"
              data={[
                { label: "Completed", value: tasks.completed, hue: "blue" },
                { label: "No bug raised", value: clean, hue: "mint", note: `of ${tasks.completed}` },
                { label: "Reopened", value: tasks.reopened, hue: "sun", note: `of ${tasks.completed}` },
                { label: "Had bugs raised", value: tasks.withBugsRaised, hue: "coral", note: `of ${tasks.completed}` },
              ]}
            />
          )}
          {tasks.bounceBacks > 0 && (
            <p className="mt-4 text-xs text-neutral-500">
              {plural(tasks.bounceBacks, "backward move")} across the reopened tasks.
            </p>
          )}
        </Panel>
      </div>

      {/* -------------------------- open + hours -------------------------- */}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="On my plate"
          subtitle={define("open.assigned") ?? "Unfinished items assigned to you now"}
          icon={ListTodo}
          hue="sky"
          actions={
            open.blocked > 0 ? (
              <Chip hue="coral" dot>
                {open.blocked} blocked
              </Chip>
            ) : undefined
          }
        >
          {open.assigned === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Nothing open is assigned to you.</p>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              {/*
                The ring's own legend prints each slice's share; this one prints
                the count, because that is what somebody plans their week with.
              */}
              <Donut
                data={openSlices}
                total={open.assigned}
                centerLabel="open"
                size={168}
                legend="none"
                caption="Your open items by type"
              />
              <ul className="w-full min-w-0 flex-1 space-y-2.5">
                {openSlices.map((s) => {
                  const Icon = TYPE_META[TYPE_ORDER.find((t) => TYPE_META[t].label === s.label) ?? "task"].icon;
                  return (
                    <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", HUE[s.hue].soft)}>
                          <Icon size={14} aria-hidden />
                        </span>
                        <span className="truncate text-neutral-700">{s.label}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-neutral-900">{s.value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Time" subtitle="Hours logged beside the estimate you delivered" icon={Clock} hue="grape">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Logged on this project"
              value={hours(data.hours.logged)}
              hint={define("hours.logged")}
              hue="grape"
            />
            <MiniStat
              label="Estimate delivered"
              value={hours(data.hours.estimatedDelivered)}
              hint={`On ${data.hours.estimatedItems} of ${plural(data.hours.finishedItems, "finished item")}`}
              hue="sky"
            />
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-neutral-600">Finished items carrying an estimate</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {data.hours.estimatedItems} of {data.hours.finishedItems}
              </span>
            </div>
            <CountBar n={data.hours.estimatedItems} of={data.hours.finishedItems} />
            <p className="mt-2 text-[11px] leading-snug text-neutral-500">
              The unestimated ones are not counted as zero. They are simply outside the estimate.
            </p>
          </div>
        </Panel>
      </div>

      {/* ---------------------------- the figures -------------------------- */}

      <Panel title="My figures by sprint" icon={CheckCircle2} hue="mint" bodyClassName="p-5 pt-4">
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="projects.myPerformance.sprints"
          caption="Your figures per sprint on this project"
          searchable={false}
          gridCols={3}
          empty={
            <p className="py-10 text-center text-sm text-neutral-500">
              No sprint has been planned on this project yet.
            </p>
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{r.label}</p>
                  {r.range !== null && <p className="text-xs text-neutral-500">{r.range}</p>}
                </div>
                {r.status !== null && <Chip hue={STATE_CHIP[r.status].hue}>{STATE_CHIP[r.status].label}</Chip>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Tasks completed" value={r.tasks.completed} hue="blue" />
                <MiniStat label="Bugs fixed" value={r.bugs.fixed} hue="grape" />
              </div>
              <p className="text-xs text-neutral-600">
                {r.tasks.reopened} of {r.tasks.completed} reopened · {r.tasks.withBugsRaised} of{" "}
                {r.tasks.completed} with bugs raised
              </p>
            </div>
          )}
        />
      </Panel>

      {meta !== null && Object.keys(meta.definitions).length > 0 && (
        <details className="group rounded-2xl border border-neutral-200 bg-white px-5 py-3.5 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-neutral-800">
            <Info size={15} className="text-primary-600" aria-hidden />
            How these are counted
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {Object.entries(meta.definitions).map(([key, text]) => (
              <div key={key}>
                <dt className="font-mono text-[11px] font-semibold text-neutral-500">{key}</dt>
                <dd className="text-[13px] text-neutral-700">{text}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** The API's own definition of a figure, as a tooltip on its card. */
function Defined({ text, children }: { text: string | undefined; children: React.ReactNode }) {
  return (
    <div title={text} className="h-full">
      {children}
    </div>
  );
}

/** "2 of 9" — a count and what it is out of, never a rate. */
function OutOf({ n, of }: { n: number; of: number }) {
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-neutral-900">{n}</span>
      <span className="text-neutral-500"> of {of}</span>
    </span>
  );
}

/**
 * A count against its total as a hatched bar. Deliberately not the kit's
 * `Progress`, which announces a percentage — the words beside it say "3 of 5".
 */
function CountBar({ n, of }: { n: number; of: number }) {
  const width = of > 0 ? Math.min(100, (n / of) * 100) : 0;
  return (
    <div className="ws-hatch h-2.5 overflow-hidden rounded-full" aria-hidden>
      <div className={cx("h-full rounded-full bg-sky-500")} style={{ width: `${width}%` }} />
    </div>
  );
}
