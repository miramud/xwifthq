"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Compass, Grid3x3, Rows3, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Card, Chip, Empty, Panel, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { GroupedColumns, Legend, MultiLine, hueHex } from "@/components/workspace/charts";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, monthLabel } from "@/suite/finance/lib/format";
import { cumulative, favourable, monthVariance, type VarianceRow, type VersusActual as VA } from "@/lib/api/finance-budgets-client";
import { signedPct } from "./meta";

/**
 * Budget against actual: the year to date (closed months only) for income,
 * expense and the net, each month side by side or as running totals, which
 * accounts are furthest off, every account month by month as a heat map of
 * variance, and the table behind it all. Variance is read the favourable
 * way: income over budget is good, expense over budget is not.
 */

const short = (m: string) => monthLabel(m, true).split(" ")[0];

export function VersusActual({ va }: { va: VA }) {
  const [shape, setShape] = useState<"monthly" | "running">("monthly");
  const t = va.totals;
  const ytd = va.ytdMonths;
  const labels = va.months.map(short);

  if (va.rows.length === 0)
    return (
      <Card>
        <Empty icon={Scale} title="Nothing to compare yet" hint="Add budget lines, and once a month closes its actuals from the ledger show here against them." />
      </Card>
    );

  const netBudget = t.incomeBudgetYtd - t.expenseBudgetYtd;
  const netActual = t.incomeActualYtd - t.expenseActualYtd;
  const closedText = ytd === 0 ? "No month has closed yet" : `${ytd === 1 ? "1 closed month" : `${ytd} closed months`}, to the end of ${monthLabel(va.months[ytd - 1])}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">Year to date: {closedText}.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <YtdTile label="Income" icon={TrendingUp} hue="mint" budget={t.incomeBudgetYtd} actual={t.incomeActualYtd} income year={t.incomeBudgetYear} />
        <YtdTile label="Expense" icon={TrendingDown} hue="coral" budget={t.expenseBudgetYtd} actual={t.expenseActualYtd} income={false} year={t.expenseBudgetYear} />
        <YtdTile label="Net" icon={Scale} hue="blue" budget={netBudget} actual={netActual} income year={t.incomeBudgetYear - t.expenseBudgetYear} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Month by month"
          subtitle="Budget (outlined) against actual, for income and expense"
          icon={BarChart3}
          actions={
            <Segmented
              label="Chart shape"
              value={shape}
              onChange={setShape}
              options={[
                { key: "monthly", label: "Each month" },
                { key: "running", label: "Running total" },
              ]}
            />
          }
        >
          {shape === "monthly" ? (
            <GroupedColumns
              data={va.months.map((m, i) => ({
                label: short(m),
                values: { ib: t.monthlyIncomeBudget[i] ?? 0, ia: t.monthlyIncomeActual[i] ?? 0, eb: t.monthlyExpenseBudget[i] ?? 0, ea: t.monthlyExpenseActual[i] ?? 0 },
              }))}
              series={[
                { key: "ib", label: "Income budget", hue: "mint", dashed: true },
                { key: "ia", label: "Income actual", hue: "mint" },
                { key: "eb", label: "Expense budget", hue: "coral", dashed: true },
                { key: "ea", label: "Expense actual", hue: "coral" },
              ]}
              format={(v) => compact(v)}
              caption="Monthly income and expense, budget against actual"
              height={240}
            />
          ) : (
            <MultiLine
              labels={labels}
              series={[
                { key: "ib", label: "Income budget", hue: "mint", dashed: true, values: cumulative(t.monthlyIncomeBudget) },
                { key: "ia", label: "Income actual", hue: "mint", area: true, values: upTo(cumulative(t.monthlyIncomeActual), ytd) },
                { key: "eb", label: "Expense budget", hue: "coral", dashed: true, values: cumulative(t.monthlyExpenseBudget) },
                { key: "ea", label: "Expense actual", hue: "coral", values: upTo(cumulative(t.monthlyExpenseActual), ytd) },
              ]}
              format={(v) => compact(v)}
              caption="Running totals of income and expense through the year, budget against actual (actual to the last closed month)"
              height={240}
              marker={ytd > 0 ? { index: ytd - 1, label: "Year to date" } : undefined}
            />
          )}
        </Panel>
        <FurthestOff rows={va.rows} />
      </div>

      <VarianceHeatmap va={va} />
      <VarianceTable rows={va.rows} />
    </div>
  );
}

const upTo = (values: number[], n: number): (number | null)[] => values.map((v, i) => (i < n ? v : null));

/* ------------------------------------------------------------------ */

function YtdTile({
  label,
  icon: Icon,
  hue,
  budget,
  actual,
  income,
  year,
}: {
  label: string;
  icon: typeof Scale;
  hue: "mint" | "coral" | "blue";
  budget: number;
  actual: number;
  /** Higher is better (income, net). */
  income: boolean;
  year: number;
}) {
  const variance = income ? actual - budget : budget - actual;
  const good = variance >= 0;
  const pct = budget !== 0 ? ((actual - budget) / Math.abs(budget)) * 100 : null;
  const fill = budget > 0 ? Math.max(0, Math.min(100, (actual / budget) * 100)) : actual > 0 ? 100 : 0;
  const over = budget > 0 && actual > budget;
  const tile = { mint: "bg-mint-50 text-mint-700", coral: "bg-coral-50 text-coral-700", blue: "bg-primary-50 text-primary-700" }[hue];
  return (
    <div className="ws-card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-600">{label}, year to date</p>
        <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", tile)}>
          <Icon size={18} aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{compact(actual)}</p>
        <p className="mt-1.5 text-xs text-neutral-500">
          Against a budget of <span className="font-semibold text-neutral-700 tabular-nums">{compact(budget)}</span>
        </p>
      </div>
      <div>
        <div className="ws-hatch relative h-2.5 overflow-hidden rounded-full" aria-hidden>
          <div className={cx("h-full rounded-full", over ? (income ? "bg-mint-500" : "bg-coral-500") : hue === "coral" ? "bg-coral-500" : hue === "mint" ? "bg-mint-500" : "bg-primary-500")} style={{ width: `${fill}%` }} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums", good ? "bg-mint-50 text-mint-700" : "bg-coral-50 text-coral-700")}>
            {good ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
            {compact(Math.abs(variance))} {good ? "favourable" : "unfavourable"}
            {pct != null && <span className="font-medium opacity-80">({signedPct(pct)})</span>}
          </span>
          <span className="text-neutral-500">Year: {compact(year)}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FurthestOff({ rows }: { rows: VarianceRow[] }) {
  const worst = rows
    .filter((r) => r.varianceYtd < 0)
    .sort((a, b) => a.varianceYtd - b.varianceYtd)
    .slice(0, 6);
  const max = Math.max(1, ...worst.map((r) => Math.abs(r.varianceYtd)));
  return (
    <Panel title="Furthest off budget" subtitle="Unfavourable variance, year to date" icon={Compass} hue="coral">
      {worst.length === 0 ? (
        <Empty icon={Compass} hue="mint" title="Every account is on or better than budget" hint="Income is at or above budget and costs at or below it, year to date." />
      ) : (
        <ul className="space-y-3.5">
          {worst.map((r) => (
            <li key={r.accountId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={`/suite/finance/reports/ledger/${r.accountId}`} className="min-w-0 truncate font-medium text-neutral-900 hover:text-primary-700 hover:underline">
                  <span className="font-mono text-[12px] text-neutral-500">{r.code}</span> {r.name}
                </Link>
                <span className="shrink-0 font-semibold tabular-nums text-coral-700">−{compact(Math.abs(r.varianceYtd))}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="ws-hatch block h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                  <span className="block h-full rounded-full bg-coral-500" style={{ width: `${(Math.abs(r.varianceYtd) / max) * 100}%` }} />
                </span>
                <span className="w-24 text-right text-[11px] text-neutral-500">{r.income ? "Income short" : "Spent over"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Variance heat map: accounts × months, favourable mint / unfavourable coral */
/* ------------------------------------------------------------------ */

const MIX = [14, 28, 44, 60];

function VarianceHeatmap({ va }: { va: VA }) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const rows = va.rows;
  const cols = va.months;
  const max = useMemo(() => Math.max(1, ...rows.flatMap((r) => cols.map((_, i) => (i < va.ytdMonths ? Math.abs(monthVariance(r, i)) : 0)))), [rows, cols, va.ytdMonths]);
  const step = (v: number) => Math.min(MIX.length - 1, Math.floor((Math.abs(v) / max) * MIX.length));
  const tab = active ?? { r: 0, c: 0 };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(rows.length - 1, r));
    const nc = Math.max(0, Math.min(cols.length - 1, c));
    setActive({ r: nr, c: nc });
    refs.current.get(`${nr}:${nc}`)?.focus();
  };
  const describe = (r: number, c: number) => {
    const row = rows[r];
    const m = monthLabel(cols[c]);
    if (c >= va.ytdMonths) return `${row.code} ${row.name}, ${m}: not closed yet. Budget ${compact(row.budget[c] ?? 0)}.`;
    const v = monthVariance(row, c);
    return `${row.code} ${row.name}, ${m}: budget ${compact(row.budget[c] ?? 0)}, actual ${compact(row.actual[c] ?? 0)}, ${v >= 0 ? "favourable" : "unfavourable"} by ${compact(Math.abs(v))}.`;
  };

  return (
    <Panel title="Variance by account and month" subtitle="Darker is further from budget. Months not yet closed are hatched." icon={Grid3x3} hue="grape">
      <figure>
        <div className="overflow-x-auto p-1">
          <div role="group" aria-label="Variance by account and month" className="grid min-w-max gap-1" style={{ gridTemplateColumns: `minmax(11rem, 16rem) repeat(${cols.length}, minmax(3.75rem, 1fr))` }}>
            <span />
            {cols.map((m, c) => (
              <span key={m} aria-hidden className={cx("pb-1 text-center text-[11px] font-semibold", active?.c === c ? "text-neutral-900" : "text-neutral-500")}>
                {short(m)}
              </span>
            ))}
            {rows.map((row, r) => (
              <Row key={row.accountId}>
                <span aria-hidden className={cx("flex min-w-0 items-center gap-1.5 truncate pr-2 text-xs", active?.r === r ? "font-semibold text-neutral-900" : "text-neutral-700")} title={`${row.code} ${row.name}`}>
                  <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", row.income ? "bg-mint-500" : "bg-coral-500")} />
                  <span className="font-mono text-[11px] text-neutral-500">{row.code}</span>
                  <span className="truncate">{row.name}</span>
                </span>
                {cols.map((m, c) => {
                  const closed = c < va.ytdMonths;
                  const v = closed ? monthVariance(row, c) : 0;
                  const style: React.CSSProperties | undefined =
                    closed && v !== 0 ? { background: `color-mix(in oklab, ${hueHex(v > 0 ? "mint" : "coral")} ${MIX[step(v)]}%, white)` } : undefined;
                  return (
                    <button
                      key={m}
                      type="button"
                      ref={(el) => {
                        if (el) refs.current.set(`${r}:${c}`, el);
                        else refs.current.delete(`${r}:${c}`);
                      }}
                      tabIndex={tab.r === r && tab.c === c ? 0 : -1}
                      aria-label={describe(r, c)}
                      onFocus={() => setActive({ r, c })}
                      onMouseEnter={() => setActive({ r, c })}
                      onKeyDown={(e) => {
                        const d: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
                        const k = d[e.key];
                        if (!k) return;
                        e.preventDefault();
                        move(r + k[0], c + k[1]);
                      }}
                      className={cx(
                        "flex h-9 cursor-default items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums text-neutral-800 outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                        !closed && "ws-hatch text-neutral-400",
                        closed && v === 0 && "bg-neutral-50 text-neutral-400",
                        active?.r === r && active?.c === c && "ring-2 ring-neutral-900/30",
                      )}
                      style={style}
                    >
                      {closed ? (v === 0 ? "-" : `${v > 0 ? "+" : "−"}${compact(Math.abs(v)).replace("₦", "")}`) : ""}
                    </button>
                  );
                })}
              </Row>
            ))}
          </div>
        </div>
        <p aria-live="polite" className="mt-3 min-h-5 text-xs text-neutral-600">
          {active ? describe(active.r, active.c) : "Focus a cell, then use the arrow keys to read the grid."}
        </p>
        <div className="mt-2">
          <Legend
            items={[
              { label: "Favourable", hue: "mint" },
              { label: "Unfavourable", hue: "coral" },
              { label: "Not closed", hue: "slate", dashed: true },
            ]}
          />
        </div>
      </figure>
    </Panel>
  );
}

/** Grid cells of one row (display: contents keeps the parent grid). */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

/* ------------------------------------------------------------------ */

function VarianceTable({ rows }: { rows: VarianceRow[] }) {
  const columns: Column<VarianceRow>[] = [
    {
      key: "account",
      header: "Account",
      primary: true,
      sortable: true,
      value: (r) => `${r.income ? 0 : 1} ${r.code}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block font-semibold text-neutral-900">
            <span className="font-mono text-[13px] font-normal text-neutral-500">{r.code}</span> {r.name}
          </span>
          <span className="block text-xs text-neutral-500">{r.income ? "Income" : "Expense"}</span>
        </span>
      ),
    },
    { key: "budgetYtd", header: "Budget to date", align: "right", sortable: true, value: (r) => r.budgetYtd, render: (r) => <Money value={r.budgetYtd} className="text-neutral-700" /> },
    {
      key: "actualYtd",
      header: "Actual to date",
      align: "right",
      sortable: true,
      value: (r) => r.actualYtd,
      render: (r) => (
        <span className="block min-w-[120px]">
          <Money value={r.actualYtd} className="font-semibold text-neutral-900" />
          {r.budgetYtd > 0 && (
            <span className="ws-hatch mt-1 block h-1.5 overflow-hidden rounded-full" aria-hidden>
              <span className={cx("block h-full rounded-full", favourable(r) ? "bg-mint-500" : "bg-coral-500")} style={{ width: `${Math.min(100, (r.actualYtd / r.budgetYtd) * 100)}%` }} />
            </span>
          )}
        </span>
      ),
    },
    {
      key: "variance",
      header: "Variance",
      align: "right",
      sortable: true,
      value: (r) => r.varianceYtd,
      render: (r) =>
        r.varianceYtd === 0 ? (
          <span className="text-neutral-500">On budget</span>
        ) : (
          <Chip hue={favourable(r) ? "mint" : "coral"} icon={favourable(r) ? ArrowUpRight : ArrowDownRight}>
            <span className="tabular-nums">{compact(Math.abs(r.varianceYtd))}</span>
            <span className="sr-only">{favourable(r) ? " favourable" : " unfavourable"}</span>
          </Chip>
        ),
    },
    {
      key: "pct",
      header: "Variance %",
      align: "right",
      sortable: true,
      value: (r) => r.variancePct ?? 0,
      render: (r) => <span className={cx("tabular-nums", r.variancePct == null ? "text-neutral-500" : favourable(r) ? "text-mint-700" : "text-coral-700")}>{r.variancePct == null ? "No budget" : signedPct(r.variancePct)}</span>,
    },
    { key: "year", header: "Budget for the year", align: "right", sortable: true, hideOnMobile: true, value: (r) => r.budgetYear, render: (r) => <Money value={r.budgetYear} className="text-neutral-600" /> },
  ];
  return (
    <section aria-labelledby="bva-table">
      <h2 id="bva-table" className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
        <Rows3 size={16} className="text-neutral-400" aria-hidden />
        By account
      </h2>
      <DataView
        rows={rows}
        columns={columns}
        rowKey={(r) => r.accountId}
        rowHref={(r) => `/suite/finance/reports/ledger/${r.accountId}`}
        views={["table", "list"]}
        storageKey="finance.budgets.bva"
        caption="Budget against actual by account, year to date"
        searchPlaceholder="Search accounts"
      />
    </section>
  );
}
