"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { hueHex } from "@/components/workspace/charts";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import type { Hue } from "@/components/workspace/modules";
import { amount, compact } from "@/suite/finance/lib/format";
import { facilities, type OpsPickers } from "@/lib/api/operations-facilities-client";
import { litres } from "./labels";

/* ------------------------------ pickers ------------------------------ */

let pickerCache: Promise<OpsPickers> | null = null;

export interface PickerOptions {
  staff: SelectOption[] | null;
  vendors: SelectOption[] | null;
  projects: SelectOption[] | null;
  costCentres: SelectOption[] | null;
  failed: boolean;
}

/** Staff, vendors, projects and cost centres for the pickers, loaded once per page visit. Null while loading. */
export function useOpsPickers(): PickerOptions {
  const [data, setData] = useState<OpsPickers | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    pickerCache ??= facilities.options();
    pickerCache.then(
      (o) => alive && setData(o),
      () => {
        pickerCache = null;
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return {
    staff: data ? (data.staff ?? []).map((p) => ({ value: p.id, label: p.name })) : null,
    vendors: data ? (data.vendors ?? []).map((v) => ({ value: v.id, label: v.name })) : null,
    projects: data ? (data.projects ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code ?? undefined })) : null,
    costCentres: data ? (data.costCentres ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code })) : null,
    failed,
  };
}

/** For tests: forget the cached options. */
export function resetOpsPickers() {
  pickerCache = null;
}

/* ------------------------------- money ------------------------------- */

/** Naira from kobo, tabular; `compact` for dense cards. */
export function Naira({ kobo, short = false, className }: { kobo: number | null | undefined; short?: boolean; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{short ? compact(kobo) : amount(kobo)}</span>;
}

/** A Finance memo's state, in words. */
export function MemoChip({ status }: { status: string | null | undefined }) {
  if (!status) return <Chip hue="slate">Not raised yet</Chip>;
  const s = status.toLowerCase();
  const hue: Hue = s === "paid" ? "mint" : s.includes("partial") ? "sky" : s === "rejected" || s === "cancelled" ? "rose" : s === "approved" ? "blue" : "sun";
  return (
    <Chip hue={hue} dot>
      {s === "paid" ? "Paid" : s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
    </Chip>
  );
}

/* ----------------------------- tank gauge ---------------------------- */

/**
 * The diesel tank as a drum filled to its level. The tank's size is not on
 * record, so the drum is drawn against `scale` (the fullest the log has seen,
 * or the fullest site) and says so; the hatched top is what is not there.
 */
/**
 * The tank, drawn against its capacity when the site has one; otherwise
 * against `scale` (the fullest it has been), and the caption says so.
 */
export function TankGauge({ level, scale, capacity = null, label, size = "md" }: { level: number; scale: number; capacity?: number | null; label: string; size?: "sm" | "md" }) {
  if (capacity) scale = capacity;
  const pct = scale > 0 ? Math.max(0, Math.min(100, (level / scale) * 100)) : 0;
  const low = pct < 20;
  const h = size === "sm" ? 56 : 132;
  const w = size === "sm" ? 34 : 76;
  return (
    <div className="flex items-end gap-3">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={Math.round(level)}
        aria-valuetext={litres(level)}
        className="ws-hatch relative overflow-hidden rounded-[10px] ring-1 ring-neutral-200"
        style={{ height: h, width: w }}
      >
        <span
          className="absolute inset-x-0 bottom-0 transition-[height] duration-700"
          style={{ height: `${pct}%`, background: `linear-gradient(180deg, ${hueHex(low ? "rose" : "coral")}cc, ${hueHex(low ? "rose" : "coral")})` }}
        />
        {/* Quarter marks, like the strip on a real tank. */}
        {[25, 50, 75].map((m) => (
          <span key={m} className="absolute inset-x-0 border-t border-dashed border-white/70" style={{ bottom: `${m}%` }} aria-hidden />
        ))}
      </div>
      {size === "md" && (
        <div className="pb-0.5">
          <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{litres(level)}</p>
          <p className={cx("mt-1 text-xs", low ? "font-semibold text-rose-700" : "text-neutral-500")}>{low ? "Running low. " : ""}{capacity ? `${Math.round(pct)}% of ${litres(capacity)}` : `${Math.round(pct)}% of the fullest it has been`}</p>
          {!capacity && <p className="mt-0.5 text-xs text-neutral-500">Set the tank size on the site to read it true.</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- stars ------------------------------- */

/** A rating out of five, read-only. */
export function Stars({ value, size = 14 }: { value: number | null | undefined; size?: number }) {
  if (value === null || value === undefined) return <span className="text-xs text-neutral-500">Not rated</span>;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden className={n <= Math.round(value) ? "fill-sun-400 text-sun-500" : "fill-neutral-100 text-neutral-300"} />
      ))}
    </span>
  );
}

/** Pick a rating: five radio stars, each a 44px target. */
export function StarPicker({ value, onChange, label }: { value: number | null; onChange: (n: number | null) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(value === n ? null : n)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl outline-none transition hover:bg-sun-50 focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <Star size={24} aria-hidden className={cx("transition", on ? "fill-sun-400 text-sun-500" : "fill-white text-neutral-300")} />
          </button>
        );
      })}
    </div>
  );
}

/** A chip-row filter, as the desks use: one choice, counts beside. */
export function ChipFilter<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key || "all"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            className={cx(
              "h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
              on ? "bg-primary-600 text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cx("ml-1.5 tabular-nums", on ? "text-white/80" : "text-neutral-500")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
