"use client";

import { useMemo } from "react";
import type { Schedule, ScheduleItem } from "@/lib/api/projects-client";
import { isoDate, today } from "./dates";

/**
 * The schedule over a real calendar.
 *
 * Sprint 7 shipped day offsets and said why: nothing anchored them. A start
 * date and a working calendar now do, so this draws dates — but the same rule
 * governs both screens, which is that **the chart never implies more precision
 * than the estimates carry**.
 *
 * **Dates come from the server, and are not re-derived here.** A CPM finish is
 * an exclusive boundary — two days of work from Monday ends on Tuesday, not
 * Wednesday — and a client redoing that arithmetic draws every bar a day too
 * long and a project cumulatively wrong. `endsOn` is already the last day work
 * occupies.
 *
 * **Weekends and holidays are shaded, not skipped.** A chart that compressed
 * non-working days would be denser and would stop matching the calendar on the
 * wall; a bar spanning a shaded gap is visibly a bar that pauses, which is
 * what actually happens.
 *
 * **Slack is drawn behind the bar, not beside it.** The distinction between a
 * long task and an immovable one is the entire point of a critical path, and a
 * chart where both are the same blue bar is a picture of dates rather than a
 * picture of risk.
 *
 * **The promised date is a marker, not a verdict.** `targetEndsOn` is what
 * somebody committed to; the bars are what the estimates imply. Showing both
 * and letting a reader see the gap is honest. Colouring the project red
 * because the gap exists would be a judgement this screen has no standing to
 * make — the estimates might be the thing that is wrong.
 */
export default function GanttChart({
  data,
  onOpenItem,
}: {
  data: Schedule;
  onOpenItem?: (itemId: string) => void;
}) {
  const model = useMemo(() => build(data), [data]);

  if (model === null) return null;

  const { days, rows, width, holidays, today, target } = model;
  const timeline = Math.max(width, 480);

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <div className="flex select-none">
          {/* ---------- the names, pinned while the dates scroll ---------- */}
          <div className="sticky left-0 z-20 w-[150px] shrink-0 border-r border-neutral-200 bg-white sm:w-[230px]">
            <div
              style={{ height: HEADER }}
              className="flex items-end border-b border-neutral-200 bg-neutral-50/70 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              Work
            </div>
            <ul>
              {rows.map((row) => (
                <li
                  key={row.item.id}
                  style={{ height: ROW }}
                  className="flex items-center gap-2 border-b border-neutral-100 px-4 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 ${
                      row.item.isMilestone
                        ? "rotate-45 rounded-[2px] bg-neutral-800"
                        : !row.item.isEstimated
                          ? "rounded-full border border-dashed border-sun-500"
                          : row.item.isCritical
                            ? "rounded-full bg-error-500"
                            : "rounded-full bg-primary-500"
                    }`}
                  />
                  {row.item.externalRef && (
                    <span className="hidden shrink-0 rounded-md bg-neutral-50 px-1 font-mono text-[10px] font-semibold text-neutral-500 sm:inline">
                      {row.item.externalRef}
                    </span>
                  )}
                  <span
                    className={`truncate text-[13px] font-medium ${
                      row.item.isComplete ? "text-neutral-400 line-through" : "text-neutral-800"
                    }`}
                    title={row.item.title}
                  >
                    {row.item.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- the timeline ---------- */}
          <div style={{ width: `${timeline}px` }} className="relative shrink-0">
            {/* The date rail. */}
            <div style={{ height: HEADER }} className="border-b border-neutral-200 bg-neutral-50/70">
              <div className="flex h-[24px]">
                {months(days).map((block) => (
                  <div
                    key={block.label}
                    style={{ width: `${block.span * DAY}px` }}
                    className="shrink-0 truncate border-l border-neutral-200 px-2 pt-1.5 text-[11px] font-semibold text-neutral-700 first:border-l-0"
                  >
                    {block.label}
                  </div>
                ))}
              </div>

              <div className="flex">
                {days.map((day, i) => (
                  <div key={day.date} style={{ width: `${DAY}px` }} className="flex shrink-0 justify-center pt-1">
                    <span
                      className={`flex h-[20px] w-[20px] items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
                        i === today
                          ? "bg-primary-600 text-white"
                          : day.isOff
                            ? "text-neutral-400"
                            : "text-neutral-600"
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Non-working days, behind everything. */}
              <div className="pointer-events-none absolute inset-0 flex">
                {days.map((day) => (
                  <div
                    key={day.date}
                    style={{ width: `${DAY}px` }}
                    className={`h-full shrink-0 ${day.isOff ? "bg-neutral-50" : ""}`}
                    title={day.holiday ?? undefined}
                  />
                ))}
              </div>

              {/* Today, and the date somebody promised. */}
              {today !== null && (
                <span
                  aria-hidden
                  style={{ left: `${today * DAY + DAY / 2 - 1}px` }}
                  className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 rounded-full bg-primary-500/70"
                />
              )}
              {target !== null && (
                <>
                  <span
                    aria-hidden
                    style={{ left: `${target * DAY + DAY}px` }}
                    className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px border-l-2 border-dashed border-accent-500"
                  />
                  <span
                    style={{ left: `${target * DAY + DAY + 4}px` }}
                    className="pointer-events-none absolute top-1 z-[6] whitespace-nowrap rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-semibold text-sun-700"
                  >
                    Promised
                  </span>
                </>
              )}

              <ul className="relative">
                {rows.map((row) => (
                  <li
                    key={row.item.id}
                    style={{ height: ROW }}
                    className="group relative flex items-center border-b border-neutral-100/70 last:border-b-0"
                  >
                    {/* Slack, behind the bar: hatched, because it is time not yet spoken for. */}
                    {row.slackWidth > 0 && (
                      <span
                        aria-hidden
                        style={{
                          left: `${row.offset * DAY}px`,
                          width: `${(row.width + row.slackWidth) * DAY - 2}px`,
                        }}
                        className="ws-hatch absolute h-5 rounded-full bg-neutral-100"
                      />
                    )}

                    {/*
                      A milestone is a moment, not a stretch of work, so it is a
                      marker rather than a bar. Drawing it as a bar would imply it
                      occupies the days it sits on, which is the one thing a
                      milestone does not do.
                    */}
                    <button
                      type="button"
                      onClick={() => onOpenItem?.(row.item.id)}
                      style={
                        row.item.isMilestone
                          ? { left: `${row.offset * DAY + DAY / 2 - 7}px`, width: "14px" }
                          : {
                              left: `${row.offset * DAY}px`,
                              width: `${Math.max(row.width * DAY - 2, 6)}px`,
                            }
                      }
                      className={`absolute cursor-pointer outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 ${
                        row.item.isMilestone
                          ? `h-3.5 rotate-45 rounded-[3px] shadow-sm ${row.item.isComplete ? "bg-success-600" : "bg-neutral-800"}`
                          : `h-5 rounded-full shadow-sm ${
                              !row.item.isEstimated
                                ? "border-2 border-dashed border-sun-500 bg-sun-50"
                                : row.item.isCritical
                                  ? "bg-error-500"
                                  : "bg-primary-500"
                            } ${row.item.isComplete ? "opacity-45" : ""}`
                      }`}
                      title={describe(row.item)}
                    >
                      <span className="sr-only">{describe(row.item)}</span>
                    </button>

                    {/*
                      What matters about the bar, riding just past it: whether it
                      can slip. Clamped to the left once the bar runs far enough
                      right that the words would leave the chart.
                    */}
                    <span
                      aria-hidden
                      style={{
                        left: `${Math.min(
                          (row.offset + row.width + (row.item.isMilestone ? 0 : row.slackWidth)) * DAY + 6,
                          timeline - 90,
                        )}px`,
                      }}
                      className="pointer-events-none absolute whitespace-nowrap text-[11px] font-medium text-neutral-500"
                    >
                      {slackWords(row.item)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* ---------- what waits for what ---------- */}
              <Arrows rows={rows} />
            </div>
          </div>
        </div>
      </div>

      {/* The key: every mark named, since colour is never the only signal. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-full bg-error-500" />
          Critical path
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-full bg-primary-500" />
          Has slack
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="ws-hatch h-2.5 w-5 rounded-full" />
          Room to slip
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-full border-2 border-dashed border-sun-500 bg-sun-50" />
          Not estimated
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-neutral-800" />
          Milestone
        </li>
        {today !== null && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-primary-500" />
            Today
          </li>
        )}
      </ul>

      {holidays.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Shaded: weekends and{" "}
          {holidays.map((h) => h.name).join(", ")}.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** One day's width, in pixels. Small enough that a quarter fits on a laptop. */
const DAY = 22;

/** One row's height, shared by the names, the bars and the arrows. */
const ROW = 40;

/** The date rail: a month row over a day row. */
const HEADER = 52;

interface Day {
  date: string;
  dayOfMonth: number;
  /** Weekend or holiday: shaded, and never counted as working time. */
  isOff: boolean;
  holiday: string | null;
}

interface Row {
  item: ScheduleItem;
  offset: number;
  width: number;
  slackWidth: number;
}

/**
 * Dependency arrows.
 *
 * Drawn only between rows both on screen, and only where the predecessor
 * actually ends before the successor starts — an arrow that runs backwards is
 * a picture of a lead, which is legitimate and unreadable as a line, so those
 * are left to the item panel's sentence instead.
 */
function Arrows({ rows }: { rows: Row[] }) {
  const index = new Map(rows.map((row, i) => [row.item.id, i]));

  const links = rows.flatMap((row, to) =>
    row.item.dependsOn.flatMap((fromId) => {
      const from = index.get(fromId);

      if (from === undefined) return [];

      const source = rows[from];
      const startX = (source.offset + source.width) * DAY - 2;
      const endX = row.offset * DAY;

      if (endX < startX) return [];

      return [{ key: `${fromId}-${row.item.id}`, from, to, startX, endX }];
    }),
  );

  if (links.length === 0) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      {links.map((link) => {
        const y1 = link.from * ROW + ROW / 2;
        const y2 = link.to * ROW + ROW / 2;
        /* A dogleg rather than a diagonal: it reads as a route, not a trend. */
        const midX = Math.max(link.startX + 6, link.endX - 6);

        return (
          <g key={link.key} className="text-neutral-400">
            <path
              d={`M ${link.startX} ${y1} H ${midX} V ${y2} H ${link.endX}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            />
            <path
              d={`M ${link.endX} ${y2} l -4 -3 v 6 z`}
              fill="currentColor"
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Everything the chart needs, worked out once.
 *
 * Returns null when there is nothing to draw — an unschedulable project, or
 * one whose items all fell past the calendar's horizon.
 */
function build(data: Schedule) {
  if (!data.schedulable || data.summary === null || data.calendar === null) {
    return null;
  }

  const drawable = data.items.filter(
    (item): item is ScheduleItem & { startsOn: string; endsOn: string } =>
      item.startsOn !== null && item.endsOn !== null,
  );

  if (drawable.length === 0) return null;

  /*
   * The span is the widest of three things: the work, the promised date, and
   * today. A target that sits a month past the last bar is exactly the case
   * worth seeing, and a chart that cropped it would hide the only number the
   * reader came for.
   */
  const dates = drawable.flatMap((item) => [item.startsOn, item.endsOn]);
  const candidates = [...dates, data.summary.targetEndsOn, today()].filter(
    (d): d is string => d !== null,
  );

  const first = candidates.reduce((a, b) => (a < b ? a : b));
  const last = candidates.reduce((a, b) => (a > b ? a : b));

  const holidays = [...data.calendar.holidays, ...data.calendar.localHolidays];
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));

  const days: Day[] = [];

  for (const date of eachDay(first, last)) {
    const weekday = new Date(`${date}T00:00:00`).getDay();
    const holiday = holidayByDate.get(date) ?? null;

    days.push({
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      isOff: weekday === 0 || weekday === 6 || holiday !== null,
      holiday,
    });
  }

  const column = new Map(days.map((day, i) => [day.date, i]));

  const rows: Row[] = drawable.map((item) => {
    const offset = column.get(item.startsOn) ?? 0;
    const end = column.get(item.endsOn) ?? offset;

    /*
     * Inclusive of both ends: a bar covering Monday to Tuesday is two days
     * wide, which is why this is `end - offset + 1` and not the difference.
     */
    const width = Math.max(end - offset + 1, 1);

    const latestEnd = item.latestEndsOn === null ? end : (column.get(item.latestEndsOn) ?? end);

    return {
      item,
      offset,
      width,
      slackWidth: item.isCritical ? 0 : Math.max(latestEnd - end, 0),
    };
  });

  rows.sort((a, b) => a.offset - b.offset || b.width - a.width);

  return {
    days,
    rows,
    width: days.length * DAY,
    holidays,
    today: column.get(today()) ?? null,
    target:
      data.summary.targetEndsOn === null
        ? null
        : (column.get(data.summary.targetEndsOn) ?? null),
  };
}

/** Month headings, as spans over the day rail. */
function months(days: Day[]) {
  const blocks: { label: string; span: number }[] = [];

  for (const day of days) {
    const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });

    const last = blocks[blocks.length - 1];

    if (last !== undefined && last.label === label) {
      last.span += 1;
    } else {
      blocks.push({ label, span: 1 });
    }
  }

  return blocks;
}

/** The one fact a bar cannot show by itself, in the fewest words. */
function slackWords(item: ScheduleItem): string {
  if (item.isMilestone) return item.isComplete ? "reached" : "";
  if (!item.isEstimated) return "no time planned";
  if (item.isCritical) return "cannot slip";
  return `+${item.slackDays}d slack`;
}

function describe(item: ScheduleItem): string {
  if (item.isMilestone) {
    return `${item.title} — milestone, ${item.isComplete ? "complete" : `expected ${item.endsOn}`}`;
  }

  const when = `${item.startsOn} to ${item.endsOn}`;
  const slack = item.isCritical
    ? "on the critical path, cannot slip"
    : `can slip ${item.slackDays} ${item.slackDays === 1 ? "day" : "days"}`;

  return item.isEstimated
    ? `${item.title} — ${when}, ${slack}`
    : `${item.title} — no estimate, so it takes no time in this plan`;
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  /* Bounded: a chart wider than five years is a data problem, not a view. */
  for (let i = 0; cursor <= end && i < 2000; i++) {
    out.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}


