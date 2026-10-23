"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlarmClock, CalendarDays, FilePenLine, Plus, ReceiptText, Scale, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type InvoiceFilter, type InvoiceSummary, type InvoicesMeta } from "@/lib/api/finance-revenue-client";
import { ButtonLink, Card, Empty, PageHeader, SearchField, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { CalendarNav, MonthCalendar, type CalendarEvent, monthTitle } from "@/components/workspace/Calendar";
import { Legend } from "@/components/workspace/charts";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { INVOICE_STATUS, INVOICE_TABS, onlyRetention } from "./meta";
import { DocNo, InvoiceStatusChip, LateChip, RetentionChip, useListView } from "./ui";

/**
 * The invoice register. Tabs follow an invoice from draft to paid (or void);
 * the strip above says what is owed, what is late and what has been billed
 * this year. "Due dates" lays the same invoices on a month calendar, so the
 * weeks money should arrive in are plain to see.
 */

type Tab = InvoiceFilter | "all";
const isTab = (v: string | null | undefined): v is Tab => INVOICE_TABS.some((t) => t.key === v);

export default function InvoicesBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const status = params?.get("status");
  const tab: Tab = isTab(status) ? status : "all";
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [result, setResult] = useState<{ key: string; rows: InvoiceSummary[] | null; meta: InvoicesMeta | null; error: string | null }>({
    key: "",
    rows: null,
    meta: null,
    error: null,
  });
  const [reload, setReload] = useState(0);
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const key = `${tab}|${reload}`;
  useEffect(() => {
    let alive = true;
    revenue.invoices
      .list({ status: tab === "all" ? undefined : tab })
      .then((r) => alive && setResult({ key, rows: r.invoices, meta: r.meta, error: null }))
      .catch((e: unknown) => alive && setResult((s) => ({ ...s, key, error: revenueError(e, "The invoices didn't load.") })));
    return () => {
      alive = false;
    };
    // `key` carries the tab and the reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = result.key !== key;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (result.rows ?? []).filter(
      (i) => !needle || `${i.invoiceNo ?? "draft"} ${i.client ?? ""} ${i.project?.name ?? ""} ${i.project?.code ?? ""}`.toLowerCase().includes(needle),
    );
  }, [result.rows, q]);
  const outstanding = shown.reduce((s, i) => s + (i.status === "void" || i.status === "draft" ? 0 : i.outstanding), 0);
  const meta = result.meta;
  const canCreate = mayDo(user, "invoices", "create");
  const listView = useListView("finance-invoices");
  const go = (t: string) => router.replace(t === "all" ? "/suite/finance/revenue/invoices" : `/suite/finance/revenue/invoices?status=${t}`, { scroll: false });

  /* The tab and the search, as listed. */
  const exportCsv = (list: InvoiceSummary[]) =>
    downloadCsv(`invoices${tab === "all" ? "" : `_${tab}`}.csv`, [
      ["Invoice", "Date", "Due", "Client", "Project", "Status", "Currency", "Subtotal", "VAT", "Total", "Retention", "Settled", "Outstanding", "Retention held", "Days late"],
      ...list.map((i) => [
        i.invoiceNo ?? "Draft",
        csvDate(i.date),
        csvDate(i.dueOn),
        i.client ?? "",
        i.project ? [i.project.code, i.project.name].filter(Boolean).join(" ") : "",
        INVOICE_STATUS[i.status]?.label ?? i.status,
        i.currency || "NGN",
        csvAmount(i.subtotal),
        csvAmount(i.vat),
        csvAmount(i.total),
        csvAmount(i.retention),
        csvAmount(i.settled),
        csvAmount(i.outstanding),
        csvAmount(i.retentionHeld),
        i.daysLate,
      ]),
    ]);

  const columns: Column<InvoiceSummary>[] = [
    {
      key: "no",
      header: "Invoice",
      sortable: true,
      value: (i) => i.invoiceNo ?? "",
      render: (i) => (
        <span className="block">
          {i.invoiceNo ? <DocNo value={i.invoiceNo} /> : <span className="text-[13px] font-semibold italic text-neutral-500">Draft</span>}
          <span className="mt-0.5 block text-xs text-neutral-500">{day(i.date)}</span>
        </span>
      ),
    },
    {
      key: "client",
      header: "Client",
      primary: true,
      sortable: true,
      value: (i) => i.client ?? "",
      render: (i) => (
        <span className="block min-w-[12rem] max-w-sm">
          <span className="block truncate font-medium text-neutral-900">{i.client ?? "No client"}</span>
          {i.project && (
            <span className="mt-0.5 block truncate text-xs text-neutral-500">
              {i.project.code && <span className="font-mono">{i.project.code} · </span>}
              {i.project.name}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      hideOnMobile: true,
      value: (i) => i.dueOn ?? "",
      render: (i) => (
        <span className="flex flex-col items-start gap-1">
          <span className="whitespace-nowrap text-neutral-700">{day(i.dueOn)}</span>
          {onlyRetention(i) && i.status !== "void" ? <RetentionChip /> : <LateChip days={i.daysLate} />}
        </span>
      ),
    },
    { key: "status", header: "Status", sortable: true, value: (i) => INVOICE_STATUS[i.status]?.label, render: (i) => <InvoiceStatusChip status={i.status} /> },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      hideOnMobile: true,
      value: (i) => i.total,
      render: (i) => <span className="whitespace-nowrap tabular-nums text-neutral-700">{amount(i.total, i.currency as CurrencyCode)}</span>,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      sortable: true,
      value: (i) => (i.status === "void" ? 0 : i.outstanding),
      render: (i) => (
        <span className={cx("whitespace-nowrap font-semibold tabular-nums", i.daysLate > 0 && !onlyRetention(i) ? "text-rose-700" : "text-neutral-900")}>
          {i.status === "void" || i.status === "draft" ? "-" : amount(i.outstanding, i.currency as CurrencyCode)}
        </span>
      ),
    },
  ];

  const events = useMemo<CalendarEvent[]>(() => {
    return shown
      .filter((i) => i.dueOn && i.status !== "void" && i.status !== "draft")
      .map((i) => {
        const paid = i.status === "paid";
        const held = !paid && onlyRetention(i);
        const late = !paid && !held && i.daysLate > 0;
        return {
          id: i.id,
          date: i.dueOn as string,
          title: `${i.invoiceNo ?? "Invoice"} · ${compact(paid ? i.total : i.outstanding, i.currency as CurrencyCode)}${held ? " retention" : ""}`,
          meta: i.client ?? undefined,
          hue: paid ? "mint" : late ? "rose" : held ? "slate" : "sky",
          status: paid ? "done" : late ? "overdue" : "upcoming",
          href: `/suite/finance/revenue/invoices/${i.id}`,
        } satisfies CalendarEvent;
      });
  }, [shown]);

  const shift = (d: number) =>
    setMonth(({ y, m }) => {
      const n = m + d;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });

  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Invoices"
        subtitle="Every invoice from draft to paid. An invoice is numbered and posted when it is issued; a mistake is voided, never deleted."
        actions={
          canCreate && (
            <ButtonLink href="/suite/finance/revenue/invoices/new" variant="primary" icon={Plus}>
              New invoice
            </ButtonLink>
          )
        }
        tabs={INVOICE_TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === "draft" && meta ? meta.drafts : t.key === tab && result.rows ? result.rows.length : undefined }))}
        activeTab={tab}
        onTab={go}
      />

      {meta ? (
        <StatGrid cols={4}>
          <StatCard featured label="Outstanding" value={compact(meta.outstanding)} icon={Scale} hint="Owed on issued invoices, retention included" href="/suite/finance/revenue/invoices?status=open" />
          <StatCard
            label="Overdue"
            value={compact(meta.overdue)}
            icon={AlarmClock}
            hue={meta.overdue ? "rose" : "mint"}
            hint={meta.overdue ? "Past its due date" : "Nothing late"}
            href="/suite/finance/revenue/invoices?status=overdue"
          />
          <StatCard label="Invoiced this year" value={compact(meta.invoicedThisYear)} icon={TrendingUp} hue="sky" hint="Issued, before VAT" />
          <StatCard label="Drafts" value={meta.drafts} icon={FilePenLine} hue={meta.drafts ? "sun" : "slate"} hint={meta.drafts ? "Waiting to be issued" : "None waiting"} href="/suite/finance/revenue/invoices?status=draft" />
        </StatGrid>
      ) : (
        !result.error && <Skeleton className="h-28" />
      )}

      <div className="ws-card mb-4 mt-6 flex flex-wrap items-center gap-3 p-4">
        <SearchField value={q} onChange={setQ} placeholder="Search number, client or project" label="Search invoices" className="w-full sm:w-80" />
        <Segmented
          label="Show invoices as"
          value={view}
          onChange={setView}
          options={[
            { key: "list", label: "List" },
            { key: "calendar", label: "Due dates" },
          ]}
        />
        <p className="ml-auto text-right text-sm text-neutral-600" aria-live="polite">
          {result.rows && (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">{shown.length}</span> {shown.length === 1 ? "invoice" : "invoices"} ·{" "}
              <span className="font-semibold tabular-nums text-neutral-900">{amount(outstanding)}</span> outstanding
            </>
          )}
        </p>
      </div>

      {result.error && <LoadError text={result.error} onRetry={() => setReload((n) => n + 1)} />}

      {result.rows === null ? (
        !result.error && <Skeleton className="h-80" />
      ) : view === "calendar" ? (
        <Card className="p-4 sm:p-5">
          <CalendarNav title={monthTitle(month.y, month.m)} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => setMonth({ y: now.getFullYear(), m: now.getMonth() })}>
            <CalendarDays size={16} className="text-neutral-400" aria-hidden />
          </CalendarNav>
          <MonthCalendar year={month.y} month={month.m} events={events} maxPerDay={3} />
          <div className="mt-4">
            <Legend
              items={[
                { label: "Due, not yet late", hue: "sky" },
                { label: "Late", hue: "rose" },
                { label: "Only retention left", hue: "slate" },
                { label: "Paid", hue: "mint" },
              ]}
            />
          </div>
          {events.length === 0 && <p className="mt-3 text-sm text-neutral-500">No issued invoices {q ? "match" : "on this tab"}, so nothing is due.</p>}
        </Card>
      ) : (
        <div className={cx("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(i) => i.id}
            rowHref={(i) => `/suite/finance/revenue/invoices/${i.id}`}
            {...listView}
            views={["table", "list"]}
            searchable={false}
            caption="Invoices"
            onDownload={exportCsv}
            empty={
              <Empty
                icon={ReceiptText}
                title={q || tab !== "all" ? "No invoices here" : "No invoices yet"}
                hint={
                  q || tab !== "all"
                    ? "Try another tab or clear the search."
                    : "Raise one from a contract's accepted milestone, or start a new invoice for any client."
                }
                action={
                  !q &&
                  tab === "all" &&
                  canCreate && (
                    <ButtonLink href="/suite/finance/revenue/invoices/new" variant="primary" icon={Plus}>
                      New invoice
                    </ButtonLink>
                  )
                }
              />
            }
          />
        </div>
      )}
    </div>
  );
}
