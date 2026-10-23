"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, Clock, Hourglass, PackageOpen, Scale, Timer } from "lucide-react";
import { Card, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import type { CalendarEvent } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { opsError } from "@/lib/api/operations-procurement-client";
import { stores, type Requisition } from "@/lib/api/operations-stores-client";
import { qty } from "@/suite/operations/components/procurement/meta";
import { DocNo } from "@/suite/operations/components/procurement/ui";
import { csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { deskOrder, remaining, requisitionStatus } from "./meta";
import { RequisitionStatusChip, ymdOf } from "./ui";
import { StoresCalendar } from "./StoresCalendar";

/**
 * The issue desk: requisitions approved and waiting for the store, part
 * issued ones next, then the rest. Each opens to issue what the store has on
 * a numbered voucher (SIV) and to turn a shortfall into a purchase request.
 */

type Tab = "issue" | "approval" | "done" | "all";

const IN_TAB: Record<Tab, (s: string) => boolean> = {
  issue: (s) => s === "approved" || s === "partly_issued",
  approval: (s) => s === "in_approval",
  done: (s) => s === "issued" || s === "rejected" || s === "cancelled",
  all: () => true,
};

/** Whole days since an ISO time. */
export const daysSince = (iso: string | null, now = Date.now()) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000)) : 0);

export default function RequisitionsDesk() {
  const [rows, setRows] = useState<Requisition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("issue");
  // One reading of the clock per load, so ages don't drift between renders.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    stores.requisitions.list().then(
      (r) => {
        if (!alive) return;
        setRows(deskOrder(r));
        setNow(Date.now());
        setError(null);
      },
      (e: unknown) => alive && setError(`Requisitions didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const counts = useMemo(() => {
    const c = { issue: 0, approval: 0, done: 0, all: rows?.length ?? 0 };
    for (const r of rows ?? []) {
      if (IN_TAB.issue(r.status)) c.issue++;
      else if (IN_TAB.approval(r.status)) c.approval++;
      else if (IN_TAB.done(r.status)) c.done++;
    }
    return c;
  }, [rows]);

  const header = (
    <PageHeader
      eyebrow="Stores"
      title="Requisitions"
      subtitle="Issue what staff asked for, on a store issue voucher they acknowledge. What the store can't supply can be bought."
      tabs={[
        { key: "issue", label: "To issue", count: counts.issue },
        { key: "approval", label: "In approval", count: counts.approval },
        { key: "done", label: "Closed", count: counts.done },
        { key: "all", label: "All", count: counts.all },
      ]}
      activeTab={tab}
      onTab={(k) => setTab(k as Tab)}
    />
  );

  if (error && !rows)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!rows)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading requisitions…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const toIssue = rows.filter((r) => IN_TAB.issue(r.status));
  const partly = toIssue.filter((r) => r.status === "partly_issued");
  const linesWaiting = toIssue.reduce((s, r) => s + r.lines.filter((l) => remaining(l) > 0).length, 0);
  const oldest = [...toIssue].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")).slice(0, 5);
  const shown = rows.filter((r) => IN_TAB[tab](r.status));

  const events: CalendarEvent[] = rows
    .filter((r) => r.createdAt)
    .map((r) => ({
      id: r.id,
      date: ymdOf(r.createdAt)!,
      title: r.number ?? "Requisition",
      meta: r.requester ?? undefined,
      hue: requisitionStatus(r.status).hue,
      href: `/suite/operations/stores/requisitions/${r.id}`,
    }));

  const columns: Column<Requisition>[] = [
    {
      key: "number",
      header: "Requisition",
      primary: true,
      sortable: true,
      value: (r) => `${r.number ?? ""} ${r.requester ?? ""} ${r.purpose ?? ""}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{r.requester ?? "Someone"}</span>
          <DocNo value={r.number} />
          {r.purpose && <span className="block max-w-[28ch] truncate text-xs text-neutral-500">{r.purpose}</span>}
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, value: (r) => requisitionStatus(r.status).label, render: (r) => <RequisitionStatusChip status={r.status} /> },
    { key: "store", header: "Store", sortable: true, hideOnMobile: true, value: (r) => r.store ?? "" },
    {
      key: "lines",
      header: "Items",
      sortable: true,
      value: (r) => r.lines.length,
      render: (r) => {
        const asked = r.lines.reduce((s, l) => s + l.quantity, 0);
        const issued = r.lines.reduce((s, l) => s + Math.min(l.issued, l.quantity), 0);
        const pct = asked > 0 ? (issued / asked) * 100 : 0;
        return (
          <span className="block min-w-[120px]">
            <span className="block text-xs text-neutral-600">
              {r.lines.length} {r.lines.length === 1 ? "line" : "lines"} · {qty(issued)} of {qty(asked)} issued
            </span>
            <span className="ws-hatch mt-1 block h-1.5 overflow-hidden rounded-full" aria-hidden>
              <span className={cx("block h-full rounded-full", pct >= 100 ? "bg-mint-500" : "bg-sky-500")} style={{ width: `${pct}%` }} />
            </span>
          </span>
        );
      },
    },
    { key: "charged", header: "Charged to", hideOnMobile: true, value: (r) => r.project?.name ?? (r.costCentreId ? "Cost centre" : ""), render: (r) => <span className="text-sm text-neutral-700">{r.project ? (r.project.code ?? r.project.name) : r.costCentreId ? "Cost centre" : "-"}</span> },
    {
      key: "raised",
      header: "Raised",
      sortable: true,
      value: (r) => r.createdAt ?? "",
      render: (r) => (
        <span className="block text-xs">
          <span className="block text-neutral-800">{day(r.createdAt)}</span>
          {IN_TAB.issue(r.status) && now > 0 && <span className={cx("block", daysSince(r.createdAt, now) > 3 ? "font-semibold text-coral-700" : "text-neutral-500")}>{daysSince(r.createdAt, now)} days waiting</span>}
        </span>
      ),
    },
  ];

  return (
    <div>
      {header}
      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="To issue" value={toIssue.length} icon={PackageOpen} hint={toIssue.length ? "Approved, waiting for the store" : "Nothing waiting"} />
          <StatCard label="Part issued" value={partly.length} icon={Scale} hue={partly.length ? "sun" : "mint"} hint={partly.length ? "Something still owed" : "None outstanding"} />
          <StatCard label="Lines waiting" value={linesWaiting} icon={ClipboardCheck} hue="sky" hint="Across requisitions to issue" />
          <StatCard label="In approval" value={counts.approval} icon={Hourglass} hue="grape" hint="With the head of unit" />
        </StatGrid>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="When they were raised" subtitle="Each requisition on the day it was raised, coloured by where it stands" icon={CalendarDays} hue="sky">
            <StoresCalendar
              events={events}
              caption="Requisitions raised"
              legend={[
                { label: "To issue", hue: "sky" },
                { label: "Part issued", hue: "sun" },
                { label: "Issued", hue: "mint" },
                { label: "In approval", hue: "grape" },
                { label: "Rejected", hue: "rose" },
              ]}
            />
          </Panel>
          <Panel title="Waiting longest" subtitle="Approved, oldest first" icon={Timer} hue="coral">
            {oldest.length === 0 ? (
              <Empty icon={Clock} title="Nobody is waiting" hint="Approved requisitions show here until the store issues them." hue="mint" />
            ) : (
              <ol className="space-y-2">
                {oldest.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/suite/operations/stores/requisitions/${r.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-2.5 outline-none transition hover:border-neutral-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", HUE[hueFor(r.requester)].soft)} aria-hidden>
                        {now > 0 ? daysSince(r.createdAt, now) : "·"}
                        <span className="sr-only">days</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{r.requester ?? "Someone"}</span>
                        <span className="block truncate text-xs text-neutral-500">
                          {r.number ?? "Requisition"} · {r.lines.length} {r.lines.length === 1 ? "line" : "lines"} · {r.store ?? "a store"}
                        </span>
                      </span>
                      <RequisitionStatusChip status={r.status} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <section aria-labelledby="requisitions-list">
          <h2 id="requisitions-list" className="mb-3 text-[15px] font-semibold text-neutral-900">
            {tab === "issue" ? "To issue" : tab === "approval" ? "In approval" : tab === "done" ? "Closed" : "Every requisition"}
          </h2>
          {shown.length === 0 ? (
            <Card>
              <Empty icon={PackageOpen} title={tab === "issue" ? "Nothing to issue" : "No requisitions here"} hint="Staff ask for consumables under My requisitions. Approved ones arrive here to issue." />
            </Card>
          ) : (
            <DataView
              rows={shown}
              columns={columns}
              rowKey={(r) => r.id}
              rowHref={(r) => `/suite/operations/stores/requisitions/${r.id}`}
              views={["table", "list"]}
              storageKey="operations.stores.requisitions"
              caption="Requisitions"
              searchPlaceholder="Search by number, person or purpose"
              onDownload={(list) =>
                downloadCsv(csvName("requisitions", tab === "all" ? "" : tab), [
                  ["Number", "Raised by", "Store", "Purpose", "Project", "Lines", "Items asked", "Items issued", "Status", "Raised on"],
                  ...list.map((r) => [
                    r.number ?? "",
                    r.requester ?? "",
                    r.store ?? "",
                    r.purpose ?? "",
                    r.project ? [r.project.code, r.project.name].filter(Boolean).join(" ") : "",
                    r.lines.length,
                    r.lines.map((l) => `${l.name ?? l.code ?? "Item"} x ${l.quantity}`).join("; "),
                    r.lines.map((l) => `${l.name ?? l.code ?? "Item"} x ${l.issued}`).join("; "),
                    requisitionStatus(r.status).label,
                    csvDate(r.createdAt),
                  ]),
                ])
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
