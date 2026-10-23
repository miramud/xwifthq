"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Building2, Sparkles, Users } from "lucide-react";
import { Card, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AreaLine, StatusBars } from "@/components/workspace/charts";
import { StatCard } from "@/suite/lms/components/ui/ws";
import { OrgMark } from "@/suite/org/components/ui";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import {
  ApiError,
  platformAnalytics,
  type UsageAnalytics as Usage,
  type UsageWindow,
} from "@/lib/api/platform-client";
import { LoadError, moduleHue, PageSkeleton } from "../ui";

type Row = Usage["byOrganisation"][number];

const WINDOWS: { key: `${UsageWindow}`; label: string }[] = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Who uses what, and how much.
 *
 * Daily active people is the headline — it says whether the platform is
 * being lived in — with events beside it for weight. Filtering to one module
 * answers "is HR actually used, or only licensed?".
 */
export default function UsageAnalytics() {
  const [windowKey, setWindowKey] = useState<`${UsageWindow}`>("30");
  const [module, setModule] = useState("");
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    platformAnalytics
      .usage(Number(windowKey) as UsageWindow, module || undefined)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Usage didn't load."));
  }, [windowKey, module]);

  useEffect(() => {
    load();
  }, [load]);

  // Series come per module per day; the chart wants one line per day.
  const daily = useMemo(() => {
    const byDate = new Map<string, { active: number; events: number }>();
    for (const p of data?.series ?? []) {
      const d = byDate.get(p.date) ?? { active: 0, events: 0 };
      d.active += p.activeUsers;
      d.events += p.events;
      byDate.set(p.date, d);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const byModule = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of data?.series ?? []) totals.set(p.module, (totals.get(p.module) ?? 0) + p.events);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const moduleOptions = useMemo(() => {
    const keys = new Set<string>(byModule.map(([k]) => k));
    if (module) keys.add(module);
    return [...keys].sort();
  }, [byModule, module]);

  const peak = daily.reduce((m, [, d]) => Math.max(m, d.active), 0);
  const totalEvents = daily.reduce((n, [, d]) => n + d.events, 0);
  const avgActive = daily.length ? Math.round(daily.reduce((n, [, d]) => n + d.active, 0) / daily.length) : 0;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Organisation",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <Link
          href={`/suite/platform/organisations/${encodeURIComponent(r.slug)}`}
          className="flex items-center gap-3 font-medium text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
        >
          <OrgMark name={r.name} size={32} />
          {r.name}
        </Link>
      ),
    },
    { key: "active", header: "Active users", align: "right", sortable: true, value: (r) => r.activeUsers, render: (r) => <span className="tabular-nums">{r.activeUsers.toLocaleString("en-NG")}</span> },
    { key: "events", header: "Events", align: "right", sortable: true, value: (r) => r.events, render: (r) => <span className="tabular-nums">{r.events.toLocaleString("en-NG")}</span> },
  ];

  const header = (
    <PageHeader
      eyebrow="Analytics"
      title="Usage"
      subtitle="Active people and activity per module, across every organisation."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={module}
            onChange={setModule}
            aria-label="Module"
            size="sm"
            className="w-44"
            options={[{ value: "", label: "All modules" }, ...moduleOptions.map((k) => ({ value: k, label: k.toUpperCase() }))]}
          />
          <Segmented label="Period" value={windowKey} onChange={setWindowKey} options={WINDOWS} />
        </div>
      }
    />
  );

  if (error) {
    return (
      <div>
        {header}
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        {header}
        <PageSkeleton stats={3} rows={2} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <StatGrid cols={3}>
        <StatCard featured featuredHue="blue" icon={Users} label="Average daily active" value={avgActive.toLocaleString("en-NG")} hint={`Peak ${peak.toLocaleString("en-NG")}`} />
        <StatCard icon={Activity} hue="grape" label="Events" value={totalEvents.toLocaleString("en-NG")} hint={`Last ${windowKey} days`} />
        <StatCard icon={Building2} hue="sun" label="Organisations active" value={data.byOrganisation.filter((o) => o.activeUsers > 0).length} unit={`of ${data.byOrganisation.length}`} />
      </StatGrid>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Daily active people" subtitle={module ? `${module.toUpperCase()} only` : "All modules"} icon={BarChart3} hue="blue">
          {daily.length < 2 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Not enough activity in this period to draw a trend.</p>
          ) : (
            <AreaLine
              data={daily.map(([date, d]) => ({ label: shortDate(date), value: d.active }))}
              caption="Daily active people"
              height={220}
            />
          )}
        </Panel>

        <Panel title="Activity by module" subtitle="Events in the period" icon={Activity} hue="grape">
          {byModule.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No activity recorded.</p>
          ) : (
            <StatusBars
              caption="Events by module"
              format={(v) => v.toLocaleString("en-NG")}
              data={byModule.map(([k, v]) => ({ label: k.toUpperCase(), value: v, hue: moduleHue(k) }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">By organisation</h2>
          <DataView
            rows={data.byOrganisation}
            columns={columns}
            rowKey={(r) => r.slug}
            views={["table", "list"]}
            storageKey="platform.usage.orgs"
            caption="Usage by organisation"
            searchPlaceholder="Search organisations…"
            empty={
              <Card>
                <Empty icon={Building2} title="No organisation activity" hint="Activity shows up here as people use the platform." />
              </Card>
            }
          />
        </div>
        <Panel title="Most used features" icon={Sparkles} hue="mint">
          {data.topFeatures.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">No feature activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {data.topFeatures.slice(0, 10).map((f, i) => (
                <li key={`${f.module}-${f.feature}`} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right text-xs font-semibold tabular-nums text-neutral-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-neutral-800">
                    {f.feature}
                    <span className="ml-1.5 text-xs text-neutral-500">{f.module.toUpperCase()}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-900">{f.events.toLocaleString("en-NG")}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
