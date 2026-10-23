"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, CalendarRange, Sun, Users } from "lucide-react";
import { hrm, type LeaveRequest } from "@/lib/api/hrm-client";
import { Button, Chip, Panel } from "@/components/workspace/kit";
import { formatDate, formatDayMonth } from "@/suite/hrm/lib/format";
import { Field, useSubmit } from "./Dialog";
import { ModalFrame, Notice, Skeleton, inputCls, textareaCls } from "@/suite/hrm/components/ui2/kit";
import { DecorAvatar } from "@/suite/hrm/components/ui2/me-kit";

/**
 * The two self-service endpoints that had no way in.
 *
 * Both are the unglamorous half of a feature that shipped: the clock works
 * beautifully until somebody forgets to use it, and a leave request is easy to
 * submit and impossible to time well.
 */

/**
 * A day somebody worked and did not clock.
 *
 * `TimeClock` handles the live case — in at the start, out at the end — which
 * is every day until the one where a phone is flat or a shift starts in an
 * emergency. Without this those days are simply missing, and the only fix was
 * for a manager to add the entry on somebody's behalf, which is both slower
 * and a worse record of who said what.
 */
export function RecordMissedDayDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** Told which day was added, so the page can open the week it landed in. */
  onSaved: (workDate?: string) => void;
}) {
  const [workDate, setWorkDate] = useState("");
  const [clockInAt, setClockInAt] = useState("");
  const [clockOutAt, setClockOutAt] = useState("");
  const [note, setNote] = useState("");
  const { submit, saving, error } = useSubmit(() => onSaved(workDate));

  return (
    <ModalFrame
      title="Add a day you missed"
      subtitle="A day you worked and did not clock. It goes to your manager like any other entry."
      icon={CalendarPlus}
      hue="sky"
      onClose={onClose}
      onSubmit={(e) =>
        submit(e, () =>
          hrm.me.recordDay({
            workDate,
            clockInAt,
            clockOutAt,
            note: note === "" ? undefined : note,
          }),
        )
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || workDate === "" || clockInAt === "" || clockOutAt === ""}
          >
            {saving ? "Saving…" : "Add it"}
          </Button>
        </>
      }
    >
      <Field id="md-date" label="Which day">
        <input
          id="md-date"
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="md-in" label="Started">
          <input
            id="md-in"
            type="time"
            value={clockInAt}
            onChange={(e) => setClockInAt(e.target.value)}
            required
            className={inputCls}
          />
        </Field>

        <Field id="md-out" label="Finished">
          <input
            id="md-out"
            type="time"
            value={clockOutAt}
            onChange={(e) => setClockOutAt(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
      </div>

      {/*
        Asked for, because an entry added after the fact is the one a manager
        is most likely to query — and "I forgot to clock in, I was on the
        ward from seven" answers it before it is asked.
      */}
      <Field
        id="md-note"
        label="What happened"
        hint="Worth a line. An entry added later is the one most likely to be queried."
      >
        {/* Plain text on purpose: a one-line note on a time entry, which the system adds sentences to. */}
        <textarea
          id="md-note"
          aria-describedby="md-note-hint"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={textareaCls}
        />
      </Field>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Who else is away                                                   */
/* ------------------------------------------------------------------ */

export interface TeamAwayState {
  rows: LeaveRequest[] | null;
  holidays: { name: string; observedOn: string }[];
  error: string | null;
  days: number;
}

/**
 * The team's booked leave over the next `days` days, and the public holidays
 * in that window. A hook so the leave page can put the same answer on its
 * calendar and in its side panel from one request.
 */
export function useTeamAway(days = 60): TeamAwayState {
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [holidays, setHolidays] = useState<{ name: string; observedOn: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.me
      .leaveCalendar({ days })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setHolidays(result.meta.holidays);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  return { rows, holidays, error, days };
}

/**
 * Who else is already off.
 *
 * The one piece of information that makes a leave request likely to be
 * approved, and it was the one piece nobody could see. Booking the week three
 * colleagues have already booked is not a scheduling preference, it is a
 * declined request and a wasted fortnight of planning.
 *
 * Deliberately shows the team, not the institution: who is away in a
 * department nobody works with is neither useful nor anybody's business.
 */
export function TeamAway({ days = 60 }: { days?: number }) {
  const state = useTeamAway(days);
  return <TeamAwayPanel state={state} />;
}

export function TeamAwayPanel({ state, className }: { state: TeamAwayState; className?: string }) {
  const { rows, holidays, error, days } = state;

  return (
    <Panel
      className={className}
      title="Who else is away"
      subtitle={`Your team, over the next ${days} days. Worth a look before you pick your dates.`}
      icon={Users}
      hue="grape"
      bodyClassName="p-5 pt-4"
    >
      {error !== null ? (
        <p className="text-sm text-neutral-600">{error}</p>
      ) : rows === null ? (
        <Skeleton className="h-24" />
      ) : rows.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
          <CalendarRange size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
          <div>
            <p className="text-sm text-neutral-700">Nobody on your team is booked off.</p>
            {holidays.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                Closed: {holidays.map((h) => h.name).join(", ")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <DecorAvatar name={row.employee?.name ?? "A colleague"} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    {row.employee?.name ?? "A colleague"}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {formatDate(row.startsOn)} – {formatDate(row.endsOn)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/*
            Public holidays alongside, because leave spanning one is not
            charged for it — which changes which week is worth asking for.
          */}
          {holidays.length > 0 && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="flex flex-wrap gap-1.5">
                {holidays.map((h) => (
                  <Chip key={`${h.name}-${h.observedOn}`} hue="sun" icon={Sun}>
                    {h.name} · {formatDayMonth(h.observedOn)}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Closed on these days. Leave spanning one of them is not charged for it.
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
