"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarRange, Plane, Plus, Undo2 } from "lucide-react";
import {
  ApiError,
  hrm,
  type DayPortion,
  type LeaveBalance,
  type LeaveQuote,
  type LeaveRequest,
  type LeaveType,
  type MyLeave as MyLeaveData,
} from "@/lib/api/hrm-client";
import { Button, Card, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Legend } from "@/components/workspace/charts";
import {
  CalendarNav,
  MonthCalendar,
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
  PastelCard,
  PageSkeleton,
  StackBar,
  ToneChip,
  labelCls,
  inputCls,
} from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import { TeamAwayPanel, useTeamAway } from "./SelfServiceExtras";
import { formatDate, formatDays, leaveTone } from "@/suite/hrm/lib/format";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { richExcerpt } from "@/lib/richText";

/**
 * Booking your own time off.
 *
 * The screen is built around one number — what is actually left — and one
 * thing people get wrong, which is how much a stretch of dates costs. A week
 * off is not five days for everybody, so the cost is quoted from the server as
 * the dates change rather than guessed in the browser: the arithmetic depends
 * on the institution's working week and its holiday calendar, and neither of
 * those belongs here.
 *
 * `remainingDays` is the only figure shown as available, because it already
 * holds back pending requests. Showing the gross entitlement next to a "book"
 * button is how somebody books the same fortnight twice.
 */
export default function MyLeave() {
  const [data, setData] = useState<MyLeaveData | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  /*
    Before the balances, deliberately, in spirit: knowing how many days you
    have is the easy half; knowing which week three colleagues have already
    booked is what makes a request likely to be approved. One request feeds
    both the calendar and the side panel.
  */
  const team = useTeamAway(60);

  const load = useCallback(
    () =>
      Promise.all([hrm.me.leave(), hrm.me.leaveTypes()])
        .then(([leave, leaveTypes]) => {
          setData(leave);
          setTypes(leaveTypes);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const header = (actions?: React.ReactNode, year?: number) => (
    <PageHeader
      eyebrow="My employment"
      title="My leave"
      subtitle={year ? `Your balances, bookings and calendar for ${year}` : "Your balances, bookings and calendar"}
      actions={actions}
    />
  );

  if (error !== null && data === null) {
    return (
      <div>
        {header()}
        <LoadFailed icon={Plane} title="Could not load your leave" message={error} />
      </div>
    );
  }

  if (data === null) {
    return <PageSkeleton stats={3} />;
  }

  const tracked = data.balances.filter((b) => b.tracksBalance);
  const open = data.requests.filter((r) => r.isOpen);
  const settled = data.requests.filter((r) => !r.isOpen);

  return (
    <div className="space-y-6">
      {header(
        <Button variant="primary" icon={Plus} onClick={() => setBooking(true)} disabled={types.length === 0}>
          Book leave
        </Button>,
        data.year,
      )}

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tracked.map((balance) => (
          <BalanceCard key={balance.typeId} balance={balance} />
        ))}
        <NextOff requests={data.requests} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <LeaveCalendar requests={data.requests} team={team} className="xl:col-span-2" />
        <TeamAwayPanel state={team} />
      </div>

      <section aria-labelledby="requests-heading">
        <SectionHead id="requests-heading" title="Your requests" subtitle={`Everything you have asked for in ${data.year}`} />
        {data.requests.length === 0 ? (
          <Card>
            <Empty
              icon={CalendarDays}
              hue="coral"
              title="Nothing booked this year"
              hint={`Book leave and ${deciderLine(data.managerName ?? null, null).replace(/^It /, "it ")}`}
            />
          </Card>
        ) : (
          <RequestList rows={open.concat(settled)} onChanged={load} />
        )}
      </section>

      <BalanceDetail balances={data.balances} />

      {booking && (
        <BookDialog
          types={types}
          managerName={data.managerName ?? null}
          onClose={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Balances                                                           */
/* ------------------------------------------------------------------ */

/** The pending segment needs a colour that is not the type's own. */
function pendingHue(hue: Hue): Hue {
  return hue === "sun" ? "coral" : "sun";
}

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const hue = hueFor(balance.name);
  const total = balance.accruedDays + balance.carriedDays + balance.adjustmentDays;
  const plain = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <PastelCard
      hue={hue}
      icon={Plane}
      label={`${balance.name} left`}
      value={formatDays(balance.remainingDays)}
      sub={
        balance.pendingDays > 0
          ? `${formatDays(balance.pendingDays)} awaiting a decision`
          : `${formatDays(balance.takenDays)} taken this year`
      }
    >
      <div className="rounded-xl bg-white/70 p-3">
        <StackBar
          label={`${balance.name} this year`}
          total={total}
          format={plain}
          parts={[
            { label: "Taken", value: balance.takenDays, hue },
            { label: "Pending", value: balance.pendingDays, hue: pendingHue(hue) },
          ]}
        />
      </div>
    </PastelCard>
  );
}

/** The next stretch of leave that stands, so the page answers "when am I off?" first. */
function NextOff({ requests }: { requests: LeaveRequest[] }) {
  const today = todayYmd();
  const next = requests
    .filter((r) => (r.isOpen || r.isGranted) && r.endsOn.slice(0, 10) >= today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];

  if (next === undefined) {
    return (
      <div className="flex flex-col justify-center gap-2 rounded-[1.125rem] border border-dashed border-neutral-300 bg-white/60 p-5">
        <p className="text-sm font-semibold text-neutral-800">Nothing booked ahead</p>
        <p className="text-xs text-neutral-500">Book leave and your next time off shows here.</p>
      </div>
    );
  }

  const hue = hueFor(next.leaveTypeName);
  const away = next.startsOn.slice(0, 10) <= today;
  const daysTo = Math.round(
    (new Date(`${next.startsOn.slice(0, 10)}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000,
  );

  return (
    <div className="flex flex-col gap-4 rounded-[1.125rem] bg-gradient-to-br from-primary-600 to-primary-500 p-5 text-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/90">{away ? "You are off now" : "Your next time off"}</p>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
          {next.isOpen ? "Awaiting a decision" : "Booked"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-xl bg-white p-0.5">
          <DateLeaf date={next.startsOn} hue={hue} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{next.leaveTypeName}</p>
          <p className="text-sm text-white/85">
            {formatDate(next.startsOn)}
            {next.startsOn !== next.endsOn ? ` to ${formatDate(next.endsOn)}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-auto text-xs text-white/85">
        {formatDays(next.days)} off{away ? "" : daysTo === 1 ? ", starting tomorrow" : `, starting in ${daysTo} days`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar                                                           */
/* ------------------------------------------------------------------ */

function LeaveCalendar({
  requests,
  team,
  className,
}: {
  requests: LeaveRequest[];
  team: ReturnType<typeof useTeamAway>;
  className?: string;
}) {
  const today = todayYmd();
  const [cursor, setCursor] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
  const [show, setShow] = useState<"mine" | "team">("team");

  const shift = (n: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  // Only leave that stands: declined and withdrawn requests are not on anybody's calendar.
  const standing = useMemo(() => requests.filter((r) => r.isOpen || r.isGranted), [requests]);

  const events = useMemo<CalendarEvent[]>(() => {
    const mine = standing.map((r) => ({
      id: `me-${r.id}`,
      date: r.startsOn.slice(0, 10),
      endDate: r.endsOn.slice(0, 10),
      title: r.isOpen ? `${r.leaveTypeName} (awaiting)` : r.leaveTypeName,
      meta: r.statusLabel,
      hue: hueFor(r.leaveTypeName),
    }));
    const colleagues =
      show === "team"
        ? (team.rows ?? []).map((r) => ({
            id: `team-${r.id}`,
            date: r.startsOn.slice(0, 10),
            endDate: r.endsOn.slice(0, 10),
            title: r.employee?.name ?? "A colleague",
            meta: r.leaveTypeName,
            hue: "slate" as Hue,
          }))
        : [];
    return [...mine, ...colleagues];
  }, [standing, team.rows, show]);

  const holidays = useMemo(
    () => Object.fromEntries(team.holidays.map((h) => [h.observedOn.slice(0, 10), h.name])),
    [team.holidays],
  );

  const typeNames = Array.from(new Set(standing.map((r) => r.leaveTypeName)));

  return (
    <Panel className={className} title="Your leave calendar" subtitle="Your leave in colour by type, colleagues in grey" icon={CalendarRange} hue="coral">
      <CalendarNav
        title={monthTitle(cursor.y, cursor.m)}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}
      >
        <Segmented
          label="Whose leave to show"
          value={show}
          onChange={setShow}
          options={[
            { key: "team", label: "With team" },
            { key: "mine", label: "Just mine" },
          ]}
        />
      </CalendarNav>
      <MonthCalendar year={cursor.y} month={cursor.m} events={events} holidays={holidays} maxPerDay={2} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            ...typeNames.map((n) => ({ label: n, hue: hueFor(n) })),
            ...(show === "team" ? [{ label: "Colleagues away", hue: "slate" as Hue }] : []),
          ]}
        />
        <span className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span className="h-2.5 w-4 rounded-sm bg-sun-100" aria-hidden />
          Public holiday
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Colleagues and holidays are shown for the next {team.days} days.</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Requests                                                           */
/* ------------------------------------------------------------------ */

function RequestList({
  rows,
  onChanged,
}: {
  rows: LeaveRequest[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const cancel = async (row: LeaveRequest) => {
    setBusy(row.id);

    try {
      await hrm.me.cancelLeave(row.id);
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const dates = (row: LeaveRequest) =>
    `${formatDate(row.startsOn)}${row.startsOn !== row.endsOn ? ` to ${formatDate(row.endsOn)}` : ""}`;

  /*
    Only an open request can be withdrawn by the person who made it.
    Taking back leave that was already granted is the employer's
    decision and lives on the manager's screen under its own name.
  */
  const withdraw = (row: LeaveRequest) =>
    row.isOpen ? (
      <Button size="sm" icon={Undo2} onClick={() => void cancel(row)} disabled={busy === row.id}>
        {busy === row.id ? "Withdrawing…" : "Withdraw"}
      </Button>
    ) : null;

  const columns: Column<LeaveRequest>[] = [
    {
      key: "type",
      header: "Type",
      primary: true,
      sortable: true,
      value: (r) => r.leaveTypeName,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[hueFor(r.leaveTypeName)].dot)} aria-hidden />
          <span className="font-semibold text-neutral-900">{r.leaveTypeName}</span>
        </span>
      ),
    },
    { key: "dates", header: "Dates", sortable: true, value: (r) => r.startsOn, render: (r) => <span className="tabular-nums">{dates(r)}</span> },
    { key: "days", header: "Days", sortable: true, value: (r) => r.days, render: (r) => formatDays(r.days) },
    {
      key: "note",
      header: "Decision note",
      hideOnMobile: true,
      value: (r) => richExcerpt(r.decisionNote, 200),
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
    { key: "actions", header: "", align: "right", tableOnly: true, render: withdraw },
  ];

  return (
    <DataView<LeaveRequest>
      rows={rows}
      rowKey={(r) => r.id}
      columns={columns}
      storageKey="hrm.me.leave"
      caption="Your leave requests"
      searchPlaceholder="Search requests"
      renderCard={(r) => {
        const hue = hueFor(r.leaveTypeName);
        return (
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <DateLeaf date={r.startsOn} hue={hue} />
              <ToneChip tone={leaveTone(r.status)} dot>
                {r.statusLabel}
              </ToneChip>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">{r.leaveTypeName}</p>
              <p className="text-xs text-neutral-500 tabular-nums">
                {dates(r)} · {formatDays(r.days)}
              </p>
            </div>
            {r.decisionNote && <p className="line-clamp-2 rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-600">{richExcerpt(r.decisionNote, 200)}</p>}
            {r.isOpen && <div className="mt-auto">{withdraw(r)}</div>}
          </div>
        );
      }}
      renderListItem={(r) => (
        <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
          <DateLeaf date={r.startsOn} hue={hueFor(r.leaveTypeName)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{r.leaveTypeName}</p>
            <p className="truncate text-xs text-neutral-500 tabular-nums">
              {dates(r)} · {formatDays(r.days)}
              {r.decisionNote ? ` · ${richExcerpt(r.decisionNote, 200)}` : ""}
            </p>
          </div>
          <ToneChip tone={leaveTone(r.status)} dot>
            {r.statusLabel}
          </ToneChip>
          {withdraw(r)}
        </div>
      )}
    />
  );
}

/**
 * Where a balance comes from.
 *
 * Shown in full rather than as a single number because a balance nobody can
 * reconstruct is a balance people query by email. Accrued, carried, adjusted,
 * taken and pending each appear, and they add up.
 */
function BalanceDetail({ balances }: { balances: LeaveBalance[] }) {
  const tracked = balances.filter((b) => b.tracksBalance);

  if (tracked.length === 0) return null;

  const num = (key: string, header: string, get: (b: LeaveBalance) => number): Column<LeaveBalance> => ({
    key,
    header,
    align: "right",
    sortable: true,
    value: get,
  });

  return (
    <section aria-labelledby="adds-up-heading">
      <SectionHead id="adds-up-heading" title="How that adds up" subtitle="Accrued, carried, adjusted, taken and pending: they add up to what is left" />
      <DataView<LeaveBalance>
        rows={tracked}
        rowKey={(b) => b.typeId}
        storageKey="hrm.me.leave.balances"
        caption="How that adds up"
        searchable={false}
        columns={[
          {
            key: "type",
            header: "Type",
            primary: true,
            value: (b) => b.name,
            render: (b) => (
              <span>
                <span className="inline-flex items-center gap-2 font-semibold text-neutral-900">
                  <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hueFor(b.name)].dot)} aria-hidden />
                  {b.name}
                </span>
                {/*
                  A zero that needs explaining. "You have 0 carried days" and
                  "your carried days expired in March" are different
                  sentences, and only one of them answers the question.
                */}
                {b.carryOverLapsed && (
                  <span className="ml-2 text-xs text-neutral-500">carried days have expired</span>
                )}
              </span>
            ),
          },
          num("accrued", "Accrued", (b) => b.accruedDays),
          num("carried", "Carried", (b) => b.carriedDays),
          {
            ...num("adjusted", "Adjusted", (b) => b.adjustmentDays),
            render: (b) =>
              b.adjustmentDays === 0 ? "-" : b.adjustmentDays > 0 ? `+${b.adjustmentDays}` : b.adjustmentDays,
          },
          num("taken", "Taken", (b) => b.takenDays),
          num("pending", "Pending", (b) => b.pendingDays),
          {
            ...num("left", "Left", (b) => b.remainingDays),
            render: (b) => <span className="font-bold text-neutral-900">{b.remainingDays}</span>,
          },
        ]}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Booking                                                            */
/* ------------------------------------------------------------------ */

const PORTIONS: { value: DayPortion; label: string }[] = [
  { value: "full", label: "Whole day" },
  { value: "morning", label: "Morning only" },
  { value: "afternoon", label: "Afternoon only" },
];

/**
 * Who a booking goes to, in words.
 *
 * Not "your HR manager": a request goes to the line manager when there is
 * one, otherwise to the organisation's HR managers — and a type that needs no
 * approval is granted on the spot.
 */
export function deciderLine(managerName: string | null, type: LeaveType | null): string {
  if (type !== null && type.requiresApproval === false) {
    return "This type is approved straight away.";
  }
  return managerName
    ? `It goes to ${managerName} for a decision.`
    : "It goes to your HR team for a decision.";
}

function BookDialog({
  types,
  managerName,
  onClose,
  onBooked,
}: {
  types: LeaveType[];
  managerName: string | null;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [startPortion, setStartPortion] = useState<DayPortion>("full");
  const [endPortion, setEndPortion] = useState<DayPortion>("full");
  const [reason, setReason] = useState("");
  const [contactWhileAway, setContactWhileAway] = useState("");
  const [coverId, setCoverId] = useState("");
  const [colleagues, setColleagues] = useState<{ value: string; label: string }[]>([]);

  /*
    Who will pick up the work. Optional, and only colleagues currently
    employed here; the list is the employee-facing one, not HR's directory.
    A failure just leaves the picker empty — cover is a courtesy, not a
    condition of booking.
  */
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => hrm.me.colleagues())
      .then((rows) => {
        if (cancelled) return;
        setColleagues(
          rows.map((c) => ({
            value: c.id,
            label: c.jobTitle ? `${c.name ?? "Unnamed"} · ${c.jobTitle}` : (c.name ?? "Unnamed"),
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [quote, setQuote] = useState<LeaveQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const type = types.find((t) => t.id === leaveTypeId) ?? null;

  /*
    The cost is quoted by the server, not computed here. It depends on the
    institution's working week and its public holidays, and a second
    implementation in the browser would eventually disagree with the one that
    actually charges the balance.
  */
  useEffect(() => {
    if (startsOn === "" || endsOn === "") {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;

    hrm.me
      .quoteLeave({ startsOn, endsOn, startPortion, endPortion })
      .then((res) => {
        if (cancelled) return;
        setQuote(res);
        setQuoteError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [startsOn, endsOn, startPortion, endPortion]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.me.requestLeave({
        leaveTypeId,
        startsOn,
        endsOn,
        startPortion,
        endPortion,
        reason: reason.trim() === "" ? undefined : reason.trim(),
        contactWhileAway:
          contactWhileAway.trim() === "" ? undefined : contactWhileAway.trim(),
        coveringEmployeeId: coverId === "" ? undefined : coverId,
      });

      onBooked();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="Book leave"
      subtitle={deciderLine(managerName, type)}
      icon={Plane}
      hue={type ? hueFor(type.name) : "coral"}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || quote === null || quote.days === 0}>
            {busy ? "Booking…" : "Request"}
          </Button>
        </>
      }
    >
      <Field label="Type">
        <SearchableSelect
          value={leaveTypeId}
          onChange={setLeaveTypeId}
          required
          options={types.map((t) => ({
            value: t.id,
            label: `${t.name}${t.isPaid ? "" : " (unpaid)"}`,
          }))}
        />
        {type?.minNoticeDays ? (
          <p className="mt-1.5 text-xs text-neutral-500">
            Needs {type.minNoticeDays} day
            {type.minNoticeDays === 1 ? "" : "s"} notice.
          </p>
        ) : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First day">
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Last day">
          <input
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
      </div>

      {/*
        Half days apply only to the first and last day. A half day in the
        middle of a week off is not a thing anybody means, and offering it
        would make the total impossible to explain back.
      */}
      {type?.allowsHalfDays && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First day is">
            <SearchableSelect
              value={startPortion}
              onChange={(v) => setStartPortion(v as DayPortion)}
              options={PORTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
          <Field label="Last day is">
            <SearchableSelect
              value={endPortion}
              onChange={(v) => setEndPortion(v as DayPortion)}
              options={PORTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
        </div>
      )}

      {quote !== null && <QuotePanel quote={quote} />}

      {quoteError !== null && <Notice tone="warning">{quoteError}</Notice>}

      <Field label="Reason (optional)">
        <RichTextEditor minHeight={76} value={reason} onChange={setReason} />
      </Field>

      <Field label="Who covers for you (optional)">
        <SearchableSelect
          value={coverId}
          onChange={setCoverId}
          clearable
          clearLabel="Nobody named"
          placeholder="Nobody named"
          noOptionsText="No colleagues to choose from."
          options={colleagues}
        />
      </Field>

      <Field label="Contact while away (optional)">
        <input
          type="text"
          value={contactWhileAway}
          onChange={(e) => setContactWhileAway(e.target.value)}
          placeholder="A number somebody can reach you on"
          className={inputCls}
        />
      </Field>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

/**
 * What the dates actually cost, before committing to them.
 *
 * The gap between calendar days and chargeable days is the point of the whole
 * panel, so both are shown together rather than only the total.
 */
function QuotePanel({ quote }: { quote: LeaveQuote }) {
  return (
    <div className="space-y-2 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-primary-800">This will cost</span>
        <span className="text-xl font-bold tabular-nums text-neutral-900">{formatDays(quote.days)}</span>
      </div>

      <p className="text-xs text-neutral-600">
        {quote.calendarDays} calendar day
        {quote.calendarDays === 1 ? "" : "s"}, of which {quote.workingDays} are
        working days.
      </p>

      {quote.holidays.length > 0 && (
        <p className="text-xs text-neutral-600">
          Not charged:{" "}
          {quote.holidays
            .map((h) => `${h.name} (${formatDate(h.observedOn)})`)
            .join(", ")}
          .
        </p>
      )}

      {/*
        Shown before booking rather than at the approval stage, so the
        conversation happens between colleagues rather than being adjudicated.
      */}
      {quote.coverage.away > 0 && (
        <p className="rounded-lg bg-sun-50 px-2.5 py-1.5 text-xs text-sun-700">
          {quote.coverage.away} of {quote.coverage.team} of your teammates are
          also away on the first day: {quote.coverage.names.join(", ")}.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}
