"use client";

import { Plus } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { eventBlockClass, todayYmd } from "@/components/workspace/Calendar";
import { hueFor } from "@/components/workspace/modules";
import { dayLabel, localHm, localYmd, minuteOfDay, nowMinute } from "./labels";

/*
  Room bookings on a week. Two views of the same thing:

  - `RoomsWeekGrid`: every room a row, every day a column. Each cell is the
    working day as a strip, booked stretches filled in, with the bookings
    listed under it: the whole building's week at a glance.
  - `RoomSlots`: one room, days across, hours down. Booked hours are blocks;
    each free hour is a button that starts a booking there.
*/

export interface WeekBooking {
  id: string;
  spaceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  bookedBy: string | null;
  mine?: boolean;
}

export interface WeekRoom {
  id: string;
  name: string;
  capacity: number | null;
  facility?: string | null;
}

/** The working day the strips and slots draw. */
export const DAY_START = 8;
export const DAY_END = 18;

const overlapsDay = (b: WeekBooking, day: string) => localYmd(b.startsAt) <= day && localYmd(b.endsAt) >= day;

/** Minutes of a booking inside a day, clamped to the day. */
function within(b: WeekBooking, day: string): [number, number] {
  const s = localYmd(b.startsAt) < day ? 0 : minuteOfDay(b.startsAt);
  const e = localYmd(b.endsAt) > day ? 24 * 60 : minuteOfDay(b.endsAt);
  return [s, e];
}

export function RoomsWeekGrid({ rooms, bookings, days, onSelect }: { rooms: WeekRoom[]; bookings: WeekBooking[]; days: string[]; onSelect?: (b: WeekBooking) => void }) {
  const today = todayYmd();
  const span = (DAY_END - DAY_START) * 60;
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white">
      <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
        <caption className="sr-only">Room bookings, rooms by day</caption>
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50">
            <th scope="col" className="w-44 px-4 py-3 text-left text-xs font-semibold text-neutral-500">
              Room
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className="border-l border-neutral-100 px-2 py-3 text-center">
                <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", d === today ? "bg-primary-600 text-white" : "text-neutral-700")}>{dayLabel(d)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100 last:border-0">
              <th scope="row" className="px-4 py-3 text-left align-top">
                <span className="block truncate text-sm font-semibold text-neutral-900">{r.name}</span>
                <span className="block truncate text-xs font-normal text-neutral-500">{[r.facility, r.capacity ? `seats ${r.capacity}` : null].filter(Boolean).join(" · ")}</span>
              </th>
              {days.map((d) => {
                const list = bookings.filter((b) => b.spaceId === r.id && overlapsDay(b, d)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                return (
                  <td key={d} className={cx("border-l border-neutral-100 px-2 py-2.5 align-top", d === today && "bg-primary-50/30")}>
                    {/* The working day, booked stretches filled. */}
                    <div className="ws-hatch relative mb-2 h-2 overflow-hidden rounded-full" aria-hidden>
                      {list.map((b) => {
                        const [s, e] = within(b, d);
                        const a = Math.max(0, s - DAY_START * 60);
                        const z = Math.min(span, e - DAY_START * 60);
                        return z > a ? (
                          <span key={b.id} className={cx("absolute inset-y-0 rounded-full", b.mine ? "bg-primary-500" : "bg-grape-500")} style={{ left: `${(a / span) * 100}%`, width: `${((z - a) / span) * 100}%` }} />
                        ) : null;
                      })}
                    </div>
                    {list.length === 0 ? (
                      <span className="block text-center text-[11px] text-neutral-400">Free</span>
                    ) : (
                      <ul className="space-y-1">
                        {list.map((b) => {
                          const label = `${localHm(b.startsAt)} to ${localHm(b.endsAt)} ${b.title}${b.bookedBy ? `, ${b.bookedBy}` : ""}`;
                          const cls = cx(
                            "relative block w-full truncate rounded-md border py-1 pl-2.5 pr-1.5 text-left text-[11px] font-semibold",
                            "before:absolute before:inset-y-1 before:left-1 before:w-[3px] before:rounded-full",
                            eventBlockClass(b.mine ? "blue" : hueFor(b.bookedBy ?? b.title)),
                          );
                          return (
                            <li key={b.id}>
                              {onSelect ? (
                                <button type="button" className={cx(cls, "cursor-pointer outline-none hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300")} title={label} onClick={() => onSelect(b)}>
                                  <span className="tabular-nums opacity-80">{localHm(b.startsAt)}</span> {b.title}
                                </button>
                              ) : (
                                <span className={cls} title={label}>
                                  <span className="tabular-nums opacity-80">{localHm(b.startsAt)}</span> {b.title}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One room's week, hour by hour: booked hours as blocks, free hours as buttons. */
export function RoomSlots({
  room,
  bookings,
  days,
  onPick,
  onSelect,
}: {
  room: WeekRoom;
  bookings: WeekBooking[];
  days: string[];
  /** A free hour was chosen: `day`, `HH:MM`. */
  onPick: (day: string, start: string) => void;
  onSelect?: (b: WeekBooking) => void;
}) {
  const today = todayYmd();
  const nowMin = nowMinute();
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const H = 52;
  const mine = bookings.filter((b) => b.spaceId === room.id);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white">
      <div className="min-w-[760px]">
        <div className="grid border-b border-neutral-100 bg-neutral-50" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div />
          {days.map((d) => (
            <div key={d} className="border-l border-neutral-100 px-2 py-2.5 text-center">
              <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", d === today ? "bg-primary-600 text-white" : "text-neutral-700")}>{dayLabel(d)}</span>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div aria-hidden>
            {hours.map((h) => (
              <div key={h} className="pr-2 pt-1 text-right text-[11px] font-medium tabular-nums text-neutral-400" style={{ height: H }}>
                {pad(h)}:00
              </div>
            ))}
          </div>
          {days.map((d) => {
            const list = mine.filter((b) => overlapsDay(b, d));
            const busy = (h: number) => list.some((b) => {
              const [s, e] = within(b, d);
              return s < (h + 1) * 60 && e > h * 60;
            });
            return (
              <div key={d} className="relative border-l border-neutral-100" style={{ height: hours.length * H }}>
                {hours.map((h) => {
                  const past = d < today || (d === today && (h + 1) * 60 <= nowMin);
                  const taken = busy(h);
                  return (
                    <div key={h} className="border-b border-dashed border-neutral-100 p-1" style={{ height: H }}>
                      {!taken && !past && (
                        <button
                          type="button"
                          onClick={() => onPick(d, `${pad(h)}:00`)}
                          aria-label={`Book ${room.name} on ${dayLabel(d)} at ${pad(h)}:00`}
                          className="group flex h-full w-full cursor-pointer items-center justify-center rounded-lg text-[11px] font-semibold text-transparent outline-none transition hover:bg-primary-50 hover:text-primary-700 focus-visible:bg-primary-50 focus-visible:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          <Plus size={13} className="mr-0.5" aria-hidden />
                          {pad(h)}:00
                        </button>
                      )}
                      {past && !taken && <span className="ws-hatch block h-full w-full rounded-lg opacity-60" aria-hidden />}
                    </div>
                  );
                })}
                {list.map((b) => {
                  const [s, e] = within(b, d);
                  const top = ((Math.max(s, DAY_START * 60) - DAY_START * 60) / 60) * H;
                  const bottom = ((Math.min(e, DAY_END * 60) - DAY_START * 60) / 60) * H;
                  if (bottom <= top) return null;
                  const label = `${localHm(b.startsAt)} to ${localHm(b.endsAt)}: ${b.mine ? b.title : `booked${b.bookedBy ? ` by ${b.bookedBy}` : ""}`}`;
                  const cls = cx(
                    "absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] font-semibold",
                    b.mine ? eventBlockClass("blue") : "border-neutral-200 bg-neutral-100 text-neutral-600",
                  );
                  const inner = (
                    <>
                      <span className="block tabular-nums opacity-80">
                        {localHm(b.startsAt)} to {localHm(b.endsAt)}
                      </span>
                      <span className="block truncate">{b.mine ? b.title : "Busy"}</span>
                      {!b.mine && b.bookedBy && <span className="block truncate font-normal">{b.bookedBy}</span>}
                    </>
                  );
                  return b.mine && onSelect ? (
                    <button key={b.id} type="button" title={label} aria-label={label} onClick={() => onSelect(b)} className={cx(cls, "cursor-pointer outline-none hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300")} style={{ top: top + 2, height: bottom - top - 4 }}>
                      {inner}
                    </button>
                  ) : (
                    <div key={b.id} title={label} role="img" aria-label={label} className={cls} style={{ top: top + 2, height: bottom - top - 4 }}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
