"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  LineChart,
  PauseCircle,
  PieChart,
  Plus,
  ReceiptText,
  Scale,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  ApiError,
  hrm,
  type DepartmentCost,
  type EmployeeLoan,
  type PayrollCostPoint,
  type PayrollExport,
  type PayrollReadiness,
  type PayrollRun,
  type PayrollVariance,
  type RegisterRow,
  type StatutoryBurden,
} from "@/lib/api/hrm-client";
import {
  GrantLoanDialog,
  PayElements,
  Readiness,
  Salaries,
  StatutoryRates,
} from "@/suite/hrm/components/console/PayrollSetup";
import { formatDate, formatMinutes, nairaFromKobo, payRunTone } from "@/suite/hrm/lib/format";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  StatCard,
  StatGrid,
  buttonClass,
  cx,
} from "@/components/workspace/kit";
import { AreaLine, ColumnChart, Legend, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  LoadFailed,
  MiniStat,
  ModalFrame,
  Notice,
  PageSkeleton,
  PersonCell,
  SoftButton,
  ToneChip,
  hintCls,
  inputCls,
  labelCls,
  toneHue,
} from "../ui2/kit";

/**
 * Running payroll.
 *
 * The screen is built around the one irreversible act in the module. A run can
 * be recalculated as often as anybody likes up to approval; after it, every
 * figure on every payslip is fixed. So the checks that matter — does it
 * balance, can everybody actually be paid — are put in front of the approve
 * button rather than left to be discovered afterwards.
 *
 * The bank file and the ledger journal come from one endpoint, because if they
 * were fetched separately they could disagree, and a disagreement between them
 * means money moved that the ledger does not know about.
 */

type Tab = "runs" | "people" | "elements" | "rates" | "loans" | "analytics";

const TABS: { key: Tab; label: string }[] = [
  { key: "runs", label: "Runs" },
  { key: "people", label: "Salaries" },
  { key: "elements", label: "Pay elements" },
  { key: "rates", label: "Rates" },
  { key: "loans", label: "Loans" },
  { key: "analytics", label: "Cost" },
];

/** Money on a chart axis: the chart works in naira, the formatter in kobo. */
const naira = (v: number) => nairaFromKobo(v * 100);

const signed = (kobo: number) => `${kobo >= 0 ? "+" : ""}${nairaFromKobo(kobo)}`;

export default function PayrollBoard() {
  const [tab, setTab] = useState<Tab>("runs");
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Work a run out as often as you like; approving it fixes every figure."
        actions={
          tab === "runs" ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              New run
            </Button>
          ) : undefined
        }
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {tab === "runs" && <Runs adding={adding} setAdding={setAdding} />}
      {tab === "people" && <Salaries />}
      {tab === "elements" && <PayElements />}
      {tab === "rates" && <StatutoryRates />}
      {tab === "loans" && <Loans />}
      {tab === "analytics" && <Cost />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Runs                                                               */
/* ------------------------------------------------------------------ */

function Runs({ adding, setAdding }: { adding: boolean; setAdding: (v: boolean) => void }) {
  const [rows, setRows] = useState<PayrollRun[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.payroll
        .runs()
        .then((res) => {
          setRows(res.data);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* The figures above the list are read off the runs already loaded. */
  const byDate = useMemo(
    () => [...(rows ?? [])].sort((a, b) => a.payDate.localeCompare(b.payDate)),
    [rows],
  );
  // Runs with anybody on them. A draft's figures are working figures, so the
  // chart paints them amber and the cards say which status they come from.
  const worked = byDate.filter((r) => r.headcount > 0);
  const latest = worked[worked.length - 1] ?? null;
  const waiting = byDate.filter((r) => r.status === "draft" || r.status === "calculated").length;

  const toggle = (run: PayrollRun) => setOpen(open === run.id ? null : run.id);

  const openButton = (run: PayrollRun) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(run);
      }}
      className="h-9 shrink-0 cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      {open === run.id ? "Close" : "Open"}
    </button>
  );

  const runIcon = (run: PayrollRun, size = 36) => (
    <span
      className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[toneHue(payRunTone(run.status))].soft)}
      style={{ width: size, height: size }}
    >
      <Banknote size={size > 36 ? 18 : 16} aria-hidden />
    </span>
  );

  const columns: Column<PayrollRun>[] = [
    {
      key: "reference",
      header: "Run",
      primary: true,
      sortable: true,
      value: (r) => r.reference,
      render: (r) => (
        <span className="flex items-center gap-3">
          {runIcon(r)}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">
              {r.reference} · {r.periodLabel}
            </span>
            <span className="block truncate text-xs text-neutral-500">{r.kindLabel}</span>
          </span>
        </span>
      ),
    },
    { key: "payDate", header: "Paid", sortable: true, value: (r) => r.payDate, render: (r) => formatDate(r.payDate) },
    {
      key: "headcount",
      header: "People",
      align: "right",
      sortable: true,
      value: (r) => r.headcount,
      hideOnMobile: true,
    },
    {
      key: "net",
      header: "Net",
      align: "right",
      sortable: true,
      value: (r) => r.netKobo,
      render: (r) => (r.headcount > 0 ? <span className="font-semibold text-neutral-900">{nairaFromKobo(r.netKobo)}</span> : "-"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (r) => r.statusLabel,
      render: (r) => <ToneChip dot tone={payRunTone(r.status)}>{r.statusLabel}</ToneChip>,
    },
    { key: "open", header: "", align: "right", tableOnly: true, render: openButton },
  ];

  const chart = worked.slice(-8).map((r) => ({
    label: r.periodLabel,
    value: Math.round(r.netKobo / 100),
    hue: r.isFrozen ? ("blue" as const) : ("sun" as const),
  }));

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

      {rows !== null && (
        <>
          <StatGrid>
            <StatCard
              featured
              icon={Banknote}
              label="Net, latest run"
              value={latest ? nairaFromKobo(latest.netKobo) : "-"}
              hint={latest ? `${latest.periodLabel} · ${latest.statusLabel}` : "Nothing worked out yet"}
            />
            <StatCard
              icon={Coins}
              hue="mint"
              label="Gross, latest run"
              value={latest ? nairaFromKobo(latest.grossKobo) : "-"}
              hint={latest ? `${nairaFromKobo(latest.deductionsKobo)} deducted` : undefined}
            />
            <StatCard
              icon={Users}
              hue="sky"
              label="People on it"
              value={latest ? String(latest.headcount) : "-"}
              hint={latest ? latest.kindLabel : undefined}
            />
            <StatCard
              icon={Clock}
              hue="sun"
              label="Waiting to be approved"
              value={String(waiting)}
              hint="Draft or worked out"
            />
          </StatGrid>

          {worked.length > 0 && latest && (
            <div className="grid gap-6 xl:grid-cols-3">
              <Panel
                className="xl:col-span-2"
                title="Net pay by run"
                subtitle="Approved runs in blue. Amber is a working figure that will change until it is approved."
                icon={LineChart}
                actions={
                  <Legend
                    items={[
                      { label: "Approved", hue: "blue" },
                      { label: "Working", hue: "sun" },
                    ]}
                  />
                }
              >
                <div className="pt-8">
                  <ColumnChart data={chart} height={220} format={naira} highlight="last" caption="Net pay by run" />
                </div>
              </Panel>
              <Panel title="Where the money went" subtitle={`${latest.periodLabel} · ${latest.statusLabel}`} icon={PieChart} hue="grape">
                <StatusBars
                  caption={`How ${latest.reference} was split`}
                  format={nairaFromKobo}
                  data={[
                    { label: "Net pay", value: latest.netKobo, hue: "mint" },
                    { label: "Deductions", value: latest.deductionsKobo, hue: "coral" },
                    { label: "Employer contributions", value: latest.employerCostKobo, hue: "grape" },
                  ]}
                />
                <div className="mt-5 rounded-xl bg-neutral-50 p-3">
                  <MiniStat label="Total cost" value={nairaFromKobo(latest.totalCostKobo)} hue="blue" />
                </div>
              </Panel>
            </div>
          )}
        </>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">Payroll runs</h2>
          <p className="text-sm text-neutral-500">
            A run can be worked out again as often as you like. Approving it fixes every figure.
          </p>
        </div>
        {rows === null ? (
          <PageSkeleton stats={0} />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            storageKey="hrm.payroll.runs"
            caption="Payroll runs"
            searchPlaceholder="Search runs"
            onRowClick={toggle}
            empty={
              <Empty
                icon={Banknote}
                title="No payroll yet"
                hint="Open a run for the period you want to pay."
              />
            }
            renderCard={(r) => (
              <div className={cx("flex h-full flex-col gap-4 rounded-[1.125rem] p-5", open === r.id && "ring-2 ring-primary-300")}>
                <div className="flex items-start gap-3">
                  {runIcon(r, 40)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-neutral-900">{r.periodLabel}</p>
                    <p className="text-xs text-neutral-500">{r.reference}</p>
                  </div>
                  <ToneChip dot tone={payRunTone(r.status)}>{r.statusLabel}</ToneChip>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Net</p>
                  <p className="text-2xl font-bold tracking-tight tabular-nums text-neutral-900">
                    {r.headcount > 0 ? nairaFromKobo(r.netKobo) : "-"}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span>
                    {r.kindLabel} · paid {formatDate(r.payDate)}
                  </span>
                  <span className="tabular-nums">
                    {r.headcount} {r.headcount === 1 ? "person" : "people"}
                  </span>
                </div>
              </div>
            )}
            renderListItem={(r) => (
              <div className={cx("flex flex-wrap items-center gap-4 px-5 py-3.5", open === r.id && "bg-primary-50/60")}>
                {runIcon(r)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {r.reference} · {r.periodLabel}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.kindLabel} · paid {formatDate(r.payDate)} · {r.headcount}{" "}
                    {r.headcount === 1 ? "person" : "people"}
                    {r.headcount > 0 ? ` · ${nairaFromKobo(r.netKobo)} net` : ""}
                  </p>
                </div>
                <ToneChip dot tone={payRunTone(r.status)}>{r.statusLabel}</ToneChip>
              </div>
            )}
          />
        )}
      </section>

      {open !== null && <RunDetail runId={open} onChanged={load} />}

      {adding && (
        <OpenRunDialog
          onClose={() => setAdding(false)}
          onOpened={(id) => {
            setAdding(false);
            setOpen(id);
            void load();
          }}
        />
      )}
    </div>
  );
}

export function RunDetail({
  runId,
  onChanged,
}: {
  runId: string;
  onChanged: () => Promise<void>;
}) {
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [checks, setChecks] = useState<{
    unbalanced: number;
    unpayable: number;
    withShortfall: number;
  } | null>(null);
  const [exported, setExported] = useState<PayrollExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.payroll
        .run(runId)
        .then((res) => {
          setRun(res.data);
          setChecks(res.meta);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [runId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (run === null || !run.isFrozen) {
      setExported(null);
      return;
    }

    let cancelled = false;

    hrm.payroll
      .exportRun(run.id)
      .then((res) => {
        if (!cancelled) setExported(res);
      })
      .catch(() => {
        // The export is a view of an approved run. Failing to fetch it should
        // not stop the run itself being readable.
      });

    return () => {
      cancelled = true;
    };
  }, [run]);

  const act = async (
    action: "calculate" | "approve" | "pay" | "distribute",
    body: { paidOn?: string } = {},
  ) => {
    setBusy(true);
    setError(null);

    try {
      await hrm.payroll.transitionRun(runId, action, body);
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  if (error !== null && run === null) {
    return <LoadFailed title="Could not load" message={error} icon={Banknote} />;
  }

  if (run === null) {
    return <PageSkeleton />;
  }

  const blocked = (checks?.unbalanced ?? 0) > 0;
  // Maker-checker: whoever last worked the figures out cannot approve them.
  const selfMade = run.status === "calculated" && run.mayApprove === false;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary-50 to-white px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-sm shadow-primary-600/20">
              <ReceiptText size={22} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight text-neutral-900">
                {run.reference} · {run.periodLabel}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                <ToneChip dot tone={payRunTone(run.status)}>{run.statusLabel}</ToneChip>
                {run.kindLabel} ·{" "}
                {run.paidAt !== null ? `paid ${formatDate(run.paidAt)}` : `pay date ${formatDate(run.payDate)}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {run.isRecalculable && (
              <Button onClick={() => void act("calculate")} disabled={busy}>
                {run.status === "draft" ? "Work it out" : "Work it out again"}
              </Button>
            )}

            {run.status === "calculated" && (
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={() => void act("approve")}
                disabled={busy || blocked || selfMade}
                title={selfMade ? "You worked these figures out, so somebody else has to approve them." : undefined}
              >
                Approve
              </Button>
            )}

            {run.status === "approved" && (
              <>
                <a href={hrm.payroll.bankFileUrl(run.id)} className={buttonClass("primary")}>
                  <Download size={17} aria-hidden />
                  Bank file
                </a>
                <Button onClick={() => setMarkingPaid(true)} disabled={busy}>
                  Mark as paid
                </Button>
              </>
            )}

            {run.isFrozen && (
              <Button onClick={() => void act("distribute")} disabled={busy}>
                Release payslips
              </Button>
            )}
          </div>
        </div>

        {run.isFrozen && (
          <p className="border-t border-neutral-100 px-6 py-3 text-xs text-neutral-500">
            Approved on {formatDate(run.approvedAt)}. Every figure is fixed:
            correct it with an off-cycle run rather than by changing this one.
          </p>
        )}
      </Card>

      <StatGrid>
        <StatCard icon={Users} hue="sky" label="People" value={String(run.headcount)} hint={run.kindLabel} />
        <StatCard
          icon={Coins}
          hue="mint"
          label="Gross"
          value={nairaFromKobo(run.grossKobo)}
          hint={`${nairaFromKobo(run.deductionsKobo)} deducted`}
        />
        <StatCard featured icon={Banknote} label="Net to pay" value={nairaFromKobo(run.netKobo)} />
        <StatCard
          icon={Scale}
          hue="grape"
          label="Total cost"
          value={nairaFromKobo(run.totalCostKobo)}
          hint="Gross plus employer contributions"
        />
      </StatGrid>

      {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

      {/*
        The checks that belong in front of the approve button rather than
        after it. Approval cannot be undone.
      */}
      {checks !== null && !run.isFrozen && run.headcount > 0 && (
        <Panel title="Before you approve" subtitle="Approval cannot be undone." icon={BookOpenCheck} hue={blocked ? "rose" : "mint"}>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Check
              ok={!selfMade}
              good="A second person approves it, not whoever worked it out."
              bad="You worked these figures out, so somebody else has to approve them."
            />
            <Check
              ok={checks.unbalanced === 0}
              good="Every payslip adds up."
              bad={`${checks.unbalanced} payslips do not add up. This is a bug. Do not approve.`}
            />
            <Check
              ok={checks.unpayable === 0}
              good="Everybody can be paid."
              bad={`${checks.unpayable} cannot be paid: no bank account number, or nothing to pay.`}
            />
            <Check
              ok={checks.withShortfall === 0}
              good="No deduction had to be held back."
              bad={`${checks.withShortfall} had deductions that would have pushed their pay below zero.`}
            />
          </ul>
        </Panel>
      )}

      <RunExtras run={run} />

      {run.isFrozen && <RunBreakdown runId={run.id} reference={run.reference} />}

      {exported !== null && <ExportPanel data={exported} />}

      {markingPaid && (
        <MarkPaidDialog
          payDate={run.payDate}
          busy={busy}
          onClose={() => setMarkingPaid(false)}
          onConfirm={async (paidOn) => {
            await act("pay", { paidOn });
            setMarkingPaid(false);
          }}
        />
      )}
    </div>
  );
}

/** Today as YYYY-MM-DD in the viewer's own time zone. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Record the day the money left.
 *
 * Payroll is usually marked paid once the bank confirms, often days after the
 * transfer. Stamping "today" made the run, and every payslip, disagree with
 * the bank statement — so the date is asked for, starting at the run's pay
 * date (or today, if the pay date is still to come).
 */
export function MarkPaidDialog({
  payDate,
  busy,
  onClose,
  onConfirm,
}: {
  payDate: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (paidOn: string) => Promise<void>;
}) {
  const today = todayIso();
  const [paidOn, setPaidOn] = useState(
    payDate !== null && payDate.slice(0, 10) <= today ? payDate.slice(0, 10) : today,
  );

  return (
    <ModalFrame
      title="Mark as paid"
      subtitle="Record the day the money left the account, as it shows on the bank statement."
      icon={Banknote}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        void onConfirm(paidOn);
      }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || paidOn === "" || paidOn > today}>
            {busy ? "Saving…" : "Mark as paid"}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className={labelCls}>Paid on</span>
        <input
          type="date"
          value={paidOn}
          max={today}
          onChange={(e) => setPaidOn(e.target.value)}
          required
          className={inputCls}
        />
        <span className={hintCls}>
          {payDate !== null ? `The run's pay date is ${formatDate(payDate)}. ` : ""}
          Employees see this date on their payslips.
        </span>
      </label>
    </ModalFrame>
  );
}

/**
 * One run taken apart.
 *
 * The variance is the part worth having. "The bill went up four million" is not
 * an answer to anything; "nine people joined and Ada's overtime tripled" is,
 * and it is the question payroll is asked every single month.
 */
function RunBreakdown({
  runId,
  reference,
}: {
  runId: string;
  reference: string;
}) {
  const [departments, setDepartments] = useState<DepartmentCost[]>([]);
  const [statutory, setStatutory] = useState<StatutoryBurden | null>(null);
  const [variance, setVariance] = useState<PayrollVariance | null>(null);
  const [register, setRegister] = useState<RegisterRow[] | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hrm.payroll
      .runAnalytics(runId)
      .then((res) => {
        if (cancelled) return;
        setDepartments(res.departments);
        setStatutory(res.statutory);
        setVariance(res.variance);
      })
      .catch(() => {
        // A breakdown of an approved run. Failing to fetch it should not stop
        // the run itself being readable.
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!showRegister || register !== null) return;

    hrm.payroll.register(runId).then(setRegister).catch(() => setRegister([]));
  }, [showRegister, register, runId]);

  const deptColumns: Column<DepartmentCost>[] = [
    {
      key: "department",
      header: "Department",
      primary: true,
      sortable: true,
      value: (d) => d.department,
      render: (d) => (
        <span className="flex items-center gap-2.5 font-semibold text-neutral-900">
          <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", HUE[hueFor(d.department)].soft)}>
            <Building2 size={15} aria-hidden />
          </span>
          {d.department}
        </span>
      ),
    },
    { key: "headcount", header: "People", align: "right", sortable: true, value: (d) => d.headcount },
    { key: "each", header: "Each", align: "right", sortable: true, value: (d) => d.costPerHeadKobo, render: (d) => nairaFromKobo(d.costPerHeadKobo), hideOnMobile: true },
    { key: "total", header: "Total cost", align: "right", sortable: true, value: (d) => d.totalCostKobo, render: (d) => <span className="font-semibold text-neutral-900">{nairaFromKobo(d.totalCostKobo)}</span> },
    {
      key: "share",
      header: "Share of gross",
      sortable: true,
      value: (d) => d.shareOfGross,
      className: "min-w-[140px]",
      render: (d) => (
        <span className="flex items-center gap-2">
          <span className="flex-1">
            <Progress value={d.shareOfGross ?? 0} hue={hueFor(d.department)} size="sm" />
          </span>
          <span className="w-10 text-right text-xs tabular-nums text-neutral-600">{d.shareOfGross ?? "-"}%</span>
        </span>
      ),
    },
  ];

  const registerColumns: Column<RegisterRow>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      sortable: true,
      value: (r) => r.employeeName,
      render: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <PersonCell size={30} name={r.employeeName} sub={r.department ?? r.employeeNumber ?? undefined} />
          {/*
            A rounding bug in one element is invisible on a single
            payslip and obvious across four hundred.
          */}
          {!r.balances && (
            <span className="rounded-full bg-error-500/10 px-2 py-0.5 text-[11px] font-semibold text-error-700">
              does not add up
            </span>
          )}
        </span>
      ),
    },
    { key: "gross", header: "Gross", align: "right", sortable: true, value: (r) => r.grossKobo, render: (r) => nairaFromKobo(r.grossKobo) },
    { key: "paye", header: "PAYE", align: "right", sortable: true, value: (r) => r.payeKobo, render: (r) => nairaFromKobo(r.payeKobo) },
    { key: "pension", header: "Pension", align: "right", sortable: true, value: (r) => r.pensionEmployeeKobo, render: (r) => nairaFromKobo(r.pensionEmployeeKobo), hideOnMobile: true },
    {
      key: "loans",
      header: "Loans",
      align: "right",
      sortable: true,
      value: (r) => r.loanRepaymentKobo,
      render: (r) => (r.loanRepaymentKobo === 0 ? "-" : nairaFromKobo(r.loanRepaymentKobo)),
      hideOnMobile: true,
    },
    { key: "net", header: "Net", align: "right", sortable: true, value: (r) => r.netKobo, render: (r) => <span className="font-semibold text-neutral-900">{nairaFromKobo(r.netKobo)}</span> },
  ];

  return (
    <div className="space-y-6">
      {variance !== null && (
        <Panel
          title={`Against ${variance.previousPeriod}`}
          subtitle="Why this run differs from the last one."
          icon={TrendingUp}
          hue="sky"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <DeltaTile label="Gross" value={signed(variance.grossDeltaKobo)} up={variance.grossDeltaKobo >= 0} />
            <DeltaTile
              label="Headcount"
              value={`${variance.headcountDelta >= 0 ? "+" : ""}${variance.headcountDelta}`}
              up={variance.headcountDelta >= 0}
            />
            <div className="rounded-xl bg-neutral-50 p-4">
              <MiniStat label="People changed" value={String(variance.changedCount)} />
            </div>
          </div>

          {(variance.joiners.length > 0 || variance.leavers.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {variance.joiners.map((row) => (
                <Chip key={row.employeeId} hue="mint" icon={UserPlus}>
                  {row.name}
                </Chip>
              ))}
              {variance.leavers.map((row) => (
                <Chip key={row.employeeId} icon={UserMinus}>
                  {row.name}
                </Chip>
              ))}
            </div>
          )}

          {variance.changes.length > 0 && (
            <ul className="mt-4 grid gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 sm:grid-cols-2">
              {variance.changes.map((row) => (
                <li key={row.employeeId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <PersonCell size={28} name={row.name} />
                  <span
                    className={cx(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      row.deltaKobo > 0 ? "bg-neutral-100 text-neutral-800" : "bg-sun-50 text-sun-700",
                    )}
                  >
                    {row.deltaKobo > 0 ? "+" : ""}
                    {nairaFromKobo(row.deltaKobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {statutory !== null && (
          <Panel title="Statutory burden" subtitle="What the state takes, and from whom." icon={Landmark} hue="grape">
            <StatusBars
              caption="Statutory deductions and contributions"
              format={nairaFromKobo}
              data={[
                { label: "PAYE", value: statutory.payeKobo, hue: "coral" },
                { label: "Pension (theirs)", value: statutory.pensionEmployeeKobo, hue: "sky" },
                { label: "NHF", value: statutory.nhfKobo, hue: "sun" },
                { label: "Pension (ours)", value: statutory.pensionEmployerKobo, hue: "grape" },
                { label: "NSITF", value: statutory.nsitfKobo, hue: "rose" },
              ]}
            />
            <dl className="mt-5 space-y-2 border-t border-neutral-100 pt-4 text-sm">
              <Row
                label="Out of their pay"
                value={`${nairaFromKobo(statutory.employeeSideKobo)} · ${statutory.employeeSharePercent}%`}
              />
              <Row
                label="On top, from us"
                value={`${nairaFromKobo(statutory.employerSideKobo)} · ${statutory.employerSharePercent}%`}
              />
            </dl>
            {/*
              The number to quote when somebody asks what a hire costs. Most
              institutions do not know their own.
            */}
            <p className="mt-3 rounded-xl bg-grape-50 px-3.5 py-2.5 text-xs text-grape-700">
              Every ₦1 of salary costs{" "}
              <span className="font-bold">₦{statutory.loadedCostMultiplier}</span>{" "}
              once the employer&rsquo;s own statutory bill is counted.
            </p>
          </Panel>
        )}

        {departments.length > 0 && (
          <Panel
            className={statutory !== null ? "xl:col-span-2" : "xl:col-span-3"}
            title="By department"
            subtitle="Cost and share of gross."
            icon={Building2}
            hue="mint"
          >
            <DataView
              rows={departments}
              columns={deptColumns}
              rowKey={(d) => d.department}
              storageKey="hrm.payroll.departments"
              caption={`${reference} cost by department`}
              searchPlaceholder="Search departments"
              gridCols={2}
              renderCard={(d) => (
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", HUE[hueFor(d.department)].soft)}>
                      <Building2 size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">{d.department}</p>
                      <p className="text-xs text-neutral-500">
                        {d.headcount} · {nairaFromKobo(d.costPerHeadKobo)} each
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">{nairaFromKobo(d.totalCostKobo)}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1">
                      <Progress value={d.shareOfGross ?? 0} hue={hueFor(d.department)} size="sm" />
                    </span>
                    <span className="text-xs tabular-nums text-neutral-600">{d.shareOfGross ?? "-"}% of gross</span>
                  </div>
                </div>
              )}
            />
          </Panel>
        )}
      </div>

      <Panel
        title="Register"
        subtitle="One row per person, for reconciling against."
        icon={FileSpreadsheet}
        hue="sky"
        actions={
          <>
            <Button size="sm" onClick={() => setShowRegister(!showRegister)}>
              {showRegister ? "Hide" : "Show"}
            </Button>
            <a href={hrm.payroll.registerCsvUrl(runId)} className={buttonClass("secondary", "sm")}>
              <Download size={15} aria-hidden />
              CSV
            </a>
          </>
        }
      >
        {!showRegister ? (
          <p className="text-sm text-neutral-500">
            {reference} · every figure on every payslip, as frozen.
          </p>
        ) : register === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={register}
            columns={registerColumns}
            rowKey={(r) => `${r.employeeNumber ?? ""}-${r.employeeName}`}
            storageKey="hrm.payroll.payslips"
            caption={`${reference} payroll register`}
            searchPlaceholder="Search payslips"
            renderCard={(r) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell name={r.employeeName} sub={r.department ?? r.employeeNumber ?? undefined} />
                  {!r.balances && (
                    <span className="shrink-0 rounded-full bg-error-500/10 px-2 py-0.5 text-[11px] font-semibold text-error-700">
                      does not add up
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Net</p>
                  <p className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">{nairaFromKobo(r.netKobo)}</p>
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3">
                  <MiniStat label="Gross" value={nairaFromKobo(r.grossKobo)} />
                  <MiniStat label="PAYE" value={nairaFromKobo(r.payeKobo)} />
                  <MiniStat label="Pension" value={nairaFromKobo(r.pensionEmployeeKobo)} />
                </div>
              </div>
            )}
          />
        )}
      </Panel>
    </div>
  );
}

function DeltaTile({ label, value, up }: { label: string; value: string; up: boolean }) {
  return (
    <div className={cx("rounded-xl p-4", up ? "bg-mint-50" : "bg-coral-50")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">{label}</p>
      <p className={cx("mt-0.5 flex items-center gap-1 text-lg font-bold tabular-nums", up ? "text-mint-700" : "text-coral-700")}>
        {up ? <ArrowUpRight size={16} aria-hidden /> : <ArrowDownRight size={16} aria-hidden />}
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="tnum text-sm font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cost                                                               */
/* ------------------------------------------------------------------ */

type Metric = "total" | "perHead" | "net";

const METRICS: { key: Metric; label: string }[] = [
  { key: "total", label: "Total cost" },
  { key: "perHead", label: "Per head" },
  { key: "net", label: "Paid out" },
];

/**
 * What payroll costs over time, and what is stopping the next run.
 *
 * Cost per head sits beside the total because the total moving is not a finding
 * on its own: a wage bill that rose ten per cent because twelve people joined
 * is a different conversation from one that rose ten per cent for the same
 * headcount.
 */
function Cost() {
  const [trend, setTrend] = useState<PayrollCostPoint[] | null>(null);
  const [readiness, setReadiness] = useState<PayrollReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("total");

  useEffect(() => {
    hrm.payroll
      .analytics()
      .then((res) => {
        setTrend(res.costTrend);
        setReadiness(res.readiness);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const ordered = useMemo(
    () => [...(trend ?? [])].sort((a, b) => a.payDate.localeCompare(b.payDate)),
    [trend],
  );

  if (error !== null) {
    return <LoadFailed title="Could not load" message={error} icon={TrendingUp} />;
  }

  if (trend === null) {
    return <PageSkeleton />;
  }

  const latest = ordered[ordered.length - 1] ?? null;
  const previous = ordered[ordered.length - 2] ?? null;
  const pct = (now: number | null | undefined, was: number | null | undefined) =>
    now != null && was != null && was > 0 ? Math.round(((now - was) / was) * 100) : null;

  const series = ordered.map((p) => ({
    label: p.period,
    value: Math.round(
      (metric === "total" ? p.totalCostKobo : metric === "net" ? p.netKobo : p.costPerHeadKobo ?? 0) / 100,
    ),
  }));

  const columns: Column<PayrollCostPoint>[] = [
    {
      key: "period",
      header: "Period",
      primary: true,
      sortable: true,
      value: (p) => p.payDate,
      render: (p) => (
        <span className="min-w-0">
          <span className="block font-semibold text-neutral-900">{p.period}</span>
          <span className="block text-xs text-neutral-500">{p.reference}</span>
        </span>
      ),
    },
    { key: "headcount", header: "People", align: "right", sortable: true, value: (p) => p.headcount },
    { key: "gross", header: "Gross", align: "right", sortable: true, value: (p) => p.grossKobo, render: (p) => nairaFromKobo(p.grossKobo), hideOnMobile: true },
    { key: "net", header: "Paid out", align: "right", sortable: true, value: (p) => p.netKobo, render: (p) => nairaFromKobo(p.netKobo) },
    { key: "each", header: "Each", align: "right", sortable: true, value: (p) => p.costPerHeadKobo, render: (p) => nairaFromKobo(p.costPerHeadKobo), hideOnMobile: true },
    {
      key: "total",
      header: "Total cost",
      align: "right",
      sortable: true,
      value: (p) => p.totalCostKobo,
      render: (p) => <span className="font-semibold text-neutral-900">{nairaFromKobo(p.totalCostKobo)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {readiness !== null && (
        <Readiness
          incomplete={readiness.incomplete}
          withoutProfile={readiness.withoutProfile}
        />
      )}

      {readiness !== null && (readiness.finalSettlementsWaiting?.length ?? 0) > 0 && (
        <SettlementsWaiting rows={readiness.finalSettlementsWaiting ?? []} />
      )}

      {ordered.length === 0 ? (
        <Card>
          <Empty
            icon={TrendingUp}
            title="Nothing approved yet"
            hint="A run appears here once it has been signed off."
          />
        </Card>
      ) : (
        <>
          <StatGrid>
            <StatCard
              featured
              icon={Wallet}
              label="Total cost, last run"
              value={latest ? nairaFromKobo(latest.totalCostKobo) : "-"}
              delta={pct(latest?.totalCostKobo, previous?.totalCostKobo)}
              deltaLabel={previous ? `vs ${previous.period}` : latest?.period}
            />
            <StatCard
              icon={Users}
              hue="sky"
              label="Cost per head"
              value={latest ? nairaFromKobo(latest.costPerHeadKobo) : "-"}
              delta={pct(latest?.costPerHeadKobo, previous?.costPerHeadKobo)}
              deltaLabel={previous ? `vs ${previous.period}` : undefined}
            />
            <StatCard
              icon={Coins}
              hue="mint"
              label="Paid out"
              value={latest ? nairaFromKobo(latest.netKobo) : "-"}
              hint="Net, into bank accounts"
            />
            <StatCard
              icon={Landmark}
              hue="grape"
              label="Employer contributions"
              value={latest ? nairaFromKobo(latest.employerCostKobo) : "-"}
              hint="On top of gross"
            />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="What payroll has cost"
              subtitle="Approved runs only. A draft is a working figure that will change."
              icon={LineChart}
            >
              <div className="-mt-1 mb-4 flex overflow-x-auto sm:justify-end">
                <Segmented label="Figure" options={METRICS} value={metric} onChange={setMetric} />
              </div>
              <AreaLine data={series} height={220} format={naira} caption={`${METRICS.find((m) => m.key === metric)?.label} by approved run`} />
              <div className="mt-3">
                <Legend items={[{ label: METRICS.find((m) => m.key === metric)?.label ?? "", hue: "blue" }]} />
              </div>
            </Panel>

            <Panel title="Headcount paid" subtitle="People on each approved run" icon={Users} hue="sky">
              <ColumnChart
                data={ordered.slice(-6).map((p) => ({ label: p.period, value: p.headcount }))}
                hue="sky"
                height={200}
                highlight="last"
                caption="Headcount by approved run"
              />
              {latest && (
                <div className="mt-5 border-t border-neutral-100 pt-4">
                  <StatusBars
                    caption={`How ${latest.period} was split`}
                    format={nairaFromKobo}
                    data={[
                      { label: "Net pay", value: latest.netKobo, hue: "mint" },
                      { label: "Deductions", value: latest.deductionsKobo, hue: "coral" },
                      { label: "Employer", value: latest.employerCostKobo, hue: "grape" },
                    ]}
                  />
                </div>
              )}
            </Panel>
          </div>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">Run by run</h2>
              <p className="text-sm text-neutral-500">The figures behind the charts.</p>
            </div>
            <DataView
              rows={ordered.slice().reverse()}
              columns={columns}
              rowKey={(p) => p.runId}
              storageKey="hrm.payroll.cost"
              caption="Payroll cost by approved run"
              searchPlaceholder="Search periods"
              renderCard={(p) => (
                <div className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">{p.period}</p>
                      <p className="text-xs text-neutral-500">{p.reference}</p>
                    </div>
                    <Chip hue="sky" icon={Users}>
                      {p.headcount}
                    </Chip>
                  </div>
                  <p className="text-2xl font-bold tracking-tight tabular-nums text-neutral-900">{nairaFromKobo(p.totalCostKobo)}</p>
                  <div className="mt-auto grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3">
                    <MiniStat label="Each" value={nairaFromKobo(p.costPerHeadKobo)} />
                    <MiniStat label="Paid out" value={nairaFromKobo(p.netKobo)} hue="mint" />
                  </div>
                </div>
              )}
            />
          </section>
        </>
      )}
    </div>
  );
}

/** Who is the money going to. A step of its own so the grant form is not two forms. */
function PickPersonDialog({
  people,
  onClose,
  onPicked,
}: {
  people: { id: string; name: string }[];
  onClose: () => void;
  onPicked: (person: { id: string; name: string }) => void;
}) {
  const [chosen, setChosen] = useState("");

  return (
    <ModalFrame
      title="Who is it for"
      icon={HandCoins}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={chosen === ""}
            onClick={() => {
              const person = people.find((p) => p.id === chosen);

              if (person !== undefined) onPicked(person);
            }}
          >
            Continue
          </Button>
        </>
      }
    >
      <SearchableSelect
        aria-label="Who is it for"
        value={chosen}
        onChange={setChosen}
        options={[
          { value: "", label: "Pick somebody…" },
          ...people.map((person) => ({ value: person.id, label: person.name })),
        ]}
      />
    </ModalFrame>
  );
}

/**
 * What this run did with overtime and leavers' settlements.
 *
 * - D6: overtime that needs approval is paid on approved days only. Days left
 *   out are listed (frozen with the run), so the person who was not paid for
 *   them is not the one who finds out.
 * - H15: a leaver's final settlement rides on the next run that pays them.
 */
export function RunExtras({ run }: { run: PayrollRun }) {
  const excluded = run.overtimeExcluded ?? { days: 0, minutes: 0, rows: [] };
  const settlements = run.finalSettlements ?? [];

  if (excluded.days === 0 && settlements.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {excluded.days > 0 && (
        <Panel
          title={`${excluded.days} unapproved ${excluded.days === 1 ? "day" : "days"} of overtime left out`}
          subtitle={`${formatMinutes(excluded.minutes)} not paid on this run because the timesheet was not approved when the figures were worked out.`}
          icon={Clock}
          hue="sun"
        >
          <ul className="divide-y divide-neutral-100 text-sm">
            {excluded.rows.map((r) => (
              <li key={`${r.employeeId}-${r.date}-${r.kind}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-neutral-800">{r.employeeName ?? "Unnamed"}</span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {formatDate(r.date)} · {formatMinutes(r.minutes)}
                </span>
              </li>
            ))}
          </ul>
          <p className={cx(hintCls, "mt-3")}>
            {run.isFrozen
              ? "Approving them now does not change this run. Pay them on an off-cycle run."
              : "Approve their timesheets, then work the figures out again to include them."}
          </p>
        </Panel>
      )}

      {settlements.length > 0 && (
        <Panel
          title="Final settlements on this run"
          subtitle="Leavers' settlements, paid as a taxable line on their payslip."
          icon={UserMinus}
          hue="grape"
        >
          <ul className="divide-y divide-neutral-100 text-sm">
            {settlements.map((s) => (
              <li key={s.payslipId} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-800">{s.employeeName}</span>
                  <span className="font-semibold tabular-nums text-neutral-900">{nairaFromKobo(s.amountKobo)}</span>
                </div>
                {s.note && <p className="mt-0.5 text-xs text-neutral-500">{s.note}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/** Leavers' settlements no run has paid yet (H15). */
function SettlementsWaiting({ rows }: { rows: NonNullable<PayrollReadiness["finalSettlementsWaiting"]> }) {
  return (
    <Panel
      title="Final settlements waiting"
      subtitle="Each goes on the next run that pays the person. Somebody who has already left gets a payslip for the settlement alone."
      icon={UserMinus}
      hue="grape"
    >
      <ul className="divide-y divide-neutral-100 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="font-medium text-neutral-800">{r.name ?? "Unnamed"}</span>
              <span className="ml-2 text-xs text-neutral-500">leaves {formatDate(r.leavingOn)}</span>
            </span>
            <span className="flex items-center gap-2">
              {!r.hasPayProfile && <ToneChip tone="warning">No pay profile: cannot be paid</ToneChip>}
              <span className="font-semibold tabular-nums text-neutral-900">{nairaFromKobo(r.amountKobo)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Check({
  ok,
  good,
  bad,
}: {
  ok: boolean;
  good: string;
  bad: string;
}) {
  return (
    <li
      className={cx(
        "flex items-start gap-2.5 rounded-xl border p-3.5 text-sm",
        ok ? "border-mint-100 bg-mint-50 text-mint-700" : "border-error-500/20 bg-error-500/10 text-error-700",
      )}
    >
      {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={17} className="mt-0.5 shrink-0" aria-hidden />}
      <span className="font-medium">{ok ? good : bad}</span>
    </li>
  );
}

function ExportPanel({ data }: { data: PayrollExport }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="Payment file"
        subtitle={`${data.bankFile.rows.length} payments · ${nairaFromKobo(data.bankFile.totalKobo)}`}
        icon={Banknote}
        hue="mint"
      >
        {data.bankFile.excluded.length === 0 ? (
          <Notice tone="success">Everybody on this run is in the file.</Notice>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {/*
              Named rather than dropped. A file quietly a row short is a file
              somebody uploads and only discovers on payday.
            */}
            {data.bankFile.excluded.map((row) => (
              <li key={row.payslipId} className="flex items-center justify-between gap-3 py-2.5">
                <PersonCell size={30} name={row.employeeName} sub={<span className="text-error-700">{row.reason}</span>} />
                <span className="shrink-0 text-sm tabular-nums text-neutral-700">{nairaFromKobo(row.netKobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Ledger journal"
        subtitle={
          data.journal.balanced
            ? `Balanced at ${nairaFromKobo(data.journal.debitKobo)}`
            : "Does not balance"
        }
        icon={Scale}
        hue={data.journal.balanced ? "sky" : "rose"}
      >
        <ul className="divide-y divide-neutral-100">
          {data.journal.lines.map((line) => (
            <li key={`${line.account}-${line.side}`} className="flex items-center gap-3 py-2">
              <span className="flex-1 truncate text-sm text-neutral-700">{line.account}</span>
              <Chip hue={line.side === "debit" ? "sky" : "grape"}>{line.side}</Chip>
              <span className="w-32 text-right tnum text-sm font-semibold text-neutral-900">
                {nairaFromKobo(line.amountKobo)}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-neutral-500">
          Produced from the same run as the payment file, so the two cannot
          disagree about what moved. XwiftHQ Finance will consume this when it
          ships.
        </p>
      </Panel>

      {data.remittances.length > 0 && (
        <Panel
          title="Still to remit"
          subtitle="The part of payroll that gets forgotten until a penalty notice arrives."
          icon={Landmark}
          hue="sun"
          className="lg:col-span-2"
        >
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.remittances.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3 rounded-xl border border-sun-100 bg-sun-50 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{row.name}</p>
                  <p className="truncate text-xs text-neutral-600">{row.authority}</p>
                </div>
                <span className="shrink-0 tnum text-sm font-bold text-neutral-900">{nairaFromKobo(row.amountKobo)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function OpenRunDialog({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (id: string) => void;
}) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      const run = await hrm.payroll.openRun({
        periodStart,
        periodEnd,
        payDate: payDate === "" ? undefined : payDate,
      });

      onOpened(run.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not open.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title="New payroll run"
      icon={Banknote}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Opening…" : "Open run"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>Period from</span>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Period to</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
            className={inputCls}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Pay date</span>
        <input
          type="date"
          value={payDate}
          onChange={(e) => setPayDate(e.target.value)}
          className={inputCls}
        />
        {/*
          Not a formality: the pay date chooses which tax bands apply, so a
          January run paid in February is taxed under February's rates.
        */}
        <span className={hintCls}>
          This picks the tax rates that apply. Defaults to the end of the
          period.
        </span>
      </label>

      {error !== null && <Notice tone="error">{error}</Notice>}
    </ModalFrame>
  );
}

function Loans() {
  const [rows, setRows] = useState<EmployeeLoan[] | null>(null);
  const [meta, setMeta] = useState<{
    outstandingKobo: number;
    suspended: number;
    monthlyRecoveryKobo: number;
    monthsToClear: number | null;
  } | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [granting, setGranting] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      hrm.payroll
        .loans()
        .then((res) => {
          setRows(res.data);
          setMeta(res.meta);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    hrm.employees
      .list({ perPage: 100 })
      .then((res) =>
        setPeople(
          res.data.map((e) => ({ id: e.id, name: e.person.name ?? "Unnamed" })),
        ),
      )
      .catch(() => {
        // A picker. Failing to load it should not stop the list working.
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (loan: EmployeeLoan, action: "suspend" | "resume") => {
    setBusy(loan.id);

    try {
      await hrm.payroll.updateLoan(loan.id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const actionButton = (loan: EmployeeLoan) => (
    <SoftButton
      hue={loan.isCollecting ? "sun" : "mint"}
      icon={loan.isCollecting ? PauseCircle : undefined}
      onClick={(e) => {
        e.stopPropagation();
        void act(loan, loan.isCollecting ? "suspend" : "resume");
      }}
      disabled={busy === loan.id}
    >
      {loan.isCollecting ? "Pause" : "Resume"}
    </SoftButton>
  );

  const status = (loan: EmployeeLoan) => (
    <Chip dot hue={loan.isCollecting ? "blue" : "sun"}>
      {loan.statusLabel}
    </Chip>
  );

  const columns: Column<EmployeeLoan>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (l) => l.employee?.name ?? "",
      render: (l) => <PersonCell name={l.employee?.name ?? "Unnamed"} sub={`${l.reference} · ${l.kindLabel}`} />,
    },
    {
      key: "left",
      header: "Left to recover",
      sortable: true,
      value: (l) => l.outstandingKobo,
      className: "min-w-[200px]",
      render: (l) => (
        <span className="block">
          <span className="text-sm font-semibold text-neutral-900">{nairaFromKobo(l.outstandingKobo)}</span>
          <span className="text-xs text-neutral-500"> of {nairaFromKobo(l.principalKobo)}</span>
          <span className="mt-1.5 block">
            <Progress value={l.progressPercent} hue={l.isCollecting ? "blue" : "sun"} size="sm" />
          </span>
        </span>
      ),
    },
    {
      key: "instalment",
      header: "A month",
      align: "right",
      sortable: true,
      value: (l) => l.instalmentKobo,
      render: (l) => (l.isCollecting ? nairaFromKobo(l.instalmentKobo) : "-"),
      hideOnMobile: true,
    },
    { key: "purpose", header: "What for", value: (l) => l.purpose, hideOnMobile: true },
    { key: "status", header: "Status", sortable: true, value: (l) => l.statusLabel, render: status },
    { key: "action", header: "", align: "right", tableOnly: true, render: actionButton },
  ];

  return (
    <div className="space-y-6">
      {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

      {meta !== null && (
        <StatGrid>
          <StatCard
            featured
            icon={Coins}
            label="Outstanding"
            value={nairaFromKobo(meta.outstandingKobo)}
            hint="Paused loans included, as they are still owed"
          />
          <StatCard
            icon={HandCoins}
            hue="mint"
            label="Recovered a month"
            value={nairaFromKobo(meta.monthlyRecoveryKobo)}
            hint="From the next approved run"
          />
          <StatCard
            icon={AlertTriangle}
            hue={meta.suspended > 0 ? "sun" : "slate"}
            label="Paused"
            value={String(meta.suspended)}
            hint={
              /*
                Null when nothing is being collected, which is itself the
                finding: an institution owed money and recovering none of it.
              */
              meta.monthsToClear === null
                ? "Nothing being recovered"
                : `${meta.monthsToClear} months to clear`
            }
          />
          <StatCard
            icon={Clock}
            hue="sky"
            label="Months to clear"
            value={meta.monthsToClear === null ? "-" : String(meta.monthsToClear)}
            hint="At the current rate"
          />
        </StatGrid>
      )}

      <Panel
        title="Loans and advances"
        subtitle="Collected when a run is approved, never below zero pay."
        icon={HandCoins}
        hue="coral"
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setPicking(true)}>
            Advance money
          </Button>
        }
      >
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(l) => l.id}
            storageKey="hrm.payroll.loans"
            caption="Loans and advances"
            searchPlaceholder="Search people or references"
            empty={
              <Empty
                icon={Coins}
                title="Nothing outstanding"
                hint="Advances and loans appear here until they are settled."
              />
            }
            renderCard={(l) => (
              <div className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell name={l.employee?.name ?? "Unnamed"} sub={l.reference} />
                  {status(l)}
                </div>
                <div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold tracking-tight tabular-nums text-neutral-900">{nairaFromKobo(l.outstandingKobo)}</span>
                    <span className="text-xs text-neutral-500">of {nairaFromKobo(l.principalKobo)} left</span>
                  </p>
                  <div className="mt-2">
                    <Progress value={l.progressPercent} hue={l.isCollecting ? "blue" : "sun"} />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {l.instalmentsPaid} of {l.instalmentsTotal} instalments
                    {l.isCollecting ? ` · ${nairaFromKobo(l.instalmentKobo)} a month` : ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <span className="min-w-0 truncate text-xs text-neutral-500">
                    {l.kindLabel}
                    {l.purpose ? ` · ${l.purpose}` : ""}
                  </span>
                  {actionButton(l)}
                </div>
              </div>
            )}
            renderListItem={(l) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {l.employee?.name ?? "Unnamed"} · {l.reference}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {l.kindLabel} · {nairaFromKobo(l.outstandingKobo)} of{" "}
                    {nairaFromKobo(l.principalKobo)} left
                    {l.isCollecting ? ` · ${nairaFromKobo(l.instalmentKobo)} a month` : ""}
                    {l.purpose ? ` · ${l.purpose}` : ""}
                  </p>
                </div>
                {status(l)}
                {actionButton(l)}
              </div>
            )}
          />
        )}
      </Panel>

      {picking && (
        <PickPersonDialog
          people={people}
          onClose={() => setPicking(false)}
          onPicked={(person) => {
            setPicking(false);
            setGranting(person);
          }}
        />
      )}

      {granting !== null && (
        <GrantLoanDialog
          employeeId={granting.id}
          employeeName={granting.name}
          onClose={() => setGranting(null)}
          onGranted={() => {
            setGranting(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
