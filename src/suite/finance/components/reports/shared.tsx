"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Download, Filter, Printer, TriangleAlert, X } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { inputClass } from "@/suite/lms/components/ui/ws";
import { errorText, type ReportFilters } from "@/lib/api/finance-ledger-client";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import { DIMENSIONS, DimensionSelect, type Dimension } from "../journals/dimensions";

/* What every report page shares: its filters (kept in the URL, so a report can be linked), loading, CSV and print. */

/* ------------------------------ loading ----------------------------- */

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Runs `fetcher` whenever `key` changes; the last answer wins, the previous one stays on screen meanwhile. */
export function useLoad<T>(fetcher: () => Promise<T>, key: string, fallback = "This report didn't load."): Loadable<T> {
  const [tick, setTick] = useState(0);
  const run = `${key}#${tick}`;
  const [res, setRes] = useState<{ run: string; data: T | null; error: string | null }>({ run: "", data: null, error: null });
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((data) => alive && setRes({ run, data, error: null }))
      .catch((e: unknown) => alive && setRes((s) => ({ run, data: s.data, error: errorText(e) || fallback })));
    return () => {
      alive = false;
    };
    // `key` stands for everything the fetcher reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: res.data, error: res.error, loading: res.run !== run, reload };
}

/* ------------------------------ filters ----------------------------- */

const FILTER_KEYS = ["from", "to", "asAt", "projectId", "costCentreId", "counterpartyId", "unitId"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type FilterState = Partial<Record<FilterKey, string>>;

/** Report filters, read from and written back to the address bar. */
export function useReportFilters(): [FilterState, (patch: FilterState) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => {
    const out: FilterState = {};
    for (const k of FILTER_KEYS) {
      const v = params?.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [params]);
  const update = useCallback(
    (patch: FilterState) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : (pathname ?? ""), { scroll: false });
    },
    [params, router, pathname],
  );
  return [filters, update];
}

export const reportQuery = (f: FilterState): ReportFilters => ({
  from: f.from,
  to: f.to,
  projectId: f.projectId,
  costCentreId: f.costCentreId,
  counterpartyId: f.counterpartyId,
  unitId: f.unitId,
});

export const filterKey = (f: FilterState) => FILTER_KEYS.map((k) => f[k] ?? "").join("|");

/** "1 Jan 2026 to 5 Oct 2026", or the financial year to date when no dates are set. */
export function rangeText(from?: string, to?: string): string {
  if (!from && !to) return "Financial year to date";
  return `${from ? day(from) : "Start of the financial year"} to ${to ? day(to) : "today"}`;
}

/**
 * The strip above a report: dates (or one as-at date), dimension filters
 * behind a toggle, and print / download.
 */
export function ReportToolbar({
  filters,
  onChange,
  mode = "range",
  dimensions = true,
  onDownload,
  children,
}: {
  filters: FilterState;
  onChange: (patch: FilterState) => void;
  mode?: "range" | "asAt";
  dimensions?: boolean;
  onDownload?: () => void;
  children?: React.ReactNode;
}) {
  const uid = useId();
  const active = DIMENSIONS.filter((d) => d.key !== "personId" && filters[d.key as FilterKey]);
  const [open, setOpen] = useState(active.length > 0);
  return (
    <div className="ws-card mb-6 p-4 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        {mode === "range" ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-600">From</span>
              <input type="date" className={cx(inputClass, "h-10 w-[11rem]")} value={filters.from ?? ""} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-600">To</span>
              <input type="date" className={cx(inputClass, "h-10 w-[11rem]")} value={filters.to ?? ""} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">As at</span>
            <input type="date" className={cx(inputClass, "h-10 w-[11rem]")} value={filters.asAt ?? ""} onChange={(e) => onChange({ asAt: e.target.value })} />
          </label>
        )}
        {(filters.from || filters.to || filters.asAt) && (
          <Button size="sm" variant="ghost" icon={X} onClick={() => onChange({ from: "", to: "", asAt: "" })}>
            {mode === "range" ? "Financial year to date" : "Today"}
          </Button>
        )}
        {children}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dimensions && (
            <Button size="sm" icon={Filter} aria-expanded={open} aria-controls={`${uid}-dims`} onClick={() => setOpen((o) => !o)}>
              Filters{active.length > 0 ? ` · ${active.length}` : ""}
            </Button>
          )}
          {onDownload && (
            <Button size="sm" icon={Download} onClick={onDownload}>
              Download CSV
            </Button>
          )}
          <Button size="sm" icon={Printer} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      {dimensions && open && (
        <div id={`${uid}-dims`} className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIMENSIONS.filter((d) => d.key !== "personId").map((d) => (
            <div key={d.key}>
              <label htmlFor={`${uid}-${d.key}`} className="mb-1.5 block text-xs font-medium text-neutral-600">
                {d.label}
              </label>
              <DimensionSelect
                kind={d.key as Dimension}
                id={`${uid}-${d.key}`}
                size="sm"
                value={filters[d.key as FilterKey] ?? ""}
                onChange={(v) => onChange({ [d.key]: v })}
                placeholder={`Any ${d.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ figures ----------------------------- */

export const num = "text-right tabular-nums whitespace-nowrap";

/** Balanced / out-of-balance, in words and an icon - never colour alone. */
export function BalancedChip({ balanced, difference, currency }: { balanced: boolean; difference?: number; currency?: string }) {
  return balanced ? (
    <Chip hue="mint" icon={CheckCircle2}>
      Balanced
    </Chip>
  ) : (
    <Chip hue="rose" icon={TriangleAlert}>
      {difference ? `Out by ${amount(Math.abs(difference), currency)}` : "Does not balance"}
    </Chip>
  );
}

/** A statement line: label on the left, a figure in brackets-for-negative on the right. */
export function FigureRow({
  label,
  value,
  strong,
  indent = 0,
  href,
  border,
  muted,
}: {
  label: React.ReactNode;
  value: number | null;
  strong?: boolean;
  indent?: 0 | 1 | 2;
  href?: string;
  border?: "top" | "double";
  muted?: boolean;
}) {
  return (
    <tr className={cx(strong && "font-semibold text-neutral-900", muted && "text-neutral-500")}>
      <th scope="row" className={cx("py-2 pr-4 text-left font-[inherit]", indent === 1 && "pl-4", indent === 2 && "pl-8")}>
        {href ? (
          <Link href={href} className="rounded outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
            {label}
          </Link>
        ) : (
          label
        )}
      </th>
      <td
        className={cx(
          num,
          "py-2",
          border === "top" && "border-t border-neutral-300",
          border === "double" && "border-b-[3px] border-t border-double border-neutral-400",
        )}
      >
        {value === null ? "" : accounting(value, true)}
      </td>
    </tr>
  );
}

/* -------------------------------- CSV ------------------------------- */

/* Lifted to the workspace kit so every register shares it; re-exported so report pages keep their import. */
export { toCsv, csvAmount, downloadCsv } from "@/components/workspace/csv";
