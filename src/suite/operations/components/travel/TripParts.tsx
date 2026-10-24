"use client";

import { AlertTriangle, ArrowRight, CircleCheckBig, Plane, Users } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { FaceAvatar, IconTile } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { when } from "@/suite/finance/components/requests/ui";
import type { TripBooking, TripChange, TripFull, TripLeg, TripTraveller } from "@/lib/api/operations-travel-client";
import { BOOKING_KIND, MODE, bookingStatus, changeStatus, dateSpan, plural, tripStatus } from "./labels";
import { MetaChip } from "./shared";
import { RichTextView } from "@/components/workspace/RichTextView";

/*
  A trip, read the way a traveller reads a boarding pass: where from and
  where to, when, who, and what it costs. Then the itinerary, the people
  and their entitlement, what the desk booked, and what changed.
*/

/** The trip's headline as a ticket: the route on the left, the stub on the right. */
export function TripTicket({ trip, classes }: { trip: TripFull; classes: Record<string, string> }) {
  const origin = trip.legs[0]?.from ?? null;
  const st = tripStatus(trip.status);
  return (
    <section aria-label="Trip at a glance" className="ws-card relative mb-6 overflow-hidden">
      <div className="grid md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <MetaChip meta={st} />
            <Chip hue={trip.tripType === "international" ? "grape" : "sky"}>{trip.tripType === "international" ? "International" : "Local"}</Chip>
            {trip.overPolicy && (
              <Chip hue="sun" icon={AlertTriangle}>
                Above policy
              </Chip>
            )}
          </div>
          <div className="mt-5 flex min-w-0 items-center gap-3 sm:gap-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">From</p>
              <p className="truncate text-xl font-bold tracking-tight text-neutral-900 sm:text-[26px]">{origin ?? "Home base"}</p>
            </div>
            <div className="relative flex min-w-[56px] flex-1 items-center" aria-hidden>
              <span className="h-px flex-1 border-t-2 border-dashed border-neutral-300" />
              <span className="mx-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-md shadow-primary-600/30">
                <Plane size={16} className="rotate-45" />
              </span>
              <span className="h-px flex-1 border-t-2 border-dashed border-neutral-300" />
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">To</p>
              <p className="truncate text-xl font-bold tracking-tight text-neutral-900 sm:text-[26px]">{trip.destination}</p>
            </div>
          </div>
          <p className="sr-only">
            From {origin ?? "home base"} to {trip.destination}
          </p>
          <p className="mt-3 text-sm text-neutral-600">{classes[trip.destinationClass] ?? trip.destinationClass}</p>
        </div>

        {/* The stub, behind a perforation. */}
        <div className="relative border-t-2 border-dashed border-neutral-200 bg-neutral-50/70 p-5 sm:p-6 md:border-l-2 md:border-t-0">
          <span aria-hidden className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-canvas md:block" />
          <span aria-hidden className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-canvas md:block" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-1">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Trip</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-neutral-900">{trip.number ?? "Draft"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Dates</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">{dateSpan(trip.departsOn, trip.returnsOn)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Travellers</dt>
              <dd className="mt-0.5 text-sm font-semibold text-neutral-900">{plural(trip.travellers.length, "person", "people")}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Estimate</dt>
              <dd className="mt-0.5 text-sm font-bold text-neutral-900">
                <Money value={trip.estimate} />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** The legs in order, joined by a line, each with its mode. */
export function Itinerary({ legs, departsOn, returnsOn }: { legs: TripLeg[]; departsOn: string; returnsOn: string }) {
  if (legs.length === 0) {
    return (
      <p className="rounded-2xl bg-neutral-50 px-4 py-4 text-sm text-neutral-500">
        No legs entered. Away {dateSpan(departsOn, returnsOn)}; the airport taxi is only costed when a leg flies or the trip is abroad.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4" aria-label="Itinerary">
      <span aria-hidden className="absolute bottom-3 left-[17px] top-3 w-px bg-neutral-200" />
      {legs.map((l) => {
        const mode = MODE[l.mode] ?? MODE.air;
        const Icon = mode.icon;
        return (
          <li key={l.sequence} className="relative flex gap-3">
            <span className={cx("relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white", HUE.sky.soft)}>
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-neutral-900">
                {l.from}
                <ArrowRight size={14} className="text-neutral-400" aria-label="to" />
                {l.to}
              </p>
              <p className="text-xs text-neutral-500">
                {day(l.travelOn)} · {mode.label}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Each traveller with their grade and what the policy gives them; anything set by hand above policy is flagged. */
export function TravellersTable({ travellers, grades }: { travellers: TripTraveller[]; grades: Record<string, string> }) {
  if (travellers.length === 0) return <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">Nobody added yet.</p>;
  const total = travellers.reduce((s, t) => s + t.total, 0);
  return (
    <div>
      {/* Cards on a phone, a table from `sm` up. */}
      <ul className="space-y-3 sm:hidden">
        {travellers.map((t) => (
          <li key={t.id} className="rounded-2xl border border-neutral-100 p-4">
            <TravellerName t={t} grades={grades} />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Figure label={`DTA, ${plural(t.days, "day")}`} value={t.dta} />
              <Figure label={`Hotel, ${plural(t.nights, "night")}`} value={t.hotel} />
              <Figure label="Airport taxi" value={t.taxi} />
              <Figure label="Total" value={t.total} strong />
            </dl>
            {t.total > t.policyTotal && <OverNote t={t} />}
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-100 sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Travellers and their entitlement</caption>
          <thead>
            <tr className="bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
              <th scope="col" className="py-2.5 pl-4 pr-3 font-semibold">Traveller</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">DTA</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Hotel</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Taxi</th>
              <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {travellers.map((t) => (
              <tr key={t.id}>
                <td className="py-3 pl-4 pr-3">
                  <TravellerName t={t} grades={grades} />
                  {t.total > t.policyTotal && <OverNote t={t} />}
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={t.dta} />
                  <span className="block text-xs text-neutral-500">{plural(t.days, "day")}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={t.hotel} />
                  <span className="block text-xs text-neutral-500">{plural(t.nights, "night")}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={t.taxi} />
                </td>
                <td className="py-3 pl-3 pr-4 text-right font-semibold text-neutral-900">
                  <Money value={t.total} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-100 bg-primary-50/40">
              <th scope="row" colSpan={4} className="py-3 pl-4 pr-3 text-right text-sm font-semibold text-neutral-700">
                Advance for everyone
              </th>
              <td className="py-3 pl-3 pr-4 text-right text-[15px] font-bold text-neutral-900">
                <Money value={total} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TravellerName({ t, grades }: { t: TripTraveller; grades: Record<string, string> }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <FaceAvatar name={t.name} size={30} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-neutral-900">{t.name ?? "Someone"}</span>
        <span className="block text-xs text-neutral-500">{grades[t.grade] ?? t.grade}</span>
      </span>
    </span>
  );
}

function OverNote({ t }: { t: TripTraveller }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sun-700">
      <AlertTriangle size={13} aria-hidden />
      <Money value={t.total - t.policyTotal} /> above policy
    </p>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={cx("text-right", strong ? "font-bold text-neutral-900" : "text-neutral-800")}>
        <Money value={value} />
      </dd>
    </div>
  );
}

/** What the desk booked: flights, hotels and ground transport, each with its reference. */
export function BookingsList({ bookings, empty }: { bookings: TripBooking[]; empty: string }) {
  if (bookings.length === 0) return <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {bookings.map((b) => {
        const kind = BOOKING_KIND[b.kind] ?? BOOKING_KIND.ground;
        const st = bookingStatus(b.status);
        const Icon = kind.icon;
        return (
          <li key={b.id} className={cx("flex gap-3 rounded-2xl border border-neutral-100 p-3.5", b.status === "cancelled" && "opacity-70")}>
            <IconTile icon={Icon} hue={kind.hue} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm font-semibold text-neutral-900">
                  {kind.label}
                  {b.traveller ? <span className="font-normal text-neutral-500"> · {b.traveller}</span> : null}
                </p>
                <Money value={b.amount} className="text-sm font-semibold text-neutral-900" />
              </div>
              {b.details && <p className="mt-0.5 text-sm text-neutral-600">{b.details}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {b.reference && <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-xs font-semibold text-neutral-800">{b.reference}</span>}
                {b.agency && <span className="text-xs text-neutral-500">via {b.agency}</span>}
                <Chip hue={st.hue} dot className="!px-2 !py-0.5 !text-[11px]">
                  {st.label}
                </Chip>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Change and cancellation requests, oldest first, with their fee and where each one is. */
export function ChangesList({
  changes,
  bookings,
  reasons,
  action,
}: {
  changes: TripChange[];
  bookings: TripBooking[];
  reasons: Record<string, string>;
  /** The desk's "carry it out" for an approved change. */
  action?: (c: TripChange) => React.ReactNode;
}) {
  if (changes.length === 0) return <p className="rounded-2xl bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">No changes or cancellations asked for.</p>;
  return (
    <ol className="space-y-3">
      {changes.map((c) => {
        const st = changeStatus(c.status);
        const booking = c.bookingId ? bookings.find((b) => b.id === c.bookingId) : null;
        return (
          <li key={c.id} className="rounded-2xl border border-neutral-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-900">
                {c.kind === "cancellation" ? "Cancellation" : "Change"}
                <span className="font-normal text-neutral-500"> · {reasons[c.reason] ?? c.reason}</span>
              </p>
              <MetaChip meta={st} />
            </div>
            <p className="mt-1.5 text-sm text-neutral-700">{c.description}</p>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
              <div className="flex gap-1">
                <dt>Fee</dt>
                <dd className="font-semibold text-neutral-900">
                  <Money value={c.fee} />
                </dd>
              </div>
              {booking && (
                <div className="flex gap-1">
                  <dt>Booking</dt>
                  <dd className="font-medium text-neutral-800">{booking.reference ?? BOOKING_KIND[booking.kind]?.label}</dd>
                </div>
              )}
              {c.requestedBy && (
                <div className="flex gap-1">
                  <dt>Asked by</dt>
                  <dd className="font-medium text-neutral-800">{c.requestedBy}</dd>
                </div>
              )}
              {c.executedAt && (
                <div className="flex items-center gap-1">
                  <CircleCheckBig size={12} className="text-mint-600" aria-hidden />
                  <dt>Done</dt>
                  <dd className="font-medium text-neutral-800">{when(c.executedAt)}</dd>
                </div>
              )}
            </dl>
            {action && <div className="mt-3">{action(c)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** The trip report once written. */
export function TripReport({ trip }: { trip: TripFull }) {
  if (!trip.report) return null;
  return (
    <div>
      <RichTextView value={trip.report} size="sm" className="text-neutral-800" />
      {trip.reportSubmittedAt && <p className="mt-2 text-xs text-neutral-500">Written {when(trip.reportSubmittedAt)}</p>}
    </div>
  );
}

/** A small "n travelling" tag for trip cards. */
export function TravellersTag({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
      <Users size={12} aria-hidden />
      {plural(n, "traveller")}
    </span>
  );
}
