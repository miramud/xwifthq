"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, FilePen, ScrollText, Truck, Wallet } from "lucide-react";
import { Card, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { CalendarNav, MonthCalendar, monthTitle, type CalendarEvent } from "@/components/workspace/Calendar";
import { Legend } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { opsError, procurement, type PoMeta, type PoStatus, type PoSummary } from "@/lib/api/operations-procurement-client";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { isPast, poStatus } from "./meta";
import { DocNo, PoStatusChip } from "./ui";

/**
 * Purchase orders: drafts waiting to be finished and sent for approval, open
 * orders on their way to being received and paid, and the rest. "Deliveries"
 * lays the open orders on a month calendar by the date they are due.
 */

type Tab = "draft" | "open" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "draft", label: "Drafts" },
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
];
const isTab = (v: string | null | undefined): v is Tab => TABS.some((t) => t.key === v);

const OPEN: PoStatus[] = ["approved", "sent", "accepted", "partially_received", "received", "invoiced", "partially_paid"];
const AWAITING_DELIVERY: PoStatus[] = ["approved", "sent", "accepted", "partially_received"];

export default function OrdersBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params?.get("tab");
  const tab: Tab = isTab(asked) ? asked : "open";
  const [rows, setRows] = useState<PoSummary[] | null>(null);
  const [meta, setMeta] = useState<PoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"list" | "calendar">("list");
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const listView = useListView("ops-orders");

  useEffect(() => {
    let alive = true;
    procurement.orders
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r.orders);
        setMeta(r.meta);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(`The orders didn't load. ${opsError(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const inTab = (o: PoSummary, t: Tab) => (t === "draft" ? o.status === "draft" || o.status === "in_approval" : t === "open" ? OPEN.includes(o.status) : true);
  const shown = all.filter((o) => inTab(o, tab));
  const late = all.filter((o) => AWAITING_DELIVERY.includes(o.status) && isPast(o.deliveryDate));
  const counts: Record<Tab, number> = { draft: all.filter((o) => inTab(o, "draft")).length, open: meta?.open ?? all.filter((o) => inTab(o, "open")).length, all: all.length };
  const go = (t: string) => router.replace(t === "open" ? "/suite/operations/procurement/orders" : `/suite/operations/procurement/orders?tab=${t}`, { scroll: false });

  const events: CalendarEvent[] = all
    .filter((o) => AWAITING_DELIVERY.includes(o.status) && o.deliveryDate)
    .map((o) => ({
      id: o.id,
      date: o.deliveryDate as string,
      title: o.vendor ?? "Vendor",
      meta: o.number ?? "",
      hue: isPast(o.deliveryDate) ? "rose" : o.kind === "lso" ? "grape" : "sky",
      href: `/suite/operations/procurement/orders/${o.id}`,
    }));

  /* The orders as listed: this tab, the search and the sort. */
  const exportCsv = (list: PoSummary[]) =>
    downloadCsv(csvName("purchase-orders", tab === "all" ? "" : tab), [
      ["Number", "Type", "Vendor", "From request", "Project", "Delivery by", "Subtotal", "VAT", "Total", "Currency", "Status", "Raised by", "Raised on"],
      ...list.map((o) => [
        o.number ?? "",
        o.kind === "lso" ? "Services" : "Goods",
        o.vendor ?? "",
        o.prNumber ?? "",
        o.project ? [o.project.code, o.project.name].filter(Boolean).join(" ") : "",
        csvDate(o.deliveryDate),
        csvAmount(o.subtotal),
        csvAmount(o.vat),
        csvAmount(o.total),
        o.currency,
        poStatus(o.status).label,
        o.createdBy ?? "",
        csvDate(o.createdAt),
      ]),
    ]);

  const columns: Column<PoSummary>[] = [
    {
      key: "vendor",
      header: "Order",
      primary: true,
      sortable: true,
      value: (o) => `${o.vendor ?? ""} ${o.number ?? ""}`,
      render: (o) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{o.vendor ?? "Vendor"}</span>
          <DocNo value={o.number ?? (o.kind === "lso" ? "Draft LSO" : "Draft LPO")} />
        </span>
      ),
    },
    { key: "kind", header: "Type", sortable: true, hideOnMobile: true, value: (o) => (o.kind === "lso" ? "Services" : "Goods") },
    { key: "pr", header: "From request", hideOnMobile: true, value: (o) => o.prNumber ?? "", render: (o) => (o.prNumber ? <DocNo value={o.prNumber} /> : "—") },
    {
      key: "delivery",
      header: "Delivery by",
      sortable: true,
      value: (o) => o.deliveryDate ?? "",
      render: (o) =>
        o.deliveryDate ? <span className={AWAITING_DELIVERY.includes(o.status) && isPast(o.deliveryDate) ? "font-semibold text-rose-700" : undefined}>{day(o.deliveryDate)}</span> : "—",
    },
    { key: "total", header: "Total", align: "right", sortable: true, value: (o) => o.total, render: (o) => <Money value={o.total} currency={o.currency} className="font-semibold" /> },
    { key: "status", header: "Status", sortable: true, value: (o) => o.status, render: (o) => <PoStatusChip status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        subtitle="LPOs and LSOs from the approved awards: finish the draft, send it for approval and to the vendor, and follow it to paid."
        actions={
          rows && rows.length > 0 ? (
            <Segmented
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { key: "list", label: "Orders" },
                { key: "calendar", label: "Deliveries" },
              ]}
            />
          ) : undefined
        }
        tabs={rows && view === "list" ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={go}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading the orders…</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      )}

      {rows !== null && (
        <div className="space-y-5">
          <StatGrid>
            <StatCard featured label="Open orders" value={meta?.open ?? counts.open} icon={ScrollText} hint={`${compact(meta?.openValue ?? 0)} committed`} />
            <StatCard label="Open value" value={compact(meta?.openValue ?? 0)} icon={Wallet} hue="mint" hint={<Money value={meta?.openValue ?? 0} />} />
            <StatCard label="Drafts to finish" value={meta?.drafts ?? counts.draft} icon={FilePen} hue="slate" href="/suite/operations/procurement/orders?tab=draft" hint="Terms, then send for approval" />
            <StatCard label="Deliveries overdue" value={late.length} icon={Truck} hue={late.length ? "rose" : "mint"} href="/suite/operations/procurement/receiving" hint={late.length ? "Chase the vendor or receive them" : "Nothing late"} />
          </StatGrid>

          {all.length === 0 ? (
            <Card>
              <Empty
                icon={ScrollText}
                title="No purchase orders yet"
                hint="Orders are raised when an award is approved. Source an approved request and recommend the award to get the first one."
              />
            </Card>
          ) : view === "calendar" ? (
            <Panel title="Deliveries due" subtitle="Open orders by the date the vendor is to deliver" icon={CalendarClock} hue="sky">
              <CalendarNav
                title={monthTitle(month.y, month.m)}
                onPrev={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
                onNext={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
                onToday={() => setMonth({ y: now.getFullYear(), m: now.getMonth() })}
              />
              <MonthCalendar year={month.y} month={month.m} events={events} />
              <div className="mt-4">
                <Legend
                  items={[
                    { label: "Goods", hue: "sky" },
                    { label: "Services", hue: "grape" },
                    { label: "Overdue", hue: "rose" },
                  ]}
                />
              </div>
            </Panel>
          ) : (
            <DataView
              rows={shown}
              columns={columns}
              rowKey={(o) => o.id}
              rowHref={(o) => `/suite/operations/procurement/orders/${o.id}`}
              {...listView}
              views={["table", "list"]}
              searchPlaceholder="Search vendor or order number"
              onDownload={exportCsv}
              caption="Purchase orders"
              empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">No orders in this tab.</p>}
              renderListItem={(o) => (
                <div className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{o.vendor ?? "Vendor"}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {o.number ?? "Draft"} · {o.kind === "lso" ? "Services" : "Goods"} · by {o.deliveryDate ? day(o.deliveryDate) : "—"}
                    </p>
                    <div className="mt-2">
                      <PoStatusChip status={o.status} />
                    </div>
                  </div>
                  <Money value={o.total} currency={o.currency} className="shrink-0 text-sm font-bold text-neutral-900" />
                </div>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
