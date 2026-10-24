"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hourglass,
  LogIn,
  LogOut,
  Scale,
  Send,
  Timer,
} from "lucide-react";
import { ApiError, hrm, type MyTimesheet, type TimesheetDay } from "@/lib/api/hrm-client";
import {
  Button,
  Card,
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
import { ColumnChart, Legend } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import { Notice, PageSkeleton } from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import { RecordMissedDayDialog } from "./SelfServiceExtras";
import { formatDate } from "@/suite/hrm/lib/format";
import { richExcerpt } from "@/lib/richText";

/**
 * The sign-in button, and the week it feeds.
 *
 * One rule shapes the whole screen: **an open day is worth nothing until it is
 * closed**, and the interface says so rather than hiding it. A card that showed
 * "7.5 hours so far" for somebody still signed in would be inventing an end
 * time, which is how a forgotten sign-out becomes overtime nobody worked.
 *
 * The expected hours come from the institution's policy, so a four-day week or
 * a Sunday-to-Thursday week reads correctly rather than as chronically short,
 * and approved leave and public holidays expect nothing at all.
 *
 * Any week can be opened, not just this one. A missed day can be typed in for
 * any past date, so the page has to be able to show, and send, the week it
 * landed in; otherwise last week's missed day is recorded and never approved.
 */
export default function TimeClock() {
  const [addingDay, setAddingDay] = useState(false);
  const [data, setData] = useState<MyTimesheet | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Any day in the week being shown; undefined is "this week".
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  // True while the week is being (re)fetched. "Send for approval" waits for
  // it, so a click can never submit a week the page has not caught up with.
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setRefreshing(true);
    return hrm.me
      .timesheet(anchor)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setLoaded(true);
        setRefreshing(false);
      });
  }, [anchor]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) {
    return <PageSkeleton />;
  }

  if (data === null) {
    return (
      <div>
        <PageHeader eyebrow="My employment" title="My timesheet" />
        <Card>
          <Empty
            icon={Clock}
            title="You have no employment record here"
            hint="Signing in and out is for employees. Plenty of accounts belong to people this organisation works with rather than employs."
          />
        </Card>
      </div>
    );
  }

  const { openEntry, week, policy, canRecordTime } = data;
  const totals = week.totals;
  const thisMonday = mondayOf(todayIso());
  const isThisWeek = week.from === thisMonday;
  const weekName = isThisWeek ? "This week" : `Week of ${formatDate(week.from)}`;

  const goToWeek = (iso: string | undefined) => {
    setMessage(null);
    setAnchor(iso === undefined || mondayOf(iso) === thisMonday ? undefined : mondayOf(iso));
  };

  // Against the expected week, so a short week is not read as a shortfall.
  const share =
    totals.expectedMinutes === 0
      ? 0
      : Math.min(100, Math.round((totals.workedMinutes / totals.expectedMinutes) * 100));

  const chart = week.days.map((d) => ({
    label: d.label.split(/[\s,]+/)[0].slice(0, 3),
    // An open day counts for nothing until it is closed, the chart agrees.
    value: d.entry === null || d.entry.isOpen ? 0 : d.entry.hours,
    max: Math.max(d.expectedMinutes / 60, d.entry?.hours ?? 0) || undefined,
    hue: (d.entry?.wasLate ? "sun" : d.isAbsent ? "rose" : d.off ? "sky" : "blue") as Hue,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My employment"
        title="My timesheet"
        subtitle={`${weekName} · ${formatDate(week.from)} to ${formatDate(week.to)}`}
        actions={
          <>
            {/*
              The clock handles every day but the one where a phone is flat or
              a shift starts in an emergency. Without this those days are
              simply missing from somebody's timesheet.
            */}
            <Button icon={CalendarPlus} onClick={() => setAddingDay(true)}>
              Add a missed day
            </Button>
            {totals.requiresApproval && (
              <Button
                icon={Send}
                disabled={busy !== null || refreshing}
                onClick={() =>
                  run("submit", async () => {
                    // The week on screen, whichever week that is.
                    const result = await hrm.me.submitWeek(week.from, week.to);
                    setMessage(result.message);
                  })
                }
              >
                {isThisWeek ? "Send for approval" : "Send this week for approval"}
              </Button>
            )}
          </>
        }
      />

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      {message !== null && <Notice tone="info">{message}</Notice>}

      {/*
        Week by week. Forward stops at this week: there is nothing to record
        or send in a week that has not started.
      */}
      <nav aria-label="Choose a week" className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={ChevronLeft}
          disabled={refreshing}
          onClick={() => goToWeek(addDaysIso(week.from, -7))}
        >
          Previous week
        </Button>
        <span className="min-w-[11rem] text-center text-sm font-semibold tabular-nums text-neutral-800" aria-live="polite">
          {formatDate(week.from)} to {formatDate(week.to)}
        </span>
        <Button
          size="sm"
          disabled={refreshing || isThisWeek}
          onClick={() => goToWeek(addDaysIso(week.from, 7))}
        >
          Next week
          <ChevronRight size={15} aria-hidden />
        </Button>
        {!isThisWeek && (
          <Button size="sm" variant="ghost" disabled={refreshing} onClick={() => goToWeek(undefined)}>
            Back to this week
          </Button>
        )}
      </nav>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ---------------------------- the clock ---------------------- */}
        <div
          className={cx(
            "relative flex flex-col justify-between gap-6 overflow-hidden rounded-[1.25rem] p-6 text-white shadow-sm",
            openEntry === null
              ? "bg-gradient-to-br from-primary-600 to-primary-500"
              : "bg-gradient-to-br from-mint-600 to-mint-500",
          )}
        >
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <span className={cx("h-2 w-2 rounded-full", openEntry === null ? "bg-white/60" : "animate-pulse bg-white")} aria-hidden />
              {openEntry === null ? "Not signed in" : "Signed in"}
            </p>
            <p className="mt-3 text-5xl font-bold tracking-tight tabular-nums">
              {openEntry === null
                ? new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
                : openEntry.clockIn}
            </p>
            <p className="mt-2 text-sm text-white/85">
              {openEntry === null
                ? `Day starts at ${policy.dayStartsAt}`
                : /*
                     No running total. The day has no end yet, and printing one
                     would be a guess dressed as a measurement.
                   */
                  `Since ${openEntry.clockIn}. Hours are worked out when you sign out`}
            </p>
          </div>

          <div className="relative space-y-3">
            {openEntry === null ? (
              <button
                type="button"
                disabled={busy !== null || !canRecordTime}
                onClick={() => run("in", () => hrm.me.clockIn())}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-primary-700 shadow-sm outline-none transition hover:bg-primary-50 focus-visible:ring-4 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogIn size={18} aria-hidden />
                Sign in
              </button>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run("out", () => hrm.me.clockOut())}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white shadow-sm outline-none transition hover:bg-neutral-800 focus-visible:ring-4 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={18} aria-hidden />
                Sign out
              </button>
            )}

            {!canRecordTime && (
              <p className="rounded-xl bg-white/15 px-3 py-2 text-xs text-white">
                Your record is not active, so the clock is closed. Your HR manager
                can tell you where that stands.
              </p>
            )}

            {openEntry?.wasLate === true && (
              <p className="rounded-xl bg-white/15 px-3 py-2 text-xs text-white">
                Signed in {openEntry.lateMinutes} minutes after the{" "}
                {policy.graceMinutes}-minute grace period.
              </p>
            )}
          </div>
        </div>

        {/* ----------------------------- the week ---------------------- */}
        <Panel
          className="xl:col-span-2"
          title={weekName}
          subtitle={`${formatDate(week.from)} to ${formatDate(week.to)}`}
          icon={Timer}
          hue="sky"
          actions={
            <Legend
              items={[
                { label: "Worked", hue: "blue" },
                { label: "Late start", hue: "sun" },
              ]}
            />
          }
        >
          <div className="mb-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm text-neutral-600">
                <span className="text-2xl font-bold text-neutral-900 tabular-nums">{totals.workedHours}</span>{" "}
                of {totals.expectedHours} hours
              </span>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  totals.balanceMinutes < 0 ? "bg-sun-50 text-sun-700" : "bg-mint-50 text-mint-700",
                )}
              >
                {totals.balanceMinutes >= 0 ? "+" : ""}
                {totals.balanceHours}h
              </span>
            </div>
            <Progress value={share} label="Share of the expected week" hue="sky" />
          </div>

          <div className="mt-8" />
          <ColumnChart data={chart} height={170} format={(v) => `${v}h`} caption={`Hours worked each day, ${weekName.toLowerCase()}`} />

          <div className="mt-4 flex flex-wrap gap-2">
            {totals.openDays > 0 && (
              <Chip hue="sky" dot>
                {totals.openDays} day{totals.openDays === 1 ? "" : "s"} still open
              </Chip>
            )}
            {totals.lateDays > 0 && <Chip hue="sun" dot>{totals.lateDays} late</Chip>}
            {totals.absentDays > 0 && <Chip hue="rose" dot>{totals.absentDays} not recorded</Chip>}
            {totals.estimatedDays > 0 && <Chip hue="slate" dot>{totals.estimatedDays} estimated</Chip>}
            {totals.awaitingApproval > 0 && (
              <Chip hue="grape" dot>
                {totals.awaitingApproval} awaiting approval
              </Chip>
            )}
          </div>
        </Panel>
      </div>

      <StatGrid>
        <StatCard label="Worked" value={totals.workedHours} unit={`of ${totals.expectedHours}h`} icon={Clock} hue="blue" />
        <StatCard
          label="Balance"
          value={`${totals.balanceMinutes >= 0 ? "+" : ""}${totals.balanceHours}`}
          unit="h"
          icon={Scale}
          hue={totals.balanceMinutes < 0 ? "sun" : "mint"}
          hint={totals.balanceMinutes < 0 ? "short of the expected week" : "on or over the expected week"}
        />
        <StatCard label="Late days" value={totals.lateDays} icon={Hourglass} hue="coral" hint={`${totals.lateMinutes} minutes in all`} />
        <StatCard
          label="Awaiting approval"
          value={totals.awaitingApproval}
          icon={CheckCircle2}
          hue="grape"
          hint={totals.requiresApproval ? "days sent to your manager" : "no approval needed here"}
        />
      </StatGrid>

      <section aria-labelledby="days-heading">
        <SectionHead id="days-heading" title="Day by day" subtitle={`What the clock recorded for each day, ${weekName.toLowerCase()}`} />
        <DataView<TimesheetDay>
          rows={week.days}
          rowKey={(d) => d.date}
          storageKey="hrm.me.timesheet"
          caption={`Your days, ${weekName.toLowerCase()}`}
          searchable={false}
          gridCols={4}
          columns={dayColumns}
          renderCard={(d) => <DayCard day={d} />}
        />
      </section>

      {week.days.some((d) => d.entry?.rejectionReason) && (
        <Panel title="Sent back" subtitle="Your manager returned these days" icon={AlertTriangle} hue="rose">
          <div className="space-y-2">
            {week.days
              .filter((d) => d.entry?.rejectionReason)
              .map((d) => (
                <p key={d.date} className="flex items-start gap-2 rounded-xl bg-error-500/10 px-3 py-2 text-sm text-error-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{formatDate(d.date)}:</span> {richExcerpt(d.entry?.rejectionReason, 200)}
                  </span>
                </p>
              ))}
          </div>
        </Panel>
      )}

      {addingDay && (
        <RecordMissedDayDialog
          onClose={() => setAddingDay(false)}
          onSaved={(workDate) => {
            setAddingDay(false);
            // Show the week the day landed in, so it can be seen and sent.
            if (workDate !== undefined && mondayOf(workDate) !== week.from) {
              goToWeek(workDate);
            } else {
              void load();
            }
          }}
        />
      )}
    </div>
  );
}

/** Today as YYYY-MM-DD, in the viewer's own time zone. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A YYYY-MM-DD date moved by whole days. Pure date arithmetic, in UTC. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week a date falls in, the API's weeks start on Monday. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -offset);
}

/** "Annual leave", "Public holiday · Founders Day", with "(half day)" when so. */
function offText(day: TimesheetDay): string | null {
  if (!day.off) return null;
  const what = day.off.kind === "holiday" ? `Public holiday · ${day.off.name}` : day.off.name;
  return day.off.isHalfDay ? `${what} (half day)` : what;
}

function dayText(day: TimesheetDay): { text: string; cls: string } {
  if (day.entry === null) {
    const off = offText(day);
    if (off !== null && !day.isAbsent) {
      return { text: off, cls: "text-sky-700 font-medium" };
    }
    return day.isAbsent
      ? { text: "Nothing recorded", cls: "text-error-700 font-semibold" }
      : day.isWorkingDay
        ? { text: "-", cls: "text-neutral-400" }
        : { text: "Not a working day", cls: "text-neutral-500" };
  }
  return {
    text: `${day.entry.clockIn}${day.entry.clockOut === null ? ", still in" : ` to ${day.entry.clockOut}`}`,
    cls: "text-neutral-800 tabular-nums",
  };
}

function DayFlags({ day }: { day: TimesheetDay }) {
  const off = offText(day);
  return (
    <span className="flex flex-wrap gap-1">
      {/* Leave or a holiday, named when the row itself shows times. */}
      {off !== null && day.entry !== null && <Chip hue="sky">{off}</Chip>}
      {day.entry?.status === "approved" && (
        <Chip hue="mint" icon={CheckCircle2}>
          Approved
        </Chip>
      )}
      {day.entry?.awaitsApproval === true && <Chip hue="grape">Awaiting approval</Chip>}
      {day.entry?.isEstimated === true && <Chip hue="slate">Estimated</Chip>}
      {day.entry?.wasLate === true && <Chip hue="sun">Late</Chip>}
      {day.entry?.status === "rejected" && (
        <span className="inline-flex items-center rounded-full bg-error-500/10 px-2.5 py-1 text-xs font-semibold text-error-700">
          Sent back
        </span>
      )}
    </span>
  );
}

const dayColumns: Column<TimesheetDay>[] = [
  {
    key: "day",
    header: "Day",
    primary: true,
    value: (d) => d.date,
    render: (d) => <span className="font-semibold text-neutral-900">{d.label}</span>,
  },
  {
    key: "times",
    header: "In / out",
    render: (d) => {
      const t = dayText(d);
      return <span className={t.cls}>{t.text}</span>;
    },
    value: (d) => dayText(d).text,
  },
  {
    key: "hours",
    header: "Hours",
    align: "right",
    value: (d) => (d.entry === null || d.entry.isOpen ? null : d.entry.hours),
    render: (d) => (d.entry === null ? "" : d.entry.isOpen ? "-" : `${d.entry.hours}h`),
  },
  {
    key: "flags",
    header: "Notes",
    render: (d) => <DayFlags day={d} />,
  },
];

function DayCard({ day }: { day: TimesheetDay }) {
  const t = dayText(day);
  const expected = day.expectedMinutes / 60;
  const worked = day.entry === null || day.entry.isOpen ? 0 : day.entry.hours;
  return (
    <div className={cx("flex h-full flex-col gap-3 p-5", !day.isWorkingDay && "bg-neutral-50/60")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold text-neutral-900">{day.label}</p>
        {day.entry?.isOpen && (
          <Chip hue="mint" dot>
            In now
          </Chip>
        )}
      </div>
      <p className={cx("text-sm", t.cls)}>{t.text}</p>
      {day.off && day.entry === null && (
        <Chip hue="sky" dot>
          {day.off.kind === "holiday" ? "Holiday" : "On leave"}
        </Chip>
      )}
      {day.isWorkingDay && expected > 0 && (
        <Progress value={(worked / expected) * 100} size="sm" hue={day.entry?.wasLate ? "sun" : "blue"} label={`${worked}h of ${expected}h`} />
      )}
      <div className="mt-auto">
        <DayFlags day={day} />
      </div>
    </div>
  );
}
