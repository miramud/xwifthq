"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarHeart,
  Hourglass,
  MapPin,
  Palmtree,
  Pencil,
  Plane,
  Plus,
  Repeat2,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  ApiError,
  hrm,
  type LeaveAccrual,
  type LeaveBalance,
  type LeaveCoverage,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
  type PublicHoliday,
} from "@/lib/api/hrm-client";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Empty,
  PageHeader,
  PersonAvatar,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Legend } from "@/components/workspace/charts";
import {
  CalendarNav,
  MonthCalendar,
  monthTitle,
  todayYmd,
  ymd,
  type CalendarEvent,
} from "@/components/workspace/Calendar";
import { hueFor, type Hue } from "@/components/workspace/modules";
import LeaveBalances from "./LeaveBalances";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { LeaveWeek } from "../ui2/leave-week";
import {
  DateLeaf,
  ModalFrame,
  Notice,
  PersonCell,
  Skeleton,
  SoftButton,
  ToneChip,
  addDays,
  inputCls,
  mondayOf,
  weekOf,
} from "../ui2/kit";
import { CheckField, FormButtons, FormField, SectionHead } from "../ui2/leave-form";
import { formatDate, formatDayMonth, formatDays, leaveTone } from "@/suite/hrm/lib/format";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * Running leave for the institution.
 *
 * Three jobs, deliberately kept apart: deciding what is waiting, seeing who is
 * away, and setting the rules. They are separate because they happen at
 * different times and by different people — the queue is a daily job, the
 * policy is an annual one, and mixing them puts a "days per year" field next
 * to an approve button.
 *
 * Nothing here recalculates an absence that has already been booked. Changing
 * the working week or adding a holiday affects what people book from now on,
 * never what they have already been granted.
 */

type Tab = "queue" | "calendar" | "balances" | "policy";

const TABS: { key: Tab; label: string }[] = [
  { key: "queue", label: "Requests" },
  { key: "calendar", label: "Who is away" },
  /*
    Its own tab. Approving leave against a balance nobody can look up is how
    an institution ends up arguing about entitlement in email, and the figure
    is needed *while* deciding a request rather than afterwards.
  */
  { key: "balances", label: "Balances" },
  { key: "policy", label: "Policy" },
];

/** A leave type's colour, the same on every screen it appears on. */
export function leaveHue(typeName: string | null | undefined): Hue {
  return hueFor(typeName ?? "Leave");
}

function dateRange(from: string, to: string, short = false): string {
  const f = short ? formatDayMonth : formatDate;
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

export default function LeaveBoard() {
  const [tab, setTab] = useState<Tab>("queue");
  const [summaryKey, setSummaryKey] = useState(0);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Leave"
        subtitle="Decide what is waiting, see who is away, and set the rules everybody books against."
        actions={
          <ButtonLink href="/suite/hrm/me/leave" icon={Plane}>
            Book my own leave
          </ButtonLink>
        }
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="space-y-6">
        {(tab === "queue" || tab === "calendar") && <Summary reloadKey={summaryKey} />}

        {tab === "queue" && <Queue onChanged={() => setSummaryKey((k) => k + 1)} />}
        {tab === "calendar" && <AwayCalendar />}
        {tab === "balances" && <LeaveBalances />}
        {tab === "policy" && <Policy />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

/**
 * Four figures worth glancing at before working the queue. An aid, not a
 * precondition: if any of it fails to load the row simply is not drawn.
 */
function Summary({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<{
    waiting: number;
    awayToday: number;
    booked: number;
    bookedDays: number;
    next: PublicHoliday | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = todayYmd();

    Promise.all([
      hrm.leave.list({ status: "pending" }),
      hrm.leave.calendar({ days: 60 }),
      hrm.leave.holidays(),
    ])
      .then(([pending, calendar, holidays]) => {
        if (cancelled) return;
        const upcoming = holidays
          .filter((h) => h.observedOn.slice(0, 10) >= today)
          .sort((a, b) => a.observedOn.localeCompare(b.observedOn));
        setData({
          waiting: pending.data.length,
          awayToday: calendar.data.filter(
            (r) => r.isGranted && r.startsOn <= today && r.endsOn >= today,
          ).length,
          booked: calendar.data.length,
          bookedDays: calendar.data.reduce((s, r) => s + (r.days ?? 0), 0),
          next: upcoming[0] ?? null,
        });
      })
      .catch(() => {
        /* The row is a convenience; the tabs below still work without it. */
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (failed && data === null) return null;

  if (data === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[124px]" />
        ))}
      </div>
    );
  }

  return (
    <StatGrid>
      <StatCard
        featured
        label="Waiting on you"
        value={data.waiting}
        unit={data.waiting === 1 ? "request" : "requests"}
        icon={Hourglass}
        hint={data.waiting === 0 ? "Every request has been decided" : "Oldest first in the queue"}
      />
      <StatCard
        label="Away today"
        value={data.awayToday}
        unit={data.awayToday === 1 ? "person" : "people"}
        icon={Palmtree}
        hue="mint"
        hint="Approved leave only"
      />
      <StatCard
        label="Booked, next 60 days"
        value={data.booked}
        unit={data.booked === 1 ? "absence" : "absences"}
        icon={CalendarDays}
        hue="grape"
        hint={`${formatDays(data.bookedDays)} in total`}
      />
      <StatCard
        label="Next public holiday"
        value={data.next ? formatDayMonth(data.next.observedOn) : "—"}
        icon={CalendarHeart}
        hue="sun"
        hint={data.next ? data.next.name : "None set for the rest of the year"}
      />
    </StatGrid>
  );
}

/* ------------------------------------------------------------------ */
/*  The queue                                                          */
/* ------------------------------------------------------------------ */

const FILTERS: { key: LeaveStatus | "all"; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "Everything" },
];

function Queue({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<LeaveStatus | "all">("pending");
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<LeaveRequest | null>(null);

  const load = useCallback(
    () =>
      hrm.leave
        .list({ status: status === "all" ? null : status })
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [status],
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
      render: (r) => (
        <PersonCell
          name={r.employee?.name ?? "Unnamed"}
          sub={r.employee?.jobTitle}
          href={`/suite/hrm/people/${r.employeeId}`}
        />
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
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
      render: (r) => <span className="whitespace-nowrap tabular-nums">{dateRange(r.startsOn, r.endsOn)}</span>,
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      sortable: true,
      value: (r) => r.days,
      render: (r) => <span className="font-semibold text-neutral-900">{formatDays(r.days)}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      hideOnMobile: true,
      value: (r) => richExcerpt(r.reason, 200),
      render: (r) =>
        r.reason ? (
          <span className="line-clamp-1 max-w-[16rem] text-neutral-600">{richExcerpt(r.reason, 200)}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.statusLabel,
      render: (r) => (
        <ToneChip tone={leaveTone(r.status)} dot>
          {r.statusLabel}
        </ToneChip>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      tableOnly: true,
      render: (r) => (
        r.isOpen ? (
          <SoftButton
            hue="blue"
            onClick={(e) => {
              e.stopPropagation();
              setDeciding(r);
            }}
          >
            {r.isMine === true ? "View" : "Decide"}
          </SoftButton>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeciding(r);
            }}
          >
            Open
          </Button>
        )
      ),
    },
  ];

  return (
    <>
      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <section>
        <SectionHead
          title="Leave requests"
          subtitle="Open a request to see cover and the person's balance before deciding."
          icon={Plane}
          hue="coral"
        />
        {rows === null ? (
          <Skeleton className="h-64" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="hrm.leave.approvals"
            onRowClick={(r) => setDeciding(r)}
            caption="Leave requests"
            searchPlaceholder="Search people, types, reasons"
            toolbar={
              <Segmented
                label="Show requests"
                options={FILTERS}
                value={status}
                onChange={setStatus}
              />
            }
            empty={
              <Empty
                icon={Plane}
                hue="mint"
                title={status === "pending" ? "Nothing waiting on you" : "Nothing to show"}
                hint={status === "pending" ? "Every request has been decided." : "Try another filter."}
              />
            }
            renderCard={(r) => <RequestCard row={r} />}
            renderListItem={(r) => (
              <div className="flex items-center gap-4 px-5 py-3.5">
                <PersonAvatar name={r.employee?.name ?? "Unnamed"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {r.employee?.name ?? "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.leaveTypeName} · {dateRange(r.startsOn, r.endsOn, true)} · {formatDays(r.days)}
                  </p>
                </div>
                <ToneChip tone={leaveTone(r.status)} dot>
                  {r.statusLabel}
                </ToneChip>
              </div>
            )}
          />
        )}
      </section>

      {deciding !== null && (
        <DecideDialog
          request={deciding}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null);
            void load();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function RequestCard({ row }: { row: LeaveRequest }) {
  const hue = leaveHue(row.leaveTypeName);
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={row.employee?.name ?? "Unnamed"} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-neutral-900">
              {row.employee?.name ?? "Unnamed"}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {row.employee?.jobTitle}
              {row.employee?.department ? ` · ${row.employee.department}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3">
        <DateLeaf date={row.startsOn} hue={hue} />
        <div className="min-w-0 flex-1">
          <Chip hue={hue} dot>
            {row.leaveTypeName}
          </Chip>
          <p className="mt-1.5 truncate text-[13px] font-medium text-neutral-700 tabular-nums">
            {dateRange(row.startsOn, row.endsOn, true)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold leading-none text-neutral-900 tabular-nums">{row.days}</p>
          <p className="mt-1 text-[11px] text-neutral-500">{row.days === 1 ? "day" : "days"}</p>
        </div>
      </div>

      {row.reason && <p className="line-clamp-2 text-[13px] text-neutral-600">{richExcerpt(row.reason, 200)}</p>}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
        <ToneChip tone={leaveTone(row.status)} dot>
          {row.statusLabel}
        </ToneChip>
        <span
          className={cx(
            "inline-flex items-center gap-1.5 text-[13px] font-semibold",
            row.isOpen ? "text-primary-700" : "text-neutral-600",
          )}
        >
          {row.isOpen && row.isMine !== true ? "Decide" : "Open"}
          <ArrowRight size={14} aria-hidden />
        </span>
      </div>
    </div>
  );
}

/**
 * Deciding one request.
 *
 * The coverage figure and the person's balance are fetched with the request
 * rather than left for the approver to go and find. Three of a team of five
 * already off is a different answer from one of five, and an approver who
 * cannot see that is being asked to guess.
 */
/** "1 of 4 teammates also away", or why there is nobody to compare with. */
export function coverageLine(coverage: LeaveCoverage): string {
  if (coverage.team === 0) return "No teammates to compare with";
  const noun = coverage.team === 1 ? "teammate" : "teammates";
  return `${coverage.away} of ${coverage.team} ${noun} also away`;
}

/**
 * The calls the decide dialog makes. HR's by default; My team (S9) passes the
 * team-scoped ones, which have no recall — taking back granted leave stays
 * with HR.
 */
export interface LeaveDecideActions {
  get: (id: string) => Promise<{ meta: { coverage: LeaveCoverage; balance: LeaveBalance | null } }>;
  approve: (id: string, note?: string) => Promise<unknown>;
  decline: (id: string, reason: string) => Promise<unknown>;
  recall?: (id: string, reason: string) => Promise<unknown>;
}

const HR_LEAVE_ACTIONS: LeaveDecideActions = {
  get: (id) => hrm.leave.get(id),
  approve: (id, note) => hrm.leave.approve(id, note),
  decline: (id, reason) => hrm.leave.decline(id, reason),
  recall: (id, reason) => hrm.leave.recall(id, reason),
};

export function DecideDialog({
  request,
  onClose,
  onDecided,
  actions = HR_LEAVE_ACTIONS,
}: {
  request: LeaveRequest;
  onClose: () => void;
  onDecided: () => void;
  actions?: LeaveDecideActions;
}) {
  const [coverage, setCoverage] = useState<LeaveCoverage | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    actions
      .get(request.id)
      .then((res) => {
        if (cancelled) return;
        setCoverage(res.meta.coverage);
        setBalance(res.meta.balance);
      })
      .catch(() => {
        // The decision can still be made without the context; it is an aid,
        // not a precondition.
      });

    return () => {
      cancelled = true;
    };
  }, [request.id, actions]);

  const act = async (what: "approve" | "decline" | "recall") => {
    if (what !== "approve" && reason.trim() === "") {
      setError("Say why. Nobody should learn the outcome and not the reason.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (what === "approve") {
        await actions.approve(request.id, reason.trim() || undefined);
      } else if (what === "decline") {
        await actions.decline(request.id, reason.trim());
      } else if (actions.recall) {
        await actions.recall(request.id, reason.trim());
      }

      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  // Without a recall (My team), granted leave is decided as far as this
  // dialog is concerned.
  const decided = !request.isOpen && (!request.isGranted || !actions.recall);
  // Nobody decides their own leave; the API refuses it, so the dialog says so
  // up front instead of offering buttons that can only fail.
  const mine = request.isMine === true;
  const hue = leaveHue(request.leaveTypeName);

  return (
    <ModalFrame
      title="Decide leave request"
      subtitle={request.employee?.name ?? "Unnamed"}
      icon={Plane}
      hue="coral"
      onClose={onClose}
      footer={
        decided || mine ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Close</Button>
            {request.isGranted ? (
              /*
                Recall, not cancel. Taking back leave already granted is the
                employer overriding a promise, and it is recorded under its
                own status so it can be told apart later from the employee
                simply changing their mind.
              */
              <Button variant="danger" onClick={() => void act("recall")} disabled={busy}>
                Recall
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => void act("decline")}
                  disabled={busy}
                  className="!border-error-500/30 !text-error-700 hover:!bg-error-500/10"
                >
                  Decline
                </Button>
                <Button variant="primary" onClick={() => void act("approve")} disabled={busy}>
                  {busy ? "Saving…" : "Approve"}
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5">
        <DateLeaf date={request.startsOn} hue={hue} />
        <div className="min-w-0 flex-1">
          <Chip hue={hue} dot>
            {request.leaveTypeName}
          </Chip>
          <p className="mt-1.5 text-sm font-semibold text-neutral-900 tabular-nums">
            {dateRange(request.startsOn, request.endsOn)}
          </p>
        </div>
        <p className="text-right text-sm font-bold text-neutral-900">{formatDays(request.days)}</p>
      </div>

      {request.reason && (
        <RichTextView value={request.reason} size="sm" className="rounded-xl bg-neutral-50 px-4 py-3 text-neutral-700" />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-100 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <Users size={12} aria-hidden /> Cover
          </p>
          {coverage === null ? (
            <p className="mt-1 text-sm text-neutral-500">—</p>
          ) : (
            <>
              {/*
                Colleagues only: the person asking is never counted as one of
                the team "away" — their leave is what is being decided.
              */}
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {coverageLine(coverage)}
              </p>
              {coverage.names.length > 0 && (
                <p className="text-xs text-neutral-500">{coverage.names.join(", ")}</p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-neutral-100 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <Hourglass size={12} aria-hidden /> Their balance
          </p>
          {balance === null ? (
            <p className="mt-1 text-sm text-neutral-500">Not tracked</p>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {formatDays(balance.remainingDays)} left
              </p>
              <p className="text-xs text-neutral-500">
                {formatDays(balance.takenDays)} taken · {formatDays(balance.pendingDays)} pending
              </p>
            </>
          )}
        </div>
      </div>

      {request.contactWhileAway && (
        <p className="text-xs text-neutral-500">Reachable on {request.contactWhileAway}</p>
      )}

      {/* Decided already: show the outcome rather than offering it again. */}
      {mine && !decided ? (
        <Notice tone="info">
          This is your own request. You can&apos;t decide your own leave — another HR manager
          has to decide it.
        </Notice>
      ) : decided ? (
        <p className="rounded-xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-600">
          {request.statusLabel}
          {request.decisionNote ? ` — ${richExcerpt(request.decisionNote, 200)}` : ""}
        </p>
      ) : (
        <>
          <FormField
            id="leave-decision-note"
            label={request.isGranted ? "Why is this being recalled?" : "Note (required to decline)"}
          >
            <RichTextEditor id="leave-decision-note" minHeight={76} value={reason} onChange={setReason} />
          </FormField>

          {error !== null && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
        </>
      )}
    </ModalFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Who is away                                                        */
/* ------------------------------------------------------------------ */

type CalView = "month" | "week";

function AwayCalendar() {
  const now = new Date();
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayYmd()));
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "week") return { from: weekStart, days: 7 };
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return { from: ymd(cursor.y, cursor.m, 1), days };
  }, [view, weekStart, cursor]);

  const year = Number(range.from.slice(0, 4));

  useEffect(() => {
    let cancelled = false;

    hrm.leave
      .calendar(range)
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
  }, [range]);

  useEffect(() => {
    let cancelled = false;

    hrm.leave
      .holidays(year)
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const h of list) map[h.observedOn.slice(0, 10)] = h.name;
        setHolidays(map);
      })
      .catch(() => {
        /* Holidays tint the grid; without them it is still correct. */
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  /* Only what falls inside the period on screen; the API may return a wider window. */
  const visible = useMemo(() => {
    const last = addDays(range.from, range.days - 1);
    return (rows ?? []).filter((r) => r.startsOn <= last && r.endsOn >= range.from);
  }, [rows, range]);

  const events: CalendarEvent[] = useMemo(
    () =>
      visible.map((r) => ({
        id: r.id,
        date: r.startsOn,
        endDate: r.endsOn,
        title: `${r.employee?.name ?? "Unnamed"}${r.status === "pending" ? " (pending)" : ""}`,
        meta: r.leaveTypeName,
        hue: leaveHue(r.leaveTypeName),
        href: `/suite/hrm/people/${r.employeeId}`,
      })),
    [visible],
  );

  const legend = useMemo(() => {
    const names = Array.from(new Set(visible.map((r) => r.leaveTypeName))).sort();
    return names.map((n) => ({ label: n, hue: leaveHue(n) }));
  }, [visible]);

  const shift = (dir: -1 | 1) => {
    if (view === "week") {
      setWeekStart((w) => addDays(w, dir * 7));
      return;
    }
    setCursor(({ y, m }) => {
      const d = new Date(y, m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const goToday = () => {
    const t = new Date();
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
    setWeekStart(mondayOf(todayYmd()));
  };

  const title =
    view === "month"
      ? monthTitle(cursor.y, cursor.m)
      : `Week of ${formatDate(weekStart)}`;

  const columns: Column<LeaveRequest>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employee?.name ?? "Unnamed",
      render: (r) => (
        <PersonCell name={r.employee?.name ?? "Unnamed"} sub={r.employee?.department ?? "—"} />
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
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
      render: (r) => <span className="whitespace-nowrap tabular-nums">{dateRange(r.startsOn, r.endsOn)}</span>,
    },
    {
      key: "cover",
      header: "Covered by",
      hideOnMobile: true,
      value: (r) => r.cover?.name ?? "",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.statusLabel,
      render: (r) => (
        <ToneChip tone={leaveTone(r.status)} dot>
          {r.statusLabel}
        </ToneChip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <CalendarNav title={title} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={goToday}>
          <Segmented
            label="Calendar view"
            options={[
              { key: "month", label: "Month" },
              { key: "week", label: "Week" },
            ]}
            value={view}
            onChange={setView}
          />
        </CalendarNav>

        {error !== null ? (
          <Empty icon={CalendarDays} hue="coral" title="Could not load" hint={error} />
        ) : rows === null ? (
          <Skeleton className="h-[560px]" />
        ) : view === "month" ? (
          <MonthCalendar year={cursor.y} month={cursor.m} events={events} holidays={holidays} />
        ) : (
          <LeaveWeek days={weekOf(weekStart)} events={events} holidays={holidays} />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {legend.length > 0 ? (
            <Legend items={legend} />
          ) : (
            <p className="text-xs text-neutral-500">Nobody is booked off in this {view}.</p>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-full bg-sun-400" aria-hidden />
            Public holiday
          </span>
        </div>
      </Card>

      {rows !== null && error === null && (
        <section>
          <SectionHead
            title={`Away in this ${view}`}
            subtitle="Approved and pending leave"
            icon={UserRound}
            hue="grape"
          />
          <DataView
            rows={visible}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="hrm.leave.away"
            rowHref={(r) => `/suite/hrm/people/${r.employeeId}`}
            caption="People away in this period"
            searchPlaceholder="Search people or types"
            empty={
              <Empty
                icon={CalendarDays}
                hue="mint"
                title="Nobody is booked off"
                hint="Approved and pending leave in this period appears here."
              />
            }
            renderCard={(r) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <PersonCell name={r.employee?.name ?? "Unnamed"} sub={r.employee?.department ?? "—"} />
                  <ToneChip tone={leaveTone(r.status)}>{r.statusLabel}</ToneChip>
                </div>
                <div className="flex items-center gap-3">
                  <DateLeaf date={r.startsOn} hue={leaveHue(r.leaveTypeName)} />
                  <div className="min-w-0">
                    <Chip hue={leaveHue(r.leaveTypeName)} dot>
                      {r.leaveTypeName}
                    </Chip>
                    <p className="mt-1 text-[13px] text-neutral-600 tabular-nums">
                      {dateRange(r.startsOn, r.endsOn, true)}
                    </p>
                  </div>
                </div>
                {r.cover?.name && (
                  <p className="text-xs text-neutral-500">Covered by {r.cover.name}</p>
                )}
              </div>
            )}
          />
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Policy                                                             */
/* ------------------------------------------------------------------ */

function Policy() {
  const confirm = useConfirm();
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [holidays, setHolidays] = useState<PublicHoliday[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingType, setAddingType] = useState(false);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [carryingOver, setCarryingOver] = useState<LeaveType | null>(null);

  const load = useCallback(
    () =>
      Promise.all([hrm.leave.types(), hrm.leave.holidays()])
        .then(([t, h]) => {
          setTypes(t);
          setHolidays(h);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const removeHoliday = async (id: string) => {
    const holiday = holidays?.find((h) => h.id === id);
    const ok = await confirm({
      title: holiday ? `Delete the ${holiday.name} holiday?` : "Delete this holiday?",
      body: "It stops being counted as a day off in leave requests and rosters from now on. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Delete holiday",
      recoverable: true,
    });
    if (!ok) return;
    await hrm.leave.deleteHoliday(id);
    await load();
  };

  const typeFacts = (t: LeaveType) =>
    `${t.hasBalance ? `${formatDays(t.daysPerYear)} a year, ${t.accrualLabel.toLowerCase()}` : "Granted case by case, no balance"}${
      t.minimumServiceMonths ? ` · after ${t.minimumServiceMonths} months' service` : ""
    }${t.allowsHalfDays ? " · half days" : ""}`;

  const typeActions = (t: LeaveType) => (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" icon={Pencil} onClick={() => setEditingType(t)} aria-label={`Edit ${t.name}`}>
        Edit
      </Button>
      {/*
        Only where there is a balance to carry. A type granted case by case
        has nothing to roll forward, and offering the button would suggest
        otherwise.
      */}
      {t.hasBalance && (
        <Button
          size="sm"
          icon={Repeat2}
          onClick={() => setCarryingOver(t)}
          aria-label={`Carry over ${t.name}`}
        >
          Carry over
        </Button>
      )}
    </div>
  );

  const typeColumns: Column<LeaveType>[] = [
    {
      key: "name",
      header: "Leave type",
      primary: true,
      sortable: true,
      value: (t) => t.name,
      render: (t) => (
        <div className="flex items-center gap-3">
          <Chip hue={leaveHue(t.name)} dot>
            {t.code}
          </Chip>
          <span className="font-semibold text-neutral-900">{t.name}</span>
        </div>
      ),
    },
    {
      key: "allowance",
      header: "Allowance",
      sortable: true,
      value: (t) => (t.hasBalance ? t.daysPerYear : -1),
      render: (t) =>
        t.hasBalance ? (
          <span className="font-semibold text-neutral-900">{formatDays(t.daysPerYear)}</span>
        ) : (
          <span className="text-neutral-500">Case by case</span>
        ),
    },
    { key: "accrual", header: "Earned", value: (t) => t.accrualLabel, hideOnMobile: true },
    {
      key: "rules",
      header: "Rules",
      hideOnMobile: true,
      render: (t) => (
        <span className="text-xs text-neutral-600">
          {[
            t.minimumServiceMonths ? `After ${t.minimumServiceMonths} months` : null,
            t.minNoticeDays ? `${t.minNoticeDays} days' notice` : null,
            t.allowsHalfDays ? "Half days" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "flags",
      header: "Status",
      render: (t) => (
        <div className="flex flex-wrap gap-1.5">
          {t.isPaid ? <Chip hue="mint">Paid</Chip> : <ToneChip tone="warning">Unpaid</ToneChip>}
          {!t.isActive && <ToneChip tone="neutral">Inactive</ToneChip>}
        </div>
      ),
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: typeActions },
  ];

  const holidayColumns: Column<PublicHoliday>[] = [
    {
      key: "name",
      header: "Holiday",
      primary: true,
      sortable: true,
      value: (h) => h.name,
      render: (h) => (
        <div className="flex items-center gap-3">
          <DateLeaf date={h.observedOn} hue="sun" />
          <span className="font-semibold text-neutral-900">{h.name}</span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Observed on",
      sortable: true,
      value: (h) => h.observedOn,
      render: (h) => <span className="tabular-nums">{formatDate(h.observedOn)}</span>,
    },
    {
      key: "where",
      header: "Where",
      value: (h) => (h.isNationwide ? "Everywhere" : h.location ?? ""),
    },
    {
      key: "charge",
      header: "Leave",
      render: (h) =>
        h.consumesLeave ? (
          <ToneChip tone="warning">Still comes out of leave</ToneChip>
        ) : (
          <Chip hue="mint">Not charged</Chip>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (h) => (
        <Button size="sm" icon={Trash2} onClick={() => void removeHoliday(h.id)}>
          Remove
        </Button>
      ),
    },
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
          title="Leave types"
          subtitle="Changes apply to new requests. Leave already granted keeps the days it was given."
          icon={Settings2}
          hue="grape"
          actions={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddingType(true)}>
              Add type
            </Button>
          }
        />
        {types === null ? (
          <Skeleton className="h-40" />
        ) : (
          <DataView
            rows={types}
            columns={typeColumns}
            rowKey={(t) => t.id}
            storageKey="hrm.leave.types"
            caption="Leave types"
            searchPlaceholder="Search leave types"
            empty={
              <Empty icon={Settings2} title="No leave types yet" hint="Add one before anybody can book time off." />
            }
            renderCard={(t) => {
              const hue = leaveHue(t.name);
              return (
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Chip hue={hue} dot>
                        {t.code}
                      </Chip>
                      <p className="mt-2 truncate text-[15px] font-semibold text-neutral-900">{t.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold leading-none text-neutral-900 tabular-nums">
                        {t.hasBalance ? t.daysPerYear : "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {t.hasBalance ? "days a year" : "no balance"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600">{typeFacts(t)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.isPaid ? <Chip hue="mint">Paid</Chip> : <ToneChip tone="warning">Unpaid</ToneChip>}
                    {!t.isActive && <ToneChip tone="neutral">Inactive</ToneChip>}
                  </div>
                  <div className="mt-auto border-t border-neutral-100 pt-3">{typeActions(t)}</div>
                </div>
              );
            }}
            renderListItem={(t) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Chip hue={leaveHue(t.name)} dot>
                  {t.code}
                </Chip>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{t.name}</p>
                  <p className="truncate text-xs text-neutral-500">{typeFacts(t)}</p>
                </div>
                {!t.isPaid && <ToneChip tone="warning">Unpaid</ToneChip>}
                {!t.isActive && <ToneChip tone="neutral">Inactive</ToneChip>}
                {typeActions(t)}
              </div>
            )}
          />
        )}
      </section>

      <section>
        <SectionHead
          title="Public holidays"
          subtitle="Days the institution is closed. Leave spanning one is not charged for it."
          icon={CalendarHeart}
          hue="sun"
          actions={
            <Button size="sm" icon={Plus} onClick={() => setAddingHoliday(true)}>
              Add holiday
            </Button>
          }
        />
        {holidays === null ? (
          <Skeleton className="h-40" />
        ) : (
          <DataView
            rows={holidays}
            columns={holidayColumns}
            rowKey={(h) => h.id}
            storageKey="hrm.leave.holidays"
            defaultView="grid"
            gridCols={4}
            caption="Public holidays"
            searchPlaceholder="Search holidays"
            empty={
              <Empty
                icon={CalendarDays}
                hue="sun"
                title="No holidays set for this year"
                hint="Without them, a week off over Christmas costs five days instead of two."
              />
            }
            renderCard={(h) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <DateLeaf date={h.observedOn} hue="sun" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug text-neutral-900">{h.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">{formatDate(h.observedOn)}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Chip hue="sky" icon={MapPin}>
                      {h.isNationwide ? "Everywhere" : h.location}
                    </Chip>
                    {h.consumesLeave && <ToneChip tone="warning">Still comes out of leave</ToneChip>}
                  </div>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void removeHoliday(h.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
            renderListItem={(h) => (
              <div className="flex items-center gap-3 px-5 py-3">
                <DateLeaf date={h.observedOn} hue="sun" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{h.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {formatDate(h.observedOn)}
                    {h.isNationwide ? "" : ` · ${h.location}`}
                    {h.consumesLeave ? " · still comes out of leave" : ""}
                  </p>
                </div>
                <Button size="sm" icon={Trash2} onClick={() => void removeHoliday(h.id)}>
                  Remove
                </Button>
              </div>
            )}
          />
        )}
      </section>

      {(addingType || editingType !== null) && (
        <TypeDialog
          existing={editingType ?? undefined}
          onClose={() => {
            setAddingType(false);
            setEditingType(null);
          }}
          onSaved={() => {
            setAddingType(false);
            setEditingType(null);
            void load();
          }}
        />
      )}

      {carryingOver !== null && (
        <CarryOverDialog
          type={carryingOver}
          onClose={() => setCarryingOver(null)}
          onDone={() => {
            setCarryingOver(null);
            void load();
          }}
        />
      )}

      {addingHoliday && (
        <HolidayDialog
          onClose={() => setAddingHoliday(false)}
          onSaved={() => {
            setAddingHoliday(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

const ACCRUALS: { value: LeaveAccrual; label: string; hint: string }[] = [
  {
    value: "annual",
    label: "Annual",
    hint: "The whole entitlement is available from the start of the year.",
  },
  {
    value: "monthly",
    label: "Monthly",
    hint: "Earned a month at a time, so a new starter has only what they have served.",
  },
  {
    value: "none",
    label: "No balance",
    hint: "Granted case by case — compassionate or unpaid leave.",
  },
];

export function TypeDialog({
  existing,
  onClose,
  onSaved,
}: {
  /** Present when changing a type rather than adding one. */
  existing?: LeaveType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [accrual, setAccrual] = useState<LeaveAccrual>(existing?.accrual ?? "annual");
  const [daysPerYear, setDaysPerYear] = useState(
    existing !== undefined ? String(existing.daysPerYear) : "20",
  );
  const [isPaid, setIsPaid] = useState(existing?.isPaid ?? true);
  const [allowsHalfDays, setAllowsHalfDays] = useState(existing?.allowsHalfDays ?? true);
  // H8: on by default — a starter or leaver gets a share of an up-front year.
  const [prorateForStarters, setProrateForStarters] = useState(existing?.prorateForStarters ?? true);
  const [minimumServiceMonths, setMinimumServiceMonths] = useState(
    existing?.minimumServiceMonths != null ? String(existing.minimumServiceMonths) : "",
  );
  const [minNoticeDays, setMinNoticeDays] = useState(
    existing?.minNoticeDays != null ? String(existing.minNoticeDays) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        accrual,
        // A type with no balance has nothing to spend, so the field is not
        // asked for and not sent as a misleading zero-that-means-something.
        daysPerYear: accrual === "none" ? 0 : Number(daysPerYear),
        isPaid,
        allowsHalfDays,
        prorateForStarters,
        minimumServiceMonths: minimumServiceMonths === "" ? undefined : Number(minimumServiceMonths),
        minNoticeDays: minNoticeDays === "" ? undefined : Number(minNoticeDays),
      };

      /*
        Changing a type governs new requests only. Leave already granted keeps
        the days it was given — the card above says so, and it is the reason
        editing is safe to offer at all.
      */
      if (existing !== undefined) {
        await hrm.leave.updateType(existing.id, payload);
      } else {
        await hrm.leave.createType(payload);
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
      title={existing ? "Edit leave type" : "Add leave type"}
      subtitle={existing ? `Changing ${existing.name}` : "A kind of leave and its rules"}
      icon={Settings2}
      hue="grape"
      onClose={onClose}
      onSubmit={submit}
      footer={<FormButtons onCancel={onClose} busy={busy} submitLabel={existing ? "Save changes" : "Add type"} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="lt-name" label="Name">
          <input
            id="lt-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="Annual leave"
            className={inputCls}
          />
        </FormField>
        <FormField id="lt-code" label="Short code">
          <input
            id="lt-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={16}
            placeholder="AL"
            className={`${inputCls} uppercase`}
          />
        </FormField>
      </div>

      <FormField id="lt-accrual" label="How it is earned" hint={ACCRUALS.find((a) => a.value === accrual)?.hint}>
        <SearchableSelect
          id="lt-accrual"
          aria-describedby="lt-accrual-hint"
          value={accrual}
          onChange={(v) => setAccrual(v as LeaveAccrual)}
          options={ACCRUALS.map((a) => ({ value: a.value, label: a.label }))}
        />
      </FormField>

      {accrual !== "none" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="lt-days" label="Days a year">
            <input
              id="lt-days"
              type="number"
              value={daysPerYear}
              onChange={(e) => setDaysPerYear(e.target.value)}
              min={0}
              max={365}
              step={0.5}
              required
              className={inputCls}
            />
          </FormField>
          <FormField id="lt-notice" label="Notice needed (days)">
            <input
              id="lt-notice"
              type="number"
              value={minNoticeDays}
              onChange={(e) => setMinNoticeDays(e.target.value)}
              min={0}
              max={365}
              placeholder="None"
              className={inputCls}
            />
          </FormField>
        </div>
      )}

      <FormField id="lt-service" label="Qualifying service (months)">
        <input
          id="lt-service"
          type="number"
          value={minimumServiceMonths}
          onChange={(e) => setMinimumServiceMonths(e.target.value)}
          min={0}
          max={120}
          placeholder="Available immediately"
          className={inputCls}
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField label="Paid" checked={isPaid} onChange={setIsPaid} />
        <CheckField label="Half days allowed" checked={allowsHalfDays} onChange={setAllowsHalfDays} />
      </div>

      {accrual !== "none" && (
        <CheckField
          label="Prorate for starters and leavers"
          hint={
            accrual === "annual"
              ? "Somebody who joins or leaves mid-year gets their months' share, counting the joining and leaving months in full, to the nearest half day."
              : "Monthly earning already starts on the joining date; this also stops it on the leaving date."
          }
          checked={prorateForStarters}
          onChange={setProrateForStarters}
        />
      )}

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}

/**
 * Rolling last year's unused days forward.
 *
 * Run once a year against a whole institution, which is why it says what it
 * is about to do and to how many people before it does it. The cap and the
 * expiry come from the type itself — this is not the place to argue about
 * policy, only to apply it.
 */
function CarryOverDialog({
  type,
  onClose,
  onDone,
}: {
  type: LeaveType;
  onClose: () => void;
  onDone: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(thisYear - 1);
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const outcome = await hrm.leave.carryOver(type.id, fromYear);
      setResult(outcome.employeesCarried);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not run.");
    } finally {
      setBusy(false);
    }
  };

  if (result !== null) {
    return (
      <ModalFrame
        title="Carry over unused days"
        subtitle={`${type.name} · applies to everybody with a balance`}
        icon={Repeat2}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        }
      >
        <Notice tone="success">
          Carried forward for <span className="font-semibold">{result}</span>{" "}
          {result === 1 ? "person" : "people"}.
        </Notice>
        {/*
          Said plainly. Running it twice is the obvious worry, and somebody
          who does not know the answer will either avoid the button or press
          it repeatedly.
        */}
        <p className="text-xs text-neutral-500">
          Running it again for the same year does not double anybody&rsquo;s days — each
          person&rsquo;s carry-over is set, not added to.
        </p>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      title="Carry over unused days"
      subtitle={`${type.name} · applies to everybody with a balance`}
      icon={Repeat2}
      onClose={onClose}
      onSubmit={run}
      footer={
        <FormButtons onCancel={onClose} busy={busy} busyLabel="Running…" submitLabel="Carry it over" />
      }
    >
      <FormField
        id="co-from"
        label="From which year"
        hint={
          type.maxCarryOverDays != null
            ? `Capped at ${formatDays(type.maxCarryOverDays)} per person by this type.`
            : "This type sets no cap, so whole balances roll forward."
        }
      >
        <SearchableSelect
          id="co-from"
          aria-describedby="co-from-hint"
          value={String(fromYear)}
          onChange={(v) => setFromYear(Number(v))}
          options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({
            value: String(y),
            label: `${y} into ${y + 1}`,
          }))}
        />
      </FormField>

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}

function HolidayDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [observedOn, setObservedOn] = useState("");
  const [location, setLocation] = useState("");
  const [consumesLeave, setConsumesLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.leave.createHoliday({
        name: name.trim(),
        observedOn,
        location: location.trim() === "" ? null : location.trim(),
        consumesLeave,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Add public holiday"
      subtitle="A day the institution is closed"
      icon={CalendarHeart}
      hue="sun"
      onClose={onClose}
      onSubmit={submit}
      footer={<FormButtons onCancel={onClose} busy={busy} submitLabel="Add holiday" />}
    >
      <FormField id="ph-name" label="Name">
        <input
          id="ph-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={255}
          placeholder="Independence Day"
          className={inputCls}
        />
      </FormField>

      <FormField id="ph-date" label="Observed on">
        <input
          id="ph-date"
          type="date"
          value={observedOn}
          onChange={(e) => setObservedOn(e.target.value)}
          required
          className={inputCls}
        />
      </FormField>

      <FormField
        id="ph-where"
        label="Where (optional)"
        hint="Leave blank for a national holiday. Naming an office closes only that one."
      >
        <input
          id="ph-where"
          type="text"
          aria-describedby="ph-where-hint"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Everywhere"
          className={inputCls}
        />
      </FormField>

      <CheckField label="Still comes out of leave" checked={consumesLeave} onChange={setConsumesLeave} />

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}
