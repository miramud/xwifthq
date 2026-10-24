"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Check,
  MapPin,
  Clock,
  FileSignature,
  Hash,
  ListChecks,
  MessagesSquare,
  Scale,
  Target,
  Timer,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ApiError, hrm, type Employee, type OnboardingStep } from "@/lib/api/hrm-client";
import {
  CalloutStrip,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  Progress,
  QuickActions,
  StatCard,
  StatGrid,
  WelcomeBanner,
  bannerButtonClass,
  cx,
  type QuickAction,
} from "@/components/workspace/kit";
import { IconTile as WsIconTile, ListRow } from "@/suite/lms/components/ui/ws";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SegmentedGauge } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import {
  contractTone,
  countdownTone,
  employmentTone,
  formatCountdown,
  formatDate,
  salary,
} from "@/suite/hrm/lib/format";
import { InfoRow, Notice, PageSkeleton, ToneChip, toneHue } from "@/suite/hrm/components/ui2/kit";

/**
 * A person's own employment record.
 *
 * The one page in this module that is not for the HR manager. Two things follow
 * from that.
 *
 * **It shows what is waiting on them, and only that.** The onboarding steps
 * owned by IT or Finance are listed so they can see the state of play, but only
 * their own are tickable, a starter cannot mark their own laptop as issued,
 * because they are not the one who would know.
 *
 * **"No record" is not an error.** Plenty of people with accounts are not
 * employed here: an examiner, a contractor billed through Finance, a learner on
 * an assigned course. They get a plain explanation rather than a 404.
 */
export default function MyEmployment() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEmployee(await hrm.me.employment());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not load.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async (stepId: string) => {
    setBusy(stepId);
    try {
      await hrm.me.completeStep(stepId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) {
    return <PageSkeleton />;
  }

  if (employee === null) {
    return (
      <div>
        <PageHeader title="My employment" subtitle="Your record with this organisation" />
        <Card>
          <Empty
            icon={UserRound}
            title="You have no employment record here"
            hint="That is not a problem. Plenty of accounts belong to people this organisation works with rather than employs."
          />
        </Card>
      </div>
    );
  }

  const journey = employee.onboarding?.find((j) => j.isOpen);
  const inForce = employee.contract?.find((c) => c.isInForce);
  const mine = (journey?.steps ?? []).filter((s) => s.isMine && !s.isComplete);

  const service =
    employee.monthsOfService === null
      ? "-"
      : employee.monthsOfService >= 24
        ? String(Math.floor(employee.monthsOfService / 12))
        : String(employee.monthsOfService);
  const serviceUnit =
    employee.monthsOfService === null
      ? undefined
      : employee.monthsOfService >= 24
        ? "years"
        : employee.monthsOfService === 1
          ? "month"
          : "months";

  return (
    <div className="space-y-6">
      <WelcomeBanner
        name={employee.person?.name}
        title={employee.person?.name ? undefined : "Your employment"}
        art="people"
        eyebrow="My employment"
        className="!mb-0"
        subtitle={
          <>
            {employee.jobTitle} · {employee.department ?? "No department"}
            {employee.manager?.name ? ` · reporting to ${employee.manager.name}` : ""}
          </>
        }
        actions={
          <>
            <Link href="/suite/hrm/me/details" className={bannerButtonClass("solid")}>
              <UserRound size={17} aria-hidden />
              Update your details
            </Link>
            <Link href="/suite/hrm/me/leave" className={bannerButtonClass("glass")}>
              <CalendarDays size={17} aria-hidden />
              My leave
            </Link>
          </>
        }
        aside={
          /* Where you stand, in words as well as colour. */
          <ul className="flex flex-wrap gap-2 lg:max-w-[16rem] lg:flex-col lg:items-end" aria-label="Your status">
            <li>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm">
                <span className={cx("h-2 w-2 rounded-full", HUE[toneHue(employmentTone(employee.status))].dot)} aria-hidden />
                {employee.statusLabel}
              </span>
            </li>
            <li>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
                <Briefcase size={13} aria-hidden />
                {employee.employmentTypeLabel}
              </span>
            </li>
            {employee.isCurrent && employee.daysUntilEnd !== null && (
              <li>
                <ToneChip tone={countdownTone(employee.daysUntilEnd)} icon={CalendarClock} className="ring-1 ring-inset ring-white/40">
                  Ends {formatCountdown(employee.daysUntilEnd)}
                </ToneChip>
              </li>
            )}
          </ul>
        }
      />

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      {/* -------------------------- where I stand -------------------- */}

      <StatGrid>
        <StatCard featured label="Service" value={service} unit={serviceUnit} icon={Timer} hint="with this organisation" />
        <StatCard label="First day" value={formatDate(employee.startedOn)} icon={CalendarDays} hue="sky" />
        <StatCard
          label={employee.confirmedOn ? "Confirmed" : "Probation ends"}
          value={formatDate(employee.confirmedOn ?? employee.probationEndsOn)}
          icon={BadgeCheck}
          hue={employee.confirmedOn ? "mint" : "sun"}
        />
        <StatCard label="Employee number" value={employee.employeeNumber ?? "-"} icon={Hash} hue="grape" />
      </StatGrid>

      <QuickActions items={QUICK} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* --------------------------- my checklist --------------------- */}
          {journey && (
            <Panel
              title="Your onboarding"
              subtitle={`${journey.programmeName} · ${journey.progress ?? 0}% done`}
              icon={ListChecks}
              hue="coral"
            >
              <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                <SegmentedGauge
                  value={journey.progress ?? 0}
                  hue="coral"
                  label="Required steps done"
                  size={200}
                />
                <div>
                  <Progress value={journey.progress ?? 0} hue="coral" label="Progress" showValue />
                  {mine.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Waiting on you</p>
                      <ul className="mt-2 space-y-2">
                        {mine.map((step) => (
                          <li key={step.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
                            <button
                              type="button"
                              onClick={() => void complete(step.id)}
                              disabled={busy === step.id}
                              aria-label={`Mark "${step.title}" done`}
                              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-neutral-300 bg-white text-transparent transition-colors hover:border-primary-500 hover:text-primary-500 disabled:opacity-60"
                            >
                              <Check size={14} aria-hidden />
                            </button>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-neutral-900">{step.title}</span>
                              {step.dueOn && (
                                <span className="block text-xs text-neutral-500">Due {formatDate(step.dueOn)}</span>
                              )}
                            </span>
                            {step.isOverdue && <ToneChip tone="error">Overdue</ToneChip>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-neutral-500">Nothing is waiting on you right now.</p>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {journey && (
            <section aria-labelledby="checklist-heading">
              <h2 id="checklist-heading" className="mb-3 text-[15px] font-semibold text-neutral-900">
                Everything on your checklist
              </h2>
              <DataView<OnboardingStep>
                rows={journey.steps ?? []}
                rowKey={(s) => s.id}
                storageKey="hrm.me.onboarding"
                caption="Your onboarding checklist"
                searchPlaceholder="Search steps"
                columns={checklistColumns}
                renderCard={(s) => <StepCard step={s} />}
              />
            </section>
          )}

          {/* ---------------------------- my agreement -------------------- */}
          <Panel
            title="Your agreement"
            subtitle={inForce ? `In force since ${formatDate(inForce.startsOn)}` : undefined}
            icon={FileSignature}
            hue="grape"
            actions={inForce ? <ToneChip tone={contractTone(inForce.status)}>{inForce.statusLabel}</ToneChip> : undefined}
          >
            {!inForce ? (
              <p className="text-sm text-neutral-500">
                No agreement is recorded as in force. Your HR manager can tell you where that stands.
              </p>
            ) : (
              <div className="grid gap-x-6 sm:grid-cols-2">
                <InfoRow icon={Briefcase} label="Role" value={inForce.jobTitle} hue="blue" />
                <InfoRow
                  icon={CalendarDays}
                  label="Term"
                  hue="sky"
                  value={
                    inForce.isOpenEnded
                      ? "Open-ended"
                      : `${formatDate(inForce.startsOn)} to ${formatDate(inForce.endsOn)}`
                  }
                />
                <InfoRow icon={Wallet} label="Salary" value={salary(inForce.grossSalary, inForce.salaryPeriod)} hue="mint" />
                <InfoRow
                  icon={Clock}
                  label="Notice"
                  hue="sun"
                  value={inForce.noticeDays === null ? "-" : `${inForce.noticeDays} days`}
                />
              </div>
            )}
          </Panel>
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Key dates" subtitle="Your time here so far" icon={CalendarClock} hue="sky">
              <Timeline employee={employee} />
            </Panel>
            <Panel title="Your team" subtitle="Who you work with" icon={Users} hue="mint">
              {employee.manager ? (
                <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                  <PersonAvatar name={employee.manager.name} size={44} />
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500">You report to</p>
                    <p className="truncate text-sm font-semibold text-neutral-900">{employee.manager.name ?? "Your manager"}</p>
                    <p className="truncate text-xs text-neutral-500">{employee.manager.jobTitle}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">No manager is recorded for you.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-neutral-200/80 p-3">
                  <p className="text-xs text-neutral-500">Department</p>
                  <p className="truncate text-sm font-semibold text-neutral-900">{employee.department ?? "-"}</p>
                </div>
                <div className="rounded-2xl border border-neutral-200/80 p-3">
                  <p className="text-xs text-neutral-500">Reporting to you</p>
                  <p className="text-sm font-semibold tabular-nums text-neutral-900">{employee.directReports ?? 0}</p>
                </div>
                {employee.workLocation && (
                  <div className="col-span-2 rounded-2xl border border-neutral-200/80 p-3">
                    <p className="text-xs text-neutral-500">Where you work</p>
                    <p className="truncate text-sm font-semibold text-neutral-900">{employee.workLocation}</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* ------------------------------ side ------------------------------ */}
        <div className="space-y-6">
          <Panel title="Your self-service" subtitle="Everything that is yours to see and do" bodyClassName="px-3 pb-3 pt-2">
            <ul className="space-y-0.5">
              {SHORTCUTS.map((s) => (
                <ListRow
                  key={s.href}
                  href={s.href}
                  leading={<WsIconTile icon={s.icon} hue={s.hue} size={40} />}
                  title={s.label}
                  meta={s.hint}
                />
              ))}
            </ul>
          </Panel>

          {/*
            The prompt, on the one page somebody reads when they want to know
            what the organisation holds about them. An address is a fact only
            the person reliably knows, and the wrong one is found on the day a
            P45 has to reach somebody who has already left.
          */}
          <Card className="p-3">
            <CalloutStrip icon={MapPin} hue="sky" title="Moved, or changed your number?" href="/suite/hrm/me/details">
              Your address and contacts are yours to keep up to date: update them here.
            </CalloutStrip>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Timeline({ employee }: { employee: Employee }) {
  const today = new Date().toISOString().slice(0, 10);
  type Mark = { label: string; date: string | null; hue: Hue };
  const settled: Mark = employee.confirmedOn
    ? { label: "Confirmed in post", date: employee.confirmedOn, hue: "mint" }
    : { label: "Probation ends", date: employee.probationEndsOn, hue: "sun" };
  const marks: Mark[] = [
    { label: "Hired", date: employee.hiredOn, hue: "grape" },
    { label: "First day", date: employee.startedOn, hue: "blue" },
    settled,
    ...(employee.endedOn ? [{ label: "Employment ends", date: employee.endedOn, hue: "rose" as Hue }] : []),
  ];
  const items = marks.filter((i) => i.date !== null);

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">No dates are recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-0.5 before:bg-neutral-100">
      {items.map((i) => {
        const future = (i.date ?? "").slice(0, 10) > today;
        return (
          <li key={i.label} className="relative">
            <span
              aria-hidden
              className={cx(
                "absolute -left-6 top-1 h-4 w-4 rounded-full border-[3px] border-white shadow-sm",
                future ? "ws-hatch" : HUE[i.hue].dot,
              )}
            />
            <p className="text-sm font-semibold text-neutral-900">{i.label}</p>
            <p className="text-xs text-neutral-500">
              {formatDate(i.date)}
              {future ? " · coming up" : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const SHORTCUTS: { label: string; hint: string; href: string; icon: LucideIcon; hue: Hue }[] = [
  { label: "My leave", hint: "Balances, bookings and the calendar", href: "/suite/hrm/me/leave", icon: CalendarDays, hue: "coral" },
  { label: "My timesheet", hint: "Sign in, sign out, send your week", href: "/suite/hrm/me/timesheet", icon: Clock, hue: "sky" },
  { label: "My rota", hint: "Your shifts and swaps", href: "/suite/hrm/me/roster", icon: CalendarClock, hue: "grape" },
  { label: "My work", hint: "Tasks and targets", href: "/suite/hrm/me/work", icon: Target, hue: "mint" },
  { label: "My pay", hint: "Payslips", href: "/suite/hrm/me/pay", icon: Wallet, hue: "sun" },
  { label: "My interviews", hint: "Panels you sit on", href: "/suite/hrm/me/interviews", icon: MessagesSquare, hue: "blue" },
  { label: "My cases", hint: "Raise or follow a concern", href: "/suite/hrm/me/cases", icon: Scale, hue: "rose" },
];

/* The quick links row: the self-service pages used most, all open to everyone with a record. */
const QUICK: QuickAction[] = [
  { label: "Book leave", href: "/suite/hrm/me/leave", icon: CalendarDays, hue: "coral" },
  { label: "My timesheet", href: "/suite/hrm/me/timesheet", icon: Clock, hue: "sky" },
  { label: "My rota", href: "/suite/hrm/me/roster", icon: CalendarClock, hue: "grape" },
  { label: "My payslips", href: "/suite/hrm/me/pay", icon: Wallet, hue: "sun" },
  { label: "My work", href: "/suite/hrm/me/work", icon: Target, hue: "mint" },
  { label: "My details", href: "/suite/hrm/me/details", icon: UserRound, hue: "blue" },
];

function stepState(step: OnboardingStep): { label: string; hue: Hue } {
  if (step.isComplete) return { label: "Done", hue: "mint" };
  if (step.isOverdue) return { label: "Late", hue: "sun" };
  return { label: "To do", hue: "slate" };
}

const checklistColumns: Column<OnboardingStep>[] = [
  {
    key: "title",
    header: "Step",
    primary: true,
    sortable: true,
    value: (s) => s.title,
    render: (s) => (
      <span className="flex items-center gap-2.5">
        <span
          className={cx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            s.isComplete ? "border-mint-600 bg-mint-600 text-white" : "border-neutral-200 text-transparent",
          )}
          aria-hidden="true"
        >
          <Check size={12} />
        </span>
        <span className={cx("font-medium", s.isComplete ? "text-neutral-500 line-through" : "text-neutral-900")}>
          {s.title}
        </span>
      </span>
    ),
  },
  {
    key: "owner",
    header: "Whose",
    sortable: true,
    // Whose it is, so nobody waits on a step that is not theirs.
    value: (s) => (s.isMine ? "Yours" : s.ownerRoleLabel),
    render: (s) => <Chip hue={s.isMine ? "blue" : "slate"}>{s.isMine ? "Yours" : s.ownerRoleLabel}</Chip>,
  },
  {
    key: "due",
    header: "Due",
    sortable: true,
    value: (s) => s.dueOn ?? "",
    render: (s) => <span className="tabular-nums">{s.dueOn ? formatDate(s.dueOn) : "-"}</span>,
  },
  {
    key: "state",
    header: "State",
    sortable: true,
    value: (s) => stepState(s).label,
    render: (s) => {
      const st = stepState(s);
      return (
        <Chip hue={st.hue} dot>
          {st.label}
        </Chip>
      );
    },
  },
];

function StepCard({ step }: { step: OnboardingStep }) {
  const st = stepState(step);
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <Chip hue={step.isMine ? "blue" : "slate"}>{step.isMine ? "Yours" : step.ownerRoleLabel}</Chip>
        <Chip hue={st.hue} dot>
          {st.label}
        </Chip>
      </div>
      <p className={cx("text-[15px] font-semibold", step.isComplete ? "text-neutral-500 line-through" : "text-neutral-900")}>
        {step.title}
      </p>
      {step.description && <p className="line-clamp-2 text-xs text-neutral-500">{step.description}</p>}
      <p className="mt-auto flex items-center gap-1.5 text-xs text-neutral-500">
        <CalendarDays size={13} aria-hidden />
        {step.dueOn ? `Due ${formatDate(step.dueOn)}` : "No due date"}
      </p>
    </div>
  );
}
