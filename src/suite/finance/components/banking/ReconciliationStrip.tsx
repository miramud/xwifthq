"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed, Scale, TriangleAlert } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import type { BankAccountDetail, ReconciliationStatus } from "@/lib/api/finance-banking-client";
import { monthLabel } from "@/suite/finance/lib/format";
import { RECON_STATUS, monthsEnding } from "./labels";

/**
 * Twelve months of reconciliation at a glance, like a wall planner: approved
 * months solid green, balanced-but-unapproved blue, prepared-with-a-difference
 * amber, and months nobody has reconciled hatched - "not yet". Each month
 * opens its reconciliation.
 */

const TILE: Record<ReconciliationStatus | "none", { cls: string; icon: typeof CheckCircle2 }> = {
  approved: { cls: "bg-mint-700 text-white border-transparent", icon: CheckCircle2 },
  balanced: { cls: "bg-sky-50 text-sky-700 border-sky-100", icon: Scale },
  draft: { cls: "bg-sun-50 text-sun-700 border-sun-100", icon: TriangleAlert },
  none: { cls: "ws-hatch text-neutral-600 border-neutral-200", icon: CircleDashed },
};

export default function ReconciliationStrip({
  accountId,
  reconciliations,
  endMonth,
}: {
  accountId: string;
  reconciliations: BankAccountDetail["reconciliations"];
  /** The last month shown (`YYYY-MM`), normally this month. */
  endMonth: string;
}) {
  const byMonth = new Map(reconciliations.map((r) => [r.periodKey, r.status]));
  const months = monthsEnding(endMonth, 12);

  return (
    <div>
      <ol className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12" aria-label="Reconciliation by month">
        {months.map((m) => {
          const status = byMonth.get(m) ?? "none";
          const t = TILE[status];
          const Icon = t.icon;
          const [year, mm] = m.split("-");
          const short = monthLabel(m, true).split(" ")[0];
          const isCurrent = m === endMonth;
          return (
            <li key={m}>
              <Link
                href={`/suite/finance/banking/${accountId}/reconciliation/${m}`}
                aria-label={`${monthLabel(m)}: ${RECON_STATUS[status].label}`}
                className={cx(
                  "flex h-[76px] flex-col justify-between rounded-xl border px-2.5 py-2 outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0",
                  t.cls,
                  isCurrent && "ring-2 ring-primary-400 ring-offset-1",
                )}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="text-[13px] font-bold leading-none">{short}</span>
                  <Icon size={14} aria-hidden />
                </span>
                <span className={cx("text-[11px] font-medium tabular-nums", status === "approved" ? "text-white/85" : "opacity-75")}>
                  {mm === "01" || m === months[0] ? year : " "}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600">
        {(["approved", "balanced", "draft", "none"] as const).map((s) => {
          const Icon = TILE[s].icon;
          return (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span className={cx("inline-flex h-4 w-4 items-center justify-center rounded border", TILE[s].cls)} aria-hidden>
                <Icon size={10} />
              </span>
              {RECON_STATUS[s].label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
