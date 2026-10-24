"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Hourglass, RefreshCcw, Repeat, SlidersHorizontal, Wrench } from "lucide-react";
import { Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact } from "@/suite/finance/lib/format";
import { maintenance, opsError, type AssetCostRow, type CostReport } from "@/lib/api/operations-maintenance-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { maintenanceTabs } from "./parts";

/** Past the threshold? The same rule as the API, so the slider answers at once. */
export function overThreshold(row: Pick<AssetCostRow, "cost" | "last12Cost">, threshold: number): boolean {
  return (row.cost ?? 0) > 0 && row.last12Cost * 100 > (row.cost as number) * threshold;
}

/**
 * Maintenance cost per asset: the past year's repairs against what the
 * asset cost to buy, with a line at the replacement threshold the slider
 * sets; and where the downtime went.
 */
export default function MaintenanceReports() {
  const uid = useId();
  const [report, setReport] = useState<CostReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [threshold, setThreshold] = useState(50);

  useEffect(() => {
    let alive = true;
    maintenance.reports().then(
      (r) => {
        if (!alive) return;
        setReport(r);
        setThreshold(r.threshold);
        setError(null);
      },
      (e: unknown) => alive && setError(`The report didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const rows = useMemo(() => (report?.assets ?? []).map((r) => ({ ...r, replace: overThreshold(r, threshold) })), [report, threshold]);

  if (error && !report) {
    return (
      <div>
        <PageHeader title="Maintenance" tabs={maintenanceTabs()} activeTab="reports" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!report) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the report…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const year = rows.reduce((s, r) => s + r.last12Cost, 0);
  const downtime = rows.reduce((s, r) => s + r.downtimeHours, 0);
  const flagged = rows.filter((r) => r.replace);
  const top = [...rows].sort((a, b) => b.last12Cost - a.last12Cost).slice(0, 10);
  const byDowntime = [...rows].filter((r) => r.downtimeHours > 0).sort((a, b) => b.downtimeHours - a.downtimeHours).slice(0, 8);

  const columns: Column<AssetCostRow>[] = [
    {
      key: "asset",
      header: "Asset",
      primary: true,
      sortable: true,
      value: (r) => `${r.tagNo ?? ""} ${r.name ?? ""}`,
      render: (r) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-semibold text-neutral-900">{r.name ?? "-"}</span>
          <AssetTag tagNo={r.tagNo} size="sm" />
        </span>
      ),
    },
    { key: "category", header: "Category", hideOnMobile: true, value: (r) => r.category ?? "", render: (r) => <span className="text-sm text-neutral-700">{r.category ?? "-"}</span> },
    { key: "orders", header: "Work orders", sortable: true, align: "right", value: (r) => r.workOrders, render: (r) => <span className="tabular-nums">{r.workOrders}</span> },
    { key: "year", header: "Past year", sortable: true, align: "right", value: (r) => r.last12Cost, render: (r) => <Money value={r.last12Cost} className="text-sm font-semibold" /> },
    { key: "life", header: "Lifetime", sortable: true, align: "right", hideOnMobile: true, value: (r) => r.lifetimeCost, render: (r) => <Money value={r.lifetimeCost} className="text-sm" /> },
    { key: "pct", header: "Of its cost", sortable: true, align: "right", value: (r) => r.pctOfCost ?? -1, render: (r) => <span className={cx("tabular-nums", r.replace ? "font-semibold text-rose-700" : "text-neutral-700")}>{r.pctOfCost === null ? "-" : `${r.pctOfCost}%`}</span> },
    { key: "down", header: "Downtime", sortable: true, align: "right", hideOnMobile: true, value: (r) => r.downtimeHours, render: (r) => <span className="tabular-nums text-neutral-700">{r.downtimeHours} h</span> },
    {
      key: "replace",
      header: "Verdict",
      value: (r) => (r.replace ? 1 : 0),
      render: (r) =>
        r.replace ? (
          <Chip hue="rose" icon={RefreshCcw}>
            Consider replacing
          </Chip>
        ) : (
          <Chip hue="mint" dot>
            Keep repairing
          </Chip>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="What each asset has cost to keep running, and when it is cheaper to replace it." tabs={maintenanceTabs()} activeTab="reports" />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Maintenance, past year" value={compact(year)} icon={Banknote} hint={`${rows.length} assets worked on`} />
          <StatCard label="To consider replacing" value={flagged.length} icon={Repeat} hue={flagged.length ? "rose" : "mint"} hint={`Repairs over ${threshold}% of the purchase cost`} />
          <StatCard label="Downtime" value={downtime} unit="hours" icon={Hourglass} hue="sun" hint="Out of service for repairs, all time" />
          <StatCard label="Work orders" value={rows.reduce((s, r) => s + r.workOrders, 0)} icon={Wrench} hue="sky" hint="On assets, not cancelled" />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className={byDowntime.length > 0 ? "xl:col-span-2" : "xl:col-span-3"}
            title="Repairs against purchase cost"
            subtitle="The past year's maintenance per asset; the line marks the replacement threshold"
            icon={SlidersHorizontal}
            hue="coral"
            actions={
              <div className="flex items-center gap-3">
                <label htmlFor={`${uid}-th`} className="text-xs font-medium text-neutral-600">
                  Threshold
                </label>
                <input
                  id={`${uid}-th`}
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="h-2 w-32 cursor-pointer accent-rose-600"
                  aria-valuetext={`${threshold}% of the purchase cost`}
                />
                <span className="w-12 text-right text-sm font-bold tabular-nums text-neutral-900">{threshold}%</span>
              </div>
            }
          >
            {top.length === 0 ? (
              <Empty icon={SlidersHorizontal} hue="coral" title="No maintenance on any asset yet" hint="Each asset's repairs show here against what it cost." />
            ) : (
              <CostBars rows={top} threshold={threshold} />
            )}
          </Panel>

          {byDowntime.length > 0 && (
            <Panel title="Where the downtime went" subtitle="Hours out of service for repairs, by asset" icon={Hourglass} hue="sun">
              <StatusBars
                data={byDowntime.map((r) => ({ label: `${r.tagNo ?? ""} ${r.name ?? ""}`.trim(), value: r.downtimeHours, hue: hueFor(r.category ?? r.name ?? ""), note: `${r.workOrders} ${r.workOrders === 1 ? "work order" : "work orders"}` }))}
                format={(v) => `${v} h`}
                caption="Downtime hours by asset"
              />
            </Panel>
          )}
        </div>

        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => r.assetId}
          rowHref={(r) => `/suite/operations/assets/${r.assetId}`}
          storageKey="ops-maintenance-report"
          views={["table", "list"]}
          searchPlaceholder="Search assets"
          caption="Maintenance cost per asset"
          empty={<Empty icon={Wrench} hue="sky" title="No asset has had maintenance yet" />}
        />
      </div>
    </div>
  );
}

/**
 * One bar per asset: the past year's repairs as a share of what it cost
 * to buy, on one scale, with the threshold as a dashed line through all of
 * them. Past the line is red and says so.
 */
function CostBars({ rows, threshold }: { rows: (AssetCostRow & { replace: boolean })[]; threshold: number }) {
  const scale = Math.max(threshold * 1.25, 100, ...rows.map((r) => r.pctOfCost ?? 0));
  const at = (pct: number) => Math.min(100, (100 * pct) / scale);
  return (
    <figure>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = r.pctOfCost ?? 0;
          return (
            <li key={r.assetId} className="grid gap-1.5 sm:grid-cols-[13rem_minmax(0,1fr)_7rem] sm:items-center sm:gap-4">
              <Link href={`/suite/operations/assets/${r.assetId}`} className="min-w-0 rounded-xl outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                <span className="block truncate text-sm font-semibold text-neutral-900">{r.name ?? r.tagNo}</span>
                <span className="block truncate font-mono text-[11px] text-neutral-500">{r.tagNo}</span>
              </Link>
              <div
                role="img"
                aria-label={`${r.name ?? r.tagNo}: ${(r.last12Cost / 100).toLocaleString("en-NG")} naira in the past year${r.pctOfCost !== null ? `, ${r.pctOfCost}% of its cost` : ", purchase cost unknown"}${r.replace ? ", past the threshold" : ""}`}
                className="relative h-7 rounded-xl bg-neutral-50"
              >
                {r.cost ? (
                  <span className={cx("absolute inset-y-1 left-0 rounded-md", r.replace ? "bg-rose-500" : "bg-sky-500")} style={{ width: `${Math.max(1, at(pct))}%` }} />
                ) : (
                  <span className="ws-hatch absolute inset-0 flex items-center rounded-xl px-3 text-xs text-neutral-600">Purchase cost not recorded</span>
                )}
                <span className="absolute -inset-y-1 border-l-2 border-dashed border-rose-600" style={{ left: `${at(threshold)}%` }} aria-hidden />
              </div>
              <span className="flex items-center justify-between gap-2 text-right text-xs sm:block">
                <Money value={r.last12Cost} className="block text-sm font-semibold text-neutral-900" />
                <span className={cx("block tabular-nums", r.replace ? "font-semibold text-rose-700" : "text-neutral-500")}>{r.pctOfCost === null ? "-" : `${r.pctOfCost}% of cost`}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l-2 border-dashed border-rose-600" aria-hidden />
          Replace at {threshold}% of the purchase cost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-rose-500" aria-hidden />
          Past it
        </span>
      </figcaption>
    </figure>
  );
}
