"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coins,
  Droplets,
  FolderKanban,
  Gauge,
  Landmark,
  PiggyBank,
  Receipt,
  Scale,
  ShoppingCart,
  TriangleAlert,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Chip, Empty, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { Donut, GroupedColumns, Legend, StatusBars } from "@/components/workspace/charts";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { StatCard } from "@/suite/lms/components/ui/ws";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import type { CompanyReport, CrFlowBlock, CrProject, CrRag, CrSpendRow } from "@/lib/api/finance-company-report-client";
import RequestsLedger from "./RequestsLedger";
import { Block, BudgetBars, Chapter, Figure, Figures, Line, Nothing, StackBar, Statement, StatementLines, Table, money, num } from "./parts";

/* The twelve chapters of the company report, in the order the PDF prints them. */

export const CHAPTERS = [
  { id: "headline", title: "Headline" },
  { id: "income", title: "Income statement" },
  { id: "position", title: "Financial position" },
  { id: "cash", title: "Cash flow & banks" },
  { id: "budget", title: "Budget vs actual" },
  { id: "projects", title: "Projects (expected vs actual)" },
  { id: "spend", title: "Spend" },
  { id: "people", title: "Requests by person" },
  { id: "receivables", title: "Receivables" },
  { id: "payables", title: "Payables, advances & commitments" },
  { id: "tax", title: "Tax, assets & labour" },
  { id: "approvals", title: "Approvals" },
] as const;

type R = CompanyReport;
const idx = (id: (typeof CHAPTERS)[number]["id"]) => CHAPTERS.findIndex((c) => c.id === id) + 1;
const pct = (bp: number | null | undefined) => (bp === null || bp === undefined ? "-" : `${(bp / 100).toFixed(1)}%`);
const int = (n: number) => n.toLocaleString("en-NG");
const sumOf = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);

/* ------------------------------ 1 headline -------------------------- */

export function HeadlineChapter({ r }: { r: R }) {
  const h = r.headline;
  const c = r.currency;
  const deficit = h.netSurplus < 0;
  return (
    <Chapter id="headline" index={idx("headline")} title="Headline" icon={Gauge} lede={`The period at a glance: what came in, what it cost, where the cash ended and what is still owed either way.`}>
      <StatGrid cols={4}>
        <StatCard label="Income" icon={Coins} hue="mint" value={compact(h.income, c)} />
        <StatCard label="Costs" icon={Receipt} hue="coral" value={compact(h.costs, c)} />
        <StatCard
          label={deficit ? "Net deficit" : "Net surplus"}
          icon={PiggyBank}
          featured
          featuredHue={deficit ? "rose" : "blue"}
          value={compact(Math.abs(h.netSurplus), c)}
          hint={h.marginBp === null ? "No income to measure a margin" : `${pct(h.marginBp)} margin`}
        />
        <StatCard label="Closing cash" icon={Landmark} hue="sky" value={compact(h.closingCash, c)} hint={`${h.netCashFlow < 0 ? "Down" : "Up"} ${compact(Math.abs(h.netCashFlow), c)} from ${compact(h.openingCash, c)}`} />
      </StatGrid>
      <Figures>
        <Figure label="Receivable" value={compact(h.receivable, c)} hint={h.overdue > 0 ? `${compact(h.overdue, c)} overdue` : "Nothing overdue"} tone={h.overdue > 0 ? "bad" : undefined} />
        <Figure label="Payable" value={compact(h.payable, c)} hint="Approved vouchers not yet paid" />
        <Figure label="Advances outstanding" value={compact(h.advancesOut, c)} hint="Not yet retired" />
        <Figure label="Committed" value={compact(h.committed, c)} hint="Approved, not yet spent" />
        <Figure label="Paid out" value={compact(h.paidOut, c)} hint="Vouchers paid in the period" />
        <Figure label="Total assets" value={compact(h.totalAssets, c)} />
        <Figure label="Total liabilities" value={compact(h.totalLiabilities, c)} />
        <Figure label="Net assets" value={compact(h.totalEquity, c)} />
        <Figure label="Requests raised" value={int(h.requests)} hint={`by ${int(h.requesters)} ${h.requesters === 1 ? "person" : "people"}`} />
        <Figure label="Projects" value={int(h.projects)} hint={h.projectsRed > 0 ? `${int(h.projectsRed)} at risk` : "None at risk"} tone={h.projectsRed > 0 ? "bad" : undefined} />
      </Figures>
    </Chapter>
  );
}

/* --------------------------- 2 income statement --------------------- */

export function IncomeChapter({ r }: { r: R }) {
  const i = r.income;
  const c = r.currency;
  return (
    <Chapter id="income" index={idx("income")} title="Income statement" icon={Receipt} hue="mint" lede="Income less what it cost, from posted journals.">
      {i.monthly.length > 0 && (
        <Block title="Month by month" sub="Income against direct costs and expenses" actions={<Legend items={[{ label: "Income", hue: "mint" }, { label: "Costs", hue: "coral" }]} />}>
          <GroupedColumns
            data={i.monthly.map((m) => ({ label: m.label || monthLabel(m.month, true).split(" ")[0], values: { income: m.income, costs: m.directCosts + m.expenses } }))}
            series={[
              { key: "income", label: "Income", hue: "mint" },
              { key: "costs", label: "Costs", hue: "coral" },
            ]}
            format={(v) => compact(v, c)}
            caption="Income and costs by month"
          />
        </Block>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Block title="Statement of financial performance" sub={`${day(r.from)} to ${day(r.to)} · ${c}`}>
          <Statement caption="Income statement" currency={c}>
            <StatementLines title="Revenue" section={i.revenue} totalLabel="Total revenue" />
            {i.costOfRevenue.rows.length > 0 && (
              <>
                <StatementLines title="Cost of revenue" section={i.costOfRevenue} totalLabel="Total cost of revenue" />
                <Line label="Gross surplus" value={i.grossSurplus} strong rule="top" />
              </>
            )}
            <StatementLines title="Expenditure" section={i.expenses} totalLabel="Total expenditure" />
            <Line label="Operating surplus" value={i.operatingSurplus} strong rule="top" />
            {i.otherIncome.rows.length > 0 && <StatementLines title="Other income" section={i.otherIncome} totalLabel="Total other income" />}
            {i.otherExpenses.rows.length > 0 && <StatementLines title="Other expenses" section={i.otherExpenses} totalLabel="Total other expenses" />}
            <tr>
              <td colSpan={2} className="pt-3" />
            </tr>
            <Line label={i.netSurplus < 0 ? "Deficit for the period" : "Surplus for the period"} value={i.netSurplus} strong rule="double" />
          </Statement>
        </Block>
        <Block title="Monthly figures" flush>
          <div className="px-5 pb-5">
            <Table
              caption="Income statement by month"
              rows={i.monthly}
              rowKey={(m) => m.month}
              limit={13}
              empty="Nothing posted in this period."
              cols={[
                { label: "Month", cell: (m) => m.label || monthLabel(m.month, true), total: "Total" },
                { label: "Income", num: true, cell: (m) => money(m.income), total: money(sumOf(i.monthly, (m) => m.income)) },
                { label: "Direct costs", num: true, cell: (m) => money(m.directCosts), total: money(sumOf(i.monthly, (m) => m.directCosts)) },
                { label: "Expenses", num: true, cell: (m) => money(m.expenses), total: money(sumOf(i.monthly, (m) => m.expenses)) },
                {
                  label: "Surplus",
                  num: true,
                  cell: (m) => <span className={cx(m.surplus < 0 && "text-rose-700")}>{money(m.surplus)}</span>,
                  total: money(sumOf(i.monthly, (m) => m.surplus)),
                },
              ]}
            />
          </div>
        </Block>
      </div>
    </Chapter>
  );
}

/* --------------------------- 3 financial position ------------------- */

export function PositionChapter({ r }: { r: R }) {
  const p = r.position;
  const c = r.currency;
  return (
    <Chapter id="position" index={idx("position")} title="Financial position" icon={Scale} hue="grape" lede={`What the organisation owns and owes at ${day(p.asAt)}.`}>
      <Block
        title={`As at ${day(p.asAt)}`}
        sub={c}
        actions={
          p.balanced ? (
            <Chip hue="mint" icon={CheckCircle2}>
              Balanced
            </Chip>
          ) : (
            <Chip hue="rose" icon={TriangleAlert}>
              Out by {money(Math.abs(p.totalAssets - p.totalLiabilities - p.totalEquity))}
            </Chip>
          )
        }
      >
        <div className="grid gap-x-10 lg:grid-cols-2">
          <Statement caption="Assets" currency={c}>
            <StatementLines title="Current assets" section={p.currentAssets} totalLabel="Total current assets" />
            <StatementLines title="Non-current assets" section={p.nonCurrentAssets} totalLabel="Total non-current assets" />
            <tr>
              <td colSpan={2} className="pt-3" />
            </tr>
            <Line label="Total assets" value={p.totalAssets} strong rule="double" />
          </Statement>
          <Statement caption="Liabilities and net assets" currency={c}>
            <StatementLines title="Current liabilities" section={p.currentLiabilities} totalLabel="Total current liabilities" />
            <StatementLines title="Non-current liabilities" section={p.nonCurrentLiabilities} totalLabel="Total non-current liabilities" />
            <Line label="Total liabilities" value={p.totalLiabilities} strong rule="top" />
            <StatementLines title="Equity" section={p.equity} totalLabel="Total equity accounts" />
            <Line label="Surplus not yet closed to reserves" value={p.unclosedSurplus} />
            <tr>
              <td colSpan={2} className="pt-3" />
            </tr>
            <Line label="Total net assets" value={p.totalEquity} strong rule="double" />
          </Statement>
        </div>
      </Block>
    </Chapter>
  );
}

/* ----------------------------- 4 cash & banks ------------------------ */

function FlowLines({ title, block }: { title: string; block: CrFlowBlock }) {
  return (
    <>
      <tr>
        <th colSpan={2} scope="colgroup" className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </th>
      </tr>
      {block.rows.length === 0 ? (
        <tr>
          <td colSpan={2} className="py-2 pl-4 text-neutral-500">
            No cash moved
          </td>
        </tr>
      ) : (
        block.rows.map((x, k) => (
          <tr key={`${x.label}-${k}`}>
            <th scope="row" className="py-1.5 pl-4 pr-4 text-left font-normal text-neutral-700">
              {x.label}
            </th>
            <td className={cx(num, "py-1.5")}>{money(x.amount)}</td>
          </tr>
        ))
      )}
      <Line label={`Net cash from ${title.toLowerCase()}`} value={block.total} strong rule="top" />
    </>
  );
}

export function CashChapter({ r }: { r: R }) {
  const f = r.cashFlow;
  const c = r.currency;
  return (
    <Chapter id="cash" index={idx("cash")} title="Cash flow & banks" icon={Droplets} hue="sky" lede="Cash in and out of the bank accounts by activity, and what each account holds at the end.">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Block title="Cash flow" sub={c}>
          <Statement caption="Cash flow" currency={c}>
            <Line label="Opening cash" value={f.openingCash} strong />
            <FlowLines title="Operating activities" block={f.operating} />
            <FlowLines title="Investing activities" block={f.investing} />
            <FlowLines title="Financing activities" block={f.financing} />
            <tr>
              <td colSpan={2} className="pt-3" />
            </tr>
            <Line label="Net change in cash" value={f.netChange} strong rule="top" />
            <Line label="Closing cash" value={f.closingCash} strong rule="double" />
          </Statement>
        </Block>
        <Block title="Bank accounts" sub={`Balances at ${day(r.to)}`}>
          <Table
            caption="Bank balances"
            rows={r.banks}
            rowKey={(b) => b.code}
            empty="No bank accounts are set up."
            cols={[
              {
                label: "Account",
                cell: (b) => (
                  <span>
                    <span className="mr-2 font-mono text-[12px] text-neutral-500">{b.code}</span>
                    {b.name}
                  </span>
                ),
                total: "Total",
              },
              {
                label: "Own currency",
                num: true,
                cell: (b) => (b.currencyBalance === null ? <span className="text-neutral-400">-</span> : `${b.currency} ${money(b.currencyBalance)}`),
              },
              { label: `Balance (${c})`, num: true, cell: (b) => money(b.balance), total: money(sumOf(r.banks, (b) => b.balance)) },
            ]}
          />
        </Block>
      </div>
    </Chapter>
  );
}

/* ---------------------------- 5 budget vs actual --------------------- */

export function BudgetChapter({ r }: { r: R }) {
  const b = r.budget;
  const c = r.currency;
  if (!b) {
    return (
      <Chapter id="budget" index={idx("budget")} title="Budget vs actual" icon={PiggyBank} hue="sun">
        <div className="ws-card">
          <Empty icon={PiggyBank} hue="sun" title="No approved budget covers this period" hint="Approve a budget for the financial year in Budgets and this section compares it with what was posted." />
        </div>
      </Chapter>
    );
  }
  const t = b.totals;
  const labels = b.months.length === 12 ? b.months.map((m) => (/^\d{4}-\d{2}$/.test(m) ? monthLabel(m, true).split(" ")[0] : m)) : t.monthlyExpenseBudget.map((_, k) => `M${k + 1}`);
  const variance = (actual: number, budget: number, income: boolean) => {
    const v = actual - budget;
    const good = income ? v >= 0 : v <= 0;
    return { v, good };
  };
  const inc = variance(t.incomeActualYtd, t.incomeBudgetYtd, true);
  const exp = variance(t.expenseActualYtd, t.expenseBudgetYtd, false);
  return (
    <Chapter id="budget" index={idx("budget")} title="Budget vs actual" icon={PiggyBank} hue="sun" lede={`Budget ${b.fiscalYear}${b.version ? ` · version ${b.version}` : ""}, ${b.ytdMonths} ${b.ytdMonths === 1 ? "month" : "months"} to date.`}>
      <Figures>
        <Figure label="Income budget to date" value={compact(t.incomeBudgetYtd, c)} hint={`${compact(t.incomeBudgetYear, c)} for the year`} />
        <Figure label="Income actual to date" value={compact(t.incomeActualYtd, c)} hint={`${inc.v >= 0 ? "+" : "−"}${compact(Math.abs(inc.v), c)} ${inc.good ? "ahead" : "behind"}`} tone={inc.good ? "good" : "bad"} />
        <Figure label="Expense budget to date" value={compact(t.expenseBudgetYtd, c)} hint={`${compact(t.expenseBudgetYear, c)} for the year`} />
        <Figure label="Expense actual to date" value={compact(t.expenseActualYtd, c)} hint={`${exp.v >= 0 ? "+" : "−"}${compact(Math.abs(exp.v), c)} ${exp.good ? "under budget" : "over budget"}`} tone={exp.good ? "good" : "bad"} />
      </Figures>
      <div className="grid gap-6 xl:grid-cols-2">
        <Block title="Income by month" actions={<Legend items={[{ label: "Budget", hue: "slate" }, { label: "Actual", hue: "mint" }]} />}>
          <GroupedColumns
            data={labels.map((l, k) => ({ label: l, values: { budget: t.monthlyIncomeBudget[k] ?? 0, actual: t.monthlyIncomeActual[k] ?? 0 } }))}
            series={[
              { key: "budget", label: "Budget", hue: "slate", dashed: true },
              { key: "actual", label: "Actual", hue: "mint" },
            ]}
            format={(v) => compact(v, c)}
            caption="Income budget and actual by month"
          />
        </Block>
        <Block title="Expenditure by month" actions={<Legend items={[{ label: "Budget", hue: "slate" }, { label: "Actual", hue: "coral" }]} />}>
          <GroupedColumns
            data={labels.map((l, k) => ({ label: l, values: { budget: t.monthlyExpenseBudget[k] ?? 0, actual: t.monthlyExpenseActual[k] ?? 0 } }))}
            series={[
              { key: "budget", label: "Budget", hue: "slate", dashed: true },
              { key: "actual", label: "Actual", hue: "coral" },
            ]}
            format={(v) => compact(v, c)}
            caption="Expenditure budget and actual by month"
          />
        </Block>
      </div>
      <Block title="By account" sub="Variance is actual less budget to date; for expenditure, a positive variance is overspend.">
        <Table
          caption="Budget against actual by account"
          rows={b.rows}
          rowKey={(x) => x.code}
          limit={15}
          empty="The budget has no lines."
          cols={[
            {
              label: "Account",
              className: "min-w-[12rem]",
              cell: (x) => (
                <span>
                  <span className="mr-2 font-mono text-[12px] text-neutral-500">{x.code}</span>
                  {x.name}
                  <span className="ml-2 text-xs text-neutral-500">{x.income ? "Income" : "Expenditure"}</span>
                </span>
              ),
              total: "Total",
            },
            { label: "Budget (year)", num: true, cell: (x) => money(x.budgetYear) },
            { label: "Budget to date", num: true, cell: (x) => money(x.budgetYtd) },
            { label: "Actual to date", num: true, cell: (x) => money(x.actualYtd) },
            {
              label: "Variance",
              num: true,
              cell: (x) => {
                const bad = x.income ? x.varianceYtd < 0 : x.varianceYtd > 0;
                return (
                  <span className={cx(bad ? "text-rose-700" : "text-neutral-700")}>
                    {money(x.varianceYtd)}
                    {x.variancePct !== null && <span className="ml-1.5 text-xs text-neutral-500">{x.variancePct > 0 ? "+" : ""}{Math.round(x.variancePct)}%</span>}
                    {bad && <span className="sr-only"> (unfavourable)</span>}
                  </span>
                );
              },
            },
          ]}
        />
      </Block>
    </Chapter>
  );
}

/* ------------------------------ 6 projects -------------------------- */

const RAG: Record<CrRag, { hue: Hue; label: string }> = {
  green: { hue: "mint", label: "On track" },
  amber: { hue: "sun", label: "Watch" },
  red: { hue: "rose", label: "At risk" },
  stale: { hue: "slate", label: "Stale" },
  grey: { hue: "slate", label: "No plan" },
};

const ragOf = (s: string) => RAG[(s as CrRag) in RAG ? (s as CrRag) : "grey"];

function ProjectDetail({ p, c }: { p: CrProject; c: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">By category</p>
        {p.categories.length === 0 ? (
          <Nothing>No budget categories on this project.</Nothing>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="sr-only">{`${p.name}: budget and spend by category`}</caption>
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Category</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Budget</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Budget to date</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Spent</th>
                </tr>
              </thead>
              <tbody>
                {p.categories.map((k) => (
                  <tr key={k.category} className="border-t border-neutral-200/70">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal text-neutral-700">{k.label}</th>
                    <td className={cx(num, "py-1.5 pr-3")}>{money(k.budget)}</td>
                    <td className={cx(num, "py-1.5 pr-3")}>{money(k.budgetToDate)}</td>
                    <td className={cx(num, "py-1.5", k.budgetToDate > 0 && k.spent > k.budgetToDate && "font-semibold text-rose-700")}>{money(k.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Why it has this status</p>
        {p.reasons.length === 0 ? (
          <Nothing>No flags raised.</Nothing>
        ) : (
          <ul className="space-y-2">
            {p.reasons.map((x, k) => (
              <li key={k} className="flex items-start gap-2 text-sm">
                <Chip hue={ragOf(x.status).hue} dot>
                  {x.dimension}
                </Chip>
                <span className="text-neutral-700">{x.reason}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          {[
            ["Cost index (CPI)", p.cpi === null ? "-" : p.cpi.toFixed(2)],
            ["Schedule index (SPI)", p.spi === null ? "-" : p.spi.toFixed(2)],
            ["Complete", pct(p.pctBp)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white px-3 py-2 ring-1 ring-neutral-200/80">
              <dt className="text-neutral-500">{k}</dt>
              <dd className="font-semibold text-neutral-900 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-neutral-500">Released {compact(p.released, c)} · Invoiced {compact(p.invoiced, c)} · Collected {compact(p.collected, c)}</p>
      </div>
    </div>
  );
}

export function ProjectsChapter({ r }: { r: R }) {
  const pf = r.portfolio;
  const t = pf.totals;
  const c = r.currency;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const top = [...pf.projects].sort((a, b) => Math.max(b.bac, b.spent) - Math.max(a.bac, a.spent)).slice(0, 10);
  return (
    <Chapter id="projects" index={idx("projects")} title="Projects (expected vs actual)" icon={FolderKanban} hue="grape" lede="Each project's budget at completion against what has been released, committed and spent, and what it is expected to earn. Spent includes labour at the rate card, matching each project's Finance tab.">
      {pf.projects.length === 0 ? (
        <div className="ws-card">
          <Empty icon={FolderKanban} hue="grape" title="No projects in this period" hint="Projects with a budget or spend in the period show here with their health." />
        </div>
      ) : (
        <>
          <Figures>
            <Figure label="Contract value" value={compact(t.contractValue, c)} />
            <Figure label="Budget at completion" value={compact(t.bac, c)} />
            <Figure label="Spent" value={compact(t.spent, c)} hint={`${compact(t.committed, c)} more committed`} />
            <Figure label="Available" value={compact(t.available, c)} tone={t.available < 0 ? "bad" : undefined} />
            <Figure label="Invoiced" value={compact(t.invoiced, c)} hint={`${compact(t.collected, c)} collected`} />
            <Figure label="Projected profit" value={compact(t.projectedProfit, c)} tone={t.projectedProfit < 0 ? "bad" : "good"} />
            <Figure label="At risk" value={int(t.red)} hint={`${int(t.amber)} to watch · ${int(t.stale)} stale`} tone={t.red > 0 ? "bad" : undefined} />
          </Figures>
          <Block
            title="Budget against spend"
            sub={pf.projects.length > top.length ? `The ${top.length} largest of ${pf.projects.length} projects` : undefined}
            actions={<Legend items={[{ label: "On track", hue: "mint" }, { label: "Watch", hue: "sun" }, { label: "At risk", hue: "rose" }, { label: "Stale / no plan", hue: "slate" }]} />}
          >
            <BudgetBars
              rows={top.map((p) => ({ label: p.code ? `${p.code} · ${p.name}` : p.name, budget: p.bac, spent: p.spent, hue: ragOf(p.status).hue, note: ragOf(p.status).label }))}
              format={(v) => compact(v, c)}
              caption="Budget at completion and spend by project"
            />
          </Block>
          <Block title="Every project" sub="Open a project for its categories and the reasons behind its status." flush>
            <div className="px-5 pb-5">
              <Table
                caption="Projects, expected against actual"
                rows={pf.projects}
                rowKey={(p) => p.id}
                limit={15}
                expand={{ open: (p) => open.has(p.id), render: (p) => <ProjectDetail p={p} c={c} /> }}
                cols={[
                  {
                    label: "Project",
                    className: "min-w-[13rem]",
                    cell: (p) => (
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        aria-expanded={open.has(p.id)}
                        className="group flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <ChevronDown size={16} className={cx("mt-0.5 shrink-0 text-neutral-400 transition-transform print:hidden", open.has(p.id) && "rotate-180")} aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium text-neutral-900 group-hover:text-primary-700">{p.name}</span>
                          <span className="block text-xs text-neutral-500">{[p.code, p.client].filter(Boolean).join(" · ") || "-"}</span>
                        </span>
                      </button>
                    ),
                    total: "Total",
                  },
                  {
                    label: "Health",
                    cell: (p) => (
                      <Chip hue={ragOf(p.status).hue} dot>
                        {ragOf(p.status).label}
                      </Chip>
                    ),
                  },
                  { label: "Contract", num: true, cell: (p) => money(p.contractValue), total: money(t.contractValue) },
                  { label: "Budget (BAC)", num: true, cell: (p) => (p.hasBudget ? money(p.bac) : <span className="text-xs text-neutral-500">No budget</span>), total: money(t.bac) },
                  { label: "Committed", num: true, cell: (p) => money(p.committed), total: money(t.committed) },
                  { label: "Spent", num: true, cell: (p) => <span className={cx(p.hasBudget && p.spent > p.bac && "font-semibold text-rose-700")}>{money(p.spent)}</span>, total: money(t.spent) },
                  { label: "Available", num: true, cell: (p) => <span className={cx(p.available < 0 && "text-rose-700")}>{money(p.available)}</span>, total: money(t.available) },
                  { label: "Collected", num: true, cell: (p) => money(p.collected), total: money(t.collected) },
                  {
                    label: "Projected profit",
                    num: true,
                    cell: (p) => (p.projectedProfit === null ? <span className="text-neutral-400">-</span> : <span className={cx(p.projectedProfit < 0 && "text-rose-700")}>{money(p.projectedProfit)}</span>),
                    total: money(t.projectedProfit),
                  },
                ]}
              />
            </div>
          </Block>
        </>
      )}
    </Chapter>
  );
}

/* -------------------------------- 7 spend ---------------------------- */

const SPEND_HUES: Hue[] = ["coral", "sun", "grape", "sky", "rose", "mint", "blue"];
type SpendView = "byCategory" | "byCostCentre" | "byProject" | "byAccount" | "byPayee" | "byPreparer";
const SPEND_VIEWS: { key: SpendView; label: string; head: string }[] = [
  { key: "byCategory", label: "Category", head: "Category" },
  { key: "byCostCentre", label: "Cost centre", head: "Cost centre" },
  { key: "byProject", label: "Project", head: "Project" },
  { key: "byAccount", label: "Account", head: "Account" },
  { key: "byPayee", label: "Payee", head: "Payee" },
  { key: "byPreparer", label: "Prepared by", head: "Prepared by" },
];

export function SpendChapter({ r }: { r: R }) {
  const s = r.spend;
  const c = r.currency;
  const [view, setView] = useState<SpendView>("byCategory");
  const cats = [...s.byCategory].sort((a, b) => b.amount - a.amount);
  const slices = cats.length > 6 ? [...cats.slice(0, 5), { label: "Everything else", amount: sumOf(cats.slice(5), (x) => x.amount), count: 0, wht: 0 }] : cats;
  const total = sumOf(s.vouchers, (v) => v.gross);
  return (
    <Chapter id="spend" index={idx("spend")} title="Spend" icon={ShoppingCart} hue="coral" lede="Payment vouchers in the period, cut every way: by category, cost centre, project, account, payee and who prepared them.">
      {s.vouchers.length === 0 && cats.length === 0 ? (
        <div className="ws-card">
          <Empty icon={ShoppingCart} hue="coral" title="No vouchers in this period" hint="Payment vouchers raised in the period are analysed here." />
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
            <Block title="By category">
              {slices.length === 0 ? (
                <Nothing>No categorised spend.</Nothing>
              ) : slices.length <= 5 ? (
                <Donut data={slices.map((x, k) => ({ label: x.label, value: x.amount, hue: SPEND_HUES[k % SPEND_HUES.length] }))} total={compact(sumOf(cats, (x) => x.amount), c)} centerLabel="spent" format={(v) => compact(v, c)} caption="Spend by category" legend="below" />
              ) : (
                <StatusBars data={slices.map((x, k) => ({ label: x.label, value: x.amount, hue: SPEND_HUES[k % SPEND_HUES.length], note: x.count ? `${x.count} lines` : undefined }))} format={(v) => compact(v, c)} caption="Spend by category" />
              )}
            </Block>
            <Block title="Breakdown" actions={<Segmented label="Break spend down by" value={view} onChange={setView} options={SPEND_VIEWS.map((v) => ({ key: v.key, label: v.label }))} />}>
              {SPEND_VIEWS.map((v) => (
                <div key={v.key} className={cx(v.key !== view && "hidden print:block print:mt-4")}>
                  <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-neutral-500 print:block">By {v.label.toLowerCase()}</p>
                  <SpendTable rows={s[v.key] as CrSpendRow[]} head={v.head} payee={v.key === "byPayee"} preparer={v.key === "byPreparer"} />
                </div>
              ))}
            </Block>
          </div>
          <Block title="Every voucher" sub={`${s.vouchers.length} vouchers · ${compact(total, c)} gross`} flush>
            <div className="px-5 pb-5">
              <Table
                caption="Payment vouchers in the period"
                rows={s.vouchers}
                rowKey={(v, k) => `${v.pvNo}-${k}`}
                limit={15}
                cols={[
                  { label: "PV", className: "whitespace-nowrap font-mono text-[12px]", cell: (v) => v.pvNo, total: "Total" },
                  { label: "Date", className: "whitespace-nowrap", cell: (v) => day(v.date) },
                  {
                    label: "Payee",
                    className: "min-w-[12rem]",
                    cell: (v) => (
                      <div>
                        <p className="text-neutral-900">{v.payee}</p>
                        {v.narration && <p className="text-xs text-neutral-500">{v.narration}</p>}
                      </div>
                    ),
                  },
                  { label: "Prepared by", cell: (v) => v.preparedBy ?? "-" },
                  { label: "Status", cell: (v) => <Chip hue={hueFor(v.status)}>{v.status}</Chip> },
                  { label: "Gross", num: true, cell: (v) => money(v.gross), total: money(total) },
                  { label: "VAT", num: true, cell: (v) => money(v.vat), total: money(sumOf(s.vouchers, (v) => v.vat)) },
                  { label: "WHT", num: true, cell: (v) => money(v.wht), total: money(sumOf(s.vouchers, (v) => v.wht)) },
                  { label: "Net", num: true, cell: (v) => money(v.net), total: money(sumOf(s.vouchers, (v) => v.net)) },
                ]}
              />
            </div>
          </Block>
        </>
      )}
    </Chapter>
  );
}

function SpendTable({ rows, head, payee, preparer }: { rows: (CrSpendRow & { net?: number })[]; head: string; payee?: boolean; preparer?: boolean }) {
  const sorted = [...(rows ?? [])].sort((a, b) => b.amount - a.amount);
  return (
    <Table
      caption={`Spend by ${head.toLowerCase()}`}
      rows={sorted}
      rowKey={(x, k) => `${x.label}-${k}`}
      limit={10}
      empty="Nothing to show."
      cols={[
        { label: head, cell: (x) => x.label || "Unassigned", total: "Total" },
        { label: "Lines", num: true, cell: (x) => int(x.count), total: int(sumOf(sorted, (x) => x.count)) },
        { label: "Amount", num: true, cell: (x) => money(x.amount), total: money(sumOf(sorted, (x) => x.amount)) },
        ...(preparer ? [] : [{ label: "WHT", num: true, cell: (x: CrSpendRow) => money(x.wht), total: money(sumOf(sorted, (x) => x.wht)) }]),
        ...(payee ? [{ label: "Net", num: true, cell: (x: CrSpendRow & { net?: number }) => money(x.net ?? 0), total: money(sumOf(sorted, (x) => x.net ?? 0)) }] : []),
      ]}
    />
  );
}

/* --------------------------- 8 requests by person ------------------- */

const byRegisterText = (m: Record<string, number>) =>
  Object.entries(m ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(" · ") || "-";

export function PeopleChapter({ r }: { r: R }) {
  const c = r.currency;
  const regs = Object.entries(r.registers ?? {});
  const people = [...r.requesters].sort((a, b) => b.estimated - a.estimated || b.requests - a.requests);
  const deps = [...r.departments].sort((a, b) => b.estimated - a.estimated || b.requests - a.requests);
  return (
    <Chapter id="people" index={idx("people")} title="Requests by person" icon={UsersRound} hue="blue" lede="Every requisition, advance, memo and request raised in the period, by register, by department and by the person who raised it.">
      {r.requests.length === 0 && regs.length === 0 ? (
        <div className="ws-card">
          <Empty icon={UsersRound} title="Nobody raised a request in this period" hint="Requests raised from any register appear here with the person who raised them." />
        </div>
      ) : (
        <>
          <Block title="By register" flush>
            <div className="px-5 pb-5">
              <Table
                caption="Requests by register"
                rows={regs}
                rowKey={([k]) => k}
                cols={[
                  { label: "Register", cell: ([, x]) => x.label, total: "Total" },
                  { label: "Raised", num: true, cell: ([, x]) => int(x.count), total: int(sumOf(regs, ([, x]) => x.count)) },
                  { label: "Still open", num: true, cell: ([, x]) => int(x.live), total: int(sumOf(regs, ([, x]) => x.live)) },
                  { label: "Estimated", num: true, cell: ([, x]) => money(x.estimated), total: money(sumOf(regs, ([, x]) => x.estimated)) },
                  { label: "Approved", num: true, cell: ([, x]) => money(x.approved), total: money(sumOf(regs, ([, x]) => x.approved)) },
                  { label: "Actual", num: true, cell: ([, x]) => money(x.actual), total: money(sumOf(regs, ([, x]) => x.actual)) },
                ]}
              />
            </div>
          </Block>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <Block title="Who raised the most" sub="By estimated value">
              {people.length === 0 ? (
                <Nothing>No requesters.</Nothing>
              ) : (
                <StatusBars
                  data={people.slice(0, 8).map((p) => ({ label: p.name, value: p.estimated, hue: hueFor(p.name), note: `${p.requests} ${p.requests === 1 ? "request" : "requests"}` }))}
                  format={(v) => compact(v, c)}
                  caption="Requesters by estimated value"
                />
              )}
            </Block>
            <Block title="By department" flush>
              <div className="px-5 pb-5">
                <Table
                  caption="Requests by department"
                  rows={deps}
                  rowKey={(d) => d.name}
                  empty="No departments recorded."
                  cols={[
                    { label: "Department", cell: (d) => d.name || "No department", total: "Total" },
                    { label: "Requests", num: true, cell: (d) => int(d.requests), total: int(sumOf(deps, (d) => d.requests)) },
                    { label: "Open", num: true, cell: (d) => int(d.live), total: int(sumOf(deps, (d) => d.live)) },
                    { label: "Estimated", num: true, cell: (d) => money(d.estimated), total: money(sumOf(deps, (d) => d.estimated)) },
                    { label: "Approved", num: true, cell: (d) => money(d.approved), total: money(sumOf(deps, (d) => d.approved)) },
                    { label: "Actual", num: true, cell: (d) => money(d.actual), total: money(sumOf(deps, (d) => d.actual)) },
                  ]}
                />
              </div>
            </Block>
          </div>
          <Block title="By person" flush>
            <div className="px-5 pb-5">
              <Table
                caption="Requests by the person who raised them"
                rows={people}
                rowKey={(p, k) => `${p.name}-${k}`}
                limit={15}
                cols={[
                  {
                    label: "Raised by",
                    className: "min-w-[11rem]",
                    cell: (p) => (
                      <div>
                        <p className="font-medium text-neutral-900">{p.name}</p>
                        {p.department && <p className="text-xs text-neutral-500">{p.department}</p>}
                      </div>
                    ),
                    total: "Total",
                  },
                  { label: "Requests", num: true, cell: (p) => int(p.requests), total: int(sumOf(people, (p) => p.requests)) },
                  { label: "Open", num: true, cell: (p) => int(p.live), total: int(sumOf(people, (p) => p.live)) },
                  { label: "By register", className: "min-w-[12rem] text-xs", cell: (p) => byRegisterText(p.byRegister) },
                  { label: "Estimated", num: true, cell: (p) => money(p.estimated), total: money(sumOf(people, (p) => p.estimated)) },
                  { label: "Approved", num: true, cell: (p) => money(p.approved), total: money(sumOf(people, (p) => p.approved)) },
                  { label: "Actual", num: true, cell: (p) => money(p.actual), total: money(sumOf(people, (p) => p.actual)) },
                ]}
              />
            </div>
          </Block>
          <Block title="Every request" sub="Search, filter and download. Rows marked “not counted in totals” are listed for the record only.">
            <RequestsLedger requests={r.requests} currency={c} period={`${r.from}_to_${r.to}`} />
          </Block>
        </>
      )}
    </Chapter>
  );
}

/* ----------------------------- 9 receivables ------------------------- */

const AGING: { key: "current" | "d30" | "d60" | "d90" | "over90" | "retention"; label: string; hue: Hue }[] = [
  { key: "current", label: "Not yet due", hue: "mint" },
  { key: "d30", label: "1 to 30 days", hue: "sky" },
  { key: "d60", label: "31 to 60 days", hue: "sun" },
  { key: "d90", label: "61 to 90 days", hue: "coral" },
  { key: "over90", label: "Over 90 days", hue: "rose" },
  { key: "retention", label: "Retention", hue: "grape" },
];

export function ReceivablesChapter({ r }: { r: R }) {
  const rc = r.receivables;
  const c = r.currency;
  return (
    <Chapter id="receivables" index={idx("receivables")} title="Receivables" icon={Banknote} hue="mint" lede={`What clients owe at ${day(rc.asOf)}, by how long it has been due.`}>
      {rc.clients.length === 0 ? (
        <div className="ws-card">
          <Empty icon={Banknote} hue="mint" title="No client owes anything" hint="Unpaid invoices show here, aged by days past due." />
        </div>
      ) : (
        <>
          <Block title="Aging" sub={`${compact(rc.totals.total, c)} outstanding from ${rc.clients.length} ${rc.clients.length === 1 ? "client" : "clients"}`}>
            <StackBar parts={AGING.map((a) => ({ label: a.label, value: rc.totals[a.key], hue: a.hue }))} format={(v) => compact(v, c)} caption="Receivables by age" />
          </Block>
          <Block title="By client" flush>
            <div className="px-5 pb-5">
              <Table
                caption="Receivables by client and age"
                rows={[...rc.clients].sort((a, b) => b.total - a.total)}
                rowKey={(x) => x.client}
                limit={15}
                cols={[
                  { label: "Client", className: "min-w-[11rem]", cell: (x) => <span className="font-medium text-neutral-900">{x.client}</span>, total: "Total" },
                  ...AGING.map((a) => ({
                    label: a.label,
                    num: true,
                    cell: (x: (typeof rc.clients)[number]) => <span className={cx((a.key === "d90" || a.key === "over90") && x[a.key] > 0 && "text-rose-700")}>{money(x[a.key])}</span>,
                    total: money(rc.totals[a.key]),
                  })),
                  { label: "Total", num: true, cell: (x) => <span className="font-semibold">{money(x.total)}</span>, total: money(rc.totals.total) },
                ]}
              />
            </div>
          </Block>
        </>
      )}
    </Chapter>
  );
}

/* ------------------- 10 payables, advances, commitments -------------- */

const ageHint = (days: number) => (days > 60 ? "text-rose-700 font-semibold" : days > 30 ? "text-sun-700" : "text-neutral-700");

export function PayablesChapter({ r }: { r: R }) {
  return (
    <Chapter id="payables" index={idx("payables")} title="Payables, advances & commitments" icon={Wallet} hue="sun" lede="What the organisation still has to pay, advances not yet retired, and money committed to projects but not yet spent.">
      <Block title="Payables" sub="Approved vouchers awaiting payment" flush>
        <div className="px-5 pb-5">
          <Table
            caption="Unpaid vouchers"
            rows={r.payables}
            rowKey={(p, k) => `${p.pvNo}-${k}`}
            empty="Every approved voucher has been paid."
            cols={[
              { label: "PV", className: "whitespace-nowrap font-mono text-[12px]", cell: (p) => p.pvNo, total: "Total" },
              { label: "Date", className: "whitespace-nowrap", cell: (p) => day(p.date) },
              {
                label: "Payee",
                className: "min-w-[12rem]",
                cell: (p) => (
                  <div>
                    <p className="text-neutral-900">{p.payee}</p>
                    {p.narration && <p className="text-xs text-neutral-500">{p.narration}</p>}
                  </div>
                ),
              },
              { label: "Status", cell: (p) => <Chip hue={hueFor(p.status)}>{p.status}</Chip> },
              { label: "Days waiting", num: true, cell: (p) => <span className={ageHint(p.days)}>{int(p.days)}</span> },
              { label: "Net", num: true, cell: (p) => money(p.net), total: money(sumOf(r.payables, (p) => p.net)) },
            ]}
          />
        </div>
      </Block>
      <div className="grid gap-6 xl:grid-cols-2">
        <Block title="Advances outstanding" flush>
          <div className="px-5 pb-5">
            <Table
              caption="Advances not yet retired"
              rows={r.advances}
              rowKey={(a, k) => `${a.reference ?? a.title}-${k}`}
              empty="Every advance has been retired."
              cols={[
                {
                  label: "Advance",
                  className: "min-w-[11rem]",
                  cell: (a) => (
                    <div>
                      <p className="text-neutral-900">{a.title}</p>
                      <p className="text-xs text-neutral-500">{[a.reference, a.project].filter(Boolean).join(" · ") || "-"}</p>
                    </div>
                  ),
                  total: "Total",
                },
                {
                  label: "Holder",
                  cell: (a) => (
                    <div>
                      <p>{a.person ?? "-"}</p>
                      {a.department && <p className="text-xs text-neutral-500">{a.department}</p>}
                    </div>
                  ),
                },
                { label: "Days", num: true, cell: (a) => <span className={ageHint(a.days)}>{int(a.days)}</span> },
                { label: "Outstanding", num: true, cell: (a) => money(a.outstanding), total: money(sumOf(r.advances, (a) => a.outstanding)) },
              ]}
            />
          </div>
        </Block>
        <Block title="Commitments" sub="Approved for projects, not yet spent" flush>
          <div className="px-5 pb-5">
            <Table
              caption="Open commitments by project and category"
              rows={r.commitments}
              rowKey={(m, k) => `${m.project}-${m.category}-${k}`}
              empty="Nothing is committed and unspent."
              cols={[
                { label: "Project", cell: (m) => m.project, total: "Total" },
                { label: "Category", cell: (m) => m.category },
                { label: "Items", num: true, cell: (m) => int(m.count), total: int(sumOf(r.commitments, (m) => m.count)) },
                { label: "Outstanding", num: true, cell: (m) => money(m.outstanding), total: money(sumOf(r.commitments, (m) => m.outstanding)) },
              ]}
            />
          </div>
        </Block>
      </div>
    </Chapter>
  );
}

/* -------------------------- 11 tax, assets, labour ------------------- */

export function TaxChapter({ r }: { r: R }) {
  const c = r.currency;
  const { tax, assets, labour } = r;
  const unremitted = tax.whtWithheld - tax.remitted;
  return (
    <Chapter id="tax" index={idx("tax")} title="Tax, assets & labour" icon={Landmark} hue="sky" lede="VAT and withholding tax on the period's vouchers, the fixed asset register, and staff time costed to projects.">
      <div className="grid gap-6 xl:grid-cols-3">
        <Block title="Tax">
          <Figures>
            <Figure label="VAT on vouchers" value={compact(tax.vat, c)} />
            <Figure label="WHT withheld" value={compact(tax.whtWithheld, c)} />
            <Figure label="WHT remitted" value={compact(tax.remitted, c)} hint={unremitted > 0 ? `${compact(unremitted, c)} still to remit` : "All remitted"} tone={unremitted > 0 ? "bad" : "good"} />
          </Figures>
          <div className="mt-4">
            <Table
              caption="Withholding tax by code"
              rows={tax.byCode}
              rowKey={(x) => x.code}
              empty="No withholding tax in this period."
              cols={[
                { label: "Code", cell: (x) => x.code, total: "Total" },
                { label: "Lines", num: true, cell: (x) => int(x.lines), total: int(sumOf(tax.byCode, (x) => x.lines)) },
                { label: "Base", num: true, cell: (x) => money(x.base), total: money(sumOf(tax.byCode, (x) => x.base)) },
                { label: "WHT", num: true, cell: (x) => money(x.wht), total: money(sumOf(tax.byCode, (x) => x.wht)) },
              ]}
            />
          </div>
        </Block>
        <Block title="Fixed assets" sub={`${int(assets.count)} ${assets.count === 1 ? "asset" : "assets"} on the register`}>
          <Figures>
            <Figure label="Cost" value={compact(assets.cost, c)} />
            <Figure label="Depreciation to date" value={compact(assets.accumulated, c)} />
            <Figure label="Net book value" value={compact(assets.nbv, c)} />
          </Figures>
          <div className="mt-4">
            <Table
              caption="Fixed assets by class"
              rows={assets.byClass}
              rowKey={(x) => x.label}
              empty="No assets on the register."
              cols={[
                { label: "Class", cell: (x) => x.label, total: "Total" },
                { label: "Count", num: true, cell: (x) => int(x.count), total: int(assets.count) },
                { label: "Cost", num: true, cell: (x) => money(x.cost), total: money(assets.cost) },
                { label: "NBV", num: true, cell: (x) => money(x.nbv), total: money(assets.nbv) },
              ]}
            />
          </div>
        </Block>
        <Block title="Labour" sub={`${int(Math.round(labour.hours))} hours costed`}>
          <Figures>
            <Figure label="Allocated to projects" value={compact(labour.allocated, c)} />
            <Figure label="Bench (unallocated)" value={compact(labour.bench, c)} tone={labour.bench > 0 ? "bad" : undefined} />
            <Figure
              label="Utilisation"
              value={labour.allocated + labour.bench > 0 ? `${Math.round((labour.allocated / (labour.allocated + labour.bench)) * 100)}%` : "-"}
            />
          </Figures>
          <div className="mt-4">
            <Table
              caption="Labour cost by project"
              rows={labour.byProject}
              rowKey={(x) => x.label}
              empty="No labour costed in this period."
              cols={[
                { label: "Project", cell: (x) => x.label, total: "Total" },
                { label: "People", num: true, cell: (x) => int(x.people) },
                { label: "Hours", num: true, cell: (x) => int(Math.round(x.hours)), total: int(Math.round(sumOf(labour.byProject, (x) => x.hours))) },
                { label: "Cost", num: true, cell: (x) => money(x.amount), total: money(sumOf(labour.byProject, (x) => x.amount)) },
              ]}
            />
          </div>
        </Block>
      </div>
    </Chapter>
  );
}

/* ------------------------------ 12 approvals ------------------------- */

export function ApprovalsChapter({ r }: { r: R }) {
  const a = r.approvals;
  const c = r.currency;
  return (
    <Chapter id="approvals" index={idx("approvals")} title="Approvals" icon={BadgeCheck} hue="grape" lede="How each approval process moved in the period, and who decided what and how quickly.">
      <Block title="By process" flush>
        <div className="px-5 pb-5">
          <Table
            caption="Approvals by process"
            rows={a.byProcess}
            rowKey={(x) => x.process}
            empty="Nothing went for approval in this period."
            cols={[
              { label: "Process", cell: (x) => <span className="font-medium text-neutral-900">{x.process}</span>, total: "Total" },
              { label: "Submitted", num: true, cell: (x) => int(x.submitted), total: int(sumOf(a.byProcess, (x) => x.submitted)) },
              { label: "Approved", num: true, cell: (x) => int(x.approved), total: int(sumOf(a.byProcess, (x) => x.approved)) },
              { label: "Rejected", num: true, cell: (x) => int(x.rejected), total: int(sumOf(a.byProcess, (x) => x.rejected)) },
              { label: "Still open", num: true, cell: (x) => int(x.open), total: int(sumOf(a.byProcess, (x) => x.open)) },
              { label: "Avg. days", num: true, cell: (x) => (x.avgDays === null ? "-" : x.avgDays.toFixed(1)) },
              { label: `Amount (${c})`, num: true, cell: (x) => money(x.amount), total: money(sumOf(a.byProcess, (x) => x.amount)) },
            ]}
          />
        </div>
      </Block>
      <Block title="By approver" flush>
        <div className="px-5 pb-5">
          <Table
            caption="Decisions by approver"
            rows={[...a.byApprover].sort((x, y) => y.decisions - x.decisions)}
            rowKey={(x) => x.name}
            empty="Nobody made an approval decision in this period."
            cols={[
              { label: "Approver", cell: (x) => <span className="font-medium text-neutral-900">{x.name}</span>, total: "Total" },
              { label: "Decisions", num: true, cell: (x) => int(x.decisions), total: int(sumOf(a.byApprover, (x) => x.decisions)) },
              { label: "Approved", num: true, cell: (x) => int(x.approved), total: int(sumOf(a.byApprover, (x) => x.approved)) },
              { label: "Rejected", num: true, cell: (x) => int(x.rejected), total: int(sumOf(a.byApprover, (x) => x.rejected)) },
              { label: "Returned", num: true, cell: (x) => int(x.returned), total: int(sumOf(a.byApprover, (x) => x.returned)) },
              {
                label: "Avg. time to decide",
                num: true,
                cell: (x) => (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} className="text-neutral-400" aria-hidden />
                    {x.avgHours === null ? "-" : x.avgHours >= 48 ? `${(x.avgHours / 24).toFixed(1)} days` : `${x.avgHours.toFixed(1)} h`}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </Block>
    </Chapter>
  );
}
