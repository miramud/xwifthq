"use client";

import { useId, useState } from "react";
import { CalendarCheck, Car } from "lucide-react";
import { Button } from "@/components/workspace/kit";
import { todayYmd } from "@/components/workspace/Calendar";
import { ErrorNote, Field, inputClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { help, opsError, opsFieldErrors, type BookableRoom, type PoolVehicle } from "@/lib/api/operations-desk-client";
import { localIso, spanText } from "@/suite/operations/components/facilities/labels";

const pad = (n: number) => String(n).padStart(2, "0");
const plusHour = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return `${pad(Math.min(23, h + 1))}:${pad(m || 0)}`;
};

function Footer({ onClose, busy, label, icon }: { onClose: () => void; busy: boolean; label: string; icon: typeof Car }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" variant="primary" icon={icon} disabled={busy}>
        {busy ? "Booking…" : label}
      </Button>
    </div>
  );
}

/** Book a room for a stretch of one day. A clash comes back naming the booking in the way. */
export function BookRoomDialog({ room, day, start, onClose, onDone }: { room: BookableRoom; day: string; start: string; onClose: () => void; onDone: (msg: string) => void }) {
  const uid = useId();
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(day);
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(plusHour(start));
  const [attendees, setAttendees] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "What's the meeting?";
    if (!on || on < todayYmd()) next.startsAt = "Choose today or a later day.";
    if (to <= from) next.endsAt = "It ends after it starts.";
    const n = attendees.trim() ? Number(attendees) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1)) next.attendees = "A whole number of people.";
    else if (n !== null && room.capacity && n > room.capacity) next.attendees = `${room.name} seats ${room.capacity}.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    const startsAt = localIso(on, from);
    const endsAt = localIso(on, to);
    try {
      await help.bookRoom(room.id, { title: title.trim(), startsAt, endsAt, attendees: n });
      onDone(`${room.name} is yours: ${spanText(startsAt, endsAt)}.`);
    } catch (err) {
      const f = opsFieldErrors(err);
      setErrors(f);
      setError(f.startsAt ? null : opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      titleId={`${uid}-t`}
      title={`Book ${room.name}`}
      subtitle={[room.facility, room.capacity ? `seats ${room.capacity}` : null].filter(Boolean).join(" · ") || undefined}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Book the room" icon={CalendarCheck} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`${uid}-ti`} label="What for">
        <input id={`${uid}-ti`} className={inputClass} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Sprint review" aria-invalid={errors.title ? true : undefined} autoFocus />
        <FieldError message={errors.title} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-d`} label="Day">
          <input id={`${uid}-d`} type="date" min={todayYmd()} className={inputClass} value={on} onChange={(e) => setOn(e.target.value)} />
        </Field>
        <Field id={`${uid}-f`} label="From">
          <input id={`${uid}-f`} type="time" step={900} className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={errors.startsAt ? true : undefined} />
        </Field>
        <Field id={`${uid}-to`} label="To">
          <input id={`${uid}-to`} type="time" step={900} className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={errors.endsAt ? true : undefined} />
        </Field>
      </div>
      <FieldError message={errors.startsAt ?? errors.endsAt} />
      <Field id={`${uid}-a`} label="People" hint="Optional">
        <input id={`${uid}-a`} inputMode="numeric" className={inputClass} value={attendees} onChange={(e) => setAttendees(e.target.value)} aria-invalid={errors.attendees ? true : undefined} />
        <FieldError message={errors.attendees} />
      </Field>
    </DialogFrame>
  );
}

/** Ask for a pool vehicle; the fleet desk approves it and assigns a driver. */
export function RequestVehicleDialog({ vehicle, onClose, onDone }: { vehicle: PoolVehicle; onClose: () => void; onDone: (msg: string) => void }) {
  const uid = useId();
  const today = todayYmd();
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [fromDay, setFromDay] = useState(today);
  const [fromTime, setFromTime] = useState("09:00");
  const [toDay, setToDay] = useState(today);
  const [toTime, setToTime] = useState("13:00");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!purpose.trim()) next.purpose = "Say what the trip is for.";
    const startsAt = localIso(fromDay, fromTime);
    const endsAt = localIso(toDay, toTime);
    if (`${toDay}T${toTime}` <= `${fromDay}T${fromTime}`) next.endsAt = "It ends after it starts.";
    if (fromDay < today) next.startsAt = "Choose today or later.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      await help.bookVehicle(vehicle.id, { purpose: purpose.trim(), destination: destination.trim() || null, startsAt, endsAt });
      onDone(`Requested ${vehicle.registrationNo} for ${spanText(startsAt, endsAt)}. The fleet desk will confirm.`);
    } catch (err) {
      const f = opsFieldErrors(err);
      setErrors(f);
      setError(opsError(err));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={(e) => void submit(e)}
      titleId={`${uid}-t`}
      title={`Request ${vehicle.registrationNo}`}
      subtitle={vehicle.name ?? "A pool vehicle, with a driver if the fleet desk assigns one."}
      onClose={onClose}
      footer={<Footer onClose={onClose} busy={busy} label="Send the request" icon={Car} />}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field id={`${uid}-p`} label="What for">
        <input id={`${uid}-p`} className={inputClass} value={purpose} maxLength={255} onChange={(e) => setPurpose(e.target.value)} placeholder="Client visit" aria-invalid={errors.purpose ? true : undefined} />
        <FieldError message={errors.purpose} />
      </Field>
      <Field id={`${uid}-d`} label="Where to" hint="Optional">
        <input id={`${uid}-d`} className={inputClass} value={destination} maxLength={160} onChange={(e) => setDestination(e.target.value)} placeholder="Ikeja" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <Field id={`${uid}-fd`} label="From">
            <input id={`${uid}-fd`} type="date" min={today} className={inputClass} value={fromDay} onChange={(e) => setFromDay(e.target.value)} aria-invalid={errors.startsAt ? true : undefined} />
          </Field>
          <Field id={`${uid}-ft`} label="At">
            <input id={`${uid}-ft`} type="time" step={900} className={inputClass} value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <Field id={`${uid}-td`} label="Back by">
            <input id={`${uid}-td`} type="date" min={fromDay} className={inputClass} value={toDay} onChange={(e) => setToDay(e.target.value)} aria-invalid={errors.endsAt ? true : undefined} />
          </Field>
          <Field id={`${uid}-tt`} label="At">
            <input id={`${uid}-tt`} type="time" step={900} className={inputClass} value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </Field>
        </div>
      </div>
      <FieldError message={errors.startsAt ?? errors.endsAt ?? errors.vehicle} />
    </DialogFrame>
  );
}
