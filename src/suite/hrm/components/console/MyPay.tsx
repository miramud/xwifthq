"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, BarChart3, Coins, FileText, Landmark, Receipt, Wallet } from "lucide-react";
import {
  hrm,
  type EmployeeLoan,
  type Payslip,
  type PayslipLine,
} from "@/lib/api/hrm-client";
import {
  Button,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Progress,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart } from "@/components/workspace/charts";
import { LoadFailed, Notice, PageSkeleton, Skeleton, StackBar } from "@/suite/hrm/components/ui2/kit";
import { SectionHead } from "@/suite/hrm/components/ui2/me-kit";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";

/**
 * My payslips, and what I owe.
 *
 * Only released payslips appear. A run that has been approved but not yet
 * distributed is still being checked, and somebody reading a figure that then
 * changes is a conversation nobody wants.
 *
 * The itemisation is the point of the screen. A deduction somebody cannot
 * account for is the single most common payroll query, and every line carries
 * how it was worked out — "8% of 500,000.00" — so the answer is on the payslip
 * rather than in somebody's inbox.
 */
export default function MyPay() {
  const [payslips, setPayslips] = useState<Payslip[] | null>(null);
  const [totals, setTotals] = useState<{
    grossThisYearKobo: number;
    payeThisYearKobo: number;
  } | null>(null);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [owed, setOwed] = useState({ outstandingKobo: 0, monthlyKobo: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([hrm.me.payslips(), hrm.me.loans()])
        .then(([slips, loanRes]) => {
          setPayslips(slips.data);
          setTotals(slips.meta);
          setLoans(loanRes.data);
          setOwed(loanRes.meta);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      eyebrow="My employment"
      title="My pay"
      subtitle="Your released payslips, line by line, and anything being repaid from them"
    />
  );

  if (error !== null && payslips === null) {
    return (
      <div>
        {header}
        <LoadFailed icon={Receipt} title="Could not load your pay" message={error} />
      </div>
    );
  }

  if (payslips === null) {
    return <PageSkeleton stats={3} />;
  }

  const latest = payslips[0];
  const toggle = (id: string) => setOpen(open === id ? null : id);

  // Oldest first, so the chart reads left to right.
  const seen = new Map<string, number>();
  const chart = [...payslips].reverse().map((slip) => {
    const anchor = slip.period?.end ?? slip.distributedAt;
    const base = anchor
      ? new Date(anchor).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
      : "—";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { label: n > 1 ? `${base} (${n})` : base, value: Math.round(slip.netKobo / 100) };
  });

  const breakdownButton = (slip: Payslip) => (
    <Button size="sm" variant={open === slip.id ? "ghost" : "secondary"} icon={FileText} onClick={() => toggle(slip.id)} aria-expanded={open === slip.id}>
      {open === slip.id ? "Hide" : "Breakdown"}
    </Button>
  );

  const columns: Column<Payslip>[] = [
    {
      key: "date",
      header: "Pay period",
      primary: true,
      sortable: true,
      value: (s) => s.period?.end ?? s.distributedAt,
      render: (s) => (
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
            <Receipt size={16} aria-hidden />
          </span>
          <button
            type="button"
            onClick={() => toggle(s.id)}
            className="cursor-pointer text-left text-sm font-semibold text-neutral-900 hover:text-primary-700"
          >
            {payslipTitle(s)}
          </button>
        </span>
      ),
    },
    { key: "gross", header: "Gross", align: "right", sortable: true, value: (s) => s.grossKobo, render: (s) => nairaFromKobo(s.grossKobo) },
    {
      key: "deducted",
      header: "Deducted",
      align: "right",
      sortable: true,
      value: (s) => s.totalDeductionsKobo,
      render: (s) => <span className="text-coral-700">{nairaFromKobo(s.totalDeductionsKobo)}</span>,
    },
    {
      key: "net",
      header: "Net pay",
      align: "right",
      sortable: true,
      value: (s) => s.netKobo,
      render: (s) => <span className="font-bold text-neutral-900">{nairaFromKobo(s.netKobo)}</span>,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: breakdownButton },
  ];

  return (
    <div className="space-y-6">
      {header}

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <StatGrid cols={3}>
        <StatCard
          featured
          icon={Banknote}
          label="Last net pay"
          value={latest === undefined ? "—" : nairaFromKobo(latest.netKobo)}
          hint={latest === undefined ? undefined : payslipTitle(latest)}
        />
        <StatCard
          icon={Receipt}
          hue="mint"
          label="Gross this year"
          value={nairaFromKobo(totals?.grossThisYearKobo ?? 0)}
          hint={`${nairaFromKobo(totals?.payeThisYearKobo ?? 0)} tax`}
        />
        <StatCard
          icon={Coins}
          hue={owed.outstandingKobo > 0 ? "coral" : "slate"}
          label="Owed"
          value={nairaFromKobo(owed.outstandingKobo)}
          hint={
            owed.monthlyKobo > 0
              ? `${nairaFromKobo(owed.monthlyKobo)} a month`
              : "Nothing being deducted"
          }
        />
      </StatGrid>

      {payslips.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Net pay by payslip" subtitle="What reached your account each time" icon={BarChart3} hue="sun">
            <ColumnChart
              data={chart}
              hue="sun"
              height={190}
              highlight="last"
              format={(v) => nairaFromKobo(v * 100)}
              caption="Net pay on each released payslip"
            />
          </Panel>
          {latest !== undefined && (
            <Panel title="Where the last one went" subtitle={payslipTitle(latest)} icon={Wallet} hue="mint">
              <p className="text-xs text-neutral-500">Gross</p>
              <p className="mb-4 text-2xl font-bold tabular-nums text-neutral-900">{nairaFromKobo(latest.grossKobo)}</p>
              <StackBar
                label="The last payslip"
                total={latest.grossKobo}
                format={(v) => nairaFromKobo(v)}
                parts={[
                  { label: "Take-home", value: latest.netKobo, hue: "mint" },
                  { label: "Deducted", value: latest.totalDeductionsKobo, hue: "coral" },
                ]}
              />
            </Panel>
          )}
        </div>
      )}

      <section aria-labelledby="payslips-heading">
        <SectionHead id="payslips-heading" title="My payslips" subtitle="Open one to see every line and how it was worked out" />
        {payslips.length === 0 ? (
          <Card>
            <Empty
              icon={Receipt}
              hue="sun"
              title="No payslips yet"
              hint="A payslip appears here once the run it belongs to has been released."
            />
          </Card>
        ) : (
          <DataView<Payslip>
            rows={payslips}
            rowKey={(s) => s.id}
            columns={columns}
            storageKey="hrm.me.pay"
            caption="Your payslips"
            searchable={false}
            renderCard={(s) => (
              <div className={cx("flex h-full flex-col gap-3 p-5", open === s.id && "bg-sun-50/50")}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sun-50 text-sun-700">
                    <Receipt size={18} aria-hidden />
                  </span>
                  <Chip hue="mint" dot>
                    Released
                  </Chip>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{payslipTitle(s)}</p>
                  <p className="text-2xl font-bold tabular-nums text-neutral-900">{nairaFromKobo(s.netKobo)}</p>
                </div>
                <p className="text-xs text-neutral-500">
                  {nairaFromKobo(s.grossKobo)} gross · {nairaFromKobo(s.totalDeductionsKobo)} deducted
                </p>
                <div className="mt-auto">{breakdownButton(s)}</div>
              </div>
            )}
            renderListItem={(s) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{payslipTitle(s)}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {nairaFromKobo(s.grossKobo)} gross · {nairaFromKobo(s.totalDeductionsKobo)} deducted
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-neutral-900">{nairaFromKobo(s.netKobo)}</span>
                {breakdownButton(s)}
              </div>
            )}
          />
        )}
      </section>

      {open !== null && <Breakdown payslipId={open} />}

      {loans.length > 0 && (
        <section aria-labelledby="owe-heading">
          <SectionHead
            id="owe-heading"
            title="What I owe"
            subtitle="Shown here so a deduction on your payslip is never a surprise."
          />
          <DataView<EmployeeLoan>
            rows={loans}
            rowKey={(l) => l.id}
            storageKey="hrm.me.loans"
            caption="What you owe"
            searchable={false}
            gridCols={2}
            columns={[
              {
                key: "loan",
                header: "Loan",
                primary: true,
                value: (l) => `${l.kindLabel} · ${l.reference}`,
                render: (l) => <span className="font-semibold text-neutral-900">{`${l.kindLabel} · ${l.reference}`}</span>,
              },
              {
                key: "left",
                header: "Left to repay",
                align: "right",
                value: (l) => l.outstandingKobo,
                render: (l) => `${nairaFromKobo(l.outstandingKobo)} left of ${nairaFromKobo(l.principalKobo)}`,
              },
              {
                key: "monthly",
                header: "Each month",
                align: "right",
                value: (l) => (l.isCollecting ? l.instalmentKobo : null),
                render: (l) => (l.isCollecting ? nairaFromKobo(l.instalmentKobo) : "—"),
              },
              {
                key: "paid",
                header: "Instalments",
                value: (l) => l.instalmentsPaid,
                render: (l) => `${l.instalmentsPaid} of ${l.instalmentsTotal} paid`,
              },
              {
                key: "status",
                header: "Status",
                value: (l) => l.statusLabel,
                render: (l) => (
                  <Chip hue={l.isCollecting ? "blue" : "sun"} dot>
                    {l.statusLabel}
                  </Chip>
                ),
              },
            ]}
            renderCard={(l) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-50 text-coral-700">
                    <Landmark size={18} aria-hidden />
                  </span>
                  <Chip hue={l.isCollecting ? "blue" : "sun"} dot>
                    {l.statusLabel}
                  </Chip>
                </div>
                <p className="text-[15px] font-semibold text-neutral-900">{`${l.kindLabel} · ${l.reference}`}</p>
                <p className="text-xs text-neutral-500">
                  {nairaFromKobo(l.outstandingKobo)} left of {nairaFromKobo(l.principalKobo)}
                  {l.isCollecting ? ` · ${nairaFromKobo(l.instalmentKobo)} a month` : ""}
                </p>
                <div className="mt-auto">
                  <Progress value={l.progressPercent} hue="coral" />
                  <p className="mt-1.5 text-xs text-neutral-600">{`${l.instalmentsPaid} of ${l.instalmentsTotal} paid`}</p>
                </div>
              </div>
            )}
          />
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Breakdown({ payslipId }: { payslipId: string }) {
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.me
      .payslip(payslipId)
      .then((res) => {
        if (cancelled) return;
        setPayslip(res);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [payslipId]);

  if (error !== null) {
    return <Notice tone="error">{error}</Notice>;
  }

  if (payslip === null) {
    return <Skeleton className="h-56" />;
  }

  const earnings = (payslip.lines ?? []).filter((l) => l.kind === "earning");
  const deductions = (payslip.lines ?? []).filter((l) => l.kind === "deduction");
  const employer = (payslip.lines ?? []).filter(
    (l) => l.kind === "employer_contribution",
  );

  return (
    <Panel
      title="Payslip breakdown"
      subtitle={`${payslipTitle(payslip)}${payslip.jobTitle ? ` · ${payslip.jobTitle}` : ""}`}
      icon={FileText}
      hue="sun"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-mint-100 bg-mint-50/50 p-4">
          <Group title="Earnings" lines={earnings} basic={payslip.basicKobo} />
        </div>
        <div className="rounded-2xl border border-coral-100 bg-coral-50/50 p-4">
          <Group title="Deductions" lines={deductions} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 text-white">
        <span className="text-sm font-semibold text-white/90">Net pay</span>
        <span className="text-2xl font-bold tabular-nums">{nairaFromKobo(payslip.netKobo)}</span>
      </div>

      {employer.length > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-neutral-700">
            Paid by your employer, on top of your salary
          </p>
          {/*
            Shown without a minus. These are not charged to the employee, and
            printing them beside their own deductions is how somebody concludes
            they were.
          */}
          {employer.map((line) => (
            <div key={line.id} className="flex items-baseline justify-between text-sm">
              <span className="text-neutral-600">{line.name}</span>
              <span className="tabular-nums text-neutral-800">{nairaFromKobo(line.amountKobo)}</span>
            </div>
          ))}
        </div>
      )}

      {payslip.hasShortfall && (
        <Notice tone="warning" className="mt-4">
          {nairaFromKobo(payslip.uncollectedKobo)} could not be deducted this
          month without taking your pay below zero. It has not been written off
          — speak to HR.
        </Notice>
      )}
    </Panel>
  );
}

function Group({
  title,
  lines,
  basic,
}: {
  title: string;
  lines: PayslipLine[];
  basic?: number;
}) {
  if (lines.length === 0 && basic === undefined) return null;

  const total =
    lines.reduce((sum, line) => sum + line.amountKobo, 0) + (basic ?? 0);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between border-b border-neutral-200/70 pb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">
          {title}
        </span>
        <span className="text-base font-bold tabular-nums text-neutral-900">
          {nairaFromKobo(total)}
        </span>
      </div>

      <ul className="space-y-1.5">
        {basic !== undefined && (
          <li className="flex items-baseline justify-between text-sm">
            <span className="text-neutral-700">Basic salary</span>
            <span className="tabular-nums text-neutral-900">{nairaFromKobo(basic)}</span>
          </li>
        )}

        {lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 flex-1 text-sm text-neutral-700">
              {line.name}
              {/*
                How the figure was arrived at. The only question anybody ever
                asks about a payslip line.
              */}
              {line.basisNote !== null && (
                <span className="ml-2 text-xs text-neutral-500">{line.basisNote}</span>
              )}
            </span>
            <span className="tabular-nums text-sm text-neutral-900">{nairaFromKobo(line.amountKobo)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "August 2026 · paid 28 Aug".
 *
 * The month a payslip pays for and the day the money moved. The release date
 * (`distributedAt`) is neither — it is when HR made the payslip visible — so
 * it is only the last fallback, and labelled as a release, never as payment.
 */
export function payslipTitle(slip: Payslip): string {
  const period = slip.period ?? null;
  if (period === null) {
    return slip.distributedAt ? `Released ${formatDate(slip.distributedAt)}` : "Payslip";
  }

  const start = new Date(period.start);
  const end = new Date(period.end);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const label = sameMonth
    ? end.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : `${formatDate(period.start)} – ${formatDate(period.end)}`;

  const short = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  if (period.paidOn !== null) return `${label} · paid ${short(period.paidOn)}`;
  if (period.payDate !== null) return `${label} · pay date ${short(period.payDate)}`;
  return label;
}
