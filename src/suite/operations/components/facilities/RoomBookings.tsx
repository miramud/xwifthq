"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, DoorOpen, Trash2, TrendingUp, Users } from "lucide-react";
import { Button, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { CalendarNav, todayYmd } from "@/components/workspace/Calendar";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { isAdminRole } from "@/lib/roles";
import { facilities, opsError, type RoomBooking } from "@/lib/api/operations-facilities-client";
import { help, type BookableRoom } from "@/lib/api/operations-desk-client";
import { DAY_END, DAY_START, RoomsWeekGrid, type WeekBooking, type WeekRoom } from "./RoomWeek";
import { addDaysYmd, dayLabel, localHm, minuteOfDay, mondayOf, plural, spanText } from "./labels";

/**
 * The week's room bookings across every site: rooms down the side, days
 * across, each cell the working day with its booked stretches filled. The
 * numbers above say how full the rooms are and which one is in demand.
 */
export default function RoomBookings() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [monday, setMonday] = useState(() => mondayOf(todayYmd()));
  const [rooms, setRooms] = useState<BookableRoom[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState<RoomBooking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i)), [monday]);
  const from = monday;
  const to = addDaysYmd(monday, 7);

  useEffect(() => {
    let alive = true;
    Promise.all([facilities.bookings({ from, to }), help.rooms({ from, to: addDaysYmd(from, 6) }).catch(() => null)]).then(
      ([b, r]) => {
        if (!alive) return;
        setBookings(b);
        setRooms(r?.rooms ?? []);
        setError(null);
      },
      (e: unknown) => alive && setError(`The room bookings didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [from, to, reload]);

  const rows: WeekRoom[] = useMemo(() => {
    const out = rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, facility: r.facility }));
    for (const b of bookings ?? []) if (!out.some((r) => r.id === b.spaceId)) out.push({ id: b.spaceId, name: b.space ?? "Room", capacity: null, facility: null });
    return out;
  }, [rooms, bookings]);

  const stats = useMemo(() => {
    const list = bookings ?? [];
    const minutes = new Map<string, number>();
    for (const b of list) {
      const m = Math.max(0, (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000);
      minutes.set(b.spaceId, (minutes.get(b.spaceId) ?? 0) + m);
    }
    const total = [...minutes.values()].reduce((s, m) => s + m, 0);
    const capacity = rows.length * 5 * (DAY_END - DAY_START) * 60;
    const busiest = [...minutes.entries()].sort((a, b) => b[1] - a[1])[0];
    const people = list.reduce((s, b) => s + (b.attendees ?? 0), 0);
    return {
      count: list.length,
      hours: Math.round(total / 60),
      use: capacity ? Math.min(100, Math.round((total / capacity) * 100)) : 0,
      busiest: busiest ? { name: rows.find((r) => r.id === busiest[0])?.name ?? "A room", hours: Math.round(busiest[1] / 60) } : null,
      people,
    };
  }, [bookings, rows]);

  if (error && !bookings) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  const weekTitle = `${dayLabel(days[0])} – ${dayLabel(days[6])}`;
  const admin = isAdminRole(user);
  const grid: WeekBooking[] = (bookings ?? []).map((b) => ({ id: b.id, spaceId: b.spaceId, title: b.title, startsAt: b.startsAt, endsAt: b.endsAt, bookedBy: b.bookedBy }));

  const cancel = async (b: RoomBooking) => {
    const ok = await confirm({ title: `Cancel “${b.title}”?`, body: `${b.space ?? "The room"}, ${spanText(b.startsAt, b.endsAt)}. ${b.bookedBy ?? "Whoever booked it"} loses the room.`, confirmLabel: "Cancel the booking" });
    if (!ok) return;
    try {
      await help.cancelRoom(b.id);
      setOpen(null);
      setNotice("Booking cancelled.");
      setReload((n) => n + 1);
    } catch (e) {
      setNotice(null);
      setError(opsError(e));
    }
  };

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader title="Room bookings" subtitle="Every bookable room's week. Staff book from “Book a room or vehicle”." />
      <Notice text={notice} />
      {error && bookings && <ErrorNote className="mb-4">{error}</ErrorNote>}

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Bookings this week" value={bookings ? stats.count : "…"} icon={CalendarClock} hint={`${stats.hours} room-hours`} />
          <StatCard label="Rooms in use" value={`${stats.use}%`} icon={TrendingUp} hue="grape" hint={`Of ${plural(rows.length, "room")}, ${DAY_START}:00–${DAY_END}:00 on weekdays`} />
          <StatCard label="Most in demand" value={stats.busiest?.name ?? "—"} icon={DoorOpen} hue="sky" hint={stats.busiest ? `${stats.busiest.hours} hours booked` : "Nothing booked"} />
          <StatCard label="People expected" value={stats.people} icon={Users} hue="mint" hint="Attendees across bookings" />
        </StatGrid>

        <Panel icon={CalendarDays} hue="blue" title="The week" subtitle="Filled stretches are booked; a booking's colour is whoever booked it.">
          <CalendarNav title={weekTitle} onPrev={() => setMonday((m) => addDaysYmd(m, -7))} onNext={() => setMonday((m) => addDaysYmd(m, 7))} onToday={() => setMonday(mondayOf(todayYmd()))} />
          {!bookings ? (
            <Skeleton className="h-[320px]" />
          ) : rows.length === 0 ? (
            <Empty icon={DoorOpen} hue="sky" title="No bookable rooms" hint="Mark meeting rooms as bookable on a site's Rooms tab." />
          ) : (
            <RoomsWeekGrid rooms={rows} bookings={grid} days={days} onSelect={(w) => setOpen((bookings ?? []).find((b) => b.id === w.id) ?? null)} />
          )}
        </Panel>
      </div>

      {open && <BookingDialog booking={open} canCancel={admin} onCancel={() => void cancel(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function BookingDialog({ booking, canCancel, onCancel, onClose }: { booking: RoomBooking; canCancel: boolean; onCancel: () => void; onClose: () => void }) {
  const uid = useId();
  const mins = minuteOfDay(booking.endsAt) - minuteOfDay(booking.startsAt);
  return (
    <DialogFrame
      titleId={`${uid}-t`}
      title={booking.title}
      subtitle={booking.space ?? undefined}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {canCancel ? (
            <Button variant="danger" icon={Trash2} onClick={onCancel}>
              Cancel the booking
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-neutral-50 px-4 py-3">
          <dt className="text-xs text-neutral-500">When</dt>
          <dd className="font-semibold text-neutral-900">{spanText(booking.startsAt, booking.endsAt)}</dd>
          {mins > 0 && <dd className="text-xs text-neutral-500">{mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins} minutes`}</dd>}
        </div>
        <div className="rounded-2xl bg-neutral-50 px-4 py-3">
          <dt className="text-xs text-neutral-500">Booked by</dt>
          <dd className="font-semibold text-neutral-900">{booking.bookedBy ?? "—"}</dd>
          {booking.attendees ? <dd className="text-xs text-neutral-500">{plural(booking.attendees, "attendee")}</dd> : null}
        </div>
      </dl>
      <p className="text-xs text-neutral-500">
        From {localHm(booking.startsAt)} to {localHm(booking.endsAt)}. {canCancel ? "Cancelling frees the room at once." : "Only the person who booked it, or an admin, can cancel it."}
      </p>
    </DialogFrame>
  );
}
