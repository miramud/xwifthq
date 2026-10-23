"use client";

import { CalendarClock, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, type LucideIcon } from "lucide-react";
import { addDays, allocateLanes, dayNumber } from "./calendar-lanes";
import { cx } from "./kit";
import { HUE, type Hue } from "./modules";

/*
  The workspace calendars: a month grid for "what is on when" and a week
  schedule for "what fills a day". Both take plain events with a hue, so the
  project calendar, the leave calendar and the rota all read the same way —
  a coloured block, its title, and who it belongs to.

  Dates are handled as bare `YYYY-MM-DD` strings throughout, never as Date
  objects crossing a timezone: a leave day is a day, not a UTC instant.
*/

export interface CalendarEvent {
  id: string;
  /** First day, `YYYY-MM-DD`. */
  date: string;
  /** Last day, inclusive, `YYYY-MM-DD`. Omit for a single day. */
  endDate?: string;
  title: string;
  hue: Hue;
  /** A second line: an owner, a project, a status. */
  meta?: string;
  /** For week view: `HH:MM` start and end. */
  start?: string;
  end?: string;
  href?: string;
  onClick?: () => void;
  /** No time of day; agenda lists say "All day". */
  allDay?: boolean;
  /** Where a dated obligation stands; drawn as a worded chip, never colour alone. */
  status?: EventStatus;
  /** Free-form type ("filing", "renewal", "leave") for the caller's own use. */
  kind?: string;
}

export type EventStatus = "upcoming" | "due" | "overdue" | "done";

/** Each status's word, hue and icon. Overdue first: the order things need attention. */
export const EVENT_STATUS: Record<EventStatus, { label: string; hue: Hue; icon: LucideIcon; rank: number }> = {
  overdue: { label: "Overdue", hue: "rose", icon: CircleAlert, rank: 0 },
  due: { label: "Due", hue: "sun", icon: Clock, rank: 1 },
  upcoming: { label: "Upcoming", hue: "sky", icon: CalendarClock, rank: 2 },
  done: { label: "Done", hue: "mint", icon: CircleCheck, rank: 3 },
};

const STATUS_ORDER: EventStatus[] = ["overdue", "due", "upcoming", "done"];

const EVENT_BLOCK: Record<Hue, string> = {
  blue: "bg-primary-50 text-primary-800 border-primary-200 before:bg-primary-500",
  coral: "bg-coral-50 text-coral-700 border-coral-100 before:bg-coral-500",
  mint: "bg-mint-50 text-mint-700 border-mint-100 before:bg-mint-500",
  grape: "bg-grape-50 text-grape-700 border-grape-100 before:bg-grape-500",
  sun: "bg-sun-50 text-sun-700 border-sun-100 before:bg-sun-500",
  sky: "bg-sky-50 text-sky-700 border-sky-100 before:bg-sky-500",
  rose: "bg-rose-50 text-rose-700 border-rose-100 before:bg-rose-500",
  slate: "bg-neutral-100 text-neutral-700 border-neutral-200 before:bg-neutral-400",
};

export function eventBlockClass(hue: Hue): string {
  return EVENT_BLOCK[hue];
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function todayYmd(): string {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
}

function covers(ev: CalendarEvent, day: string): boolean {
  return ev.date <= day && (ev.endDate ?? ev.date) >= day;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

function EventChip({ ev, compact = false }: { ev: CalendarEvent; compact?: boolean }) {
  const cls = cx(
    "relative block w-full truncate rounded-md border py-0.5 pl-2.5 pr-1.5 text-left text-[11px] font-semibold",
    "before:absolute before:inset-y-1 before:left-1 before:w-[3px] before:rounded-full",
    EVENT_BLOCK[ev.hue],
    (ev.href || ev.onClick) && "cursor-pointer hover:brightness-[0.97]",
  );
  const label = compact ? ev.title : `${ev.title}${ev.meta ? ` · ${ev.meta}` : ""}`;
  if (ev.href) {
    return (
      <a href={ev.href} className={cls} title={label}>
        {label}
      </a>
    );
  }
  if (ev.onClick) {
    return (
      <button type="button" onClick={ev.onClick} className={cls} title={label}>
        {label}
      </button>
    );
  }
  return (
    <span className={cls} title={label}>
      {label}
    </span>
  );
}

/** The heading row a calendar card sits under: month name and the arrows. */
export function CalendarNav({
  title,
  onPrev,
  onNext,
  onToday,
  children,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onToday && (
          <button
            type="button"
            onClick={onToday}
            className="h-9 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Today
          </button>
        )}
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white">
          <button type="button" onClick={onPrev} aria-label="Previous" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-l-xl text-neutral-600 hover:bg-neutral-50">
            <ChevronLeft size={17} aria-hidden />
          </button>
          <button type="button" onClick={onNext} aria-label="Next" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-xl border-l border-neutral-200 text-neutral-600 hover:bg-neutral-50">
            <ChevronRight size={17} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A month on a Monday-first grid. Days outside the month are hatched, today
 * is a filled blue dot, weekends and holidays are tinted, and each day lists
 * its events as coloured chips — three, then "+n more".
 */
export function MonthCalendar({
  year,
  month,
  events,
  holidays = {},
  maxPerDay = 3,
  onDayClick,
  spanning = false,
  maxLanes = 3,
}: {
  year: number;
  /** 0-based. */
  month: number;
  events: CalendarEvent[];
  /** `YYYY-MM-DD` → name, drawn as a tinted day. */
  holidays?: Record<string, string>;
  maxPerDay?: number;
  onDayClick?: (day: string) => void;
  /**
   * Draw multi-day events as one continuous bar across their days (and on
   * into the next week's row) instead of a chip on every day.
   */
  spanning?: boolean;
  /** With `spanning`: bars per day before "+n more". */
  maxLanes?: number;
}) {
  if (spanning) {
    return <SpanningMonth year={year} month={month} events={events} holidays={holidays} maxLanes={maxLanes} onDayClick={onDayClick} />;
  }
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  const today = todayYmd();

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/70">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cx("px-3 py-2.5 text-xs font-semibold uppercase tracking-wide", i >= 5 ? "text-neutral-400" : "text-neutral-500")}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: cells }, (_, i) => {
          const dayNum = i - lead + 1;
          const inMonth = dayNum >= 1 && dayNum <= days;
          const col = i % 7;
          if (!inMonth) {
            return <div key={i} className={cx("ws-hatch min-h-[112px] border-neutral-100", col < 6 && "border-r", "border-b")} aria-hidden />;
          }
          const day = ymd(year, month, dayNum);
          const todays = events.filter((e) => covers(e, day));
          const holiday = holidays[day];
          const weekend = col >= 5;
          const isToday = day === today;
          return (
            <div
              key={i}
              className={cx(
                "min-h-[112px] border-b border-neutral-100 p-2",
                col < 6 && "border-r",
                (weekend || holiday) && "bg-neutral-50/80",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={onDayClick ? () => onDayClick(day) : undefined}
                  aria-label={day}
                  className={cx(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums",
                    isToday ? "bg-primary-600 text-white" : weekend ? "text-neutral-400" : "text-neutral-800",
                    onDayClick ? "cursor-pointer hover:ring-2 hover:ring-primary-200" : "cursor-default",
                  )}
                >
                  {dayNum}
                </button>
                {holiday && (
                  <span className="truncate rounded-full bg-sun-100 px-1.5 py-0.5 text-[10px] font-semibold text-sun-700" title={holiday}>
                    {holiday}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {todays.slice(0, maxPerDay).map((ev) => (
                  <EventChip key={ev.id} ev={ev} compact />
                ))}
                {todays.length > maxPerDay && (
                  <p className="px-1 text-[11px] font-semibold text-neutral-500">+{todays.length - maxPerDay} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A week of days against an hour axis, events as pastel blocks with their
 * time on a little chip — the schedule reference. Events without times sit in
 * an "all day" strip above the grid.
 */
export function WeekSchedule({
  days,
  events,
  startHour = 8,
  endHour = 18,
  hourHeight = 64,
}: {
  /** `YYYY-MM-DD`, in order. */
  days: string[];
  events: CalendarEvent[];
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
}) {
  const today = todayYmd();
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const allDay = (day: string) => events.filter((e) => !e.start && covers(e, day));
  const timed = (day: string) => events.filter((e) => e.start && e.date === day);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="min-w-[720px]">
        <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00`);
            const on = d === today;
            return (
              <div key={d} className="border-l border-neutral-100 px-3 py-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{WEEKDAYS[(dt.getDay() + 6) % 7]}</p>
                <p className={cx("mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums", on ? "bg-primary-600 text-white" : "text-neutral-900")}>
                  {dt.getDate()}
                </p>
                <div className="mt-2 space-y-1">
                  {allDay(d).map((ev) => (
                    <EventChip key={ev.id} ev={ev} compact />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="pr-2 text-right text-[11px] font-medium text-neutral-400" style={{ height: hourHeight }}>
                {h % 12 === 0 ? 12 : h % 12} {h < 12 ? "AM" : "PM"}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l border-neutral-100" style={{ height: hours.length * hourHeight }}>
              {hours.map((h) => (
                <div key={h} className="border-b border-dashed border-neutral-100" style={{ height: hourHeight }} />
              ))}
              {timed(d).map((ev) => {
                const s = Math.max(toMin(ev.start as string), startHour * 60);
                const e = Math.min(toMin(ev.end ?? ev.start ?? "00:00") || s + 60, endHour * 60);
                const top = ((s - startHour * 60) / 60) * hourHeight;
                const height = Math.max(36, ((e - s) / 60) * hourHeight - 4);
                return (
                  <div
                    key={ev.id}
                    className={cx("absolute inset-x-1.5 overflow-hidden rounded-xl border p-2", EVENT_BLOCK[ev.hue].replace(/before:\S+/g, ""))}
                    style={{ top: top + 2, height }}
                  >
                    <span className="inline-block rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {ev.start}
                      {ev.end ? ` to ${ev.end}` : ""}
                    </span>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold">{ev.title}</p>
                    {ev.meta && <p className="truncate text-[11px] opacity-80">{ev.meta}</p>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spanning month                                                     */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

/** "5 Oct" for a `YYYY-MM-DD`. */
function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

function dateRange(ev: CalendarEvent): string {
  return ev.endDate && ev.endDate !== ev.date ? `${shortDate(ev.date)} to ${shortDate(ev.endDate)}` : shortDate(ev.date);
}

const LANE_PX = 24;
const DAY_HEAD_PX = 44; // p-2 + the 28px day number + its margin

/** One event as a bar across its days in a week row. Flat, chevroned ends where it carries on. */
function EventBar({
  ev,
  continuesLeft,
  continuesRight,
}: {
  ev: CalendarEvent;
  continuesLeft: boolean;
  continuesRight: boolean;
}) {
  const st = ev.status ? EVENT_STATUS[ev.status] : null;
  const Icon = st?.icon;
  const cls = cx(
    "pointer-events-auto relative flex h-[22px] min-w-0 items-center gap-1 border py-0 text-left text-[11px] font-semibold outline-none",
    "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-300",
    EVENT_BLOCK[ev.hue],
    continuesLeft ? "ml-0 rounded-l-none border-l-0 pl-1" : "ml-1 rounded-l-md pl-2.5 before:absolute before:inset-y-1 before:left-1 before:w-[3px] before:rounded-full",
    continuesRight ? "mr-0 rounded-r-none border-r-0 pr-1" : "mr-1 rounded-r-md pr-1.5",
    (ev.href || ev.onClick) && "cursor-pointer hover:brightness-[0.97]",
  );
  const tip = [ev.title, ev.meta, dateRange(ev), st?.label].filter(Boolean).join(" · ");
  const body = (
    <>
      {continuesLeft && <ChevronLeft size={11} className="shrink-0 opacity-70" aria-hidden />}
      {Icon && <Icon size={11} className="shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{ev.title}</span>
      <span className="sr-only">
        {`, ${dateRange(ev)}`}
        {st ? `, ${st.label}` : ""}
        {continuesLeft ? ", continues from the previous week" : ""}
        {continuesRight ? ", continues into the next week" : ""}
      </span>
      {continuesRight && <ChevronRight size={11} className="shrink-0 opacity-70" aria-hidden />}
    </>
  );
  if (ev.href) {
    return (
      <a href={ev.href} className={cls} title={tip}>
        {body}
      </a>
    );
  }
  if (ev.onClick) {
    return (
      <button type="button" onClick={ev.onClick} className={cls} title={tip}>
        {body}
      </button>
    );
  }
  return (
    <span className={cls} title={tip}>
      {body}
    </span>
  );
}

/**
 * MonthCalendar with `spanning`: each week row lays its events out in lanes
 * (see calendar-lanes.ts), so a five-day leave is one bar, not five chips.
 * Days whose events overflow the lanes say "+n more".
 */
function SpanningMonth({
  year,
  month,
  events,
  holidays,
  maxLanes,
  onDayClick,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  holidays: Record<string, string>;
  maxLanes: number;
  onDayClick?: (day: string) => void;
}) {
  const lanes = Math.max(1, Math.floor(maxLanes));
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((lead + days) / 7);
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, days);
  const today = todayYmd();
  const cellMin = Math.max(112, DAY_HEAD_PX + lanes * LANE_PX + 26);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50/70">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cx("px-3 py-2.5 text-xs font-semibold uppercase tracking-wide", i >= 5 ? "text-neutral-400" : "text-neutral-500")}>
            {d}
          </div>
        ))}
      </div>
      {Array.from({ length: weeks }, (_, w) => {
        const weekStart = addDays(monthStart, w * 7 - lead);
        const placed = allocateLanes(events, weekStart, { from: monthStart, to: monthEnd });
        const shown = placed.filter((p) => p.lane < lanes);
        const hiddenOn = (col: number) => placed.filter((p) => p.lane >= lanes && p.startCol <= col && p.endCol >= col).length;
        return (
          <div key={weekStart} className="relative grid grid-cols-7">
            {Array.from({ length: 7 }, (_, col) => {
              const day = addDays(weekStart, col);
              const inMonth = day >= monthStart && day <= monthEnd;
              if (!inMonth) {
                return <div key={col} className={cx("ws-hatch border-b border-neutral-100", col < 6 && "border-r")} style={{ minHeight: cellMin }} aria-hidden />;
              }
              const dayNum = dayNumber(day) - dayNumber(monthStart) + 1;
              const holiday = holidays[day];
              const weekend = col >= 5;
              const isToday = day === today;
              const more = hiddenOn(col);
              return (
                <div
                  key={col}
                  className={cx("flex flex-col border-b border-neutral-100 p-2", col < 6 && "border-r", (weekend || holiday) && "bg-neutral-50/80")}
                  style={{ minHeight: cellMin }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={onDayClick ? () => onDayClick(day) : undefined}
                      aria-label={day}
                      className={cx(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                        isToday ? "bg-primary-600 text-white" : weekend ? "text-neutral-400" : "text-neutral-800",
                        onDayClick ? "cursor-pointer hover:ring-2 hover:ring-primary-200" : "cursor-default",
                      )}
                    >
                      {dayNum}
                    </button>
                    {holiday && (
                      <span className="truncate rounded-full bg-sun-100 px-1.5 py-0.5 text-[10px] font-semibold text-sun-700" title={holiday}>
                        {holiday}
                      </span>
                    )}
                  </div>
                  <div aria-hidden style={{ height: lanes * LANE_PX }} />
                  {more > 0 && <p className="mt-auto px-1 text-[11px] font-semibold text-neutral-500">+{more} more</p>}
                </div>
              );
            })}
            <div
              className="pointer-events-none absolute inset-x-0 grid grid-cols-7"
              style={{ top: DAY_HEAD_PX, gridAutoRows: `${LANE_PX - 2}px`, rowGap: 2 }}
            >
              {shown.map((p) => (
                <div key={p.event.id} className="flex min-w-0 flex-col" style={{ gridColumn: `${p.startCol + 1} / ${p.endCol + 2}`, gridRow: p.lane + 1 }}>
                  <EventBar ev={p.event} continuesLeft={p.continuesLeft} continuesRight={p.continuesRight} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status chip                                                        */
/* ------------------------------------------------------------------ */

/** A status in words, with its icon and hue. */
export function EventStatusChip({ status, count }: { status: EventStatus; count?: number }) {
  const st = EVENT_STATUS[status];
  const Icon = st.icon;
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", HUE[st.hue].soft)}>
      <Icon size={12} aria-hidden />
      {st.label}
      {count != null && <span className="tabular-nums">{count}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Agenda list                                                        */
/* ------------------------------------------------------------------ */

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayIndex(day: string): number {
  // 1970-01-01 was a Thursday (index 3, Monday first).
  return (((dayNumber(day) + 3) % 7) + 7) % 7;
}

function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAY_LONG[weekdayIndex(day)]} ${d} ${MONTHS[m - 1]} ${y}`;
}

function whenText(ev: CalendarEvent): string {
  if (ev.endDate && ev.endDate !== ev.date) return dateRange(ev);
  if (ev.start && !ev.allDay) return ev.end ? `${ev.start} to ${ev.end}` : ev.start;
  return "All day";
}

function AgendaItem({
  ev,
  statusChips,
  onSelect,
  showDate = false,
}: {
  ev: CalendarEvent;
  statusChips: boolean;
  onSelect?: (e: CalendarEvent) => void;
  showDate?: boolean;
}) {
  const cls =
    "flex w-full min-w-0 items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300";
  const interactive = onSelect || ev.href || ev.onClick;
  const body = (
    <>
      <span className={cx("mt-0.5 w-1 shrink-0 self-stretch rounded-full", HUE[ev.hue].bar)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{ev.title}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500 tabular-nums">
          {showDate && !(ev.endDate && ev.endDate !== ev.date) ? `${shortDate(ev.date)} · ` : ""}
          {whenText(ev)}
          {ev.meta ? ` · ${ev.meta}` : ""}
        </span>
      </span>
      {statusChips && ev.status && <EventStatusChip status={ev.status} />}
    </>
  );
  if (onSelect || ev.onClick) {
    return (
      <button type="button" onClick={() => (onSelect ? onSelect(ev) : ev.onClick?.())} className={cx(cls, "cursor-pointer hover:border-neutral-300 hover:bg-neutral-50/60")}>
        {body}
      </button>
    );
  }
  if (ev.href) {
    return (
      <a href={ev.href} className={cx(cls, "hover:border-neutral-300 hover:bg-neutral-50/60")}>
        {body}
      </a>
    );
  }
  return <div className={cx(cls, !interactive && "cursor-default")}>{body}</div>;
}

/** The day leaf beside a group: weekday, big date, month. */
function DateLeaf({ day, week }: { day: string; week: boolean }) {
  const [, m, d] = day.split("-").map(Number);
  const on = !week && day === todayYmd();
  return (
    <div
      aria-hidden
      className={cx(
        "flex w-12 shrink-0 flex-col items-center self-start rounded-xl border py-1.5 text-center",
        on ? "border-primary-600 bg-primary-600 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-900",
      )}
    >
      <span className={cx("text-[10px] font-semibold uppercase tracking-wide", on ? "text-white" : "text-neutral-500")}>
        {week ? "Week" : WEEKDAYS[weekdayIndex(day)]}
      </span>
      <span className="text-lg font-bold leading-tight tabular-nums">{d}</span>
      <span className={cx("text-[10px] font-medium", on ? "text-white" : "text-neutral-500")}>{SHORT_MONTHS[m - 1]}</span>
    </div>
  );
}

/**
 * Events between `from` and `to` (inclusive) as a list grouped by day or by
 * week, each group behind a date leaf. A multi-day event sits under the first
 * day it is visible. Status chips always carry their word.
 */
export function AgendaList({
  events,
  from,
  to,
  groupBy = "day",
  emptyLabel = "Nothing scheduled for these dates.",
  statusChips = true,
  onSelect,
}: {
  events: CalendarEvent[];
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  groupBy?: "day" | "week";
  emptyLabel?: string;
  statusChips?: boolean;
  onSelect?: (e: CalendarEvent) => void;
}) {
  const inRange = events.filter((e) => e.date <= to && (e.endDate ?? e.date) >= from);
  if (inRange.length === 0) {
    return <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>;
  }

  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of inRange) {
    const first = ev.date < from ? from : ev.date;
    const key = groupBy === "week" ? addDays(first, -weekdayIndex(first)) : first;
    groups.set(key, [...(groups.get(key) ?? []), ev]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const within = (a: CalendarEvent, b: CalendarEvent) =>
    a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title);

  return (
    <ol className="space-y-4">
      {ordered.map(([key, evs]) => (
        <li key={key} className="flex gap-3">
          <DateLeaf day={key} week={groupBy === "week"} />
          <div className="min-w-0 flex-1">
            <p className="sr-only">{groupBy === "week" ? `Week of ${longDate(key)}` : longDate(key)}</p>
            <ul className="space-y-2">
              {evs.sort(within).map((ev) => (
                <li key={ev.id}>
                  <AgendaItem ev={ev} statusChips={statusChips} onSelect={onSelect} showDate={groupBy === "week"} />
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Compliance calendar                                                */
/* ------------------------------------------------------------------ */

/**
 * Deadlines on a month grid, coloured by status, beside a rail that lists
 * them overdue first — the thing a compliance owner opens to see what is
 * late. Overdue items from earlier months stay on the rail until done. The
 * rail drops below the grid under 1024px.
 */
export function ComplianceCalendar({
  year,
  month,
  events,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  /** 0-based. */
  month: number;
  events: CalendarEvent[];
  onSelect?: (e: CalendarEvent) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, new Date(year, month + 1, 0).getDate());
  const inMonth = (e: CalendarEvent) => e.date <= monthEnd && (e.endDate ?? e.date) >= monthStart;

  const gridEvents = events.map((e) => ({
    ...e,
    hue: e.status ? EVENT_STATUS[e.status].hue : e.hue,
    onClick: onSelect ? () => onSelect(e) : e.onClick,
  }));
  const rail = events.filter((e) => inMonth(e) || e.status === "overdue");
  const rank = (e: CalendarEvent) => (e.status ? EVENT_STATUS[e.status].rank : 4);
  const sections = [...STATUS_ORDER, null].map((status) => ({
    status,
    items: rail
      .filter((e) => (e.status ?? null) === status)
      .sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
  }));
  const counts = STATUS_ORDER.map((s) => ({ s, n: rail.filter((e) => e.status === s).length }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <CalendarNav title={monthTitle(year, month)} onPrev={onPrev} onNext={onNext} />
        <MonthCalendar year={year} month={month} events={gridEvents} spanning />
        <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Status key">
          {counts.map(({ s, n }) => (
            <li key={s}>
              <EventStatusChip status={s} count={n} />
            </li>
          ))}
        </ul>
      </div>
      <aside aria-label={`Deadlines, ${monthTitle(year, month)}`} className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="mb-3 text-[15px] font-semibold text-neutral-900">Deadlines</p>
        {rail.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No deadlines this month.</p>
        ) : (
          <div className="space-y-4">
            {sections
              .filter((sec) => sec.items.length > 0)
              .map((sec) => (
                <section key={sec.status ?? "none"} aria-label={sec.status ? EVENT_STATUS[sec.status].label : "No status"}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {sec.status ? EVENT_STATUS[sec.status].label : "No status"} <span className="tabular-nums">· {sec.items.length}</span>
                  </p>
                  <ul className="space-y-2">
                    {sec.items.map((ev) => (
                      <li key={ev.id}>
                        <AgendaItem ev={ev} statusChips onSelect={onSelect} showDate />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </aside>
    </div>
  );
}
