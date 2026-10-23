"use client";

import { useEffect, useState } from "react";
import { Building2, Timer } from "lucide-react";
import { Chip, cx, type PageTab } from "@/components/workspace/kit";
import { hueHex } from "@/components/workspace/charts";
import type { SelectOption } from "@/components/workspace/SearchableSelect";
import { maintenance } from "@/lib/api/operations-maintenance-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { slaClock, workOrderStatus } from "./labels";

/* Pieces every maintenance screen shares: the tabs, the status and SLA chips, the SLA dial and the pickers. */

/** The maintenance desk's sections; the sidebar links only to the first. */
export function maintenanceTabs(): PageTab[] {
  return [
    { key: "orders", label: "Work orders", href: "/suite/operations/maintenance" },
    { key: "plans", label: "Plans", href: "/suite/operations/maintenance/plans" },
    { key: "claims", label: "Insurance claims", href: "/suite/operations/maintenance/claims" },
    { key: "reports", label: "Reports", href: "/suite/operations/maintenance/reports" },
  ];
}

export function WorkOrderStatusChip({ status }: { status: string }) {
  const m = workOrderStatus(status);
  return (
    <Chip hue={m.hue} icon={m.icon}>
      {m.label}
    </Chip>
  );
}

type SlaSubject = { status: string; dueAt: string | null; createdAt?: string | null; completedAt?: string | null };

/** The SLA as a worded chip: time left, overdue by, met or missed. */
export function SlaChip({ w, now, className }: { w: SlaSubject; now?: number; className?: string }) {
  const c = slaClock(w, now);
  if (!w.dueAt) return null;
  return (
    <Chip hue={c.hue} icon={Timer} className={className}>
      {c.label}
    </Chip>
  );
}

/**
 * The SLA clock: a ring that fills as the window is used, red once it runs
 * out, with the time left (or overdue) written inside. The words carry the
 * meaning; the ring shows how much of the window is gone.
 */
export function SlaDial({ w, now, size = 92 }: { w: SlaSubject; now?: number; size?: number }) {
  const c = slaClock(w, now);
  const r = size / 2 - 7;
  const len = 2 * Math.PI * r;
  const used = c.used ?? 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`SLA: ${c.label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={8} className="text-neutral-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hueHex(c.hue)}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${len * used} ${len}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center leading-tight" aria-hidden>
        <Timer size={13} className="mb-0.5 text-neutral-400" />
        <span className={cx("text-[13px] font-bold tabular-nums", c.overdue ? "text-rose-700" : "text-neutral-900")}>{c.figure}</span>
        <span className="text-[10px] font-medium text-neutral-500">{c.note}</span>
      </span>
    </div>
  );
}

/** What the work is on: the asset's sticker, or the facility. */
export function WorkOrderSubject({ asset, facility, size = "sm" }: { asset: { tagNo: string | null; name: string | null } | null; facility: string | null; size?: "sm" | "md" }) {
  if (asset) {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <AssetTag tagNo={asset.tagNo} size={size} />
        {asset.name && <span className="truncate text-xs text-neutral-500">{asset.name}</span>}
      </span>
    );
  }
  if (facility) {
    return (
      <Chip hue="grape" icon={Building2}>
        {facility}
      </Chip>
    );
  }
  return <span className="text-xs text-neutral-500">—</span>;
}

/* ------------------------------ pickers ------------------------------ */

export interface MaintenancePickers {
  staff: SelectOption[] | null;
  vendors: SelectOption[] | null;
  assets: SelectOption[] | null;
  facilities: SelectOption[] | null;
}

let cache: Promise<MaintenancePickers> | null = null;

async function loadPickers(): Promise<MaintenancePickers> {
  const [opts, picks] = await Promise.all([maintenance.options().catch(() => null), maintenance.pickers().catch(() => null)]);
  return {
    staff: opts ? opts.staff.map((s) => ({ value: s.id, label: s.name })) : [],
    vendors: opts ? (opts.vendors ?? []).map((v) => ({ value: v.id, label: v.name })) : [],
    assets: picks
      ? picks.assets.map((a) => ({ value: a.id, label: a.name, hint: [a.tagNo, a.category].filter(Boolean).join(" · ") || undefined }))
      : [],
    facilities: picks ? picks.facilities.map((f) => ({ value: f.id, label: f.name })) : [],
  };
}

/** Staff, vendors, assets and sites for the maintenance forms, loaded once per page visit. Null while loading. */
export function useMaintenancePickers(): MaintenancePickers {
  const [data, setData] = useState<MaintenancePickers | null>(null);
  useEffect(() => {
    let alive = true;
    cache ??= loadPickers();
    cache.then(
      (d) => alive && setData(d),
      () => {
        cache = null;
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return data ?? { staff: null, vendors: null, assets: null, facilities: null };
}

/** For tests: forget the cached pickers. */
export function resetMaintenancePickers() {
  cache = null;
}
