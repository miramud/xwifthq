"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlarmClock, ChevronDown, ChevronRight, Download, FileCheck2, Lock, PiggyBank, Scale, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type AgedClient, type AgedReceivables, type ClientAdvance, type ClientAdvances, type WhtRegister, type WhtRegisterRow } from "@/lib/api/finance-revenue-client";
import { Button, Card, Chip, Empty, PageHeader, Panel, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { Donut, StackedColumns, hueHex } from "@/components/workspace/charts";
import { Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import ReasonDialog from "../vouchers/ReasonDialog";
import { HUE, hueFor } from "@/components/workspace/modules";
import { BUCKETS, share } from "./meta";
import { DocNo, LateChip, useListView } from "./ui";

/**
 * Who owes what, and for how long. Tiles for the whole book; one stacked
 * column per client split by age (not yet due, 1–30, 31–60, 61–90, over 90
 * days, and retention held); then each client, opened to show the invoices
 * behind their figure. The second tab is the WHT credit-note register: the
 * tax clients deducted and the credit notes still to collect for it. The
 * third is client advances: cash clients paid ahead of an invoice, receipt
 * by receipt, each opening the receipt where it is applied.
 *
 * Money owed in several currencies is never added as if it were one: the
 * tiles, chart and client figures are base currency (each invoice tranche at
 * its booked rate), and each currency's own figures sit beside them.
 */

type Tab = "aged" | "wht" | "advances";

const tabFrom = (v: string | null | undefined): Tab => (v === "wht" || v === "advances" ? v : "aged");

export default function ReceivablesBoard() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(tabFrom(params?.get("tab")));
  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Receivables"
        subtitle="What clients owe by age, the WHT credit notes they still have to send, and the advances they paid ahead."
        tabs={[
          { key: "aged", label: "Aged receivables" },
          { key: "wht", label: "WHT credit notes" },
          { key: "advances", label: "Client advances" },
        ]}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />
      {tab === "aged" ? <AgedView /> : tab === "wht" ? <WhtView /> : <AdvancesView />}
    </div>
  );
}

/* --------------------------------- aged -------------------------------- */

export function AgedView() {
  const uid = useId();
  const [asOf, setAsOf] = useState("");
  const [data, setData] = useState<{ key: string; aged: AgedReceivables | null; error: string | null }>({ key: "", aged: null, error: null });
  const [reload, setReload] = useState(0);
  const [openClient, setOpenClient] = useState<string | null>(null);

  const key = `${asOf}|${reload}`;
  useEffect(() => {
    let alive = true;
    revenue.receivables.aged(asOf || null).then(
      (aged) => alive && setData({ key, aged, error: null }),
      (e: unknown) => alive && setData((d) => ({ ...d, key, error: revenueError(e, "The aged receivables didn't load.") })),
    );
    return () => {
      alive = false;
    };
    // `key` carries the date and the reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const aged = data.aged;
  const t = aged?.totals;
  const overdue = t ? t.d30 + t.d60 + t.d90 + t.over90 : 0;
  const base = (aged?.baseCurrency ?? "NGN") as CurrencyCode;
  const currencies = t?.byCurrency ?? [];
  const foreignBook = currencies.some((c) => c.currency !== base);
  const chartData = useMemo(
    () =>
      (aged?.clients ?? []).slice(0, 12).map((c) => ({
        label: shortName(c.client ?? "Client"),
        values: Object.fromEntries(BUCKETS.map((b) => [b.key, c[b.key]])),
      })),
    [aged],
  );

  /* One row per open invoice, under its client, aged as on screen. */
  const exportCsv = () => {
    if (!aged) return;
    downloadCsv(`aged-receivables_${aged.asOf}.csv`, [
      ["As at", "Client", "Invoice", "Due", "Days late", "Age", "Currency", "Outstanding", "Retention held", `Outstanding in ${base}`],
      ...aged.clients.flatMap((c) =>
        c.invoices.map((i) => [
          csvDate(aged.asOf),
          c.client ?? "",
          i.invoiceNo ?? "",
          csvDate(i.dueOn),
          i.daysLate,
          BUCKETS.find((b) => b.key === i.bucket)?.label ?? i.bucket,
          i.currency || "NGN",
          csvAmount(i.outstanding),
          csvAmount(i.retentionHeld),
          csvAmount(i.outstandingBase ?? i.outstanding),
        ]),
      ),
    ]);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${uid}-asof`} className="mb-1.5 block text-xs font-medium text-neutral-600">
            As at
          </label>
          <input id={`${uid}-asof`} type="date" value={asOf || aged?.asOf || ""} onChange={(e) => setAsOf(e.target.value)} className={cx(inputClass, "h-10 w-44")} />
        </div>
        {asOf && (
          <Button size="sm" variant="ghost" onClick={() => setAsOf("")}>
            Back to today
          </Button>
        )}
        {aged && <p className="ml-auto text-sm text-neutral-500">Aged at {day(aged.asOf)}, by days past each invoice&apos;s due date.</p>}
        {aged && (
          <Button size="sm" icon={Download} onClick={exportCsv} disabled={aged.clients.length === 0}>
            Download CSV
          </Button>
        )}
      </div>

      {data.error && <LoadError text={data.error} onRetry={() => setReload((n) => n + 1)} />}

      {!aged || !t ? (
        !data.error && (
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-72" />
          </div>
        )
      ) : (
        <div className={cx("transition-opacity", data.key !== key && "opacity-60")} aria-busy={data.key !== key}>
          <StatGrid cols={3}>
            <StatCard
              featured
              label="Owed to us"
              value={compact(t.total, base)}
              icon={Scale}
              hint={`${aged.clients.length} ${aged.clients.length === 1 ? "client" : "clients"}${foreignBook ? ` · in ${base} at booked rates` : ""}`}
            />
            <StatCard
              label="Overdue"
              value={compact(overdue, base)}
              icon={AlarmClock}
              hue={overdue ? "rose" : "mint"}
              hint={overdue ? `${Math.round(share(overdue, t.total))}% of what is owed` : "Nothing past due"}
            />
            <StatCard label="Retention held" value={compact(t.retention, base)} icon={Lock} hue="grape" hint="Released by clients at handover" />
          </StatGrid>

          {foreignBook && <CurrencyStrip rows={currencies} base={base} />}

          {aged.clients.length === 0 ? (
            <Card className="mt-6">
              <Empty icon={Users} title="Nobody owes anything" hint={asOf ? "No invoice was open on that date." : "Every issued invoice is paid. New ones appear here once issued."} />
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Panel title="By client and age" subtitle={aged.clients.length > 12 ? "The twelve clients owing most." : "Each column is one client."} icon={Users}>
                  <StackedColumns
                    data={chartData}
                    series={BUCKETS.map((b) => ({ key: b.key, label: b.label, hue: b.hue }))}
                    format={(v) => compact(v)}
                    caption={`What each client owes by age, as at ${day(aged.asOf)}`}
                    showTotals
                    onSelect={(label) => setOpenClient(aged.clients.find((c) => shortName(c.client ?? "Client") === label)?.clientId ?? null)}
                  />
                </Panel>
                <Panel title="The whole book" icon={Scale} hue="grape">
                  <div className="flex flex-col items-center gap-5">
                    <Donut
                      data={BUCKETS.map((b) => ({ label: b.label, value: t[b.key], hue: b.hue }))}
                      total={compact(t.total)}
                      centerLabel="owed"
                      caption={`Receivables by age: ${BUCKETS.map((b) => `${b.label} ${amount(t[b.key])}`).join(", ")}`}
                      legend="none"
                      format={(v) => amount(v)}
                      size={170}
                    />
                    <BookLegend totals={t} />
                  </div>
                </Panel>
              </div>

              <section className="mt-6" aria-labelledby={`${uid}-clients`}>
                <h2 id={`${uid}-clients`} className="mb-3 text-[15px] font-semibold text-neutral-900">
                  Clients
                </h2>
                <ul className="space-y-2.5">
                  {aged.clients.map((c) => (
                    <ClientRow key={c.clientId} c={c} base={base} open={openClient === c.clientId} onToggle={() => setOpenClient((o) => (o === c.clientId ? null : c.clientId))} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The donut's legend in money: each bucket's full name (wrapping, never cut), its compact amount and share. */
function BookLegend({ totals }: { totals: AgedReceivables["totals"] }) {
  return (
    <ul className="w-full space-y-2" aria-hidden>
      {BUCKETS.map((b) => (
        <li key={b.key} className="flex items-start justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-start gap-2">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hueHex(b.hue) }} />
            <span className="break-words text-neutral-600">{b.label}</span>
          </span>
          <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900">
            {compact(totals[b.key])}
            {totals.total > 0 && <span className="ml-1 text-xs font-medium text-neutral-500">{Math.round(share(totals[b.key], totals.total))}%</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Each currency's own book: what is owed in it, overdue and held, and its base equivalent. */
export function CurrencyStrip({ rows, base }: { rows: NonNullable<AgedReceivables["totals"]["byCurrency"]>; base: CurrencyCode }) {
  return (
    <section aria-label="Owed in each currency" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((r) => {
        const c = r.currency as CurrencyCode;
        const late = r.d30 + r.d60 + r.d90 + r.over90;
        return (
          <Card key={r.currency} className="p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hueFor(r.currency)].bar)} aria-hidden />
              Owed in {r.currency}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{amount(r.total, c)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {late > 0 ? <span className="font-semibold text-rose-700">{amount(late, c)} overdue</span> : "Nothing overdue"}
              {r.retention > 0 && ` · ${amount(r.retention, c)} retention`}
              {r.currency !== base && ` · ${compact(r.base, base)} booked`}
            </p>
          </Card>
        );
      })}
    </section>
  );
}

/** "Meridian Library Services Board" → "Meridian Library…" for a column label. */
function shortName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 16).trimEnd()}…` : name;
}

function ClientRow({ c, base = "NGN", open, onToggle }: { c: AgedClient; base?: CurrencyCode; open: boolean; onToggle: () => void }) {
  const uid = useId();
  // The client's figures are base currency (each tranche at its booked rate).
  const cur = (c.byCurrency ? base : (c.invoices[0]?.currency ?? "NGN")) as CurrencyCode;
  const late = c.d30 + c.d60 + c.d90 + c.over90;
  const parts = (c.byCurrency ?? []).filter((x) => x.total > 0);
  const mixed = parts.length > 1 || parts.some((x) => x.currency !== base);
  return (
    <li className="ws-card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${uid}-inv`}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {open ? <ChevronDown size={18} className="shrink-0 text-neutral-500" aria-hidden /> : <ChevronRight size={18} className="shrink-0 text-neutral-500" aria-hidden />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-neutral-900">{c.client}</span>
            <span className="block text-xs text-neutral-500">
              {c.invoices.length} open {c.invoices.length === 1 ? "invoice" : "invoices"}
              {late > 0 && <span className="font-semibold text-rose-700"> · {amount(late, cur)} overdue</span>}
            </span>
            {mixed && (
              <span className="mt-0.5 block text-xs tabular-nums text-neutral-600">{parts.map((x) => amount(x.total, x.currency as CurrencyCode)).join(" · ")}</span>
            )}
          </span>
        </button>
        <div className="flex items-center gap-4 sm:w-[24rem]">
          <AgeBar c={c} />
          <span className="w-32 shrink-0 text-right font-semibold tabular-nums text-neutral-900">{amount(c.total, cur)}</span>
        </div>
      </div>
      {open && (
        <div id={`${uid}-inv`} className="border-t border-neutral-100 bg-neutral-50/50">
          <ul className="divide-y divide-neutral-100">
            {c.invoices.map((i) => {
              const b = BUCKETS.find((x) => x.key === i.bucket) ?? BUCKETS[0];
              const ic = (i.currency || cur) as CurrencyCode;
              return (
                <li key={i.trancheId ?? i.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem_9rem] sm:items-center">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/suite/finance/revenue/invoices/${i.id}`} className="hover:underline">
                      <DocNo value={i.invoiceNo} />
                    </Link>
                    {i.multiCurrency && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">{i.currency} part</span>}
                    <span className="text-xs text-neutral-500">due {day(i.dueOn)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Chip hue={b.hue} dot>
                      {b.label}
                    </Chip>
                    <LateChip days={i.daysLate} />
                  </span>
                  <span className="text-xs text-neutral-500 sm:text-right">{i.retentionHeld ? `Retention ${amount(i.retentionHeld, ic)}` : ""}</span>
                  <span className="font-semibold tabular-nums text-neutral-900 sm:text-right">
                    {amount(i.outstanding, ic)}
                    {i.currency !== base && i.outstandingBase !== undefined && (
                      <span className="block text-xs font-normal text-neutral-500">{amount(i.outstandingBase, base)} at {i.rate}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-3">
            <Link href={`/suite/finance/revenue/clients/${c.clientId}`} className="text-sm font-semibold text-primary-700 hover:underline">
              Open {c.client}&apos;s statement
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

/** One client's balance split by age, as a single bar; the words are in its label. */
function AgeBar({ c }: { c: AgedClient }) {
  const parts = BUCKETS.filter((b) => c[b.key] > 0);
  return (
    <span
      className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100"
      role="img"
      aria-label={parts.length ? parts.map((b) => `${b.label} ${amount(c[b.key])}`).join(", ") : "Nothing owed"}
    >
      {parts.map((b) => (
        <span key={b.key} className="h-full" style={{ width: `${share(c[b.key], c.total)}%`, background: hueHex(b.hue) }} />
      ))}
    </span>
  );
}

/* ---------------------------------- WHT -------------------------------- */

export function WhtView() {
  const { user } = useAuth();
  const [reg, setReg] = useState<WhtRegister | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [noting, setNoting] = useState<WhtRegisterRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    revenue.receipts.whtRegister().then(
      (r) => {
        if (!alive) return;
        setReg(r);
        setError(null);
      },
      (e: unknown) => alive && setError(revenueError(e, "The WHT register didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const canNote = mayDo(user, "receipts", "credit_note");
  const listView = useListView("finance-wht-register");
  const waiting = reg?.rows.filter((r) => r.creditNote === "expected") ?? [];
  const oldest = waiting.reduce((m, r) => Math.max(m, r.daysWaiting), 0);

  const columns: Column<WhtRegisterRow>[] = [
    {
      key: "receipt",
      header: "Receipt",
      sortable: true,
      value: (r) => r.receiptNo ?? "",
      render: (r) => (
        <span className="block">
          <Link href={`/suite/finance/revenue/receipts/${r.receiptId}`} className="hover:underline">
            <DocNo value={r.receiptNo} />
          </Link>
          <span className="mt-0.5 block text-xs text-neutral-500">{day(r.date)}</span>
        </span>
      ),
    },
    { key: "client", header: "Client", primary: true, sortable: true, value: (r) => r.client ?? "", render: (r) => <span className="font-medium text-neutral-900">{r.client}</span> },
    {
      key: "note",
      header: "Credit note",
      sortable: true,
      value: (r) => r.daysWaiting,
      render: (r) =>
        r.creditNote === "received" ? (
          <span className="flex flex-col items-start gap-0.5">
            <Chip hue="mint" icon={FileCheck2}>
              Received
            </Chip>
            {r.creditNoteRef && <span className="font-mono text-xs text-neutral-500">{r.creditNoteRef}</span>}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <Chip hue={r.daysWaiting > 60 ? "rose" : r.daysWaiting > 30 ? "coral" : "sun"} icon={AlarmClock}>
              Waiting {r.daysWaiting} {r.daysWaiting === 1 ? "day" : "days"}
            </Chip>
            {canNote && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setNoting(r)}
              >
                Credit note received
              </Button>
            )}
          </span>
        ),
    },
    {
      key: "wht",
      header: "WHT deducted",
      align: "right",
      sortable: true,
      value: (r) => r.wht,
      render: (r) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{amount(r.wht, r.currency as CurrencyCode)}</span>,
    },
  ];

  return (
    <div>
      <Notice text={notice} />
      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}
      {!reg ? (
        !error && <Skeleton className="h-80" />
      ) : (
        <>
          <StatGrid cols={3}>
            <StatCard featured label="Credit notes to collect" value={compact(reg.expected)} icon={AlarmClock} hint={`${waiting.length} ${waiting.length === 1 ? "receipt" : "receipts"}`} />
            <StatCard label="Credit notes received" value={compact(reg.received)} icon={FileCheck2} hue="mint" hint="Usable against tax due" />
            <StatCard label="Longest wait" value={waiting.length ? `${oldest} ${oldest === 1 ? "day" : "days"}` : "-"} icon={AlarmClock} hue={oldest > 60 ? "rose" : oldest > 30 ? "coral" : "sun"} hint="Since the money came in" />
          </StatGrid>
          <div className="mt-6">
            <DataView
              rows={reg.rows}
              columns={columns}
              rowKey={(r) => r.receiptId}
              {...listView}
              views={["table", "list"]}
              searchPlaceholder="Search client or receipt"
              caption="WHT credit notes"
              empty={<Empty icon={FileCheck2} title="No WHT deducted yet" hint="When a client pays less WHT, the receipt lands here until their credit note arrives." />}
            />
          </div>
        </>
      )}
      {noting && (
        <ReasonDialog
          title="Credit note received"
          subtitle={`For the ${amount(noting.wht, noting.currency as CurrencyCode)} WHT ${noting.client ?? "the client"} deducted on ${noting.receiptNo ?? "this receipt"}.`}
          label="Credit note reference"
          hint="As printed on the client's WHT credit note."
          confirmLabel="Save reference"
          busyLabel="Saving…"
          single
          maxLength={120}
          onConfirm={async (reference) => {
            await revenue.receipts.creditNote(noting.receiptId, reference);
            setNoting(null);
            setNotice(`Credit note recorded for ${noting.receiptNo ?? "the receipt"}.`);
            setReload((n) => n + 1);
          }}
          onClose={() => setNoting(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------- advances ------------------------------ */

export function AdvancesView() {
  const [data, setData] = useState<ClientAdvances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const listView = useListView("finance-client-advances");

  useEffect(() => {
    let alive = true;
    revenue.receivables.advances().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(revenueError(e, "The client advances didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const clients = new Set((data?.rows ?? []).map((r) => r.clientId)).size;
  const oldest = (data?.rows ?? []).reduce<string | null>((m, r) => (m === null || r.date < m ? r.date : m), null);

  const columns: Column<ClientAdvance>[] = [
    {
      key: "receipt",
      header: "Receipt",
      sortable: true,
      value: (r) => r.receiptNo ?? "",
      render: (r) => (
        <span className="block">
          <Link href={`/suite/finance/revenue/receipts/${r.receiptId}`} className="hover:underline">
            <DocNo value={r.receiptNo} />
          </Link>
          <span className="mt-0.5 block text-xs text-neutral-500">Received {day(r.date)}</span>
        </span>
      ),
    },
    { key: "client", header: "Client", primary: true, sortable: true, value: (r) => r.client ?? "", render: (r) => <span className="font-medium text-neutral-900">{r.client}</span> },
    {
      key: "cash",
      header: "Received",
      align: "right",
      sortable: true,
      value: (r) => r.cash,
      render: (r) => <span className="whitespace-nowrap tabular-nums text-neutral-600">{amount(r.cash, r.currency as CurrencyCode)}</span>,
    },
    {
      key: "held",
      header: "Still held",
      align: "right",
      sortable: true,
      value: (r) => r.held,
      render: (r) => <span className="whitespace-nowrap font-semibold tabular-nums text-neutral-900">{amount(r.held, r.currency as CurrencyCode)}</span>,
    },
  ];

  return (
    <div>
      {error && <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />}
      {!data ? (
        !error && <Skeleton className="h-80" />
      ) : (
        <>
          <StatGrid cols={3}>
            <StatCard featured label="Client advances held" value={compact(data.total)} icon={PiggyBank} hint={`${data.rows.length} ${data.rows.length === 1 ? "receipt" : "receipts"}`} />
            <StatCard label="Clients with an advance" value={String(clients)} icon={Users} hue="grape" hint="Apply it from the receipt" />
            <StatCard label="Held since" value={oldest ? day(oldest) : "-"} icon={AlarmClock} hue="sun" hint="The oldest advance" />
          </StatGrid>
          <div className="mt-6">
            <DataView
              rows={data.rows}
              columns={columns}
              rowKey={(r) => r.receiptId}
              {...listView}
              views={["table", "list"]}
              searchPlaceholder="Search client or receipt"
              caption="Client advances"
              empty={<Empty icon={PiggyBank} title="No advances held" hint="When a client pays more than their open invoices, the extra is held here until it is applied." />}
            />
          </div>
        </>
      )}
    </div>
  );
}
