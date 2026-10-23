"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  Download,
  HeartPulse,
  Hourglass,
  Network,
  PieChart,
  TrendingDown,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { hrm, type WorkforceInsights } from "@/lib/api/hrm-client";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";
import {
  Chip,
  PageHeader,
  Panel,
  Segmented,
  StatCard,
  StatGrid,
  buttonClass,
  cx,
} from "@/components/workspace/kit";
import { ColumnChart, Donut, SegmentedGauge, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import { LoadFailed, MiniStat, Notice, PageSkeleton, PastelCard, PersonCell } from "../ui2/kit";

/**
 * Turnover, tenure, absence, and what the untaken leave is worth.
 *
 * Separate from the overview dashboard, which answers "what needs me today".
 * Nothing here means anything over less than a quarter, and the default window
 * is twelve months because that is the period every published turnover
 * benchmark uses — a rate over a different span is not comparable to anything.
 *
 * Two things this board refuses to do. It never shows a single turnover figure
 * without its two halves beside it, because losing eight people to resignations
 * and losing eight to redundancy are different problems that one number
 * describes neither of. And it shows absence as a distribution rather than a
 * list of names: somebody with a chronic condition scores highly through no
 * fault of their own, and a ranking by absence is a list of people to manage
 * out dressed up as analysis.
 *
 * The hero chart switches *what* it breaks down rather than the period: the
 * window stays at twelve months for the reason above.
 */

type Lens = "tenure" | "leftTenure" | "leftDept" | "absenceDept";

const LENSES: { key: Lens; label: string }[] = [
  { key: "tenure", label: "Tenure" },
  { key: "leftTenure", label: "Leavers" },
  { key: "leftDept", label: "By team" },
  { key: "absenceDept", label: "Absence" },
];

interface DeptRow {
  department: string;
  leavers: number | null;
  ratePercent: number | null;
  absenceDays: number | null;
  spells: number | null;
  owedDays: number | null;
  owedKobo: number | null;
}

export default function WorkforceBoard() {
  const [data, setData] = useState<WorkforceInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("tenure");

  useEffect(() => {
    let cancelled = false;

    hrm.workforce
      .get()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const departments = useMemo<DeptRow[]>(() => {
    if (data === null) return [];
    const map = new Map<string, DeptRow>();
    const row = (department: string) => {
      let r = map.get(department);
      if (!r) {
        r = { department, leavers: null, ratePercent: null, absenceDays: null, spells: null, owedDays: null, owedKobo: null };
        map.set(department, r);
      }
      return r;
    };
    data.turnover.byDepartment.forEach((d) => {
      const r = row(d.department);
      r.leavers = d.leavers;
      r.ratePercent = d.ratePercent;
    });
    data.absence.byDepartment.forEach((d) => {
      const r = row(d.department);
      r.absenceDays = d.days;
      r.spells = d.spells;
    });
    data.leaveLiability.byDepartment.forEach((d) => {
      const r = row(d.department);
      r.owedDays = d.days;
      r.owedKobo = d.kobo;
    });
    return [...map.values()].sort((a, b) => a.department.localeCompare(b.department));
  }, [data]);

  const header = (sub?: React.ReactNode) => (
    <PageHeader
      title="Workforce"
      eyebrow="Analytics"
      subtitle={sub ?? "Turnover, tenure, absence and what the untaken leave is worth."}
      actions={
        data !== null ? (
          <a href={hrm.workforce.csvUrl()} className={buttonClass("primary")}>
            <Download size={17} aria-hidden />
            Download
          </a>
        ) : undefined
      }
    />
  );

  if (error !== null) {
    return (
      <div>
        {header()}
        <LoadFailed message={error} />
      </div>
    );
  }

  if (data === null) {
    return (
      <div>
        {header()}
        <PageSkeleton />
      </div>
    );
  }

  const { turnover, movement, tenure, spanOfControl, absence, leaveLiability } = data;

  const hero = (() => {
    switch (lens) {
      case "tenure":
        return {
          title: "How long people have been here",
          subtitle: "The shape matters more than the average.",
          caption: "Headcount by length of service",
          data: tenure.map((b) => ({ label: b.label, value: b.count })),
          empty: "Nobody on the books yet.",
          hue: "blue" as const,
        };
      case "leftTenure":
        return {
          title: "When in their tenure people left",
          subtitle: "Early leavers point at hiring and induction.",
          caption: "Leavers by length of service",
          data: turnover.byTenureBand.map((b) => ({ label: b.label, value: b.leavers })),
          empty: "Nobody left in this window.",
          hue: "coral" as const,
        };
      case "leftDept":
        return {
          title: "Where people left",
          subtitle: "Against each department's own size.",
          caption: "Leavers by department",
          data: turnover.byDepartment.map((d) => ({
            label: d.department,
            value: d.leavers,
            hue: d.ratePercent >= 20 ? ("sun" as const) : undefined,
          })),
          empty: "Nobody left in this window.",
          hue: "grape" as const,
        };
      default:
        return {
          title: "Unplanned absence by department",
          subtitle: "Days lost, not people named.",
          caption: "Absence days by department",
          data: absence.byDepartment.map((d) => ({ label: d.department, value: d.days })),
          empty: "No unplanned absence in this window.",
          hue: "sky" as const,
        };
    }
  })();

  const bradford = [
    { label: "Low", value: absence.bradford.low, hue: "mint" as const },
    { label: "Moderate", value: absence.bradford.moderate, hue: "sun" as const },
    { label: "High", value: absence.bradford.high, hue: "coral" as const },
    { label: "Very high", value: absence.bradford.veryHigh, hue: "rose" as const },
  ];

  const columns: Column<DeptRow>[] = [
    {
      key: "department",
      header: "Department",
      primary: true,
      sortable: true,
      value: (r) => r.department,
      render: (r) => (
        <span className="flex items-center gap-2.5 font-semibold text-neutral-900">
          <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", HUE[hueFor(r.department)].soft)}>
            <Building2 size={15} aria-hidden />
          </span>
          {r.department}
        </span>
      ),
    },
    { key: "leavers", header: "Leavers", align: "right", sortable: true, value: (r) => r.leavers },
    {
      key: "rate",
      header: "Turnover",
      align: "right",
      sortable: true,
      value: (r) => r.ratePercent,
      render: (r) =>
        r.ratePercent === null ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <Chip hue={r.ratePercent >= 20 ? "sun" : "slate"}>{r.ratePercent}%</Chip>
        ),
    },
    { key: "absence", header: "Absence days", align: "right", sortable: true, value: (r) => r.absenceDays, hideOnMobile: true },
    { key: "spells", header: "Spells", align: "right", sortable: true, value: (r) => r.spells, hideOnMobile: true },
    { key: "owed", header: "Leave owed", align: "right", sortable: true, value: (r) => r.owedDays, hideOnMobile: true },
    {
      key: "value",
      header: "Owed value",
      align: "right",
      sortable: true,
      value: (r) => r.owedKobo,
      render: (r) => (r.owedKobo === null ? <span className="text-neutral-400">-</span> : nairaFromKobo(r.owedKobo)),
    },
  ];

  const dash = (v: number | null) => (v === null ? "-" : v);

  return (
    <div className="space-y-6">
      {header(
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden />
          {formatDate(data.window.from)} to {formatDate(data.window.to)}
        </span>,
      )}

      {/* --------------------------- the headline -------------------- */}

      <StatGrid>
        <StatCard
          featured
          label="Turnover"
          value={`${turnover.ratePercent}%`}
          icon={Activity}
          hint={`${turnover.leavers} of ${turnover.averageHeadcount} average`}
        />
        {/*
          Never the headline on its own. A retention problem and a
          restructuring look identical in a combined figure.
        */}
        <StatCard
          label="Voluntary"
          value={`${turnover.voluntaryRatePercent}%`}
          icon={UserMinus}
          hue="coral"
          hint={`${turnover.voluntary} chose to go`}
        />
        <StatCard
          label="Involuntary"
          value={String(turnover.involuntary)}
          icon={TrendingDown}
          hue="grape"
          hint="Dismissal, redundancy, term ended"
        />
        <StatCard
          label="Net movement"
          value={`${movement.net >= 0 ? "+" : ""}${movement.net}`}
          icon={UserPlus}
          hue="mint"
          hint={`${movement.joiners} in, ${movement.leavers} out`}
        />
      </StatGrid>

      {/*
        The finding a headline rate hides. Losing people inside their first
        year is a hiring or an induction problem, and the fix is somewhere
        else entirely.
      */}
      {turnover.leftWithinFirstYear > 0 && (
        <Notice tone="warning">
          <h2 className="font-semibold text-neutral-900">
            {turnover.leftWithinFirstYear} of {turnover.leavers} leavers were
            here under a year
          </h2>
          <p className="mt-0.5 text-neutral-700">
            That is usually a hiring or an induction problem rather than a
            retention one, and the fix is somewhere else.
          </p>
        </Notice>
      )}

      {turnover.excludedDeathsInService > 0 && (
        <p className="text-xs text-neutral-500">
          {turnover.excludedDeathsInService} death
          {turnover.excludedDeathsInService === 1 ? "" : "s"} in service{" "}
          {turnover.excludedDeathsInService === 1 ? "is" : "are"} excluded from
          every rate above, as it is not a retention outcome.
        </p>
      )}

      {/* ------------------------- hero + split ---------------------- */}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title={hero.title}
          subtitle={hero.subtitle}
          icon={BarChart3}
        >
          {/* In the body rather than the title row, so it never squeezes the title on a phone. */}
          <div className="-mt-1 mb-4 flex overflow-x-auto sm:justify-end">
            <Segmented label="Break down by" options={LENSES} value={lens} onChange={setLens} />
          </div>
          {hero.data.length === 0 ? (
            <p className="py-16 text-center text-sm text-neutral-500">{hero.empty}</p>
          ) : (
            <div className="pt-6"><ColumnChart data={hero.data} hue={hero.hue} height={240} caption={hero.caption} /></div>
          )}
        </Panel>

        <Panel title="Why people left" subtitle="Two different problems, never one number." icon={PieChart} hue="coral">
          <div className="flex h-full flex-col justify-center gap-5">
            <Donut
              size={168}
              legend="below"
              caption="Leavers by reason"
              total={turnover.leavers}
              centerLabel="leavers"
              data={[
                { label: "Chose to go", value: turnover.voluntary, hue: "coral" },
                { label: "Asked to go", value: turnover.involuntary, hue: "grape" },
              ]}
            />
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-3">
              <MiniStat label="Start" value={turnover.headcountStart} />
              <MiniStat label="End" value={turnover.headcountEnd} />
              <MiniStat label="Average" value={turnover.averageHeadcount} hue="blue" />
            </div>
          </div>
        </Panel>
      </div>

      {/* ----------------------- leave liability -------------------- */}

      <Panel
        title="What the untaken leave is worth"
        subtitle="Money already earned. It lands on a final payslip whether or not anybody budgeted for it."
        icon={Wallet}
        hue="sun"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PastelCard hue="sun" icon={Hourglass} label="Days owed" value={String(leaveLiability.days)} />
          <PastelCard hue="mint" icon={Wallet} label="Value" value={nairaFromKobo(leaveLiability.kobo)} />
          <PastelCard hue="sky" icon={Users} label="People with a balance" value={String(leaveLiability.peopleWithBalance)} />
        </div>

        {/*
          Said out loud. Pretending the figure is complete would put a wrong
          number in front of a finance director.
        */}
        {leaveLiability.withoutSalary > 0 && (
          <Notice tone="warning" className="mt-4">
            {leaveLiability.withoutSalary}{" "}
            {leaveLiability.withoutSalary === 1 ? "person has" : "people have"} a
            balance and no salary on file, so the value above is an
            understatement.
          </Notice>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -------------------------- absence ----------------------- */}

        <Panel
          title="Absence"
          subtitle="Unplanned only. Booked leave is not an absence problem."
          icon={HeartPulse}
          hue="rose"
        >
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <SegmentedGauge
              value={absence.ratePercent}
              max={10}
              hue="rose"
              label="Absence rate"
              display={`${absence.ratePercent}%`}
              caption="Scale runs to 10%"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 p-3">
                <MiniStat label="Days" value={String(absence.totalDays)} />
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <MiniStat label="Spells" value={String(absence.spells)} />
              </div>
              {absence.peopleAffected !== undefined && (
                <div className="col-span-2 rounded-xl bg-neutral-50 p-3">
                  <MiniStat label="People affected" value={String(absence.peopleAffected)} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Bradford distribution
            </p>
            <StatusBars data={bradford} caption="People by Bradford band" />
            {/*
              The caveat belongs on the screen, not in a footnote somebody
              never reads. Bradford is a blunt instrument and a high score is
              often a chronic condition.
            */}
            <p className="mt-3 text-xs text-neutral-500">
              Bradford weights frequent short absences far more heavily than one
              long one. A high score is often a health condition rather than a
              conduct issue. It is a prompt to ask, not a finding.
            </p>
          </div>
        </Panel>

        {/* --------------------- span of control -------------------- */}

        <Panel
          title="Span of control"
          subtitle={`Average ${spanOfControl.averageSpan} across ${spanOfControl.managers} managers.`}
          icon={Network}
          hue="grape"
        >
          <div className="flex flex-col items-center">
            <SegmentedGauge
              value={spanOfControl.averageSpan}
              max={Math.max(spanOfControl.wideSpanThreshold, spanOfControl.widestSpan, 1)}
              hue="grape"
              label="Average direct reports"
              display={String(spanOfControl.averageSpan)}
              caption={`Widest ${spanOfControl.widestSpan} · flagged above ${spanOfControl.wideSpanThreshold}`}
            />
          </div>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            {spanOfControl.wideSpans.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nobody is carrying more than {spanOfControl.wideSpanThreshold}{" "}
                direct reports.
              </p>
            ) : (
              <ul className="space-y-3">
                {spanOfControl.wideSpans.map((row) => (
                  <li key={row.managerId} className="flex items-center justify-between gap-3">
                    <PersonCell name={row.name ?? "Unnamed"} sub="Manager" size={32} />
                    <Chip hue="sun">{row.reports} reports</Chip>
                  </li>
                ))}
              </ul>
            )}

            {/*
              More than one person reporting to nobody is an org chart somebody
              stopped maintaining, which quietly breaks every approval that
              routes to a manager.
            */}
            {spanOfControl.unmanaged > 1 && (
              <Notice tone="warning" className="mt-4">
                {spanOfControl.unmanaged} people report to nobody. Approvals that
                route to a manager will not reach one.
              </Notice>
            )}
          </div>
        </Panel>
      </div>

      {/* ------------------------- the figures ----------------------- */}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">By department</h2>
          <p className="text-sm text-neutral-500">The numbers behind the charts, one row per department.</p>
        </div>
        <DataView
          rows={departments}
          columns={columns}
          rowKey={(r) => r.department}
          storageKey="hrm.workforce.departments"
          caption="Turnover, absence and leave liability by department"
          searchPlaceholder="Search departments"
          empty={
            <p className="px-6 py-12 text-center text-sm text-neutral-500">
              No department figures in this window yet.
            </p>
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", HUE[hueFor(r.department)].soft)}>
                  <Building2 size={18} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{r.department}</p>
                  <p className="text-xs text-neutral-500">{dash(r.leavers)} leavers</p>
                </div>
                {r.ratePercent !== null && <Chip hue={r.ratePercent >= 20 ? "sun" : "slate"}>{r.ratePercent}%</Chip>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Absence" value={`${dash(r.absenceDays)} d`} hue="rose" />
                <MiniStat label="Spells" value={dash(r.spells)} />
                <MiniStat label="Owed" value={`${dash(r.owedDays)} d`} hue="sun" />
              </div>
              <p className="mt-auto border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                Leave value <span className="font-semibold text-neutral-800">{r.owedKobo === null ? "-" : nairaFromKobo(r.owedKobo)}</span>
              </p>
            </div>
          )}
        />
      </section>
    </div>
  );
}
