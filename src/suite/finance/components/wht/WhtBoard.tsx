"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleCheckBig, FileBadge2, HandCoins, Landmark, TriangleAlert } from "lucide-react";
import { Card, Chip, Empty, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { errorText, wht, type WhtMonth, type WhtYear } from "@/lib/api/finance-wht-client";
import { WhtCertificates } from "./WhtCertificates";
import { owing, whtStatus } from "./meta";

/**
 * Finance › WHT (Finance PRD §11.12, §13): the withholding tax deducted from
 * suppliers, month by month, and whether each month has gone to the tax
 * authority. A month is raised once it has ended (due the 21st of the next);
 * raising it sends a system memo through FCU → voucher → payment. The
 * certificates tab gives each supplier proof of what was withheld.
 */

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function WhtBoard() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState<"remittances" | "certificates">("remittances");
  const [data, setData] = useState<WhtYear | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    wht.year(year).then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`WHT remittances didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [year, reload]);

  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => String(thisYear - i)), [thisYear]);

  const header = (
    <PageHeader
      eyebrow="Spend"
      title="Withholding tax"
      subtitle="WHT deducted from suppliers, remitted to the tax authority month by month, and certified to each supplier."
      tabs={[
        { key: "remittances", label: "Remittances" },
        { key: "certificates", label: "Supplier certificates" },
      ]}
      activeTab={tab}
      onTab={(k) => setTab(k as typeof tab)}
      actions={
        <SearchableSelect
          value={String(year)}
          onChange={(v) => v && setYear(Number(v))}
          options={years.map((y) => ({ value: y, label: y }))}
          searchPlaceholder="Search years"
          aria-label="Year"
          className="w-32"
        />
      }
    />
  );

  if (tab === "certificates")
    return (
      <div>
        {header}
        <WhtCertificates year={year} />
      </div>
    );

  if (error && !data)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );

  if (!data || data.year !== year)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading WHT remittances…</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="mb-5 h-36" />
        <Skeleton className="h-80" />
      </div>
    );

  const due = owing(data.months);
  const overdue = data.months.filter((m) => m.overdue);
  const remittedPct = data.totals.wht > 0 ? Math.round((data.totals.remitted / data.totals.wht) * 100) : 0;

  return (
    <div>
      {header}
      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label={`Deducted in ${year}`} value={compact(data.totals.wht)} icon={HandCoins} hint={`On ${compact(data.totals.gross)} of supplier invoices`} />
          <StatCard label="Remitted" value={compact(data.totals.remitted)} icon={CircleCheckBig} hue="mint" hint={`${remittedPct}% of what was deducted`} />
          <StatCard label="Not yet remitted" value={compact(data.totals.outstanding)} icon={Landmark} hue="grape" hint="Raised, to raise, or this month so far" />
          <StatCard
            label="Months to raise"
            value={due.length}
            icon={overdue.length > 0 ? TriangleAlert : CalendarClock}
            hue={overdue.length > 0 ? "coral" : "sun"}
            hint={overdue.length > 0 ? `${overdue.length} past the 21st` : due[0] ? `Next due ${day(due[0].dueOn)}` : "Nothing waiting"}
          />
        </StatGrid>

        <MonthStrip year={year} months={data.months} />

        <MonthsTable months={data.months} currency={data.currency} year={year} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The year as twelve tiles, one per month: what was deducted and where it
 * stands. Months still to come are hatched ("not yet"); a month past its
 * due date without a memo carries a coral edge.
 */
export function MonthStrip({ year, months }: { year: number; months: WhtMonth[] }) {
  const byPeriod = new Map(months.map((m) => [m.period, m]));

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight text-neutral-900">{year} at a glance</h2>
        <p className="text-xs text-neutral-500">Each month is due to the tax authority by the 21st of the next.</p>
      </div>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12" aria-label={`WHT by month, ${year}`}>
        {SHORT.map((short, i) => {
          const period = `${year}-${String(i + 1).padStart(2, "0")}`;
          const m = byPeriod.get(period);

          if (!m)
            return (
              <li key={period} className="ws-hatch flex min-h-[92px] flex-col justify-between rounded-xl border border-neutral-200/80 p-2.5" aria-label={`${short}: not yet`}>
                <span className="text-xs font-semibold text-neutral-500">{short}</span>
                <span className="text-[11px] text-neutral-500">Not yet</span>
              </li>
            );

          const s = whtStatus(m.status, m.overdue);
          const Icon = s.icon;
          return (
            <li key={period}>
              <Link
                href={`/suite/finance/wht/${period}`}
                className={cx(
                  "group flex min-h-[92px] flex-col justify-between rounded-xl border bg-white p-2.5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
                  m.overdue ? "border-coral-500/60 border-l-4" : "border-neutral-200/80",
                  m.status === "open" && "ws-hatch",
                )}
                aria-label={`${m.label}: ${m.wht > 0 ? compact(m.wht) : "no WHT"}, ${s.label}`}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-neutral-700">{short}</span>
                  <Icon size={14} aria-hidden className="text-neutral-500" />
                </span>
                <span className={cx("text-sm font-bold tabular-nums", m.wht > 0 ? "text-neutral-900" : "text-neutral-500")}>{m.wht > 0 ? compact(m.wht) : "-"}</span>
                <span className="truncate text-[11px] font-medium text-neutral-600">{s.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function MonthsTable({ months, currency, year }: { months: WhtMonth[]; currency: string; year: number }) {
  const columns: Column<WhtMonth>[] = [
    {
      key: "label",
      header: "Month",
      primary: true,
      sortable: true,
      value: (m) => m.period,
      render: (m) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">{m.label}</span>
          <span className="block text-xs text-neutral-500">Due {day(m.dueOn)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (m) => whtStatus(m.status, m.overdue).label,
      render: (m) => {
        const s = whtStatus(m.status, m.overdue);
        return (
          <Chip hue={s.hue} icon={s.icon}>
            {s.label}
          </Chip>
        );
      },
    },
    { key: "suppliers", header: "Suppliers", align: "right", sortable: true, hideOnMobile: true, value: (m) => m.supplierCount },
    { key: "lines", header: "Voucher lines", align: "right", sortable: true, hideOnMobile: true, value: (m) => m.lineCount },
    { key: "gross", header: "Gross", align: "right", sortable: true, hideOnMobile: true, value: (m) => m.gross, render: (m) => <Money value={m.gross} currency={currency} className="text-neutral-600" /> },
    { key: "wht", header: "WHT", align: "right", sortable: true, value: (m) => m.wht, render: (m) => <Money value={m.wht} currency={currency} className="font-semibold text-neutral-900" /> },
    { key: "memo", header: "Memo", hideOnMobile: true, value: (m) => m.memoReference ?? "", render: (m) => <span className="font-mono text-xs text-neutral-600">{m.memoReference ?? "-"}</span> },
  ];

  return (
    <section aria-labelledby="wht-months">
      <h2 id="wht-months" className="mb-3 text-base font-bold tracking-tight text-neutral-900">
        Months
      </h2>
      {months.length === 0 ? (
        <Card>
          <Empty icon={FileBadge2} title={`Nothing for ${year} yet`} hint="WHT appears here once a voucher with a WHT line is approved." />
        </Card>
      ) : (
        <DataView
          rows={months}
          columns={columns}
          rowKey={(m) => m.period}
          rowHref={(m) => `/suite/finance/wht/${m.period}`}
          views={["table", "list"]}
          storageKey="finance.wht.months"
          caption={`WHT by month, ${year}`}
          searchable={false}
          onDownload={(list) =>
            downloadCsv(`wht-months-${year}.csv`, [
              ["Month", "Status", "Due by", "Suppliers", "Voucher lines", "Currency", "Gross", "WHT", "Memo"],
              ...list.map((m) => [m.period, whtStatus(m.status, m.overdue).label, csvDate(m.dueOn), m.supplierCount, m.lineCount, currency, csvAmount(m.gross), csvAmount(m.wht), m.memoReference ?? ""]),
            ])
          }
        />
      )}
    </section>
  );
}
