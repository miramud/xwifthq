"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Info, Landmark, LineChart, Receipt, Search, Users } from "lucide-react";
import { Button, Chip, Empty, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { MultiLine, StatusBars, type LineSeries } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import { StatCard } from "@/suite/lms/components/ui/ws";
import type { StatementAnalysis } from "@/lib/api/finance-banking-client";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { CHECK_STATUS } from "@/suite/finance/components/banking/labels";

/**
 * Where the money went, for one statement or an account over a range: the
 * daily balance against the low-balance line, money in by source and out by
 * category and project, bank charges with the VAT audit, who was paid and who
 * paid, and the things worth a question.
 */

const RAMP: Hue[] = ["blue", "mint", "grape", "sky", "coral", "sun", "rose", "slate"];

const short = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
};

export default function AnalysisView({
  data,
  threshold,
  onShowLines,
}: {
  data: StatementAnalysis;
  /** The account's low-balance line, drawn on the balance chart. */
  threshold?: number | null;
  /** Jump to the statement lines behind an anomaly. */
  onShowLines?: (lineIds: string[]) => void;
}) {
  const cur = data.account.currency;
  const s = data.summary;
  const money = (v: number) => amount(v, cur);
  const axis = (v: number) => compact(v, cur);

  if (s.lines === 0) {
    return (
      <div className="ws-card">
        <Empty icon={LineChart} title="No transactions in this range." hint="Upload a statement covering these dates, or choose another range." />
      </div>
    );
  }

  const days = data.balance.daily;
  const series: LineSeries[] = [
    { key: "balance", label: "Closing balance", hue: "blue" as Hue, values: days.map((d) => d.balance), area: true },
    ...(threshold != null ? [{ key: "threshold", label: "Low-balance line", hue: "rose" as Hue, values: days.map(() => threshold), dashed: true }] : []),
  ];

  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <StatCard label="Opening balance" value={compact(s.opening, cur)} icon={Landmark} hint={s.from ? day(s.from) : undefined} />
        <StatCard label="Money in" value={compact(s.inflows, cur)} icon={ArrowDownLeft} hue="mint" hint={money(s.inflows)} />
        <StatCard label="Money out" value={compact(s.outflows, cur)} icon={ArrowUpRight} hue="coral" hint={money(s.outflows)} />
        <StatCard featured label="Closing balance" value={compact(s.closing, cur)} icon={Banknote} hint={`${s.lines} lines · ${s.posted} posted`} />
      </StatGrid>

      {s.checks.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Verification">
          {s.checks.map((c) => {
            const m = CHECK_STATUS[c.status];
            return (
              <li key={c.code}>
                <Chip hue={m.hue} icon={m.icon}>
                  {c.code} {c.label}: {m.label}
                </Chip>
              </li>
            );
          })}
        </ul>
      )}

      <Panel
        title="Daily balance"
        subtitle={`End-of-day balance${threshold != null ? ", against the low-balance line" : ""}`}
        icon={LineChart}
        actions={
          <span className="hidden text-xs text-neutral-500 sm:inline">
            {data.balance.daysOverdrawn > 0 ? `${data.balance.daysOverdrawn} days overdrawn` : "Never overdrawn"}
          </span>
        }
      >
        <MultiLine labels={days.map((d) => short(d.date))} series={series} format={axis} height={220} caption={`Daily closing balance, ${data.account.name}`} />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-4">
          <Fig label="Lowest">{compact(data.balance.min, cur)}</Fig>
          <Fig label="Highest">{compact(data.balance.max, cur)}</Fig>
          <Fig label="Average">{compact(data.balance.average, cur)}</Fig>
          <Fig label="Days below the line">{data.balance.daysBelowThreshold == null ? "No line set" : data.balance.daysBelowThreshold}</Fig>
        </dl>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Money in, by source" icon={ArrowDownLeft} hue="mint">
          {data.inflowsBySource.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing came in.</p>
          ) : (
            <StatusBars
              caption="Money in by source"
              format={axis}
              data={data.inflowsBySource.map((r, i) => ({ label: r.label, value: r.amount, hue: RAMP[i % RAMP.length], note: `${r.count} ${r.count === 1 ? "line" : "lines"}` }))}
            />
          )}
        </Panel>
        <Panel title="Money out, by category" icon={ArrowUpRight} hue="coral">
          {data.outflowsByCategory.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing went out.</p>
          ) : (
            <StatusBars
              caption="Money out by category"
              format={axis}
              data={data.outflowsByCategory.map((r, i) => ({ label: r.label, value: r.amount, hue: RAMP[(i + 4) % RAMP.length], note: `${r.count} ${r.count === 1 ? "line" : "lines"}` }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Money out, by project" icon={Receipt} hue="grape">
          {data.outflowsByProject.length === 0 ? (
            <p className="text-sm text-neutral-500">No payments are tagged to a project yet. Tag them on review, or add project keywords in Statement rules.</p>
          ) : (
            <StatusBars caption="Money out by project" format={axis} data={data.outflowsByProject.map((r, i) => ({ label: r.label, value: r.amount, hue: RAMP[i % RAMP.length] }))} />
          )}
        </Panel>
        <Panel
          title="Bank charges"
          icon={Banknote}
          hue="sun"
          actions={
            <Chip hue="sun" className="tabular-nums">
              {data.bankCharges.percentOfTurnover.toFixed(3)}% of turnover
            </Chip>
          }
        >
          <p className="mb-4 text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">{money(data.bankCharges.total)}</p>
          <StatusBars caption="Bank charges by type" format={money} data={data.bankCharges.byType.filter((t) => t.amount > 0).map((t, i) => ({ label: t.label, value: t.amount, hue: RAMP[(i + 2) % RAMP.length] }))} />
          {data.bankCharges.audit.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {data.bankCharges.audit.map((a) => (
                <li key={a.month} className="rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700">
                  <span className="font-semibold">
                    <AlertTriangle size={14} className="mr-1 inline align-[-2px]" aria-hidden />
                    {monthLabel(a.month)}:
                  </span>{" "}
                  {a.message} Charged {money(a.vatCharged)}; 7.5% of {money(a.maintenance)} is {money(a.vatExpected)}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-neutral-500">VAT on maintenance checks out at 7.5%.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Ranked title="Paid the most" icon={ArrowUpRight} hue="coral" rows={data.topPayees} money={money} />
        <Ranked title="Paid us the most" icon={ArrowDownLeft} hue="mint" rows={data.topPayers} money={money} />
      </div>

      <Panel title="Worth a question" subtitle="Patterns found in the lines. None of them is an error by itself." icon={Search} hue="rose">
        {data.anomalies.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing unusual in these lines.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.anomalies.map((a, i) => (
              <li key={`${a.type}-${i}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-start gap-3">
                  <Chip hue={a.severity === "warning" ? "sun" : "sky"} icon={a.severity === "warning" ? AlertTriangle : Info} className="mt-0.5 shrink-0">
                    {a.severity === "warning" ? "Warning" : "Note"}
                  </Chip>
                  <span className="text-sm text-neutral-700">{a.message}</span>
                </span>
                {onShowLines && a.lineIds.length > 0 && (
                  <Button size="sm" variant="ghost" className="shrink-0 self-start sm:self-auto" onClick={() => onShowLines(a.lineIds)}>
                    Show {a.lineIds.length === 1 ? "the line" : `${a.lineIds.length} lines`}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Cash conversion" subtitle="What came in from others, what moved between our accounts, what was spent." icon={Users} hue="sky">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Fig label="Received from others">{money(data.cashConversion.receivedFromOthers)}</Fig>
          <Fig label="Moved to our own accounts">{money(data.cashConversion.movedToOwnAccounts)}</Fig>
          <Fig label="Spent directly">{money(data.cashConversion.spentDirectly)}</Fig>
        </dl>
      </Panel>
    </div>
  );
}

function Fig({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold text-neutral-900 tabular-nums">{children}</dd>
    </div>
  );
}

function Ranked({
  title,
  icon,
  hue,
  rows,
  money,
}: {
  title: string;
  icon: typeof Users;
  hue: Hue;
  rows: { name: string; amount: number; count: number }[];
  money: (v: number) => string;
}) {
  const top = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <Panel title={title} icon={icon} hue={hue}>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Nobody in this range.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs font-semibold text-neutral-400 tabular-nums">{i + 1}</span>
                  <span className="truncate font-medium text-neutral-800" title={r.name}>
                    {r.name}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-neutral-900 tabular-nums">{money(r.amount)}</span>
              </div>
              <div className="ml-6 mt-1 flex items-center gap-2">
                <div className="ws-hatch h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className={cx("h-full rounded-full", hue === "mint" ? "bg-mint-500" : "bg-coral-500")} style={{ width: `${(r.amount / top) * 100}%` }} />
                </div>
                <span className="w-14 text-right text-[11px] text-neutral-500 tabular-nums">
                  {r.count} {r.count === 1 ? "line" : "lines"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
