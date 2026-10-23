"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Fuel, PlugZap, Receipt, Users } from "lucide-react";
import { Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { MultiLine, StackedColumns, type CategoryDatum } from "@/components/workspace/charts";
import { hueFor } from "@/components/workspace/modules";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { amount, compact, monthLabel } from "@/suite/finance/lib/format";
import { facilities, opsError, type FacilityReports as Reports, type GeneratorReport } from "@/lib/api/operations-facilities-client";
import { ChipFilter } from "./parts";
import { SPEND_KINDS, litres, monthAbbr } from "./labels";

/**
 * Twelve months of what the sites cost to run: utilities and diesel by kind,
 * the cost per head at each site, and each generator's litres per running
 * hour, with the months that burned well over its usual rate flagged.
 */
export default function FacilityReports() {
  const [data, setData] = useState<Reports | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [site, setSite] = useState("");

  useEffect(() => {
    let alive = true;
    facilities.reports().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The reports didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const view = useMemo(() => {
    if (!data) return null;
    const { months, facilities: sites } = data.spend;
    const chosen = sites.filter((f) => !site || f.facilityId === site);
    const byMonth: CategoryDatum[] = months.map((m) => {
      const values: Record<string, number> = {};
      for (const f of chosen) for (const [k, v] of Object.entries(f.months.find((x) => x.month === m)?.byKind ?? {})) values[k] = (values[k] ?? 0) + v;
      return { label: monthAbbr(m), values };
    });
    const totals: Record<string, number> = {};
    for (const d of byMonth) for (const [k, v] of Object.entries(d.values)) totals[k] = (totals[k] ?? 0) + v;
    const series = SPEND_KINDS.filter((k) => (totals[k.key] ?? 0) > 0).map((k) => ({ key: k.key, label: k.label, hue: k.hue }));
    const sum = Object.values(totals).reduce((s, v) => s + v, 0);
    const heads = chosen.reduce((s, f) => s + (f.headcount ?? 0), 0);
    return { months, sites, byMonth: series.length ? byMonth : [], series, totals, sum, heads };
  }, [data, site]);

  if (error && !data) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!data || !view) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the reports…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
        <Skeleton className="h-[260px]" />
      </div>
    );
  }

  const flagged = data.generators.reduce((s, g) => s + g.months.filter((m) => m.flag).length, 0);
  const dieselShare = view.sum ? Math.round(((view.totals.diesel ?? 0) / view.sum) * 100) : 0;
  const withHeads = view.sites.filter((f) => f.headcount);

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader title="Utilities and diesel" subtitle="Twelve months of running costs by site, the cost per head, and how hard each generator drinks." />

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Twelve months" value={compact(view.sum)} icon={Receipt} hint={site ? view.sites.find((f) => f.facilityId === site)?.name : "Every site"} />
          <StatCard label="Per head a month" value={view.heads ? amount(Math.round(view.sum / Math.max(1, view.months.length) / view.heads)) : "-"} icon={Users} hue="blue" hint={view.heads ? `${view.heads} people` : "Set headcounts on the sites"} />
          <StatCard label="Diesel's share" value={`${dieselShare}%`} icon={Fuel} hue="coral" hint={`${compact(view.totals.diesel ?? 0)} bought`} />
          <StatCard label="Generator months flagged" value={flagged} icon={AlertTriangle} hue={flagged ? "rose" : "mint"} hint={flagged ? "Over 130% of the usual litres an hour" : "Every generator in its usual range"} />
        </StatGrid>

        <Panel title="Spend by month" subtitle="Bills entered against each month, and the diesel bought in it." icon={BarChart3} hue="grape">
          {view.sites.length > 1 && (
            <div className="mb-4">
              <ChipFilter label="Which site" value={site} onChange={setSite} options={[{ key: "", label: "All sites" }, ...view.sites.map((f) => ({ key: f.facilityId, label: f.name }))]} />
            </div>
          )}
          <StackedColumns data={view.byMonth} series={view.series} format={(v) => compact(v)} caption="Utility and diesel spend by month and kind" showTotals height={260} />
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Cost per head" subtitle="Each site's month over its headcount." icon={Users} hue="blue">
            {withHeads.length === 0 ? (
              <Empty icon={Users} title="No headcounts" hint="Set a headcount on each site to compare cost per head." />
            ) : (
              <MultiLine
                labels={data.spend.months.map((m) => monthAbbr(m))}
                series={withHeads.map((f) => ({ key: f.facilityId, label: f.name, hue: hueFor(f.name), values: f.months.map((m) => m.perHead) }))}
                format={(v) => compact(v)}
                caption="Utility and diesel cost per head by site and month"
              />
            )}
          </Panel>

          <Panel title="By site and kind" subtitle="The twelve months, totalled." icon={Receipt} hue="sun" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Twelve-month spend by site and kind</caption>
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="px-5 py-3">
                      Site
                    </th>
                    {view.series.map((k) => (
                      <th key={k.key} scope="col" className="px-3 py-3 text-right">
                        {k.label}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.sites.map((f) => {
                    const t: Record<string, number> = {};
                    for (const m of f.months) for (const [k, v] of Object.entries(m.byKind)) t[k] = (t[k] ?? 0) + v;
                    const total = f.months.reduce((s, m) => s + m.total, 0);
                    return (
                      <tr key={f.facilityId} className="border-b border-neutral-50 last:border-0">
                        <th scope="row" className="px-5 py-3 text-left font-semibold text-neutral-900">
                          {f.name}
                          {f.headcount ? <span className="block text-xs font-normal text-neutral-500">{f.headcount} people</span> : null}
                        </th>
                        {view.series.map((k) => (
                          <td key={k.key} className="px-3 py-3 text-right tabular-nums text-neutral-700">
                            {t[k.key] ? compact(t[k.key]) : "-"}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-neutral-900">{compact(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel title="Generators: litres per running hour" subtitle="A month over 130% of the generator's other months is flagged: a leak, theft, or a fault to look at." icon={PlugZap} hue="coral">
          {data.generators.length === 0 ? (
            <Empty icon={PlugZap} hue="coral" title="No generator readings yet" hint="Record diesel used with the hour meter's reading to see litres per hour." />
          ) : (
            <ul className="space-y-6">
              {data.generators.map((g) => (
                <li key={g.assetId}>
                  <GeneratorRow g={g} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function GeneratorRow({ g }: { g: GeneratorReport }) {
  const top = Math.max(0.01, ...g.months.map((m) => m.perHour ?? 0));
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          {g.name ?? "Generator"} <span className="ml-1 rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-neutral-600">{g.tagNo}</span>
        </span>
        <span className="text-xs text-neutral-500">
          Usually <span className="font-semibold tabular-nums text-neutral-900">{g.averagePerHour ?? "-"} L/h</span>
        </span>
      </figcaption>
      <div className="flex h-36 items-end gap-2" aria-hidden>
        {g.months.map((m) => {
          const h = m.perHour ? (m.perHour / top) * 100 : 0;
          return (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={cx("text-[10px] font-semibold tabular-nums", m.flag ? "text-rose-700" : "text-neutral-500")}>{m.perHour ?? "-"}</span>
              <div className="ws-hatch relative w-full max-w-12 flex-1 overflow-hidden rounded-lg">
                <span className={cx("absolute inset-x-0 bottom-0 rounded-lg", m.flag ? "bg-rose-500" : "bg-coral-400")} style={{ height: `${h}%` }} />
                {m.flag && <AlertTriangle size={12} className="absolute left-1/2 top-1 -translate-x-1/2 text-rose-700" />}
              </div>
              <span className="text-[10px] font-medium text-neutral-500">{monthAbbr(m.month)}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{`${g.name ?? "Generator"} ${g.tagNo ?? ""}: litres, running hours and litres per hour by month`}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Litres</th>
            <th scope="col">Hours</th>
            <th scope="col">Litres per hour</th>
            <th scope="col">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {g.months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthLabel(m.month)}</th>
              <td>{litres(m.litres)}</td>
              <td>{m.hours}</td>
              <td>{m.perHour ?? "-"}</td>
              <td>{m.flag ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.months.some((m) => m.flag) && (
        <p className="flex flex-wrap gap-1.5">
          {g.months
            .filter((m) => m.flag)
            .map((m) => (
              <Chip key={m.month} hue="rose" icon={AlertTriangle}>
                {monthLabel(m.month)}: {m.perHour} L/h on {litres(m.litres)}
              </Chip>
            ))}
        </p>
      )}
    </figure>
  );
}
