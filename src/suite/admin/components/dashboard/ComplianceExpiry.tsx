import { CalendarClock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Pill, SectionCard } from "@/components/suite/ui";
import { HUE } from "@/components/workspace/modules";
import { ADMIN_DATA, type ComplianceRow } from "@/lib/suite-data";

/**
 * Policies, licences and the dates they lapse on.
 *
 * Urgency is carried by the number and the word ("12 days overdue", "in 2
 * days"), never by a colour alone. The status pill beside it is the fixture's
 * own tone and its own word, and the two are read together.
 *
 * `AS_AT` is pinned rather than read from the clock. Every date in the fixtures
 * is written against 30 September 2026, so computing "days remaining" against
 * `Date.now()` would drift a little further from the fixture every day, break
 * server/client agreement on the rendered string, and quietly imply that
 * something here is live. It is not: this module has no API behind it.
 */

const AS_AT = Date.UTC(2026, 8, 30); // 30 September 2026
export const AS_AT_LABEL = "30 Sep 2026";

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parses the fixtures' own date format, e.g. "12 Jan 2027". */
function daysUntil(reviewDue: string): number {
  const [day, month, year] = reviewDue.split(" ");
  const due = Date.UTC(Number(year), MONTHS[month] ?? 0, Number(day));
  return Math.round((due - AS_AT) / 86_400_000);
}

function urgency(days: number): { headline: string; note: string; emphatic: boolean } {
  if (days < 0) {
    return {
      headline: `${Math.abs(days)} days`,
      note: "overdue",
      emphatic: true,
    };
  }
  if (days <= 30) {
    return { headline: `${days} days`, note: "left", emphatic: true };
  }
  return { headline: `${days} days`, note: "left", emphatic: false };
}

function ComplianceItem({ row }: { row: ComplianceRow }) {
  const days = daysUntil(row.reviewDue);
  const { headline, note, emphatic } = urgency(days);
  const Icon = emphatic ? ShieldAlert : ShieldCheck;

  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${emphatic ? HUE.coral.soft : HUE.mint.soft}`}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">{row.policy}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {row.owner} · review due {row.reviewDue}
        </p>
        <div className="mt-2">
          <Pill tone={row.tone}>{row.status}</Pill>
        </div>
      </div>
      <div
        className={`shrink-0 rounded-2xl px-3 py-1.5 text-right ${emphatic ? HUE.coral.soft : "bg-neutral-50 text-neutral-600"}`}
      >
        <p className="font-heading text-base font-bold tracking-tight tnum">{headline}</p>
        <p className={`text-xs ${emphatic ? "font-semibold" : ""}`}>{note}</p>
      </div>
    </li>
  );
}

export function ComplianceExpiry() {
  const rows = ADMIN_DATA.compliance;
  const soon = rows.filter((row) => daysUntil(row.reviewDue) <= 30).length;

  return (
    <SectionCard
      title="Compliance and renewals"
      subtitle={`As at ${AS_AT_LABEL} · ${soon} due within 30 days`}
      action={
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${HUE.coral.soft}`}
          aria-hidden="true"
        >
          <CalendarClock className="h-[18px] w-[18px]" />
        </span>
      }
    >
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <ComplianceItem key={row.id} row={row} />
        ))}
      </ul>
      <p
        className={`mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed ${HUE.blue.soft}`}
      >
        Renewal notices go out at 90, 30 and 7 days. They follow the same
        preferences as every other XwiftHQ alert (in-app, email or WhatsApp),
        set once per person rather than once per module.
      </p>
    </SectionCard>
  );
}
