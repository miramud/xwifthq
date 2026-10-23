"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { ledger, type TrialBalance } from "@/lib/api/finance-ledger-client";
import { Card, Empty, PageHeader, Segmented, cx } from "@/components/workspace/kit";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { accounting } from "@/suite/finance/lib/format";
import { familyMeta, familyOf } from "../accounts/meta";
import { BalancedChip, ReportToolbar, csvAmount, downloadCsv, filterKey, num, rangeText, reportQuery, useLoad, useReportFilters } from "./shared";

/**
 * Every account with a balance or a movement in the range: debit and credit
 * columns, totals, and whether the two sides agree. A row opens its ledger
 * for the same dates.
 */

type Layout = "closing" | "full";

export default function TrialBalanceReport() {
  const [filters, setFilters] = useReportFilters();
  const [layout, setLayout] = useState<Layout>("closing");
  const tb = useLoad<TrialBalance>(() => ledger.reports.trialBalance(reportQuery(filters)), filterKey(filters), "The trial balance didn't load.");

  const ledgerHref = (id: string) => {
    const q = new URLSearchParams(Object.entries(reportQuery(filters)).filter(([, v]) => v) as [string, string][]).toString();
    return `/suite/finance/reports/ledger/${id}${q ? `?${q}` : ""}`;
  };

  const download = () => {
    if (!tb.data) return;
    const head = ["Code", "Account", "Opening debit", "Opening credit", "Debit", "Credit", "Closing debit", "Closing credit"];
    const rows = tb.data.rows.map((r) => [r.code, r.name, csvAmount(r.openingDebit), csvAmount(r.openingCredit), csvAmount(r.debit), csvAmount(r.credit), csvAmount(r.closingDebit), csvAmount(r.closingCredit)]);
    const t = tb.data.totals;
    rows.push(["", "Totals", csvAmount(t.openingDebit), csvAmount(t.openingCredit), csvAmount(t.debit), csvAmount(t.credit), csvAmount(t.closingDebit), csvAmount(t.closingCredit)]);
    downloadCsv(`trial-balance-${filters.to ?? new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows]);
  };

  const cols: { key: keyof TrialBalance["totals"]; label: string }[] =
    layout === "closing"
      ? [
          { key: "closingDebit", label: "Debit" },
          { key: "closingCredit", label: "Credit" },
        ]
      : [
          { key: "openingDebit", label: "Opening Dr" },
          { key: "openingCredit", label: "Opening Cr" },
          { key: "debit", label: "Debit" },
          { key: "credit", label: "Credit" },
          { key: "closingDebit", label: "Closing Dr" },
          { key: "closingCredit", label: "Closing Cr" },
        ];

  const d = tb.data;
  const diff = d ? d.totals.closingDebit - d.totals.closingCredit : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Trial balance"
        subtitle={`${rangeText(filters.from, filters.to)}${d ? ` · ${d.currency}` : ""}`}
        actions={d && <BalancedChip balanced={d.balanced} difference={diff} currency={d.currency} />}
      />
      <ReportToolbar filters={filters} onChange={setFilters} onDownload={d ? download : undefined}>
        <div className="self-end">
          <Segmented<Layout>
            label="Columns"
            value={layout}
            onChange={setLayout}
            options={[
              { key: "closing", label: "Closing balances" },
              { key: "full", label: "With movements" },
            ]}
          />
        </div>
      </ReportToolbar>

      {tb.error && <LoadError text={tb.error} onRetry={tb.reload} />}
      {!d ? (
        !tb.error && <Skeleton className="h-[28rem]" />
      ) : d.rows.length === 0 ? (
        <Card>
          <Empty icon={BookOpenCheck} title="Nothing posted in this range" hint="Widen the dates or clear the filters." />
        </Card>
      ) : (
        <Card className={cx("overflow-hidden transition-opacity print:shadow-none", tb.loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" aria-busy={tb.loading}>
              <caption className="sr-only">Trial balance, {rangeText(filters.from, filters.to)}</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="w-24 py-3 pl-5 pr-2 text-left">
                    Code
                  </th>
                  <th scope="col" className="px-2 py-3 text-left">
                    Account
                  </th>
                  {cols.map((c, i) => (
                    <th key={c.key} scope="col" className={cx(num, "py-3", i === cols.length - 1 ? "pl-2 pr-5" : "px-2")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => {
                  const fam = familyOf(r.type);
                  const header = i === 0 || familyOf(d.rows[i - 1].type) !== fam;
                  return (
                    <Fragment key={r.accountId}>
                      {header && (
                        <tr className="bg-neutral-50/40">
                          <th colSpan={2 + cols.length} scope="colgroup" className="py-2 pl-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            {familyMeta(fam).label}
                          </th>
                        </tr>
                      )}
                      <tr className="border-b border-neutral-100 hover:bg-neutral-50/60">
                        <td className="py-2 pl-5 pr-2 font-mono text-[13px] tabular-nums text-neutral-500">{r.code}</td>
                        <th scope="row" className="px-2 py-2 text-left font-medium">
                          <Link href={ledgerHref(r.accountId)} className="rounded text-neutral-900 outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                            {r.name}
                          </Link>
                        </th>
                        {cols.map((c, i) => (
                          <td key={c.key} className={cx(num, "py-2 text-neutral-800", i === cols.length - 1 ? "pl-2 pr-5" : "px-2")}>
                            {accounting(r[c.key], true)}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50/60 font-bold text-neutral-900">
                  <th scope="row" colSpan={2} className="py-3 pl-5 text-left">
                    Totals
                  </th>
                  {cols.map((c, i) => (
                    <td key={c.key} className={cx(num, "border-b-[3px] border-double border-neutral-400 py-3", i === cols.length - 1 ? "pl-2 pr-5" : "px-2")}>
                      {accounting(d.totals[c.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
