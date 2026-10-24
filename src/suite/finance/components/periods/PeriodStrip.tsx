"use client";

import Link from "next/link";
import { CircleDot, Hourglass, Lock, type LucideIcon } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import type { Period, PeriodStatus } from "@/lib/api/finance-ledger-client";

/*
  A year of accounting months on one line: how far each is closed. Locked
  months are solid, a month being closed wears amber, open months are white,
  and months still to come carry the workspace's hatch - "not yet" as
  texture. The current month is ringed. Every state also has an icon and a
  word, for anybody who doesn't see the colour.
*/

export const PERIOD_STATUS: Record<PeriodStatus, { label: string; short: string; hue: Hue; icon: LucideIcon; hint: string }> = {
  open: { label: "Open", short: "Open", hue: "blue", icon: CircleDot, hint: "Anybody with journal access can post." },
  soft_closed: { label: "Closing", short: "Closing", hue: "sun", icon: Hourglass, hint: "Only a finance manager can post." },
  locked: { label: "Locked", short: "Locked", hue: "slate", icon: Lock, hint: "Nobody can post. Adjust in the next open month." },
};

/** `YYYY-MM` for a date, in local time. */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** `YYYY-MM-DD` for a date, in local time (not UTC, which is yesterday just after midnight in Lagos). */
export const dayKey = (d: Date) => `${monthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;

const TILE: Record<PeriodStatus, string> = {
  open: "bg-white border-primary-200 text-neutral-900",
  soft_closed: "bg-sun-50 border-sun-500/40 text-sun-700",
  locked: "bg-neutral-800 border-neutral-800 text-white",
};

export function PeriodStrip({
  periods,
  today = new Date(),
  href = "/suite/finance/periods",
  compact = false,
}: {
  periods: Period[];
  today?: Date;
  href?: string;
  compact?: boolean;
}) {
  const now = monthKey(today);
  return (
    <ol className="grid grid-cols-3 gap-2.5 sm:grid-cols-6" aria-label="Accounting months">
      {periods.map((p) => {
        const meta = PERIOD_STATUS[p.status];
        const Icon = meta.icon;
        const future = p.key > now && p.status === "open";
        const current = p.key === now;
        const name = p.label.split(" ")[0].slice(0, 3);
        return (
          <li key={p.id}>
            <Link
              href={href}
              title={`${p.label}: ${meta.label}. ${meta.hint}`}
              className={cx(
                "group relative flex h-full flex-col justify-between rounded-xl border px-2.5 outline-none transition hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300",
                compact ? "min-h-[64px] py-2" : "min-h-[84px] py-2.5",
                future ? "ws-hatch border-neutral-200 text-neutral-500" : TILE[p.status],
                current && "ring-2 ring-primary-500 ring-offset-2",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-bold tracking-tight">{name}</span>
                <Icon size={13} aria-hidden className={p.status === "locked" ? "text-white/70" : undefined} />
              </span>
              <span className="mt-1 block">
                <span className={cx("block text-[11px] font-semibold", p.status === "locked" && "text-white/80")}>
                  {current ? "This month" : future ? "Not yet" : meta.short}
                </span>
                {!compact && (
                  <span className={cx("block text-[11px] tabular-nums", p.status === "locked" ? "text-white/70" : "text-neutral-500")}>
                    {p.posted} posted
                  </span>
                )}
              </span>
              <span className="sr-only">
                {`${p.label}: ${meta.label}${current ? ", the current month" : ""}. ${p.posted} posted, ${p.drafts} drafts, ${p.pending} awaiting approval.`}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** The key to the strip's colours. */
export function PeriodLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-primary-200 bg-white" aria-hidden /> Open
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-sun-500/40 bg-sun-50" aria-hidden /> Closing (soft-closed)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-neutral-800" aria-hidden /> Locked
      </li>
      <li className="flex items-center gap-1.5">
        <span className="ws-hatch h-3 w-3 rounded border border-neutral-200" aria-hidden /> Still to come
      </li>
    </ul>
  );
}
