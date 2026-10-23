"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  Clock,
  Palmtree,
  Plane,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { ButtonLink, Chip, Panel, Progress, cx } from "@/components/workspace/kit";
import { eventBlockClass } from "@/components/workspace/Calendar";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { hrm, type EmployeeDossier } from "@/lib/api/hrm-client";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";

/**
 * The rest of somebody's record.
 *
 * The module claimed a single employee record and, until this existed, meant it
 * only in the database: leave, attendance, the rota, pay and how somebody was
 * hired each lived behind a tab that knew nothing about the others. Answering
 * "should I be worried about this person" meant five screens and a good memory.
 *
 * Loaded after the employee rather than with them, because every picker and
 * list in the module fetches an employee and none of them want a leave balance.
 * A failure here leaves the record readable, which is the right trade: the
 * agreements and the probation decision matter more than the fortnight's
 * attendance rate.
 *
 * Each section is a headline and the one or two rows worth seeing without
 * navigating. The detail stays on the screen that owns it, and every section
 * links there rather than reimplementing it.
 */
export default function EmployeeDossierPanel({
  employeeId,
}: {
  employeeId: string;
}) {
  const [dossier, setDossier] = useState<EmployeeDossier | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hrm.employees
      .dossier(employeeId)
      .then((res) => {
        if (!cancelled) setDossier(res);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  // Silent on failure. The employment record above is still the page, and a
  // red banner about an attendance rate would suggest otherwise.
  if (failed) return null;

  if (dossier === null) {
    return (
      <div aria-hidden className="grid gap-6 lg:grid-cols-2">
        <div className="ws-card h-48 animate-pulse bg-neutral-50" />
        <div className="ws-card h-48 animate-pulse bg-neutral-50" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Leave dossier={dossier} />
      <Attendance dossier={dossier} />
      <Roster dossier={dossier} />
      {/* Confidential: absent for somebody whose roles do not give HR's confidential records. */}
      {dossier.pay !== null && <Pay pay={dossier.pay} />}
      <Origin dossier={dossier} />
    </div>
  );
}

/**
 * Whether somebody is here today, and what they have left.
 *
 * The banner is the point. "Away until Friday" is the answer to why nobody can
 * reach them, and it was previously three clicks into a calendar.
 */
function Leave({ dossier }: { dossier: EmployeeDossier }) {
  const { leave } = dossier;
  const away = leave.currentAbsence;

  return (
    <Panel
      title="Leave"
      icon={Plane}
      hue="sky"
      subtitle={
        leave.pendingRequests > 0
          ? `${leave.pendingRequests} request${
              leave.pendingRequests === 1 ? "" : "s"
            } awaiting a decision`
          : "Nothing outstanding"
      }
      actions={
        <ButtonLink href="/suite/hrm/leave" size="sm">
          Calendar
        </ButtonLink>
      }
    >
      {away !== null && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-sun-50 px-3 py-2.5">
          <Palmtree size={15} className="shrink-0 text-sun-700" aria-hidden />
          <p className="text-sm font-medium text-sun-700">
            Away on {away.type.toLowerCase()} until {formatDate(away.endsOn)}
          </p>
          {!away.isApproved && <Chip hue="slate">Not yet approved</Chip>}
        </div>
      )}

      {leave.balances.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No leave types with a balance to track.
        </p>
      ) : (
        <ul className="space-y-4">
          {leave.balances.map((row) => {
            const total = row.remainingDays + row.takenDays;
            const hue = hueFor(row.name);
            return (
              <li key={row.typeId}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-neutral-700">
                    <span className={cx("h-2 w-2 shrink-0 rounded-full", HUE[hue].dot)} aria-hidden />
                    {row.name}
                  </span>
                  <span className="shrink-0 text-sm text-neutral-900">
                    <span className="font-bold tabular-nums">{row.remainingDays}</span>
                    <span className="text-neutral-500"> left</span>
                    {row.pendingDays > 0 && (
                      // Held back rather than deducted. Booking the same fortnight
                      // twice is the mistake this figure prevents.
                      <span className="ml-2 rounded-full bg-sun-50 px-2 py-0.5 text-[11px] font-semibold text-sun-700">
                        {row.pendingDays} pending
                      </span>
                    )}
                  </span>
                </div>
                <Progress
                  value={total > 0 ? (row.takenDays / total) * 100 : 0}
                  hue={hue}
                  size="sm"
                />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** The last fortnight, and anything in it somebody has to account for. */
function Attendance({ dossier }: { dossier: EmployeeDossier }) {
  const { attendance } = dossier;

  const overtimeMinutes = attendance.overtime.reduce(
    (total, row) => total + row.payableMinutes,
    0,
  );

  return (
    <Panel
      title="Attendance"
      icon={UserCheck}
      hue="mint"
      subtitle={`${formatDate(attendance.from)} – ${formatDate(attendance.to)}`}
      actions={
        <ButtonLink href="/suite/hrm/attendance" size="sm">
          Full record
        </ButtonLink>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Turned up" value={`${attendance.attendanceRate}%`} hue="mint" />
        <Figure label="Late" value={`${attendance.lateDays}`} hue="sun" />
        <Figure
          label="Unexplained"
          value={`${attendance.unexplainedDays}`}
          hue={attendance.unexplainedDays > 0 ? "coral" : "slate"}
        />
        <Figure label="Overtime" value={hours(overtimeMinutes)} hue="grape" />
      </div>
      <div className="mt-4">
        <Progress value={attendance.attendanceRate} hue="mint" label="Attendance rate" />
      </div>

      {attendance.exceptions.length > 0 && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Days to account for
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attendance.exceptions.map((day) => (
              <Chip key={day.date} hue="sun" icon={CalendarDays}>
                {formatDate(day.date)}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * What they are next asked to work.
 *
 * Published shifts only. A draft rota is not something anybody should arrange
 * childcare around, and that includes the manager reading this page.
 */
function Roster({ dossier }: { dossier: EmployeeDossier }) {
  const { roster } = dossier;

  return (
    <Panel
      title="Next shifts"
      icon={CalendarRange}
      hue="blue"
      subtitle={
        roster.shifts === 0
          ? "Nothing published for the fortnight ahead"
          : `${roster.shifts} shift${roster.shifts === 1 ? "" : "s"} · ${hours(
              roster.expectedMinutes,
            )}`
      }
      actions={
        <ButtonLink href="/suite/hrm/roster" size="sm">
          Roster
        </ButtonLink>
      }
    >
      {roster.next.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing published. A rota that has not been published is invisible to
          the person it covers.
        </p>
      ) : (
        <ul className="space-y-2">
          {roster.next.map((shift) => (
            <li
              key={shift.id}
              className={cx(
                "relative flex flex-wrap items-center gap-3 rounded-xl border py-2.5 pl-4 pr-3",
                "before:absolute before:inset-y-2 before:left-1.5 before:w-[3px] before:rounded-full",
                eventBlockClass(shift.crossesMidnight ? "grape" : "blue"),
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {formatDate(shift.worksOn)}
                {shift.name ? ` · ${shift.name}` : ""}
              </span>
              <span className="shrink-0 rounded-md bg-white/70 px-2 py-0.5 text-xs font-semibold tabular-nums">
                {shift.startsAt}–{shift.endsAt}
              </span>
              {shift.crossesMidnight && <Chip hue="grape">Overnight</Chip>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * What they are paid, what they were last paid, and what they owe.
 *
 * The loan balance belongs on the person's record rather than only on the
 * payroll screen: a manager asked why a deduction appeared should be able to
 * answer without going to find somebody in finance.
 */
function Pay({ pay }: { pay: NonNullable<EmployeeDossier["pay"]> }) {

  return (
    <Panel
      title="Pay"
      icon={Wallet}
      hue="mint"
      subtitle={
        pay.monthlyBasicKobo === null
          ? "No salary on file"
          : `${nairaFromKobo(pay.monthlyBasicKobo)} basic a month`
      }
      actions={
        <ButtonLink href="/suite/hrm/payroll" size="sm">
          Payroll
        </ButtonLink>
      }
    >
      {pay.missingDetails.length > 0 && (
        // Named rather than counted: "Pension PIN" is something somebody can go
        // and ask for, "two details missing" sends them hunting.
        <div className="mb-4 rounded-xl bg-sun-50 px-3 py-2.5">
          <p className="flex items-center gap-2 text-sm font-medium text-sun-700">
            <Banknote size={15} className="shrink-0" aria-hidden />
            {pay.hasProfile
              ? "Cannot be paid until this is filled in"
              : "Nobody has set a salary for this person"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pay.missingDetails.map((detail) => (
              <Chip key={detail} hue="sun">
                {detail}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <dl className="space-y-2.5">
        {pay.lastPayslip !== null ? (
          <div className="rounded-2xl bg-gradient-to-br from-mint-50 to-sky-50 p-4">
            <Row
              label={`Last paid · ${pay.lastPayslip.period ?? "—"}`}
              value={nairaFromKobo(pay.lastPayslip.netKobo)}
              strong
            />
            <div className="mt-2">
              <Row
                label="Gross"
                value={nairaFromKobo(pay.lastPayslip.grossKobo)}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No payslip from an approved run yet.
          </p>
        )}

        {pay.loans.count > 0 && (
          <div className="border-t border-neutral-100 pt-2.5">
            <Row
              label={`Owing on ${pay.loans.count} ${
                pay.loans.count === 1 ? "loan" : "loans"
              }`}
              value={nairaFromKobo(pay.loans.outstandingKobo)}
            />
            <p className="mt-1 text-xs text-neutral-500">
              {pay.loans.monthlyKobo === 0
                ? "Collection is suspended — still owed, not being deducted."
                : `${nairaFromKobo(pay.loans.monthlyKobo)} comes off each run.`}
            </p>
          </div>
        )}
      </dl>
    </Panel>
  );
}

/**
 * How they came to be here.
 *
 * Recruitment creates the employee and then forgets them. Keeping the thread is
 * what lets anybody ask which source produced the people still here a year
 * later — the only recruitment question that really matters.
 *
 * Null for anybody entered by hand, which during setup is nearly everybody, and
 * saying nothing is more honest than inventing a story.
 */
function Origin({ dossier }: { dossier: EmployeeDossier }) {
  const { origin } = dossier;

  if (origin === null) return null;

  return (
    <Panel title="How they were hired" icon={UserPlus} hue="grape">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-neutral-800">
          Offered {origin.jobTitle} at {nairaFromKobo(origin.salaryKobo)}
        </p>
        {origin.sourceLabel !== null && (
          <Chip hue="grape">{origin.sourceLabel}</Chip>
        )}
        {origin.wasReturningCandidate && (
          <Chip hue="sky">Had applied before</Chip>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Fact label="Applied" value={formatDate(origin.appliedAt)} />
        <Fact label="Accepted" value={formatDate(origin.acceptedAt)} />
        {origin.daysFromApplication !== null && (
          <Fact
            label="Took"
            value={`${origin.daysFromApplication} day${
              origin.daysFromApplication === 1 ? "" : "s"
            }`}
          />
        )}
        {origin.reference !== null && (
          <Fact label="Requisition" value={origin.reference} />
        )}
      </dl>

      {origin.candidateId !== null && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock size={12} className="shrink-0" aria-hidden />
          <Link
            href={`/suite/hrm/recruitment/candidates/${origin.candidateId}`}
            className="font-semibold text-primary-600 hover:text-primary-700"
          >
            The application they were hired from
          </Link>
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Figure({
  label,
  value,
  hue,
}: {
  label: string;
  value: string;
  hue: Hue;
}) {
  return (
    <div className={cx("min-w-0 rounded-xl px-3 py-2.5", HUE[hue].soft)}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-sm text-neutral-600">{label}</dt>
      <dd
        className={cx(
          "shrink-0 tabular-nums text-neutral-900",
          strong ? "text-lg font-bold" : "text-sm font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-neutral-50 px-3 py-2">
      <dt className="text-[11px] font-medium text-neutral-500">{label}</dt>
      <dd className="truncate text-sm font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}

/** Minutes as hours, to one place. Nobody reads a rota in minutes. */
function hours(minutes: number): string {
  if (minutes === 0) return "—";

  return `${(minutes / 60).toFixed(1)}h`;
}
