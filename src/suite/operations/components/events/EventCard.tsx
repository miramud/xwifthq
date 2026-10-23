"use client";

import { MapPin, Users } from "lucide-react";
import { Money } from "@/suite/finance/components/banking/ui";
import type { EventSummary } from "@/lib/api/operations-travel-client";
import { dateSpan, eventStatus } from "../travel/labels";
import { MetaChip } from "../travel/shared";

/** An event as a card or a list row: name, kind, dates, place, people and budget. */
export default function EventCard({ event: e, flat = false }: { event: EventSummary; flat?: boolean }) {
  const people = e.participantsInternal + e.participantsExternal;
  return (
    <div className={flat ? "px-5 py-3.5" : "flex h-full flex-col p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{e.name}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {e.number ?? "Draft"} · {e.typeLabel}
          </p>
        </div>
        <Money value={e.budget} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <p className="mt-2 text-sm font-medium tabular-nums text-neutral-700">{dateSpan(e.startsOn, e.endsOn)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <MetaChip meta={eventStatus(e.status)} />
        {e.location && (
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-neutral-500">
            <MapPin size={12} aria-hidden />
            <span className="truncate">{e.location}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
          <Users size={12} aria-hidden />
          {people} taking part
        </span>
      </div>
    </div>
  );
}
