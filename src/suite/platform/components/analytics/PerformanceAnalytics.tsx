"use client";

import { useCallback, useEffect, useState } from "react";
import { AlarmClock, Gauge, Layers, ServerCrash, Timer, Zap } from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AreaLine } from "@/components/workspace/charts";
import { StatCard } from "@/suite/lms/components/ui/ws";
import {
  ApiError,
  platformAnalytics,
  type PerformanceAnalytics as Perf,
  type PerformanceWindow,
} from "@/lib/api/platform-client";
import { LoadError, PageSkeleton, When } from "../ui";

type RouteRow = Perf["slowestRoutes"][number];

const WINDOWS: { key: `${PerformanceWindow}`; label: string }[] = [
  { key: "1", label: "24 hours" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
];

/** p95 above this reads as slow to people; the chip turns amber. */
const SLOW_MS = 800;
/** A scheduler that has not ticked in this long has stopped. */
const SCHEDULER_STALE_MS = 5 * 60 * 1000;

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);

/**
 * How the platform is holding up: request volume, errors, latency, the
 * slowest routes, and the two background systems that fail silently — the
 * queue and the scheduler.
 */
export default function PerformanceAnalytics() {
  const [windowKey, setWindowKey] = useState<`${PerformanceWindow}`>("1");
  const [data, setData] = useState<Perf | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read once per load, so staleness is judged against when the numbers arrived.
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(() => {
    platformAnalytics
      .performance(Number(windowKey) as PerformanceWindow)
      .then((d) => {
        setData(d);
        setError(null);
        setLoadedAt(Date.now());
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Performance didn't load."));
  }, [windowKey]);

  useEffect(() => {
    load();
  }, [load]);

  const label = (at: string) =>
    windowKey === "1"
      ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const columns: Column<RouteRow>[] = [
    {
      key: "route",
      header: "Route",
      primary: true,
      value: (r) => r.route,
      render: (r) => <span className="font-mono text-xs text-neutral-800">{r.route}</span>,
    },
    { key: "count", header: "Requests", align: "right", sortable: true, value: (r) => r.count, render: (r) => <span className="tabular-nums">{r.count.toLocaleString("en-NG")}</span> },
    {
      key: "p95",
      header: "p95",
      align: "right",
      sortable: true,
      value: (r) => r.p95Ms,
      render: (r) => (
        <Chip hue={r.p95Ms > SLOW_MS ? "sun" : "mint"}>
          <span className="tabular-nums">{ms(r.p95Ms)}</span>
        </Chip>
      ),
    },
  ];

  const header = (
    <PageHeader
      eyebrow="Analytics"
      title="Performance"
      subtitle="Requests, errors and latency, with the queue and scheduler that run behind them."
      actions={<Segmented label="Period" value={windowKey} onChange={setWindowKey} options={WINDOWS} />}
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
        <PageSkeleton rows={2} />
      </div>
    );
  }

  const { requests, queue, scheduler } = data;
  const errorPct = Math.round(requests.errorRate * 1000) / 10;
  const schedulerStale =
    scheduler.lastRunAt === null || loadedAt - new Date(scheduler.lastRunAt).getTime() > SCHEDULER_STALE_MS;

  return (
    <div className="space-y-6">
      {header}

      <StatGrid cols={4}>
        <StatCard featured featuredHue="blue" icon={Zap} label="Requests" value={requests.total.toLocaleString("en-NG")} />
        <StatCard
          icon={ServerCrash}
          hue={errorPct >= 1 ? "rose" : "mint"}
          label="Error rate"
          value={`${errorPct}%`}
          hint={errorPct >= 1 ? "Above 1% — worth a look" : "Within normal range"}
        />
        <StatCard icon={Timer} hue="sky" label="Median response" value={ms(requests.p50Ms)} hint="p50" />
        <StatCard
          icon={Gauge}
          hue={requests.p95Ms > SLOW_MS ? "sun" : "grape"}
          label="Slow end"
          value={ms(requests.p95Ms)}
          hint="p95 — 1 in 20 requests is slower"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Requests" subtitle="Volume over the period" icon={Zap} hue="blue">
          {data.series.length < 2 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Not enough traffic recorded yet.</p>
          ) : (
            <AreaLine data={data.series.map((p) => ({ label: label(p.at), value: p.requests }))} caption="Requests over time" height={200} />
          )}
        </Panel>
        <Panel title="p95 latency" subtitle="How slow the slow requests are" icon={Gauge} hue="grape">
          {data.series.length < 2 ? (
            <p className="py-12 text-center text-sm text-neutral-500">Not enough traffic recorded yet.</p>
          ) : (
            <AreaLine
              data={data.series.map((p) => ({ label: label(p.at), value: p.p95Ms }))}
              hue="grape"
              format={ms}
              caption="p95 latency over time"
              height={200}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Slowest routes</h2>
          <DataView
            rows={data.slowestRoutes}
            columns={columns}
            rowKey={(r) => r.route}
            views={["table"]}
            caption="Slowest routes by p95"
            searchPlaceholder="Search routes…"
            empty={
              <Card>
                <Empty icon={Gauge} title="No routes measured yet" hint="Routes appear once requests have been recorded in this period." />
              </Card>
            }
          />
        </div>

        <div className="space-y-5">
          <Panel title="Queue" icon={Layers} hue={queue.failed > 0 ? "rose" : "mint"}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-xs text-neutral-500">Waiting</dt>
                <dd className="text-xl font-bold tabular-nums text-neutral-900">{queue.pending.toLocaleString("en-NG")}</dd>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <dt className="text-xs text-neutral-500">Failed</dt>
                <dd className={`text-xl font-bold tabular-nums ${queue.failed > 0 ? "text-error-700" : "text-neutral-900"}`}>
                  {queue.failed.toLocaleString("en-NG")}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-neutral-500">
              {queue.oldestPendingAt ? (
                <>
                  Oldest waiting job queued <When at={queue.oldestPendingAt} />.
                </>
              ) : (
                "Nothing waiting."
              )}
            </p>
          </Panel>

          <Panel title="Scheduler" icon={AlarmClock} hue={schedulerStale ? "sun" : "mint"}>
            <p className="flex items-center gap-2 text-sm">
              <Chip hue={schedulerStale ? "sun" : "mint"} dot>
                {schedulerStale ? "Not running" : "Running"}
              </Chip>
              <span className="text-neutral-600">
                Last ran <When at={scheduler.lastRunAt} />
              </span>
            </p>
            {schedulerStale && (
              <p className="mt-3 text-xs text-neutral-500">
                Renewals, reminders and clean-ups wait for the scheduler. Check that the server&apos;s cron entry is in place.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
