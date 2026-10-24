"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSignature,
  GraduationCap,
  Hourglass,
  ListTodo,
  MessageSquare,
  PieChart,
  Plane,
  Repeat,
  Target,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  CalloutStrip,
  Chip,
  Empty,
  Panel,
  PersonAvatar,
  Progress,
  QuickActions,
  Segmented,
  StatCard,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  cx,
  type QuickAction,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, Donut, SegmentedGauge } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { useAuth } from "@/lib/auth-store";
import { hrm, type HrmOverview } from "@/lib/api/hrm-client";
import {
  countdownTone,
  formatCountdown,
  formatDate,
} from "@/suite/hrm/lib/format";
import { mayOpenHrmPage } from "@/suite/hrm/lib/hrm-access";
import { DateLeaf, weekOf } from "../ui2/kit";
import { FeaturedStat, IconTile, LoadError, LoadingBlocks, PersonCell, ToneChip } from "../ui/recordKit";

/**
 * The HR dashboard.
 *
 * Built around one editorial rule, which is also the API's: **what is already
 * wrong is shown separately from what is coming up.** A contract that expired
 * three weeks ago and one expiring next month are not the same item at
 * different urgencies. The first means somebody is working with nothing
 * covering them, and merging the two lists buries it among things that are
 * merely scheduled.
 *
 * So the overdue counts get their own panel, and in the dates falling due the
 * overdue rows always come first and are marked as overdue in words.
 */

type DueKind = "probation" | "contract" | "internship";

interface DueRow {
  key: string;
  kind: DueKind;
  employeeId: string;
  name: string | null;
  detail: string;
  date: string | null;
  overdue: boolean;
  chip: React.ReactNode;
  /** Sort weight: overdue first, then by date. */
  order: number;
}

const KIND: Record<DueKind, { label: string; hue: Hue; icon: LucideIcon }> = {
  probation: { label: "Probation review", hue: "sun", icon: CalendarClock },
  contract: { label: "Agreement ending", hue: "sky", icon: FileSignature },
  internship: { label: "Conversion decision", hue: "grape", icon: GraduationCap },
};

/*
  The shortcuts row. Each tile is a page from the HR menu, offered under the
  same check the menu uses (`mayOpenHrmPage`), so nobody is shown a tile that
  opens onto a refusal.
*/
const SHORTCUTS: QuickAction[] = [
  { label: "Directory", href: "/suite/hrm/people", icon: Users, hue: "blue" },
  { label: "Leave", href: "/suite/hrm/leave", icon: Plane, hue: "sky" },
  { label: "Timesheets", href: "/suite/hrm/timesheets", icon: Clock, hue: "mint" },
  { label: "Roster", href: "/suite/hrm/roster", icon: CalendarRange, hue: "grape" },
  { label: "Recruitment", href: "/suite/hrm/recruitment", icon: Briefcase, hue: "coral" },
  { label: "Payroll", href: "/suite/hrm/payroll", icon: Banknote, hue: "sun" },
  { label: "Onboarding", href: "/suite/hrm/onboarding", icon: ClipboardList, hue: "rose" },
  { label: "Performance", href: "/suite/hrm/performance", icon: Target, hue: "blue" },
  { label: "Reviews", href: "/suite/hrm/reviews", icon: ClipboardCheck, hue: "mint" },
  { label: "Tasks", href: "/suite/hrm/tasks", icon: ListTodo, hue: "sky" },
];

export default function OverviewBoard() {
  const { user } = useAuth();
  const [data, setData] = useState<HrmOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dueFilter, setDueFilter] = useState<"all" | DueKind>("all");

  useEffect(() => {
    let live = true;

    hrm
      .overview()
      .then((result) => {
        if (!live) return;
        setData(result);
        // Cleared inside the success path rather than at the top of the effect:
        // a synchronous setState in an effect body is a React 19 lint error.
        setError(null);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });

    return () => {
      live = false;
    };
  }, []);

  const dueRows = useMemo<DueRow[]>(() => {
    if (!data) return [];
    const rows: DueRow[] = [];
    data.probation.reviews.forEach((r) =>
      rows.push({
        key: `p-${r.reviewId}`,
        kind: "probation",
        employeeId: r.employeeId,
        name: r.name,
        detail: r.jobTitle ?? "Probation",
        date: r.dueOn,
        overdue: r.isOverdue,
        chip: r.isOverdue ? (
          <ToneChip tone="error">{r.daysLate}d late</ToneChip>
        ) : (
          <ToneChip tone="info">Due</ToneChip>
        ),
        order: r.isOverdue ? 0 : 1,
      }),
    );
    // Overrun first, and never merged into the list below it.
    [...data.contracts.overrun, ...data.contracts.expiringSoon].forEach((c) =>
      rows.push({
        key: `c-${c.contractId}`,
        kind: "contract",
        employeeId: c.employeeId,
        name: c.name,
        detail: c.jobTitle,
        date: c.endsOn,
        overdue: (c.daysRemaining ?? 0) < 0,
        chip: (
          <ToneChip tone={countdownTone(c.daysRemaining)}>{formatCountdown(c.daysRemaining)}</ToneChip>
        ),
        order: (c.daysRemaining ?? 0) < 0 ? 0 : 1,
      }),
    );
    data.internships.due.forEach((i) =>
      rows.push({
        key: `i-${i.placementId}`,
        kind: "internship",
        employeeId: i.employeeId,
        name: i.name,
        detail: i.cohort ?? "No cohort",
        date: i.endsOn,
        overdue: false,
        chip: <ToneChip tone="accent">Decision due</ToneChip>,
        order: 1,
      }),
    );
    return rows.sort((a, b) => a.order - b.order || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  }, [data]);

  const shortcuts = SHORTCUTS.filter((s) => mayOpenHrmPage(user, s.href));

  const banner = (
    <WelcomeBanner
      name={user?.name}
      art="people"
      eyebrow={data ? `HR overview · as at ${formatDate(data.asAt)}` : "HR overview"}
      subtitle="Who is in today, what is waiting on a decision, and which dates fall due next."
      figure={
        data
          ? {
              label: "Signed in now",
              value: `${data.timesheet.signedInNow} of ${data.timesheet.expectedToday}`,
              hint: `${data.leave.awayToday} away on leave today`,
            }
          : undefined
      }
      actions={
        <>
          <Link href="/suite/hrm/people" className={bannerButtonClass("solid")}>
            <Users size={17} aria-hidden />
            Open directory
          </Link>
          <Link href="/suite/hrm/leave" className={bannerButtonClass("glass")}>
            <Plane size={17} aria-hidden />
            Leave requests
          </Link>
        </>
      }
    />
  );

  if (error !== null) {
    return (
      <div>
        {banner}
        <LoadError message={error} />
      </div>
    );
  }

  if (data === null) {
    return (
      <div>
        {banner}
        <LoadingBlocks />
      </div>
    );
  }

  const {
    headcount,
    onboarding,
    probation,
    contracts,
    internships,
    leave,
    attendance,
    recruitment,
    payroll,
    timesheet,
    tasks,
    performance,
  } = data;

  /*
    The problems worth interrupting somebody for. Each is a count of things
    already past a date, never a count of things scheduled.
  */
  const alerts = [
    {
      count: contracts.overrunning,
      label: "agreement",
      detail: "past its end date and still in force",
      href: "/suite/hrm/contracts",
      icon: FileSignature,
    },
    {
      count: probation.overdue,
      label: "probation review",
      detail: "due and not held",
      href: "/suite/hrm/probation",
      icon: CalendarClock,
    },
    {
      count: onboarding.withOverdueSteps,
      label: "starter",
      detail: "with an onboarding step past its date",
      href: "/suite/hrm/onboarding",
      icon: ClipboardList,
    },
    /*
      Somebody with no salary on file appears on no list of salaries, so the
      first time anybody notices is payday. That is the one date it cannot be
      fixed on.
    */
    {
      count: payroll.withoutPayProfile + payroll.cannotBePaid,
      label: "person",
      detail: "cannot be paid until their details are filled in",
      href: "/suite/hrm/payroll",
      icon: Banknote,
    },
    /*
      A rota that exists but was never published governs nobody. It is invisible
      to every person it covers, and the usual way of discovering that is
      somebody not arriving.
    */
    {
      count: attendance.unpublishedShiftsAhead,
      label: "shift",
      detail: "planned for the days ahead but never published",
      href: "/suite/hrm/roster",
      icon: CalendarRange,
    },
    /*
      The memory of an interview decays within a day or two. An unwritten
      scorecard is not a tidy-up task: it is a decision the institution has
      quietly lost the evidence for.
    */
    {
      count: recruitment.interviewsAwaitingScorecards,
      label: "interview",
      detail: "held and never written up",
      href: "/suite/hrm/recruitment",
      icon: MessageSquare,
    },
  ].filter((a) => a.count > 0);

  const deptHues: Hue[] = ["blue", "coral", "mint", "grape", "sun", "sky", "rose"];

  const mix = [
    { label: "Permanent", value: headcount.permanent, hue: "blue" as Hue },
    { label: "Fixed term", value: headcount.contract, hue: "sky" as Hue },
    { label: "Interns", value: headcount.intern, hue: "grape" as Hue },
    { label: "Casual", value: headcount.casual, hue: "sun" as Hue },
  ];

  const dueColumns: Column<DueRow>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => <PersonCell name={r.name} sub={r.detail} size={32} />,
    },
    {
      key: "kind",
      header: "What",
      sortable: true,
      value: (r) => KIND[r.kind].label,
      render: (r) => (
        <Chip hue={KIND[r.kind].hue} icon={KIND[r.kind].icon}>
          {KIND[r.kind].label}
        </Chip>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (r) => r.date ?? "",
      render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span>,
    },
    { key: "state", header: "Status", render: (r) => r.chip },
  ];

  const shownDue = dueFilter === "all" ? dueRows : dueRows.filter((r) => r.kind === dueFilter);
  const expected = timesheet.expectedToday;

  /*
    The week strip and agenda: the same dates as the table further down, laid
    out on this week's calendar with the next few listed under it.
  */
  const today = data.asAt.slice(0, 10);
  const week = weekOf(today);
  const datedDays = new Set(dueRows.map((r) => (r.date ?? "").slice(0, 10)).filter(Boolean));
  const agenda = dueRows.filter((r) => r.date !== null && !r.overdue && r.date.slice(0, 10) >= today).slice(0, 5);
  const overdueDue = dueRows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-6">
      {banner}

      {/* ---------------------------- the numbers --------------------- */}

      <StatGrid>
        <FeaturedStat
          icon={Users}
          label="Headcount"
          value={headcount.headcount}
          /*
            Permanent plus fixed term. Interns and casuals are counted beside it
            rather than inside it: a figure that jumps by fifteen every time a
            cohort arrives is not one anybody can plan against.
          */
          hint={`${headcount.peopleEngaged} engaged in total`}
          href="/suite/hrm/people"
        />
        <StatCard
          icon={ClipboardList}
          hue="sky"
          label="Onboarding"
          value={onboarding.inProgress}
          hint={`${headcount.starters} yet to start`}
          href="/suite/hrm/onboarding"
        />
        <StatCard
          icon={CalendarClock}
          hue="sun"
          label="On probation"
          value={headcount.onProbation}
          hint={`${probation.due} review${probation.due === 1 ? "" : "s"} due`}
          href="/suite/hrm/probation"
        />
        <StatCard
          icon={GraduationCap}
          hue="grape"
          label="Interns"
          value={internships.onProgramme}
          hint={`${internships.decisionsDue} decision${internships.decisionsDue === 1 ? "" : "s"} due`}
          href="/suite/hrm/internships"
        />
      </StatGrid>

      <QuickActions items={shortcuts} />

      {/* --------------------- where people are + today --------------- */}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Where people are"
          subtitle="Everyone currently employed, by department"
          icon={PieChart}
          hue="blue"
          actions={<ViewAllLink href="/suite/hrm/workforce">Workforce</ViewAllLink>}
        >
          {data.byDepartment.length === 0 ? (
            <Empty icon={Users} title="Nobody on the books yet" hint="Take someone on from the directory." />
          ) : (
            <div className="pt-8">
              <ColumnChart
                height={320}
                caption="People currently employed, by department"
                data={data.byDepartment.map((row, i) => ({
                  label: row.label,
                  value: row.value,
                  hue: deptHues[i % deptHues.length],
                }))}
                format={(v) => `${v} ${v === 1 ? "person" : "people"}`}
              />
            </div>
          )}
        </Panel>

        <Panel title="Today" subtitle="Who is in, and what the week needs" icon={UserCheck} hue="mint">
          <SegmentedGauge
            value={timesheet.signedInNow}
            max={Math.max(1, expected)}
            hue="mint"
            size={210}
            label="Signed in"
            display={`${timesheet.signedInNow}/${expected}`}
            caption={
              timesheet.lateToday > 0 || timesheet.notInYet > 0
                ? `${timesheet.lateToday} late · ${timesheet.notInYet} not in yet`
                : "Everyone expected is accounted for"
            }
          />
          <dl className="mt-4 divide-y divide-neutral-100">
            <Line icon={Plane} hue="sky" label="Away on leave" value={leave.awayToday} href="/suite/hrm/leave" />
            <Line icon={Clock} hue="mint" label="Signed in" value={`${timesheet.signedInNow} of ${expected}`} href="/suite/hrm/timesheets" />
            <Line icon={CalendarRange} hue="blue" label="Shifts this week" value={attendance.shiftsNext7Days} href="/suite/hrm/roster" />
            <Line icon={MessageSquare} hue="grape" label="Interviews this week" value={recruitment.interviewsNext7Days} href="/suite/hrm/recruitment" />
          </dl>
          {leave.startingWithin14Days > 0 && (
            // The staffing gap made visible before it arrives rather than on
            // the morning it does.
            <CalloutStrip icon={Plane} hue="sky" title="Leave coming up" className="mt-4">
              {leave.startingWithin14Days} more{" "}
              {leave.startingWithin14Days === 1 ? "person goes" : "people go"} on leave within a fortnight.
            </CalloutStrip>
          )}
        </Panel>
      </div>

      {/* ------------------- attention · decisions · mix -------------- */}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="Needs attention now"
          subtitle="Already past a date"
          icon={AlertTriangle}
          hue={alerts.length > 0 ? "coral" : "mint"}
        >
          {alerts.length === 0 ? (
            <Empty icon={CheckCircle2} hue="mint" title="Nothing overdue" hint="Nothing is past its date right now." />
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li key={alert.href}>
                  <Link
                    href={alert.href}
                    className="group flex min-h-11 items-center gap-3 rounded-2xl bg-coral-50/70 px-3 py-2.5 outline-none transition-colors hover:bg-coral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <IconTile icon={alert.icon} hue="coral" size={36} className="bg-white shadow-sm" />
                    <span className="min-w-0 flex-1 text-sm text-neutral-700">
                      <span className="font-semibold text-coral-700">
                        {alert.count} {alert.label}
                        {alert.count === 1 ? "" : "s"}
                      </span>{" "}
                      {alert.detail}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-neutral-400 group-hover:text-coral-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Waiting on somebody" subtitle="Decisions nobody has made yet" icon={Hourglass} hue="sun">
          <dl className="divide-y divide-neutral-100">
            <Line icon={Plane} hue="sky" label="Leave requests" value={leave.awaitingDecision} href="/suite/hrm/leave" />
            <Line icon={Repeat} hue="grape" label="Shift swaps" value={attendance.swapsAwaitingApproval} href="/suite/hrm/roster" />
            <Line icon={Clock} hue="mint" label="Timesheets" value={timesheet.awaitingApproval} href="/suite/hrm/timesheets" />
            <Line icon={Briefcase} hue="blue" label="Roles to approve" value={recruitment.requisitionsAwaitingApproval} href="/suite/hrm/recruitment" />
            <Line icon={FileSignature} hue="coral" label="Offers out" value={recruitment.offersAwaitingResponse} href="/suite/hrm/recruitment" />
          </dl>
          {/*
            A count says how much work there is. This says whether anybody has
            been left hanging, which is the part they remember.
          */}
          {leave.longestWaitDays >= 3 && (
            <CalloutStrip icon={Hourglass} hue="sun" title="Someone is waiting" className="mt-4" href="/suite/hrm/leave">
              The oldest leave request has been waiting {leave.longestWaitDays} days.
            </CalloutStrip>
          )}
        </Panel>

        <Panel title="Workforce mix" subtitle="Everyone with a live record" icon={Users} hue="grape">
          <div className="flex justify-center">
            <Donut
              data={mix}
              total={headcount.peopleEngaged}
              centerLabel="engaged"
              size={170}
              legend="none"
              caption="People engaged, by kind of employment"
            />
          </div>
          <ul className="mt-5 space-y-1">
            {mix.map((m) => (
              <li key={m.label} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
                <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[m.hue].dot)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-neutral-600">{m.label}</span>
                <span className="font-semibold tabular-nums text-neutral-900">{m.value}</span>
                <span className={cx("w-12 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums", HUE[m.hue].soft)}>
                  {headcount.peopleEngaged > 0 ? Math.round((m.value / headcount.peopleEngaged) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ------------------- this week · recruitment ----------------- */}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="This week"
          subtitle="Reviews, agreements and placements with a date coming up"
          icon={CalendarDays}
          hue="sky"
          actions={<ViewAllLink href="#hrm-dates-section">All dates</ViewAllLink>}
        >
          <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="This week">
            {week.map((day) => {
              const d = new Date(`${day}T12:00:00`);
              const isToday = day === today;
              const has = datedDays.has(day);
              return (
                <li
                  key={day}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-2xl py-2.5",
                    isToday
                      ? "bg-gradient-to-b from-primary-600 to-primary-500 text-white shadow-md shadow-primary-600/25"
                      : "bg-neutral-50 text-neutral-700",
                  )}
                >
                  <span className={cx("text-[11px] font-medium", isToday ? "text-white/85" : "text-neutral-500")}>
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <span className="text-base font-bold tabular-nums">{d.getDate()}</span>
                  <span
                    className={cx("h-1.5 w-1.5 rounded-full", has ? (isToday ? "bg-white" : "bg-primary-500") : "bg-transparent")}
                    aria-hidden
                  />
                  {has && <span className="sr-only">Something falls due</span>}
                </li>
              );
            })}
          </ol>
          {overdueDue > 0 && (
            <CalloutStrip icon={AlertTriangle} hue="coral" title={`${overdueDue} already overdue`} className="mt-4">
              Listed first in the dates below.
            </CalloutStrip>
          )}
          {agenda.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">Nothing else coming up.</p>
          ) : (
            <ul className="mt-4 space-y-1">
              {agenda.map((r) => (
                <li key={r.key}>
                  <Link
                    href={`/suite/hrm/people/${r.employeeId}`}
                    className="group flex min-h-11 items-center gap-3 rounded-2xl px-2 py-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    {r.date && <DateLeaf date={r.date} hue={KIND[r.kind].hue} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {KIND[r.kind].label} · {r.detail} · {formatDate(r.date)}
                      </span>
                    </span>
                    <span className="hidden sm:inline-flex">{r.chip}</span>
                    <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recruitment"
          subtitle="Roles, candidates and offers"
          icon={Briefcase}
          hue="coral"
          actions={<ViewAllLink href="/suite/hrm/recruitment" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Figure label="Open roles" value={recruitment.requisitionsOpen} hue="blue" />
            <Figure label="Approved roles" value={recruitment.requisitionsApproved} hue="mint" />
            <Figure label="Active applications" value={recruitment.applicationsActive} hue="sky" />
            <Figure label="Offers out" value={recruitment.offersAwaitingResponse} hue="coral" />
          </div>
          <dl className="mt-4 divide-y divide-neutral-100">
            <Line icon={MessageSquare} hue="grape" label="Interviews this week" value={recruitment.interviewsNext7Days} href="/suite/hrm/recruitment" />
            <Line icon={ClipboardCheck} hue="rose" label="Scorecards to write" value={recruitment.interviewsAwaitingScorecards} href="/suite/hrm/recruitment" />
          </dl>
        </Panel>
      </div>

      {/* -------------------- starters · payroll · work --------------- */}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Onboarding in progress"
          subtitle={`${onboarding.inProgress} starter${onboarding.inProgress === 1 ? "" : "s"} working through a checklist`}
          icon={ClipboardList}
          hue="sky"
          actions={<ViewAllLink href="/suite/hrm/onboarding">All onboarding</ViewAllLink>}
        >
          {onboarding.starters.length === 0 ? (
            <Empty icon={ClipboardList} hue="sky" title="Nobody is part way through onboarding" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {onboarding.starters.map((starter) => (
                <li key={starter.journeyId} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <PersonAvatar name={starter.name ?? "Unnamed"} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/suite/hrm/people/${starter.employeeId}`}
                        className="block truncate text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
                      >
                        {starter.name ?? "Unnamed"}
                      </Link>
                      <p className="truncate text-xs text-neutral-500">
                        {starter.jobTitle ?? "-"} · starts {formatDate(starter.startsOn)}
                      </p>
                    </div>
                    {starter.overdueSteps > 0 && <ToneChip tone="error">{starter.overdueSteps} late</ToneChip>}
                  </div>
                  <div className="mt-3">
                    <Progress
                      value={starter.progress}
                      hue={starter.overdueSteps > 0 ? "coral" : "sky"}
                      label={starter.programme}
                      showValue
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Payroll"
            subtitle={payroll.openRun === null ? "No run open" : payroll.openRun.period}
            icon={Banknote}
            hue="mint"
            actions={<ViewAllLink href="/suite/hrm/payroll">Open</ViewAllLink>}
          >
            {payroll.openRun === null ? (
              <p className="text-sm text-neutral-500">Nothing is being prepared. The last run has been paid.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-br from-mint-50 to-sky-50 p-4">
                  <p className="text-xs font-medium text-neutral-600">Run in preparation</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-neutral-900">{payroll.openRun.reference}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {payroll.openRun.daysToPayDate !== null && (
                      <ToneChip tone={countdownTone(payroll.openRun.daysToPayDate)}>
                        Pay day {formatCountdown(payroll.openRun.daysToPayDate)}
                      </ToneChip>
                    )}
                    {payroll.openRun.payDate && (
                      <Chip hue="slate" icon={CalendarClock}>
                        {formatDate(payroll.openRun.payDate)}
                      </Chip>
                    )}
                  </div>
                </div>
                {payroll.withoutPayProfile + payroll.cannotBePaid === 0 ? (
                  <CalloutStrip icon={CheckCircle2} hue="mint" title="Everyone on the roster can be paid" />
                ) : (
                  <CalloutStrip
                    icon={AlertTriangle}
                    hue="coral"
                    title={`${payroll.withoutPayProfile + payroll.cannotBePaid} cannot be paid yet`}
                  />
                )}
              </div>
            )}
          </Panel>

          <Panel title="Tasks and reviews" subtitle="Work and performance in progress" icon={ListTodo} hue="grape">
            <dl className="divide-y divide-neutral-100">
              <Line icon={ListTodo} hue="blue" label="Open tasks" value={tasks.open} href="/suite/hrm/tasks" />
              <Line icon={AlertTriangle} hue="coral" label="Tasks overdue" value={tasks.overdue} href="/suite/hrm/tasks" />
              <Line icon={Hourglass} hue="sun" label="Tasks blocked" value={tasks.blocked} href="/suite/hrm/tasks" />
              <Line icon={ClipboardCheck} hue="mint" label="Reviews open" value={performance.reviewsOpen} href="/suite/hrm/reviews" />
            </dl>
          </Panel>
        </div>
      </div>

      {/* ------------------------- dates falling due ------------------ */}

      <section aria-labelledby="hrm-dates" id="hrm-dates-section" className="scroll-mt-24">
        <div className="mb-4">
          <h2 id="hrm-dates" className="text-lg font-bold tracking-tight text-neutral-900">
            Dates falling due
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Probation reviews in the next 30 days, agreements ending in the next 60, and placements ending with
            nothing decided. Anything overdue comes first.
          </p>
        </div>
        <DataView
          rows={shownDue}
          columns={dueColumns}
          rowKey={(r) => r.key}
          rowHref={(r) => `/suite/hrm/people/${r.employeeId}`}
          storageKey="hrm.overview.due"
          caption="Dates falling due"
          searchPlaceholder="Search people"
          toolbar={
            <Segmented
              label="Show"
              value={dueFilter}
              onChange={setDueFilter}
              options={[
                { key: "all", label: "All" },
                { key: "probation", label: "Probation" },
                { key: "contract", label: "Agreements" },
                { key: "internship", label: "Interns" },
              ]}
            />
          }
          empty={
            <Empty
              icon={CalendarClock}
              hue="mint"
              title="Nothing falling due"
              hint="No reviews, agreements or placements need a date in the diary."
            />
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonCell name={r.name} sub={r.detail} size={40} />
                <IconTile icon={KIND[r.kind].icon} hue={KIND[r.kind].hue} size={36} />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Chip hue={KIND[r.kind].hue}>{KIND[r.kind].label}</Chip>
                {r.chip}
              </div>
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-700">{formatDate(r.date)}</span>
              </p>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex items-center gap-4 px-5 py-3.5">
              <IconTile icon={KIND[r.kind].icon} hue={KIND[r.kind].hue} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-neutral-500">
                  {KIND[r.kind].label} · {r.detail} · {formatDate(r.date)}
                </p>
              </div>
              {r.chip}
            </div>
          )}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One figure, linked to the screen that can do something about it.
 *
 * Always a link, including at nil. "No leave requests waiting" is a useful
 * thing to be able to confirm, and a figure that stops being clickable when it
 * reaches zero teaches people not to trust it.
 */
function Line({
  icon,
  hue,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  hue: Hue;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="flex min-w-0 items-center gap-3 text-sm text-neutral-600">
        <IconTile icon={icon} hue={hue} size={36} />
        <Link
          href={href}
          className="flex min-h-11 items-center truncate rounded-lg font-medium outline-none transition-colors hover:text-neutral-900 focus-visible:underline"
        >
          {label}
        </Link>
      </dt>
      <dd className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">{value}</dd>
    </div>
  );
}

/** A small figure on a hue wash, for the recruitment panel's grid. */
function Figure({ label, value, hue }: { label: string; value: number; hue: Hue }) {
  return (
    <div className={cx("rounded-2xl px-3.5 py-3", HUE[hue].soft)}>
      <p className="text-[11px] font-semibold opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
