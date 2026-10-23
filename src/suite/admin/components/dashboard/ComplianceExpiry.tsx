import { CalendarClock } from "lucide-react";
import { Pill, SectionCard } from "@/components/suite/ui";
import { ADMIN_DATA, type ComplianceRow } from "@/lib/suite-data";

/**
 * Policies, licences and the dates they lapse on.
 *
 * Urgency is carried by the number and the word — "12 days overdue", "in 2
 * days" — never by a colour alone. The status pill beside it is the fixture's
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

  return (
    <li className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{row.policy}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {row.owner} · review due {row.reviewDue}
        </p>
        <div className="mt-2">
          <Pill tone={row.tone}>{row.status}</Pill>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`font-heading text-base font-bold tracking-tight tnum ${
            emphatic ? "text-neutral-900" : "text-neutral-600"
          }`}
        >
          {headline}
        </p>
        <p
          className={`text-xs ${
            emphatic ? "font-semibold text-neutral-700" : "text-neutral-500"
          }`}
        >
          {note}
        </p>
      </div>
    </li>
  );
}

export function ComplianceExpiry() {
  const rows = ADMIN_DATA.compliance;
  const soon = rows.filter((row) => daysUntil(row.reviewDue) <= 30).length;

  return (
    <SectionCard
      title="Compliance & renewal register"
      subtitle={`As at ${AS_AT_LABEL} · ${soon} within 30 days`}
      action={
        <CalendarClock className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      }
    >
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <ComplianceItem key={row.id} row={row} />
        ))}
      </ul>
      <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
        Renewal notice fires at 90, 30 and 7 days. The notice uses the same
        preferences as every other Elevate alert — in-app, email or WhatsApp,
        set once per person rather than once per module.
      </p>
    </SectionCard>
  );
}
