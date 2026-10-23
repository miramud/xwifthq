"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, HandCoins, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type ReceiptSummary } from "@/lib/api/finance-revenue-client";
import { ButtonLink, Chip, Empty, PageHeader, SearchField, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { DocNo, useListView } from "./ui";

/**
 * Money in, newest first: who paid, into which account, how much, and how it
 * was spread - the invoices it settled, the WHT the client deducted and
 * whatever was left as an advance.
 */

type Tab = "posted" | "void" | "all";

export default function ReceiptsBoard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReceiptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("posted");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    revenue.receipts.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(revenueError(e, "The receipts didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (tab === "all" || r.status === tab) &&
        (!needle || `${r.receiptNo ?? ""} ${r.client ?? ""} ${r.reference ?? ""} ${r.allocations.map((a) => a.invoiceNo).join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [all, tab, q]);
  const total = shown.reduce((s, r) => s + (r.status === "void" ? 0 : r.cash), 0);
  const canCreate = mayDo(user, "receipts", "create");
  const listView = useListView("finance-receipts");

  /* The tab and the search, as listed. */
  const exportCsv = (list: ReceiptSummary[]) =>
    downloadCsv(`receipts${tab === "all" ? "" : `_${tab}`}.csv`, [
      ["Receipt", "Date", "Client", "Paid into", "Reference", "Status", "Currency", "Cash", "WHT", "Retention", "Unallocated", "Invoices", "WHT credit note", "Credit note reference", "Voided at", "Void reason"],
      ...list.map((r) => [
        r.receiptNo ?? "",
        csvDate(r.date),
        r.client ?? "",
        r.bankAccount ?? "",
        r.reference ?? "",
        r.status === "void" ? "Void" : "Posted",
        r.currency || "NGN",
        csvAmount(r.cash),
        csvAmount(r.wht),
        csvAmount(r.retention),
        csvAmount(r.unallocated),
        r.allocations.map((a) => a.invoiceNo).filter(Boolean).join("; "),
        r.whtCreditNote === "received" ? "Received" : r.whtCreditNote === "expected" ? "Expected" : "",
        r.whtCreditNoteRef ?? "",
        csvDate(r.voidedAt),
        r.voidReason ?? "",
      ]),
    ]);

  const columns: Column<ReceiptSummary>[] = [
    {
      key: "no",
      header: "Receipt",
      sortable: true,
      value: (r) => r.receiptNo ?? "",
      render: (r) => (
        <span className="block">
          <DocNo value={r.receiptNo} />
          <span className="mt-0.5 block text-xs text-neutral-500">{day(r.date)}</span>
        </span>
      ),
    },
    {
      key: "client",
      header: "Client",
      primary: true,
      sortable: true,
      value: (r) => r.client ?? "",
      render: (r) => (
        <span className="block min-w-[12rem] max-w-sm">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-900">{r.client}</span>
            {r.status === "void" && (
              <Chip hue="rose" icon={Ban}>
                Void
              </Chip>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {r.allocations.length ? `Settles ${r.allocations.map((a) => a.invoiceNo ?? "an invoice").join(", ")}` : "Not applied to an invoice"}
          </span>
        </span>
      ),
    },
    {
      key: "bank",
      header: "Into",
      hideOnMobile: true,
      value: (r) => r.bankAccount ?? "",
      render: (r) => (
        <span className="block whitespace-nowrap text-neutral-600">
          {r.bankAccount}
          {r.reference && <span className="block font-mono text-xs text-neutral-500">{r.reference}</span>}
        </span>
      ),
    },
    {
      key: "wht",
      header: "WHT",
      align: "right",
      hideOnMobile: true,
      value: (r) => r.wht,
      render: (r) => (
        <span className="block whitespace-nowrap tabular-nums text-neutral-600">
          {r.wht ? amount(r.wht, r.currency as CurrencyCode) : "-"}
          {r.whtCreditNote === "expected" && <span className="block text-xs text-sun-700">Credit note due</span>}
        </span>
      ),
    },
    {
      key: "advance",
      header: "Advance",
      align: "right",
      hideOnMobile: true,
      tableOnly: true,
      value: (r) => r.unallocated,
      render: (r) => <span className="whitespace-nowrap tabular-nums text-neutral-600">{r.unallocated ? amount(r.unallocated, r.currency as CurrencyCode) : "-"}</span>,
    },
    {
      key: "cash",
      header: "Received",
      align: "right",
      sortable: true,
      value: (r) => r.cash,
      render: (r) => (
        <span className={cx("whitespace-nowrap font-semibold tabular-nums", r.status === "void" ? "text-neutral-500 line-through" : "text-neutral-900")}>
          {amount(r.cash, r.currency as CurrencyCode)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Receipts"
        subtitle="Money in from clients, each spread over the invoices it settles. A receipt keyed in error is voided and its invoices reopen."
        actions={
          canCreate && (
            <ButtonLink href="/suite/finance/revenue/receipts/new" variant="primary" icon={Plus}>
              Record a receipt
            </ButtonLink>
          )
        }
        tabs={[
          { key: "posted", label: "Posted", count: rows ? all.filter((r) => r.status === "posted").length : undefined },
          { key: "void", label: "Void", count: rows ? all.filter((r) => r.status === "void").length : undefined },
          { key: "all", label: "All", count: rows ? all.length : undefined },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="ws-card mb-4 flex flex-wrap items-center gap-3 p-4">
        <SearchField value={q} onChange={setQ} placeholder="Search number, client, reference or invoice" label="Search receipts" className="w-full sm:w-96" />
        <p className="ml-auto text-right text-sm text-neutral-600" aria-live="polite">
          {rows && (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "receipt" : "receipts"} ·{" "}
              <span className="font-semibold tabular-nums text-neutral-900">{amount(total)}</span> received
            </>
          )}
        </p>
      </div>

      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}

      {rows === null ? (
        !error && <Skeleton className="h-80" />
      ) : (
        <DataView
          rows={shown}
          columns={columns}
          rowKey={(r) => r.id}
          rowHref={(r) => `/suite/finance/revenue/receipts/${r.id}`}
          {...listView}
          views={["table", "list"]}
          searchable={false}
          caption="Receipts"
          onDownload={exportCsv}
          empty={
            <Empty
              icon={HandCoins}
              title={q || tab !== "posted" ? "No receipts here" : "No receipts yet"}
              hint={q || tab !== "posted" ? "Try another tab or clear the search." : "When a client pays, record the money and spread it over their invoices."}
              action={
                !q &&
                tab === "posted" &&
                canCreate && (
                  <ButtonLink href="/suite/finance/revenue/receipts/new" variant="primary" icon={Plus}>
                    Record a receipt
                  </ButtonLink>
                )
              }
            />
          }
        />
      )}
    </div>
  );
}
