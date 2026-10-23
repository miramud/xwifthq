"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CircleHelp,
  Clock,
  GanttChartSquare,
  GitBranch,
  Info,
  PieChart,
  Repeat,
  Route,
  Timer,
} from "lucide-react";
import { Card, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { Donut } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import {
  ApiError,
  schedule as scheduleApi,
  type Project,
  type Schedule,
  type ScheduleItem,
} from "@/lib/api/projects-client";
import GanttChart from "./GanttChart";
import { ItemRef, MiniStat, Notice, Skeleton } from "./ui/pkit";

/**
 * Which work actually decides when this project finishes.
 *
 * **The point of this screen is the slack, not the bars.** A Gantt chart is a
 * picture of dates; a critical path is the answer to "what happens if this one
 * slips", and the two look similar enough that the first is usually shipped
 * instead of the second. Every row here says how many days it can lose before
 * the end date moves — and the rows that can lose none are the path.
 *
 * **Dates now, but still derived on every read.** Sprint 7 showed day offsets
 * because nothing anchored them; a start date and a working calendar do, so
 * the dates are real — and still stored nowhere, because one written to a
 * column outlives the estimate that produced it. The calendar strip says what
 * the dates allow for: whether holidays were counted, and whether there is a
 * real start date underneath them or today standing in for one.
 *
 * **Unestimated work is drawn as a gap, not as a day.** An item with no
 * estimate has no duration here, is counted in the coverage line, and is
 * marked on its own row. The alternative — a nominal day each — produces a
 * path that looks authoritative and is partly invented, which is the lie the
 * forecast already refuses to tell.
 *
 * **A loop is a named refusal.** "These items depend on each other in a
 * circle" is a different situation from "there is nothing to schedule", with a
 * different remedy, and this screen never renders them the same way.
 */
export default function SchedulePanel({
  project,
  refreshKey = 0,
  onOpenItem,
}: {
  project: Project;
  /** Bumped when a dependency changes elsewhere. */
  refreshKey?: number;
  onOpenItem?: (itemId: string) => void;
}) {
  const [data, setData] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  /**
   * The list reads; the chart shows shape.
   *
   * The list is the default because it is the one that answers a question —
   * what can slip, and by how long. A Gantt is what people ask for and the
   * list is what they act on, so both are here and the list is first.
   */
  const [view, setView] = useState<"list" | "chart">("list");

  useEffect(() => {
    let live = true;

    setLoading(true);

    scheduleApi
      .forProject(project.slug)
      .then((result) => {
        if (!live) return;

        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not work out the schedule.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [project.slug, refreshKey]);

  const rows = useMemo(() => {
    if (data === null) return [];

    const visible = criticalOnly ? data.items.filter((item) => item.isCritical) : data.items;

    /*
     * By earliest start, then by the longest first within a day, so the chart
     * reads top-left to bottom-right the way a plan is read. The server's
     * order is topological and stable, which is right for correctness and
     * wrong for looking at.
     */
    return [...visible].sort(
      (a, b) => a.earliestStart - b.earliestStart || b.durationDays - a.durationDays,
    );
  }, [data, criticalOnly]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <p className="text-sm font-medium text-neutral-500">Working out the critical path…</p>
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (error !== null) {
    return <Notice tone="error" title="Schedule">{error}</Notice>;
  }

  if (data === null) return null;

  /* A loop. Named, with the items in it, because that is the remedy. */
  if (!data.schedulable && data.reason === "cycle") {
    return (
      <Panel title="Schedule" icon={Repeat} hue="coral">
        <div className="rounded-2xl border border-coral-100 bg-coral-50/60 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-coral-700">
            <Repeat size={15} aria-hidden />
            These items wait for each other in a circle
          </p>
          <p className="mt-1 text-sm text-neutral-600">{data.explanation}</p>

          <ol className="mt-4 space-y-2">
            {data.cycle.map((node, index) => (
              <li key={node.id} className="flex items-center gap-2.5 text-sm text-neutral-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold tabular-nums text-coral-700 ring-1 ring-coral-100">
                  {index + 1}
                </span>
                <ItemRef value={node.externalRef} />
                <button
                  type="button"
                  onClick={() => onOpenItem?.(node.id)}
                  className="cursor-pointer truncate text-left font-semibold underline-offset-2 hover:underline"
                >
                  {node.title}
                </button>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs text-neutral-500">
            Remove any one of the links between these and the rest of the
            schedule appears.
          </p>
        </div>
      </Panel>
    );
  }

  if (!data.schedulable || data.summary === null) {
    return (
      <Card>
        <Empty
          icon={CalendarRange}
          title="Nothing to schedule yet"
          hint={data.explanation ?? "Add some work to this project first."}
        />
      </Card>
    );
  }

  const { summary } = data;
  const span = Math.max(summary.durationDays, 1);

  /* Each item counted once, in the order a reader cares about it. */
  const shape = { done: 0, unestimated: 0, critical: 0, slack: 0 };
  for (const item of data.items) {
    if (item.isComplete) shape.done += 1;
    else if (!item.isEstimated) shape.unestimated += 1;
    else if (item.isCritical) shape.critical += 1;
    else shape.slack += 1;
  }

  const columns: Column<ScheduleItem>[] = [
    {
      key: "item",
      header: "Work",
      primary: true,
      sortable: true,
      value: (item) => item.title,
      render: (item) => <ItemTitle item={item} onOpen={onOpenItem} />,
    },
    {
      key: "slack",
      header: "Slack",
      sortable: true,
      value: (item) => (item.isCritical ? -1 : item.slackDays),
      render: (item) => <SlackWords item={item} />,
    },
    {
      key: "days",
      header: "When",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (item) => item.earliestStart,
      render: (item) => <span className="text-xs text-neutral-500">{dayRange(item)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Critical path"
          subtitle={`${summary.criticalCount} of ${summary.itemCount} items decide the end date`}
          icon={Route}
          hue="coral"
          actions={
            <button
              type="button"
              onClick={() => setCriticalOnly((on) => !on)}
              aria-pressed={criticalOnly}
              className={cx(
                "h-9 cursor-pointer rounded-xl px-3 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
                criticalOnly
                  ? "bg-primary-600 text-white shadow-sm"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              Critical only
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat
              label="Length"
              value={`${summary.durationDays} working ${summary.durationDays === 1 ? "day" : "days"}`}
              hue="coral"
            />
            <MiniStat label="Deciding the end" value={summary.criticalCount} hint={`of ${summary.itemCount} items`} hue="rose" />
            <MiniStat
              label="Links"
              value={`${summary.dependencyCount} ${summary.dependencyCount === 1 ? "dependency" : "dependencies"}`}
              hue="grape"
            />
            <MiniStat label="Working day" value={`${summary.hoursPerDay}h`} hue="sky" />
          </div>

          {/*
            The caveat that keeps the number honest, and it is a warning rather
            than a footnote: a path over a backlog that is a third estimated is
            a path through a third of the work with the rest collapsed to zero.
          */}
          {summary.unestimated > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip hue="sun" dot>
                {summary.unestimated} unestimated
              </Chip>
            </div>
          )}

          {summary.coverage !== null && summary.coverage < 1 && (
            <Notice tone="warn" className="mt-3">
              {Math.round(summary.coverage * 100)}% of this work is estimated.
              The unestimated items take no time here, so the real end date is
              later than {summary.durationDays} days, by however long they
              turn out to be.
            </Notice>
          )}

          {summary.startsOn !== null && summary.endsOn !== null && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral-50 text-coral-700">
                <CalendarRange size={17} aria-hidden />
              </span>
              <p className="text-sm text-neutral-800">
                {formatDate(summary.startsOn)} to{" "}
                <span className="font-semibold">{formatDate(summary.endsOn)}</span>
                {/*
                  The promise beside the derivation. Stated as a comparison, never
                  as a verdict: the estimates may be the thing that is wrong, and
                  this screen has no standing to decide which.
                */}
                {summary.targetEndsOn !== null && (
                  <span className="text-neutral-500">
                    {" "}
                    · promised {formatDate(summary.targetEndsOn)}
                    {summary.endsOn > summary.targetEndsOn
                      ? `, which is ${workingDaysBetween(summary.targetEndsOn, summary.endsOn)} working days earlier than the plan can manage`
                      : ""}
                  </span>
                )}
              </p>
            </div>
          )}

          {data.calendar !== null && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-neutral-500">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                {/*
                  Two different absences with two different remedies — a sales
                  conversation, or five minutes of data entry — so the server's
                  sentence is shown rather than a generic one.
                */}
                {data.calendar.reason ??
                  `Weekends and ${data.calendar.holidays.length} public ${
                    data.calendar.holidays.length === 1 ? "holiday" : "holidays"
                  } are skipped.`}
                {!data.calendar.anchored && (
                  <>
                    {" "}
                    <span className="font-semibold text-sun-700">
                      This project has no start date, so the dates run from today.
                      Set one and they will move.
                    </span>
                  </>
                )}
                {data.calendar.localHolidays.length > 0 && (
                  <>
                    {" "}
                    {data.calendar.localHolidays.length}{" "}
                    {data.calendar.localHolidays.length === 1 ? "day is" : "days are"}{" "}
                    a holiday in some locations only, and the dates do not allow for
                    {data.calendar.localHolidays.length === 1 ? " it" : " them"}.
                  </>
                )}
              </span>
            </p>
          )}

          <p className="mt-2 text-xs text-neutral-500">
            Worked out from the estimates each time you open it, so it moves when
            they do. Nothing here is stored.
          </p>
        </Panel>

        <Panel title="Where the slack is" subtitle="Every item, counted once" icon={PieChart} hue="grape">
          <div className="flex h-full items-center justify-center">
            <Donut
              size={160}
              legend="below"
              centerLabel="items"
              caption="Items by how much room they have"
              data={[
                { label: "Deciding the end", value: shape.critical, hue: "coral" },
                { label: "Room to slip", value: shape.slack, hue: "blue" },
                { label: "Not estimated", value: shape.unestimated, hue: "sun" },
                { label: "Done", value: shape.done, hue: "mint" },
              ]}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="Timeline"
        subtitle={view === "chart" ? "Every item on the working calendar" : "What can slip, and by how long"}
        icon={view === "chart" ? GanttChartSquare : GitBranch}
        hue="blue"
        actions={
          <span className="inline-flex rounded-xl bg-neutral-100 p-1">
            {(["list", "chart"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={cx(
                  "h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold capitalize transition outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
                  view === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {key}
              </button>
            ))}
          </span>
        }
      >
        {view === "chart" ? (
          /*
            The chart gets every item, not the filtered set: a Gantt with rows
            removed has arrows pointing at nothing, and the gaps read as data
            rather than as a filter.
          */
          <GanttChart data={data} onOpenItem={onOpenItem} />
        ) : rows.length === 0 ? (
          <Empty
            icon={CircleHelp}
            title="Nothing on the critical path"
            hint="Every item has slack, which usually means nothing depends on anything yet."
          />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(item) => item.id}
            storageKey="projects.schedule.items"
            views={["list", "table", "grid"]}
            defaultView="list"
            caption="Scheduled work and how long each item can slip"
            searchPlaceholder="Search work"
            renderListItem={(item) => <Row item={item} span={span} onOpen={onOpenItem} />}
            renderCard={(item) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <ItemTitle item={item} onOpen={onOpenItem} />
                <Bar item={item} span={span} />
                <div className="mt-auto flex items-center justify-between gap-2">
                  <SlackWords item={item} />
                  <span className="text-xs tabular-nums text-neutral-500">{dayRange(item)}</span>
                </div>
              </div>
            )}
          />
        )}
      </Panel>
    </div>
  );
}

/** 4 Jan 2027, in whatever order the reader's locale puts it. */
function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Working days between two dates, for the overrun sentence.
 *
 * Weekends only — the holidays are known but attributing the overrun to them
 * would be a second claim. "Nine working days later" is the honest floor.
 */
function workingDaysBetween(from: string, to: string): number {
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  let days = 0;

  while (cursor < end && days < 2000) {
    cursor.setDate(cursor.getDate() + 1);

    const weekday = cursor.getDay();

    if (weekday !== 0 && weekday !== 6) days += 1;
  }

  return days;
}

function dayRange(item: ScheduleItem): string {
  return item.isEstimated ? `day ${item.earliestStart} to ${item.earliestFinish}` : `day ${item.earliestStart}`;
}

/** The title, with its reference and the two flags that change how it is read. */
function ItemTitle({ item, onOpen }: { item: ScheduleItem; onOpen?: (id: string) => void }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <ItemRef value={item.externalRef} />
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          className={cx(
            "cursor-pointer truncate text-left text-sm font-semibold underline-offset-2 hover:underline",
            item.isComplete ? "text-neutral-400 line-through" : "text-neutral-900",
          )}
        >
          {item.title}
        </button>
      ) : (
        <span className="truncate text-sm font-semibold text-neutral-900">{item.title}</span>
      )}

      {item.isCritical && (
        <Chip hue="coral" icon={Route} className="!px-2 !py-0.5 text-[11px]">
          Critical
        </Chip>
      )}
      {!item.isEstimated && (
        <Chip hue="sun" icon={Timer} className="!px-2 !py-0.5 text-[11px]">
          No estimate
        </Chip>
      )}
    </span>
  );
}

/**
 * Slack in words, because "4" beside a bar means nothing and "can slip 4
 * days" is the sentence somebody repeats in a stand-up.
 */
function SlackWords({ item }: { item: ScheduleItem }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        item.isCritical ? "text-coral-700" : "text-neutral-600",
      )}
    >
      <Clock size={12} aria-hidden />
      {item.isCritical
        ? "cannot slip"
        : `can slip ${item.slackDays} ${item.slackDays === 1 ? "day" : "days"}`}
    </span>
  );
}

/**
 * The item as a bar across the project's span.
 *
 * Positioned as a percentage of the span rather than at a fixed scale, so a
 * six-day project and a sixty-day one both fill the width. The numbers in the
 * label are the truth; the bar is the shape of it.
 */
function Bar({ item, span }: { item: ScheduleItem; span: number }) {
  const left = (item.earliestStart / span) * 100;
  /*
   * A zero-duration item would be an invisible bar. Drawn at a minimum width
   * as a hollow marker instead — it has a place in the order even though it
   * has no length, and an item missing from the chart reads as a bug.
   */
  const width = Math.max((item.durationDays / span) * 100, 1.5);

  return (
    <div className="ws-hatch relative h-2.5 flex-1 overflow-hidden rounded-full">
      {/*
        Slack is drawn as a paler extension of the bar, so the difference
        between "long" and "immovable" is visible without reading a number.
      */}
      {!item.isCritical && item.slackDays > 0 && (
        <span
          className="absolute top-0 h-2.5 rounded-full bg-primary-100"
          style={{
            left: `${left}%`,
            width: `${Math.min(((item.durationDays + item.slackDays) / span) * 100, 100 - left)}%`,
          }}
        />
      )}
      <span
        className={cx(
          "absolute top-0 h-2.5 rounded-full",
          !item.isEstimated
            ? "border border-dashed border-sun-500 bg-sun-50"
            : item.isCritical
              ? "bg-coral-500"
              : "bg-primary-500",
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

/** One item as a list row: the title and its flags, the slack in words, and the bar. */
function Row({
  item,
  span,
  onOpen,
}: {
  item: ScheduleItem;
  span: number;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <ItemTitle item={item} onOpen={onOpen} />
        <span className="shrink-0">
          <SlackWords item={item} />
        </span>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <Bar item={item} span={span} />
        <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-neutral-500">
          {dayRange(item)}
        </span>
      </div>
    </div>
  );
}
