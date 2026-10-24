/*
  Lane allocation for multi-day bars in a month grid. Pure: dates in, columns
  and lanes out. Dates are bare `YYYY-MM-DD` strings, compared as day numbers
  in UTC so no timezone or daylight-saving shift can move a bar by a day.
*/

export interface LaneEvent {
  id: string;
  /** First day, `YYYY-MM-DD`. */
  date: string;
  /** Last day, inclusive. Omit for a single day. */
  endDate?: string;
}

export interface LanePlacement<E extends LaneEvent = LaneEvent> {
  event: E;
  /** 0 (Monday) … 6 (Sunday), inclusive. */
  startCol: number;
  endCol: number;
  /** 0 is the top lane. */
  lane: number;
  /** The event began before the first visible column. */
  continuesLeft: boolean;
  /** The event runs past the last visible column. */
  continuesRight: boolean;
}

/** Days since the epoch for a `YYYY-MM-DD`. */
export function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** `YYYY-MM-DD` plus `n` days. */
export function addDays(ymd: string, n: number): string {
  const t = new Date((dayNumber(ymd) + n) * 86_400_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Place the events that touch the week starting `weekStartYmd` into lanes.
 *
 * Greedy by start: events are taken earliest first (longer first on a tie,
 * then by id, so the order is stable), and each goes in the lowest lane that
 * is free for its whole span. `bounds` narrows the visible columns, the
 * in-month days of a first or last week, so a bar never runs into a day the
 * grid does not show; anything beyond them counts as a continuation.
 */
export function allocateLanes<E extends LaneEvent>(
  events: readonly E[],
  weekStartYmd: string,
  bounds: { from?: string; to?: string } = {},
): LanePlacement<E>[] {
  const week0 = dayNumber(weekStartYmd);
  const firstCol = Math.max(0, Math.min(6, bounds.from ? dayNumber(bounds.from) - week0 : 0));
  const lastCol = Math.max(0, Math.min(6, bounds.to ? dayNumber(bounds.to) - week0 : 6));
  if (lastCol < firstCol) return [];

  const spans = events
    .map((event) => {
      const s = dayNumber(event.date) - week0;
      const rawEnd = dayNumber(event.endDate ?? event.date) - week0;
      const e = Math.max(s, rawEnd); // an end before the start is a one-day event
      return { event, s, e };
    })
    .filter(({ s, e }) => e >= firstCol && s <= lastCol)
    .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s) || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0));

  // laneEnds[k] = last column taken in lane k.
  const laneEnds: number[] = [];
  return spans.map(({ event, s, e }) => {
    const startCol = Math.max(s, firstCol);
    const endCol = Math.min(e, lastCol);
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    return { event, startCol, endCol, lane, continuesLeft: s < firstCol, continuesRight: e > lastCol };
  });
}
