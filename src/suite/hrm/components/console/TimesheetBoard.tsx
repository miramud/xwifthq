"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hourglass,
  LogIn,
  Send,
  Settings2,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Progress,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, SegmentedGauge } from "@/components/workspace/charts";
import {
  ApiError,
  hrm,
  type TimeEntry,
  type TimePolicy,
  type TimesheetRosterRow,
} from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import {
  LoadFailed,
  MiniStat,
  ModalFrame,
  Notice,
  PageSkeleton,
  PersonCell,
  Skeleton,
  SoftButton,
  hintCls,
  inputCls,
  labelCls,
} from "@/suite/hrm/components/ui2/kit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * The HR manager's side of the timesheet.
 *
 * Three jobs, and they are genuinely different: the roster is read daily, the
 * approvals queue is worked through, and the rules are set once and rarely
 * touched. One screen with three tabs rather than three pages, because the
 * answer to "why is this week short" is usually in the rules.
 */
type Tab = "Week" | "Approvals" | "Rules";

const TABS: { key: Tab; label: string }[] = [
  { key: "Week", label: "The week" },
  { key: "Approvals", label: "Approvals" },
  { key: "Rules", label: "Rules" },
];

const SUBTITLE: Record<Tab, string> = {
  Week: "Who worked what this week, most to look at first.",
  Approvals: "Days people have sent for sign-off.",
  Rules: "What counts as a working day here.",
};

export default function TimesheetBoard() {
  const [tab, setTab] = useState<Tab>("Week");

  return (
    <div>
      <PageHeader
        eyebrow="Time"
        title="Timesheets"
        subtitle={SUBTITLE[tab]}
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {tab === "Week" && <Roster />}
      {tab === "Approvals" && <TimesheetApprovals />}
      {tab === "Rules" && <Rules />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The week                                                           */
/* ------------------------------------------------------------------ */

const person = (id: string) => `/suite/hrm/people/${id}`;

function attainment(row: TimesheetRosterRow): number {
  return row.totals.expectedMinutes > 0
    ? (row.totals.workedMinutes / row.totals.expectedMinutes) * 100
    : 0;
}

function Flags({ row }: { row: TimesheetRosterRow }) {
  const t = row.totals;
  const none = !row.signedInNow && t.absentDays === 0 && t.lateDays === 0 && t.openDays === 0;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.signedInNow && <Chip hue="mint" dot>In now</Chip>}
      {t.absentDays > 0 && <Chip hue="rose" icon={UserX}>{t.absentDays} missing</Chip>}
      {t.lateDays > 0 && <Chip hue="sun" icon={AlarmClock}>{t.lateDays} late</Chip>}
      {t.openDays > 0 && <Chip hue="sky" icon={Hourglass}>{t.openDays} open</Chip>}
      {none && <span className="text-xs text-neutral-500">On track</span>}
    </span>
  );
}

function Balance({ row }: { row: TimesheetRosterRow }) {
  const short = row.totals.balanceMinutes < 0;
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
        short ? "bg-sun-50 text-sun-700" : "bg-mint-50 text-mint-700",
      )}
    >
      {row.totals.balanceMinutes >= 0 ? "+" : ""}
      {row.totals.balanceHours}h
    </span>
  );
}

function Roster() {
  const [rows, setRows] = useState<TimesheetRosterRow[] | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrm.timesheet
      .overview()
      .then((res) => {
        setRows(res.data);
        setWeek(res.meta.week);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const figures = useMemo(() => {
    const r = rows ?? [];
    const worked = r.reduce((s, x) => s + x.totals.workedMinutes, 0);
    const expected = r.reduce((s, x) => s + x.totals.expectedMinutes, 0);
    return {
      workedH: Math.round((worked / 60) * 10) / 10,
      expectedH: Math.round((expected / 60) * 10) / 10,
      pct: expected > 0 ? (worked / expected) * 100 : 0,
      inNow: r.filter((x) => x.signedInNow).length,
      late: r.reduce((s, x) => s + x.totals.lateDays, 0),
      missing: r.reduce((s, x) => s + x.totals.absentDays, 0),
      waiting: r.reduce((s, x) => s + x.totals.awaitingApproval, 0),
    };
  }, [rows]);

  const columns: Column<TimesheetRosterRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Person",
        primary: true,
        sortable: true,
        value: (r) => r.name ?? "Unnamed",
        render: (r) => <PersonCell name={r.name} sub={r.jobTitle} />,
      },
      {
        key: "department",
        header: "Department",
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.department ?? "",
      },
      {
        key: "worked",
        header: "Worked",
        sortable: true,
        value: (r) => r.totals.workedMinutes,
        render: (r) => (
          <div className="min-w-[160px]">
            <p className="mb-1 text-xs text-neutral-600 tabular-nums">
              <span className="font-semibold text-neutral-900">{r.totals.workedHours}h</span> of{" "}
              {r.totals.expectedHours}h
            </p>
            <Progress
              value={attainment(r)}
              size="sm"
              hue={r.totals.balanceMinutes < 0 ? "sun" : "mint"}
            />
          </div>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        sortable: true,
        value: (r) => r.totals.balanceMinutes,
        render: (r) => <Balance row={r} />,
      },
      {
        key: "flags",
        header: "This week",
        render: (r) => <Flags row={r} />,
      },
    ],
    [],
  );

  if (error !== null) return <LoadFailed icon={Clock} message={error} />;
  if (rows === null) return <PageSkeleton />;

  const chart = [...rows]
    .sort((a, b) => b.totals.workedMinutes - a.totals.workedMinutes)
    .slice(0, 10)
    .map((r) => ({
      label: (r.name ?? "Unnamed").split(/\s+/)[0],
      value: r.totals.workedHours,
      max: Math.max(r.totals.expectedHours, r.totals.workedHours),
      hue: r.totals.balanceMinutes < 0 ? ("blue" as const) : ("mint" as const),
    }));

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard
          featured
          label="Hours worked"
          value={figures.workedH}
          unit={`of ${figures.expectedH}h`}
          icon={Clock}
          hint={week === null ? undefined : `Week of ${formatDate(week)}`}
        />
        <StatCard label="Signed in now" value={figures.inNow} unit={`of ${rows.length}`} icon={LogIn} hue="mint" />
        <StatCard label="Late days" value={figures.late} icon={AlarmClock} hue="sun" hint="Past the grace period" />
        <StatCard label="Missing days" value={figures.missing} icon={UserX} hue="rose" hint="Expected, nothing recorded" />
      </StatGrid>

      {rows.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title="Hours by person"
            subtitle="Worked against expected: hatched is what is still to come; green has met the week"
            icon={Users}
            bodyClassName="px-5 pb-5 pt-9"
          >
            <ColumnChart
              data={chart}
              format={(v) => `${v}h`}
              caption="Hours worked this week by person, against the hours expected"
              height={200}
            />
          </Panel>
          <Panel title="Team attainment" subtitle="All hours worked over all expected" icon={ShieldCheck} hue="mint">
            <div className="flex flex-col items-center pt-4">
              <SegmentedGauge
                value={figures.pct}
                hue={figures.pct >= 90 ? "mint" : figures.pct >= 70 ? "sun" : "coral"}
                label="of expected hours"
              />
              <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-neutral-100 pt-4 text-center">
                <MiniStat label="Worked" value={`${figures.workedH}h`} />
                <MiniStat label="Expected" value={`${figures.expectedH}h`} />
                <MiniStat label="To approve" value={figures.waiting} hue="blue" />
              </div>
            </div>
          </Panel>
        </div>
      )}

      <section aria-label="People this week">
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.employeeId}
          storageKey="hrm.timesheets"
          rowHref={(r) => person(r.employeeId)}
          searchPlaceholder="Search people or departments"
          caption={week === null ? "People this week" : `People, week of ${formatDate(week)}`}
          empty={
            <Empty
              icon={Clock}
              title="Nobody to show"
              hint="Take somebody on and their week appears here."
            />
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonCell name={r.name} sub={r.jobTitle} size={40} />
                <Balance row={r} />
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-neutral-500">{r.department ?? "No department"}</span>
                  <span className="tabular-nums text-neutral-600">
                    <span className="font-bold text-neutral-900">{r.totals.workedHours}h</span> / {r.totals.expectedHours}h
                  </span>
                </div>
                <Progress
                  value={attainment(r)}
                  hue={r.totals.balanceMinutes < 0 ? "sun" : "mint"}
                />
              </div>
              <div className="mt-auto">
                <Flags row={r} />
              </div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <PersonCell name={r.name} sub={`${r.jobTitle}${r.department ? ` · ${r.department}` : ""}`} />
              </div>
              <span className="w-28 shrink-0 text-xs tabular-nums text-neutral-600">
                {r.totals.workedHours}h of {r.totals.expectedHours}h
              </span>
              <Balance row={r} />
              <Flags row={r} />
            </div>
          )}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approvals                                                          */
/* ------------------------------------------------------------------ */

/**
 * Where the approvals queue reads and writes. HR's by default; My team (S9)
 * passes the team-scoped calls, and no link into HR's employee record (a
 * supervisor cannot open it).
 */
export interface TimesheetQueue {
  pending: () => Promise<{ data: TimeEntry[]; meta: { total: number; estimated: number } }>;
  approve: (entryId: string) => Promise<unknown>;
  reject: (entryId: string, reason: string) => Promise<unknown>;
  personHref: ((employeeId: string) => string) | null;
  storageKey: string;
  emptyHint?: string;
}

const HR_QUEUE: TimesheetQueue = {
  pending: () => hrm.timesheet.pending(),
  approve: (id) => hrm.timesheet.approve(id),
  reject: (id, reason) => hrm.timesheet.reject(id, reason),
  personHref: person,
  storageKey: "hrm.timesheets.approvals",
};

export function TimesheetApprovals({ queue = HR_QUEUE }: { queue?: TimesheetQueue }) {
  const href = (id: string) => (queue.personHref === null ? undefined : queue.personHref(id));
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [estimated, setEstimated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<TimeEntry | null>(null);

  const load = useCallback(
    () =>
      queue
        .pending()
        .then((res) => {
          setEntries(res.data);
          setEstimated(res.meta.estimated);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [queue],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (entry: TimeEntry) => {
    setBusy(entry.id);
    try {
      await queue.approve(entry.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  /*
    Your own days stay in the queue, so the count is honest, but they carry a
    note instead of buttons: the API refuses anybody deciding their own day,
    and a button that always fails is worse than none.
  */
  const actions = (entry: TimeEntry) =>
    entry.isMine === true ? (
      <span className="max-w-[16rem] text-xs text-neutral-500">
        Your own day; another HR manager has to decide it.
      </span>
    ) : (
      <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
        <SoftButton
          icon={CheckCircle2}
          disabled={busy === entry.id}
          onClick={() => void approve(entry)}
        >
          Approve
        </SoftButton>
        <Button size="sm" icon={Send} onClick={() => setRejecting(entry)}>
          Send back
        </Button>
      </div>
    );

  /*
    A typed or auto-closed day is somebody's recollection, and it must not
    look identical to a clock reading on the screen where it gets approved.
  */
  const marks = (entry: TimeEntry) => (
    <span className="flex flex-wrap gap-1.5">
      {entry.isEstimated && <Chip hue="slate">Estimated</Chip>}
      {entry.wasLate && <Chip hue="sun" icon={AlarmClock}>{entry.lateMinutes}m late</Chip>}
      {!entry.isEstimated && !entry.wasLate && <Chip hue="mint">Clocked</Chip>}
    </span>
  );

  const columns: Column<TimeEntry>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (e) => e.employee?.name ?? "Unnamed",
      render: (e) => (
        <PersonCell name={e.employee?.name ?? "Unnamed"} sub={e.employee?.jobTitle} href={href(e.employeeId)} />
      ),
    },
    {
      key: "date",
      header: "Day",
      sortable: true,
      value: (e) => e.workDate,
      render: (e) => <span className="tabular-nums">{formatDate(e.workDate)}</span>,
    },
    {
      key: "times",
      header: "In / out",
      hideOnMobile: true,
      value: (e) => `${e.clockIn ?? ""}-${e.clockOut ?? ""}`,
      render: (e) => (
        <span className="tabular-nums">
          {e.clockIn}-{e.clockOut}
        </span>
      ),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      sortable: true,
      value: (e) => e.hours,
      render: (e) => <span className="font-semibold text-neutral-900">{e.hours}h</span>,
    },
    { key: "marks", header: "Recorded", render: marks },
    { key: "actions", header: "", align: "right", tableOnly: true, render: actions },
  ];

  return (
    <div className="space-y-6">
      {entries !== null && error === null && (
        <StatGrid cols={3}>
          <StatCard featured label="Days waiting" value={entries.length} icon={CalendarDays} />
          <StatCard
            label="Hours to sign off"
            value={Math.round(entries.reduce((s, e) => s + e.hours, 0) * 10) / 10}
            unit="h"
            icon={Clock}
            hue="sky"
          />
          <StatCard
            label="Estimated days"
            value={estimated}
            icon={Hourglass}
            hue="sun"
            hint={estimated > 0 ? "Typed in or closed automatically: worth a look" : "Everything here was clocked"}
          />
        </StatGrid>
      )}

      {error !== null ? (
        <LoadFailed icon={Clock} message={error} />
      ) : entries === null ? (
        <Skeleton className="h-72" />
      ) : (
        <DataView
          rows={entries}
          columns={columns}
          rowKey={(e) => e.id}
          storageKey={queue.storageKey}
          searchPlaceholder="Search by person"
          caption="Days waiting for approval"
          empty={
            <Empty
              icon={CheckCircle2}
              hue="mint"
              title="Nothing waiting"
              hint={queue.emptyHint ?? "Days appear here once somebody sends their week for approval."}
            />
          }
          renderCard={(e) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonCell name={e.employee?.name ?? "Unnamed"} sub={e.employee?.jobTitle} href={href(e.employeeId)} size={40} />
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold tabular-nums text-primary-700">
                  {e.hours}h
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3">
                <MiniStat label="Day" value={formatDate(e.workDate)} />
                <MiniStat label="In / out" value={`${e.clockIn ?? "-"}-${e.clockOut ?? "-"}`} />
              </div>
              {marks(e)}
              <div className="mt-auto">{actions(e)}</div>
            </div>
          )}
          renderListItem={(e) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <PersonCell
                  name={e.employee?.name ?? "Unnamed"}
                  href={href(e.employeeId)}
                  sub={`${formatDate(e.workDate)} · ${e.clockIn}-${e.clockOut} · ${e.hours}h`}
                />
              </div>
              {marks(e)}
              {actions(e)}
            </div>
          )}
        />
      )}

      {rejecting !== null && (
        <RejectDialog
          entry={rejecting}
          reject={queue.reject}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RejectDialog({
  entry,
  reject,
  onClose,
  onDone,
}: {
  entry: TimeEntry;
  reject: (entryId: string, reason: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await reject(entry.id, reason.trim());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Send this day back"
      subtitle={`${entry.employee?.name ?? ""} · ${formatDate(entry.workDate)}`}
      icon={Send}
      hue="sun"
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Sending…" : "Send back"}
          </Button>
        </>
      }
    >
      {error !== null && <Notice tone="error">{error}</Notice>}

      <div>
        <label htmlFor="ts-reject-reason" className={labelCls}>
          What needs changing
        </label>
        <RichTextEditor id="ts-reject-reason" minHeight={102} value={reason} onChange={setReason} placeholder="That Friday was annual leave." describedBy="ts-reject-reason-hint" />
        <span id="ts-reject-reason-hint" className={hintCls}>
          Required. Sending a day back without saying why leaves somebody
          guessing, and they usually resubmit the same thing.
        </span>
      </div>
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Rules                                                              */
/* ------------------------------------------------------------------ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Rules() {
  const [policy, setPolicy] = useState<TimePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [days, setDays] = useState<number[]>([]);
  const [standardHours, setStandardHours] = useState("8");
  const [dayStartsAt, setDayStartsAt] = useState("09:00");
  const [graceMinutes, setGraceMinutes] = useState("15");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [autoClose, setAutoClose] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [allowsManualEntry, setAllowsManualEntry] = useState(true);

  const apply = useCallback((p: TimePolicy) => {
    setPolicy(p);
    setDays(p.workingDayNumbers);
    setStandardHours(String(p.standardMinutes / 60));
    setDayStartsAt(p.dayStartsAt);
    setGraceMinutes(String(p.graceMinutes));
    setBreakMinutes(String(p.breakMinutes));
    setAutoClose(p.autoCloseAfterMinutes === null ? "" : String(p.autoCloseAfterMinutes / 60));
    setRequiresApproval(p.requiresApproval);
    setAllowsManualEntry(p.allowsManualEntry);
  }, []);

  useEffect(() => {
    hrm.timesheet
      .policy()
      .then((p) => {
        apply(p);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [apply]);

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const updated = await hrm.timesheet.updatePolicy({
        workingDayNumbers: days,
        standardMinutes: Math.round(Number(standardHours) * 60),
        dayStartsAt,
        graceMinutes: Number(graceMinutes),
        breakMinutes: Number(breakMinutes),
        autoCloseAfterMinutes:
          autoClose === "" ? null : Math.round(Number(autoClose) * 60),
        requiresApproval,
        allowsManualEntry,
      });

      apply(updated);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  if (policy === null) {
    return error !== null ? <LoadFailed icon={Settings2} message={error} /> : <Skeleton className="h-96" />;
  }

  const weekly = Number(standardHours) * days.length;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title="What counts as a working day here"
        subtitle="Every figure the timesheet reports reads from these"
        icon={Settings2}
        actions={
          <Button type="submit" variant="primary" size="sm" icon={Settings2} disabled={busy}>
            {busy ? "Saving…" : "Save rules"}
          </Button>
        }
      >
        <div className="space-y-6">
          {error !== null && <Notice tone="error">{error}</Notice>}

          {saved && error === null && (
            <Notice tone="success">
              Saved. New figures use these rules; days already recorded keep the
              hours they were recorded with.
            </Notice>
          )}

          <fieldset>
            <legend className={labelCls}>The working week</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, index) => {
                const day = index + 1;
                const on = days.includes(day);

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={on}
                    className={cx(
                      "h-11 w-14 cursor-pointer rounded-xl border text-sm font-semibold transition-colors",
                      on
                        ? "border-primary-600 bg-primary-600 text-white shadow-sm shadow-primary-600/20"
                        : "ws-hatch border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <p className={hintCls}>
              {days.length === 0
                ? "A week has to have at least one working day."
                : `${days.length} days × ${standardHours}h = ${weekly}h expected a week.`}
            </p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Standard day (hours)">
              <input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={standardHours}
                onChange={(e) => setStandardHours(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Day starts at">
              <input
                type="time"
                value={dayStartsAt}
                onChange={(e) => setDayStartsAt(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Grace (minutes)" hint="Lateness is counted after this.">
              <input
                type="number"
                min={0}
                max={240}
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Unpaid break (minutes)" hint="Deducted from a full day.">
              <input
                type="number"
                min={0}
                max={480}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label="Close a forgotten day after (hours)"
            hint="Leave blank to let it stay open for somebody to fix, which is the honest option. Either way an auto-closed day is marked as a guess."
          >
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={autoClose}
              onChange={(e) => setAutoClose(e.target.value)}
              placeholder="Never"
              className={`${inputCls} max-w-[12rem]`}
            />
          </Field>

          <div className="space-y-3">
            <Toggle
              checked={requiresApproval}
              onChange={setRequiresApproval}
              title="Days have to be approved"
              hint="People send a week for approval and a manager signs it off."
            />
            <Toggle
              checked={allowsManualEntry}
              onChange={setAllowsManualEntry}
              title="Days may be typed in"
              hint="For the day the laptop died. Typed days are always marked as estimated rather than measured."
            />
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-[1.125rem] bg-gradient-to-br shadow-sm from-primary-600 to-primary-500 p-5 text-white">
          <p className="text-sm font-medium text-white/85">Expected each week</p>
          <p className="mt-3 text-[30px] font-bold leading-none tabular-nums">{weekly}h</p>
          <p className="mt-2 text-xs text-white/80">
            {days.length} working {days.length === 1 ? "day" : "days"} of {standardHours}h
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden>
            {DAY_NAMES.map((name, i) => (
              <span
                key={name}
                className={cx(
                  "rounded-lg py-1.5 text-center text-[10px] font-bold",
                  days.includes(i + 1) ? "bg-white text-primary-700" : "bg-white/15 text-white/70",
                )}
              >
                {name[0]}
              </span>
            ))}
          </div>
        </div>
        <Panel title="How the day runs" icon={AlarmClock} hue="sun">
          <ul className="space-y-3 text-sm">
            <RuleLine label="Starts at" value={dayStartsAt} />
            <RuleLine label="Late after" value={`${graceMinutes} min grace`} />
            <RuleLine label="Unpaid break" value={`${breakMinutes} min`} />
            <RuleLine label="Forgotten days close" value={autoClose === "" ? "Never" : `After ${autoClose}h`} />
            <RuleLine label="Approval" value={requiresApproval ? "Required" : "Not required"} />
          </ul>
        </Panel>
      </div>
    </form>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-200 pb-3 last:border-0 last:pb-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold tabular-nums text-neutral-900">{value}</span>
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors",
        checked ? "border-primary-200 bg-primary-50/50" : "border-neutral-200 hover:bg-neutral-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary-600"
      />
      <span>
        <span className="font-semibold text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className={hintCls}>{hint}</span>}
    </label>
  );
}
