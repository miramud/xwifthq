"use client";

import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import { ledger, type CashFlow, type CashFlowSection } from "@/lib/api/finance-ledger-client";
import { Card, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { Waterfall } from "@/components/workspace/charts";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { compact, day } from "@/suite/finance/lib/format";
import { FigureRow, ReportToolbar, csvAmount, downloadCsv, filterKey, useLoad, useReportFilters } from "./shared";

/**
 * Cash flow, direct method: what came in and went out of the bank and cash
 * accounts, by what it was for (operating, investing, financing), from the
 * opening cash to the closing cash.
 */

const ACTIVITIES: { key: "operating" | "investing" | "financing"; title: string; net: string }[] = [
  { key: "operating", title: "Operating activities", net: "Net cash from operating activities" },
  { key: "investing", title: "Investing activities", net: "Net cash from investing activities" },
  { key: "financing", title: "Financing activities", net: "Net cash from financing activities" },
];

export default function CashFlowReport() {
  const [filters, setFilters] = useReportFilters();
  const cf = useLoad<CashFlow>(() => ledger.reports.cashFlow({ from: filters.from, to: filters.to }), filterKey({ from: filters.from, to: filters.to }), "The cash flow didn't load.");
  const d = cf.data;
  const c = d?.currency ?? "NGN";

  const download = () => {
    if (!d) return;
    const rows: (string | number)[][] = [["Activity", "Line", "Amount"], ["", "Opening cash", csvAmount(d.openingCash)]];
    for (const a of ACTIVITIES) {
      d[a.key].rows.forEach((r) => rows.push([a.title, r.label, csvAmount(r.amount)]));
      rows.push([a.title, a.net, csvAmount(d[a.key].total)]);
    }
    rows.push(["", "Net change in cash", csvAmount(d.netChange)], ["", "Closing cash", csvAmount(d.closingCash)]);
    downloadCsv(`cash-flow-${d.from}-to-${d.to}.csv`, rows);
  };

  const inflows = d ? ACTIVITIES.reduce((s, a) => s + d[a.key].inflows, 0) : 0;
  const outflows = d ? ACTIVITIES.reduce((s, a) => s + d[a.key].outflows, 0) : 0;

  return (
    <div>
      <PageHeader eyebrow="Reports" title="Cash flow" subtitle={d ? `${day(d.from)} – ${day(d.to)} · ${d.currency} · direct method` : "Financial year to date"} />
      <ReportToolbar filters={filters} onChange={setFilters} dimensions={false} onDownload={d ? download : undefined} />
      {cf.error && <LoadError text={cf.error} onRetry={cf.reload} />}
      {!d ? (
        !cf.error && <Skeleton className="h-[30rem]" />
      ) : (
        <div className={cx("space-y-6 transition-opacity", cf.loading && "opacity-60")} aria-busy={cf.loading}>
          <StatGrid cols={3}>
            <StatCard label="Cash in" icon={ArrowDownLeft} hue="mint" value={compact(inflows, c)} />
            <StatCard label="Cash out" icon={ArrowUpRight} hue="coral" value={compact(outflows, c)} />
            <StatCard
              label="Closing cash"
              icon={Banknote}
              featured
              value={compact(d.closingCash, c)}
              hint={`${d.netChange >= 0 ? "Up" : "Down"} ${compact(Math.abs(d.netChange), c)} from ${compact(d.openingCash, c)}`}
            />
          </StatGrid>

          <Panel title="From opening to closing cash" subtitle="Each activity's net effect" className="print:hidden">
            <Waterfall
              steps={[
                { label: "Opening", value: d.openingCash, kind: "total" },
                { label: "Operating", value: d.operating.total },
                { label: "Investing", value: d.investing.total },
                { label: "Financing", value: d.financing.total },
                { label: "Closing", value: d.closingCash, kind: "total" },
              ]}
              format={(v) => compact(v, c)}
              caption="Cash from opening to closing balance"
            />
          </Panel>

          <Card className="px-5 pb-5 sm:px-8">
            <table className="w-full text-sm">
              <caption className="sr-only">Cash flow statement</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Amount ({c})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={2} className="pt-3" />
                </tr>
                <FigureRow label="Cash at the start" value={d.openingCash} strong />
                {ACTIVITIES.map((a) => (
                  <Activity key={a.key} title={a.title} net={a.net} section={d[a.key]} />
                ))}
                <tr>
                  <td colSpan={2} className="pt-4" />
                </tr>
                <FigureRow label={d.netChange >= 0 ? "Net increase in cash" : "Net decrease in cash"} value={d.netChange} strong />
                <FigureRow label="Cash at the end" value={d.closingCash} strong border="double" />
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-neutral-500 print:hidden">
            Transfers between the organisation&apos;s own bank accounts are not cash flows and are left out. Opening-balance journals count as where cash starts.
          </p>
        </div>
      )}
    </div>
  );
}

function Activity({ title, net, section }: { title: string; net: string; section: CashFlowSection }) {
  return (
    <>
      <tr>
        <th colSpan={2} scope="colgroup" className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </th>
      </tr>
      {section.rows.length === 0 && <FigureRow label="No cash moved" value={null} indent={1} muted />}
      {section.rows.map((r) => (
        <FigureRow key={r.label} label={r.label} value={r.amount} indent={1} />
      ))}
      <FigureRow label={net} value={section.total} strong border="top" />
    </>
  );
}
