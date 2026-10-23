"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Banknote, CalendarClock, ClipboardList, Download, Gauge, Plus, Siren, Wrench } from "lucide-react";
import { Button, Card, Chip, PageHeader, Panel, PersonAvatar, PriorityChip, SearchField, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { GroupedColumns, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { HUE } from "@/components/workspace/modules";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, monthLabel } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { maintenance, opsError, type WorkOrder, type WorkOrderMeta } from "@/lib/api/operations-maintenance-client";
import { KIND_LABEL, PRIORITY_HUE, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_FLOW, slaClock, workOrderStatus } from "./labels";
import { SlaChip, WorkOrderStatusChip, WorkOrderSubject, maintenanceTabs } from "./parts";
import RaiseWorkOrderDialog from "./RaiseWorkOrderDialog";

/** Ticks once a minute, so SLA countdowns stay true while the page is open. */
export function useNow(every = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

const rank = (w: WorkOrder) => PRIORITY_ORDER.indexOf(w.priority);

/**
 * The maintenance desk's work-order board: what is open by priority, what
 * has blown its SLA, preventive work that is late, and what maintenance has
 * cost; preventive against corrective spend by month; then every work order
 * on a board from open to confirmed, each with its SLA counting down.
 */
export default function WorkOrderBoard() {
  const { user } = useAuth();
  const router = useRouter();
  const now = useNow();
  const [rows, setRows] = useState<WorkOrder[] | null>(null);
  const [meta, setMeta] = useState<WorkOrderMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"board" | "list">("board");
  const [kind, setKind] = useState<"all" | "preventive" | "corrective">("all");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [raising, setRaising] = useState(false);

  useEffect(() => {
    let alive = true;
    maintenance.list().then(
      (r) => {
        if (!alive) return;
        setRows(r.workOrders);
        setMeta(r.meta);
        setError(null);
      },
      (e: unknown) => alive && setError(`The work orders didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? [])
      .filter((w) => w.status !== "cancelled")
      .filter((w) => kind === "all" || w.kind === kind)
      .filter((w) => !priority || w.priority === priority)
      .filter((w) => !breachedOnly || w.overdue)
      .filter((w) => !needle || [w.number, w.title, w.asset?.tagNo, w.asset?.name, w.facility, w.assignee, w.vendor].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => rank(a) - rank(b) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  }, [rows, kind, priority, q, breachedOnly]);

  if (error && !rows) {
    return (
      <div>
        <PageHeader title="Maintenance" tabs={maintenanceTabs()} activeTab="orders" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!rows || !meta) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the work orders…</p>
        <Skeleton className="h-24" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const openTotal = PRIORITY_ORDER.reduce((s, p) => s + (meta.open[p] ?? 0), 0);
  const costs = meta.byMonth.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], values: { preventive: m.preventive, corrective: m.corrective } }));
  const costTotal = meta.byMonth.reduce((s, m) => s + m.preventive + m.corrective, 0);
  const preventiveShare = costTotal > 0 ? Math.round((100 * meta.byMonth.reduce((s, m) => s + m.preventive, 0)) / costTotal) : null;
  const canRaise = mayDoOps(user, "maintenance", "create");

  /* The work orders listed under the filters and search, as a spreadsheet opens them. */
  const exportCsv = () =>
    downloadCsv(csvName("work-orders", kind === "all" ? "" : kind, priority, breachedOnly ? "sla-breached" : ""), [
      ["Number", "Title", "Kind", "Priority", "Status", "Asset tag", "Asset", "Site", "Assignee", "Vendor", "Due", "SLA breached", "Currency", "Cost", "Raised", "Completed"],
      ...shown.map((w) => [
        w.number ?? "",
        w.title,
        KIND_LABEL[w.kind] ?? w.kind,
        PRIORITY_LABEL[w.priority] ?? w.priority,
        workOrderStatus(w.status).label,
        w.asset?.tagNo ?? "",
        w.asset?.name ?? "",
        w.facility ?? "",
        w.assignee ?? "",
        w.vendor ?? "",
        w.dueAt ?? "",
        w.overdue ? "Yes" : "No",
        "NGN",
        csvAmount(w.cost),
        csvDate(w.createdAt),
        csvDate(w.completedAt),
      ]),
    ]);

  const columns: Column<WorkOrder>[] = [
    {
      key: "number",
      header: "Work order",
      primary: true,
      sortable: true,
      value: (w) => `${w.number ?? ""} ${w.title}`,
      render: (w) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{w.title}</span>
          <span className="block font-mono text-xs text-neutral-500">{w.number ?? "-"}</span>
        </span>
      ),
    },
    { key: "on", header: "On", value: (w) => w.asset?.tagNo ?? w.facility ?? "", render: (w) => <WorkOrderSubject asset={w.asset} facility={w.facility} />, hideOnMobile: true },
    { key: "priority", header: "Priority", sortable: true, value: (w) => rank(w), render: (w) => <PriorityChip priority={w.priority} /> },
    { key: "status", header: "Status", sortable: true, value: (w) => STATUS_FLOW.indexOf(w.status), render: (w) => <WorkOrderStatusChip status={w.status} /> },
    { key: "sla", header: "SLA", sortable: true, value: (w) => w.dueAt ?? "", render: (w) => <SlaChip w={w} now={now} /> },
    { key: "who", header: "With", value: (w) => w.assignee ?? w.vendor ?? "", render: (w) => <span className="text-sm text-neutral-700">{w.assignee ?? w.vendor ?? "-"}</span>, hideOnMobile: true },
    { key: "cost", header: "Cost", sortable: true, align: "right", value: (w) => w.cost, render: (w) => <Money value={w.cost} className="text-sm" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Faults and planned servicing as work orders: who has them, how long they have left, and what they cost."
        actions={
          canRaise ? (
            <Button variant="primary" icon={Plus} onClick={() => setRaising(true)}>
              Raise a work order
            </Button>
          ) : undefined
        }
        tabs={maintenanceTabs()}
        activeTab="orders"
      />

      <div className="space-y-5">
        <StatGrid cols={5}>
          <StatCard featured label="Open work orders" value={openTotal} icon={ClipboardList} hint={PRIORITY_ORDER.filter((p) => meta.open[p]).map((p) => `${meta.open[p]} ${PRIORITY_LABEL[p].toLowerCase()}`).join(" · ") || "Nothing open"} />
          <StatCard label="SLA breached" value={meta.slaBreached} icon={Siren} hue={meta.slaBreached ? "rose" : "mint"} hint={meta.slaBreached ? "Open and past their time" : "Everything inside its SLA"} />
          <StatCard label="Preventive overdue" value={meta.overduePreventive} icon={CalendarClock} hue={meta.overduePreventive ? "sun" : "mint"} hint="Planned servicing that is late" href="/suite/operations/maintenance/plans" />
          <StatCard label="Cost this month" value={compact(meta.costThisMonth)} icon={Banknote} hue="grape" hint="Labour, vendors and parts" />
          <StatCard label="SLA met" value={meta.slaCompliance === null ? "-" : `${meta.slaCompliance}%`} icon={Gauge} hue={meta.slaCompliance === null ? "slate" : meta.slaCompliance >= 90 ? "mint" : meta.slaCompliance >= 75 ? "sun" : "rose"} hint="Work done in time, past year" />
        </StatGrid>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Preventive and corrective cost"
            subtitle={`By the month the work was completed · ${compact(costTotal)} in six months${preventiveShare !== null ? ` · ${preventiveShare}% planned` : ""}`}
            icon={BarChart3}
            hue="blue"
          >
            {costTotal === 0 ? (
              <div className="ws-hatch rounded-2xl px-5 py-12 text-center">
                <p className="text-sm font-semibold text-neutral-800">No completed work in these months</p>
                <p className="mt-1 text-sm text-neutral-600">Costs show here once work orders are completed.</p>
              </div>
            ) : (
              <GroupedColumns
                data={costs}
                series={[
                  { key: "preventive", label: "Preventive", hue: "mint" },
                  { key: "corrective", label: "Corrective", hue: "coral" },
                ]}
                format={(v) => compact(v)}
                caption="Maintenance cost by month, preventive and corrective"
                height={230}
              />
            )}
          </Panel>

          <Panel title="Open by priority" subtitle="How urgent the open work is" icon={Wrench} hue="coral">
            <StatusBars
              data={PRIORITY_ORDER.map((p) => ({ label: PRIORITY_LABEL[p], value: meta.open[p] ?? 0, hue: PRIORITY_HUE[p] }))}
              caption="Open work orders by priority"
            />
            <p className="mt-4 text-xs text-neutral-500">Fix within: critical 4 hours, high 1 day, normal 3 days, low 1 week.</p>
          </Panel>
        </div>

        <section aria-labelledby="orders-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="orders-heading" className="text-[15px] font-semibold text-neutral-900">
                Work orders
              </h2>
              <p className="text-xs text-neutral-500">
                {shown.length} shown{rows.some((w) => w.status === "cancelled") ? " · cancelled ones hidden" : ""}. Open one to work it.
              </p>
            </div>
            <Segmented
              label="Show as"
              value={view}
              onChange={setView}
              options={[
                { key: "board", label: "Board" },
                { key: "list", label: "List" },
              ]}
            />
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={q} onChange={setQ} placeholder="Search work orders, tags, people" className="min-w-[14rem] flex-1" label="Search work orders" />
            <Segmented
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { key: "all", label: "All" },
                { key: "corrective", label: "Corrective" },
                { key: "preventive", label: "Preventive" },
              ]}
            />
            <SearchableSelect
              aria-label="Priority"
              size="sm"
              className="w-40"
              value={priority}
              onChange={setPriority}
              clearable
              clearLabel="Any priority"
              placeholder="Any priority"
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50">
              <input type="checkbox" checked={breachedOnly} onChange={(e) => setBreachedOnly(e.target.checked)} className="h-4 w-4 accent-rose-600" />
              SLA breached only
            </label>
            <Button size="sm" icon={Download} onClick={exportCsv} disabled={shown.length === 0} className="ml-auto">
              Download CSV
            </Button>
          </div>

          {view === "board" ? (
            <Card className="p-4">
              <Lanes rows={shown} now={now} />
            </Card>
          ) : (
            <DataView
              rows={shown}
              columns={columns}
              rowKey={(w) => w.id}
              rowHref={(w) => `/suite/operations/maintenance/${w.id}`}
              searchable={false}
              views={["table", "list"]}
              storageKey="ops-maintenance-orders"
              caption="Work orders"
              empty={<p className="py-10 text-center text-sm text-neutral-500">No work orders match.</p>}
            />
          )}
        </section>
      </div>

      {raising && (
        <RaiseWorkOrderDialog
          onClose={() => setRaising(false)}
          onDone={(wo) => {
            setRaising(false);
            router.push(`/suite/operations/maintenance/${wo.id}`);
          }}
        />
      )}
    </div>
  );
}

/** The board: one lane per status, from open to confirmed. Scrolls sideways on a phone. */
function Lanes({ rows, now }: { rows: WorkOrder[]; now: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="grid min-w-[1080px] grid-cols-6 gap-3">
        {STATUS_FLOW.map((s) => {
          const m = workOrderStatus(s);
          const Icon = m.icon;
          const lane = rows.filter((w) => w.status === s);
          return (
            <section key={s} aria-label={`${m.label}: ${lane.length}`} className="flex min-h-[220px] flex-col rounded-2xl bg-neutral-100/70 p-2.5">
              <header className="mb-2.5 flex items-center gap-2 px-1">
                <span className={cx("flex h-6 w-6 items-center justify-center rounded-lg", HUE[m.hue].soft)}>
                  <Icon size={13} aria-hidden />
                </span>
                <h3 className="text-[13px] font-semibold text-neutral-800">{m.label}</h3>
                <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-600">{lane.length}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-2">
                {lane.length === 0 ? (
                  <li className="ws-hatch flex-1 rounded-xl" aria-label="Nothing here" />
                ) : (
                  lane.map((w) => (
                    <li key={w.id}>
                      <WorkOrderCard w={w} now={now} />
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WorkOrderCard({ w, now }: { w: WorkOrder; now: number }) {
  const sla = slaClock(w, now);
  return (
    <Link
      href={`/suite/operations/maintenance/${w.id}`}
      className={cx(
        "ws-card block rounded-xl p-3 outline-none transition hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
        sla.overdue && "ring-1 ring-rose-500/40",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <PriorityChip priority={w.priority} />
        {w.assignee && <PersonAvatar name={w.assignee} size={24} />}
      </span>
      <span className="mt-2 line-clamp-2 block text-[13px] font-semibold leading-snug text-neutral-900">{w.title}</span>
      <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-neutral-500">
        {w.number ?? "-"}
        <span aria-hidden>·</span>
        <span className="font-sans">{KIND_LABEL[w.kind] ?? w.kind}</span>
      </span>
      <span className="mt-2 block">
        <WorkOrderSubject asset={w.asset} facility={w.facility} />
      </span>
      <span className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-neutral-100 pt-2">
        <SlaChip w={w} now={now} className="!px-2 !py-0.5 !text-[11px]" />
        {w.cost > 0 && <Money value={w.cost} className="text-[11px] font-semibold text-neutral-700" />}
      </span>
      {w.vendor && !w.assignee && (
        <Chip hue="slate" className="mt-1.5 !px-2 !py-0.5 !text-[10px]">
          {w.vendor}
        </Chip>
      )}
    </Link>
  );
}
