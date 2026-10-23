"use client";

import { Coins, PiggyBank, Receipt } from "lucide-react";
import { ledger, type IncomeStatement } from "@/lib/api/finance-ledger-client";
import { Card, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { GroupedColumns, Legend } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { SectionBlock } from "./statement";
import { FigureRow, ReportToolbar, csvAmount, downloadCsv, filterKey, reportQuery, useLoad, useReportFilters } from "./shared";

/**
 * Statement of financial performance: income, less what it cost, the
 * surplus or deficit, and the same month by month.
 */
export default function IncomeStatementReport() {
  const [filters, setFilters] = useReportFilters();
  const is = useLoad<IncomeStatement>(() => ledger.reports.incomeStatement(reportQuery(filters)), filterKey(filters), "The income statement didn't load.");
  const d = is.data;

  const ledgerHref = (id: string) => {
    const q = new URLSearchParams(Object.entries(reportQuery({ ...filters, from: d?.from, to: d?.to })).filter(([, v]) => v) as [string, string][]).toString();
    return `/suite/finance/reports/ledger/${id}?${q}`;
  };

  const download = () => {
    if (!d) return;
    const rows: (string | number)[][] = [["Section", "Code", "Account", "Amount"]];
    const add = (name: string, s: IncomeStatement["revenue"]) => s.rows.forEach((r) => rows.push([name, r.code, r.name, csvAmount(r.amount)]));
    add("Revenue", d.revenue);
    add("Cost of revenue", d.costOfRevenue);
    add("Expenses", d.expenses);
    add("Other income", d.otherIncome);
    add("Other expenses", d.otherExpenses);
    rows.push(["Net surplus", "", "", csvAmount(d.netSurplus)]);
    downloadCsv(`income-statement-${d.from}-to-${d.to}.csv`, rows);
  };

  const income = d ? d.revenue.total + d.otherIncome.total : 0;
  const spend = d ? d.costOfRevenue.total + d.expenses.total + d.otherExpenses.total : 0;
  const c = d?.currency ?? "NGN";

  return (
    <div>
      <PageHeader eyebrow="Reports" title="Income statement" subtitle={d ? `${day(d.from)} – ${day(d.to)} · ${d.currency}` : "Financial year to date"} />
      <ReportToolbar filters={filters} onChange={setFilters} onDownload={d ? download : undefined} />
      {is.error && <LoadError text={is.error} onRetry={is.reload} />}
      {!d ? (
        !is.error && <Skeleton className="h-[30rem]" />
      ) : (
        <div className={cx("space-y-6 transition-opacity", is.loading && "opacity-60")} aria-busy={is.loading}>
          <StatGrid cols={3}>
            <StatCard label="Income" icon={Coins} hue="mint" value={compact(income, c)} />
            <StatCard label="Expenditure" icon={Receipt} hue="coral" value={compact(spend, c)} />
            <StatCard
              label={d.netSurplus < 0 ? "Deficit" : "Surplus"}
              icon={PiggyBank}
              featured
              featuredHue={d.netSurplus < 0 ? "rose" : "blue"}
              value={compact(Math.abs(d.netSurplus), c)}
              hint={income ? `${Math.round((d.netSurplus / income) * 100)}% of income` : undefined}
            />
          </StatGrid>

          {d.monthly.length > 1 && (
            <Panel title="Month by month" subtitle="Income against expenditure" actions={<Legend items={[{ label: "Income", hue: "mint" }, { label: "Expenditure", hue: "coral" }]} />} className="print:hidden">
              <GroupedColumns
                data={d.monthly.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], values: { income: m.income, spend: m.directCosts + m.expenses } }))}
                series={[
                  { key: "income", label: "Income", hue: "mint" },
                  { key: "spend", label: "Expenditure", hue: "coral" },
                ]}
                format={(v) => compact(v, c)}
                caption="Income and expenditure by month"
              />
            </Panel>
          )}

          <Card className="px-5 pb-5 sm:px-8">
            <table className="w-full text-sm">
              <caption className="sr-only">Income statement</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Amount ({d.currency})</th>
                </tr>
              </thead>
              <tbody>
                <SectionBlock title="Revenue" section={d.revenue} totalLabel="Total revenue" ledgerHref={ledgerHref} />
                {d.costOfRevenue.rows.length > 0 && (
                  <>
                    <SectionBlock title="Cost of revenue" section={d.costOfRevenue} totalLabel="Total cost of revenue" ledgerHref={ledgerHref} />
                    <FigureRow label="Gross surplus" value={d.grossSurplus} strong border="top" />
                  </>
                )}
                <SectionBlock title="Expenditure" section={d.expenses} totalLabel="Total expenditure" ledgerHref={ledgerHref} />
                <FigureRow label="Operating surplus" value={d.operatingSurplus} strong border="top" />
                {d.otherIncome.rows.length > 0 && <SectionBlock title="Other income" section={d.otherIncome} totalLabel="Total other income" ledgerHref={ledgerHref} />}
                {d.otherExpenses.rows.length > 0 && <SectionBlock title="Other expenses" section={d.otherExpenses} totalLabel="Total other expenses" ledgerHref={ledgerHref} />}
                <tr>
                  <td colSpan={2} className="pt-4" />
                </tr>
                <FigureRow label={d.netSurplus < 0 ? "Deficit for the period" : "Surplus for the period"} value={d.netSurplus} strong border="double" />
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
