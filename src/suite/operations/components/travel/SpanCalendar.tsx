"use client";

import { useState } from "react";
import { AgendaList, CalendarNav, MonthCalendar, monthTitle, todayYmd, ymd, type CalendarEvent } from "@/components/workspace/Calendar";
import { Legend } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";

/*
  Dated things (trips, events) as bars across a month: one continuous bar
  from the first day to the last, coloured by status, with a legend. On a
  phone the month becomes an agenda list of the same items.
*/

export interface SpanItem {
  id: string;
  from: string;
  to: string;
  title: string;
  meta?: string;
  hue: Hue;
  href: string;
}

export function spanEvents(items: readonly SpanItem[]): CalendarEvent[] {
  return items.map((i) => ({ id: i.id, date: i.from, endDate: i.to, title: i.title, meta: i.meta, hue: i.hue, href: i.href, allDay: true }));
}

export default function SpanCalendar({
  items,
  legend,
  label,
  emptyLabel,
}: {
  items: SpanItem[];
  legend: { label: string; hue: Hue }[];
  /** What the calendar shows, for screen readers: "Trips by month". */
  label: string;
  emptyLabel: string;
}) {
  const t = todayYmd();
  const [cursor, setCursor] = useState(() => ({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }));
  const shift = (n: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const from = ymd(cursor.y, cursor.m, 1);
  const to = ymd(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate());
  const events = spanEvents(items);

  return (
    <section aria-label={label}>
      <CalendarNav
        title={monthTitle(cursor.y, cursor.m)}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setCursor({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 })}
      />
      <div className="hidden md:block">
        <MonthCalendar year={cursor.y} month={cursor.m} events={events} spanning maxLanes={3} />
      </div>
      <div className="md:hidden">
        <AgendaList events={events} from={from} to={to} statusChips={false} emptyLabel={emptyLabel} />
      </div>
      {legend.length > 0 && (
        <div className="mt-4">
          <Legend items={legend} />
        </div>
      )}
    </section>
  );
}
