"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, ShieldAlert } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { operationsCompliance, type ComplianceSummary } from "@/lib/api/finance-budgets-client";

/**
 * Operations' compliance, on the MD's morning screen: a red banner when a
 * mandatory certificate has expired (a bid can be lost on one), and a small
 * line of what falls due in the next 30 days and what is overdue. Shows
 * nothing at all when the organisation has no Admin & Operations, or the
 * person may not see it.
 */
export function ComplianceFlag({ className }: { className?: string }) {
  const [c, setC] = useState<ComplianceSummary | null>(null);

  useEffect(() => {
    let alive = true;
    operationsCompliance().then((r) => alive && setC(r));
    return () => {
      alive = false;
    };
  }, []);

  if (!c) return null;
  const expired = c.expiredMandatory;
  const quiet = expired.length === 0 && c.dueSoon === 0 && c.overdue === 0 && c.expiring === 0;
  if (quiet) return null;

  return (
    <div className={cx("space-y-3", className)}>
      {expired.length > 0 && (
        <Link
          href="/suite/operations/compliance"
          className="group flex items-start gap-3 rounded-[1.125rem] border border-rose-500/30 bg-rose-50 px-4 py-3.5 text-rose-700 outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
            <ShieldAlert size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">Expired mandatory certificates: {expired.join(", ")}</span>
            <span className="block">Renew before the next bid or payment that asks for {expired.length === 1 ? "it" : "them"}. Open compliance to record the renewal.</span>
          </span>
          <ArrowRight size={17} className="mt-2.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
      {(c.dueSoon > 0 || c.overdue > 0 || c.expiring > 0) && (
        <Link
          href="/suite/operations/compliance"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-neutral-200/80 bg-white px-4 py-3 text-sm outline-none transition hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <span className="flex items-center gap-2 font-semibold text-neutral-900">
            <CalendarClock size={16} className="text-grape-700" aria-hidden />
            Compliance
          </span>
          <span className="text-neutral-600">
            <span className="font-semibold tabular-nums text-neutral-900">{c.dueSoon}</span> due in 30 days
          </span>
          <span className={c.overdue > 0 ? "text-rose-700" : "text-neutral-600"}>
            <span className="font-semibold tabular-nums">{c.overdue}</span> overdue
          </span>
          {c.expiring > 0 && (
            <span className="text-sun-700">
              <span className="font-semibold tabular-nums">{c.expiring}</span> {c.expiring === 1 ? "certificate" : "certificates"} expiring
            </span>
          )}
          <span className="ml-auto text-[13px] font-semibold text-primary-700">Open compliance</span>
        </Link>
      )}
    </div>
  );
}
