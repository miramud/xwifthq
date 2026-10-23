"use client";

import Link from "next/link";
import { CircleDashed, ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { day, monthLabel } from "@/suite/finance/lib/format";
import type { EfficiencyMonth, FuelType, PaidVia, PaperState, VehiclePaper } from "@/lib/api/operations-fleet-client";

/* Pieces the fleet screens share: the plate, the papers, and the efficiency chart. */

export const PAPER_STATE: Record<PaperState, { label: string; hue: Hue; icon: LucideIcon }> = {
  valid: { label: "Valid", hue: "mint", icon: ShieldCheck },
  expiring: { label: "Expiring", hue: "sun", icon: ShieldAlert },
  expired: { label: "Expired", hue: "rose", icon: ShieldX },
  missing: { label: "Not on file", hue: "slate", icon: CircleDashed },
};

export const FUEL_LABEL: Record<FuelType, string> = { petrol: "Petrol", diesel: "Diesel", electric: "Electric", hybrid: "Hybrid" };
export const PAID_VIA_LABEL: Record<PaidVia, string> = { card: "Fuel card", advance: "Cash advance", po: "Purchase order", cash: "Cash" };

/** Short names for the papers on a card. */
const SHORT: Record<string, string> = { licence: "Licence", roadworthiness: "Roadworthy", insurance: "Insurance", hackney: "Hackney" };

/**
 * The registration plate, drawn the way it sits on the car: a white plate
 * with a dark border, the country across the top, the number in heavy mono.
 * The number is what people read; the rest is the plate's frame.
 */
export function Plate({ number, size = "md", className }: { number: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex flex-col items-center rounded-lg bg-white ring-2 ring-neutral-800 outline outline-1 -outline-offset-4 outline-neutral-300",
        size === "lg" ? "min-w-[11rem] px-4 pb-1.5 pt-1" : size === "sm" ? "min-w-[6.5rem] px-2 pb-0.5 pt-0.5" : "min-w-[8.5rem] px-3 pb-1 pt-0.5",
        className,
      )}
    >
      <span className={cx("font-semibold uppercase tracking-[0.2em] text-mint-700", size === "lg" ? "text-[10px]" : "text-[8px]")} aria-hidden>
        Nigeria
      </span>
      <span className={cx("font-mono font-black uppercase leading-none tracking-wider text-neutral-900 tabular-nums", size === "lg" ? "text-2xl" : size === "sm" ? "text-[13px]" : "text-lg")}>{number}</span>
      <span className={cx("mt-0.5 h-0.5 w-8 rounded-full bg-rose-500", size === "sm" && "hidden")} aria-hidden />
    </span>
  );
}

/** One paper and where it stands, worded. */
export function PaperChip({ paper, short = false }: { paper: VehiclePaper; short?: boolean }) {
  const m = PAPER_STATE[paper.state] ?? PAPER_STATE.missing;
  return (
    <Chip hue={m.hue} icon={m.icon} className={short ? "!px-2 !py-0.5 !text-[11px]" : undefined}>
      {short ? (SHORT[paper.kind] ?? paper.label) : paper.label}
      <span className="sr-only">: {m.label.toLowerCase()}</span>
      {!short && paper.expiresOn && <span className="font-normal opacity-80"> · {day(paper.expiresOn)}</span>}
    </Chip>
  );
}

/** Where a paper is renewed: its open compliance item, if one is raised. */
export function renewHref(paper: VehiclePaper): string | null {
  return paper.occurrenceId ? `/suite/operations/compliance/${paper.occurrenceId}` : null;
}

export function RenewLink({ paper }: { paper: VehiclePaper }) {
  const href = renewHref(paper);
  if (!href) return <span className="text-xs text-neutral-500">No renewal raised yet</span>;
  return (
    <Link href={href} aria-label={`${paper.state === "missing" ? "Add" : "Renew"} ${paper.label}`} className="inline-flex h-9 items-center rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
      {paper.state === "missing" ? "Add it" : "Renew"}
    </Link>
  );
}

/**
 * Km per litre by month as columns, the expected figure as a dashed line
 * and the flag line (75% of it) dotted beneath. A month under the flag line
 * is red and labelled "Low"; a month with no fuel or no trips is hatched.
 */
export function EfficiencyColumns({ months, expected, caption, height = 140, compact = false }: { months: EfficiencyMonth[]; expected: number | null; caption: string; height?: number; compact?: boolean }) {
  const values = months.map((m) => m.kmPerLitre ?? 0);
  const top = Math.max(1, ...(expected ? [expected * 1.25] : []), ...values) * 1.08;
  const y = (v: number) => (100 * v) / top;
  return (
    <figure>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-1.5" aria-hidden>
          {months.map((m) => (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {m.kmPerLitre === null ? (
                <span className="ws-hatch block h-full rounded-md" />
              ) : (
                <span className={cx("relative block rounded-md", m.flag ? "bg-rose-500" : "bg-sky-500")} style={{ height: `${Math.max(2, y(m.kmPerLitre))}%` }}>
                  {!compact && <span className={cx("absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums", m.flag ? "text-rose-700" : "text-neutral-600")}>{m.flag ? "Low" : m.kmPerLitre}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
        {expected !== null && (
          <>
            <span className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-neutral-700" style={{ bottom: `${y(expected)}%` }} aria-hidden />
            <span className="pointer-events-none absolute inset-x-0 border-t border-dotted border-rose-500" style={{ bottom: `${y(expected * 0.75)}%` }} aria-hidden />
          </>
        )}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] font-medium text-neutral-500" aria-hidden>
        {months.map((m) => (
          <span key={m.month} className="min-w-0 flex-1 truncate text-center">
            {monthLabel(m.month, true).split(" ")[0]}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Km</th>
            <th scope="col">Litres</th>
            <th scope="col">Km per litre</th>
            <th scope="col">Below expected</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthLabel(m.month)}</th>
              <td>{m.km}</td>
              <td>{m.litres}</td>
              <td>{m.kmPerLitre ?? "no data"}</td>
              <td>{m.flag ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function EfficiencyLegend({ expected }: { expected: number | null }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded bg-sky-500" aria-hidden />
        Km per litre
      </span>
      {expected !== null && (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-neutral-700" aria-hidden />
          Expected {expected}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded bg-rose-500" aria-hidden />
        Low: under 75% of expected
      </span>
    </div>
  );
}
