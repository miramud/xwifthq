"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Contact, HandCoins, Lock, Scale } from "lucide-react";
import { revenue, revenueError, type ClientSummary } from "@/lib/api/finance-revenue-client";
import { Card, Chip, Empty, PageHeader, SearchField, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { useListView } from "./ui";

/**
 * Every client we bill: what their contracts are worth, what has been
 * invoiced and received, and what they still owe (retention included).
 * Each row opens the client's statement of account.
 */

/* Money columns are the base currency (the API converts at the booked rates); older payloads were the client's one currency. */
const money = (v: number, c: ClientSummary) => amount(v, (c.baseCurrency ?? c.currency ?? undefined) as CurrencyCode | undefined);

/** A client dealing in other currencies than the base: each currency's own figure for a column. */
const perCurrency = (c: ClientSummary, k: "contractValue" | "invoiced" | "received" | "outstanding"): string | null => {
  const rows = (c.byCurrency ?? []).filter((x) => x[k] !== 0);
  if (rows.length === 0 || (rows.length === 1 && rows[0].currency === (c.baseCurrency ?? c.currency))) return null;
  return rows.map((x) => amount(x[k], x.currency as CurrencyCode)).join(" · ");
};

function Cell({ c, k, strong = false }: { c: ClientSummary; k: "contractValue" | "invoiced" | "received" | "outstanding"; strong?: boolean }) {
  const parts = perCurrency(c, k);
  return (
    <span className="flex flex-col items-end">
      <span className={cx("whitespace-nowrap tabular-nums", strong ? "font-semibold text-neutral-900" : "text-neutral-700")}>{money(c[k], c)}</span>
      {parts && <span className="whitespace-nowrap text-xs tabular-nums text-neutral-500">{parts}</span>}
    </span>
  );
}

export default function ClientsBoard() {
  const [rows, setRows] = useState<ClientSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const listView = useListView("finance-clients");

  useEffect(() => {
    let alive = true;
    revenue.clients.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(revenueError(e, "The clients didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? (rows ?? []).filter((c) => c.client.toLowerCase().includes(needle)) : (rows ?? []);
  }, [rows, q]);

  const totals = useMemo(
    () =>
      (rows ?? []).reduce(
        (t, c) => ({ outstanding: t.outstanding + c.outstanding, overdue: t.overdue + c.overdue, retention: t.retention + c.retention, owing: t.owing + (c.outstanding > 0 ? 1 : 0) }),
        { outstanding: 0, overdue: 0, retention: 0, owing: 0 },
      ),
    [rows],
  );

  const header = <PageHeader eyebrow="Revenue" title="Clients" subtitle="Who we bill, what they have paid and what they still owe. Open a client for their statement." />;

  if (error && !rows)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!rows)
    return (
      <div>
        {header}
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );

  /* As listed, after the search. */
  const exportCsv = (list: ClientSummary[]) =>
    downloadCsv("clients.csv", [
      ["Client", "Contracts", "Contract value", "Invoices", "Invoiced", "Received", "WHT", "Outstanding", "Retention", "Overdue", "Currency", "Last receipt"],
      ...list.map((c) => [
        c.client,
        c.contracts,
        csvAmount(c.contractValue),
        c.invoices,
        csvAmount(c.invoiced),
        csvAmount(c.received),
        csvAmount(c.wht),
        csvAmount(c.outstanding),
        csvAmount(c.retention),
        csvAmount(c.overdue),
        c.currency || "NGN",
        csvDate(c.lastReceipt),
      ]),
    ]);

  const columns: Column<ClientSummary>[] = [
    {
      key: "client",
      header: "Client",
      primary: true,
      sortable: true,
      value: (c) => c.client,
      render: (c) => (
        <span className="block min-w-[12rem]">
          <span className="block font-semibold text-neutral-900">{c.client}</span>
          <span className="block text-xs text-neutral-500">
            {c.contracts === 1 ? "1 contract" : `${c.contracts} contracts`} · {c.invoices === 1 ? "1 invoice" : `${c.invoices} invoices`}
          </span>
        </span>
      ),
    },
    { key: "value", header: "Contract value", align: "right", sortable: true, hideOnMobile: true, value: (c) => c.contractValue, render: (c) => <Cell c={c} k="contractValue" /> },
    { key: "invoiced", header: "Invoiced", align: "right", sortable: true, value: (c) => c.invoiced, render: (c) => <Cell c={c} k="invoiced" /> },
    { key: "received", header: "Received", align: "right", sortable: true, value: (c) => c.received, render: (c) => <Cell c={c} k="received" /> },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      sortable: true,
      value: (c) => c.outstanding,
      render: (c) => (
        <span className="flex flex-col items-end gap-0.5">
          <Cell c={c} k="outstanding" strong />
          {c.overdue > 0 && (
            <Chip hue="rose" icon={AlarmClock}>
              {compact(c.overdue)} overdue
            </Chip>
          )}
        </span>
      ),
    },
    { key: "retention", header: "Retention held", align: "right", sortable: true, hideOnMobile: true, value: (c) => c.retention, render: (c) => <span className="whitespace-nowrap tabular-nums text-neutral-700">{money(c.retention, c)}</span> },
    {
      key: "last",
      header: "Last receipt",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.lastReceipt ?? "",
      render: (c) => <span className="whitespace-nowrap text-neutral-600">{c.lastReceipt ? day(c.lastReceipt) : "None yet"}</span>,
    },
  ];

  return (
    <div>
      {header}
      <StatGrid cols={4}>
        <StatCard featured label="Outstanding" value={compact(totals.outstanding)} icon={Scale} hint={`${totals.owing} ${totals.owing === 1 ? "client owes" : "clients owe"}`} />
        <StatCard label="Overdue" value={compact(totals.overdue)} icon={AlarmClock} hue="rose" hint="Past the due date" />
        <StatCard label="Retention held" value={compact(totals.retention)} icon={Lock} hue="grape" hint="Due on completion" />
        <StatCard label="Clients" value={String(rows.length)} icon={Contact} hue="sky" hint="With contracts, invoices or receipts" />
      </StatGrid>

      <div className="mb-4 mt-6">
        <SearchField value={q} onChange={setQ} placeholder="Search clients" label="Search clients" className="w-full sm:max-w-sm" />
      </div>

      <DataView
        rows={shown}
        columns={columns}
        rowKey={(c) => c.clientId}
        rowHref={(c) => `/suite/finance/revenue/clients/${c.clientId}`}
        {...listView}
        views={["table", "list"]}
        searchable={false}
        caption="Clients and what they owe"
        onDownload={exportCsv}
        empty={
          <Card>
            <Empty
              icon={HandCoins}
              title={q ? "No clients match" : "No clients yet"}
              hint={q ? "Try another name." : "Clients appear here once they have a contract, an issued invoice or a receipt."}
            />
          </Card>
        }
      />
    </div>
  );
}
