"use client";

import { Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import type { StockItem } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { LEVEL_META, countStatus, levelOf, requisitionStatus, myRequisitionStatus } from "./meta";

/**
 * The stock level gauge: on hand against a scale of twice the reorder level,
 * with the reorder level as a tick in the middle and the rest hatched. The
 * words beside it say the state, so colour is never the only signal.
 */
export function LevelGauge({ item, showLabel = false, className }: { item: Pick<StockItem, "onHand" | "reorderLevel" | "critical" | "belowReorder" | "unit">; showLabel?: boolean; className?: string }) {
  const { state, pct, tickPct } = levelOf(item);
  const meta = LEVEL_META[state];
  const label = `${qty(item.onHand)} ${item.unit} on hand${item.reorderLevel > 0 ? `, reorder at ${qty(item.reorderLevel)}` : ""}: ${meta.label}`;
  return (
    <div className={cx("min-w-[96px]", className)}>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label} className="relative">
        <div className="ws-hatch h-2 overflow-hidden rounded-full">
          <div className={cx("h-full rounded-full transition-[width] duration-500", HUE[meta.hue].bar)} style={{ width: `${pct}%` }} />
        </div>
        {tickPct > 0 && <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-full bg-neutral-700" style={{ left: `calc(${tickPct}% - 1px)` }} />}
      </div>
      {showLabel && <p className={cx("mt-1 text-[11px] font-semibold", HUE[meta.hue].text)}>{meta.label}</p>}
    </div>
  );
}

export function RequisitionStatusChip({ status, mine = false }: { status: string; mine?: boolean }) {
  const s = mine ? myRequisitionStatus(status) : requisitionStatus(status);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

export function CountStatusChip({ status }: { status: string }) {
  const s = countStatus(status);
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** A quantity and its unit, tabular. */
export function Qty({ value, unit, className }: { value: number | null | undefined; unit?: string | null; className?: string }) {
  return (
    <span className={cx("tabular-nums", className)}>
      {qty(value)}
      {unit ? <span className="ml-1 text-neutral-500">{unit}</span> : null}
    </span>
  );
}

/** A signed quantity: +2, −1.5, 0. */
export function signedQty(n: number): string {
  if (n > 0) return `+${qty(n)}`;
  if (n < 0) return `−${qty(Math.abs(n))}`;
  return "0";
}

/** `yyyy-mm-dd` of an ISO timestamp, in local time. */
export function ymdOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
