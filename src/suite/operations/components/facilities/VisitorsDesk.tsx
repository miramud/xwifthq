"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { BadgeCheck, Building2, CalendarCheck, Car, Clock, DoorClosed, DoorOpen, LogIn, LogOut, Pencil, Phone, Plus, Printer, UserRound, UsersRound, X } from "lucide-react";
import { Button, Chip, PageHeader, StatGrid, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { todayYmd } from "@/components/workspace/Calendar";
import { DetailDrawer } from "@/components/workspace/DetailDrawer";
import { HUE, type Hue } from "@/components/workspace/modules";
import { BackLink, ErrorNote, FaceAvatar, Field, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { facilities, opsError, type FacilityRow, type Visitor } from "@/lib/api/operations-facilities-client";
import { VisitorDialog } from "./FacilityDialogs";
import { dayLabel, localHm, localYmd } from "./labels";

type Lane = "expected" | "in" | "left";

const LANES: { key: Lane; label: string; hint: string; hue: Hue; icon: typeof DoorOpen }[] = [
  { key: "expected", label: "Expected", hint: "Registered ahead, not yet arrived", hue: "sky", icon: Clock },
  { key: "in", label: "In the building", hint: "Checked in with a badge", hue: "mint", icon: DoorOpen },
  { key: "left", label: "Left", hint: "Checked out", hue: "slate", icon: DoorClosed },
];

const laneOf = (v: Visitor): Lane => (v.checkedOutAt ? "left" : v.checkedInAt ? "in" : "expected");

/**
 * Reception's day: who is expected, who is in the building (and since when,
 * with which badge), and who has left. Register a visitor ahead of time;
 * check them in with a badge when they arrive and out when they go.
 */
export default function VisitorsDesk() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [on, setOn] = useState(todayYmd());
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [sites, setSites] = useState<FacilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Visitor | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [open, setOpen] = useState<Visitor | null>(null);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    facilities.visitors(on).then(
      (v) => {
        if (!alive) return;
        setVisitors(v);
        setError(null);
      },
      (e: unknown) => alive && setError(`The visitors didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [on, reload]);

  useEffect(() => {
    let alive = true;
    facilities.list().then(
      (b) => alive && setSites(b.facilities.filter((f) => f.active)),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const lanes = useMemo(() => {
    const by: Record<Lane, Visitor[]> = { expected: [], in: [], left: [] };
    for (const v of visitors ?? []) by[laneOf(v)].push(v);
    by.expected.sort((a, b) => (a.expectedAt ?? "").localeCompare(b.expectedAt ?? ""));
    by.in.sort((a, b) => (a.checkedInAt ?? "").localeCompare(b.checkedInAt ?? ""));
    by.left.sort((a, b) => (b.checkedOutAt ?? "").localeCompare(a.checkedOutAt ?? ""));
    return by;
  }, [visitors]);

  if (error && !visitors) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!visitors) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the visitors…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.name ?? null;
  const canIn = mayDoOps(user, "facilities", "check_in");
  const canOut = mayDoOps(user, "facilities", "check_out");
  const canCancel = mayDoOps(user, "facilities", "cancel_visitor");
  const canEdit = mayDoOps(user, "facilities", "update_visitor");

  const cancel = async (v: Visitor) => {
    const ok = await confirm({
      title: `Cancel ${v.name}'s visit?`,
      body: v.host ? `They come off today's list and ${v.host} is told. The visit stays on record as cancelled.` : "They come off today's list. The visit stays on record as cancelled.",
      confirmLabel: "Cancel the visit",
    });
    if (!ok) return;
    setBusy(v.id);
    setActionError(null);
    try {
      await facilities.cancelVisitor(v.id);
      setVisitors((list) => (list ?? []).filter((x) => x.id !== v.id));
      setNotice(`${v.name}'s visit is cancelled.`);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const checkOut = async (v: Visitor) => {
    setBusy(v.id);
    setActionError(null);
    try {
      const saved = await facilities.checkOut(v.id);
      setVisitors((list) => (list ?? []).map((x) => (x.id === v.id ? saved : x)));
      setNotice(`${v.name} checked out.`);
    } catch (e) {
      setActionError(opsError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader
        title="Visitors"
        subtitle={on === today ? "Today at reception: who is expected, who is in, who has left." : `Visitors on ${dayLabel(on)}.`}
        actions={
          <>
            <label className="sr-only" htmlFor="visitors-day">
              Day
            </label>
            <input id="visitors-day" type="date" className={cx(inputClass, "w-44")} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} />
            {mayDoOps(user, "facilities", "create_visitor") && (
              <Button variant="primary" icon={Plus} onClick={() => setRegistering(true)}>
                Register a visitor
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="space-y-5">
        <StatGrid cols={3}>
          <StatCard label="Expected" value={lanes.expected.length} icon={Clock} hue="sky" hint="Not yet arrived" />
          <StatCard featured featuredHue="mint" label="In the building" value={lanes.in.length} icon={DoorOpen} hint="Badges out" />
          <StatCard label="Left" value={lanes.left.length} icon={DoorClosed} hue="slate" hint="Checked out" />
        </StatGrid>

        <div className="grid gap-4 lg:grid-cols-3">
          {LANES.map((lane) => (
            <section key={lane.key} aria-labelledby={`lane-${lane.key}`} className="rounded-[1.125rem] bg-neutral-100/70 p-3">
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", HUE[lane.hue].soft)}>
                  <lane.icon size={16} aria-hidden />
                </span>
                <h2 id={`lane-${lane.key}`} className="text-sm font-semibold text-neutral-900">
                  {lane.label}
                </h2>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-neutral-600">{lanes[lane.key].length}</span>
              </header>
              {lanes[lane.key].length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-500">{lane.key === "expected" ? "Nobody else is expected." : lane.key === "in" ? "Nobody is in the building." : "Nobody has left yet."}</p>
              ) : (
                <ul className="space-y-2">
                  {lanes[lane.key].map((v) => (
                    <li key={v.id} className="ws-card space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <FaceAvatar name={v.name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            <button type="button" onClick={() => setOpen(v)} className="max-w-full truncate rounded text-left outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300" aria-label={`Open the visit details: ${v.name}`}>
                              {v.name}
                            </button>
                          </p>
                          <p className="truncate text-xs text-neutral-500">{[v.company, v.purpose].filter(Boolean).join(" · ") || "No purpose given"}</p>
                          {v.preRegistered && lane.key === "expected" && (
                            <Chip hue="grape" icon={CalendarCheck} className="mt-1.5">
                              Pre-registered by host
                            </Chip>
                          )}
                        </div>
                        {v.badgeNo && (
                          <Chip hue="mint" icon={BadgeCheck}>
                            {v.badgeNo}
                          </Chip>
                        )}
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <UserRound size={12} aria-hidden />
                          <dt className="sr-only">Host</dt>
                          <dd className="truncate">{v.host ?? "No host"}</dd>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <Clock size={12} aria-hidden />
                          <dt className="sr-only">Time</dt>
                          <dd className="tabular-nums">
                            {lane.key === "expected"
                              ? v.expectedAt
                                ? `Expected ${localYmd(v.expectedAt) === on ? "" : `${dayLabel(localYmd(v.expectedAt))} `}${localHm(v.expectedAt)}`
                                : "Any time"
                              : lane.key === "in"
                                ? `In since ${v.checkedInAt ? localHm(v.checkedInAt) : "—"}`
                                : `${v.checkedInAt ? localHm(v.checkedInAt) : "—"}–${v.checkedOutAt ? localHm(v.checkedOutAt) : "—"}`}
                          </dd>
                        </div>
                        {v.phone && (
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <Phone size={12} aria-hidden />
                            <dt className="sr-only">Phone</dt>
                            <dd className="truncate">{v.phone}</dd>
                          </div>
                        )}
                        {(v.partySize ?? 1) > 1 && (
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <UsersRound size={12} aria-hidden />
                            <dt className="sr-only">Party</dt>
                            <dd>{v.partySize} people</dd>
                          </div>
                        )}
                        {v.vehiclePlate && (
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <Car size={12} aria-hidden />
                            <dt className="sr-only">Vehicle</dt>
                            <dd className="truncate font-mono">{v.vehiclePlate}</dd>
                          </div>
                        )}
                        {siteName(v.facilityId) && (
                          <div className="flex items-center gap-1.5 text-neutral-600">
                            <Building2 size={12} aria-hidden />
                            <dt className="sr-only">Site</dt>
                            <dd className="truncate">{siteName(v.facilityId)}</dd>
                          </div>
                        )}
                      </dl>
                      {v.notes && <p className="rounded-lg bg-sun-50 px-2.5 py-1.5 text-xs text-sun-700">{v.notes}</p>}
                      {lane.key === "expected" && (canIn || canEdit || canCancel) && (
                        <div className="flex gap-2">
                          {canIn && (
                            <Button size="sm" variant="primary" icon={LogIn} className="flex-1" onClick={() => setCheckingIn(v)}>
                              Check in
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="sm" icon={Pencil} disabled={busy === v.id} onClick={() => setEditing(v)} aria-label={`Edit ${v.name}'s visit`}>
                              Edit
                            </Button>
                          )}
                          {canCancel && (
                            <Button size="sm" variant="ghost" icon={X} disabled={busy === v.id} onClick={() => void cancel(v)} aria-label={`Cancel ${v.name}'s visit`}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                      {lane.key === "in" && (
                        <a href={facilities.badgeUrl(v.id)} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("ghost", "sm"), "w-full")}>
                          <Printer size={15} aria-hidden />
                          Print badge
                          <span className="sr-only"> for {v.name} (opens in a new tab)</span>
                        </a>
                      )}
                      {lane.key === "in" && canOut && (
                        <Button size="sm" icon={LogOut} className="w-full" disabled={busy === v.id} onClick={() => void checkOut(v)}>
                          {busy === v.id ? "Checking out…" : "Check out"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      {open && (
        <VisitorDrawer
          v={open}
          site={siteName(open.facilityId)}
          onClose={() => setOpen(null)}
          onEdit={
            canEdit && laneOf(open) === "expected" && !open.cancelledAt
              ? () => setEditing(open)
              : undefined
          }
        />
      )}
      {editing && (
        <VisitorDialog
          sites={sites.map((s) => ({ value: s.id, label: s.name }))}
          on={on}
          visitor={editing}
          onClose={() => setEditing(null)}
          onDone={(v) => {
            setEditing(null);
            setActionError(null);
            // Moved to another day: it leaves this day's list.
            const stays = !v.expectedAt || localYmd(v.expectedAt) === on;
            setVisitors((list) => (stays ? (list ?? []).map((x) => (x.id === v.id ? v : x)) : (list ?? []).filter((x) => x.id !== v.id)));
            setNotice(stays ? `${v.name}'s visit is updated.` : `${v.name}'s visit is moved to ${dayLabel(localYmd(v.expectedAt!))}.`);
          }}
        />
      )}
      {registering && (
        <VisitorDialog
          sites={sites.map((s) => ({ value: s.id, label: s.name }))}
          on={on}
          onClose={() => setRegistering(false)}
          onDone={(v) => {
            setRegistering(false);
            setNotice(`${v.name} is registered.`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {checkingIn && (
        <CheckInDialog
          visitor={checkingIn}
          onClose={() => setCheckingIn(null)}
          onDone={(saved) => {
            setVisitors((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
            setNotice(`${saved.name} checked in${saved.badgeNo ? ` with badge ${saved.badgeNo}` : ""}.`);
            setCheckingIn(null);
          }}
        />
      )}
    </div>
  );
}

function CheckInDialog({ visitor, onClose, onDone }: { visitor: Visitor; onClose: () => void; onDone: (v: Visitor) => void }) {
  const uid = useId();
  const [badge, setBadge] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await facilities.checkIn(visitor.id, badge.trim() || null));
    } catch (err) {
      setError(opsError(err));
      setBusy(false);
    }
  };
  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      titleId={`${uid}-t`}
      title={`Check in ${visitor.name}`}
      subtitle={visitor.host ? `Let ${visitor.host} know they have arrived.` : "Hand over a visitor badge."}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={LogIn} disabled={busy}>
            {busy ? "Checking in…" : "Check in"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`${uid}-b`} label="Badge number" hint="Optional">
        <input id={`${uid}-b`} className={inputClass} value={badge} maxLength={20} onChange={(e) => setBadge(e.target.value)} placeholder="V-014" autoFocus />
      </Field>
    </DialogFrame>
  );
}

const at = (iso: string | null) => (iso ? `${dayLabel(localYmd(iso))}, ${localHm(iso)}` : null);

/** One visit read in full. Until they arrive, holders of the key can change it from here. */
function VisitorDrawer({ v, site, onClose, onEdit }: { v: Visitor; site: string | null; onClose: () => void; onEdit?: () => void }) {
  const lane = LANES.find((l) => l.key === laneOf(v)) ?? LANES[0];
  return (
    <DetailDrawer
      title={v.name}
      subtitle={[v.company, v.purpose].filter(Boolean).join(" · ") || "Visitor"}
      icon={UserRound}
      hue="sky"
      onClose={onClose}
      onEdit={onEdit}
      editLabel="Edit visit"
      status={
        <>
          <Chip hue={lane.hue}>{lane.label}</Chip>
          {v.badgeNo && (
            <Chip hue="mint" icon={BadgeCheck}>
              {v.badgeNo}
            </Chip>
          )}
        </>
      }
      facts={[
        { label: "Organisation", value: v.company },
        { label: "Phone", value: v.phone },
        { label: "Email", value: v.email ?? null },
        { label: "Host", value: v.host },
        { label: "Registered by", value: v.preRegistered ? `${v.host ?? "The host"} (ahead of the visit)` : (v.registeredBy ?? null) },
        { label: "Site", value: site },
        { label: "Expected", value: (at(v.expectedAt) ?? "Any time") + (v.expectedUntil ? ` until ${localHm(v.expectedUntil)}` : "") },
        { label: "Party", value: (v.partySize ?? 1) > 1 ? `${v.partySize} people` : "1 person" },
        { label: "Vehicle", value: v.vehiclePlate ?? null },
        { label: "Badge", value: v.badgeNo },
        { label: "Checked in", value: at(v.checkedInAt) ?? "Not yet" },
        { label: "Checked out", value: at(v.checkedOutAt) ?? "Not yet" },
        { label: "Purpose", value: v.purpose, wide: true },
        { label: "Notes for reception", value: v.notes ?? null, wide: true },
      ]}
    />
  );
}
