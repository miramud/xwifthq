"use client";

import { AlertTriangle, CalendarClock, Info, Plane } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { Money } from "@/suite/finance/components/banking/ui";
import type { LeadTime, TripCost } from "../travel/cost";
import { plural } from "../travel/labels";

/**
 * The trip's cost as it is being typed: each traveller's DTA, hotel and
 * taxi from the policy, the flights estimate, and the total the project is
 * asked for. Above-policy amounts and a late booking are called out in words,
 * with what they need before the trip can be sent.
 */
export default function CostPreview({
  cost,
  lead,
  names,
  grades,
}: {
  cost: TripCost;
  lead: LeadTime | null;
  /** userId → name, for the traveller rows. */
  names: Record<string, string>;
  grades: Record<string, string>;
}) {
  const people = cost.travellers.filter((t) => t.userId);
  return (
    <section aria-labelledby="cost-preview-title" className="ws-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 id="cost-preview-title" className="text-[15px] font-semibold text-neutral-900">
          Cost preview
        </h2>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-neutral-600">
          {cost.days > 0 ? `${plural(cost.days, "day")} · ${plural(cost.nights, "night")}` : "Set the dates"}
        </span>
      </header>

      <div className="space-y-4 p-5" aria-live="polite">
        {people.length === 0 ? (
          <p className="text-sm text-neutral-500">Add who is travelling to see what each person is entitled to.</p>
        ) : (
          <ul className="space-y-3">
            {people.map((t, i) => (
              <li key={`${t.userId}-${i}`} className={cx("rounded-xl border p-3", t.over ? "border-sun-500/40 bg-sun-50/50" : "border-neutral-200/80")}>
                <p className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold text-neutral-900">{names[t.userId] ?? "Traveller"}</span>
                  <Money value={t.total} className="shrink-0 font-semibold text-neutral-900" />
                </p>
                <p className="text-xs text-neutral-500">{grades[t.grade] ?? t.grade}</p>
                {t.rate === null ? (
                  <p className="mt-2 text-xs font-medium text-error-700">The policy has no rate for this grade and destination.</p>
                ) : (
                  <dl className="mt-2 space-y-1 text-xs">
                    <Line label={`DTA ${plural(cost.days, "day")}`} value={t.dta} policy={t.policyDta} over={t.dtaOver} />
                    <Line label={`Hotel ${plural(cost.nights, "night")}`} value={t.hotel} policy={t.policyHotel} over={t.hotelOver} />
                    <Line label={cost.air ? "Airport taxi × 2" : "Airport taxi"} value={t.taxi} />
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}

        {!cost.air && people.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-neutral-500">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
            No airport taxi: no leg flies and the trip is in Nigeria.
          </p>
        )}

        <dl className="space-y-2 border-t border-dashed border-neutral-200 pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-600">Advance (DTA, hotel, taxi)</dt>
            <dd>
              <Money value={cost.advance} className="font-semibold text-neutral-900" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-neutral-600">
              <Plane size={13} aria-hidden />
              Flights estimate
            </dt>
            <dd>
              <Money value={cost.flights} className="font-semibold text-neutral-900" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-3">
            <dt className="font-semibold text-neutral-900">Trip estimate</dt>
            <dd>
              <Money value={cost.estimate} className="text-xl font-bold tracking-tight text-neutral-900" />
            </dd>
          </div>
        </dl>

        {cost.overPolicy && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-sm font-medium text-sun-700 ring-1 ring-sun-500/30">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Above policy: needs justification and the MD.
              <span className="mt-0.5 block text-xs font-normal">Write the justification below; the MD approves it.</span>
            </span>
          </p>
        )}

        {lead?.late && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-coral-50 px-3 py-2.5 text-sm font-medium text-coral-700 ring-1 ring-coral-500/30">
            <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {lead.daysAway < 0 ? "This trip has already started." : `Leaves in ${plural(lead.daysAway, "day")}`}: {lead.international ? "international" : "local"} trips are booked at least {lead.lead} days ahead.
              <span className="mt-0.5 block text-xs font-normal">Say why it is booked late before you send it.</span>
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function Line({ label, value, policy, over }: { label: string; value: number; policy?: number; over?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={cx("text-right tabular-nums", over ? "font-semibold text-sun-700" : "text-neutral-800")}>
        <Money value={value} />
        {over && policy != null && (
          <span className="block text-[11px] font-medium">
            policy <Money value={policy} />
          </span>
        )}
      </dd>
    </div>
  );
}
