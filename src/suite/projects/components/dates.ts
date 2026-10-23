/**
 * Calendar dates, in the reader's own timezone.
 *
 * **`new Date().toISOString().slice(0, 10)` is not today.** It is today *in
 * UTC*, and an `<input type="date">` reads and writes local dates — so the two
 * disagree by a day for most of the world, for part of every day, in opposite
 * directions:
 *
 *   - Lagos (UTC+1), 00:30 on the 6th → UTC says the 5th. A `max` built that
 *     way **rejects today**, and a default lands on yesterday.
 *   - Chicago (UTC−6), 20:00 on the 5th → UTC says the 6th. A `max` built that
 *     way permits **tomorrow**, and a default lands on a day that has not
 *     happened.
 *
 * Both are invisible to anybody testing in UTC during office hours, which is
 * how they ship. Everything in this module works from local date parts, and
 * every date field in Projects goes through it.
 */

/** A `Date` as `YYYY-MM-DD`, from its local parts rather than via UTC. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** Today, as the reader's calendar has it. */
export function today(): string {
  return isoDate(new Date());
}
