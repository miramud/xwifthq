"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarRange, ChevronRight, CircleDollarSign, Coins, FolderKanban, HandCoins, Landmark, Receipt, Siren, TrendingUp, Wallet } from "lucide-react";
import { plainError, spend, type Portfolio, type ProjectFunds, type Rag } from "@/lib/api/finance-payments-client";
import { Card, Empty, PageHeader, Panel, Segmented, StatCard, StatGrid, cx } from "@/components/workspace/kit";
import { StackedColumns } from "@/components/workspace/charts";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE } from "@/components/workspace/modules";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { amount, compact } from "@/suite/finance/lib/format";
import { FundsBar, FundsLegend } from "./FundsBar";
import { RAG, byRisk, headline } from "./meta";
import { IndexValue, ProgressRing } from "./EarnedValue";
import { marginBp, marginText } from "./earned-value";
import { RagChip } from "./RagChip";
import { ComplianceFlag } from "./ComplianceFlag";

/**
 * The MD's morning screen (Finance PRD §16.10). One sentence and one bar for
 * the whole portfolio - how much is released, spent, committed and still
 * available - then what has been collected and what the portfolio is on
 * course to make, then the projects that need a look, then every project
 * with its status in words. The table reads two ways: earned value (percent
 * complete, CPI, SPI, profit, collections) or funds (the release pipe). On
 * a phone it becomes a stack of cards.
 */

type Filter = "all" | Rag;
export type SortKey =
  | "risk"
  | "name"
  | "bac"
  | "released"
  | "committed"
  | "spent"
  | "available"
  | "spentThisMonth"
  | "pctBp"
  | "cpi"
  | "spi"
  | "progressProfit"
  | "projectedProfit"
  | "collected"
  | "overdue";
type Lens = "value" | "funds";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "risk", label: "Status (worst first)" },
  { key: "name", label: "Name" },
  { key: "pctBp", label: "Percent complete" },
  { key: "cpi", label: "Cost efficiency (CPI)" },
  { key: "spi", label: "Schedule (SPI)" },
  { key: "projectedProfit", label: "Projected profit" },
  { key: "overdue", label: "Overdue" },
  { key: "available", label: "Available" },
  { key: "spent", label: "Spent" },
  { key: "spentThisMonth", label: "Spent this month" },
  { key: "bac", label: "Budget" },
];

/** Sort rows by a figure; a project without the figure (no CPI yet) goes last either way. */
export function sortProjects(rows: ProjectFunds[], key: SortKey, dir: "asc" | "desc"): ProjectFunds[] {
  const d = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "risk") return dir === "desc" ? byRisk(a, b) : -byRisk(a, b);
    if (key === "name") return a.name.localeCompare(b.name) * d;
    const x = a[key];
    const y = b[key];
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * d || a.name.localeCompare(b.name);
  });
}

const longDate = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default function PortfolioBoard() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "risk", dir: "desc" });
  const [lens, setLens] = useState<Lens>("value");

  useEffect(() => {
    let alive = true;
    spend.funds.portfolio().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(plainError(e, "The portfolio didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Rag, number> = { red: 0, amber: 0, green: 0, grey: 0, stale: 0 };
    projects.forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1));
    return c;
  }, [projects]);

  const shown = useMemo(() => {
    const rows = projects.filter((p) => filter === "all" || p.status === filter);
    return sortProjects(rows, sort.key, sort.dir);
  }, [projects, filter, sort]);

  const attention = useMemo(() => projects.filter((p) => p.status === "red" || p.status === "amber" || p.status === "stale").sort(byRisk), [projects]);

  if (error)
    return (
      <div>
        <PageHeader title="Project funds" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div className="space-y-5">
        <Skeleton className="h-56" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );

  const t = data.totals;
  const live = projects.filter((p) => p.hasBudget).length;
  const usedPct = t.released > 0 ? Math.round(((t.spent + t.committed) / t.released) * 100) : 0;
  const portfolioMargin = marginBp(t.projectedProfit, t.profitContractValue);

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <div>
      <PageHeader
        eyebrow={longDate()}
        title="Project funds"
        subtitle="Where every project's money stands: what is released, committed, spent and still available, and which projects need a look."
      />

      <ComplianceFlag className="mb-5" />

      {projects.length === 0 ? (
        <Card>
          <Empty icon={FolderKanban} title="No projects yet" hint="Projects set up in Elevate Projects appear here. Give each one a budget to bring it under fund control." />
        </Card>
      ) : (
        <>
          {/* The thesis: the whole portfolio as one pipe. */}
          <Card className="relative mb-5 overflow-hidden p-5 sm:p-7">
            <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-mint-50" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-500">Available to spend across {live === 1 ? "1 funded project" : `${live} funded projects`}</p>
                <p className={cx("mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums sm:text-[48px]", t.available < 0 ? "text-rose-700" : "text-neutral-900")}>{compact(t.available)}</p>
                <p className="mt-2 text-sm text-neutral-600">
                  Of <span className="font-semibold text-neutral-900 tabular-nums">{compact(t.released)}</span> released against budgets of{" "}
                  <span className="font-semibold text-neutral-900 tabular-nums">{compact(t.bac)}</span>, {usedPct}% is spent or committed.
                </p>
                <div className="mt-6">
                  <FundsBar figures={t} size="lg" />
                  <div className="mt-3">
                    <FundsLegend figures={t} show={t.available < 0 ? ["spent", "committed", "over", "unreleased"] : undefined} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 self-start sm:grid-cols-4 lg:grid-cols-1">
                {(["red", "amber", "stale", "green"] as const).map((r) => {
                  const m = RAG[r];
                  const Icon = m.icon;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFilter((f) => (f === r ? "all" : r))}
                      aria-pressed={filter === r}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-primary-300",
                        filter === r ? "border-neutral-900/20 bg-white shadow-sm" : "border-transparent " + HUE[m.hue].soft,
                      )}
                    >
                      <Icon size={18} aria-hidden className={HUE[m.hue].text} />
                      <span className="min-w-0">
                        <span className="block text-2xl font-bold leading-none tabular-nums text-neutral-900">{counts[r]}</span>
                        <span className={cx("text-xs font-semibold", HUE[m.hue].text)}>{m.label}</span>
                      </span>
                    </button>
                  );
                })}
                {counts.grey > 0 && <p className="col-span-2 text-xs text-neutral-500 sm:col-span-4 lg:col-span-1">{counts.grey} without a budget, outside fund control.</p>}
              </div>
            </div>
          </Card>

          <div className="mb-5">
            <StatGrid cols={5}>
              <StatCard label="Released" value={compact(t.released)} icon={HandCoins} hue="blue" hint="Approved by the MD" />
              <StatCard label="Committed" value={compact(t.committed)} icon={Receipt} hue="grape" hint="Approved requests not yet spent" />
              <StatCard label="Spent" value={compact(t.spent)} icon={CircleDollarSign} hue="sky" hint="In the books" />
              <StatCard label="Spent this month" value={compact(t.spentThisMonth)} icon={CalendarRange} hue="mint" hint="Non-labour, month to date" />
              <StatCard
                label="Unplanned spend"
                value={compact(t.unplanned)}
                icon={Siren}
                hue={t.unplanned > 0 ? "rose" : "slate"}
                hint={t.unplanned > 0 ? "Left the bank with no request" : "Everything went through a request"}
              />
            </StatGrid>
          </div>

          <div className="mb-5">
            <StatGrid cols={3}>
              <StatCard
                label="Collected to date"
                value={compact(t.collected)}
                icon={Coins}
                hue="mint"
                hint={t.invoiced > 0 ? `${Math.round((t.collected / t.invoiced) * 100)}% of ${compact(t.invoiced)} invoiced` : "Nothing invoiced yet"}
              />
              <StatCard
                label="Outstanding receivables"
                value={compact(t.receivable)}
                icon={Landmark}
                hue={t.overdue > 0 ? "rose" : "sky"}
                hint={t.overdue > 0 ? `${compact(t.overdue)} overdue` : t.receivable > 0 ? "Nothing overdue" : "Every invoice is paid"}
              />
              <StatCard
                label="Projected profit"
                value={compact(t.projectedProfit)}
                icon={TrendingUp}
                hue={t.projectedProfit < 0 ? "rose" : "grape"}
                hint={portfolioMargin !== null ? `${marginText(portfolioMargin)} margin on ${compact(t.profitContractValue)} of contracts` : "Shows once a project has a contract and a budget"}
              />
            </StatGrid>
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title="Funds by project" subtitle="Spent, committed and available within each release" icon={Wallet}>
              <StackedColumns
                data={projects
                  .filter((p) => p.released > 0 || p.spent > 0)
                  .map((p) => ({ label: p.code || p.name, values: { spent: p.spent, committed: p.committed, available: Math.max(0, p.available) } }))}
                series={[
                  { key: "spent", label: "Spent", hue: "blue" },
                  { key: "committed", label: "Committed", hue: "grape" },
                  { key: "available", label: "Available", hue: "mint" },
                ]}
                format={(v) => compact(v)}
                caption="Spent, committed and available funds by project"
                showTotals
              />
            </Panel>
            <Panel
              title="Needs attention"
              subtitle={attention.length ? `${attention.length} ${attention.length === 1 ? "project" : "projects"} red, amber or stale` : "Nothing red, amber or stale"}
              icon={Siren}
              hue="rose"
            >
              {attention.length === 0 ? (
                <p className="text-sm text-neutral-600">Every funded project is on plan, within its release and its budget to date, with fresh progress.</p>
              ) : (
                <ul className="space-y-3">
                  {attention.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/suite/finance/projects/${p.id}`}
                        className="group block rounded-xl border border-neutral-200/80 p-3 outline-none transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-700">{p.name}</span>
                          <RagChip status={p.status} />
                        </span>
                        <span className="mt-1 block text-xs text-neutral-600">{headline(p)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <section aria-labelledby="pf-list" className="ws-card overflow-hidden">
            <header className="flex flex-col gap-3 px-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 id="pf-list" className="text-[15px] font-semibold text-neutral-900">
                  Every project
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {shown.length} of {projects.length} · each status comes with the reason behind it
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Show the table by"
                  value={lens}
                  onChange={setLens}
                  options={[
                    { key: "value", label: "Earned value" },
                    { key: "funds", label: "Funds" },
                  ]}
                />
                <div className="ws-no-scrollbar max-w-full overflow-x-auto">
                  <Segmented
                    label="Show projects by status"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { key: "all", label: "All" },
                      { key: "red", label: `Red ${counts.red}` },
                      { key: "amber", label: `Amber ${counts.amber}` },
                      ...(counts.stale > 0 ? [{ key: "stale" as const, label: `Stale ${counts.stale}` }] : []),
                      { key: "green", label: `Green ${counts.green}` },
                      { key: "grey", label: `No budget ${counts.grey}` },
                    ]}
                  />
                </div>
                <div className="w-full md:hidden">
                  <SearchableSelect
                    size="sm"
                    aria-label="Sort projects by"
                    value={sort.key}
                    onChange={(v) => setSort({ key: v as SortKey, dir: v === "name" ? "asc" : "desc" })}
                    options={SORTS.map((x) => ({ value: x.key, label: `Sort: ${x.label}` }))}
                    searchPlaceholder="Search sort orders"
                  />
                </div>
              </div>
            </header>

            {shown.length === 0 ? (
              <Empty icon={FolderKanban} title="No projects with that status" hint="Choose All to see every project." />
            ) : (
              <>
                {/* Phone: one card per project. */}
                <ul className="mt-4 space-y-3 px-4 pb-4 md:hidden">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <ProjectCard p={p} />
                    </li>
                  ))}
                </ul>

                {/* Tablet and up: the table. */}
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1080px] text-sm">
                    <caption className="sr-only">{lens === "value" ? "Every project's earned value, profit and collections" : "Every project's funds and status"}</caption>
                    <thead>
                      <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        <SortHead label="Project" k="name" sort={sort} onSort={sortBy} className="pl-5" />
                        <SortHead label="Status" k="risk" sort={sort} onSort={sortBy} />
                        {lens === "value" ? (
                          <>
                            <SortHead label="Complete" k="pctBp" sort={sort} onSort={sortBy} />
                            <SortHead label="CPI" k="cpi" sort={sort} onSort={sortBy} right />
                            <SortHead label="SPI" k="spi" sort={sort} onSort={sortBy} right />
                            <SortHead label="Profit to date" k="progressProfit" sort={sort} onSort={sortBy} right />
                            <SortHead label="Projected profit" k="projectedProfit" sort={sort} onSort={sortBy} right />
                            <SortHead label="Collected" k="collected" sort={sort} onSort={sortBy} right />
                            <SortHead label="Overdue" k="overdue" sort={sort} onSort={sortBy} right className="pr-5" />
                          </>
                        ) : (
                          <>
                            <SortHead label="Budget" k="bac" sort={sort} onSort={sortBy} right />
                            <SortHead label="Released" k="released" sort={sort} onSort={sortBy} right />
                            <SortHead label="Committed" k="committed" sort={sort} onSort={sortBy} right />
                            <SortHead label="Spent" k="spent" sort={sort} onSort={sortBy} right />
                            <SortHead label="Available" k="available" sort={sort} onSort={sortBy} right />
                            <th scope="col" className="w-40 px-3 py-2.5">
                              Funds
                            </th>
                            <SortHead label="This month" k="spentThisMonth" sort={sort} onSort={sortBy} right className="pr-5" />
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((p) => (
                        <tr key={p.id} className="group border-b border-neutral-100 align-top last:border-b-0 hover:bg-neutral-50/60">
                          <td className="py-3.5 pl-5 pr-3">
                            <Link href={`/suite/finance/projects/${p.id}`} className="font-semibold text-neutral-900 outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                              {p.name}
                            </Link>
                            <span className="mt-0.5 block text-xs text-neutral-500">{[p.code, p.client].filter(Boolean).join(" · ") || "—"}</span>
                          </td>
                          <td className="max-w-[18rem] px-3 py-3.5">
                            <RagChip status={p.status} />
                            <span className="mt-1 block text-xs leading-snug text-neutral-600">{headline(p)}</span>
                          </td>
                          {lens === "value" ? (
                            <>
                              <td className="px-3 py-3">
                                <ProgressRing pctBp={p.pctBp} stale={p.status === "stale"} />
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <IndexValue name="CPI" value={p.cpi} />
                              </td>
                              <td className="px-3 py-3.5 text-right">
                                <IndexValue name="SPI" value={p.spi} />
                              </td>
                              <Num v={p.progressProfit} />
                              <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
                                <span className={cx("block font-semibold", p.projectedProfit === null ? "text-neutral-500" : p.projectedProfit < 0 ? "text-rose-700" : "text-neutral-900")}>
                                  {p.projectedProfit === null ? "–" : amount(p.projectedProfit)}
                                </span>
                                {p.projectedMarginBp !== null && <span className="block text-xs text-neutral-500">{marginText(p.projectedMarginBp)} margin</span>}
                              </td>
                              <Num v={p.collected} muted={p.invoiced === 0} />
                              <Num v={p.overdue} danger={p.overdue > 0} className="pr-5" />
                            </>
                          ) : (
                            <>
                              <Num v={p.bac} muted={!p.hasBudget} />
                              <Num v={p.released} />
                              <Num v={p.committed} />
                              <Num v={p.spent} />
                              <Num v={p.available} strong />
                              <td className="px-3 py-4">
                                {p.hasBudget ? <FundsBar figures={p} size="sm" /> : <span className="text-xs text-neutral-500">No budget</span>}
                              </td>
                              <Num v={p.spentThisMonth} className="pr-5" />
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="border-t border-neutral-100 px-5 py-3">
              {lens === "funds" ? (
                <FundsLegend />
              ) : (
                <p className="text-xs text-neutral-600">
                  CPI is the work done for each naira spent; SPI is the work done against the work planned by now. 0.95 and up is on plan, 0.85 to 0.95 slipping, under 0.85 off plan.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Num({ v, strong, muted, danger, className }: { v: number | null; strong?: boolean; muted?: boolean; danger?: boolean; className?: string }) {
  return (
    <td
      className={cx(
        "whitespace-nowrap px-3 py-3.5 text-right tabular-nums",
        strong || danger ? "font-semibold" : "",
        v === null || muted ? "text-neutral-500" : v < 0 || danger ? "text-rose-700" : strong ? "text-neutral-900" : "text-neutral-700",
        className,
      )}
    >
      {v === null ? "–" : amount(v)}
    </td>
  );
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  right,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  right?: boolean;
  className?: string;
}) {
  const on = sort.key === k;
  const Icon = on && sort.dir === "asc" ? ArrowUpNarrowWide : ArrowDownWideNarrow;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cx("px-3 py-2.5", right && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cx("inline-flex cursor-pointer items-center gap-1 rounded uppercase outline-none hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300", on && "text-neutral-900")}
      >
        {label}
        <Icon size={13} aria-hidden className={on ? "opacity-100" : "opacity-30"} />
      </button>
    </th>
  );
}

function ProjectCard({ p }: { p: ProjectFunds }) {
  return (
    <Link
      href={`/suite/finance/projects/${p.id}`}
      className="block rounded-2xl border border-neutral-200/80 bg-white p-4 outline-none transition hover:border-neutral-300 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-neutral-900">{p.name}</span>
          <span className="block text-xs text-neutral-500">{[p.code, p.client].filter(Boolean).join(" · ") || "—"}</span>
        </span>
        <ChevronRight size={18} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
      </span>
      <span className="mt-3 flex items-start gap-2">
        <RagChip status={p.status} />
      </span>
      <span className="mt-1.5 block text-xs leading-snug text-neutral-600">{headline(p)}</span>
      <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-neutral-50 px-3 py-2">
        <ProgressRing pctBp={p.pctBp} stale={p.status === "stale"} size={24} />
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          CPI <IndexValue name="CPI" value={p.cpi} />
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          SPI <IndexValue name="SPI" value={p.spi} />
        </span>
      </span>
      {p.hasBudget && (
        <span className="mt-3 block">
          <FundsBar figures={p} />
        </span>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
        {(
          [
            ["Available", p.available],
            ["Spent", p.spent],
            ["Budget", p.bac],
            ["Projected profit", p.projectedProfit],
            ["Collected", p.collected],
            ["Overdue", p.overdue],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-[11px] font-medium text-neutral-500">{label}</dt>
            <dd className={cx("truncate text-sm font-semibold tabular-nums", v === null ? "text-neutral-500" : v < 0 || (label === "Overdue" && v > 0) ? "text-rose-700" : "text-neutral-900")}>
              {v === null ? "–" : compact(v)}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
