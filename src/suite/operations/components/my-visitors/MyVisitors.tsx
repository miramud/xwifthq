"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Car, CircleSlash, Clock, DoorClosed, DoorOpen, Hourglass, Pencil, Plus, UserPlus, UsersRound, X } from "lucide-react";
import { Button, Chip, Empty, PageHeader, cx } from "@/components/workspace/kit";
import { todayYmd } from "@/components/workspace/Calendar";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import type { Hue } from "@/components/workspace/modules";
import { ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { myVisitors, opsError, type Visitor, type VisitStatus } from "@/lib/api/operations-facilities-client";
import { HostVisitorDialog } from "@/suite/operations/components/facilities/VisitorForm";
import { dayLabel, localHm, localYmd } from "@/suite/operations/components/facilities/labels";

/**
 * My visitors: register who is coming so reception expects them, see them
 * arrive (you are told the moment they check in and again when they leave),
 * change a visit before they arrive, and cancel one that is off. Only the
 * visits you host are here.
 */

export type Bucket = "today" | "upcoming" | "past";

const STATUS: Record<VisitStatus, { label: string; hue: Hue; icon: typeof Clock }> = {
  expected: { label: "Expected", hue: "sky", icon: Clock },
  on_site: { label: "Arrived", hue: "mint", icon: DoorOpen },
  left: { label: "Left", hue: "slate", icon: DoorClosed },
  cancelled: { label: "Cancelled", hue: "rose", icon: CircleSlash },
  missed: { label: "Didn't come", hue: "sun", icon: Hourglass },
};

const statusOf = (v: Visitor): VisitStatus => v.status ?? (v.cancelledAt ? "cancelled" : v.checkedOutAt ? "left" : v.checkedInAt ? "on_site" : "expected");

/** The day a visit belongs to: when it was expected, else when they came. */
const dayOf = (v: Visitor): string | null => (v.expectedAt ? localYmd(v.expectedAt) : v.checkedInAt ? localYmd(v.checkedInAt) : null);

/** Today (and anyone still in the building), upcoming soonest first, past latest first. Exported for the tests. */
export function groupVisits(visitors: Visitor[], today: string): Record<Bucket, Visitor[]> {
  const out: Record<Bucket, Visitor[]> = { today: [], upcoming: [], past: [] };
  for (const v of visitors) {
    const day = dayOf(v);
    if (statusOf(v) === "on_site" || day === today || day === null) out.today.push(v);
    else if (day > today) out.upcoming.push(v);
    else out.past.push(v);
  }
  const at = (v: Visitor) => v.expectedAt ?? v.checkedInAt ?? "";
  out.today.sort((a, b) => at(a).localeCompare(at(b)));
  out.upcoming.sort((a, b) => at(a).localeCompare(at(b)));
  out.past.sort((a, b) => at(b).localeCompare(at(a)));
  return out;
}

export default function MyVisitors() {
  const confirm = useConfirm();
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [sites, setSites] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Bucket>("today");
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    myVisitors.list().then(
      (r) => {
        if (!alive) return;
        setVisitors(r.visitors);
        setSites(r.sites.map((s) => ({ value: s.id, label: s.name })));
        setError(null);
      },
      (e: unknown) => alive && setError(`Your visitors didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const groups = useMemo(() => groupVisits(visitors ?? [], today), [visitors, today]);

  if (error && !visitors) return <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!visitors) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading your visitors…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[280px]" />
      </div>
    );
  }

  const cancel = async (v: Visitor) => {
    const ok = await confirm({
      title: `Cancel ${v.name}'s visit?`,
      body: "Reception stops expecting them. The visit stays in your list as cancelled.",
      confirmLabel: "Cancel the visit",
    });
    if (!ok) return;
    setBusy(v.id);
    setActionError(null);
    try {
      const saved = await myVisitors.cancel(v.id);
      setVisitors((list) => (list ?? []).map((x) => (x.id === v.id ? saved : x)));
      setNotice(`${v.name}'s visit is cancelled. Reception no longer expects them.`);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const listed = groups[tab];
  const tabs = [
    { key: "today", label: "Today", count: groups.today.length },
    { key: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { key: "past", label: "Past", count: groups.past.length },
  ];

  return (
    <div>
      <PageHeader
        title="My visitors"
        subtitle="Register who is coming to see you. Reception expects them, and you're told the moment they check in."
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setRegistering(true)}>
            Register a visitor
          </Button>
        }
        tabs={tabs}
        activeTab={tab}
        onTab={(k) => setTab(k as Bucket)}
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      {listed.length === 0 ? (
        <div className="ws-card">
          <Empty
            icon={UsersRound}
            hue="sky"
            title={tab === "today" ? "Nobody is coming to see you today" : tab === "upcoming" ? "No upcoming visitors" : "No past visitors in the last 90 days"}
            hint={tab === "past" ? undefined : "Register a visitor and reception will have their name, time and badge ready."}
            action={
              tab === "past" ? undefined : (
                <Button icon={Plus} onClick={() => setRegistering(true)}>
                  Register a visitor
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" aria-label={`${tabs.find((t) => t.key === tab)?.label} visitors`}>
          {listed.map((v) => (
            <VisitRow key={v.id} v={v} today={today} busy={busy === v.id} onEdit={() => setEditing(v)} onCancel={() => void cancel(v)} />
          ))}
        </ul>
      )}

      {registering && (
        <HostVisitorDialog
          sites={sites}
          onClose={() => setRegistering(false)}
          onDone={(v) => {
            setRegistering(false);
            setVisitors((list) => [v, ...(list ?? [])]);
            const day = dayOf(v);
            setTab(day && day > today ? "upcoming" : "today");
            setNotice(`${v.name} is registered. Reception will expect them${whenText(v, today)}.`);
          }}
        />
      )}
      {editing && (
        <HostVisitorDialog
          sites={sites}
          visitor={editing}
          onClose={() => setEditing(null)}
          onDone={(v) => {
            setEditing(null);
            setActionError(null);
            setVisitors((list) => (list ?? []).map((x) => (x.id === v.id ? v : x)));
            const day = dayOf(v);
            setTab(day && day > today ? "upcoming" : "today");
            setNotice(`${v.name}'s visit is updated. Reception will expect them${whenText(v, today)}.`);
          }}
        />
      )}
    </div>
  );
}

/** " today at 10:00" / " on Thu 9 Oct at 10:00", or nothing without a time. */
function whenText(v: Visitor, today: string): string {
  if (!v.expectedAt) return "";
  const day = localYmd(v.expectedAt);
  return ` ${day === today ? "today" : `on ${dayLabel(day)}`} at ${localHm(v.expectedAt)}`;
}

function VisitRow({ v, today, busy, onEdit, onCancel }: { v: Visitor; today: string; busy: boolean; onEdit: () => void; onCancel: () => void }) {
  const status = statusOf(v);
  const s = STATUS[status];
  const day = dayOf(v);
  const slot = v.expectedAt ? `${localHm(v.expectedAt)}${v.expectedUntil ? ` to ${localHm(v.expectedUntil)}` : ""}` : "Any time";
  const done = status === "cancelled" || status === "missed";

  return (
    <li className={cx("ws-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center", done && "opacity-80")}>
      {/* The time is what a host scans for. */}
      <div className={cx("flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 sm:w-40 sm:flex-col sm:items-start sm:gap-0.5", done ? "bg-neutral-50" : "bg-primary-50/60")}>
        <p className={cx("text-xs font-semibold uppercase tracking-wide", done ? "text-neutral-500" : "text-primary-700")}>{day === today ? "Today" : day ? dayLabel(day) : "Today"}</p>
        <p className={cx("text-xl font-bold tabular-nums tracking-tight", done ? "text-neutral-500 line-through decoration-1" : "text-neutral-900")}>{slot}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold tracking-tight text-neutral-900">
          {v.name}
          <Chip hue={s.hue} icon={s.icon}>
            {status === "on_site" && v.checkedInAt ? `Arrived ${localHm(v.checkedInAt)}` : s.label}
          </Chip>
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">{[v.company, v.purpose].filter(Boolean).join(" · ") || "No purpose given"}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          {v.site && (
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={12} aria-hidden />
              {v.site}
            </span>
          )}
          {(v.partySize ?? 1) > 1 && (
            <span className="inline-flex items-center gap-1.5">
              <UsersRound size={12} aria-hidden />
              {v.partySize} people
            </span>
          )}
          {v.vehiclePlate && (
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Car size={12} aria-hidden />
              {v.vehiclePlate}
            </span>
          )}
          {v.badgeNo && (
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck size={12} aria-hidden />
              Badge {v.badgeNo}
            </span>
          )}
          {!v.preRegistered && v.registeredBy && <span>Registered by {v.registeredBy}</span>}
        </div>
        {status === "cancelled" && v.cancelReason && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-1.5 text-xs text-rose-700">Cancelled: {v.cancelReason}</p>}
      </div>
      {status === "expected" && (
        <div className="flex shrink-0 gap-2 self-start sm:self-center">
          <Button size="sm" icon={Pencil} disabled={busy} onClick={onEdit} aria-label={`Edit ${v.name}'s visit`}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" icon={X} disabled={busy} onClick={onCancel} aria-label={`Cancel ${v.name}'s visit`}>
            {busy ? "Cancelling…" : "Cancel visit"}
          </Button>
        </div>
      )}
    </li>
  );
}
