"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange, Flame, PackageOpen, Siren, TrendingUp, Wallet } from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { ColumnChart, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { opsError } from "@/lib/api/operations-procurement-client";
import { stores, type Consumption, type ConsumptionItem } from "@/lib/api/operations-stores-client";
import { qty, today } from "@/suite/operations/components/procurement/meta";

/**
 * What the stores issued: value by month, the items that cost the most, and
 * the ones drawn at more than twice their usual monthly rate (the API
 * compares the period against the six months before it).
 */

type Span = "3" | "6" | "12";

/** The first day of the month `months - 1` months before today. */
export function spanStart(months: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Every month from `from` to `to` (YYYY-MM-DD), filled with the API's values or 0. */
export function monthSeries(byMonth: Consumption["byMonth"], from: string, to: string): { month: string; value: number }[] {
  const have = new Map(byMonth.map((m) => [m.month, m.value]));
  const out: { month: string; value: number }[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let guard = 0; guard < 36; guard++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month: key, value: have.get(key) ?? 0 });
    if (key >= end) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export default function ConsumptionReport() {
  const [span, setSpan] = useState<Span>("6");
  const [data, setData] = useState<Consumption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    stores.consumption({ from: spanStart(Number(span)), to: today() }).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`Consumption didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [span, reload]);

  const months = useMemo(() => (data ? monthSeries(data.byMonth, data.from, data.to) : []), [data]);
  const flaggedIds = useMemo(() => new Set((data?.flagged ?? []).map((f) => f.itemId)), [data]);

  const header = (
    <>
      <BackLink href="/suite/operations/stores" label="Stock" />
      <PageHeader
        eyebrow="Stores"
        title="Consumption"
        subtitle="What the stores issued, what it cost, and anything drawn faster than usual."
        actions={
          <Segmented
            label="Period"
            value={span}
            onChange={(v) => {
              setData(null);
              setSpan(v);
            }}
            options={[
              { key: "3", label: "3 months" },
              { key: "6", label: "6 months" },
              { key: "12", label: "12 months" },
            ]}
          />
        }
      />
    </>
  );

  if (error && !data)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading consumption…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const total = data.byItem.reduce((s, i) => s + i.value, 0);
  const avg = months.length ? Math.round(total / months.length) : 0;
  const peak = months.reduce<{ month: string; value: number } | null>((p, m) => (!p || m.value > p.value ? m : p), null);
  const top = data.byItem.slice(0, 8);

  const columns: Column<ConsumptionItem>[] = [
    {
      key: "name",
      header: "Item",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-neutral-900">{r.name}</span>
          {flaggedIds.has(r.itemId) && (
            <Chip hue="rose" icon={Flame} className="!px-2 !py-0.5 text-[11px]">
              Abnormal
            </Chip>
          )}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Issued",
      align: "right",
      sortable: true,
      value: (r) => r.quantity,
      render: (r) => (
        <span className="tabular-nums">
          {qty(r.quantity)} <span className="text-neutral-500">{r.unit}</span>
        </span>
      ),
    },
    { key: "perMonth", header: "A month", align: "right", sortable: true, hideOnMobile: true, value: (r) => r.quantity / Math.max(1, months.length), render: (r) => <span className="tabular-nums text-neutral-600">{qty(r.quantity / Math.max(1, months.length))}</span> },
    { key: "value", header: "Value", align: "right", sortable: true, value: (r) => r.value, render: (r) => <Money value={r.value} className="font-semibold tabular-nums text-neutral-900" /> },
    { key: "share", header: "Share", align: "right", sortable: true, hideOnMobile: true, value: (r) => (total ? r.value / total : 0), render: (r) => <span className="tabular-nums text-neutral-600">{total ? `${Math.round((r.value / total) * 100)}%` : "-"}</span> },
  ];

  return (
    <div>
      {header}
      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Issued" value={compact(total)} icon={Wallet} hint={`${day(data.from)} to ${day(data.to)}`} />
          <StatCard label="A month on average" value={compact(avg)} icon={CalendarRange} hue="sky" hint={`Over ${months.length} ${months.length === 1 ? "month" : "months"}`} />
          <StatCard label="Busiest month" value={peak && peak.value > 0 ? monthLabel(peak.month, true) : "-"} icon={TrendingUp} hue="grape" hint={peak && peak.value > 0 ? compact(peak.value) : "Nothing issued yet"} />
          <StatCard label="Drawn abnormally" value={data.flagged.length} icon={Siren} hue={data.flagged.length ? "rose" : "mint"} hint={data.flagged.length ? "More than twice their usual rate" : "Nothing unusual"} />
        </StatGrid>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Issued by month" subtitle="Value of everything issued from the stores, at average cost" icon={BarChart3}>
            <ColumnChart data={months.map((m) => ({ label: monthLabel(m.month, true), value: m.value }))} format={(v) => compact(v)} caption="Value issued from the stores by month" height={240} />
          </Panel>
          <Panel title="Top items" subtitle="By value issued" icon={PackageOpen} hue="coral">
            {top.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-500">Nothing issued in this period.</p>
            ) : (
              <StatusBars
                data={top.map((t) => ({ label: t.name, value: t.value, hue: flaggedIds.has(t.itemId) ? "rose" : hueFor(t.itemId), note: `${qty(t.quantity)} ${t.unit}` }))}
                format={(v) => compact(v)}
                caption="Top items by value issued"
              />
            )}
          </Panel>
        </div>

        <Panel title="Drawn faster than usual" subtitle="Items issued at more than twice their monthly average of the six months before the period" icon={Flame} hue="rose">
          {data.flagged.length === 0 ? (
            <Empty icon={Flame} title="Nothing unusual" hint="Items drawn at more than twice their usual monthly rate show here, so a leak or a hoard is caught early." hue="mint" />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {data.flagged.map((f) => {
                const perMonth = f.quantity / Math.max(1, months.length);
                const times = f.average > 0 ? perMonth / f.average : 0;
                return (
                  <li key={f.itemId} className="rounded-2xl border border-rose-500/20 bg-rose-50/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-neutral-900">{f.name}</p>
                      <Chip hue="rose">{times ? `${times.toFixed(1)}× usual` : "Above usual"}</Chip>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-neutral-500">Now, a month</dt>
                        <dd className="font-semibold tabular-nums text-neutral-900">
                          {qty(perMonth)} {f.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Usual, a month</dt>
                        <dd className="font-semibold tabular-nums text-neutral-900">
                          {qty(f.average)} {f.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Value</dt>
                        <dd className="font-semibold tabular-nums text-neutral-900">{compact(f.value)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 ws-hatch h-2 overflow-hidden rounded-full" aria-hidden>
                      <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, times ? (1 / times) * 100 : 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">The bar is the usual rate against this period&apos;s.</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <section aria-labelledby="consumption-items">
          <h2 id="consumption-items" className="mb-3 text-[15px] font-semibold text-neutral-900">
            Every item issued
          </h2>
          {data.byItem.length === 0 ? (
            <Card>
              <Empty icon={PackageOpen} title="Nothing issued in this period" hint="Issues against requisitions show here, valued at each item's average cost." />
            </Card>
          ) : (
            <DataView rows={data.byItem} columns={columns} rowKey={(r) => r.itemId} views={["table", "list"]} storageKey="operations.stores.consumption" caption="Items issued in the period" searchPlaceholder="Search items" />
          )}
        </section>
      </div>
    </div>
  );
}
