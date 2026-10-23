"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarRange,
  Clock3,
  FileClock,
  MapPin,
  Moon,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  ApiError,
  hrm,
  type Employee,
  type RosterAssignment,
  type ShiftPattern,
  type ShiftSwapRequest,
  type ShiftCoverage,
} from "@/lib/api/hrm-client";
import {
  AvatarStack,
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Legend } from "@/components/workspace/charts";
import {
  CalendarNav,
  MonthCalendar,
  eventBlockClass,
  monthTitle,
  todayYmd,
  ymd,
  type CalendarEvent,
} from "@/components/workspace/Calendar";
import { hueFor, type Hue } from "@/components/workspace/modules";
import {
  ModalFrame,
  Notice,
  Skeleton,
  SoftButton,
  ToneChip,
  addDays,
  inputCls,
  mondayOf,
} from "../ui2/kit";
import { CheckField, DayToggles, FormButtons, FormField, SectionHead } from "../ui2/leave-form";
import { RotaWeek, type RotaBlock } from "../ui2/roster-week";
import {
  formatDate,
  formatDayMonth,
  formatMinutes,
  formatShiftTimes,
  swapTone,
} from "@/suite/hrm/lib/format";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/**
 * Building the roster, and deciding who gets to change it.
 *
 * The grid is a week at a time because that is how rosters are actually built
 * and read. A month of columns is unreadable at the width anybody has, and the
 * decisions being made here — is Tuesday covered, can Ada have Friday off — are
 * all week-shaped. The month calendar is for reading, not building: a day
 * there opens that week in the grid.
 *
 * **Drafts are the point of the publish step.** Assigning does not tell anybody
 * anything; publishing does. A half-built roster that somebody reads as final
 * is the failure the whole flag exists to prevent, so unpublished cells are
 * visibly different and the publish button says how many it will release.
 */

type Tab = "grid" | "coverage" | "swaps" | "shifts";

const TABS: { key: Tab; label: string }[] = [
  { key: "grid", label: "Roster" },
  /*
    The question the grid cannot answer at a glance: not "who is on" but
    "is anybody short". On a ward that is the difference between a rota and
    a safety problem.
  */
  { key: "coverage", label: "Coverage" },
  { key: "swaps", label: "Swaps" },
  { key: "shifts", label: "Shifts" },
];

/** "Night", or "Night (N)" when the code says something the name does not. */
function shiftLabel(s: ShiftPattern): string {
  return s.code && s.code.toLowerCase() !== s.name.toLowerCase() ? `${s.name} (${s.code})` : s.name;
}

/** A shift pattern's colour, the same in the grid, the schedule and the month. */
export function shiftHue(shift: { code?: string | null; name?: string | null } | null | undefined): Hue {
  return hueFor(shift?.code || shift?.name || "shift");
}

export default function RosterBoard() {
  const [tab, setTab] = useState<Tab>("grid");

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Roster"
        subtitle="Build the week, check nobody is short, and sign off the swaps colleagues have agreed."
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {tab === "grid" && <Grid />}
      {tab === "swaps" && <SwapApprovals />}
      {tab === "coverage" && <Coverage />}
      {tab === "shifts" && <Shifts />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The week grid                                                      */
/* ------------------------------------------------------------------ */

type RotaView = "people" | "schedule" | "month";

function Grid() {
  const [view, setView] = useState<RotaView>("people");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayYmd()));
  const [rows, setRows] = useState<RosterAssignment[] | null>(null);
  const [drafts, setDrafts] = useState(0);
  const [shifts, setShifts] = useState<ShiftPattern[]>([]);
  const [people, setPeople] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<{
    employee: Employee;
    date: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const load = useCallback(
    () =>
      Promise.all([
        hrm.roster.list({ from: weekStart, to: weekEnd }),
        hrm.roster.shifts(),
        hrm.employees.list({ perPage: 100 }),
      ])
        .then(([roster, patterns, staff]) => {
          setRows(roster.data);
          setDrafts(roster.meta.drafts);
          setShifts(patterns.filter((s) => s.isActive));
          setPeople(staff.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [weekStart, weekEnd],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    setBusy(true);

    try {
      await hrm.roster.publish(weekStart, weekEnd);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not publish.");
    } finally {
      setBusy(false);
    }
  };

  const byCell = useMemo(() => {
    const map = new Map<string, RosterAssignment>();

    for (const row of rows ?? []) {
      map.set(`${row.employeeId}|${row.worksOn}`, row);
    }

    return map;
  }, [rows]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      shifts: list.length,
      people: new Set(list.map((r) => r.employeeId)).size,
      hours: Math.round(list.reduce((s, r) => s + (r.expectedHours ?? 0), 0)),
    };
  }, [rows]);

  /* One block per shift per day in the schedule: who is on, not N stacked cards. */
  const blocks: RotaBlock[] = useMemo(() => {
    const groups = new Map<string, RosterAssignment[]>();
    for (const r of rows ?? []) {
      const key = `${r.worksOn}|${r.shiftPatternId}|${r.startsAt}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return Array.from(groups.entries()).map(([key, list]) => {
      const first = list[0];
      const names = list.map((r) => r.employee?.name ?? "Unnamed");
      return {
        id: key,
        date: first.worksOn,
        start: first.startsAt,
        end: first.endsAt,
        overnight: first.crossesMidnight,
        title: `${first.shift?.name ?? "Shift"} · ${list.length}`,
        meta: names.join(", "),
        hue: shiftHue(first.shift),
        draft: list.some((r) => !r.isPublished),
      };
    });
  }, [rows]);

  const legend = shifts.map((s) => ({ label: shiftLabel(s), hue: shiftHue(s) }));

  const monthOpen = (day: string) => {
    setWeekStart(mondayOf(day));
    setView("people");
  };

  return (
    <div className="space-y-6">
      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      {view !== "month" && (
        <StatGrid>
          <StatCard
            featured
            label="Shifts this week"
            value={rows === null ? "-" : stats.shifts}
            icon={CalendarRange}
            hint={`Week of ${formatDayMonth(weekStart)}`}
          />
          <StatCard
            label="People rostered"
            value={rows === null ? "-" : stats.people}
            unit={people.length ? `of ${people.length}` : undefined}
            icon={Users}
            hue="mint"
          />
          <StatCard
            label="Hours rostered"
            value={rows === null ? "-" : stats.hours}
            unit="h"
            icon={Clock3}
            hue="grape"
          />
          <StatCard
            label="Not yet published"
            value={rows === null ? "-" : drafts}
            unit={drafts === 1 ? "shift" : "shifts"}
            icon={FileClock}
            hue="sun"
            hint={drafts > 0 ? "Nobody sees these until you publish" : "Everything here is published"}
          />
        </StatGrid>
      )}

      {view === "month" ? (
        <MonthRota
          shifts={shifts}
          onOpenDay={monthOpen}
          viewSwitch={<RotaViewSwitch value={view} onChange={setView} />}
        />
      ) : (
        <Card className="p-5">
          <CalendarNav
            title={`Week of ${formatDate(weekStart)}`}
            onPrev={() => setWeekStart(addDays(weekStart, -7))}
            onNext={() => setWeekStart(addDays(weekStart, 7))}
            onToday={() => setWeekStart(mondayOf(todayYmd()))}
          >
            <RotaViewSwitch value={view} onChange={setView} />
            <Button variant="primary" size="sm" icon={Send} onClick={() => void publish()} disabled={busy || drafts === 0}>
              Publish {drafts > 0 ? drafts : ""}
            </Button>
          </CalendarNav>

          <p className="-mt-2 mb-4 text-[13px] text-neutral-500">
            {drafts > 0
              ? `${drafts} shift${drafts === 1 ? "" : "s"} not yet published`
              : "Everything here is published"}
          </p>

          {rows === null ? (
            <Skeleton className="h-80" />
          ) : people.length === 0 ? (
            <Empty icon={CalendarRange} title="Nobody to roster" hint="Add people to the directory first." />
          ) : view === "schedule" ? (
            rows.length === 0 ? (
              <Empty
                icon={CalendarRange}
                title="Nothing rostered this week"
                hint="Switch to the people grid and choose a cell to roster somebody."
              />
            ) : (
              <RotaWeek days={days} blocks={blocks} />
            )
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="sticky left-0 z-10 bg-neutral-50 px-4 py-3 font-semibold">
                      Person
                    </th>
                    {days.map((day, i) => {
                      const on = day === todayYmd();
                      return (
                        <th key={day} scope="col" className={cx("px-2 py-3 text-center font-semibold", i >= 5 && "text-neutral-400")}>
                          <span className={cx("inline-flex rounded-full px-2 py-0.5", on && "bg-primary-600 text-white")}>
                            {formatDayMonth(day)}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {people.map((person) => (
                    <tr key={person.id}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <div className="flex min-w-[10rem] items-center gap-2.5">
                          <PersonAvatar name={person.person.name ?? "Unnamed"} size={30} />
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-neutral-900">
                              {person.person.name ?? "Unnamed"}
                            </span>
                            <span className="block truncate text-[11px] text-neutral-500">
                              {person.department ?? "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {days.map((day, i) => {
                        const cell = byCell.get(`${person.id}|${day}`);
                        const hue = cell ? shiftHue(cell.shift) : "slate";

                        return (
                          <td key={day} className={cx("px-1.5 py-1.5 text-center", i >= 5 && "bg-neutral-50/60")}>
                            <button
                              type="button"
                              onClick={() => setAssigning({ employee: person, date: day })}
                              aria-label={
                                cell === undefined
                                  ? `Roster ${person.person.name ?? "Unnamed"} on ${formatDate(day)}`
                                  : `${cell.shift?.name ?? "Shift"} for ${person.person.name ?? "Unnamed"} on ${formatDate(day)}${cell.isPublished ? "" : " (draft)"}`
                              }
                              className={cx(
                                "group w-full cursor-pointer rounded-xl px-1.5 py-2 text-[11px] outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                                cell === undefined
                                  ? "text-neutral-300 hover:bg-primary-50 hover:text-primary-600"
                                  : cx("border", eventBlockClass(hue).replace(/before:\S+/g, "")),
                                /*
                                  A draft has to look unfinished. Same look as a
                                  published shift and nobody would ever press
                                  publish.
                                */
                                cell !== undefined && !cell.isPublished && "ws-hatch border-dashed",
                              )}
                            >
                              {cell === undefined ? (
                                <Plus size={14} className="mx-auto" aria-hidden />
                              ) : (
                                <>
                                  <span className="block font-bold">{cell.shift?.code ?? "-"}</span>
                                  <span className="block tabular-nums">{cell.startsAt}</span>
                                  {!cell.isPublished && (
                                    <span className="block text-[9px] font-semibold uppercase tracking-wide">Draft</span>
                                  )}
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {legend.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Legend items={legend} />
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="ws-hatch h-3 w-5 rounded border border-dashed border-neutral-400" aria-hidden />
                Draft, not yet published
              </span>
            </div>
          )}
        </Card>
      )}

      {assigning !== null && (
        <AssignDialog
          employee={assigning.employee}
          date={assigning.date}
          existing={byCell.get(`${assigning.employee.id}|${assigning.date}`)}
          shifts={shifts}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RotaViewSwitch({ value, onChange }: { value: RotaView; onChange: (v: RotaView) => void }) {
  return (
    <Segmented
      label="Roster view"
      options={[
        { key: "people", label: "People" },
        { key: "schedule", label: "Schedule" },
        { key: "month", label: "Month" },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

/**
 * A month of the rota, for reading. Each day lists its shifts with how many
 * are on; choosing a day opens that week in the people grid, where changes
 * are made.
 */
function MonthRota({
  shifts,
  onOpenDay,
  viewSwitch,
}: {
  shifts: ShiftPattern[];
  onOpenDay: (day: string) => void;
  viewSwitch: React.ReactNode;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [rows, setRows] = useState<RosterAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = ymd(cursor.y, cursor.m, 1);
    const to = ymd(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate());

    hrm.roster
      .list({ from, to })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [cursor]);

  const events: CalendarEvent[] = useMemo(() => {
    const groups = new Map<string, RosterAssignment[]>();
    for (const r of rows ?? []) {
      const key = `${r.worksOn}|${r.shiftPatternId}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, list]) => ({
        id: key,
        date: list[0].worksOn,
        title: `${list[0].shift?.name ?? list[0].shift?.code ?? "Shift"} · ${list.length} on${list.some((r) => !r.isPublished) ? " (draft)" : ""}`,
        meta: list.map((r) => r.employee?.name ?? "Unnamed").join(", "),
        hue: shiftHue(list[0].shift),
        onClick: () => onOpenDay(list[0].worksOn),
      }));
  }, [rows, onOpenDay]);

  const move = (dir: -1 | 1) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <Card className="p-5">
      <CalendarNav
        title={monthTitle(cursor.y, cursor.m)}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        onToday={() => setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })}
      >
        {viewSwitch}
      </CalendarNav>

      {error !== null ? (
        <Empty icon={CalendarRange} hue="coral" title="That did not load" hint={error} />
      ) : rows === null ? (
        <Skeleton className="h-[560px]" />
      ) : (
        <MonthCalendar year={cursor.y} month={cursor.m} events={events} onDayClick={onOpenDay} maxPerDay={3} />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Legend items={shifts.map((s) => ({ label: shiftLabel(s), hue: shiftHue(s) }))} />
        <p className="text-xs text-neutral-500">Choose a day to open that week in the people grid.</p>
      </div>
    </Card>
  );
}

function AssignDialog({
  employee,
  date,
  existing,
  shifts,
  onClose,
  onSaved,
}: {
  employee: Employee;
  date: string;
  existing?: RosterAssignment;
  shifts: ShiftPattern[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shiftPatternId, setShiftPatternId] = useState(shifts[0]?.id ?? "");
  const [repeatTo, setRepeatTo] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.roster.assign(employee.id, {
        shiftPatternId,
        from: date,
        to: repeatTo === "" ? null : repeatTo,
        weekdays: repeatTo === "" ? undefined : weekdays,
        publish,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (existing === undefined) return;

    const ok = await confirm({
      title: `Take ${employee.person.name ?? "them"} off the shift on ${formatDate(date)}?`,
      body: "The day goes back to unrostered. Unassigning doesn't go to the recycle bin; assign the shift again to put it back.",
      confirmLabel: "Unassign shift",
    });
    if (!ok) return;

    setBusy(true);

    try {
      await hrm.roster.unassign(existing.id);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  const chosen = shifts.find((s) => s.id === shiftPatternId);

  return (
    <ModalFrame
      title="Roster a shift"
      subtitle={`${employee.person.name ?? "Unnamed"} · ${formatDate(date)}`}
      icon={CalendarRange}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {existing !== undefined && (
            <Button
              onClick={() => void remove()}
              disabled={busy}
              className="mr-auto !border-error-500/30 !text-error-700 hover:!bg-error-500/10"
            >
              Take off
            </Button>
          )}
          <FormButtons onCancel={onClose} busy={busy} submitLabel="Roster" disabled={shifts.length === 0} />
        </>
      }
    >
      {existing !== undefined && (
        <div className={cx("rounded-xl border px-3.5 py-2.5 text-sm", eventBlockClass(shiftHue(existing.shift)).replace(/before:\S+/g, ""))}>
          Currently on <span className="font-semibold">{existing.shift?.name ?? "a shift"}</span>,{" "}
          {existing.startsAt}-{existing.endsAt}
          {existing.isPublished ? "" : " (draft)"}
        </div>
      )}

      {shifts.length === 0 ? (
        <Notice tone="warning">Define a shift first. There is nothing to roster anybody onto.</Notice>
      ) : (
        <>
          <FormField id="ra-shift" label="Shift">
            <SearchableSelect
              id="ra-shift"
              value={shiftPatternId}
              onChange={setShiftPatternId}
              required
              options={shifts.map((shift) => ({
                value: shift.id,
                label: `${shift.name} · ${formatShiftTimes(shift.startsAt, shift.endsAt, shift.crossesMidnight)}`,
              }))}
            />
          </FormField>
          {chosen && (
            <div className="-mt-1 flex flex-wrap gap-1.5">
              <Chip hue={shiftHue(chosen)} dot>
                {chosen.code}
              </Chip>
              <Chip hue="slate" icon={Clock3}>
                {formatMinutes(chosen.expectedMinutes)} paid
              </Chip>
              {chosen.crossesMidnight && (
                <Chip hue="sky" icon={Moon}>
                  Overnight
                </Chip>
              )}
            </div>
          )}

          <FormField id="ra-repeat" label="Repeat until (optional)">
            <input
              id="ra-repeat"
              type="date"
              value={repeatTo}
              min={date}
              onChange={(e) => setRepeatTo(e.target.value)}
              className={inputCls}
            />
          </FormField>

          {repeatTo !== "" && (
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-neutral-700">On these days</span>
              <DayToggles label="On these days" value={weekdays} onChange={setWeekdays} />
              <p className="mt-1.5 text-xs text-neutral-500">None selected means every day in the range.</p>
            </div>
          )}

          <CheckField label="Publish straight away" checked={publish} onChange={setPublish} />
        </>
      )}

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Swaps                                                              */
/* ------------------------------------------------------------------ */

function shiftLine(a: RosterAssignment | null | undefined): string {
  return a ? `${formatDate(a.worksOn)} · ${formatShiftTimes(a.startsAt, a.endsAt, a.crossesMidnight)}` : "";
}

/**
 * Where the swap approvals read and write. HR's by default; My team (S9)
 * passes the team-scoped calls for swaps its reports asked for.
 */
export interface SwapQueue {
  list: () => Promise<{ data: ShiftSwapRequest[] }>;
  approve: (id: string) => Promise<unknown>;
  decline: (id: string, reason: string) => Promise<unknown>;
  storageKey: string;
}

const HR_SWAPS: SwapQueue = {
  list: () => hrm.roster.swaps(true),
  approve: (id) => hrm.roster.approveSwap(id),
  decline: (id, reason) => hrm.roster.declineSwap(id, reason),
  storageKey: "hrm.roster.swaps",
};

export function SwapApprovals({ queue = HR_SWAPS }: { queue?: SwapQueue }) {
  const [rows, setRows] = useState<ShiftSwapRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<ShiftSwapRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(
    () =>
      queue
        .list()
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [queue],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (row: ShiftSwapRequest) => {
    setBusy(row.id);

    try {
      await queue.approve(row.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const decline = async () => {
    if (declining === null) return;

    setBusy(declining.id);

    try {
      await queue.decline(declining.id, reason.trim());
      setDeclining(null);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /*
    A swap you asked for, or agreed to, is shown without buttons: the API
    refuses either party deciding it, HR managers included, so the second
    consent stays somebody else's.
  */
  const actions = (row: ShiftSwapRequest) =>
    row.involvesMe === true ? (
      <span className="text-xs text-neutral-500">You&apos;re part of this swap; another HR manager decides it.</span>
    ) : (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button size="sm" onClick={() => setDeclining(row)} disabled={busy === row.id}>
          Decline
        </Button>
        <SoftButton
          hue="mint"
          onClick={() => void approve(row)}
          disabled={busy === row.id || !row.isFulfillable}
        >
          Approve
        </SoftButton>
      </div>
    );

  /*
    A request whose roster row has since been deleted cannot be carried out.
    Saying so beats an approve button that fails.
  */
  const unfulfillable = (row: ShiftSwapRequest) =>
    row.isFulfillable ? null : (
      <p className="flex items-center gap-1.5 text-xs text-error-700">
        <AlertTriangle size={13} aria-hidden />
        One of those shifts no longer exists, so this cannot be approved.
      </p>
    );

  const who = (row: ShiftSwapRequest) =>
    `${row.requestedBy?.name ?? "Unnamed"}${row.isGiveaway ? " gives a shift to " : " swaps with "}${row.requestedTo?.name ?? "Unnamed"}`;

  const columns: Column<ShiftSwapRequest>[] = [
    {
      key: "who",
      header: "Request",
      primary: true,
      sortable: true,
      value: who,
      render: (row) => (
        <div className="flex items-center gap-3">
          <AvatarStack
            people={[{ name: row.requestedBy?.name ?? "Unnamed" }, { name: row.requestedTo?.name ?? "Unnamed" }]}
            size={30}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">{who(row)}</p>
            {unfulfillable(row)}
          </div>
        </div>
      ),
    },
    {
      key: "offered",
      header: "Offered",
      value: (row) => row.offered?.worksOn ?? "",
      render: (row) =>
        row.offered ? (
          <span className="text-xs tabular-nums">{shiftLine(row.offered)}</span>
        ) : (
          <span className="text-xs text-neutral-500">Shift no longer exists</span>
        ),
    },
    {
      key: "wanted",
      header: "In return",
      hideOnMobile: true,
      value: (row) => row.wanted?.worksOn ?? "",
      render: (row) =>
        row.wanted ? (
          <span className="text-xs tabular-nums">{shiftLine(row.wanted)}</span>
        ) : (
          <span className="text-xs text-neutral-500">{row.isGiveaway ? "Nothing (a giveaway)" : "-"}</span>
        ),
    },
    { key: "reason", header: "Reason", hideOnMobile: true, value: (row) => richExcerpt(row.reason, 200) },
    {
      key: "status",
      header: "Status",
      value: (row) => row.statusLabel,
      render: (row) => <ToneChip tone={swapTone(row.status)}>{row.statusLabel}</ToneChip>,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <div className="space-y-6">
      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <section>
        <SectionHead
          title="Swaps awaiting you"
          subtitle="Both colleagues have already agreed. Approving moves the roster."
          icon={ArrowLeftRight}
          hue="sky"
        />
        {rows === null ? (
          error !== null ? (
            <Card>
              <Empty icon={ArrowLeftRight} hue="coral" title="Swaps could not be loaded" hint="The reason is shown above." />
            </Card>
          ) : (
            <Skeleton className="h-48" />
          )
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey={queue.storageKey}
            caption="Shift swaps awaiting approval"
            searchPlaceholder="Search people or reasons"
            empty={
              <Empty
                icon={ArrowLeftRight}
                hue="sky"
                title="Nothing waiting on you"
                hint="A swap only reaches here once the colleague being asked has agreed."
              />
            }
            renderCard={(row) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <AvatarStack
                    people={[{ name: row.requestedBy?.name ?? "Unnamed" }, { name: row.requestedTo?.name ?? "Unnamed" }]}
                    size={34}
                  />
                  <ToneChip tone={swapTone(row.status)}>{row.statusLabel}</ToneChip>
                </div>
                <p className="text-[15px] font-semibold leading-snug text-neutral-900">{who(row)}</p>
                <div className="space-y-2">
                  <div className={cx("rounded-xl border px-3 py-2 text-xs", eventBlockClass(shiftHue(row.offered?.shift)).replace(/before:\S+/g, ""))}>
                    <span className="font-semibold">Offered</span> ·{" "}
                    {row.offered ? shiftLine(row.offered) : "Shift no longer exists"}
                  </div>
                  {row.wanted && (
                    <div className={cx("rounded-xl border px-3 py-2 text-xs", eventBlockClass(shiftHue(row.wanted.shift)).replace(/before:\S+/g, ""))}>
                      <span className="font-semibold">In return</span> · {shiftLine(row.wanted)}
                    </div>
                  )}
                </div>
                {row.reason && <p className="text-xs text-neutral-600">{richExcerpt(row.reason, 200)}</p>}
                {unfulfillable(row)}
                <div className="mt-auto border-t border-neutral-100 pt-3">{actions(row)}</div>
              </div>
            )}
            renderListItem={(row) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <AvatarStack
                  people={[{ name: row.requestedBy?.name ?? "Unnamed" }, { name: row.requestedTo?.name ?? "Unnamed" }]}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{who(row)}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {row.offered ? shiftLine(row.offered) : "Shift no longer exists"}
                    {row.wanted ? ` ⇄ ${shiftLine(row.wanted)}` : ""}
                    {row.reason ? ` · ${richExcerpt(row.reason, 200)}` : ""}
                  </p>
                  {unfulfillable(row)}
                </div>
                <ToneChip tone={swapTone(row.status)}>{row.statusLabel}</ToneChip>
                {actions(row)}
              </div>
            )}
          />
        )}
      </section>

      {declining !== null && (
        <ModalFrame
          title="Decline swap"
          subtitle={who(declining)}
          icon={ArrowLeftRight}
          hue="coral"
          onClose={() => setDeclining(null)}
          footer={
            <>
              <Button onClick={() => setDeclining(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => void decline()}
                disabled={busy !== null || reason.trim() === ""}
              >
                Decline
              </Button>
            </>
          }
        >
          <FormField id="swap-decline-reason" label="Why? Both people will see this.">
            <RichTextEditor id="swap-decline-reason" minHeight={102} value={reason} onChange={setReason} />
          </FormField>
        </ModalFrame>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Coverage                                                           */
/* ------------------------------------------------------------------ */

/**
 * Who is actually on, shift by shift, on one day.
 *
 * The grid answers "who is working this week". This answers the question a
 * ward manager asks at seven in the morning: is any shift short. Reading that
 * off a week grid means counting cells, which is exactly the sort of counting
 * people stop doing when they are busy — and being short-staffed on a night
 * shift is not a rota problem, it is a safety one.
 *
 * Nobody rostered is reported as an empty shift rather than omitted. A shift
 * that vanishes from the list when it has no one on it hides the only row
 * worth looking at.
 */
function Coverage() {
  const [date, setDate] = useState(todayYmd());
  const [rows, setRows] = useState<ShiftCoverage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.roster
      .coverage(date)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const empty = (rows ?? []).filter((row) => row.rostered === 0);
  const on = (rows ?? []).reduce((s, r) => s + r.rostered, 0);

  const columns: Column<ShiftCoverage>[] = [
    {
      key: "name",
      header: "Shift",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Chip hue={shiftHue(r)} dot>
            {r.code ?? r.name.slice(0, 3).toUpperCase()}
          </Chip>
          <span className="font-semibold text-neutral-900">{r.name}</span>
        </div>
      ),
    },
    {
      key: "times",
      header: "Hours",
      value: (r) => r.startsAt,
      render: (r) => (
        <span className="tabular-nums">
          {r.startsAt} to {r.endsAt}
        </span>
      ),
    },
    {
      key: "rostered",
      header: "On",
      sortable: true,
      value: (r) => r.rostered,
      render: (r) => (
        <ToneChip tone={r.rostered === 0 ? "error" : "success"} dot>
          {r.rostered === 0 ? "Nobody on" : `${r.rostered} on`}
        </ToneChip>
      ),
    },
    {
      key: "names",
      header: "Who",
      value: (r) => r.names.join(", "),
      render: (r) =>
        r.names.length === 0 ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <div className="flex items-center gap-2">
            <AvatarStack people={r.names.map((n) => ({ name: n }))} size={26} />
            <span className="hidden truncate text-xs text-neutral-600 lg:inline">{r.names.join(", ")}</span>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {empty.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-[1.125rem] border border-error-500/20 bg-error-500/5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-500/10 text-error-700">
            <AlertTriangle size={19} aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              {empty.length} {empty.length === 1 ? "shift has" : "shifts have"} nobody on
            </h2>
            <p className="mt-1 text-sm text-neutral-700">{empty.map((row) => row.name).join(", ")}</p>
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <StatGrid cols={3}>
          <StatCard featured label="Shifts that day" value={rows.length} icon={CalendarRange} hint={formatDate(date)} />
          <StatCard label="People on" value={on} icon={Users} hue="mint" />
          <StatCard
            label="Covered shifts"
            value={`${rows.length - empty.length}/${rows.length}`}
            icon={ShieldCheck}
            hue={empty.length > 0 ? "rose" : "mint"}
            hint={empty.length > 0 ? "Some shifts are empty" : "Every shift has somebody"}
          />
        </StatGrid>
      )}

      <Panel
        title="Coverage"
        subtitle="Who is on, shift by shift."
        icon={ShieldCheck}
        hue="mint"
        actions={
          <input
            type="date"
            aria-label="Coverage date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
        }
      >
        {error !== null ? (
          <p className="text-sm text-neutral-600">{error}</p>
        ) : rows === null ? (
          <Skeleton className="h-40" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.shiftPatternId}
            storageKey="hrm.roster.coverage"
            defaultView="grid"
            searchable={rows.length > 6}
            caption={`Shift coverage on ${formatDate(date)}`}
            empty={
              <Empty
                icon={CalendarRange}
                title="No shifts defined"
                hint="Add a shift pattern before anybody can be rostered onto one."
              />
            }
            renderCard={(r) => {
              const hue = shiftHue(r);
              return (
                <div className={cx("flex h-full flex-col gap-4 p-5", r.rostered === 0 && "bg-error-500/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Chip hue={hue} dot>
                        {r.code ?? r.name}
                      </Chip>
                      <p className="mt-2 truncate text-[15px] font-semibold text-neutral-900">{r.name}</p>
                      <p className="text-xs text-neutral-500 tabular-nums">
                        {r.startsAt} to {r.endsAt}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cx("text-[28px] font-bold leading-none tabular-nums", r.rostered === 0 ? "text-error-700" : "text-neutral-900")}>
                        {r.rostered}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">on shift</p>
                    </div>
                  </div>
                  {r.names.length > 0 ? (
                    <div className="flex items-center gap-3">
                      <AvatarStack people={r.names.map((n) => ({ name: n }))} size={30} />
                      <p className="min-w-0 truncate text-xs text-neutral-600">{r.names.join(", ")}</p>
                    </div>
                  ) : (
                    <ToneChip tone="error" icon={AlertTriangle}>
                      Nobody on
                    </ToneChip>
                  )}
                </div>
              );
            }}
          />
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shift patterns                                                     */
/* ------------------------------------------------------------------ */

function Shifts() {
  const [rows, setRows] = useState<ShiftPattern[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShiftPattern | null>(null);

  const load = useCallback(
    () =>
      hrm.roster
        .shifts()
        .then((res) => {
          setRows(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const facts = (shift: ShiftPattern) =>
    `${formatShiftTimes(shift.startsAt, shift.endsAt, shift.crossesMidnight)} · ${formatMinutes(shift.expectedMinutes)} paid${
      shift.breakMinutes > 0 ? ` · ${shift.breakMinutes}m unpaid break` : ""
    }${shift.location ? ` · ${shift.location}` : ""}`;

  const flags = (shift: ShiftPattern) => (
    <div className="flex flex-wrap gap-1.5">
      {shift.crossesMidnight && (
        <Chip hue="sky" icon={Moon}>
          Overnight
        </Chip>
      )}
      {shift.paidMinutes !== null && <Chip hue="grape">Flat rate</Chip>}
      {!shift.isActive && <ToneChip tone="neutral">Inactive</ToneChip>}
    </div>
  );

  const edit = (shift: ShiftPattern) => (
    <Button size="sm" icon={Pencil} onClick={() => setEditing(shift)} aria-label={`Edit ${shift.name}`}>
      Edit
    </Button>
  );

  const columns: Column<ShiftPattern>[] = [
    {
      key: "name",
      header: "Shift",
      primary: true,
      sortable: true,
      value: (s) => s.name,
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <Chip hue={shiftHue(s)} dot>
            {s.code}
          </Chip>
          <span className="font-semibold text-neutral-900">{s.name}</span>
        </div>
      ),
    },
    {
      key: "times",
      header: "Hours",
      sortable: true,
      value: (s) => s.startsAt,
      render: (s) => (
        <span className="tabular-nums">{formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight)}</span>
      ),
    },
    { key: "paid", header: "Paid", align: "right", sortable: true, value: (s) => s.expectedMinutes, render: (s) => formatMinutes(s.expectedMinutes) },
    { key: "break", header: "Break", align: "right", hideOnMobile: true, value: (s) => s.breakMinutes, render: (s) => (s.breakMinutes > 0 ? `${s.breakMinutes}m` : "-") },
    { key: "location", header: "Where", hideOnMobile: true, value: (s) => s.location ?? "" },
    { key: "flags", header: "", render: flags },
    { key: "actions", header: "", align: "right", tableOnly: true, render: edit },
  ];

  return (
    <div className="space-y-6">
      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <section>
        <SectionHead
          title="Shifts"
          subtitle="Changing a shift affects what gets rostered from now on. Days already assigned keep the hours they were given."
          icon={Clock3}
          hue="grape"
          actions={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
              Add shift
            </Button>
          }
        />
        {rows === null ? (
          <Skeleton className="h-40" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            storageKey="hrm.roster.shifts"
            defaultView="grid"
            caption="Shift patterns"
            searchPlaceholder="Search shifts"
            empty={<Empty icon={CalendarRange} title="No shifts defined" hint="Add one before anybody can be rostered." />}
            renderCard={(s) => {
              const hue = shiftHue(s);
              return (
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className={cx("rounded-xl border p-3.5", eventBlockClass(hue).replace(/before:\S+/g, ""))}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide">
                        {s.code.toLowerCase() === s.name.toLowerCase() ? "Shift" : s.code}
                      </span>
                      <span className="rounded-md bg-white/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                        {formatShiftTimes(s.startsAt, s.endsAt, s.crossesMidnight)}
                      </span>
                    </div>
                    <p className="mt-2 text-[15px] font-semibold">{s.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-neutral-500">Paid</p>
                      <p className="font-semibold text-neutral-900">{formatMinutes(s.expectedMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Unpaid break</p>
                      <p className="font-semibold text-neutral-900">{s.breakMinutes > 0 ? `${s.breakMinutes}m` : "None"}</p>
                    </div>
                  </div>
                  {s.location && (
                    <p className="flex items-center gap-1.5 text-xs text-neutral-600">
                      <MapPin size={13} aria-hidden /> {s.location}
                    </p>
                  )}
                  {flags(s)}
                  <div className="mt-auto border-t border-neutral-100 pt-3">{edit(s)}</div>
                </div>
              );
            }}
            renderListItem={(s) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Chip hue={shiftHue(s)} dot>
                  {s.code}
                </Chip>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{s.name}</p>
                  <p className="truncate text-xs text-neutral-500">{facts(s)}</p>
                </div>
                {flags(s)}
                {edit(s)}
              </div>
            )}
          />
        )}
      </section>

      {(adding || editing !== null) && (
        <ShiftDialog
          existing={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export function ShiftDialog({
  existing,
  onClose,
  onSaved,
}: {
  /** Present when changing a pattern rather than adding one. */
  existing?: ShiftPattern;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [startsAt, setStartsAt] = useState(existing?.startsAt ?? "09:00");
  const [endsAt, setEndsAt] = useState(existing?.endsAt ?? "17:00");
  const [breakMinutes, setBreakMinutes] = useState(String(existing?.breakMinutes ?? 60));
  const [location, setLocation] = useState(existing?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shown, not silently applied. Somebody typing 22:00 to 06:00 should see
  // that the system understood it as overnight before they save.
  const overnight = endsAt < startsAt;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        startsAt,
        endsAt,
        crossesMidnight: overnight,
        breakMinutes: Number(breakMinutes || 0),
        location: location.trim() === "" ? null : location.trim(),
      };

      /*
        Editing a pattern changes it for shifts rostered from now on. Assigned
        shifts keep the times they were published with — people have arranged
        childcare around them.
      */
      if (existing !== undefined) {
        await hrm.roster.updateShift(existing.id, payload);
      } else {
        await hrm.roster.createShift(payload);
      }

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title={existing ? "Edit shift" : "Add shift"}
      subtitle={existing ? `Changing ${existing.name}` : "A named shift and its hours"}
      icon={Clock3}
      hue="grape"
      onClose={onClose}
      onSubmit={submit}
      footer={<FormButtons onCancel={onClose} busy={busy} submitLabel={existing ? "Save changes" : "Add shift"} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sh-name" label="Name">
          <input
            id="sh-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="Night shift"
            className={inputCls}
          />
        </FormField>
        <FormField id="sh-code" label="Short code">
          <input
            id="sh-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={16}
            placeholder="NIGHT"
            className={`${inputCls} uppercase`}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sh-start" label="Starts">
          <input
            id="sh-start"
            type="time"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className={inputCls}
          />
        </FormField>
        <FormField id="sh-end" label="Ends">
          <input
            id="sh-end"
            type="time"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className={inputCls}
          />
        </FormField>
      </div>

      {overnight && (
        <Notice tone="info">This shift ends the following morning, so it will be treated as overnight.</Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="sh-break" label="Unpaid break (minutes)">
          <input
            id="sh-break"
            type="number"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(e.target.value)}
            min={0}
            max={480}
            className={inputCls}
          />
        </FormField>
        <FormField id="sh-where" label="Where (optional)">
          <input
            id="sh-where"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Anywhere"
            className={inputCls}
          />
        </FormField>
      </div>

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}
