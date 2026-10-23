"use client";

import { cx } from "@/components/workspace/kit";
import { eventBlockClass, todayYmd } from "@/components/workspace/Calendar";
import type { Hue } from "@/components/workspace/modules";

/*
  A week of shifts against an hour axis, Taskora style, with overlapping
  shifts indented so both stay visible. The kit's `WeekSchedule` stacks
  overlapping events on top of each other, which on a rota — where an early
  and a day shift always overlap — hides half the week.
*/

export interface RotaBlock {
  id: string;
  date: string;
  /** `HH:MM`. */
  start: string;
  /** `HH:MM`; may be earlier than `start` for an overnight shift. */
  end: string;
  overnight?: boolean;
  title: string;
  meta?: string;
  hue: Hue;
  draft?: boolean;
  onClick?: () => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function endMin(b: RotaBlock): number {
  const e = toMin(b.end);
  return b.overnight || e <= toMin(b.start) ? 24 * 60 : e;
}

/**
 * Greedy lanes per day: each block takes the first lane free at its start.
 * Overlapping blocks are indented rather than squeezed into equal columns —
 * rota shifts usually overlap by an hour at handover, and halving every
 * block for that hour makes the whole week unreadable.
 */
function laneOut(blocks: RotaBlock[]): { block: RotaBlock; lane: number }[] {
  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const laneEnds: number[] = [];
  return sorted.map((block) => {
    const s = toMin(block.start);
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = endMin(block);
    return { block, lane };
  });
}

export function RotaWeek({
  days,
  blocks,
  hourHeight = 52,
}: {
  days: string[];
  blocks: RotaBlock[];
  hourHeight?: number;
}) {
  const today = todayYmd();
  const starts = blocks.map((b) => Math.floor(toMin(b.start) / 60));
  const ends = blocks.map((b) => Math.ceil(endMin(b) / 60));
  const startHour = blocks.length ? Math.max(0, Math.min(...starts) - 1) : 7;
  const endHour = blocks.length ? Math.min(24, Math.max(...ends) + 1) : 19;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const cols = `64px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="min-w-[860px]">
        <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d, i) => {
            const dt = new Date(`${d}T12:00:00`);
            const on = d === today;
            return (
              <div key={d} className="border-l border-neutral-100 px-3 py-3 text-center">
                <p className={cx("text-[11px] font-semibold uppercase tracking-wide", i >= 5 ? "text-neutral-400" : "text-neutral-500")}>
                  {WEEKDAYS[(dt.getDay() + 6) % 7]}
                </p>
                <p
                  className={cx(
                    "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    on ? "bg-primary-600 text-white" : "text-neutral-900",
                  )}
                >
                  {dt.getDate()}
                </p>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div>
            {hours.map((h) => (
              <div key={h} className="-translate-y-2 pr-2 text-right text-[11px] font-medium text-neutral-500" style={{ height: hourHeight }}>
                {h % 12 === 0 ? 12 : h % 12} {h < 12 || h === 24 ? "AM" : "PM"}
              </div>
            ))}
          </div>
          {days.map((d, i) => (
            <div
              key={d}
              className={cx("relative border-l border-neutral-100", i >= 5 && "bg-neutral-50/60")}
              style={{ height: hours.length * hourHeight }}
            >
              {hours.map((h) => (
                <div key={h} className="border-b border-dashed border-neutral-100" style={{ height: hourHeight }} />
              ))}
              {laneOut(blocks.filter((b) => b.date === d)).map(({ block: b, lane }) => {
                const s = Math.max(toMin(b.start), startHour * 60);
                const e = Math.min(endMin(b), endHour * 60);
                const top = ((s - startHour * 60) / 60) * hourHeight;
                const height = Math.max(40, ((e - s) / 60) * hourHeight - 4);
                const indent = Math.min(lane * 22, 44);
                const cls = cx(
                  "absolute overflow-hidden rounded-xl border p-2 text-left shadow-sm",
                  eventBlockClass(b.hue).replace(/before:\S+/g, ""),
                  b.draft && "border-dashed",
                  b.onClick && "cursor-pointer outline-none hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300",
                );
                const style = {
                  top: top + 2,
                  height,
                  left: `calc(${indent}% + 4px)`,
                  width: `calc(${100 - indent}% - 8px)`,
                  zIndex: lane + 1,
                };
                const inner = (
                  <>
                    <span className="inline-block whitespace-nowrap rounded-md bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {b.start} to {b.end}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold">{b.title}</span>
                    {b.draft && <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">Draft</span>}
                    {b.meta && <span className="block line-clamp-2 text-[11px] opacity-80">{b.meta}</span>}
                  </>
                );
                return b.onClick ? (
                  <button key={b.id} type="button" onClick={b.onClick} className={cls} style={style}>
                    {inner}
                  </button>
                ) : (
                  <div key={b.id} className={cls} style={style}>
                    {inner}
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
