"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, HandCoins, Plus, Scale, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { revenue, revenueError, type ClientStatement as Statement, type StatementEntry } from "@/lib/api/finance-revenue-client";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, Segmented, StatCard, StatGrid, buttonClass, cx } from "@/components/workspace/kit";
import { HUE, hueFor } from "@/components/workspace/modules";
import { DataView, type Column } from "@/components/workspace/DataView";
import { AreaLine } from "@/components/workspace/charts";
import { BackLink, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, compact, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { STATEMENT_KIND } from "./meta";
import { useListView } from "./ui";
import SendTo from "@/suite/org/components/foundations/SendTo";

/**
 * One client's account with us, oldest first: invoices raise the balance;
 * receipts, the WHT they deducted and voided invoices bring it down. The
 * line above the table follows the balance over time.
 *
 * A client who pays in several currencies has a statement per currency -
 * each with its own running balance, never added to another - chosen above
 * the figures, with every currency's balance (and its base equivalent at the
 * statement date's rate) side by side.
 */

type Row = StatementEntry & { n: number };

export default function ClientStatement({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [s, setS] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const listView = useListView("finance-client-statement");
  const [picked, setPicked] = useState<string | null>(null);
  const sections = s?.currencies ?? [];
  const multi = sections.length > 1;
  const section = multi ? (sections.find((x) => x.currency === picked) ?? sections[0]) : null;
  const entries = section ? section.entries : (s?.entries ?? []);

  useEffect(() => {
    let alive = true;
    revenue.receivables.statement(clientId, { from: from || null, to: to || null }).then(
      (x) => {
        if (!alive) return;
        setS(x);
        setError(null);
      },
      (e: unknown) => alive && setError(revenueError(e, "The statement didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [clientId, reload, from, to]);

  const rows = useMemo<Row[]>(() => entries.map((e, n) => ({ ...e, n })), [entries]);
  const sums = useMemo(() => {
    const by = (k: StatementEntry["kind"]) => rows.filter((r) => r.kind === k);
    return {
      invoiced: by("invoice").reduce((t, r) => t + r.debit, 0),
      received: by("receipt").reduce((t, r) => t + r.credit, 0),
      wht: by("wht").reduce((t, r) => t + r.credit, 0),
    };
  }, [rows]);
  const trend = useMemo(() => rows.map((r) => ({ label: day(r.date), value: r.balance })), [rows]);

  if (error)
    return (
      <div>
        <BackLink href="/suite/finance/revenue/clients" label="Clients" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!s)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );

  const cur = (section?.currency ?? s.currency ?? "NGN") as CurrencyCode;
  const money = (v: number) => compact(v, cur);
  const balance = section ? section.closing : s.balance;
  const opening = section ? section.opening : (s.opening ?? 0);
  const closing = section ? section.closing : (s.closing ?? s.balance);
  const base = (s.baseCurrency ?? "NGN") as CurrencyCode;

  const href = (r: Row) => (r.kind === "receipt" || r.kind === "wht" ? `/suite/finance/revenue/receipts/${r.id}` : `/suite/finance/revenue/invoices/${r.id}`);

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", value: (r) => r.date ?? "", render: (r) => <span className="whitespace-nowrap text-neutral-700">{day(r.date)}</span> },
    {
      key: "ref",
      header: "Entry",
      primary: true,
      value: (r) => r.reference ?? "",
      render: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <Chip hue={STATEMENT_KIND[r.kind]?.hue ?? "slate"}>{STATEMENT_KIND[r.kind]?.label ?? r.kind}</Chip>
          <span className="font-mono text-[13px] text-neutral-900">{r.reference}</span>
          {r.kind === "invoice" && r.dueOn && <span className="text-xs text-neutral-500">due {day(r.dueOn)}</span>}
          {r.kind === "wht" && r.status === "expected" && <span className="text-xs text-sun-700">credit note due</span>}
        </span>
      ),
    },
    { key: "debit", header: "Charged", align: "right", value: (r) => r.debit, render: (r) => <span className="tabular-nums text-neutral-800">{accounting(r.debit, true)}</span> },
    { key: "credit", header: "Paid or credited", align: "right", value: (r) => r.credit, render: (r) => <span className="tabular-nums text-neutral-800">{accounting(r.credit, true)}</span> },
    { key: "balance", header: "Balance", align: "right", value: (r) => r.balance, render: (r) => <span className="font-semibold tabular-nums text-neutral-900">{accounting(r.balance)}</span> },
  ];

  return (
    <div>
      <BackLink href="/suite/finance/revenue/clients" label="Clients" />
      <PageHeader
        eyebrow="Client statement"
        title={s.client}
        subtitle="Every issued invoice and every receipt, with what they owe after each."
        actions={
          <>
            <a
              href={revenue.receivables.statementPdfUrl(s.clientId, { from: from || null, to: to || null })}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary")}
            >
              <Download size={17} aria-hidden />
              Statement PDF
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {mayDo(user, "invoices", "create") && (
              <ButtonLink href={`/suite/finance/revenue/invoices/new?client=${s.clientId}`} icon={Plus}>
                New invoice
              </ButtonLink>
            )}
            {mayDo(user, "receipts", "create") && (multi ? sections.some((x) => x.closing > 0) : s.balance > 0) && (
              <ButtonLink href={`/suite/finance/revenue/receipts/new?client=${s.clientId}`} variant="primary" icon={HandCoins}>
                Record a receipt
              </ButtonLink>
            )}
          </>
        }
      />
      <SendTo counterpartyId={s.clientId} label="Statements go to" className="-mt-3 mb-5" />

      {multi && (
        <section aria-label="Balance in each currency" className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sections.map((x) => (
              <Card key={x.currency} className={cx("p-4", x.currency === section?.currency && "ring-2 ring-primary-200")}>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <span className={cx("h-2.5 w-2.5 rounded-full", HUE[hueFor(x.currency)].bar)} aria-hidden />
                  {x.closing < 0 ? "In credit" : "Owes"} in {x.currency}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{amount(Math.abs(x.closing), x.currency as CurrencyCode)}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {x.currency === base ? "Base currency" : x.closingBase !== null ? `${amount(x.closingBase, base)} at ${x.rate}` : `No ${x.currency} rate recorded`}
                </p>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Statement currency"
              options={sections.map((x) => ({ key: x.currency, label: x.currency }))}
              value={section?.currency ?? sections[0].currency}
              onChange={(v) => setPicked(v)}
            />
            <p className="text-sm text-neutral-500">Each currency is its own statement. All together: {amount(s.balance, base)} in {base}.</p>
          </div>
        </section>
      )}

      <StatGrid cols={4}>
        <StatCard
          featured
          label={balance < 0 ? "In credit" : multi ? `They owe in ${cur}` : "They owe"}
          value={money(Math.abs(balance))}
          icon={Scale}
          hint={balance < 0 ? "Paid ahead of invoices" : balance === 0 ? "All square" : "Retention included"}
        />
        <StatCard label="Invoiced" value={money(sums.invoiced)} icon={FileText} hue="sky" hint="Issued, with VAT" />
        <StatCard label="Received" value={money(sums.received)} icon={HandCoins} hue="mint" />
        <StatCard label="WHT deducted" value={money(sums.wht)} icon={FileText} hue="grape" hint="Credit notes from the client" />
      </StatGrid>

      <div className="ws-card mt-6 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cx(inputClass, "w-[10.5rem]")} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cx(inputClass, "w-[10.5rem]")} />
        </label>
        {(from || to) && (
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Whole account
          </Button>
        )}
        <p className="ml-auto text-right text-sm text-neutral-600" aria-live="polite">
          {from && (
            <>
              Opening <span className="font-semibold tabular-nums text-neutral-900">{accounting(opening)}</span> ·{" "}
            </>
          )}
          Closing <span className="font-semibold tabular-nums text-neutral-900">{accounting(closing)}</span>
          {multi && <span className="text-neutral-500"> {cur}</span>}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={FileText}
            title={from || to ? "Nothing in these dates" : "Nothing on this account yet"}
            hint={from || to ? "Widen the dates, or show the whole account." : "Issued invoices and receipts for this client appear here."}
          />
        </Card>
      ) : (
        <>
          {rows.length > 1 && (
            <Panel title="Balance over time" icon={Scale} className="mt-6">
              <AreaLine data={trend} format={(v) => money(v)} caption={`${s.client}'s balance after each entry${multi ? `, in ${cur}` : ""}`} height={170} />
            </Panel>
          )}
          <div className="mt-6">
            <DataView
              rows={rows}
              columns={columns}
              rowKey={(r) => `${r.kind}-${r.id}-${r.n}`}
              rowHref={href}
              {...listView}
              views={["table", "list"]}
              searchable={false}
              caption={`${s.client}: statement of account${multi ? ` in ${cur}` : ""}`}
            />
          </div>
        </>
      )}
    </div>
  );
}
