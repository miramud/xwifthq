"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  FlagTriangleRight,
  ListTodo,
  Repeat,
  TriangleAlert,
} from "lucide-react";
import { Chip, Panel, cx } from "@/components/workspace/kit";
import { Legend as ChartLegend } from "@/components/workspace/charts";
import { eventBlockClass } from "@/components/workspace/Calendar";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  schedule as scheduleApi,
  type CalendarDay,
  type Project,
  type ProjectMonth,
  type WorkItemType,
} from "@/lib/api/projects-client";
import { today } from "./dates";
import { ItemRef, Notice, TYPE_META, TYPE_ORDER, fmtDate } from "./ui/pkit";

/**
 * One month of a project, in four layers that do not pretend to be one thing.
 *
 * **A due date is a commitment; a scheduled date is a derivation.** Somebody
 * typed the first one in and it means they promised; the second falls out of
 * estimates and dependencies and moves the moment either changes. Drawing them
 * identically — the usual approach — turns the most interesting thing on the
 * screen into noise, so they are drawn differently and labelled: a due date is
 * a filled block in its work type's colour, a derived finish is an outline.
 *
 * **Where the two disagree, the disagreement is the point.** An item due on
 * the 14th that the critical path cannot finish before the 22nd is what a
 * manager opened this screen to find, and it is stated as the comparison it is
 * rather than as a red dot that could mean anything.
 *
 * **A holiday that closes one office is marked differently from one that
 * closes them all**, because only the second moved any dates. The first is why
 * a week can be thin while the chart shows nothing unusual.
 *
 * **A quiet month is a quiet month.** It renders as an ordinary grid with
 * nothing in it, never as an error or an empty state — "nothing due in July"
 * is a fact about July.
 */
export default function ProjectMonthView({
  project,
  refreshKey = 0,
  onOpenItem,
}: {
  project: Project;
  refreshKey?: number;
  onOpenItem?: (itemId: string) => void;
}) {
  const now = new Date();

  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const [data, setData] = useState<ProjectMonth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    scheduleApi
      .month(project.slug, cursor)
      .then((result) => {
        if (!live) return;

        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!live) return;

        setError(e instanceof ApiError ? e.message : "Could not load the calendar.");
      });

    return () => {
      live = false;
    };
  }, [project.slug, cursor, refreshKey]);

  /**
   * Whether what is on screen is the month being asked for.
   *
   * Derived rather than held in a `loading` flag, because the response says
   * which month it is for and a second piece of state could only ever
   * disagree with it. It also fixes a real thing: paging forward used to leave
   * the previous month's grid up with nothing to say it was the wrong one.
   */
  const stale =
    data === null || data.year !== cursor.year || data.month !== cursor.month;

  /*
   * Leading blanks so the 1st lands under its weekday. Monday-first, matching
   * the rest of the suite and the working week the schedule is built on.
   */
  const leading = useMemo(() => {
    if (data === null) return 0;

    const weekday = new Date(`${data.from}T00:00:00`).getDay();

    return (weekday + 6) % 7;
  }, [data]);

  /* Every dated item this month, flattened for the agenda underneath. */
  const agenda = useMemo<AgendaRow[]>(() => {
    if (data === null) return [];

    return data.days.flatMap((day) => [
      ...day.due.map(
        (item): AgendaRow => ({
          key: `due-${item.id}-${day.date}`,
          id: item.id,
          date: day.date,
          title: item.title,
          externalRef: item.externalRef,
          kind: "due",
          type: item.type,
          isComplete: item.isComplete,
          late: item.lateAgainstPlan && !item.isComplete,
          scheduledEndsOn: item.scheduledEndsOn,
          isCritical: false,
        }),
      ),
      ...day.finishing.map(
        (item): AgendaRow => ({
          key: `fin-${item.id}-${day.date}`,
          id: item.id,
          date: day.date,
          title: item.title,
          externalRef: item.externalRef,
          kind: "finish",
          type: null,
          isComplete: false,
          late: false,
          scheduledEndsOn: null,
          isCritical: item.isCritical,
        }),
      ),
    ]);
  }, [data]);

  const step = (by: number) => {
    setCursor((at) => {
      const moved = new Date(at.year, at.month - 1 + by, 1);

      return { year: moved.getFullYear(), month: moved.getMonth() + 1 };
    });
  };

  /* From the cursor, so the title never lags a month behind the arrows. */
  const heading = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const trailing = data === null ? 0 : (7 - ((leading + data.days.length) % 7)) % 7;

  const navButton =
    "flex h-9 w-9 cursor-pointer items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-200";

  return (
    <div className="space-y-6">
      <Panel
        title="Calendar"
        subtitle="Due dates, scheduled finishes, sprints and holidays, a month at a time"
        icon={CalendarDays}
        hue="sky"
      >
        {/* ------------------------------ nav ------------------------------ */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">{heading}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() + 1 })}
              className="h-9 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Today
            </button>
            <div className="inline-flex overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <button type="button" onClick={() => step(-1)} aria-label="Previous month" className={navButton}>
                <ChevronLeft size={17} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next month"
                className={cx(navButton, "border-l border-neutral-200")}
              >
                <ChevronRight size={17} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {error !== null && <Notice tone="error" className="mb-4">{error}</Notice>}

        {stale && data === null && error === null && (
          <p className="text-sm text-neutral-500">Loading the month…</p>
        )}

        {data !== null && (
          <>
            {/*
              The derived layer can be missing while the other three are intact.
              Saying which is missing beats drawing three quarters of a calendar
              and letting somebody wonder what happened to the fourth.
            */}
            {!data.meta.scheduled && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-sun-100 bg-sun-50 px-4 py-3 text-sm text-sun-700">
                {data.meta.scheduleReason === "cycle" ? (
                  <>
                    <Repeat size={15} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      Some items wait for each other in a circle, so there are no
                      scheduled dates this month. Due dates, sprints and holidays
                      below are unaffected.
                    </span>
                  </>
                ) : (
                  <>
                    <CalendarDays size={15} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      There is no work to schedule yet, so nothing below is
                      derived from estimates.
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <div
                aria-busy={stale}
                className={cx(
                  "min-w-[640px] overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-opacity",
                  stale && "opacity-40",
                )}
              >
                <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/70">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => (
                    <div
                      key={label}
                      className={cx(
                        "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide",
                        i >= 5 ? "text-neutral-400" : "text-neutral-500",
                      )}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {/* Days outside the month are hatched: not part of it, rather than empty. */}
                  {Array.from({ length: leading }, (_, i) => (
                    <div
                      key={`blank-${i}`}
                      aria-hidden
                      className="ws-hatch min-h-[112px] border-b border-r border-neutral-100 bg-neutral-50/50"
                    />
                  ))}

                  {data.days.map((day, i) => (
                    <Day key={day.date} day={day} lastInRow={(leading + i) % 7 === 6} onOpenItem={onOpenItem} />
                  ))}

                  {Array.from({ length: trailing }, (_, i) => (
                    <div
                      key={`after-${i}`}
                      aria-hidden
                      className={cx("ws-hatch min-h-[112px] border-b border-neutral-100", i < trailing - 1 && "border-r")}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Legend month={data} />
          </>
        )}
      </Panel>

      {data !== null && !stale && (
        <Panel
          title={`Dates in ${heading}`}
          subtitle="Every due date and scheduled finish this month, in one list"
          icon={ListTodo}
          hue="blue"
          bodyClassName="p-5 pt-4"
        >
          <DataView
            rows={agenda}
            columns={agendaColumns}
            rowKey={(row) => row.key}
            storageKey="projects.calendar.agenda"
            caption={`Due dates and scheduled finishes in ${heading}`}
            searchPlaceholder="Search this month"
            onRowClick={onOpenItem === undefined ? undefined : (row) => onOpenItem(row.id)}
            empty={
              <p className="px-5 py-10 text-center text-sm text-neutral-500">
                Nothing is due or scheduled to finish in {heading}.
              </p>
            }
          />
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface AgendaRow {
  key: string;
  id: string;
  date: string;
  title: string;
  externalRef: string | null;
  kind: "due" | "finish";
  type: WorkItemType | null;
  isComplete: boolean;
  late: boolean;
  scheduledEndsOn: string | null;
  isCritical: boolean;
}

const agendaColumns: Column<AgendaRow>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    value: (row) => row.date,
    render: (row) => <span className="whitespace-nowrap font-medium text-neutral-800">{fmtDate(row.date)}</span>,
  },
  {
    key: "title",
    header: "Work",
    primary: true,
    sortable: true,
    value: (row) => row.title,
    render: (row) => (
      <span className="flex min-w-0 items-center gap-2">
        <ItemRef value={row.externalRef} />
        <span className={cx("truncate font-semibold", row.isComplete ? "text-neutral-400 line-through" : "text-neutral-900")}>
          {row.title}
        </span>
      </span>
    ),
  },
  {
    key: "kind",
    header: "Mark",
    sortable: true,
    value: (row) => (row.kind === "due" ? "Due date" : "Scheduled finish"),
    render: (row) =>
      row.kind === "due" ? (
        <Chip hue={row.type === null ? "blue" : TYPE_META[row.type].hue} icon={Flag}>
          Due date
        </Chip>
      ) : (
        <span
          className={cx(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed px-2.5 py-0.5 text-xs font-semibold",
            row.isCritical ? "border-coral-300 text-coral-700" : "border-neutral-300 text-neutral-600",
          )}
        >
          Scheduled finish
        </span>
      ),
  },
  {
    key: "note",
    header: "Against the plan",
    hideOnMobile: true,
    value: (row) =>
      row.late ? `Plan finishes ${row.scheduledEndsOn}` : row.isCritical ? "On the critical path" : "",
    render: (row) =>
      row.late ? (
        <Chip hue="coral" icon={TriangleAlert}>
          Plan finishes {fmtDate(row.scheduledEndsOn)}
        </Chip>
      ) : row.isComplete ? (
        <Chip hue="mint" icon={CalendarCheck}>
          Done
        </Chip>
      ) : row.isCritical ? (
        <span className="text-xs font-medium text-coral-700">On the critical path</span>
      ) : (
        <span className="text-neutral-400">—</span>
      ),
  },
];

function Day({
  day,
  lastInRow,
  onOpenItem,
}: {
  day: CalendarDay;
  lastInRow: boolean;
  onOpenItem?: (itemId: string) => void;
}) {
  const isToday = day.date === today();

  return (
    <div
      className={cx(
        "min-h-[112px] border-b border-neutral-100 p-2",
        !lastInRow && "border-r",
        day.holiday !== null && day.holiday.closesEverywhere
          ? "bg-sun-50/60"
          : (day.isWeekend || day.holiday !== null) && "bg-neutral-50/80",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
        <span
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
            isToday ? "bg-primary-600 text-white" : day.isWeekend ? "text-neutral-400" : "text-neutral-800",
          )}
        >
          {Number(day.date.slice(8, 10))}
        </span>

        {day.sprintStarts.map((sprint) => (
          <span
            key={sprint.id}
            className={cx(
              "inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              HUE[hueFor(sprint.name)].soft,
            )}
          >
            <Flag size={10} className="shrink-0" aria-hidden />
            {sprint.name} starts
          </span>
        ))}
        {day.sprintEnds.map((sprint) => (
          <span
            key={sprint.id}
            className={cx(
              "inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              HUE[hueFor(sprint.name)].soft,
            )}
          >
            <FlagTriangleRight size={10} className="shrink-0" aria-hidden />
            {sprint.name} ends
          </span>
        ))}
      </div>

      {day.holiday !== null && (
        <p
          className={cx(
            "mb-1.5 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold",
            day.holiday.closesEverywhere ? "bg-sun-100 text-sun-700" : "bg-neutral-100 text-neutral-600",
          )}
          title={day.holiday.name}
        >
          {day.holiday.name}
          {/*
            A holiday that closed one office moved no dates, and saying so is
            the difference between a thin week somebody expected and one that
            surprises them.
          */}
          {!day.holiday.closesEverywhere && (
            <span className="font-medium text-neutral-500"> ({day.holiday.location})</span>
          )}
        </p>
      )}

      <ul className="space-y-1">
        {/*
          A commitment. Filled in its work type's colour, and marked when the
          plan cannot meet it.
        */}
        {day.due.map((item) => {
          const late = item.lateAgainstPlan && !item.isComplete;
          return (
            <li key={`due-${item.id}`}>
              <button
                type="button"
                onClick={() => onOpenItem?.(item.id)}
                title={
                  item.lateAgainstPlan
                    ? `Due today. The plan cannot finish it before ${item.scheduledEndsOn}.`
                    : "Due today"
                }
                className={cx(
                  "relative flex w-full cursor-pointer items-center gap-1 truncate rounded-md border py-0.5 pl-2.5 pr-1.5 text-left text-[11px] font-semibold",
                  "before:absolute before:inset-y-1 before:left-1 before:w-[3px] before:rounded-full",
                  "outline-none hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300",
                  item.isComplete
                    ? cx(eventBlockClass("slate"), "line-through opacity-70")
                    : late
                      ? eventBlockClass("coral")
                      : eventBlockClass(TYPE_META[item.type]?.hue ?? "blue"),
                )}
              >
                {late && <TriangleAlert size={10} className="shrink-0" aria-hidden />}
                <span className="truncate">{item.title}</span>
              </button>
            </li>
          );
        })}

        {/*
          A derivation. Outlined rather than filled, so it never reads as
          something somebody promised.
        */}
        {day.finishing.map((item) => (
          <li key={`fin-${item.id}`}>
            <button
              type="button"
              onClick={() => onOpenItem?.(item.id)}
              title={`Scheduled to finish today${item.isCritical ? ", on the critical path" : ""}`}
              className={cx(
                "w-full cursor-pointer truncate rounded-md border border-dashed bg-white/60 px-1.5 py-0.5 text-left text-[11px] font-medium outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-primary-300",
                item.isCritical ? "border-coral-300 text-coral-700" : "border-neutral-300 text-neutral-600",
              )}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ month }: { month: ProjectMonth }) {
  /* Only the types and sprints this month actually shows, so the key matches the grid. */
  const types = TYPE_ORDER.filter((type) => month.days.some((d) => d.due.some((item) => item.type === type)));
  const sprints = new Map<string, string>();
  for (const d of month.days) {
    for (const s of [...d.sprintStarts, ...d.sprintEnds]) sprints.set(s.id, s.name);
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip hue="blue" icon={Flag}>
          {month.meta.counts.due} due {month.meta.counts.due === 1 ? "date" : "dates"}
        </Chip>
        {month.meta.counts.holidays > 0 && (
          <Chip hue="sun" icon={CalendarDays}>
            {month.meta.counts.holidays}{" "}
            {month.meta.counts.holidays === 1 ? "holiday" : "holidays"}
          </Chip>
        )}
        {(types.length > 0 || sprints.size > 0) && (
          <div className="ml-1">
            <ChartLegend
              items={[
                ...types.map((type) => ({ label: TYPE_META[type].label, hue: TYPE_META[type].hue })),
                ...[...sprints.values()].map((name) => ({ label: name, hue: hueFor(name) })),
              ]}
            />
          </div>
        )}
      </div>

      {/*
        Stated rather than left to the colours. Two marks that look similar and
        mean different things is precisely what this screen exists to avoid.
      */}
      <p className="text-xs leading-relaxed text-neutral-600">
        <span className="rounded-md border border-primary-200 bg-primary-50 px-1.5 py-0.5 font-semibold text-primary-800">Filled</span>{" "}
        is a due date somebody set.{" "}
        <span className="rounded-md border border-dashed border-neutral-300 px-1.5 py-0.5 font-medium">
          Outlined
        </span>{" "}
        is worked out from the estimates and moves when they do.
      </p>
    </div>
  );
}
