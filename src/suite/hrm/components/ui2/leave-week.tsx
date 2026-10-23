"use client";

import Link from "next/link";
import { cx } from "@/components/workspace/kit";
import { eventBlockClass, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { PersonAvatar } from "@/components/workspace/kit";

/*
  A week of all-day absences, Taskora style: seven columns, each day's people
  as pastel blocks. The kit's `WeekSchedule` is built for timed events; leave
  has no hours, so it would render as an hour axis with nothing on it.
*/

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function LeaveWeek({
  days,
  events,
  holidays = {},
}: {
  days: string[];
  events: CalendarEvent[];
  holidays?: Record<string, string>;
}) {
  const today = todayYmd();

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((d, i) => {
          const dt = new Date(`${d}T12:00:00`);
          const on = d === today;
          const weekend = i >= 5;
          const holiday = holidays[d];
          const todays = events.filter((e) => e.date <= d && (e.endDate ?? e.date) >= d);
          return (
            <div
              key={d}
              className={cx(
                "flex min-h-[320px] flex-col border-neutral-100",
                i < 6 && "border-r",
                (weekend || holiday) && "bg-neutral-50/80",
              )}
            >
              <div className="border-b border-neutral-100 px-3 py-3 text-center">
                <p className={cx("text-[11px] font-semibold uppercase tracking-wide", weekend ? "text-neutral-400" : "text-neutral-500")}>
                  {WEEKDAYS[i]}
                </p>
                <p
                  className={cx(
                    "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    on ? "bg-primary-600 text-white" : "text-neutral-900",
                  )}
                >
                  {dt.getDate()}
                </p>
                {holiday && (
                  <p className="mt-1.5 truncate rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-semibold text-sun-700" title={holiday}>
                    {holiday}
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-1.5 p-2">
                {todays.length === 0 && !holiday && !weekend && (
                  <p className="pt-2 text-center text-[11px] text-neutral-500">Everyone in</p>
                )}
                {todays.map((ev) => {
                  const body = (
                    <>
                      <span className="flex items-center gap-1.5">
                        <PersonAvatar name={ev.title.replace(/ \(pending\)$/, "")} size={20} />
                        <span className="truncate text-xs font-semibold">{ev.title}</span>
                      </span>
                      {ev.meta && <span className="mt-0.5 block truncate text-[11px] opacity-80">{ev.meta}</span>}
                    </>
                  );
                  const cls = cx(
                    "relative block rounded-xl border py-2 pl-3 pr-2 text-left",
                    "before:absolute before:inset-y-2 before:left-1 before:w-[3px] before:rounded-full",
                    eventBlockClass(ev.hue),
                  );
                  return ev.href ? (
                    <Link key={ev.id} href={ev.href} className={cx(cls, "outline-none hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300")}>
                      {body}
                    </Link>
                  ) : (
                    <div key={ev.id} className={cls}>
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
