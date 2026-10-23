"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarClock, Car, DoorOpen, Gauge, MapPin, Navigation, Route, Trash2, UserRound } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { CalendarNav, todayYmd } from "@/components/workspace/Calendar";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { HUE, type Hue } from "@/components/workspace/modules";
import { ErrorNote, Field, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { help, opsError, opsFieldErrors, type MyVehicleBooking, type PoolVehicle, type RoomsWeek, type VehiclesBoard } from "@/lib/api/operations-desk-client";
import { ChipFilter, useOpsPickers } from "@/suite/operations/components/facilities/parts";
import { RoomSlots, type WeekBooking } from "@/suite/operations/components/facilities/RoomWeek";
import { addDaysYmd, dayLabel, localYmd, mondayOf, spanText } from "@/suite/operations/components/facilities/labels";
import { BookRoomDialog, RequestVehicleDialog } from "./BookingDialogs";

type Tab = "rooms" | "vehicles";

const VEHICLE_STATUS: Record<string, { label: string; hue: Hue }> = {
  requested: { label: "Waiting for the fleet desk", hue: "sun" },
  approved: { label: "Approved", hue: "mint" },
  declined: { label: "Declined", hue: "rose" },
  cancelled: { label: "Cancelled", hue: "slate" },
  completed: { label: "Done", hue: "slate" },
};

/**
 * Book a room or a vehicle. Rooms: pick a room and see its week hour by
 * hour; a free hour books it. Vehicles: the pool with the next three weeks'
 * busy days, a request for one, and my requests. A driver also logs trips.
 */
export default function MyBookings() {
  const [tab, setTab] = useState<Tab>("rooms");
  return (
    <div>
      <PageHeader
        title="Book a room or vehicle"
        subtitle="Meeting rooms on every site, and the pool vehicles."
        tabs={[
          { key: "rooms", label: "Rooms" },
          { key: "vehicles", label: "Vehicles" },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />
      {tab === "rooms" ? <RoomsTab /> : <VehiclesTab />}
    </div>
  );
}

/* -------------------------------- rooms -------------------------------- */

function RoomsTab() {
  const confirm = useConfirm();
  const [monday, setMonday] = useState(() => mondayOf(todayYmd()));
  const [week, setWeek] = useState<RoomsWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [roomId, setRoomId] = useState("");
  const [booking, setBooking] = useState<{ day: string; start: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDaysYmd(monday, i)), [monday]);

  useEffect(() => {
    let alive = true;
    help.rooms({ from: monday, to: addDaysYmd(monday, 6) }).then(
      (w) => {
        if (!alive) return;
        setWeek(w);
        setError(null);
      },
      (e: unknown) => alive && setError(`The rooms didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [monday, reload]);

  if (error && !week) return <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!week) return <Skeleton className="h-[480px]" />;

  const room = week.rooms.find((r) => r.id === roomId) ?? week.rooms[0] ?? null;
  const grid: WeekBooking[] = week.bookings.map((b) => ({ ...b }));
  const mine = week.bookings.filter((b) => b.mine).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const cancel = async (b: WeekBooking) => {
    const name = week.rooms.find((r) => r.id === b.spaceId)?.name ?? "the room";
    const ok = await confirm({ title: `Cancel “${b.title}”?`, body: `${name}, ${spanText(b.startsAt, b.endsAt)}. The room is freed for others.`, confirmLabel: "Cancel the booking" });
    if (!ok) return;
    setActionError(null);
    try {
      await help.cancelRoom(b.id);
      setNotice("Booking cancelled.");
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(opsError(e));
    }
  };

  return (
    <div className="space-y-5">
      <Notice text={notice} />
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      {week.rooms.length === 0 ? (
        <div className="ws-card">
          <Empty icon={DoorOpen} hue="sky" title="No rooms to book" hint="Facilities hasn't marked any meeting room as bookable yet." />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel icon={CalendarClock} hue="blue" title="Pick a free hour" subtitle="Grey is taken. Click a free hour to book it; your own bookings are blue.">
            <div className="mb-4">
              <ChipFilter label="Room" value={room?.id ?? ""} onChange={setRoomId} options={week.rooms.map((r) => ({ key: r.id, label: r.capacity ? `${r.name} · ${r.capacity}` : r.name }))} />
            </div>
            <CalendarNav title={`${dayLabel(days[0])} to ${dayLabel(days[4])}`} onPrev={() => setMonday((m) => addDaysYmd(m, -7))} onNext={() => setMonday((m) => addDaysYmd(m, 7))} onToday={() => setMonday(mondayOf(todayYmd()))} />
            {room && <RoomSlots room={room} bookings={grid} days={days} onPick={(day, start) => setBooking({ day, start })} onSelect={(b) => void cancel(b)} />}
          </Panel>
          <Panel icon={DoorOpen} hue="sky" title="My bookings this week">
            {mine.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">Nothing booked this week.</p>
            ) : (
              <ul className="space-y-2">
                {mine.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200/80 p-3">
                    <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE.blue.soft)}>
                      <DoorOpen size={16} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{b.title}</p>
                      <p className="text-xs text-neutral-500">{week.rooms.find((r) => r.id === b.spaceId)?.name}</p>
                      <p className="text-xs tabular-nums text-neutral-600">{spanText(b.startsAt, b.endsAt)}</p>
                    </div>
                    {localYmd(b.endsAt) >= todayYmd() && (
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Cancel ${b.title}`} className="text-error-700" onClick={() => void cancel(b)}>
                        <span className="sr-only">Cancel</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      {booking && room && (
        <BookRoomDialog
          room={room}
          day={booking.day}
          start={booking.start}
          onClose={() => setBooking(null)}
          onDone={(msg) => {
            setBooking(null);
            setNotice(msg);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- vehicles ------------------------------ */

function VehiclesTab() {
  const confirm = useConfirm();
  const [board, setBoard] = useState<VehiclesBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [asking, setAsking] = useState<PoolVehicle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = todayYmd();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDaysYmd(today, i)), [today]);

  useEffect(() => {
    let alive = true;
    help.vehicles().then(
      (b) => {
        if (!alive) return;
        setBoard(b);
        setError(null);
      },
      (e: unknown) => alive && setError(`The vehicles didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  if (error && !board) return <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!board) return <Skeleton className="h-[420px]" />;

  const cancel = async (b: MyVehicleBooking) => {
    const ok = await confirm({ title: "Cancel this vehicle request?", body: `${b.registrationNo ?? "The vehicle"}, ${spanText(b.startsAt, b.endsAt)}: ${b.purpose}.`, confirmLabel: "Cancel the request" });
    if (!ok) return;
    setActionError(null);
    try {
      await help.cancelVehicle(b.id);
      setNotice("Request cancelled.");
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(opsError(e));
    }
  };

  return (
    <div className="space-y-5">
      <Notice text={notice} />
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      <Panel icon={Car} hue="sky" title="Pool vehicles" subtitle="The next three weeks: a filled day has an approved trip on it.">
        {board.pool.length === 0 ? (
          <Empty icon={Car} hue="sky" title="No pool vehicles" hint="The fleet desk hasn't put any vehicle in the pool." />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {board.pool.map((v) => {
              const busy = board.busy.filter((b) => b.vehicleId === v.id);
              const busyOn = (d: string) => busy.some((b) => localYmd(b.startsAt) <= d && localYmd(b.endsAt) >= d);
              const free = days.filter((d) => !busyOn(d)).length;
              return (
                <li key={v.id} className="flex flex-col gap-4 rounded-2xl border border-neutral-200/80 p-4">
                  <div className="flex items-start gap-3">
                    <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", HUE.sky.soft)}>
                      <Car size={20} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold tracking-wide text-neutral-900">{v.registrationNo}</p>
                      <p className="truncate text-xs text-neutral-500">{v.name ?? "Pool vehicle"}</p>
                    </div>
                    <Chip hue={free > 14 ? "mint" : free > 5 ? "sun" : "coral"}>{free} of 21 days free</Chip>
                  </div>
                  <ol className="grid grid-cols-[repeat(21,minmax(0,1fr))] gap-[3px]" aria-label={`${v.registrationNo}: busy days over the next three weeks`}>
                    {days.map((d) => {
                      const on = busyOn(d);
                      return (
                        <li key={d} title={`${dayLabel(d)}: ${on ? "booked" : "free"}`} className={cx("h-7 rounded-[5px]", on ? "bg-sky-500" : "bg-neutral-100", d === today && "ring-2 ring-primary-400 ring-offset-1")}>
                          <span className="sr-only">
                            {dayLabel(d)}: {on ? "booked" : "free"}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500" aria-hidden>
                    <span>Today</span>
                    <span>{dayLabel(days[20])}</span>
                  </div>
                  <Button size="sm" variant="primary" icon={Navigation} className="self-start" onClick={() => setAsking(v)}>
                    Request this vehicle
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className={cx("grid gap-5", board.driving.length > 0 && "xl:grid-cols-[minmax(0,1fr)_24rem]")}>
        <Panel icon={Route} hue="grape" title="My vehicle requests">
          {board.mine.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">You haven&rsquo;t asked for a vehicle yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {board.mine.map((b) => {
                const st = VEHICLE_STATUS[b.status] ?? { label: b.status, hue: "slate" as Hue };
                const cancellable = (b.status === "requested" || b.status === "approved") && localYmd(b.startsAt) >= today;
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{b.purpose}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                        <span className="font-mono">{b.registrationNo}</span>
                        <span className="tabular-nums">{spanText(b.startsAt, b.endsAt)}</span>
                        {b.destination && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} aria-hidden /> {b.destination}
                          </span>
                        )}
                        {b.driver && (
                          <span className="inline-flex items-center gap-1">
                            <UserRound size={11} aria-hidden /> {b.driver}
                          </span>
                        )}
                      </p>
                    </div>
                    <Chip hue={st.hue} dot>
                      {st.label}
                    </Chip>
                    {cancellable && (
                      <Button size="sm" variant="ghost" icon={Trash2} className="text-error-700" onClick={() => void cancel(b)}>
                        Cancel
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        {board.driving.length > 0 && <TripForm vehicles={board.driving} onDone={(msg) => { setNotice(msg); setReload((n) => n + 1); }} />}
      </div>

      {asking && (
        <RequestVehicleDialog
          vehicle={asking}
          onClose={() => setAsking(null)}
          onDone={(msg) => {
            setAsking(null);
            setNotice(msg);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/** A driver's trip on the vehicle they drive: where, why, the odometer, and who pays. */
function TripForm({ vehicles, onDone }: { vehicles: VehiclesBoard["driving"]; onDone: (msg: string) => void }) {
  const uid = useId();
  const { projects, costCentres } = useOpsPickers();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const [tripOn, setTripOn] = useState(todayYmd());
  const [purpose, setPurpose] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(vehicle?.odometer != null ? String(vehicle.odometer) : "");
  const [end, setEnd] = useState("");
  const [projectId, setProjectId] = useState("");
  const [costCentreId, setCostCentreId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const km = Number(end) - Number(start);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!purpose.trim()) next.purpose = "Say what the trip was for.";
    const a = Number(start);
    const b = Number(end);
    if (!start.trim() || !Number.isInteger(a) || a < 0) next.startOdometer = "The odometer at the start, in km.";
    if (!end.trim() || !Number.isInteger(b) || b <= a) next.endOdometer = "More than at the start.";
    if (!projectId && !costCentreId) next.projectId = "Charge it to a project or a cost centre.";
    if (!tripOn || tripOn > todayYmd()) next.tripOn = "Choose a day up to today.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      await help.logTrip(vehicle.id, {
        tripOn,
        purpose: purpose.trim(),
        origin: origin.trim() || null,
        destination: destination.trim() || null,
        startOdometer: a,
        endOdometer: b,
        projectId: projectId || null,
        costCentreId: costCentreId || null,
      });
      setPurpose("");
      setOrigin("");
      setDestination("");
      setStart(String(b));
      setEnd("");
      onDone(`Trip logged: ${b - a} km on ${vehicle.registrationNo}.`);
    } catch (err) {
      setErrors(opsFieldErrors(err));
      setError(opsError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel icon={Gauge} hue="mint" title="Log a trip" subtitle={`You drive ${vehicles.map((v) => v.registrationNo).join(", ")}.`}>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        {error && <ErrorNote>{error}</ErrorNote>}
        {vehicles.length > 1 && (
          <Field id={`${uid}-v`} label="Vehicle">
            <SearchableSelect id={`${uid}-v`} value={vehicleId} onChange={setVehicleId} options={vehicles.map((v) => ({ value: v.id, label: v.registrationNo, hint: v.name ?? undefined }))} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${uid}-d`} label="On">
            <input id={`${uid}-d`} type="date" max={todayYmd()} className={inputClass} value={tripOn} onChange={(e) => setTripOn(e.target.value)} aria-invalid={errors.tripOn ? true : undefined} />
            <FieldError message={errors.tripOn} />
          </Field>
          <Field id={`${uid}-p`} label="What for">
            <input id={`${uid}-p`} className={inputClass} value={purpose} maxLength={255} onChange={(e) => setPurpose(e.target.value)} aria-invalid={errors.purpose ? true : undefined} />
            <FieldError message={errors.purpose} />
          </Field>
          <Field id={`${uid}-o`} label="From" hint="Optional">
            <input id={`${uid}-o`} className={inputClass} value={origin} maxLength={160} onChange={(e) => setOrigin(e.target.value)} />
          </Field>
          <Field id={`${uid}-to`} label="To" hint="Optional">
            <input id={`${uid}-to`} className={inputClass} value={destination} maxLength={160} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <Field id={`${uid}-s`} label="Odometer at start">
            <input id={`${uid}-s`} inputMode="numeric" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={errors.startOdometer ? true : undefined} />
            <FieldError message={errors.startOdometer} />
          </Field>
          <Field id={`${uid}-e`} label="At the end" hint={km > 0 ? `${km} km` : undefined}>
            <input id={`${uid}-e`} inputMode="numeric" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={errors.endOdometer ? true : undefined} />
            <FieldError message={errors.endOdometer} />
          </Field>
        </div>
        <Field id={`${uid}-pr`} label="Project">
          <SearchableSelect id={`${uid}-pr`} value={projectId} onChange={setProjectId} options={projects ?? []} clearable placeholder="Choose" noOptionsText={projects ? "No projects" : "Loading…"} aria-invalid={errors.projectId ? true : undefined} />
          <FieldError message={errors.projectId} />
        </Field>
        <Field id={`${uid}-cc`} label="Or cost centre">
          <SearchableSelect id={`${uid}-cc`} value={costCentreId} onChange={setCostCentreId} options={costCentres ?? []} clearable placeholder="Choose" noOptionsText={costCentres ? "No cost centres" : "Loading…"} />
        </Field>
        <Button type="submit" variant="primary" icon={Route} disabled={busy} className="w-full">
          {busy ? "Logging…" : "Log the trip"}
        </Button>
      </form>
    </Panel>
  );
}
