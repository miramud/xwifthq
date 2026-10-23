"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LabourRunRow } from "@/lib/api/finance-labour-client";
import { cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { compact, monthLabel } from "@/suite/finance/lib/format";
import { thisMonth } from "@/suite/finance/components/projects/meta";

/*
  The month picker is a year on one card: twelve months, each saying what
  happened to its labour - allocated (and how much went to projects),
  charged provisionally, or nothing yet - so the month to open next is
  the one that looks unfinished. Months still to come are hatched and
  cannot be opened.
*/

export type MonthState = "allocated" | "provisional" | "open" | "future";

/** Each month's state from the posted runs. Pure, for testing. */
export function monthStates(year: number, runs: LabourRunRow[], now = thisMonth()): { key: string; state: MonthState; run: LabourRunRow | null }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const posted = runs.filter((r) => r.month === key && r.status === "posted");
    const allocation = posted.find((r) => r.kind === "allocation") ?? null;
    const provisional = posted.find((r) => r.kind === "provisional") ?? null;
    if (allocation) return { key, state: "allocated" as const, run: allocation };
    if (provisional) return { key, state: "provisional" as const, run: provisional };
    return { key, state: key > now ? ("future" as const) : ("open" as const), run: null };
  });
}

const STATE_TEXT: Record<MonthState, string> = {
  allocated: "Allocated",
  provisional: "Provisional",
  open: "Not allocated",
  future: "Still to come",
};

export function LabourMonthCalendar({ runs }: { runs: LabourRunRow[] }) {
  const now = thisMonth();
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const months = monthStates(year, runs, now);
  const nowYear = Number(now.slice(0, 4));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight tabular-nums text-neutral-900" aria-live="polite">
          {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label={`Show ${year - 1}`}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= nowYear}
            aria-label={`Show ${year + 1}`}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-600 outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
      </div>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={`Labour by month, ${year}`}>
        {months.map((m) => {
          const label = monthLabel(m.key, true).split(" ")[0];
          const current = m.key === now;
          const body = (
            <>
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-neutral-900">{label}</span>
                {current && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary-600" />}
              </span>
              <span
                className={cx(
                  "mt-1 block truncate text-[11px] font-semibold",
                  m.state === "allocated" ? HUE.mint.text : m.state === "provisional" ? HUE.grape.text : "text-neutral-500",
                )}
              >
                {m.state === "allocated" && m.run ? compact(m.run.allocated) : STATE_TEXT[m.state]}
              </span>
            </>
          );
          const aria = `${monthLabel(m.key)}: ${STATE_TEXT[m.state]}${m.run ? `, ${compact(m.run.allocated)} to projects` : ""}${current ? " (this month)" : ""}`;
          return (
            <li key={m.key}>
              {m.state === "future" ? (
                <span className="ws-hatch block rounded-xl px-3 py-2.5 opacity-70">
                  {body}
                </span>
              ) : (
                <Link
                  href={`/suite/finance/labour/${m.key}`}
                  aria-label={`Open ${aria}`}
                  className={cx(
                    "block min-h-11 rounded-xl border px-3 py-2.5 outline-none transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0",
                    m.state === "allocated"
                      ? "border-mint-500/25 bg-mint-50/70"
                      : m.state === "provisional"
                        ? "border-grape-500/25 bg-grape-50/70"
                        : "border-neutral-200 bg-white",
                    current && "ring-1 ring-primary-200",
                  )}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.mint.dot)} />
          Allocated, to projects
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.grape.dot)} />
          Provisional charge
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm ring-1 ring-neutral-300" />
          Not allocated yet
        </li>
      </ul>
    </div>
  );
}
