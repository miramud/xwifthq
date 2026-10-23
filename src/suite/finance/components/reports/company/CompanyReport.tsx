"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, Lock, Printer } from "lucide-react";
import { Button, Empty, PageHeader, buttonClass, cx } from "@/components/workspace/kit";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { compact, day } from "@/suite/finance/lib/format";
import { companyReport, type CompanyReport as Report } from "@/lib/api/finance-company-report-client";
import { useLoad, useReportFilters } from "../shared";
import PeriodPicker from "./PeriodPicker";
import {
  ApprovalsChapter,
  BudgetChapter,
  CashChapter,
  CHAPTERS,
  HeadlineChapter,
  IncomeChapter,
  PayablesChapter,
  PeopleChapter,
  PositionChapter,
  ProjectsChapter,
  ReceivablesChapter,
  SpendChapter,
  TaxChapter,
} from "./sections";

/**
 * The company report: one period, every analysis Finance holds - the three
 * statements, budget, every project's expected against actual, spend, every
 * request and the person who raised it, receivables, payables, tax, assets,
 * labour and approvals. Printable from the browser, or as the branded PDF.
 */
export default function CompanyReport() {
  const { user } = useAuth();
  if (user && !mayUseFinance(user, "reports")) {
    return (
      <div>
        <PageHeader eyebrow="Reports" title="Company report" />
        <div className="ws-card">
          <Empty icon={Lock} title="This report is for Finance report holders" hint="Ask an administrator for a role that can view Finance reports." />
        </div>
      </div>
    );
  }
  return <ReportBody />;
}

function ReportBody() {
  const [filters, setFilters] = useReportFilters();
  const range = { from: filters.from, to: filters.to };
  const key = `${filters.from ?? ""}|${filters.to ?? ""}`;
  const res = useLoad<Report>(() => companyReport.get(range), key, "The company report didn't load.");
  const r = res.data;

  return (
    <div data-company-report>
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow="Reports"
        title="Company report"
        subtitle="Every analysis for one period: statements, budget, projects, spend, each request and who raised it, receivables, payables, tax, assets, labour and approvals."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <a href={companyReport.xlsxUrl(range)} download className={buttonClass("secondary")}>
              <FileSpreadsheet size={17} aria-hidden />
              Download Excel
            </a>
            <a href={companyReport.pdfUrl(range)} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
              <FileText size={17} aria-hidden />
              Print / PDF
            </a>
          </div>
        }
      />

      <div className="ws-card mb-6 p-4 print:hidden">
        <PeriodPicker from={filters.from} to={filters.to} onChange={(p) => setFilters({ from: p.from, to: p.to })} />
      </div>

      {res.error && <LoadError text={res.error} onRetry={res.reload} />}
      {!r ? (
        !res.error && (
          <div className="space-y-5" aria-busy>
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
            <Skeleton className="h-[26rem]" />
          </div>
        )
      ) : (
        <div className={cx("transition-opacity", res.loading && "opacity-60")} aria-busy={res.loading}>
          <Cover r={r} />
          <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
            <ChapterNav />
            <div className="min-w-0 space-y-12">
              <HeadlineChapter r={r} />
              <IncomeChapter r={r} />
              <PositionChapter r={r} />
              <CashChapter r={r} />
              <BudgetChapter r={r} />
              <ProjectsChapter r={r} />
              <SpendChapter r={r} />
              <PeopleChapter r={r} />
              <ReceivablesChapter r={r} />
              <PayablesChapter r={r} />
              <TaxChapter r={r} />
              <ApprovalsChapter r={r} />
              <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
                {r.organisation} · Company report · {r.periodLabel} ({day(r.from)} to {day(r.to)}) · Amounts in {r.currency}, from posted journals and the registers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- cover ------------------------------ */

/**
 * The report's first page: whose it is, which period, and the period in
 * one sentence - the verdict an owner reads before any table.
 */
function Cover({ r }: { r: Report }) {
  const h = r.headline;
  const c = r.currency;
  const deficit = h.netSurplus < 0;
  return (
    <div className="ws-card relative mb-8 overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 ws-hatch opacity-60 [mask-image:linear-gradient(to_left,black,transparent)] md:block print:hidden" aria-hidden />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">Company report · {r.periodLabel}</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[34px]">{r.organisation}</h1>
        <p className="mt-1 text-sm text-neutral-500 tabular-nums">
          {day(r.from)} to {day(r.to)} · {r.currency}
        </p>
        <p className="mt-5 max-w-4xl text-[17px] leading-relaxed text-neutral-700 sm:text-lg">
          Income of <strong className="font-semibold text-neutral-900 tabular-nums">{compact(h.income, c)}</strong> against costs of{" "}
          <strong className="font-semibold text-neutral-900 tabular-nums">{compact(h.costs, c)}</strong> left a{" "}
          <strong className={cx("font-semibold tabular-nums", deficit ? "text-rose-700" : "text-mint-700")}>
            {deficit ? "deficit" : "surplus"} of {compact(Math.abs(h.netSurplus), c)}
          </strong>
          {h.marginBp !== null && <> ({(h.marginBp / 100).toFixed(1)}% of income)</>}. Cash {h.netCashFlow < 0 ? "fell" : "rose"} to{" "}
          <strong className="font-semibold text-neutral-900 tabular-nums">{compact(h.closingCash, c)}</strong>; clients owe{" "}
          <strong className="font-semibold text-neutral-900 tabular-nums">{compact(h.receivable, c)}</strong>
          {h.overdue > 0 && <> ({compact(h.overdue, c)} overdue)</>}. {h.requests > 0 ? `${h.requests.toLocaleString("en-NG")} requests were raised by ${h.requesters.toLocaleString("en-NG")} ${h.requesters === 1 ? "person" : "people"}` : "No requests were raised"}
          {h.projects > 0 && <>, across {h.projects} {h.projects === 1 ? "project" : "projects"}{h.projectsRed > 0 && <>, {h.projectsRed} at risk</>}</>}.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- chapter nav --------------------------- */

/** The twelve sections: a rail beside the report on a wide screen, a strip above it on a phone. */
function ChapterNav() {
  const [active, setActive] = useState<string>(CHAPTERS[0].id);

  useEffect(() => {
    const root = document.getElementById("main");
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { root, rootMargin: "-15% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.getElementById(`cr-nav-${active}`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label="Report sections" className="sticky top-0 z-20 -mx-4 mb-6 border-b border-neutral-200/80 bg-canvas/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none print:hidden">
      <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 lg:block">In this report</p>
      <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {CHAPTERS.map((c, i) => {
          const on = c.id === active;
          return (
            <li key={c.id} className="shrink-0">
              <a
                id={`cr-nav-${c.id}`}
                href={`#${c.id}`}
                onClick={go(c.id)}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 lg:whitespace-normal",
                  on ? "bg-primary-50 text-primary-700" : "text-neutral-600 hover:bg-white hover:text-neutral-900",
                )}
              >
                <span className={cx("w-5 shrink-0 text-[11px] font-semibold tabular-nums", on ? "text-primary-700" : "text-neutral-400")}>{String(i + 1).padStart(2, "0")}</span>
                {c.title}
              </a>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 hidden px-3 lg:block">
        <Button size="sm" variant="ghost" icon={Printer} onClick={() => window.print()} className="-ml-3">
          Print this page
        </Button>
      </div>
    </nav>
  );
}

/*
  Printing from the browser: drop the workspace chrome (sidebar, top bar,
  this page's controls), let the page run its full length instead of
  scrolling inside the shell, start each section on a new landscape page,
  and keep the colours of bars and chips.
*/
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 12mm; }
  html, body { height: auto !important; overflow: visible !important; background: white !important; }
  body:has([data-company-report]) .ws { position: static !important; display: block !important; inset: auto !important; }
  body:has([data-company-report]) .ws > aside,
  body:has([data-company-report]) .ws > div > header { display: none !important; }
  body:has([data-company-report]) #main { overflow: visible !important; height: auto !important; }
  body:has([data-company-report]) #main > div { max-width: none !important; padding: 0 !important; }
  [data-company-report] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-company-report] .cr-chapter { break-before: page; }
  [data-company-report] .cr-chapter:first-of-type { break-before: auto; }
  [data-company-report] figure, [data-company-report] tr { break-inside: avoid; }
  [data-company-report] .ws-card { box-shadow: none !important; }
  [data-company-report] .overflow-x-auto { overflow: visible !important; }
}
`;
