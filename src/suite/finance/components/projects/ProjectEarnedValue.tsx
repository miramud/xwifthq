"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Check,
  CircleGauge,
  FileSignature,
  FileText,
  Gauge,
  HardHat,
  LineChart,
  Receipt,
  ShieldCheck,
  Target,
} from "lucide-react";
import { plainError, spend, type ProjectAlertRecord, type ProjectFundsDetail as Detail, type ProjectLabour } from "@/lib/api/finance-payments-client";
import { Button, ButtonLink, Chip, Panel, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { MultiLine, Sparkline, StackedColumns } from "@/components/workspace/charts";
import { ErrorNote, Skeleton, humanise, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError } from "@/suite/org/components/foundations/shared";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { todayIso } from "../labour/meta";
import { DIMENSION_LABEL, RAG } from "./meta";
import { IndexValue, ProgressRing } from "./EarnedValue";
import { BAND, EAC_METHOD, PROGRESS_METHOD, indexBand, indexText, marginBp, marginText, pctText, reportsProgress, sCurve, trend } from "./earned-value";

/*
  The earned-value half of a project's page (Finance PRD §16.10): the
  S-curve as the hero, the three ways of reading profit, the money in from
  the client, every status dimension with its reason, open alerts, labour,
  and percent complete with the way it was measured.
*/

const money = (v: number) => compact(v);

/* ------------------------------------------------------------------ */
/*  Alerts                                                             */
/* ------------------------------------------------------------------ */

export function AlertsStrip({ alerts, canAcknowledge, onAcknowledged }: { alerts: ProjectAlertRecord[]; canAcknowledge: boolean; onAcknowledged: (a: ProjectAlertRecord) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = alerts.filter((a) => !a.acknowledgedAt);
  if (open.length === 0) return null;

  const acknowledge = async (a: ProjectAlertRecord) => {
    setBusy(a.id);
    setError(null);
    try {
      await spend.funds.acknowledgeAlert(a.id);
      onAcknowledged(a);
    } catch (e) {
      setError(plainError(e, "The alert wasn't acknowledged."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="pf-alerts" className="mb-5 rounded-[1.125rem] border border-rose-500/20 bg-white p-4 shadow-sm sm:p-5">
      <h2 id="pf-alerts" className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
        <BellRing size={17} aria-hidden className="text-rose-600" />
        {open.length === 1 ? "1 open alert" : `${open.length} open alerts`}
      </h2>
      {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
      <ul className="mt-3 space-y-2">
        {open.map((a) => {
          const m = RAG[a.severity] ?? RAG.grey;
          const Icon = m.icon;
          return (
            <li key={a.id} className={cx("flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between", HUE[m.hue].soft)}>
              <div className="flex min-w-0 items-start gap-3">
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {DIMENSION_LABEL[a.dimension] ?? humanise(a.dimension)} · {m.label}
                  </p>
                  <p className="text-sm text-neutral-700">{a.message}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Raised {day(a.raisedAt)}</p>
                </div>
              </div>
              {canAcknowledge && (
                <Button size="sm" icon={Check} onClick={() => void acknowledge(a)} disabled={busy !== null} className="shrink-0 self-start sm:self-center">
                  {busy === a.id ? "Acknowledging…" : "Acknowledge"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The S-curve and where the project stands                           */
/* ------------------------------------------------------------------ */

export function EarnedValueHero({ p }: { p: Detail }) {
  const k = p.kpis;
  const curve = sCurve(p.history, k);
  const cpiBand = indexBand(k.cpi);
  const spiBand = indexBand(k.spi);

  return (
    <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Panel title="Earned value" subtitle="Planned value, earned value and actual cost, week by week to today" icon={LineChart}>
        {curve.labels.length > 1 ? (
          <MultiLine
            labels={curve.labels}
            series={[
              { key: "pv", label: "Planned value", hue: "slate", dashed: true, values: curve.pv },
              { key: "ev", label: "Earned value", hue: "mint", area: true, values: curve.ev },
              { key: "ac", label: "Actual cost", hue: "blue", values: curve.ac },
            ]}
            format={money}
            caption={`S-curve for ${p.name}: planned value, earned value and actual cost over time`}
            marker={curve.todayIndex >= 0 ? { index: curve.todayIndex, label: "Today" } : undefined}
            height={260}
          />
        ) : (
          <p className="py-12 text-center text-sm text-neutral-500">The curve draws itself from the weekly snapshots. The first one is taken on Monday.</p>
        )}
        <p className="mt-4 text-xs text-neutral-600">
          Earned value above actual cost means the work done is worth more than it cost; earned value below planned value means the project is behind.
          {k.acLabourProvisional > 0 && <> Actual cost includes {amount(k.acLabourProvisional)} of provisional labour.</>}
        </p>
      </Panel>

      <Panel title="Where it stands" subtitle={`As of ${day(k.asOf)}`} icon={CircleGauge} hue="mint">
        <div className="flex items-center gap-4">
          <ProgressRing pctBp={k.pctBp} size={84} stale={k.progress.stale} showText={false} />
          <div>
            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{pctText(k.pctBp)}</p>
            <p className="mt-1 text-sm text-neutral-600">complete</p>
            {k.progress.stale && (
              <Chip hue="slate" icon={RAG.stale.icon} className="mt-1.5">
                Stale data
              </Chip>
            )}
          </div>
        </div>
        <dl className="mt-5 space-y-4">
          <div>
            <dt className="flex items-center justify-between gap-2 text-sm text-neutral-600">
              Cost efficiency (CPI)
              <IndexValue name="CPI" value={k.cpi} />
            </dt>
            <dd className="mt-0.5 text-xs text-neutral-500">
              {k.cpi === null ? "Needs spend and progress to measure." : `₦${indexText(k.cpi)} of work done for every ₦1 spent${cpiBand ? `: ${BAND[cpiBand].word}` : ""}.`}
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between gap-2 text-sm text-neutral-600">
              Schedule (SPI)
              <IndexValue name="SPI" value={k.spi} />
            </dt>
            <dd className="mt-0.5 text-xs text-neutral-500">
              {k.spi === null ? "Needs a budget and progress to measure." : `${Math.round(k.spi * 100)}% of the work planned by now is done${spiBand ? `: ${BAND[spiBand].word}` : ""}.`}
            </dd>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="text-xs font-medium text-neutral-500">Estimate at completion</dt>
            <dd className="mt-0.5 text-lg font-bold tracking-tight tabular-nums text-neutral-900">{k.eac === null ? "–" : amount(k.eac)}</dd>
            <dd className="text-xs text-neutral-600">
              {k.eacMethod ? EAC_METHOD[k.eacMethod] ?? humanise(k.eacMethod) : "Needs a budget to project."}
              {k.eac !== null && k.bac > 0 && (
                <span className={cx("ml-1 font-semibold", k.eac > k.bac ? "text-rose-700" : "text-mint-700")}>
                  {k.eac > k.bac ? `${compact(k.eac - k.bac)} over` : `${compact(k.bac - k.eac)} under`} the {compact(k.bac)} budget.
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Three ways of reading profit                                       */
/* ------------------------------------------------------------------ */

function ProfitCard({ label, value, values, hint, hue }: { label: string; value: number | null; values: number[]; hint: string; hue: Hue }) {
  return (
    <div className="ws-card flex h-full flex-col gap-3 p-5">
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className={cx("whitespace-nowrap text-[26px] font-bold leading-none tracking-tight tabular-nums", value === null ? "text-neutral-500" : value < 0 ? "text-rose-700" : "text-neutral-900")}>
          {value === null ? "–" : compact(value)}
        </p>
        <Sparkline values={values} hue={value !== null && value < 0 ? "rose" : hue} width={104} height={32} baseline={0} label={`${label}, last ${values.length} weeks`} format={money} />
      </div>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

export function ProfitViews({ p }: { p: Detail }) {
  const k = p.kpis;
  const target = k.targetMarginBp;
  const projectedMargin = k.projectedMarginBp ?? marginBp(k.projectedProfit, k.contractValue);
  const beatsTarget = projectedMargin !== null && target !== null ? projectedMargin >= target : null;

  return (
    <section aria-labelledby="pf-profit" className="mb-5">
      <h2 id="pf-profit" className="sr-only">
        Profit
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProfitCard
          label="Progress profit"
          value={k.progressProfit}
          values={trend(p.history, k, "progressProfit")}
          hue="mint"
          hint={k.progressProfit === null ? "Needs a contract value and progress." : "Contract value earned by the work done, less what it cost."}
        />
        <ProfitCard label="Recognised profit" value={k.recognisedProfit} values={trend(p.history, k, "recognisedProfit")} hue="grape" hint="Revenue recognised in the books, less what has been spent." />
        <ProfitCard label="Cash position" value={k.cashPosition} values={trend(p.history, k, "cashPosition")} hue="sky" hint="Collected from the client, less what has been spent." />
        <div className="ws-card flex h-full flex-col gap-3 p-5">
          <p className="flex items-center justify-between gap-2 text-sm font-medium text-neutral-600">
            Projected at completion
            <Target size={16} aria-hidden className="text-neutral-400" />
          </p>
          <p className={cx("text-[26px] font-bold leading-none tracking-tight tabular-nums", k.projectedProfit === null ? "text-neutral-500" : k.projectedProfit < 0 ? "text-rose-700" : "text-neutral-900")}>
            {k.projectedProfit === null ? "–" : compact(k.projectedProfit)}
          </p>
          {projectedMargin !== null ? (
            <MarginMeter margin={projectedMargin} target={target} />
          ) : (
            <p className="text-xs text-neutral-500">Needs a contract value and a budget to project.</p>
          )}
          {beatsTarget !== null && (
            <p className={cx("text-xs font-semibold", beatsTarget ? "text-mint-700" : "text-rose-700")}>
              {marginText(projectedMargin)} margin, {beatsTarget ? "at or above" : "below"} the {marginText(target)} target.
            </p>
          )}
          {beatsTarget === null && projectedMargin !== null && <p className="text-xs text-neutral-500">{marginText(projectedMargin)} margin. No target margin is set on the budget.</p>}
        </div>
      </div>
    </section>
  );
}

/** A margin against its target: a bar to 50%, a tick at the target. */
function MarginMeter({ margin, target }: { margin: number; target: number | null }) {
  const scale = Math.max(5000, margin, target ?? 0);
  const at = (bp: number) => `${Math.max(0, Math.min(100, (bp / scale) * 100))}%`;
  const ok = target === null || margin >= target;
  return (
    <div role="img" aria-label={`Projected margin ${marginText(margin)}${target !== null ? `, target ${marginText(target)}` : ""}`} className="relative pt-1">
      <div className="ws-hatch h-2.5 w-full overflow-hidden rounded-full">
        <div className={cx("h-full rounded-full", ok ? HUE.mint.bar : HUE.rose.bar)} style={{ width: at(Math.max(0, margin)) }} />
      </div>
      {target !== null && <span aria-hidden className="absolute top-0 h-4 w-0.5 rounded-full bg-neutral-900/70" style={{ left: at(target) }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue: contract value → invoiced → collected                     */
/* ------------------------------------------------------------------ */

export function RevenueStrip({ p }: { p: Detail }) {
  const k = p.kpis;
  const contractHref = `/suite/finance/revenue/contracts/${p.id}`;
  const value = p.contract?.value ?? k.contractValue;
  const outstandingNotOverdue = Math.max(0, k.receivable - k.overdue);
  const scale = Math.max(1, value, k.invoiced);
  const late = p.invoices.filter((i) => i.daysLate > 0 && i.outstanding > 0);
  const share = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;

  return (
    <Panel
      title="Revenue"
      subtitle={p.contract ? [p.contract.reference, p.contract.client].filter(Boolean).join(" · ") || p.contract.title || "Contract" : "No contract set up yet"}
      icon={Receipt}
      hue="sky"
      actions={
        p.contract ? (
          <Link href={contractHref} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
            <FileSignature size={15} aria-hidden />
            Contract
          </Link>
        ) : undefined
      }
    >
      {!p.contract ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-neutral-300 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-600">
            Without a contract there is no revenue to track: no invoices, no collections, no margin. {value > 0 && `The budget assumes a contract value of ${compact(value)}.`}
          </p>
          <ButtonLink href={contractHref} icon={FileSignature} size="sm">
            Set up the contract
          </ButtonLink>
        </div>
      ) : (
        <>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            {(
              [
                ["Contract value", value, null],
                ["Invoiced", k.invoiced, value > 0 ? `${Math.round((k.invoiced / value) * 100)}% of the contract` : null],
                ["Collected", k.collected, k.invoiced > 0 ? `${Math.round((k.collected / k.invoiced) * 100)}% of invoices` : null],
              ] as const
            ).map(([label, v, note], i) => (
              <li key={label} className="contents">
                {i > 0 && <ArrowRight aria-hidden size={18} className="hidden text-neutral-300 sm:block" />}
                <div className="rounded-xl bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-medium text-neutral-500">{label}</p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-neutral-900">{compact(v)}</p>
                  {note && <p className="text-xs text-neutral-500">{note}</p>}
                </div>
              </li>
            ))}
          </ol>
          <div
            role="img"
            aria-label={`Of ${compact(value)}: collected ${compact(k.collected)}, outstanding ${compact(outstandingNotOverdue)}, overdue ${compact(k.overdue)}, not yet invoiced ${compact(Math.max(0, value - k.invoiced))}.`}
            className="ws-hatch mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
          >
            <span className={cx("h-full rounded-full", HUE.mint.bar)} style={{ width: share(k.collected) }} />
            <span className={cx("h-full rounded-full", HUE.sky.bar)} style={{ width: share(outstandingNotOverdue) }} />
            <span className={cx("h-full rounded-full", HUE.rose.bar)} style={{ width: share(k.overdue) }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.mint.dot)} />
              Collected
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.sky.dot)} />
              Outstanding <span className="font-semibold tabular-nums text-neutral-900">{compact(outstandingNotOverdue)}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.rose.dot)} />
              Overdue <span className="font-semibold tabular-nums text-neutral-900">{compact(k.overdue)}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="ws-hatch h-2.5 w-2.5 rounded-sm ring-1 ring-neutral-300" />
              Not yet invoiced
            </li>
          </ul>

          {late.length > 0 && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {late.length === 1 ? "1 invoice is" : `${late.length} invoices are`} overdue, the oldest by {Math.max(...late.map((i) => i.daysLate))} days.
            </p>
          )}

          {p.invoices.length > 0 ? (
            <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
              {p.invoices.map((inv) => (
                <li key={inv.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/suite/finance/revenue/invoices/${inv.id}`} className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-primary-700 hover:underline">
                      <FileText size={13} aria-hidden />
                      {inv.invoiceNo ?? "Invoice"}
                    </Link>
                    <span className="block text-xs text-neutral-500">
                      {day(inv.date)} · due {day(inv.dueOn)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-neutral-900">{amount(inv.total)}</span>
                    {inv.outstanding <= 0 ? (
                      <Chip hue="mint">Paid</Chip>
                    ) : inv.daysLate > 0 ? (
                      <Chip hue="rose">{inv.daysLate} days late</Chip>
                    ) : (
                      <span className="text-xs tabular-nums text-neutral-500">{amount(inv.outstanding)} to collect</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-neutral-500">No invoices raised on this contract yet.</p>
          )}
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Status: every dimension and why                                    */
/* ------------------------------------------------------------------ */

export function StatusPanel({ p }: { p: Detail }) {
  return (
    <Panel title="Status" subtitle="Each dimension Finance can see, and why" icon={ShieldCheck} hue={(RAG[p.status] ?? RAG.grey).hue}>
      <ul className="space-y-3">
        {p.reasons.map((r) => {
          const m = RAG[r.status] ?? RAG.grey;
          const Icon = m.icon;
          return (
            <li key={r.dimension} className={cx("flex items-start gap-3 rounded-xl p-3", HUE[m.hue].soft)}>
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {DIMENSION_LABEL[r.dimension] ?? humanise(r.dimension)} · {m.label}
                </p>
                <p className="mt-0.5 text-sm text-neutral-700">{r.reason}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-neutral-500">The overall status is the worst of these. Stale progress greys the project out until the project manager reports again.</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress: percent complete, how it was measured, and reporting it  */
/* ------------------------------------------------------------------ */

export function ProgressCard({ p, canReport, onReported }: { p: Detail; canReport: boolean; onReported: (message: string) => void }) {
  const uid = useId();
  const k = p.kpis;
  const prog = k.progress;
  const [pct, setPct] = useState("");
  const [asOf, setAsOf] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const showForm = canReport && reportsProgress(k);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(pct);
    if (pct.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) {
      setErrors({ pct: "Enter how complete the project is, from 0 to 100." });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const r = await spend.funds.reportProgress(p.id, { pct: n, asOf: asOf || null });
      setPct("");
      setAsOf("");
      onReported(`Progress reported: ${pctText(r.pctBp)} complete as of ${day(r.asOf)}.`);
    } catch (err) {
      const msg = plainError(err, "Progress wasn't reported.");
      setErrors({ general: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Progress" subtitle={PROGRESS_METHOD[prog.method] ?? humanise(prog.method)} icon={Gauge} hue={prog.stale ? "slate" : "blue"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">{pctText(prog.pctBp)}</p>
        <p className="text-xs text-neutral-500">{prog.asOf ? `As of ${day(prog.asOf)}` : "Not measured yet"}</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={prog.pctBp === null ? undefined : Math.round(prog.pctBp / 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="How complete the project is"
        className="ws-hatch mt-3 h-2.5 overflow-hidden rounded-full"
      >
        <div className={cx("h-full rounded-full", prog.stale ? HUE.slate.bar : HUE.blue.bar)} style={{ width: `${Math.min(100, (prog.pctBp ?? 0) / 100)}%` }} />
      </div>
      <p className="mt-3 text-sm text-neutral-700">{prog.detail}</p>
      {prog.stale && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          <RAG.stale.icon size={16} aria-hidden className="mt-0.5 shrink-0" />
          Stale data: earned value can&apos;t be trusted until progress is reported again.
        </p>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-5 border-t border-neutral-100 pt-4" noValidate>
          <p className="mb-3 text-sm font-semibold text-neutral-900">Report progress</p>
          {errors.general && (
            <p role="alert" className="mb-3 rounded-xl bg-error-500/5 px-4 py-3 text-sm text-error-700">
              {errors.general}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-pct`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                Percent complete
              </label>
              <input
                id={`${uid}-pct`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                aria-invalid={Boolean(errors.pct) || undefined}
                className={cx(inputClass, "text-right tabular-nums")}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-asof`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                As of <span className="font-normal text-neutral-500">(today if blank)</span>
              </label>
              <input id={`${uid}-asof`} type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass} />
            </div>
          </div>
          <FieldError message={errors.pct} />
          <div className="mt-3 flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Reporting…" : "Report progress"}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Labour on the project                                              */
/* ------------------------------------------------------------------ */

export function LabourCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectLabour | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    spend.funds.labour(projectId).then(
      (d) => alive && setData(d),
      (e: unknown) => alive && setError(plainError(e, "Labour didn't load.")),
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <Panel
      title="Labour"
      subtitle={data ? `${compact(data.allocated + data.provisional)} charged from payroll` : "Payroll cost charged to this project"}
      icon={HardHat}
      hue="sun"
      actions={
        <Link href="/suite/finance/labour" className="inline-flex min-h-9 items-center rounded-lg px-1 text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
          Labour costing
        </Link>
      }
    >
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : data.months.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">No labour charged yet. It arrives with each month&apos;s allocation, or weekly as a provisional charge.</p>
      ) : (
        <>
          <StackedColumns
            data={data.months.map((m) => ({ label: monthLabel(m.month, true), values: { allocated: m.allocated, provisional: m.provisional } }))}
            series={[
              { key: "allocated", label: "Allocated", hue: "blue" },
              { key: "provisional", label: "Provisional", hue: "grape", dashed: true },
            ]}
            format={money}
            caption="Labour charged to the project by month, allocated and provisional"
            showTotals
            height={180}
          />
          <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
            {data.months.map((m) => (
              <li key={m.month} className="flex items-center justify-between gap-3 py-2">
                <span className="text-neutral-700">{monthLabel(m.month)}</span>
                <span className="tabular-nums text-neutral-500">
                  {Math.round(m.hours * 10) / 10} h · <span className="font-semibold text-neutral-900">{amount(m.allocated + m.provisional)}</span>
                </span>
              </li>
            ))}
          </ul>
          {data.provisional > 0 && (
            <p className="mt-3 rounded-xl bg-grape-50 px-3 py-2 text-xs text-grape-700">
              Includes {amount(data.provisional)} of provisional labour: hours so far at the latest rates, replaced when the month&apos;s allocation is posted.
            </p>
          )}
          {data.seesPeople && data.people && data.people.length > 0 && (
            <details className="group mt-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-1 text-sm font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                People and rates
                <span className="text-xs font-normal text-neutral-500 group-open:hidden">Show</span>
                <span className="hidden text-xs font-normal text-neutral-500 group-open:inline">Hide</span>
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <caption className="sr-only">People whose hours were charged to the project, with their rates</caption>
                  <thead>
                    <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th scope="col" className="py-2 pl-2 pr-3">Person</th>
                      <th scope="col" className="px-3 py-2">Month</th>
                      <th scope="col" className="px-3 py-2 text-right">Hours</th>
                      <th scope="col" className="px-3 py-2 text-right">Rate</th>
                      <th scope="col" className="py-2 pl-3 pr-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((x, i) => (
                      <tr key={`${x.userId}-${x.month}-${x.kind}-${i}`} className="border-b border-neutral-100 last:border-b-0">
                        <td className="py-2 pl-2 pr-3 font-medium text-neutral-900">{x.name ?? "Someone"}</td>
                        <td className="px-3 py-2 text-neutral-600">
                          {monthLabel(x.month, true)}
                          {x.kind === "provisional" && <span className="ml-1 text-xs text-grape-700">provisional</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{Math.round(x.hours * 10) / 10}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-700">{amount(x.hourlyRate)}</td>
                        <td className="whitespace-nowrap py-2 pl-3 pr-2 text-right font-semibold tabular-nums text-neutral-900">{amount(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
