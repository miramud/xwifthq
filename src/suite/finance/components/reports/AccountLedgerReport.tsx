"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Scale } from "lucide-react";
import { ledger, type AccountLedger } from "@/lib/api/finance-ledger-client";
import { Card, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { AreaLine } from "@/components/workspace/charts";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { accounting, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { typeLabel } from "../accounts/meta";
import { journalTypeLabel } from "../journals/meta";
import { ReportToolbar, csvAmount, downloadCsv, filterKey, num, rangeText, reportQuery, useLoad, useReportFilters } from "./shared";

/**
 * One account's postings in date order with a running balance, read the way
 * the account is normally read (credits positive on a liability or income
 * account), each line linking to its journal.
 */

export default function AccountLedgerReport({ accountId }: { accountId: string }) {
  const [filters, setFilters] = useReportFilters();
  const lg = useLoad<AccountLedger>(() => ledger.reports.ledger(accountId, reportQuery(filters)), `${accountId}|${filterKey(filters)}`, "The ledger didn't load.");
  const d = lg.data;
  const c = d?.currency ?? "NGN";
  const credit = d?.account.normalBalance === "credit";
  /** Debit-positive → as the account is read. */
  const read = (v: number) => (credit ? -v : v);
  /** Which side a debit-positive balance sits on. */
  const side = (v: number) => (v === 0 ? "" : v > 0 ? " Dr" : " Cr");

  const debits = d ? d.lines.reduce((s, l) => s + l.debit, 0) : 0;
  const credits = d ? d.lines.reduce((s, l) => s + l.credit, 0) : 0;

  /* The balance at each month end, for the trend line. */
  const trend = (() => {
    if (!d || d.lines.length < 2) return [];
    const byMonth = new Map<string, number>();
    for (const l of d.lines) byMonth.set(l.date.slice(0, 7), l.balance);
    return [...byMonth.entries()].map(([m, v]) => ({ label: monthLabel(m, true).split(" ")[0], value: read(v) }));
  })();

  const download = () => {
    if (!d) return;
    const rows: (string | number)[][] = [["Date", "Journal", "Type", "Narration", "Debit", "Credit", "Balance (debit positive)"]];
    rows.push(["", "", "", "Opening balance", "", "", csvAmount(d.opening)]);
    d.lines.forEach((l) => rows.push([l.date, l.journalNo ?? "", journalTypeLabel(l.type), l.narration ?? "", csvAmount(l.debit), csvAmount(l.credit), csvAmount(l.balance)]));
    rows.push(["", "", "", "Closing balance", "", "", csvAmount(d.closing)]);
    downloadCsv(`ledger-${d.account.code}.csv`, rows);
  };

  return (
    <div>
      <BackLink href="/suite/finance/accounts" label="Chart of accounts" />
      <PageHeader
        eyebrow={d ? typeLabel(d.account.type) : "Account ledger"}
        title={d ? `${d.account.code} ${d.account.name}` : "Account ledger"}
        subtitle={`${rangeText(filters.from, filters.to)}${d ? ` · ${c}${d.account.currency && d.account.currency !== c ? `, held in ${d.account.currency}` : ""}` : ""}`}
      />
      <ReportToolbar filters={filters} onChange={setFilters} onDownload={d ? download : undefined} />
      {lg.error && <LoadError text={lg.error} onRetry={lg.reload} />}
      {!d ? (
        !lg.error && <Skeleton className="h-[30rem]" />
      ) : (
        <div className={cx("space-y-6 transition-opacity", lg.loading && "opacity-60")} aria-busy={lg.loading}>
          <StatGrid>
            <StatCard label="Opening balance" icon={BookOpen} hue="slate" value={compact(read(d.opening), c)} />
            <StatCard label="Debits" icon={ArrowDownLeft} hue="blue" value={compact(debits, c)} />
            <StatCard label="Credits" icon={ArrowUpRight} hue="grape" value={compact(credits, c)} />
            <StatCard label="Closing balance" icon={Scale} featured value={compact(read(d.closing), c)} hint={`${d.lines.length} postings`} />
          </StatGrid>

          {trend.length > 1 && (
            <Panel title="Balance at each month end" className="print:hidden">
              <AreaLine data={trend} format={(v) => compact(v, c)} caption={`${d.account.name} balance by month`} height={170} />
            </Panel>
          )}

          <Card className="overflow-hidden">
            {d.lines.length === 0 ? (
              <Empty icon={BookOpen} title="Nothing posted to this account in the range" hint="Widen the dates or clear the filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">
                    Postings to {d.account.code} {d.account.name}
                  </caption>
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/70 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="w-28 py-3 pl-5 pr-2 text-left">
                        Date
                      </th>
                      <th scope="col" className="w-32 px-2 py-3 text-left">
                        Journal
                      </th>
                      <th scope="col" className="px-2 py-3 text-left">
                        Narration
                      </th>
                      <th scope="col" className={cx(num, "px-2 py-3")}>
                        Debit
                      </th>
                      <th scope="col" className={cx(num, "px-2 py-3")}>
                        Credit
                      </th>
                      <th scope="col" className={cx(num, "py-3 pl-2 pr-5")}>
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-100 bg-neutral-50/40 font-medium text-neutral-700">
                      <td className="py-2 pl-5 pr-2" />
                      <td className="px-2 py-2" />
                      <th scope="row" className="px-2 py-2 text-left">
                        Opening balance
                      </th>
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2" />
                      <td className={cx(num, "py-2 pl-2 pr-5")}>
                        {accounting(Math.abs(d.opening))}
                        <span className="text-xs text-neutral-500">{side(d.opening)}</span>
                      </td>
                    </tr>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.journalId}-${i}`} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                        <td className="whitespace-nowrap py-2 pl-5 pr-2 tabular-nums text-neutral-600">{day(l.date)}</td>
                        <td className="px-2 py-2">
                          <Link href={`/suite/finance/journals/${l.journalId}`} className="rounded font-mono text-[13px] text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                            {l.journalNo ?? "Journal"}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-neutral-800">
                          {l.narration}
                          {l.txnCurrency && l.txnCurrency !== c && (
                            <span className="ml-2 text-xs tabular-nums text-neutral-500">
                              {l.txnCurrency} {accounting(l.txnAmount)}
                            </span>
                          )}
                        </td>
                        <td className={cx(num, "px-2 py-2 text-neutral-800")}>{accounting(l.debit, true)}</td>
                        <td className={cx(num, "px-2 py-2 text-neutral-800")}>{accounting(l.credit, true)}</td>
                        <td className={cx(num, "py-2 pl-2 pr-5 font-medium text-neutral-900")}>
                          {accounting(Math.abs(l.balance))}
                          <span className="text-xs font-normal text-neutral-500">{side(l.balance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral-300 bg-neutral-50/60 font-bold text-neutral-900">
                      <th scope="row" colSpan={3} className="py-3 pl-5 text-left">
                        Closing balance
                      </th>
                      <td className={cx(num, "px-2 py-3")}>{accounting(debits)}</td>
                      <td className={cx(num, "px-2 py-3")}>{accounting(credits)}</td>
                      <td className={cx(num, "py-3 pl-2 pr-5")}>
                        {accounting(Math.abs(d.closing))}
                        <span className="text-xs font-normal text-neutral-500">{side(d.closing)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
