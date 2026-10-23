"use client";

import { useState } from "react";
import { CalendarNav, MonthCalendar, monthTitle, type CalendarEvent } from "@/components/workspace/Calendar";
import { Legend } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";

/** A month of the stores' paperwork (requisitions raised, counts taken), each a chip that opens it. */
export function StoresCalendar({ events, legend, caption }: { events: CalendarEvent[]; legend: { label: string; hue: Hue }[]; caption: string }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const step = (by: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + by, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const inMonth = events.filter((e) => e.date.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`)).length;

  return (
    <div>
      <CalendarNav title={monthTitle(cursor.y, cursor.m)} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} />
      <p className="sr-only" aria-live="polite">
        {caption}: {inMonth} in {monthTitle(cursor.y, cursor.m)}.
      </p>
      <MonthCalendar year={cursor.y} month={cursor.m} events={events} maxPerDay={2} />
      <div className="mt-3">
        <Legend items={legend} />
      </div>
    </div>
  );
}
