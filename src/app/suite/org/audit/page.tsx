"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Download,
  Globe,
  HeartPulse,
  PieChart,
  ShieldCheck,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { type AuditSeverity } from "@/lib/console-data";
import {
  audit as auditApi,
  health as healthApi,
  type AuditEntry,
  type AuditPage,
  type HealthMetric,
} from "@/lib/api/admin-client";
import { Button, Chip, Empty, PageHeader, Panel, SearchField, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import { FaceAvatar, StatCard } from "@/suite/lms/components/ui/ws";
import { auditActionSentence, auditSubject } from "@/suite/org/components/auditLabels";

/* ------------------------------------------------------------------ */
/*  Status maps                                                        */
/* ------------------------------------------------------------------ */

const HEALTH_STYLE: Record<HealthMetric["status"], { dot: string; hue: Hue; label: string }> = {
  operational: { dot: "bg-mint-500", hue: "mint", label: "Operational" },
  degraded: { dot: "bg-sun-500", hue: "sun", label: "Degraded" },
  down: { dot: "bg-rose-500", hue: "rose", label: "Down" },
};

const SEVERITY_HUE: Record<AuditSeverity, Hue> = {
  info: "sky",
  warning: "sun",
  critical: "rose",
};

const SEVERITY_FILTERS = ["All", "info", "warning", "critical"] as const;
type SeverityFilter = (typeof SEVERITY_FILTERS)[number];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PER_PAGE = 25;

/** What the event was about: a name from its meta, else the raw target. */
function targetOf(e: AuditEntry): string | null {
  return auditSubject(e.meta) ?? e.target;
}

function SeverityChip({ severity }: { severity: string }) {
  return (
    <Chip hue={SEVERITY_HUE[severity as AuditSeverity] ?? "slate"} dot>
      {capitalize(severity)}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */

export default function AdminAuditPage() {
  const [severity, setSeverity] = useState<SeverityFilter>("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditPage | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthMetric[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Typing settles for a moment before it becomes a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // The trail is paged and filtered on the server: an organisation's history
  // runs to thousands of events, and only the newest fifty used to be reachable.
  const requestKey = JSON.stringify([severity, query, page]);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let active = true;
    auditApi
      .page({ page, perPage: PER_PAGE, search: query, severity: severity === "All" ? "" : severity })
      .then((r) => {
        if (!active) return;
        setResult(r);
        setAuditError(null);
      })
      .catch((err: unknown) => active && setAuditError(err instanceof Error ? err.message : "The audit log didn't load."))
      .finally(() => active && setSettledKey(requestKey));
    return () => {
      active = false;
    };
  }, [severity, query, page, requestKey]);

  useEffect(() => {
    let active = true;
    healthApi
      .get()
      .then((data) => active && setHealth(data))
      .catch((err: unknown) => {
        if (active) setHealthError(err instanceof Error ? err.message : "Unable to load system health.");
      })
      .finally(() => active && setHealthLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const impaired = health.filter((m: HealthMetric) => m.status !== "operational");
  const anyDown = health.some((m: HealthMetric) => m.status === "down");
  const allOperational = health.length > 0 && impaired.length === 0;

  const rows = result?.data ?? [];
  const counts = result?.meta.severityCounts ?? { info: 0, warning: 0, critical: 0 };
  const recorded = counts.info + counts.warning + counts.critical;
  const firstLoad = result === null && !auditError;

  const columns: Column<AuditEntry>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      value: (e) => e.severity,
      render: (e) => <SeverityChip severity={e.severity} />,
    },
    {
      key: "actor",
      header: "Actor",
      primary: true,
      sortable: true,
      value: (e) => e.actor,
      render: (e) => (
        <span className="flex items-center gap-2.5">
          <FaceAvatar name={e.actor} size={30} />
          <span className="font-medium text-neutral-900">{e.actor}</span>
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      value: (e) => auditActionSentence(e.action),
      render: (e) => <span title={e.action}>{auditActionSentence(e.action)}</span>,
    },
    {
      key: "target",
      header: "Target",
      value: (e) => targetOf(e) ?? "",
      render: (e) => <span className="block max-w-[220px] truncate text-neutral-500">{targetOf(e) ?? "—"}</span>,
    },
    {
      key: "time",
      header: "Time",
      sortable: true,
      value: (e) => e.time,
      render: (e) => (
        <span className="whitespace-nowrap tabular-nums text-neutral-500">{new Date(e.time).toLocaleString()}</span>
      ),
    },
    {
      key: "ip",
      header: "IP",
      hideOnMobile: true,
      value: (e) => e.ip ?? "",
      render: (e) => <span className="font-mono text-xs tabular-nums text-neutral-500">{e.ip ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Institution"
        title="Audit Log"
        subtitle="Security events and administrative actions."
        actions={
          <Button icon={Download} className="self-start">
            Export log
          </Button>
        }
      />

      <StatGrid>
        <StatCard
          featured
          featuredHue="sun"
          icon={Activity}
          label="Events recorded"
          value={firstLoad ? "…" : recorded.toLocaleString()}
        />
        <StatCard icon={TriangleAlert} hue="sun" label="Warnings" value={firstLoad ? "…" : counts.warning.toLocaleString()} />
        <StatCard icon={AlertOctagon} hue="rose" label="Critical" value={firstLoad ? "…" : counts.critical.toLocaleString()} />
        <StatCard
          icon={HeartPulse}
          hue={allOperational ? "mint" : anyDown ? "rose" : "sun"}
          label="Services operational"
          value={healthLoading || healthError ? "—" : `${health.length - impaired.length}/${health.length}`}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* system health */}
        <Panel
          title="System health"
          subtitle="Real-time status of platform services."
          icon={HeartPulse}
          hue="mint"
          className="lg:col-span-2"
        >
          {healthError ? (
            <div className="flex items-center gap-3 rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3">
              <ShieldAlert size={18} className="text-error-700" aria-hidden />
              <p className="text-sm font-medium text-error-700">{healthError}</p>
            </div>
          ) : healthLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
          ) : (
            <HealthBanner allOperational={allOperational} anyDown={anyDown} impairedCount={impaired.length} />
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {healthLoading && !healthError
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100" />
                ))
              : null}
            {health.map((m: HealthMetric) => {
              const s = HEALTH_STYLE[m.status];
              return (
                <div key={m.label} className="rounded-xl border border-neutral-200/80 bg-neutral-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {m.status !== "operational" && (
                          <span
                            className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", s.dot)}
                          />
                        )}
                        <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", s.dot)} />
                      </span>
                      <span className="truncate text-sm font-medium text-neutral-700">{m.label}</span>
                    </div>
                    <Chip hue={s.hue}>{s.label}</Chip>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-neutral-900">{m.value}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{m.detail}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Events by severity" subtitle="Everything in the log" icon={PieChart} hue="grape">
          {firstLoad ? (
            <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-neutral-100" />
          ) : recorded === 0 ? (
            <Empty icon={ShieldCheck} title="No events yet" hue="grape" />
          ) : (
            <Donut
              data={[
                { label: "Info", value: counts.info, hue: "sky" },
                { label: "Warning", value: counts.warning, hue: "sun" },
                { label: "Critical", value: counts.critical, hue: "rose" },
              ]}
              centerLabel="events"
              size={170}
              legend="below"
              caption="Audit events by severity"
            />
          )}
        </Panel>
      </div>

      {/* audit log */}
      <section aria-labelledby="activity-heading">
        <div className="mb-3">
          <h2 id="activity-heading" className="text-lg font-semibold text-neutral-900">
            Activity history
          </h2>
          <p className="text-sm text-neutral-500">Administrative and system events</p>
        </div>
        {auditError && (
          <div role="alert" className="mb-3 flex items-center gap-3 rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3">
            <ShieldAlert size={18} className="text-error-700" aria-hidden />
            <p className="text-sm font-medium text-error-700">{auditError}</p>
          </div>
        )}
        <div aria-busy={loading || undefined} className={cx(loading && !firstLoad && "opacity-60 transition-opacity")}>
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(e) => e.id}
          storageKey="org.audit"
          caption="Activity history"
          searchable={false}
          toolbar={
            <>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search actor, action or target"
                label="Search the audit log"
                className="w-full sm:w-64"
              />
              <Segmented
                label="Filter by severity"
                options={SEVERITY_FILTERS.map((f) => ({ key: f, label: capitalize(f) }))}
                value={severity}
                onChange={(next) => {
                  setSeverity(next);
                  setPage(1);
                }}
              />
            </>
          }
          empty={
            <Empty
              icon={ShieldCheck}
              title={firstLoad ? "Loading events…" : "No matching events"}
              hint={firstLoad ? "Fetching the audit trail from the server." : "Try adjusting your search or severity filter."}
            />
          }
          renderCard={(e) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <SeverityChip severity={e.severity} />
                <span className="text-xs tabular-nums text-neutral-500">{new Date(e.time).toLocaleString()}</span>
              </div>
              <p className="text-[15px] font-semibold text-neutral-900">{auditActionSentence(e.action)}</p>
              {targetOf(e) && <p className="truncate text-sm text-neutral-500">{targetOf(e)}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                <span className="flex min-w-0 items-center gap-2">
                  <FaceAvatar name={e.actor} size={26} />
                  <span className="truncate text-sm font-medium text-neutral-800">{e.actor}</span>
                </span>
                {e.ip && (
                  <span className="flex items-center gap-1 font-mono text-xs text-neutral-500">
                    <Globe size={12} aria-hidden />
                    {e.ip}
                  </span>
                )}
              </div>
            </div>
          )}
          renderListItem={(e) => (
            <div className="flex items-center gap-4 px-5 py-3.5">
              <FaceAvatar name={e.actor} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-900">{e.actor}</span> · {auditActionSentence(e.action)}
                  {targetOf(e) ? <span className="text-neutral-500"> · {targetOf(e)}</span> : null}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                  {new Date(e.time).toLocaleString()}
                  {e.ip ? ` · ${e.ip}` : ""}
                </p>
              </div>
              <SeverityChip severity={e.severity} />
            </div>
          )}
        />
        {result && result.meta.lastPage > 1 && (
          <nav aria-label="Audit log pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
            <span className="tabular-nums">
              Page {result.meta.currentPage} of {result.meta.lastPage} · {result.meta.total.toLocaleString()} events
            </span>
            <span className="flex gap-2">
              <Button size="sm" icon={ArrowLeft} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={page >= result.meta.lastPage || loading} onClick={() => setPage((p) => p + 1)}>
                Next
                <ArrowRight size={15} aria-hidden />
              </Button>
            </span>
          </nav>
        )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overall health banner                                             */
/* ------------------------------------------------------------------ */

function HealthBanner({
  allOperational,
  anyDown,
  impairedCount,
}: {
  allOperational: boolean;
  anyDown: boolean;
  impairedCount: number;
}) {
  const Icon: LucideIcon = allOperational ? ShieldCheck : ShieldAlert;

  const styles = allOperational
    ? "border-mint-100 bg-mint-50 text-mint-700"
    : anyDown
      ? "border-error-500/20 bg-error-500/5 text-error-700"
      : "border-sun-100 bg-sun-50 text-sun-700";

  const message = allOperational
    ? "All systems operational"
    : anyDown
      ? `${impairedCount} service${impairedCount > 1 ? "s" : ""} impaired`
      : "Degraded performance";

  return (
    <div className={cx("flex items-center gap-3 rounded-xl border px-4 py-3", styles)}>
      <Icon size={18} aria-hidden />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}
