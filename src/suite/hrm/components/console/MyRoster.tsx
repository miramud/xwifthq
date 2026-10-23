"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CalendarRange, Check, Clock, MapPin, Moon, PieChart, X } from "lucide-react";
import {
  ApiError,
  hrm,
  type AttendanceTotals,
  type RosterAssignment,
  type ShiftSwapRequest,
} from "@/lib/api/hrm-client";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Donut, Legend } from "@/components/workspace/charts";
import {
  CalendarNav,
  MonthCalendar,
  WeekSchedule,
  monthTitle,
  todayYmd,
  type CalendarEvent,
} from "@/components/workspace/Calendar";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  DateLeaf,
  LoadFailed,
  ModalFrame,
  Notice,
  PageSkeleton,
  SoftButton,
  ToneChip,
  addDays,
  labelCls,
  weekOf,
} from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import {
  formatDate,
  formatMinutes,
  formatShiftTimes,
  swapTone,
} from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/**
 * My shifts, and asking somebody to cover one.
 *
 * Only published shifts appear. A draft roster is half-built, and somebody
 * planning their fortnight around one is exactly the failure the publish step
 * exists to prevent — so an unpublished shift is not shown as provisional here,
 * it is not shown at all.
 *
 * The attendance figures are the same ones the HR manager sees. A system whose
 * numbers only surface when somebody is being asked about them produces
 * arguments rather than corrections, and the person a day belongs to is the one
 * most likely to spot that it was recorded wrongly.
 */
export default function MyRoster() {
  const [shifts, setShifts] = useState<RosterAssignment[] | null>(null);
  const [expected, setExpected] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [awaitingMe, setAwaitingMe] = useState(0);
  const [totals, setTotals] = useState<AttendanceTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offering, setOffering] = useState<RosterAssignment | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        hrm.me.roster(),
        hrm.me.swaps(),
        /*
          The fortnight just gone, today included — the same window as HR's
          dossier. Without `from` the API starts at this Monday and runs two
          weeks forward, so the "last fortnight" figure was mostly days that
          had not happened yet.
        */
        hrm.me.attendance({ from: addDaysYmd(todayYmdLocal(), -13), days: 13 }),
      ])
        .then(([roster, swapRes, attendance]) => {
          setShifts(roster.data);
          setExpected(roster.meta.expectedMinutes);
          setFrom(roster.meta.from ?? null);
          setSwaps(swapRes.data);
          setAwaitingMe(swapRes.meta.awaitingMe);
          setTotals(attendance.totals);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      eyebrow="My employment"
      title="My rota"
      subtitle="Your published shifts for the next fortnight, and any swaps in progress"
    />
  );

  if (error !== null && shifts === null) {
    return (
      <div>
        {header}
        <LoadFailed icon={CalendarRange} title="Could not load your rota" message={error} />
      </div>
    );
  }

  if (shifts === null) {
    return <PageSkeleton stats={3} />;
  }

  const open = swaps.filter((s) => s.isOpen);

  return (
    <div className="space-y-6">
      {header}

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <StatGrid cols={3}>
        <StatCard
          featured
          icon={CalendarRange}
          label="Shifts in the next fortnight"
          value={String(shifts.length)}
          hint={`${formatMinutes(expected)} rostered`}
        />
        <StatCard
          icon={Check}
          hue="mint"
          label="Attendance"
          value={
            totals?.attendanceRate === null || totals === null
              ? "—"
              : `${totals.attendanceRate}%`
          }
          hint="Last fortnight"
        />
        <StatCard
          icon={ArrowLeftRight}
          hue={awaitingMe > 0 ? "sun" : "slate"}
          label="Swaps needing your answer"
          value={String(awaitingMe)}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <ShiftCalendar shifts={shifts} from={from} className="xl:col-span-2" />
        <AttendancePanel totals={totals} />
      </div>

      <section aria-labelledby="shifts-heading">
        <SectionHead id="shifts-heading" title="My shifts" subtitle="The next fortnight" />
        {shifts.length === 0 ? (
          <Card>
            <Empty
              icon={CalendarRange}
              hue="grape"
              title="No shifts published"
              hint="Your manager publishes the rota once it is settled. Nothing here means nothing final yet."
            />
          </Card>
        ) : (
          <ShiftList shifts={shifts} onOffer={setOffering} />
        )}
      </section>

      <SwapList rows={open} onChanged={load} />

      {offering !== null && (
        <OfferDialog
          shift={offering}
          onClose={() => setOffering(null)}
          onAsked={() => {
            setOffering(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar                                                           */
/* ------------------------------------------------------------------ */

const shiftName = (s: RosterAssignment) => s.shift?.name ?? "Shift";
const shiftHue = (s: RosterAssignment): Hue => hueFor(shiftName(s));

function ShiftCalendar({
  shifts,
  from,
  className,
}: {
  shifts: RosterAssignment[];
  from: string | null;
  className?: string;
}) {
  const today = todayYmd();
  const anchor = from && from > today ? from : today;
  const [view, setView] = useState<"week" | "month">("week");
  const [weekStart, setWeekStart] = useState(() => weekOf(anchor)[0]);
  const [cursor, setCursor] = useState({ y: Number(anchor.slice(0, 4)), m: Number(anchor.slice(5, 7)) - 1 });

  const events = useMemo<CalendarEvent[]>(
    () =>
      shifts.map((s) => ({
        id: s.id,
        date: s.worksOn.slice(0, 10),
        title: shiftName(s),
        // A night shift is drawn to midnight and says where it really ends.
        start: s.startsAt,
        end: s.crossesMidnight ? "24:00" : s.endsAt,
        meta: [s.location, s.crossesMidnight ? `ends ${s.endsAt} next day` : null].filter(Boolean).join(" · ") || undefined,
        hue: shiftHue(s),
      })),
    [shifts],
  );

  // The month grid lists a day's shifts as chips, so it takes them without times.
  const monthEvents = useMemo(
    () => events.map((e) => ({ id: e.id, date: e.date, title: e.title, meta: e.meta, hue: e.hue })),
    [events],
  );

  const hours = shifts.flatMap((s) => [
    Number(s.startsAt.slice(0, 2)),
    s.crossesMidnight ? 24 : Math.ceil(Number(s.endsAt.slice(0, 2)) + Number(s.endsAt.slice(3, 5)) / 60),
  ]);
  const startHour = hours.length ? Math.max(0, Math.min(...hours) - 1) : 8;
  const endHour = hours.length ? Math.min(24, Math.max(...hours) + 1) : 18;

  const patterns = Array.from(new Set(shifts.map(shiftName)));
  const days = weekOf(weekStart);

  const navTitle =
    view === "week" ? `${formatDate(days[0])} – ${formatDate(days[6])}` : monthTitle(cursor.y, cursor.m);

  return (
    <Panel className={className} title="Your rota" subtitle="Each pattern has its own colour" icon={CalendarRange} hue="grape">
      <CalendarNav
        title={navTitle}
        onPrev={() =>
          view === "week"
            ? setWeekStart((w) => addDays(w, -7))
            : setCursor(({ y, m }) => {
                const d = new Date(y, m - 1, 1);
                return { y: d.getFullYear(), m: d.getMonth() };
              })
        }
        onNext={() =>
          view === "week"
            ? setWeekStart((w) => addDays(w, 7))
            : setCursor(({ y, m }) => {
                const d = new Date(y, m + 1, 1);
                return { y: d.getFullYear(), m: d.getMonth() };
              })
        }
        onToday={() => {
          setWeekStart(weekOf(today)[0]);
          setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
        }}
      >
        <Segmented
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
          ]}
        />
      </CalendarNav>
      {view === "week" ? (
        <WeekSchedule days={days} events={events} startHour={startHour} endHour={endHour} hourHeight={44} />
      ) : (
        <MonthCalendar year={cursor.y} month={cursor.m} events={monthEvents} />
      )}
      {patterns.length > 0 && (
        <div className="mt-4">
          <Legend items={patterns.map((p) => ({ label: p, hue: hueFor(p) }))} />
        </div>
      )}
    </Panel>
  );
}

function AttendancePanel({ totals }: { totals: AttendanceTotals | null }) {
  const c = totals?.counts;
  const slices = c
    ? [
        { label: "Worked", value: c.worked, hue: "mint" as Hue },
        { label: "Late", value: c.late, hue: "sun" as Hue },
        { label: "On leave", value: c.on_leave, hue: "sky" as Hue },
        { label: "Holiday", value: c.holiday, hue: "grape" as Hue },
        { label: "Absent", value: c.absent, hue: "rose" as Hue },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <Panel title="Your last fortnight" subtitle="The same figures your manager sees" icon={PieChart} hue="mint">
      {totals === null || slices.length === 0 ? (
        <Empty icon={Clock} hue="mint" title="No days recorded yet" hint="Days appear here once you have worked a rostered shift." />
      ) : (
        <div className="space-y-5">
          <Donut data={slices} total={totals.days} centerLabel="days" legend="below" size={170} caption="Your attendance over the last fortnight" />
          <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Worked</p>
              <p className="font-bold tabular-nums text-neutral-900">{formatMinutes(totals.workedMinutes)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Late in all</p>
              <p className="font-bold tabular-nums text-neutral-900">{formatMinutes(totals.lateMinutes)}</p>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Shifts                                                             */
/* ------------------------------------------------------------------ */

function ShiftList({
  shifts,
  onOffer,
}: {
  shifts: RosterAssignment[];
  onOffer: (s: RosterAssignment) => void;
}) {
  const ask = (s: RosterAssignment) => (
    <Button size="sm" icon={ArrowLeftRight} onClick={() => onOffer(s)}>
      Ask to swap
    </Button>
  );

  const columns: Column<RosterAssignment>[] = [
    {
      key: "shift",
      header: "Shift",
      primary: true,
      sortable: true,
      value: shiftName,
      render: (s) => (
        <span className="flex items-center gap-2.5">
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[shiftHue(s)].dot)} aria-hidden />
          <span className="font-semibold text-neutral-900">{shiftName(s)}</span>
        </span>
      ),
    },
    { key: "date", header: "Date", sortable: true, value: (s) => s.worksOn, render: (s) => formatDate(s.worksOn) },
    {
      key: "times",
      header: "Times",
      value: (s) => formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight),
      render: (s) => <span className="tabular-nums">{formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight)}</span>,
    },
    { key: "hours", header: "Hours", align: "right", sortable: true, value: (s) => s.expectedMinutes, render: (s) => formatMinutes(s.expectedMinutes) },
    { key: "location", header: "Where", sortable: true, value: (s) => s.location, hideOnMobile: true },
    {
      key: "flags",
      header: "",
      render: (s) => (s.crossesMidnight ? <Chip hue="sky" icon={Moon}>Overnight</Chip> : null),
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: ask },
  ];

  return (
    <DataView<RosterAssignment>
      rows={shifts}
      rowKey={(s) => s.id}
      columns={columns}
      storageKey="hrm.me.roster"
      caption="Your shifts"
      searchPlaceholder="Search shifts"
      gridCols={3}
      renderCard={(s) => {
        const hue = shiftHue(s);
        return (
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <DateLeaf date={s.worksOn} hue={hue} />
              {s.crossesMidnight && <Chip hue="sky" icon={Moon}>Overnight</Chip>}
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">{shiftName(s)}</p>
              <p className="text-xs text-neutral-500">{formatDate(s.worksOn)}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-1 tabular-nums">
                <Clock size={12} aria-hidden />
                {formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight)} · {formatMinutes(s.expectedMinutes)}
              </span>
              {s.location && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-1">
                  <MapPin size={12} aria-hidden />
                  {s.location}
                </span>
              )}
            </div>
            <div className="mt-auto">{ask(s)}</div>
          </div>
        );
      }}
      renderListItem={(s) => (
        <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
          <DateLeaf date={s.worksOn} hue={shiftHue(s)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{shiftName(s)}</p>
            <p className="truncate text-xs text-neutral-500">
              {formatDate(s.worksOn)} · {formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight)} ·{" "}
              {formatMinutes(s.expectedMinutes)}
              {s.location ? ` · ${s.location}` : ""}
            </p>
          </div>
          {s.crossesMidnight && <Chip hue="sky" icon={Moon}>Overnight</Chip>}
          {ask(s)}
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Swaps                                                              */
/* ------------------------------------------------------------------ */

function SwapList({
  rows,
  onChanged,
}: {
  rows: ShiftSwapRequest[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (row: ShiftSwapRequest, accepted: boolean) => {
    setBusy(row.id);

    try {
      await hrm.me.respondToSwap(row.id, accepted);
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (row: ShiftSwapRequest) => {
    setBusy(row.id);

    try {
      await hrm.me.cancelSwap(row.id);
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const summary = (row: ShiftSwapRequest) => {
    const day = row.offered ? formatDate(row.offered.worksOn) : "a shift";
    return row.myRole === "requester"
      ? `You asked ${row.requestedTo?.name ?? "a colleague"} to ${row.isGiveaway ? "take" : "swap"} ${day}`
      : `${row.requestedBy?.name ?? "Somebody"}${row.isGiveaway ? " asked you to take " : " asked to swap "}${day}`;
  };

  const detail = (row: ShiftSwapRequest) =>
    `${
      row.offered
        ? formatShiftTimes(row.offered.startsAt, row.offered.endsAt, row.offered.crossesMidnight)
        : "Shift no longer exists"
    }${row.wanted ? ` ⇄ ${formatDate(row.wanted.worksOn)}` : ""}`;

  const actions = (row: ShiftSwapRequest) => (
    <span className="flex shrink-0 items-center justify-end gap-1.5">
      {/*
        Only the colleague who was asked answers, and only while it is
        still with them. Once they agree it belongs to a manager, and
        showing the buttons anyway would promise something the API
        refuses. Both answers are labelled: an unlabelled ✕ beside "Agree"
        read as "close", not as "no".
      */}
      {row.myRole === "colleague" && row.awaitsColleague && (
        <>
          <Button size="sm" icon={X} onClick={() => void answer(row, false)} disabled={busy === row.id}>
            Decline
          </Button>
          <SoftButton hue="mint" icon={Check} onClick={() => void answer(row, true)} disabled={busy === row.id}>
            Agree
          </SoftButton>
        </>
      )}

      {/* Withdrawing is the requester's alone, until a manager decides. */}
      {row.myRole === "requester" && row.isOpen && (
        <Button size="sm" onClick={() => void withdraw(row)} disabled={busy === row.id}>
          Withdraw
        </Button>
      )}
    </span>
  );

  return (
    <section aria-labelledby="swaps-heading">
      <SectionHead id="swaps-heading" title="Swaps" subtitle="Shifts you have asked to hand over, or been asked to take" />
      {error !== null && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={ArrowLeftRight}
            hue="sky"
            title="Nothing in progress"
            hint="Ask a colleague to cover a shift and it appears here until it is decided."
          />
        </Card>
      ) : (
        <DataView<ShiftSwapRequest>
          rows={rows}
          rowKey={(r) => r.id}
          storageKey="hrm.me.swaps"
          caption="Swaps in progress"
          searchable={false}
          gridCols={2}
          columns={[
            {
              key: "who",
              header: "Request",
              primary: true,
              value: summary,
              render: (r) => <span className="font-semibold text-neutral-900">{summary(r)}</span>,
            },
            { key: "shift", header: "Shift", value: detail, render: (r) => <span className="tabular-nums">{detail(r)}</span> },
            { key: "reason", header: "Why", value: (r) => richExcerpt(r.reason, 200), hideOnMobile: true },
            {
              key: "status",
              header: "Status",
              value: (r) => r.statusLabel,
              render: (r) => (
                <ToneChip tone={swapTone(r.status)} dot>
                  {r.statusLabel}
                </ToneChip>
              ),
            },
            { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
          ]}
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <ArrowLeftRight size={18} aria-hidden />
                </span>
                <ToneChip tone={swapTone(r.status)} dot>
                  {r.statusLabel}
                </ToneChip>
              </div>
              <p className="text-[15px] font-semibold text-neutral-900">{summary(r)}</p>
              <p className="text-xs tabular-nums text-neutral-500">{detail(r)}</p>
              {r.reason && <p className="rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-600">{richExcerpt(r.reason, 200)}</p>}
              <div className="mt-auto">{actions(r)}</div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{summary(r)}</p>
                <p className="truncate text-xs text-neutral-500">
                  {detail(r)}
                  {r.reason ? ` · ${richExcerpt(r.reason, 200)}` : ""}
                </p>
              </div>
              <ToneChip tone={swapTone(r.status)} dot>
                {r.statusLabel}
              </ToneChip>
              {actions(r)}
            </div>
          )}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function OfferDialog({
  shift,
  onClose,
  onAsked,
}: {
  shift: RosterAssignment;
  onClose: () => void;
  onAsked: () => void;
}) {
  const [colleagues, setColleagues] = useState<
    { id: string; name: string | null; jobTitle?: string | null }[]
  >([]);
  const [requestedToId, setRequestedToId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    /*
      The employee-facing list. The HR directory (`hrm.employees`) is
      manager-only, so for the people this dialog is for it was always empty.
    */
    hrm.me
      .colleagues()
      .then((rows) => {
        if (cancelled) return;

        const others = rows.filter((e) => e.id !== shift.employeeId);

        setColleagues(others);
        setRequestedToId(others[0]?.id ?? "");
      })
      .catch(() => {
        // The list is an aid. Failing to load it should not block the dialog
        // from explaining itself.
      });

    return () => {
      cancelled = true;
    };
  }, [shift.employeeId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.me.requestSwap({
        offeredAssignmentId: shift.id,
        requestedToId,
        reason: reason.trim() === "" ? undefined : reason.trim(),
      });

      onAsked();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Ask to swap"
      subtitle={`Ask somebody to take this shift · ${formatDate(shift.worksOn)} · ${formatShiftTimes(
        shift.startsAt,
        shift.endsAt,
        shift.crossesMidnight,
      )}`}
      icon={ArrowLeftRight}
      hue={shiftHue(shift)}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || requestedToId === ""}>
            {busy ? "Asking…" : "Ask"}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className={labelCls}>Who</span>
        <SearchableSelect
          value={requestedToId}
          onChange={setRequestedToId}
          required
          options={colleagues.map((c) => ({ value: c.id, label: c.name ?? "Unnamed" }))}
        />
      </label>

      <label className="block">
        <span className={labelCls}>Why (optional)</span>
        <RichTextEditor minHeight={76} value={reason} onChange={setReason} />
      </label>

      <Notice tone="info">
        They have to agree first, and then your manager has to approve it.
        Nothing changes on the rota until both have.
      </Notice>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

/** Today as YYYY-MM-DD in the viewer's own time zone. */
function todayYmdLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A YYYY-MM-DD date moved by whole days. */
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
