"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  LogIn,
  LogOut,
  Moon,
  PenLine,
  Plane,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  hrm,
  type LeaveRequest,
  type PerformanceReview,
  type TeamMember,
  type TeamOverview,
  type TeamTodayState,
} from "@/lib/api/hrm-client";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  Segmented,
  StatCard,
  StatGrid,
  cx,
  type PageTab,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { formatDate, formatDays, leaveTone } from "@/suite/hrm/lib/format";
import { DecideDialog, leaveHue, type LeaveDecideActions } from "./LeaveBoard";
import { TimesheetApprovals, type TimesheetQueue } from "./TimesheetBoard";
import { SwapApprovals, type SwapQueue } from "./RosterBoard";
import { ManagerReviewDialog } from "./ReviewsBoard";
import { LoadFailed, PersonCell, Skeleton, ToneChip } from "../ui2/kit";

/*
  My team (S9, 2 Oct 2026): a line manager's decisions about their direct
  reports — leave, timesheet days, shift swaps and the manager half of reviews.

  Every list and every decision here goes to `/api/hrm/team/*`, which the API
  bounds to the signed-in person's *current direct reports*. Nothing on these
  pages filters people out: what arrives is already only theirs. The dialogs
  and queues are HR's own, handed the team-scoped calls, so a decision here
  looks and validates exactly as it does on HR's screens.

  No link goes into HR's employee record — a supervisor cannot open it.
*/

type TeamTab = "overview" | "leave" | "timesheets" | "swaps" | "reviews";

const TEAM_LEAVE: LeaveDecideActions = {
  get: (id) => hrm.team.getLeave(id),
  approve: (id, note) => hrm.team.approveLeave(id, note),
  decline: (id, reason) => hrm.team.declineLeave(id, reason),
};

const TEAM_TIMESHEETS: TimesheetQueue = {
  pending: () => hrm.team.timesheets(),
  approve: (id) => hrm.team.approveTimesheet(id),
  reject: (id, reason) => hrm.team.rejectTimesheet(id, reason),
  personHref: null,
  storageKey: "hrm.team.timesheets",
  emptyHint: "Your reports' days appear here once they send their week for approval.",
};

const TEAM_SWAPS: SwapQueue = {
  list: () => hrm.team.swaps(true),
  approve: (id) => hrm.team.approveSwap(id),
  decline: (id, reason) => hrm.team.declineSwap(id, reason),
  storageKey: "hrm.team.swaps",
};

/* ------------------------------------------------------------------ */
/*  The frame: header + tabs with what is waiting                      */
/* ------------------------------------------------------------------ */

const TITLES: Record<TeamTab, { title: string; subtitle: string }> = {
  overview: { title: "My team", subtitle: "The people who report to you, and what is waiting on you." },
  leave: { title: "Team leave", subtitle: "Leave your reports have asked for. HR is told too, and either of you can decide it." },
  timesheets: { title: "Team timesheets", subtitle: "Days your reports have sent for approval." },
  swaps: { title: "Team swaps", subtitle: "Shift swaps your reports asked for that the colleague has agreed to." },
  reviews: { title: "Team reviews", subtitle: "Write the manager half once their self-assessment is in. HR signs reviews off." },
};

function useTeamOverview(reloadKey: number) {
  const [overview, setOverview] = useState<TeamOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.team
      .overview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { overview, error };
}

function TeamFrame({
  tab,
  overview,
  children,
  actions,
}: {
  tab: TeamTab;
  overview: TeamOverview | null;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const w = overview?.waiting;
  const tabs: PageTab[] = [
    { key: "overview", label: "Overview", href: "/suite/hrm/team" },
    { key: "leave", label: "Leave", href: "/suite/hrm/team/leave", count: w?.leave },
    { key: "timesheets", label: "Timesheets", href: "/suite/hrm/team/timesheets", count: w?.timesheets },
    { key: "swaps", label: "Swaps", href: "/suite/hrm/team/swaps", count: w?.swaps },
    { key: "reviews", label: "Reviews", href: "/suite/hrm/team/reviews", count: w?.reviews },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="My team"
        title={TITLES[tab].title}
        subtitle={TITLES[tab].subtitle}
        tabs={tabs}
        activeTab={tab}
        actions={actions}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

/** Each "today" state: a word, a hue and an icon, so colour is never alone. */
const TODAY: Record<TeamTodayState, { label: string; hue: Hue; icon: LucideIcon; order: number }> = {
  away: { label: "Away", hue: "coral", icon: Plane, order: 0 },
  in: { label: "In", hue: "mint", icon: LogIn, order: 1 },
  expected: { label: "Due in", hue: "sun", icon: CalendarClock, order: 2 },
  signed_out: { label: "Signed out", hue: "sky", icon: LogOut, order: 3 },
  not_in: { label: "Not in today", hue: "slate", icon: Moon, order: 4 },
};

function todayLine(m: TeamMember): string {
  const t = m.today;
  switch (t.state) {
    case "away":
      return `${t.leaveType ?? "On leave"}${t.awayUntil ? ` · back after ${formatDate(t.awayUntil)}` : ""}`;
    case "in":
      return t.signedInAt ? `Signed in at ${t.signedInAt}` : "Signed in";
    case "expected":
      return t.shift ? `${t.shift.name ?? "Shift"} · ${t.shift.startsAt}-${t.shift.endsAt}` : "Rostered today";
    case "signed_out":
      return "Done for the day";
    default:
      return "Not rostered or signed in";
  }
}

/**
 * The team as a row of presence tiles, away first — the first question a
 * manager asks in the morning is who isn't here.
 */
function PresenceTile({ member }: { member: TeamMember }) {
  const s = TODAY[member.today.state];
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-neutral-100 bg-white p-4">
      <span className="relative shrink-0">
        <PersonAvatar name={member.name ?? "Unnamed"} src={member.avatar} size={44} />
        <span
          className={cx(
            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white",
            s.hue === "mint" && "bg-mint-500 text-white",
            s.hue === "coral" && "bg-coral-500 text-white",
            s.hue === "sun" && "bg-sun-500 text-white",
            s.hue === "sky" && "bg-sky-500 text-white",
            s.hue === "slate" && "bg-neutral-400 text-white",
          )}
          aria-hidden
        >
          <s.icon size={11} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900">{member.name ?? "Unnamed"}</p>
        <p className="truncate text-xs text-neutral-500">{member.jobTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip hue={s.hue}>{s.label}</Chip>
          <span className="text-xs text-neutral-600">{todayLine(member)}</span>
        </div>
      </div>
    </li>
  );
}

export function TeamOverviewBoard() {
  const { overview, error } = useTeamOverview(0);

  if (error !== null) {
    return (
      <TeamFrame tab="overview" overview={null}>
        <LoadFailed icon={UsersRound} message={error} />
      </TeamFrame>
    );
  }

  if (overview === null) {
    return (
      <TeamFrame tab="overview" overview={null}>
        <div className="space-y-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      </TeamFrame>
    );
  }

  const people = [...overview.people].sort((a, b) => TODAY[a.today.state].order - TODAY[b.today.state].order);
  const w = overview.waiting;

  return (
    <TeamFrame tab="overview" overview={overview}>
      <div className="space-y-6">
        <StatGrid cols={4}>
          <StatCard
            featured={w.leave > 0}
            label="Leave to decide"
            value={w.leave}
            icon={Plane}
            hue="coral"
            href="/suite/hrm/team/leave"
            hint={w.leave === 0 ? "Nothing waiting" : "Open the requests"}
          />
          <StatCard
            label="Days to approve"
            value={w.timesheets}
            icon={Clock}
            hue="sky"
            href="/suite/hrm/team/timesheets"
            hint={w.timesheets === 0 ? "Nothing waiting" : "Sent for approval"}
          />
          <StatCard
            label="Swaps to decide"
            value={w.swaps}
            icon={ArrowLeftRight}
            hue="grape"
            href="/suite/hrm/team/swaps"
            hint={w.swaps === 0 ? "Nothing waiting" : "Both colleagues agreed"}
          />
          <StatCard
            label="Reviews to write"
            value={w.reviews}
            icon={ClipboardCheck}
            hue="sun"
            href="/suite/hrm/team/reviews"
            hint={w.reviews === 0 ? "Nothing waiting" : "Self-assessment is in"}
          />
        </StatGrid>

        <Panel
          title="Today"
          subtitle={`${formatDate(overview.date)} · ${overview.today.in} in · ${overview.today.away} away · ${overview.today.expected} due in`}
          icon={UsersRound}
          hue="mint"
        >
          {people.length === 0 ? (
            <Empty
              icon={UsersRound}
              hue="slate"
              title="Nobody reports to you yet"
              hint="HR sets who reports to whom on each person's record, under Reports to. Your team appears here once they do."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Your direct reports today">
              {people.map((m) => (
                <PresenceTile key={m.employeeId} member={m} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </TeamFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Leave                                                              */
/* ------------------------------------------------------------------ */

type LeaveFilter = "pending" | "all";

export function TeamLeaveBoard() {
  const [reloadKey, setReloadKey] = useState(0);
  const { overview } = useTeamOverview(reloadKey);
  const [filter, setFilter] = useState<LeaveFilter>("pending");
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<LeaveRequest | null>(null);

  const load = useCallback(
    () =>
      hrm.team
        .leave(filter === "pending" ? "pending" : null)
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<LeaveRequest>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employee?.name ?? "Unnamed",
      render: (r) => <PersonCell name={r.employee?.name ?? "Unnamed"} sub={r.employee?.jobTitle} />,
    },
    {
      key: "type",
      header: "Leave",
      value: (r) => r.leaveTypeName,
      render: (r) => (
        <Chip hue={leaveHue(r.leaveTypeName)} dot>
          {r.leaveTypeName}
        </Chip>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      sortable: true,
      value: (r) => r.startsOn,
      render: (r) => (
        <span className="tabular-nums">
          {r.startsOn === r.endsOn ? formatDate(r.startsOn) : `${formatDate(r.startsOn)} to ${formatDate(r.endsOn)}`}
        </span>
      ),
    },
    { key: "days", header: "Days", align: "right", hideOnMobile: true, value: (r) => r.days, render: (r) => formatDays(r.days) },
    {
      key: "status",
      header: "Status",
      value: (r) => r.statusLabel,
      render: (r) => <ToneChip tone={leaveTone(r.status)}>{r.statusLabel}</ToneChip>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) => (
        <Button size="sm" variant={r.isOpen ? "primary" : "secondary"} onClick={() => setDeciding(r)}>
          {r.isOpen ? "Decide" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <TeamFrame
      tab="leave"
      overview={overview}
      actions={
        <Segmented<LeaveFilter>
          label="Which requests"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "pending", label: "Waiting" },
            { key: "all", label: "All" },
          ]}
        />
      }
    >
      {error !== null ? (
        <LoadFailed icon={Plane} message={error} />
      ) : rows === null ? (
        <Skeleton className="h-72" />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setDeciding(r)}
          storageKey="hrm.team.leave"
          caption="Your reports' leave requests"
          searchPlaceholder="Search by person"
          empty={
            <Empty
              icon={CheckCircle2}
              hue="mint"
              title={filter === "pending" ? "No leave waiting on you" : "No leave requests yet"}
              hint="Requests from the people who report to you appear here as soon as they are made."
            />
          }
        />
      )}

      {deciding !== null && (
        <DecideDialog
          request={deciding}
          actions={TEAM_LEAVE}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null);
            setReloadKey((k) => k + 1);
            void load();
          }}
        />
      )}
    </TeamFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Timesheets and swaps: HR's queues, team-scoped                     */
/* ------------------------------------------------------------------ */

export function TeamTimesheetsBoard() {
  const { overview } = useTeamOverview(0);
  return (
    <TeamFrame tab="timesheets" overview={overview}>
      <TimesheetApprovals queue={TEAM_TIMESHEETS} />
    </TeamFrame>
  );
}

export function TeamSwapsBoard() {
  const { overview } = useTeamOverview(0);
  return (
    <TeamFrame tab="swaps" overview={overview}>
      <SwapApprovals queue={TEAM_SWAPS} />
    </TeamFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Reviews                                                            */
/* ------------------------------------------------------------------ */

const WAITING: Record<string, { label: string; hue: Hue }> = {
  manager: { label: "Waiting on you", hue: "sun" },
  employee: { label: "Waiting on their self-assessment", hue: "sky" },
  meeting: { label: "Ready to meet and sign off", hue: "mint" },
};

export function TeamReviewsBoard() {
  const [reloadKey, setReloadKey] = useState(0);
  const { overview } = useTeamOverview(reloadKey);
  const [rows, setRows] = useState<PerformanceReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState<PerformanceReview | null>(null);

  const load = useCallback(
    () =>
      hrm.team
        .reviews()
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<PerformanceReview>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employee?.name ?? "Unnamed",
      render: (r) => <PersonCell name={r.employee?.name ?? "Unnamed"} sub={r.employee?.jobTitle} />,
    },
    { key: "round", header: "Round", value: (r) => r.cycle?.name ?? "", hideOnMobile: true },
    {
      key: "due",
      header: "Due",
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.cycle?.dueOn ?? "",
      render: (r) => <span className="tabular-nums">{r.cycle?.dueOn ? formatDate(r.cycle.dueOn) : "-"}</span>,
    },
    {
      key: "turn",
      header: "Whose turn",
      value: (r) => r.waitingOn ?? "",
      render: (r) => {
        const w = r.waitingOn ? WAITING[r.waitingOn] : null;
        return w ? <Chip hue={w.hue}>{w.label}</Chip> : <ToneChip>{r.statusLabel}</ToneChip>;
      },
    },
    {
      key: "self",
      header: "Their rating",
      align: "right",
      hideOnMobile: true,
      value: (r) => r.selfRating ?? 0,
      render: (r) => (r.selfRating === null ? "-" : `${r.selfRating}/5`),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) =>
        r.waitingOn === "manager" ? (
          <Button size="sm" variant="primary" icon={PenLine} onClick={() => setWriting(r)}>
            Write my half
          </Button>
        ) : null,
    },
  ];

  return (
    <TeamFrame tab="reviews" overview={overview}>
      {error !== null ? (
        <LoadFailed icon={ClipboardCheck} message={error} />
      ) : rows === null ? (
        <Skeleton className="h-72" />
      ) : (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            if (r.waitingOn === "manager") setWriting(r);
          }}
          storageKey="hrm.team.reviews"
          caption="Your reports' open reviews"
          searchPlaceholder="Search by person"
          empty={
            <Empty
              icon={ClipboardCheck}
              hue="sun"
              title="No reviews open for your team"
              hint="When HR opens a review round, your reports' reviews appear here. You write your half once theirs is in."
            />
          }
        />
      )}

      {writing !== null && (
        <ManagerReviewDialog
          review={writing}
          submitHalf={(id, input) => hrm.team.submitManagerReview(id, input)}
          onClose={() => setWriting(null)}
          onSaved={() => {
            setWriting(null);
            setReloadKey((k) => k + 1);
            void load();
          }}
        />
      )}
    </TeamFrame>
  );
}
