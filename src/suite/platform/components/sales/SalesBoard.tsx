"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Coins, CreditCard, Landmark, Package, Receipt, ShoppingBag, Ticket } from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Segmented, StatGrid, Toolbar } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AreaLine, StatusBars } from "@/components/workspace/charts";
import { StatCard, Skeleton } from "@/suite/lms/components/ui/ws";
import { OrgMark } from "@/suite/org/components/ui";
import type { Paginated } from "@/lib/api/platform-client";
import {
  ApiError,
  platformSales,
  type SalesInterval,
  type SalesOrder,
  type SalesReport,
} from "@/lib/api/platform-commerce-client";
import { gatewayLabel } from "@/lib/api/platform-billing-client";
import { LoadError, moduleHue, naira, nairaCompact, PageSkeleton, Pager, When } from "../ui";
import OneTimeSalesView from "./OneTimeSalesView";
import LicenceLedgerView from "./LicenceLedgerView";
import { formatMoney } from "@/lib/money";
import { minorOf } from "@/lib/api/platform-commerce-client";

type OrgRow = SalesReport["byOrganisation"][number];

const INTERVALS: { key: SalesInterval; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

const ORDER_HUE: Record<string, "mint" | "sun" | "rose" | "slate"> = {
  paid: "mint",
  pending: "sun",
  failed: "rose",
  cancelled: "slate",
  refunded: "slate",
};

const ORDER_KIND_LABEL: Record<string, string> = {
  module: "Modules",
  seats: "Seats",
  signup: "New organisation",
  renewal: "Renewal",
  course: "Course",
  licence: "Module licence",
};

const dateInput =
  "h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-sm text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-300";

type SalesView = "revenue" | "one-time" | "licences";

const VIEWS: { key: SalesView; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "one-time", label: "One-time sales" },
  { key: "licences", label: "Licence ledger" },
];

/**
 * Money coming in: modules and seats sold to organisations, what the platform
 * kept, which gateway it came through, and every order behind the totals. The
 * One-time sales view is the ladder side (26 Sep 2026): how far up the ladder
 * organisations buy, self-serve sign-ups, and requests for source code and
 * dedicated servers. Recurring figures (MRR, renewals) were retired with
 * subscriptions. `?view=subscriptions` from an old link lands on it. The
 * Licence ledger (27 Sep 2026) is every paid module sale, online and licensed
 * by hand, for finance to audit and download.
 */
export default function SalesBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search?.get("view");
  const view: SalesView =
    requested === "one-time" || requested === "subscriptions"
      ? "one-time"
      : requested === "licences"
        ? "licences"
        : "revenue";

  const [interval, setIntervalKey] = useState<SalesInterval>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Paginated<SalesOrder> | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const range = { from: from || undefined, to: to || undefined };

  const loadReport = useCallback(() => {
    platformSales
      .report({ from: from || undefined, to: to || undefined, interval })
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Sales didn't load."));
  }, [from, to, interval]);

  const loadOrders = useCallback(() => {
    platformSales
      .orders({ from: from || undefined, to: to || undefined, status: status || undefined, page, perPage: 20 })
      .then((o) => {
        setOrders(o);
        setOrdersError(null);
      })
      .catch((e: unknown) => setOrdersError(e instanceof ApiError ? e.message : "Orders didn't load."));
  }, [from, to, status, page]);

  // The one-time view loads its own figures; the revenue report and the
  // orders only load where they are shown.
  useEffect(() => {
    if (view === "revenue") loadReport();
  }, [loadReport, view]);

  useEffect(() => {
    if (view === "revenue") loadOrders();
  }, [loadOrders, view]);

  const orgColumns: Column<OrgRow>[] = [
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
    { key: "orders", header: "Orders", align: "right", sortable: true, value: (r) => r.orders, render: (r) => <span className="tabular-nums">{r.orders}</span> },
    { key: "gross", header: "Gross", align: "right", sortable: true, value: (r) => r.grossKobo, render: (r) => <span className="font-semibold tabular-nums">{naira(r.grossKobo)}</span> },
  ];

  const orderColumns: Column<SalesOrder>[] = [
    {
      key: "created",
      header: "Date",
      value: (o) => o.paidAt ?? o.createdAt,
      render: (o) => <When at={o.paidAt ?? o.createdAt} className="whitespace-nowrap text-neutral-600" />,
    },
    {
      key: "what",
      header: "Order",
      primary: true,
      value: (o) => o.reference ?? o.id,
      render: (o) => (
        <span className="min-w-0">
          <span className="block font-medium text-neutral-900">
            {ORDER_KIND_LABEL[o.kind] ?? o.kind}
            {o.channel && (
              <span className="font-normal text-neutral-500">
                {" · "}
                {o.channel === "offline" ? "by hand" : "online"}
                {o.purchaseKind && `, ${o.purchaseKind === "upgrade" ? "upgrade" : "new"}`}
                {typeof o.modulesAfter === "number" && ` to ${o.modulesAfter} modules`}
              </span>
            )}
          </span>
          <span className="block truncate font-mono text-xs text-neutral-500">
            {o.reference ?? "No reference"}
            {o.kind === "licence" && o.paymentReference && ` · paid ref ${o.paymentReference}`}
          </span>
        </span>
      ),
    },
    {
      key: "who",
      header: "Customer",
      value: (o) => o.organisation?.name ?? o.customer?.name ?? "",
      render: (o) =>
        o.organisation ? (
          <Link
            href={`/suite/platform/organisations/${encodeURIComponent(o.organisation.slug)}`}
            className="text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            {o.organisation.name}
          </Link>
        ) : (
          <span className="min-w-0">
            <span className="block truncate">{o.customer?.name ?? "-"}</span>
            <span className="block truncate text-xs text-neutral-500">{o.customer?.email}</span>
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      value: (o) => o.status,
      render: (o) => (
        <Chip hue={ORDER_HUE[o.status] ?? "slate"} dot>
          <span className="capitalize">{o.status}</span>
        </Chip>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      value: (o) => minorOf(o.amountMinor, o.amountKobo) ?? 0,
      render: (o) => (
        <span className="font-semibold tabular-nums">{formatMoney(minorOf(o.amountMinor, o.amountKobo), o.currency)}</span>
      ),
    },
  ];

  const header = (
    <PageHeader
      eyebrow="Commerce"
      title="Sales"
      subtitle="Modules and seats sold, what the platform kept, and every order behind the totals."
      tabs={VIEWS}
      activeTab={view}
      onTab={(k) => router.replace(k === "revenue" ? (pathname ?? "/suite/platform/sales") : `${pathname}?view=${k}`)}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={dateInput} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={dateInput} />
          </label>
        </div>
      }
    />
  );

  if (view === "licences") {
    return (
      <div className="space-y-6">
        {header}
        <LicenceLedgerView from={range.from} to={range.to} />
      </div>
    );
  }

  if (view === "one-time") {
    return (
      <div className="space-y-6">
        {header}
        <OneTimeSalesView from={range.from} to={range.to} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {error ? (
        <LoadError
          message={error}
          onRetry={() => {
            setError(null);
            loadReport();
          }}
        />
      ) : !report ? (
        <PageSkeleton stats={4} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard featured featuredHue="mint" icon={Coins} label="Gross sales" value={nairaCompact(report.totals.grossKobo)} hint={`${report.totals.orders.toLocaleString("en-NG")} orders`} />
            <StatCard icon={Landmark} hue="blue" label="Platform fee" value={nairaCompact(report.totals.platformFeeKobo)} hint="What the platform kept" />
            <StatCard icon={Building2} hue="sun" label="Paid to organisations" value={nairaCompact(report.totals.netToOrganisationsKobo)} />
            <StatCard icon={Ticket} hue="grape" label="Seats sold" value={report.totals.seatsSold.toLocaleString("en-NG")} />
          </StatGrid>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Revenue"
              subtitle="Gross takings per period"
              icon={Receipt}
              hue="mint"
              actions={<Segmented label="Interval" value={interval} onChange={setIntervalKey} options={INTERVALS} />}
            >
              {report.series.length < 2 ? (
                <p className="py-12 text-center text-sm text-neutral-500">The trend shows once there are two periods of sales.</p>
              ) : (
                <AreaLine
                  data={report.series.map((p) => ({ label: p.period, value: p.grossKobo / 100 }))}
                  hue="mint"
                  format={(v) => nairaCompact(v * 100)}
                  caption="Gross revenue per period"
                  height={220}
                />
              )}
            </Panel>
            <Panel title="By product" subtitle="Gross takings by what was sold" icon={Package} hue="grape">
              {report.byProduct.length === 0 ? (
                <p className="py-10 text-center text-sm text-neutral-500">No sales in this period.</p>
              ) : (
                <StatusBars
                  caption="Gross by product"
                  format={(v) => nairaCompact(v)}
                  data={report.byProduct.map((p) => ({
                    label: p.label,
                    value: p.grossKobo,
                    hue: p.kind === "module" ? moduleHue(p.module ?? p.label) : p.kind === "seats" ? "sun" : "grape",
                    note: `${p.orders} orders`,
                  }))}
                />
              )}
            </Panel>
          </div>

          {report.byGateway && report.byGateway.length > 0 && (
            <Panel title="By gateway" subtitle="Gross takings by the gateway the money came through" icon={CreditCard} hue="sky">
              <StatusBars
                caption="Gross by payment gateway"
                format={(v) => nairaCompact(v)}
                data={report.byGateway.map((g) => ({
                  label: gatewayLabel(g.gateway),
                  value: g.grossKobo,
                  hue: g.gateway === "flutterwave" ? "sun" : "sky",
                  note: `${g.orders} orders`,
                }))}
              />
            </Panel>
          )}

          <section aria-labelledby="sales-by-org">
            <h2 id="sales-by-org" className="mb-4 text-lg font-bold tracking-tight text-neutral-900">
              By organisation
            </h2>
            <DataView
              rows={report.byOrganisation}
              columns={orgColumns}
              rowKey={(r) => r.slug}
              views={["table", "list"]}
              storageKey="platform.sales.orgs"
              caption="Sales by organisation"
              searchPlaceholder="Search organisations…"
              empty={
                <Card>
                  <Empty icon={Building2} title="No organisation sales in this period" hint="Widen the dates, or check the orders below." />
                </Card>
              }
            />
          </section>
        </>
      )}

      <section aria-labelledby="sales-orders" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="sales-orders" className="text-lg font-bold tracking-tight text-neutral-900">
            Orders
          </h2>
          <Toolbar>
            <Segmented
              label="Order status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { key: "", label: "All" },
                { key: "paid", label: "Paid" },
                { key: "pending", label: "Pending" },
                { key: "failed", label: "Failed" },
              ]}
            />
          </Toolbar>
        </div>
        {ordersError ? (
          <LoadError
            message={ordersError}
            onRetry={() => {
              setOrdersError(null);
              loadOrders();
            }}
          />
        ) : !orders ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <DataView
              rows={orders.data}
              columns={orderColumns}
              rowKey={(o) => o.id}
              views={["table", "list"]}
              storageKey="platform.sales.orders"
              caption="Orders"
              searchable={false}
              empty={
                <Card>
                  <Empty icon={ShoppingBag} title="No orders" hint={status || range.from || range.to ? "Nothing matches these filters." : "Orders show up here as organisations and learners pay."} />
                </Card>
              }
            />
            <Pager page={orders.meta.currentPage} lastPage={orders.meta.lastPage} total={orders.meta.total} onPage={setPage} noun="orders" />
          </>
        )}
      </section>
    </div>
  );
}
