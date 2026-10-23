"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BellRing,
  BookOpenCheck,
  Clock,
  Coins,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Layers,
  Lock,
  Pencil,
  Receipt,
  Save,
  Scale,
  Send,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button, Card, Chip, Empty, Panel, cx, initialsOf } from "@/components/workspace/kit";
import { GroupedColumns, MultiLine, StackedColumns } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  financials as financialsApi,
  performance as performanceApi,
  type FinanceCategoryRow,
  type FinanceMemberRow,
  type FinanceRag,
  type Project,
  type ProjectFinancials,
  type SpendRequestRow,
  type SpendRequester,
} from "@/lib/api/projects-client";
import { hours, money, moneyRounded, rate, toMajor, toMinor } from "./money";
import {
  FieldError,
  MiniStat,
  Modal,
  Notice,
  SectionHeading,
  TabSkeleton,
  fmtDate,
  hintCls,
  inputCls,
  invalidCls,
  labelCls,
  plural,
  sayJobTitle,
} from "./ui/pkit";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { isRichBlank } from "@/lib/richText";

/**
 * Expected expense against actual, on the project (owner, 9 Oct 2026).
 *
 * **Expected** is Finance's approved project budget, by category and month.
 * **Actual** is labour - logged sprint hours at each member's rate card - plus
 * everything Finance has paid on the project's vouchers: travel, workshops and
 * events, purchases, memos. Every request is listed with who raised it.
 *
 * The figure everything else hangs off is one bar per category: the hatched
 * track is what was expected, the solid fill is what has been spent, the
 * dashed wash is what is already committed, and the tick is where spending
 * was planned to be by today. Past the end of the track is overrun, in rose,
 * with the words "over budget" beside it - never colour alone.
 *
 * Cost viewers only (`can.viewCost`), the same gate as the cost report.
 */

type Meta = { categories: Record<string, string>; canDraftBudget: boolean };

const RAG: Record<FinanceRag, { hue: Hue; label: string }> = {
  green: { hue: "mint", label: "On track" },
  amber: { hue: "sun", label: "Watch" },
  red: { hue: "rose", label: "At risk" },
  grey: { hue: "slate", label: "No budget" },
  stale: { hue: "grape", label: "Stale data" },
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10` → `Oct 26`. */
function monthLabel(ym: string, long = false): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return long ? `${MON[m - 1]} ${y}` : `${MON[m - 1]} ${String(y).slice(2)}`;
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string, cap = 60): string[] {
  const out: string[] = [];
  let m = from;
  while (m <= to && out.length < cap) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

const humanize = (s: string | null | undefined) =>
  s ? (s[0].toUpperCase() + s.slice(1)).replace(/_/g, " ") : "—";

const bpPct = (bp: number | null | undefined) => (bp == null ? null : Math.round(bp / 100));

/** A short figure for a chart axis: `₦1.2M`, `$840K`. */
function compactMoney(minor: number, currency: string): string {
  const symbol = money(0, currency).replace(/[\d.,−]/g, "");
  const v = Math.abs(minor) / 100;
  const sign = minor < 0 ? "−" : "";
  const n =
    v >= 1e9 ? `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(Math.round(v));
  return `${sign}${symbol}${n}`;
}

function requestHue(r: SpendRequestRow): Hue {
  if (!r.live) return "slate";
  const s = r.status.toLowerCase();
  if (/(paid|approved|retired|closed|completed|posted|cleared|delivered|received)/.test(s)) return "mint";
  if (/(reject|declin|cancel|void|expired)/.test(s)) return "rose";
  if (/(pending|submitted|review|await|draft)/.test(s)) return "sun";
  return "sky";
}

export default function ProjectFinancePanel({ project }: { project: Project }) {
  const [data, setData] = useState<ProjectFinancials | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<{ message: string; notice: string | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    /* Guarded here too: a reader who may not see cost must not send a request that is refused. */
    if (!project.can.viewCost) return;
    let cancelled = false;
    financialsApi
      .forProject(project.slug)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "The project's finances did not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [project.slug, project.can.viewCost, reloads]);

  const canExport = Boolean(project.can.exportPerformance ?? project.can.manageBoard);

  const downloadSheet = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await performanceApi.export(project.slug);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : "The performance sheet could not be downloaded.");
    } finally {
      setExporting(false);
    }
  };

  if (!project.can.viewCost) {
    return (
      <Card>
        <Empty
          icon={Lock}
          hue="mint"
          title="You cannot see this project's finances"
          hint="The finance sheet names rates, pay-derived labour and every spend request. It is for the project manager, the delivery lead and Finance."
        />
      </Card>
    );
  }

  if (data === null || meta === null) {
    if (error !== null) return <Notice tone="error">{error}</Notice>;
    return <TabSkeleton stats={6} />;
  }

  const c = data.currency;
  const fmt = (minor: number | null | undefined) => (minor == null ? "—" : money(minor, c));
  const fmtR = (minor: number | null | undefined) => (minor == null ? "—" : moneyRounded(minor, c));

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Finance"
        hint={`Expected expense against what the project has actually cost, in ${c}.`}
        actions={
          <>
            {canExport && (
              <Button icon={FileSpreadsheet} onClick={() => void downloadSheet()} disabled={exporting}>
                {exporting ? "Preparing…" : "Download performance sheet (Excel)"}
              </Button>
            )}
            {meta.canDraftBudget && (
              <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>
                {data.budget ? "Draft a new budget" : "Draft budget"}
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-3">
        {exportError && <Notice tone="error">{exportError}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {saved && (
          <Notice tone={saved.notice ? "warn" : "success"} title={saved.message} action={
            <Button size="sm" variant="ghost" onClick={() => setSaved(null)}>Dismiss</Button>
          }>
            {saved.notice}
          </Notice>
        )}
        {!data.hasFinance && (
          <Notice tone="info" title="Finance isn't switched on — showing labour and requests only">
            Without Finance there is no approved budget to measure against, and no vouchers, releases or ledger. Labour comes from logged hours at the rate card.
          </Notice>
        )}
        {data.hasFinance && data.budget === null && (
          <Notice
            tone="warn"
            title="No approved budget yet"
            action={
              meta.canDraftBudget ? (
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                  Draft budget
                </Button>
              ) : undefined
            }
          >
            {data.pendingBudget
              ? `Version ${data.pendingBudget.version} (${moneyRounded(data.pendingBudget.bac, c)}) is ${humanize(data.pendingBudget.status).toLowerCase()}. Until it is approved, the project's expected expense is nil and it sits outside fund control.`
              : "Until Finance approves a budget, the project's expected expense is nil and it sits outside fund control."}
          </Notice>
        )}
        {data.budget !== null && data.pendingBudget && (
          <Notice tone="info">
            Version {data.pendingBudget.version} of the budget ({moneyRounded(data.pendingBudget.bac, c)}) is {humanize(data.pendingBudget.status).toLowerCase()}. Figures below use the approved version {data.budget.version}.
          </Notice>
        )}
        {data.conversionUnavailable && (
          <Notice tone="warn" title={`Labour couldn't be converted from ${data.projectCurrency} to ${c}`}>
            There is no exchange rate from {data.projectCurrency} to {c}, so labour is left out of the totals. Add a rate in the project settings and reload.
          </Notice>
        )}
      </div>

      <Headline data={data} />

      <Reconciliation data={data} fmt={fmt} />

      <Trend data={data} />

      <Labour data={data} />

      <SpendRequests data={data} />

      {data.revenue && <Revenue data={data} />}

      {data.hasFinance && <BooksCheck data={data} fmt={fmt} fmtR={fmtR} />}

      {data.hasFinance && <FundsAndLedger data={data} meta={meta} />}

      {editing && (
        <BudgetEditor
          project={project}
          data={data}
          categories={meta.categories}
          onClose={() => setEditing(false)}
          onSaved={(result) => {
            setEditing(false);
            setSaved(result);
            setReloads((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The burn bar                                                       */
/* ------------------------------------------------------------------ */

/**
 * Expected as a hatched track, actual solid, committed as a dashed wash, the
 * planned-to-date point as a tick, and overrun in rose past the track's end.
 */
function BurnBar({
  expected,
  expectedToDate,
  actual,
  committed,
  label,
  currency,
  size = "md",
}: {
  expected: number;
  expectedToDate: number;
  actual: number;
  committed: number;
  label: string;
  currency: string;
  size?: "md" | "lg";
}) {
  const spent = Math.max(0, actual);
  const held = Math.max(0, committed);
  const scale = Math.max(expected, spent + held, 1);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  const over = expected > 0 && spent + held > expected;
  const summary =
    expected > 0
      ? `${label}: ${money(spent, currency)} spent and ${money(held, currency)} committed of ${money(expected, currency)} expected${over ? `, ${money(spent + held - expected, currency)} over budget` : ""}`
      : `${label}: ${money(spent, currency)} spent and ${money(held, currency)} committed, with no expected figure`;

  return (
    <div role="img" aria-label={summary} className={cx("relative w-full rounded-full bg-neutral-100", size === "lg" ? "h-4" : "h-2.5")}>
      {expected > 0 && <span aria-hidden className="ws-hatch absolute inset-y-0 left-0 rounded-full" style={{ width: pct(expected) }} />}
      {held > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 rounded-full border border-dashed border-sky-500 bg-sky-100"
          style={{ left: pct(spent), width: pct(held) }}
        />
      )}
      <span
        aria-hidden
        className={cx("absolute inset-y-0 left-0 rounded-full", spent > expected && expected > 0 ? "bg-error-500" : "bg-primary-500")}
        style={{ width: pct(spent) }}
      />
      {over && (
        <span
          aria-hidden
          className="absolute inset-y-0 rounded-r-full bg-error-500/80"
          style={{ left: pct(expected), width: `calc(${pct(spent + held)} - ${pct(expected)})` }}
        />
      )}
      {expected > 0 && expectedToDate > 0 && (
        <span
          aria-hidden
          title="Planned to date"
          className={cx("absolute -translate-x-1/2 rounded-full bg-neutral-900", size === "lg" ? "-inset-y-1.5 w-[3px]" : "-inset-y-1 w-0.5")}
          style={{ left: pct(Math.min(expectedToDate, expected)) }}
        />
      )}
    </div>
  );
}

function BurnLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      <li className="flex items-center gap-1.5">
        <span className="ws-hatch h-2.5 w-5 rounded-full ring-1 ring-neutral-200" aria-hidden />
        Expected
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-primary-500" aria-hidden />
        Actual
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full border border-dashed border-sky-500 bg-sky-100" aria-hidden />
        Committed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-error-500" aria-hidden />
        Over budget
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3.5 w-0.5 rounded-full bg-neutral-900" aria-hidden />
        Planned to date
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Headline                                                           */
/* ------------------------------------------------------------------ */

function Headline({ data }: { data: ProjectFinancials }) {
  const c = data.currency;
  const t = data.totals;
  const noBudget = data.budget === null || t.expected === 0;
  const used = bpPct(t.usedBp);
  const rag = data.status ? RAG[data.status] : null;

  const figures: { label: string; value: string; hint?: string; tone?: "bad" | "good" }[] = [
    {
      label: "Expected expense",
      value: noBudget ? "—" : moneyRounded(t.expected, c),
      hint: data.budget ? `Budget v${data.budget.version}${data.budget.approvedAt ? `, approved ${fmtDate(data.budget.approvedAt)}` : ""}` : "No approved budget",
    },
    {
      label: "Actual to date",
      value: moneyRounded(t.actual, c),
      hint: noBudget ? "Labour and paid vouchers" : `${moneyRounded(t.expectedToDate, c)} planned by now`,
    },
    { label: "Committed", value: moneyRounded(t.committed, c), hint: "Approved, not yet spent" },
    {
      label: "Forecast at completion",
      value: moneyRounded(t.forecastAtCompletion, c),
      hint:
        t.varianceAtCompletion == null
          ? "Actual + committed"
          : t.varianceAtCompletion < 0
            ? `${moneyRounded(-t.varianceAtCompletion, c)} over budget`
            : `${moneyRounded(t.varianceAtCompletion, c)} under budget`,
      tone: t.varianceAtCompletion != null && t.varianceAtCompletion < 0 ? "bad" : undefined,
    },
    {
      label: "Remaining",
      value: noBudget ? "—" : moneyRounded(t.remaining, c),
      hint: noBudget ? "Needs a budget" : t.remaining < 0 ? "Over budget" : "Left after commitments",
      tone: !noBudget && t.remaining < 0 ? "bad" : !noBudget ? "good" : undefined,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Expected against actual</p>
          <h3 className="mt-1 text-[15px] font-semibold text-neutral-900">
            {noBudget ? "What the project has cost so far" : "Where the budget stands"}
          </h3>
        </div>
        {rag && (
          <Chip hue={rag.hue} dot>
            {rag.label}
          </Chip>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px bg-neutral-100 sm:grid-cols-3 xl:grid-cols-6 mt-4 border-y border-neutral-100">
        {figures.map((f) => (
          <div key={f.label} className="bg-white px-5 py-4">
            <dt className="text-xs font-medium text-neutral-500">{f.label}</dt>
            <dd
              className={cx(
                "mt-1 text-[22px] font-bold leading-tight tracking-tight tabular-nums",
                f.tone === "bad" ? "text-error-700" : "text-neutral-900",
              )}
            >
              {f.value}
            </dd>
            {f.hint && <dd className={cx("mt-0.5 text-[11px]", f.tone === "bad" ? "font-semibold text-error-700" : "text-neutral-500")}>{f.hint}</dd>}
          </div>
        ))}
        <div className="col-span-2 bg-white px-5 py-4 sm:col-span-1">
          <dt className="text-xs font-medium text-neutral-500">Budget used</dt>
          <dd className={cx("mt-1 text-[22px] font-bold leading-tight tabular-nums", used != null && used > 100 ? "text-error-700" : "text-neutral-900")}>
            {used == null ? "—" : `${used}%`}
          </dd>
          <dd className="mt-2">
            <div
              role="progressbar"
              aria-label="Budget used, actual plus committed"
              aria-valuenow={Math.min(100, used ?? 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="ws-hatch h-2 overflow-hidden rounded-full"
            >
              <div
                className={cx("h-full rounded-full", used != null && used > 100 ? "bg-error-500" : used != null && used > 85 ? "bg-sun-500" : "bg-primary-500")}
                style={{ width: `${Math.min(100, used ?? 0)}%` }}
              />
            </div>
          </dd>
        </div>
      </dl>

      <div className="space-y-3 px-5 py-5">
        <BurnBar
          size="lg"
          label="Whole project"
          currency={c}
          expected={t.expected}
          expectedToDate={t.expectedToDate}
          actual={t.actual}
          committed={t.committed}
        />
        <BurnLegend />
      </div>

      {data.reasons.length > 0 && (
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {data.reasons.map((r, i) => (
            <li key={`${r.dimension}-${i}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3 text-sm">
              <Chip hue={RAG[r.status]?.hue ?? "slate"} dot className="min-w-[96px] justify-center">
                {humanize(r.dimension)}
              </Chip>
              <span className="min-w-0 flex-1 text-neutral-700">
                {r.reason}
                <span className="sr-only"> ({RAG[r.status]?.label ?? r.status})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Reconciliation by category                                         */
/* ------------------------------------------------------------------ */

function Reconciliation({ data, fmt }: { data: ProjectFinancials; fmt: (m: number | null | undefined) => string }) {
  const c = data.currency;
  const t = data.totals;
  const rows = data.categories;
  const chartData = rows.map((r) => ({
    label: r.label,
    values: { expected: r.expected, actual: r.actual, committed: r.committed },
  }));

  const usedCell = (bp: number | null) => {
    const p = bpPct(bp);
    if (p == null) return <span className="text-neutral-400">—</span>;
    return <span className={cx("font-semibold", p > 100 ? "text-error-700" : p > 85 ? "text-sun-700" : "text-neutral-900")}>{p}%</span>;
  };

  return (
    <section aria-labelledby="fin-recon" className="space-y-4">
      <SectionHeading
        title={<span id="fin-recon">Expected against actual, by category</span>}
        hint="Labour is logged hours at the rate card. Everything else is what Finance has paid on the project's vouchers, less advance refunds."
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <caption className="sr-only">Expected expense against actual, by category</caption>
            <thead>
              <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <th scope="col" className="px-5 py-3">Category</th>
                <th scope="col" className="px-3 py-3 text-right">Expected</th>
                <th scope="col" className="px-3 py-3 text-right">Planned to date</th>
                <th scope="col" className="px-3 py-3 text-right">Actual</th>
                <th scope="col" className="px-3 py-3 text-right">Committed</th>
                <th scope="col" className="px-3 py-3 text-right">Remaining</th>
                <th scope="col" className="px-3 py-3 text-right">Used</th>
                <th scope="col" className="w-[200px] px-5 py-3">Burn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r: FinanceCategoryRow) => (
                <tr key={r.key} className="align-middle">
                  <th scope="row" className="px-5 py-3 text-left font-semibold text-neutral-900">
                    <span className="flex items-center gap-2">
                      <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[r.key === "labour" ? "blue" : hueFor(r.key)].dot)} aria-hidden />
                      {r.label}
                    </span>
                    {r.key === "labour" && (
                      <span className="mt-0.5 block pl-[18px] text-[11px] font-normal text-neutral-500">
                        At payroll: {r.payroll == null ? "not costed" : money(r.payroll, c)}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums text-neutral-700">{fmt(r.expected)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-neutral-500">
                    {fmt(r.expectedToDate)}
                    {bpPct(r.toDateBp) != null && <span className="block text-[11px]">{bpPct(r.toDateBp)}% spent of it</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-900">{fmt(r.actual)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-neutral-700">{fmt(r.committed)}</td>
                  <td className={cx("px-3 py-3 text-right tabular-nums", r.remaining < 0 ? "font-semibold text-error-700" : "text-neutral-700")}>
                    {fmt(r.remaining)}
                    {r.remaining < 0 && <span className="block text-[11px]">over</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{usedCell(r.usedBp)}</td>
                  <td className="px-5 py-3">
                    <BurnBar label={r.label} currency={c} expected={r.expected} expectedToDate={r.expectedToDate} actual={r.actual} committed={r.committed} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-200 bg-neutral-50/70 font-bold text-neutral-900">
                <th scope="row" className="px-5 py-3 text-left">Total</th>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(t.expected)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(t.expectedToDate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(t.actual)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmt(t.committed)}</td>
                <td className={cx("px-3 py-3 text-right tabular-nums", t.remaining < 0 && "text-error-700")}>{fmt(t.remaining)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{usedCell(t.usedBp)}</td>
                <td className="px-5 py-3">
                  <BurnBar label="Total" currency={c} expected={t.expected} expectedToDate={t.expectedToDate} actual={t.actual} committed={t.committed} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t border-neutral-100 px-5 py-3">
          <BurnLegend />
        </div>
      </Card>

      <Panel title="Expected, actual and committed" subtitle="Per category" icon={Layers} hue="blue">
        <GroupedColumns
          data={chartData}
          series={[
            { key: "expected", label: "Expected", hue: "slate", dashed: true },
            { key: "actual", label: "Actual", hue: "blue" },
            { key: "committed", label: "Committed", hue: "sky" },
          ]}
          format={(v) => compactMoney(v, c)}
          caption="Expected, actual and committed spend per category"
        />
      </Panel>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Month by month                                                     */
/* ------------------------------------------------------------------ */

function Trend({ data }: { data: ProjectFinancials }) {
  const c = data.currency;
  const months = data.months;
  if (months.length === 0) return null;
  const labels = months.map((m) => monthLabel(m.month));
  const now = months.findIndex((m) => m.month === thisMonth());

  return (
    <section aria-label="Month by month" className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Panel
        className="xl:col-span-3"
        title="Cumulative expected against actual"
        subtitle="Labour at the rate card plus everything else the books show"
        icon={TrendingUp}
        hue="grape"
      >
        <MultiLine
          labels={labels}
          series={[
            { key: "expected", label: "Expected", hue: "slate", dashed: true, values: months.map((m) => m.cumulativeExpected) },
            { key: "actual", label: "Actual", hue: "blue", area: true, values: months.map((m) => m.cumulativeActual) },
          ]}
          format={(v) => compactMoney(v, c)}
          caption="Cumulative expected expense against cumulative actual, by month"
          marker={now >= 0 ? { index: now, label: "This month" } : undefined}
        />
      </Panel>
      <Panel className="xl:col-span-2" title="Spend per month" subtitle="Labour and everything else" icon={Coins} hue="sun">
        <StackedColumns
          data={months.map((m) => ({
            label: monthLabel(m.month),
            values: { labour: m.labour, other: m.actual - m.labour },
          }))}
          series={[
            { key: "labour", label: "Labour", hue: "blue" },
            { key: "other", label: "Other spend", hue: "coral" },
          ]}
          format={(v) => compactMoney(v, c)}
          caption="Actual spend per month, labour and other"
        />
      </Panel>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Labour                                                             */
/* ------------------------------------------------------------------ */

function Labour({ data }: { data: ProjectFinancials }) {
  const c = data.currency;
  const l = data.labour;
  const topCost = Math.max(1, ...l.members.map((m) => m.rateCard ?? 0));
  const topTitle = Math.max(1, ...l.jobTitles.map((j) => j.cost ?? 0));
  const coverage = l.estimateCoverage == null ? null : Math.round(l.estimateCoverage * 100);

  const columns: Column<FinanceMemberRow>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (m) => m.name,
      render: (m) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", HUE[hueFor(m.name)].soft)}>
            {initialsOf(m.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{m.name}</span>
            <span className="block truncate text-[11px] text-neutral-500">
              {m.role}
              {m.jobTitle ? ` · ${m.jobTitle}` : ""}
            </span>
          </span>
        </span>
      ),
    },
    { key: "hours", header: "Hours", align: "right", sortable: true, value: (m) => m.hours, render: (m) => hours(m.hours) },
    { key: "billable", header: "Billable", align: "right", hideOnMobile: true, value: (m) => m.billableHours, render: (m) => hours(m.billableHours) },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sortable: true,
      value: (m) => m.rate ?? -1,
      render: (m) =>
        m.rate == null ? (
          <Chip hue="sun">No rate</Chip>
        ) : (
          <span>
            <span className="block tabular-nums text-neutral-900">{rate(m.rate, m.rateCurrency)}</span>
            <span className="block text-[11px] text-neutral-500">{sayJobTitle(m.rateSource)}</span>
          </span>
        ),
    },
    {
      key: "rateCard",
      header: "At rate card",
      align: "right",
      sortable: true,
      value: (m) => m.rateCard ?? 0,
      render: (m) => <span className="font-semibold text-neutral-900">{m.rateCard == null ? "—" : money(m.rateCard, c)}</span>,
    },
    {
      key: "payroll",
      header: "At payroll",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      value: (m) => m.payroll ?? 0,
      render: (m) =>
        m.payroll == null ? (
          <span className="text-neutral-400">—</span>
        ) : (
          <span>
            <span className="block tabular-nums">{money(m.payroll, c)}</span>
            {m.payrollHours != null && <span className="block text-[11px] text-neutral-500">{hours(m.payrollHours)}</span>}
          </span>
        ),
    },
    {
      key: "share",
      header: "Share of labour",
      hideOnMobile: true,
      tableOnly: true,
      className: "min-w-[140px]",
      render: (m) => <HBar value={m.rateCard ?? 0} of={topCost} hue={hueFor(m.name)} />,
    },
  ];

  const sprintRows = l.sprints.filter((s) => s.hours > 0 || (s.cost ?? 0) > 0);

  return (
    <section aria-labelledby="fin-labour" className="space-y-4">
      <SectionHeading
        title={<span id="fin-labour">Labour</span>}
        hint="Sprint hours priced at each member's rate card when they were logged. Payroll cost, where Finance has it, is the same hours at what people are paid — shown beside, never added."
      />

      {l.unratedHours > 0 && (
        <Notice tone="warn">
          {hours(l.unratedHours)} were logged before a rate was set and cost nothing here, so labour is short by whatever they were worth. Set the rates and reprice them on the Cost tab.
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <MiniStat label="Hours logged" value={hours(l.hours)} hint={`${hours(l.billableHours)} billable`} />
        <MiniStat label="Billable hours" value={hours(l.billableHours)} />
        <MiniStat label="Unrated hours" value={hours(l.unratedHours)} hue={l.unratedHours > 0 ? "sun" : undefined} />
        <MiniStat label="At rate card" value={l.rateCard == null ? "—" : moneyRounded(l.rateCard, c)} hue="blue" />
        <MiniStat
          label="At payroll"
          value={l.payroll == null ? "—" : moneyRounded(l.payroll, c)}
          hint={l.payrollProvisional ? `${moneyRounded(l.payrollProvisional, c)} provisional` : l.payroll == null ? "Not costed by Finance" : undefined}
        />
        <MiniStat label="To complete" value={l.toComplete == null ? "—" : moneyRounded(l.toComplete, c)} hint={`${hours(l.toCompleteHours)} estimated`} />
        <MiniStat
          label="Estimate coverage"
          value={coverage == null ? "—" : `${coverage}%`}
          hint="Of remaining work"
          hue={coverage != null && coverage < 50 ? "sun" : undefined}
        />
      </div>

      <Panel title="Members" subtitle="Hours, rate and cost per person" icon={Users} hue="sky" bodyClassName="p-5 pt-4">
        <DataView
          rows={l.members}
          columns={columns}
          rowKey={(m) => m.userId}
          storageKey="project-finance-members"
          views={["table", "list"]}
          searchPlaceholder="Search members"
          caption="Members' hours and labour cost"
          empty={<Empty icon={Users} title="Nobody on the project yet" hint="Add people on the Team tab; their logged hours are priced here." />}
          onDownload={(rows) =>
            downloadCsv(csvName("project-labour", data.currency), [
              ["Name", "Role", "Job title", "Hours", "Billable hours", "Rate", "Rate currency", "Rate source", "At rate card", "At payroll", "Payroll hours", "Currency"],
              ...rows.map((m) => [
                m.name,
                m.role,
                m.jobTitle,
                m.hours,
                m.billableHours,
                csvAmount(m.rate),
                m.rateCurrency,
                m.rateSource,
                csvAmount(m.rateCard),
                csvAmount(m.payroll),
                m.payrollHours,
                c,
              ]),
            ])
          }
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Cost per sprint" subtitle="Rate-card labour" icon={Clock} hue="grape">
          {sprintRows.length === 0 ? (
            <Empty icon={Clock} title="No hours logged in a sprint yet" hint="Time logged against sprint work is priced here as it comes in." />
          ) : (
            <>
              <StackedColumns
                data={sprintRows.map((s) => ({ label: s.name, values: { cost: s.cost ?? 0 } }))}
                series={[{ key: "cost", label: "Labour cost", hue: "grape" }]}
                format={(v) => compactMoney(v, c)}
                caption="Labour cost per sprint"
                showTotals={sprintRows.length <= 8}
              />
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <caption className="sr-only">Sprint hours and cost</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="py-2 pr-3">Sprint</th>
                      <th scope="col" className="px-3 py-2">Dates</th>
                      <th scope="col" className="px-3 py-2 text-right">Hours</th>
                      <th scope="col" className="px-3 py-2 text-right">People</th>
                      <th scope="col" className="py-2 pl-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {l.sprints.map((s, i) => (
                      <tr key={`${s.name}-${i}`}>
                        <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-neutral-900">
                          {s.name}
                          <span className="ml-2 text-[11px] font-normal text-neutral-500">{s.status}</span>
                        </th>
                        <td className="px-3 py-2.5 text-neutral-600">{s.startsOn || s.endsOn ? `${fmtDate(s.startsOn, false)} – ${fmtDate(s.endsOn)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {hours(s.hours)}
                          {s.unratedHours > 0 && <span className="block text-[11px] text-sun-700">{hours(s.unratedHours)} unrated</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.people}</td>
                        <td className="py-2.5 pl-3 text-right font-semibold tabular-nums text-neutral-900">{s.cost == null ? "—" : money(s.cost, c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel className="xl:col-span-2" title="By job title" subtitle="Rate-card labour" icon={Layers} hue="mint">
          {l.jobTitles.length === 0 ? (
            <Empty icon={Layers} title="No hours logged yet" />
          ) : (
            <ul className="space-y-3.5">
              {l.jobTitles.map((j) => (
                <li key={j.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold text-neutral-900">{j.label}</span>
                    <span className="shrink-0 tabular-nums text-neutral-700">
                      {j.cost == null ? "—" : money(j.cost, c)}
                      <span className="ml-1.5 text-[11px] text-neutral-500">{hours(j.hours)}</span>
                    </span>
                  </div>
                  <HBar value={j.cost ?? 0} of={topTitle} hue={hueFor(j.label)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

/** A plain horizontal bar with a hatched remainder. Decorative: the figure is beside it. */
function HBar({ value, of, hue }: { value: number; of: number; hue: Hue }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, of)) * 100));
  return (
    <div className="ws-hatch h-2 w-full overflow-hidden rounded-full" aria-hidden>
      <div className={cx("h-full rounded-full", HUE[hue].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spend requests                                                     */
/* ------------------------------------------------------------------ */

function SpendRequests({ data }: { data: ProjectFinancials }) {
  const c = data.currency;
  const [register, setRegister] = useState("");
  const registers = Object.entries(data.registers);
  const rows = useMemo(() => (register === "" ? data.requests : data.requests.filter((r) => r.register === register)), [data.requests, register]);
  const topRequester = Math.max(1, ...data.requesters.map((r) => r.estimated));
  const amt = (r: SpendRequestRow, v: number | null) => (v == null ? "—" : money(v, r.currency ?? c));

  const columns: Column<SpendRequestRow>[] = [
    {
      key: "request",
      header: "Request",
      primary: true,
      sortable: true,
      value: (r) => `${r.reference ?? ""} ${r.title ?? ""}`.trim(),
      render: (r) => (
        <span className={cx("block min-w-0", !r.inTotals && "opacity-75")}>
          <span className="block truncate font-semibold text-neutral-900">{r.title ?? "Untitled request"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
            {r.reference && <span className="font-mono">{r.reference}</span>}
            {r.partOf && <span>part of {r.partOf}</span>}
            {!r.inTotals && <Chip hue="slate">Not counted</Chip>}
          </span>
          {r.note && <span className="mt-0.5 block text-[11px] text-neutral-500">{r.note}</span>}
        </span>
      ),
    },
    {
      key: "register",
      header: "Type",
      sortable: true,
      value: (r) => r.registerLabel,
      render: (r) => <Chip hue={hueFor(r.registerLabel)}>{r.registerLabel}</Chip>,
    },
    {
      key: "requester",
      header: "Raised by",
      sortable: true,
      value: (r) => `${r.requester ?? ""} ${r.department ?? ""}`,
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate text-neutral-900">{r.requester ?? "Unknown"}</span>
          {r.department && <span className="block truncate text-[11px] text-neutral-500">{r.department}</span>}
        </span>
      ),
    },
    { key: "raisedOn", header: "Raised", sortable: true, hideOnMobile: true, value: (r) => r.raisedOn ?? "", render: (r) => fmtDate(r.raisedOn) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.statusLabel,
      render: (r) => <Chip hue={requestHue(r)} dot>{r.statusLabel}</Chip>,
    },
    { key: "estimated", header: "Estimated", align: "right", sortable: true, value: (r) => r.estimated ?? 0, render: (r) => <span className="tabular-nums">{amt(r, r.estimated)}</span> },
    { key: "approved", header: "Approved", align: "right", sortable: true, hideOnMobile: true, value: (r) => r.approved ?? 0, render: (r) => <span className="tabular-nums">{amt(r, r.approved)}</span> },
    {
      key: "actual",
      header: "Actual",
      align: "right",
      sortable: true,
      value: (r) => r.actual ?? 0,
      render: (r) => <span className="font-semibold tabular-nums text-neutral-900">{amt(r, r.actual)}</span>,
    },
  ];

  return (
    <section aria-labelledby="fin-requests" className="space-y-4">
      <SectionHeading
        title={<span id="fin-requests">Spend requests</span>}
        hint="Every travel request, event, purchase and memo charged to this project, with who raised it. Items that are part of a larger request are listed but counted once, on the parent."
      />

      {registers.length === 0 ? (
        <Card>
          <Empty icon={Receipt} title="No spend registers to show" hint="Requests appear here once a module that raises them — travel, events, purchasing, memos — is switched on." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {registers.map(([key, r]) => {
            const hue = hueFor(r.label);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={register === key}
                onClick={() => setRegister(register === key ? "" : key)}
                className={cx(
                  "ws-card cursor-pointer p-4 text-left outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
                  register === key && "ring-2 ring-primary-400",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Chip hue={hue}>{r.label}</Chip>
                  <span className="text-xs font-semibold tabular-nums text-neutral-600">{plural(r.count, "request")}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  {(
                    [
                      ["Estimated", r.estimated],
                      ["Approved", r.approved],
                      ["Actual", r.actual],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-neutral-500">{label}</dt>
                      <dd className="truncate text-[13px] font-bold tabular-nums text-neutral-900" title={money(v, c)}>
                        {compactMoney(v, c)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3">
                  <HBar value={r.actual} of={Math.max(r.approved, r.estimated, r.actual, 1)} hue={hue} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {data.requesters.length > 0 && (
        <Panel title="Who raised them" subtitle="Live requests, counted once" icon={Users} hue="coral">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Spend requests by the person who raised them</caption>
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-2 pr-3">Person</th>
                  <th scope="col" className="px-3 py-2">Requests</th>
                  <th scope="col" className="px-3 py-2 text-right">Estimated</th>
                  <th scope="col" className="px-3 py-2 text-right">Approved</th>
                  <th scope="col" className="px-3 py-2 text-right">Actual</th>
                  <th scope="col" className="w-[140px] py-2 pl-3"><span className="sr-only">Share</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.requesters.map((p: SpendRequester, i) => (
                  <tr key={`${p.name}-${i}`}>
                    <th scope="row" className="py-2.5 pr-3 text-left">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", HUE[hueFor(p.name)].soft)}>
                          {initialsOf(p.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-neutral-900">{p.name}</span>
                          <span className="block truncate text-[11px] font-normal text-neutral-500">{p.department ?? "No department"}</span>
                        </span>
                      </span>
                    </th>
                    <td className="px-3 py-2.5">
                      <span className="block text-neutral-900 tabular-nums">
                        {p.requests} <span className="text-[11px] text-neutral-500">({p.live} live)</span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(p.byRegister).map(([label, n]) => (
                          <Chip key={label} hue={hueFor(label)} className="!px-2 !py-0.5 !text-[11px]">
                            {label} {n}
                          </Chip>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(p.estimated, c)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(p.approved, c)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{money(p.actual, c)}</td>
                    <td className="py-2.5 pl-3">
                      <HBar value={p.estimated} of={topRequester} hue={hueFor(p.name)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Every request" subtitle={`${plural(data.requests.length, "request")} on this project`} icon={Receipt} hue="sky" bodyClassName="p-5 pt-4">
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.register}:${r.id}`}
          storageKey="project-finance-requests"
          views={["table", "list"]}
          searchPlaceholder="Search requests, people, references"
          caption="Spend requests charged to the project"
          toolbar={
            registers.length > 1 ? (
              <SearchableSelect
                aria-label="Filter by type"
                value={register}
                onChange={setRegister}
                size="sm"
                className="w-48"
                searchPlaceholder="Search types"
                options={[{ value: "", label: "All types" }, ...registers.map(([key, r]) => ({ value: key, label: r.label }))]}
              />
            ) : undefined
          }
          empty={<Empty icon={Receipt} title={register ? "No requests of this type" : "No requests charged to this project"} hint="Requests raised against the project in travel, events, purchasing or memos are listed here." />}
          onDownload={(list) =>
            downloadCsv(csvName("project-spend-requests", register || null), [
              ["Type", "Reference", "Title", "Raised on", "Status", "Raised by", "Department", "Cost centre", "Category", "Currency", "Estimated", "Approved", "Actual", "Live", "Part of", "Counted in totals", "Note"],
              ...list.map((r) => [
                r.registerLabel,
                r.reference,
                r.title,
                csvDate(r.raisedOn),
                r.statusLabel,
                r.requester,
                r.department,
                r.costCentre,
                r.category,
                r.currency ?? c,
                csvAmount(r.estimated),
                csvAmount(r.approved),
                csvAmount(r.actual),
                r.live ? "yes" : "no",
                r.partOf,
                r.inTotals ? "yes" : "no",
                r.note,
              ]),
            ])
          }
        />
      </Panel>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue and earned value                                           */
/* ------------------------------------------------------------------ */

function Revenue({ data }: { data: ProjectFinancials }) {
  const c = data.currency;
  const r = data.revenue;
  if (!r) return null;
  const k = data.kpis ?? {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const m = (v: unknown) => (num(v) == null ? "—" : moneyRounded(num(v) as number, c));
  const idx = (v: unknown) => {
    const n = num(v);
    if (n == null) return { text: "—", hue: undefined as Hue | undefined, hint: "Not enough data" };
    return { text: n.toFixed(2), hue: (n >= 1 ? "mint" : n >= 0.9 ? "sun" : "rose") as Hue, hint: n >= 1 ? "At or better than plan" : "Behind plan" };
  };
  const cpi = idx(k.cpi);
  const spi = idx(k.spi);
  const pct = bpPct(num(k.pctBp));

  return (
    <section aria-labelledby="fin-revenue" className="space-y-4">
      <SectionHeading title={<span id="fin-revenue">Revenue and value</span>} hint="What the client pays against what the work costs, and earned value from reported progress." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Revenue" icon={Banknote} hue="mint">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="Contract value" value={moneyRounded(r.contractValue, c)} hue="mint" />
            <MiniStat label="Invoiced" value={moneyRounded(r.invoiced, c)} />
            <MiniStat label="Collected" value={moneyRounded(r.collected, c)} />
            <MiniStat label="Receivable" value={moneyRounded(r.receivable, c)} />
            <MiniStat label="Overdue" value={moneyRounded(r.overdue, c)} hue={r.overdue > 0 ? "rose" : undefined} hint={r.overdue > 0 ? "Past its due date" : undefined} />
            <MiniStat
              label="Margin to date"
              value={r.marginToDate == null ? "—" : moneyRounded(r.marginToDate, c)}
              hue={r.marginToDate != null && r.marginToDate < 0 ? "rose" : undefined}
              hint="Contract less actual"
            />
            <MiniStat
              label="Margin at completion"
              value={r.marginAtCompletion == null ? "—" : moneyRounded(r.marginAtCompletion, c)}
              hue={r.marginAtCompletion != null && r.marginAtCompletion < 0 ? "rose" : undefined}
              hint="Contract less forecast"
              className="col-span-2 sm:col-span-2"
            />
          </div>
        </Panel>
        <Panel title="Earned value" subtitle={pct == null ? "No progress reported yet" : `${pct}% complete, as reported`} icon={TrendingUp} hue="grape">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Planned value" value={m(k.pv)} />
            <MiniStat label="Earned value" value={m(k.ev)} />
            <MiniStat label="Actual cost" value={m(k.ac)} />
            <MiniStat label="Budget (BAC)" value={m(k.bac)} />
            <MiniStat label="Cost index (CPI)" value={cpi.text} hue={cpi.hue} hint={cpi.hint} />
            <MiniStat label="Schedule index (SPI)" value={spi.text} hue={spi.hue} hint={spi.hint} />
            <MiniStat label="Estimate at completion" value={m(k.eac)} className="col-span-2" />
          </div>
          {pct != null && (
            <div className="mt-4">
              <div role="progressbar" aria-label="Work complete" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} className="ws-hatch h-2.5 overflow-hidden rounded-full">
                <div className="h-full rounded-full bg-grape-500" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          )}
        </Panel>
      </div>

      {r.invoices.length > 0 && (
        <Panel title="Invoices" subtitle="Latest 20, drafts left out" icon={Receipt} hue="sky">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Invoices raised on the project</caption>
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-2 pr-3">Invoice</th>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Due</th>
                  <th scope="col" className="px-3 py-2 text-right">Total</th>
                  <th scope="col" className="px-3 py-2 text-right">Settled</th>
                  <th scope="col" className="px-3 py-2 text-right">Outstanding</th>
                  <th scope="col" className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {r.invoices.map((inv, i) => {
                  const cur = inv.currency ?? c;
                  return (
                    <tr key={inv.id ?? `${inv.invoiceNo}-${i}`}>
                      <th scope="row" className="py-2.5 pr-3 text-left font-mono text-[13px] font-semibold text-neutral-900">{inv.invoiceNo ?? "—"}</th>
                      <td className="px-3 py-2.5 text-neutral-600">{fmtDate(inv.date)}</td>
                      <td className="px-3 py-2.5 text-neutral-600">{fmtDate(inv.dueOn)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(inv.total, cur)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(inv.settled, cur)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{money(inv.outstanding, cur)}</td>
                      <td className="py-2.5 pl-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Chip hue={inv.outstanding === 0 ? "mint" : inv.daysLate > 0 ? "rose" : "sky"}>{humanize(inv.status)}</Chip>
                          {inv.daysLate > 0 && <span className="text-[11px] font-semibold text-error-700">{plural(inv.daysLate, "day")} late</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Check against the books                                            */
/* ------------------------------------------------------------------ */

function BooksCheck({
  data,
  fmt,
  fmtR,
}: {
  data: ProjectFinancials;
  fmt: (m: number | null | undefined) => string;
  fmtR: (m: number | null | undefined) => string;
}) {
  const r = data.reconciliation;
  const diff = r.difference;
  const tied = diff === 0;

  return (
    <Panel
      title="Check against the books"
      subtitle="Non-labour spend in the ledger against what the vouchers above add up to"
      icon={Scale}
      hue={diff == null ? "slate" : tied ? "mint" : "sun"}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Books, non-labour" value={fmtR(r.booksNonLabour)} />
        <MiniStat label="Vouchers, non-labour" value={fmtR(r.vouchersNonLabour)} />
        <MiniStat
          label="Difference"
          value={fmt(diff)}
          hue={diff == null ? undefined : tied ? "mint" : "sun"}
          hint={diff == null ? "No books to compare" : tied ? "Ties to the ledger" : "Journals, depreciation or other postings outside a voucher"}
        />
        <MiniStat label="Books, labour (payroll)" value={fmtR(r.booksLabour)} hint="For reference: labour above is at the rate card" />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Funds, commitments, alerts and the ledger                          */
/* ------------------------------------------------------------------ */

function FundsAndLedger({ data, meta }: { data: ProjectFinancials; meta: Meta }) {
  const c = data.currency;
  const catLabel = (k: string | null) => (k ? meta.categories[k] ?? humanize(k) : "—");

  return (
    <section aria-label="Funds and ledger" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Fund releases" subtitle={plural(data.releases.length, "tranche")} icon={Landmark} hue="blue">
          {data.releases.length === 0 ? (
            <p className="text-sm text-neutral-500">No funds released yet. Finance releases the budget in tranches once it is approved.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.releases.map((r, i) => (
                <li key={r.id ?? i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-neutral-900">Tranche {r.tranche}</span>
                    <span className="text-sm font-bold tabular-nums text-neutral-900">{money(r.amount, c)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                    <Chip hue={/approved|released/.test(r.status) ? "mint" : /reject|revok/.test(r.status) ? "rose" : "sun"}>{humanize(r.status)}</Chip>
                    {r.scope && <span>{humanize(r.scope)}</span>}
                    {r.requestedBy && <span>· asked by {r.requestedBy}</span>}
                    {r.revoked ? <span className="font-semibold text-error-700">· {money(r.revoked, c)} revoked</span> : null}
                  </div>
                  {r.conditions && <p className="mt-1 text-xs text-neutral-600">{r.conditions}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Commitments" subtitle="Approved requests still holding money" icon={HandCoins} hue="sky">
          {data.commitments.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing is committed: no approved request is waiting to be paid.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.commitments.map((cm, i) => (
                <li key={cm.id ?? i} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{cm.title ?? "Request"}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {cm.reference && <span className="font-mono">{cm.reference} · </span>}
                        {catLabel(cm.category)}
                        {cm.expiresAt && ` · expires ${fmtDate(cm.expiresAt)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums text-neutral-900">{money(cm.outstanding, c)}</span>
                      <span className="block text-[11px] text-neutral-500">of {money(cm.amount, c)}</span>
                    </span>
                  </div>
                  {cm.ageing && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sun-700">
                      <AlertTriangle size={12} aria-hidden /> Ageing: nothing paid against it yet
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Alerts" subtitle="Open, newest first" icon={BellRing} hue={data.alerts.length > 0 ? "rose" : "slate"}>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-neutral-500">No open alerts on this project.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.alerts.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip hue={a.severity === "red" || a.severity === "critical" ? "rose" : a.severity === "amber" || a.severity === "warning" ? "sun" : "sky"} dot>
                      {humanize(a.severity)}
                    </Chip>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{humanize(a.dimension)}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-800">{a.message}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {a.raisedAt ? `Raised ${fmtDate(a.raisedAt)}` : ""}
                    {a.acknowledgedBy ? ` · acknowledged by ${a.acknowledgedBy}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Latest ledger lines"
        subtitle={
          data.ledgerCount > data.ledger.length
            ? `The ${data.ledger.length} newest of ${data.ledgerCount}; the performance sheet has them all`
            : plural(data.ledgerCount, "line")
        }
        icon={BookOpenCheck}
        hue="slate"
      >
        {data.ledger.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing has been posted to this project in the books yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Ledger lines posted to the project</caption>
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-2 pr-3">Journal</th>
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Account</th>
                  <th scope="col" className="px-3 py-2">Narration</th>
                  <th scope="col" className="px-3 py-2 text-right">Debit</th>
                  <th scope="col" className="py-2 pl-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.ledger.map((l, i) => (
                  <tr key={`${l.journalNo}-${i}`}>
                    <th scope="row" className="py-2 pr-3 text-left font-mono text-[12px] font-semibold text-neutral-900">{l.journalNo}</th>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{fmtDate(l.date)}</td>
                    <td className="px-3 py-2 text-neutral-700">{l.account}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {l.narration ?? "—"}
                      {l.person && <span className="block text-[11px] text-neutral-500">{l.person}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.debit ? money(l.debit, c) : ""}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{l.credit ? money(l.credit, c) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Budget editor                                                      */
/* ------------------------------------------------------------------ */

function BudgetEditor({
  project,
  data,
  categories,
  onClose,
  onSaved,
}: {
  project: Project;
  data: ProjectFinancials;
  categories: Record<string, string>;
  onClose: () => void;
  onSaved: (result: { message: string; notice: string | null }) => void;
}) {
  const c = data.currency;
  const cats = Object.entries(categories);
  const rebaseline = data.budget !== null;

  // A rebaseline starts from the approved figures, over their months.
  const approvedLines = data.budget?.lines ?? [];
  const approvedMonths = approvedLines.map((l) => l.month).sort();
  const initialFrom = approvedMonths[0] ?? (project.startsOn ? project.startsOn.slice(0, 7) : thisMonth());
  const plannedTo = project.targetEndsOn && project.targetEndsOn.slice(0, 7) >= initialFrom ? project.targetEndsOn.slice(0, 7) : addMonths(initialFrom, 5);
  const lastApproved = approvedMonths[approvedMonths.length - 1];
  const initialTo = lastApproved && lastApproved > plannedTo ? lastApproved : plannedTo;

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [contract, setContract] = useState(() => {
    const v = data.budget?.contractValue ?? data.revenue?.contractValue ?? 0;
    return v > 0 ? toMajor(v) : "";
  });
  const [margin, setMargin] = useState(() =>
    data.budget?.targetMarginBp != null ? String(data.budget.targetMarginBp / 100) : "",
  );
  const [reason, setReason] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(approvedLines.filter((l) => l.amount > 0).map((l) => [`${l.category}|${l.month}`, toMajor(l.amount)])),
  );
  const [saving, setSaving] = useState<null | "draft" | "submit">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const months = useMemo(() => (from && to && from <= to ? monthsBetween(from, to) : []), [from, to]);
  const keyOf = (cat: string, month: string) => `${cat}|${month}`;
  const minorOf = (cat: string, month: string) => {
    const raw = amounts[keyOf(cat, month)];
    return raw ? toMinor(raw) : 0;
  };
  const rowTotal = (cat: string) => months.reduce((s, m) => s + minorOf(cat, m), 0);
  const colTotal = (m: string) => cats.reduce((s, [cat]) => s + minorOf(cat, m), 0);
  const grand = cats.reduce((s, [cat]) => s + rowTotal(cat), 0);

  const setAmount = (cat: string, month: string, v: string) => setAmounts((a) => ({ ...a, [keyOf(cat, month)]: v }));

  /** Spread a row's typed total evenly across the months, the remainder on the last. */
  const spread = (cat: string) => {
    const total = rowTotal(cat);
    if (total <= 0 || months.length === 0) return;
    const each = Math.floor(total / months.length);
    const rest = total - each * months.length;
    setAmounts((a) => {
      const next = { ...a };
      months.forEach((m, i) => {
        next[keyOf(cat, m)] = toMajor(each + (i === months.length - 1 ? rest : 0));
      });
      return next;
    });
  };

  const save = async (submit: boolean) => {
    const local: Record<string, string> = {};
    const contractNum = Number.parseFloat(contract);
    if (contract.trim() === "" || !Number.isFinite(contractNum) || contractNum < 0) local.contractValue = "Enter the contract value — 0 for internal work.";
    let marginBp: number | null = null;
    if (margin.trim() !== "") {
      const m = Number.parseFloat(margin);
      if (!Number.isFinite(m) || m < -100 || m > 100) local.targetMarginBp = "A margin between −100% and 100%.";
      else marginBp = Math.round(m * 100);
    }
    if (rebaseline && isRichBlank(reason)) local.reason = "Say why the approved budget is changing.";
    const bad = Object.entries(amounts).some(([k, v]) => {
      const month = k.split("|")[1];
      if (!months.includes(month) || v.trim() === "") return false;
      const n = Number.parseFloat(v);
      return !Number.isFinite(n) || n < 0;
    });
    if (bad) local.lines = "Amounts must be numbers of 0 or more.";

    const lines = cats.flatMap(([cat]) =>
      months.map((m) => ({ category: cat, month: m, amount: minorOf(cat, m) })).filter((l) => l.amount > 0),
    );
    if (!local.lines && lines.length === 0) local.lines = "Enter at least one amount.";
    if (lines.length > 600) local.lines = "That is more than 600 lines. Shorten the period or combine categories.";

    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;

    setSaving(submit ? "submit" : "draft");
    try {
      const res = await financialsApi.draftBudget(project.slug, {
        contractValue: toMinor(contract),
        targetMarginBp: marginBp,
        reason: reason.trim() === "" ? null : reason.trim(),
        submit,
        lines,
      });
      const sent = submit && res.notice == null;
      onSaved({
        message: `Budget version ${res.version} (${moneyRounded(res.bac, c)}) ${sent ? "sent for approval" : "saved as a draft"}.`,
        notice: res.notice,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        const fieldErrors: Record<string, string> = {};
        const other: string[] = [];
        for (const [k, msgs] of Object.entries(e.errors ?? {})) {
          const msg = msgs[0];
          if (k === "contractValue" || k === "targetMarginBp" || k === "reason") fieldErrors[k] = msg;
          else if (k.startsWith("lines")) fieldErrors.lines = fieldErrors.lines ?? msg;
          else other.push(msg);
        }
        setErrors(fieldErrors);
        setFormError(other.length > 0 ? other.join(" ") : Object.keys(fieldErrors).length > 0 ? null : e.message);
      } else {
        setFormError("The budget could not be saved. Try again.");
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      title={rebaseline ? "Draft a new budget" : "Draft budget"}
      subtitle={`${project.name} · amounts in ${c}`}
      icon={Wallet}
      hue="blue"
      width="xl"
      onClose={onClose}
      closeOnEscape={saving === null}
      footer={
        <>
          <span className="mr-auto text-sm text-neutral-600">
            Expected expense <span className="font-bold tabular-nums text-neutral-900">{money(grand, c)}</span>
          </span>
          <Button variant="ghost" onClick={onClose} disabled={saving !== null}>
            Cancel
          </Button>
          <Button icon={Save} onClick={() => void save(false)} disabled={saving !== null}>
            {saving === "draft" ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="primary" icon={Send} onClick={() => void save(true)} disabled={saving !== null}>
            {saving === "submit" ? "Sending…" : "Send for approval"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError && <Notice tone="error">{formError}</Notice>}
        {rebaseline && data.budget && (
          <Notice tone="info">
            Version {data.budget.version} ({moneyRounded(data.budget.bac, c)}) is approved. This drafts version {data.budget.version + 1}; the approved one stays in force until Finance approves the new one.
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fin-contract" className={labelCls}>
              Contract value <span className="text-error-600">*</span>
            </label>
            <input
              id="fin-contract"
              inputMode="decimal"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              className={cx(inputCls, errors.contractValue && invalidCls)}
              aria-invalid={Boolean(errors.contractValue)}
              aria-describedby="fin-contract-hint fin-contract-err"
              placeholder="0.00"
            />
            <span id="fin-contract-hint" className={hintCls}>What the client pays, in {c}. 0 for internal work.</span>
            <FieldError id="fin-contract-err" message={errors.contractValue} />
          </div>
          <div>
            <label htmlFor="fin-margin" className={labelCls}>
              Target margin (%)
            </label>
            <input
              id="fin-margin"
              inputMode="decimal"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className={cx(inputCls, errors.targetMarginBp && invalidCls)}
              aria-invalid={Boolean(errors.targetMarginBp)}
              aria-describedby="fin-margin-hint fin-margin-err"
              placeholder="Optional"
            />
            <span id="fin-margin-hint" className={hintCls}>Left blank, Finance works it out from contract value and budget.</span>
            <FieldError id="fin-margin-err" message={errors.targetMarginBp} />
          </div>
        </div>

        {rebaseline && (
          <div>
            <label htmlFor="fin-reason" className={labelCls}>
              Why the budget is changing <span className="text-error-600">*</span>
            </label>
            <RichTextEditor
              id="fin-reason"
              value={reason}
              onChange={setReason}
              invalid={Boolean(errors.reason)}
              describedBy="fin-reason-err"
              placeholder="Scope added in the change request of 3 Oct, for example"
            />
            <FieldError id="fin-reason-err" message={errors.reason} />
          </div>
        )}

        <fieldset>
          <legend className={labelCls}>Expected expense by category and month</legend>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="fin-from" className="mb-1 block text-xs font-medium text-neutral-600">From</label>
              <input id="fin-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} className={cx(inputCls, "w-44")} />
            </div>
            <div>
              <label htmlFor="fin-to" className="mb-1 block text-xs font-medium text-neutral-600">To</label>
              <input id="fin-to" type="month" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={cx(inputCls, "w-44")} />
            </div>
            <p className="pb-3 text-xs text-neutral-500">{plural(months.length, "month")}. Type a total in any month and use “Spread” to share it evenly.</p>
          </div>
          <FieldError message={errors.lines} />
          {months.length === 0 ? (
            <p className="text-sm text-neutral-500">Choose a start month on or before the end month.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="text-sm">
                <caption className="sr-only">Budget amounts by category and month, in {c}</caption>
                <thead>
                  <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="sticky left-0 z-10 min-w-[160px] bg-neutral-50 px-3 py-2">Category</th>
                    {months.map((m) => (
                      <th key={m} scope="col" className="min-w-[112px] px-2 py-2 text-right">{monthLabel(m)}</th>
                    ))}
                    <th scope="col" className="min-w-[128px] px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {cats.map(([cat, label]) => (
                    <tr key={cat}>
                      <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-semibold text-neutral-900">
                        <span className="flex items-center justify-between gap-2">
                          {label}
                          <button
                            type="button"
                            onClick={() => spread(cat)}
                            disabled={rowTotal(cat) === 0}
                            className="cursor-pointer rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent"
                            aria-label={`Spread the ${label} total evenly across the months`}
                          >
                            Spread
                          </button>
                        </span>
                      </th>
                      {months.map((m) => (
                        <td key={m} className="px-1.5 py-1.5">
                          <input
                            inputMode="decimal"
                            aria-label={`${label}, ${monthLabel(m, true)}`}
                            value={amounts[keyOf(cat, m)] ?? ""}
                            onChange={(e) => setAmount(cat, m, e.target.value)}
                            placeholder="0"
                            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2 text-right text-[13px] tabular-nums text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-neutral-900">{money(rowTotal(cat), c)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50 font-bold text-neutral-900">
                    <th scope="row" className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-left">Total</th>
                    {months.map((m) => (
                      <td key={m} className="px-2 py-2 text-right tabular-nums">{compactMoney(colTotal(m), c)}</td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">{money(grand, c)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
