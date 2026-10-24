"use client";

import { Landmark, Scale, Wallet } from "lucide-react";
import { ledger, type BalanceSheet } from "@/lib/api/finance-ledger-client";
import { Card, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { compact, day } from "@/suite/finance/lib/format";
import { SectionBlock } from "./statement";
import { BalancedChip, FigureRow, ReportToolbar, csvAmount, downloadCsv, filterKey, useLoad, useReportFilters } from "./shared";

/**
 * Statement of financial position at a date: what the organisation owns,
 * what it owes, and its net assets - including this year's surplus not yet
 * closed into reserves, so the two sides always meet.
 */
export default function BalanceSheetReport() {
  const [filters, setFilters] = useReportFilters();
  const bs = useLoad<BalanceSheet>(() => ledger.reports.balanceSheet(filters.asAt), filterKey({ asAt: filters.asAt }), "The financial position didn't load.");
  const d = bs.data;
  const c = d?.currency ?? "NGN";
  const ledgerHref = (id: string) => `/suite/finance/reports/ledger/${id}${d ? `?to=${d.asAt}` : ""}`;

  const download = () => {
    if (!d) return;
    const rows: (string | number)[][] = [["Section", "Code", "Account", "Amount"]];
    const add = (name: string, s: BalanceSheet["equity"]) => s.rows.forEach((r) => rows.push([name, r.code, r.name, csvAmount(r.amount)]));
    add("Current assets", d.currentAssets);
    add("Non-current assets", d.nonCurrentAssets);
    rows.push(["Total assets", "", "", csvAmount(d.totalAssets)]);
    add("Current liabilities", d.currentLiabilities);
    add("Non-current liabilities", d.nonCurrentLiabilities);
    rows.push(["Total liabilities", "", "", csvAmount(d.totalLiabilities)]);
    add("Net assets and reserves", d.equity);
    rows.push(["Net assets and reserves", "", "Surplus not yet closed", csvAmount(d.unclosedSurplus)]);
    rows.push(["Total net assets", "", "", csvAmount(d.totalEquity)]);
    downloadCsv(`financial-position-${d.asAt}.csv`, rows);
  };

  const gap = d ? d.totalAssets - d.totalLiabilities - d.totalEquity : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Financial position"
        subtitle={d ? `As at ${day(d.asAt)} · ${d.currency}` : "As at today"}
        actions={d && <BalancedChip balanced={d.balanced} difference={gap} currency={c} />}
      />
      <ReportToolbar filters={filters} onChange={setFilters} mode="asAt" dimensions={false} onDownload={d ? download : undefined} />
      {bs.error && <LoadError text={bs.error} onRetry={bs.reload} />}
      {!d ? (
        !bs.error && <Skeleton className="h-[30rem]" />
      ) : (
        <div className={cx("space-y-6 transition-opacity", bs.loading && "opacity-60")} aria-busy={bs.loading}>
          <StatGrid cols={3}>
            <StatCard label="Total assets" icon={Wallet} hue="sky" value={compact(d.totalAssets, c)} />
            <StatCard label="Total liabilities" icon={Landmark} hue="coral" value={compact(d.totalLiabilities, c)} />
            <StatCard label="Net assets" icon={Scale} featured featuredHue="grape" value={compact(d.totalEquity, c)} hint={`Includes ${compact(d.unclosedSurplus, c)} surplus not yet closed`} />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="px-5 pb-5 sm:px-8">
              <table className="w-full text-sm">
                <caption className="pt-5 text-left text-[15px] font-semibold text-neutral-900">What you own</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Amount ({c})</th>
                  </tr>
                </thead>
                <tbody>
                  <SectionBlock title="Current assets" section={d.currentAssets} totalLabel="Total current assets" ledgerHref={ledgerHref} />
                  <SectionBlock title="Non-current assets" section={d.nonCurrentAssets} totalLabel="Total non-current assets" ledgerHref={ledgerHref} />
                  <tr>
                    <td colSpan={2} className="pt-3" />
                  </tr>
                  <FigureRow label="Total assets" value={d.totalAssets} strong border="double" />
                </tbody>
              </table>
            </Card>
            <Card className="px-5 pb-5 sm:px-8">
              <table className="w-full text-sm">
                <caption className="pt-5 text-left text-[15px] font-semibold text-neutral-900">How it is funded</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Amount ({c})</th>
                  </tr>
                </thead>
                <tbody>
                  <SectionBlock title="Current liabilities" section={d.currentLiabilities} totalLabel="Total current liabilities" ledgerHref={ledgerHref} />
                  {d.nonCurrentLiabilities.rows.length > 0 && (
                    <SectionBlock title="Non-current liabilities" section={d.nonCurrentLiabilities} totalLabel="Total non-current liabilities" ledgerHref={ledgerHref} />
                  )}
                  <FigureRow label="Total liabilities" value={d.totalLiabilities} strong border="top" />
                  <tr>
                    <th colSpan={2} scope="colgroup" className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Net assets and reserves
                    </th>
                  </tr>
                  {d.equity.rows.map((r) => (
                    <FigureRow
                      key={r.accountId}
                      label={
                        <>
                          <span className="mr-2 font-mono text-[12px] text-neutral-500">{r.code}</span>
                          {r.name}
                        </>
                      }
                      value={r.amount}
                      indent={1}
                      href={ledgerHref(r.accountId)}
                    />
                  ))}
                  <FigureRow label={d.unclosedSurplus < 0 ? "Deficit for the year, not yet closed" : "Surplus for the year, not yet closed"} value={d.unclosedSurplus} indent={1} />
                  <FigureRow label="Total net assets" value={d.totalEquity} strong border="top" />
                  <tr>
                    <td colSpan={2} className="pt-3" />
                  </tr>
                  <FigureRow label="Liabilities and net assets" value={d.totalLiabilities + d.totalEquity} strong border="double" />
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
