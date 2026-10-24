"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Flag,
  Gauge,
  Minus,
  Plus,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  AttainmentDistribution,
  KpiSeriesChart,
  RatingHistory,
  bandHue,
} from "@/suite/hrm/components/console/PerformanceCharts";
import {
  hrm,
  type CohortPerformance,
  type EmployeePerformance,
  type KpiDetail,
} from "@/lib/api/hrm-client";
import TargetsDue from "./TargetsDue";
import {
  KpiDialog,
  KpiStatusDialog,
  MilestoneDialog,
  MilestoneStatusDialog,
  RecordReadingDialog,
} from "./PerformanceActions";
import { formatDate } from "@/suite/hrm/lib/format";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  Progress,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { ColumnChart, Legend, SegmentedGauge } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, type Hue } from "@/components/workspace/modules";
import { LoadFailed, MiniStat, Notice, PageSkeleton, PastelCard, PersonCell, SoftButton } from "../ui2/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { richExcerpt } from "@/lib/richText";

/**
 * How the institution is performing, and then how one person is.
 *
 * The rule the whole screen follows: **an unmeasured target is not a failing
 * one.** Somebody with nine KPIs and no readings ranks last, not zero, and the
 * count of measured targets is printed beside every attainment figure so a
 * number is never read as covering more than it does.
 */

type Person = CohortPerformance["people"][number];

/** The hue of an attainment figure: met, on track, behind, never red for "not measured". */
function attainmentHue(value: number | null): Hue {
  if (value === null) return "slate";
  if (value >= 100) return "mint";
  if (value >= 80) return "sky";
  return "sun";
}

export default function PerformanceBoard() {
  const [cohort, setCohort] = useState<CohortPerformance | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeePerformance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"cohort" | "due">("cohort");
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hrm.performance
      .cohort()
      .then((result) => {
        setCohort(result);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const open = useCallback((employeeId: string) => {
    setSelected(employeeId);
    setDetail(null);

    hrm.performance
      .forEmployee(employeeId)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Bring the person into view once they have loaded, the list can be long.
  useEffect(() => {
    if (detail !== null) detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [detail?.employee.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Two jobs, two views. Opening a person answers "how is she doing";
    only a list across everybody answers "what is about to be missed",
    and that is the one with a date on it.
  */
  const header = (
    <PageHeader
      title="Performance"
      subtitle="Targets, attainment and milestones. An unmeasured target is never a failing one."
      tabs={[
        { key: "cohort", label: "People" },
        { key: "due", label: "Falling due" },
      ]}
      activeTab={view}
      onTab={(k) => setView(k as "cohort" | "due")}
    />
  );

  if (error !== null && cohort === null) {
    return (
      <div>
        {header}
        <LoadFailed message={error} icon={Target} />
      </div>
    );
  }

  if (cohort === null) {
    return (
      <div>
        {header}
        <PageSkeleton />
      </div>
    );
  }

  const behind = cohort.distribution
    .filter((b) => b.label.startsWith("Under") || b.label.startsWith("50"))
    .reduce((sum, b) => sum + b.people, 0);
  const met = cohort.distribution
    .filter((b) => bandHue(b.label) === "mint")
    .reduce((sum, b) => sum + b.people, 0);

  const columns: Column<Person>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (p) => p.name ?? "",
      render: (p) => <PersonCell name={p.name ?? "Unnamed"} sub={p.jobTitle} />,
    },
    { key: "department", header: "Department", sortable: true, value: (p) => p.department, hideOnMobile: true },
    {
      key: "measured",
      header: "Measured",
      sortable: true,
      value: (p) => p.measured,
      render: (p) => (
        <span className="tabular-nums text-neutral-600">
          {p.measured} of {p.total} measured
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "attainment",
      header: "Attainment",
      sortable: true,
      value: (p) => p.attainment,
      className: "min-w-[180px]",
      render: (p) =>
        p.attainment === null ? (
          <span className="text-xs text-neutral-500">Not measured</span>
        ) : (
          <span className="flex items-center gap-3">
            <span className="flex-1">
              <Progress value={Math.min(100, p.attainment)} hue={attainmentHue(p.attainment)} size="sm" />
            </span>
            <span className={cx("w-12 text-right text-sm font-bold tabular-nums", HUE[attainmentHue(p.attainment)].text)}>
              {p.attainment}%
            </span>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      {view === "due" && <TargetsDue />}

      {view === "cohort" && (
        <>
          {error !== null && <Notice tone="error" role="alert">{error}</Notice>}

          {/* ------------------------- the institution ------------------- */}

          <StatGrid>
            <StatCard
              featured
              icon={Target}
              label="Median attainment"
              value={cohort.summary.median === null ? "-" : `${cohort.summary.median}%`}
              /*
                Mean beside median on purpose. They disagree, one person at 140%
                among four at 50% is a mean of 72 and a median of 50, and the
                disagreement is the useful part.
              */
              hint={cohort.summary.mean === null ? "Nothing measured" : `Mean ${cohort.summary.mean}%`}
            />
            <StatCard
              icon={Users}
              hue="sky"
              label="People measured"
              value={`${cohort.summary.measured}`}
              hint={`of ${cohort.summary.total} with targets`}
            />
            <StatCard icon={Trophy} hue="mint" label="Met or beat" value={String(met)} hint="100% of target or more" />
            <StatCard icon={TrendingDown} hue="sun" label="Behind" value={String(behind)} hint="Under 80% of target" />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Spread"
              subtitle="Where each band starts is where a manager's reaction changes"
              icon={BarChart3}
              actions={
                <Legend
                  items={[
                    { label: "Behind", hue: "sun" },
                    { label: "On track", hue: "sky" },
                    { label: "Met", hue: "mint" },
                  ]}
                />
              }
            >
              {cohort.distribution.length === 0 ? (
                <p className="py-16 text-center text-sm text-neutral-500">Nothing measured yet.</p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="pt-6">
                  <ColumnChart
                    height={220}
                    caption="People in each attainment band"
                    data={cohort.distribution.map((b) => ({ label: b.label, value: b.people, hue: bandHue(b.label) }))}
                  />
                  </div>
                  <AttainmentDistribution bands={cohort.distribution} />
                </div>
              )}
            </Panel>

            <Panel title="Organisation score" subtitle="Median of everyone measured" icon={Gauge} hue="grape">
              <div className="flex h-full flex-col items-center justify-center gap-5">
                <SegmentedGauge
                  value={Math.min(100, cohort.summary.median ?? 0)}
                  hue={attainmentHue(cohort.summary.median)}
                  label="Median attainment"
                  display={cohort.summary.median === null ? "-" : `${cohort.summary.median}%`}
                />
                <div className="grid w-full grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-3 text-center">
                  <MiniStat label="Mean" value={cohort.summary.mean === null ? "-" : `${cohort.summary.mean}%`} />
                  <MiniStat label="Measured" value={cohort.summary.measured} />
                  <MiniStat label="With targets" value={cohort.summary.total} />
                </div>
              </div>
            </Panel>
          </div>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold tracking-tight text-neutral-900">Where everybody stands</h2>
              <p className="text-sm text-neutral-500">
                Highest first. People with nothing measured go last, not bottom. Open somebody to see their targets.
              </p>
            </div>
            <DataView
              rows={cohort.people}
              columns={columns}
              rowKey={(p) => p.employeeId}
              storageKey="hrm.performance.people"
              caption="Attainment by person"
              searchPlaceholder="Search people"
              onRowClick={(p) => open(p.employeeId)}
              empty={
                <Empty
                  icon={Target}
                  title="No targets set"
                  hint="Set a KPI against somebody and their standing appears here."
                />
              }
              renderCard={(p) => (
                <div className={cx("flex h-full flex-col gap-4 rounded-[1.25rem] p-5", selected === p.employeeId && "ring-2 ring-primary-300")}>
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={p.name ?? "Unnamed"} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-neutral-900">{p.name ?? "Unnamed"}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {p.jobTitle}
                        {p.department ? ` · ${p.department}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-neutral-900">
                      {p.attainment === null ? "-" : `${p.attainment}%`}
                    </p>
                    <Chip hue={attainmentHue(p.attainment)}>
                      {p.measured} of {p.total} measured
                    </Chip>
                  </div>
                  <Progress value={Math.min(100, p.attainment ?? 0)} hue={attainmentHue(p.attainment)} />
                </div>
              )}
              renderListItem={(p) => (
                <div className={cx("flex items-center gap-4 px-5 py-3", selected === p.employeeId && "bg-primary-50/60")}>
                  <div className="min-w-0 flex-1">
                    <PersonCell name={p.name ?? "Unnamed"} sub={`${p.jobTitle}${p.department ? ` · ${p.department}` : ""}`} />
                  </div>
                  <span className="hidden shrink-0 text-xs text-neutral-500 tabular-nums sm:inline">
                    {p.measured} of {p.total} measured
                  </span>
                  <span className="w-28 shrink-0">
                    <Progress value={Math.min(100, p.attainment ?? 0)} hue={attainmentHue(p.attainment)} size="sm" />
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-neutral-900">
                    {p.attainment === null ? "-" : `${p.attainment}%`}
                  </span>
                </div>
              )}
            />
          </section>

          {/* --------------------------- one person ---------------------- */}

          {selected !== null && (
            <div ref={detailRef} className="scroll-mt-6 space-y-6">
              {detail === null ? (
                <PageSkeleton stats={2} />
              ) : (
                <PersonDetail detail={detail} onChanged={() => open(selected)} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The readings behind the line, and a way to take one back out.
 *
 * `DELETE /hrm/measurements/{id}` had no caller, and could not have had one:
 * the series a chart is drawn from carried no measurement id, so nothing in
 * the product could name a reading. Recording was built and un-recording was
 * not, which leaves a manager who typed 1,000 instead of 100 with a target
 * permanently at 1000% and a conversation to have about it.
 *
 * Folded away by default. The chart is what somebody came for; the list is
 * what they open when a point on it is wrong.
 *
 * Deleting confirms first and says what it moves, because the figure this
 * changes is the one a review gets argued over, and it is audited on the way
 * out, so a removed reading is not a silent edit to somebody's record.
 */
function Readings({
  kpi,
  onChanged,
}: {
  kpi: KpiDetail;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (kpi.series.length === 0) return null;

  const remove = async (id: string) => {
    const point = kpi.series.find((p) => p.id === id);
    const ok = await confirm({
      title: point ? `Remove the reading from ${point.label}?` : "Remove this reading?",
      body: "The attainment figure moves, and the removal is recorded in the audit log. The reading goes to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Remove reading",
      recoverable: true,
    });
    if (!ok) return;

    setBusy(id);
    setProblem(null);

    try {
      await hrm.performance.removeMeasurement(id);
      onChanged();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 border-t border-neutral-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800"
      >
        {open ? "Hide" : "Show"} {kpi.series.length} reading
        {kpi.series.length === 1 ? "" : "s"}
      </button>

      {open && (
        <>
          {problem !== null && (
            <Notice tone="error" className="mt-2 text-xs">
              {problem}
            </Notice>
          )}

          <ul className="mt-2 space-y-1">
            {[...kpi.series].reverse().map((point) => (
              <li
                key={point.id}
                className="flex flex-wrap items-center gap-2 rounded-xl px-2.5 py-2 text-xs hover:bg-neutral-50"
              >
                <span className="w-16 shrink-0 text-neutral-500">
                  {point.label}
                </span>
                <span className="font-semibold tabular-nums text-neutral-800">
                  {point.value}
                  {kpi.unit !== null && kpi.unit !== "" ? ` ${kpi.unit}` : ""}
                </span>
                <span className="tabular-nums text-neutral-500">
                  {point.attainment}%
                </span>

                {point.note !== null && point.note !== "" && (
                  <span className="min-w-0 flex-1 truncate text-neutral-500">
                    {richExcerpt(point.note, 200)}
                  </span>
                )}

                <button
                  type="button"
                  disabled={busy === point.id}
                  onClick={() => void remove(point.id)}
                  aria-label={`Remove the reading from ${point.label}`}
                  className="ml-auto rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-error-500/10 hover:text-error-700 disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Said once, under the list, rather than in every confirmation. */}
          <p className="mt-2 text-[11px] text-neutral-500">
            Removing a reading is recorded in the audit log.
          </p>
        </>
      )}
    </div>
  );
}

type MilestoneItem = EmployeePerformance["milestones"]["items"][number];

function PersonDetail({
  detail,
  onChanged,
}: {
  detail: EmployeePerformance;
  onChanged: () => void;
}) {
  const { employee, summary, kpis, milestones, reviews } = detail;

  const [settingKpi, setSettingKpi] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiDetail | null>(null);
  const [readingFor, setReadingFor] = useState<KpiDetail | null>(null);
  const [statusFor, setStatusFor] = useState<KpiDetail | null>(null);
  const [settingMilestone, setSettingMilestone] = useState(false);
  const [milestoneFor, setMilestoneFor] = useState<MilestoneItem | null>(null);

  const milestoneStatus = (m: MilestoneItem) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {/*
        Late-but-delivered is its own label. "90% of milestones hit"
        reads very differently once you know half landed late.
      */}
      {m.wasLate && <Chip hue="sun">{m.daysLate}d late</Chip>}
      {m.isOverdue && <Chip hue="rose">Overdue</Chip>}
      <Chip dot hue={m.status === "achieved" ? "mint" : m.status === "missed" ? "rose" : "slate"}>
        {m.statusLabel}
      </Chip>
    </span>
  );

  const milestoneColumns: Column<MilestoneItem>[] = [
    {
      key: "title",
      header: "Milestone",
      primary: true,
      sortable: true,
      value: (m) => m.title,
      render: (m) => <span className="font-semibold text-neutral-900">{m.title}</span>,
    },
    {
      key: "due",
      header: "Due",
      sortable: true,
      value: (m) => m.dueOn,
      render: (m) => (
        <span className="text-neutral-600">
          {formatDate(m.dueOn)}
          {m.achievedOn ? ` · delivered ${formatDate(m.achievedOn)}` : ""}
        </span>
      ),
    },
    { key: "status", header: "Status", value: (m) => m.statusLabel, render: milestoneStatus },
  ];

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-primary-50 to-white px-6 py-5">
          <div className="flex items-center gap-4">
            <PersonAvatar name={employee.name ?? "Unnamed"} size={56} />
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">{employee.name ?? "Unnamed"}</h2>
              <p className="text-sm text-neutral-500">
                {employee.jobTitle}
                {employee.department ? ` · ${employee.department}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/suite/hrm/people/${employee.id}`} size="sm">
              Their record
            </ButtonLink>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setSettingKpi(true)}>
              Set a target
            </Button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <PastelCard
            hue="blue"
            icon={Target}
            label="Target attainment"
            value={summary.kpiAttainment === null ? "-" : `${summary.kpiAttainment}%`}
            sub={`${summary.kpisMeasured} of ${summary.kpisTotal} measured`}
          >
            <Progress value={Math.min(100, summary.kpiAttainment ?? 0)} hue="blue" />
          </PastelCard>
          <PastelCard
            hue="grape"
            icon={Flag}
            label="Milestones"
            value={summary.milestoneAttainment === null ? "-" : `${summary.milestoneAttainment}%`}
            sub={`${summary.milestonesAchieved} of ${summary.milestonesCounted} due`}
          >
            <Progress value={Math.min(100, summary.milestoneAttainment ?? 0)} hue="grape" />
          </PastelCard>
        </div>
      </Card>

      {/* ------------------------------ KPIs ----------------------- */}

      {kpis.length === 0 ? (
        <Panel title="Targets" icon={Target}>
          <Empty
            icon={Target}
            title="No targets set"
            hint="A target is a number, a direction and a period. Until one exists the attainment figures above have nothing to report."
            action={
              <Button size="sm" onClick={() => setSettingKpi(true)}>
                Set the first one
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {kpis.map((kpi) => (
            <Panel
              key={kpi.id}
              title={kpi.title}
              subtitle={`${formatDate(kpi.periodStart)} to ${formatDate(kpi.periodEnd)} · ${kpi.directionLabel}`}
              icon={Target}
              hue={attainmentHue(kpi.attainment)}
              actions={
                <div className="flex items-center gap-1.5">
                  {kpi.trend !== null && (
                    <Chip
                      hue={kpi.trend.isImprovement ? "mint" : "sun"}
                      icon={kpi.trend.direction === "up" ? ArrowUpRight : kpi.trend.direction === "down" ? ArrowDownRight : Minus}
                    >
                      {Math.abs(kpi.trend.change)}
                    </Chip>
                  )}
                  <Chip hue={attainmentHue(kpi.attainment)}>
                    {kpi.attainment === null ? "Not measured" : `${kpi.attainment}%`}
                  </Chip>
                </div>
              }
            >
              <KpiSeriesChart
                data={kpi.series}
                direction={kpi.direction}
                unit={kpi.unit}
                ariaLabel={`${kpi.title}: readings against the target`}
              />

              <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-3 text-center">
                <Figure label="Current" value={kpi.current === null ? "-" : String(kpi.current)} />
                <Figure label="Target" value={String(kpi.target)} />
                <Figure
                  label="Days left"
                  value={
                    kpi.daysRemaining < 0
                      ? `${Math.abs(kpi.daysRemaining)} over`
                      : String(kpi.daysRemaining)
                  }
                />
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <SoftButton hue="blue" icon={TrendingUp} onClick={() => setReadingFor(kpi)}>
                  Record a reading
                </SoftButton>
                <Button size="sm" onClick={() => setEditingKpi(kpi)}>
                  Edit
                </Button>
                <Button size="sm" onClick={() => setStatusFor(kpi)}>
                  {kpi.statusLabel}
                </Button>
              </div>

              <Readings kpi={kpi} onChanged={onChanged} />
            </Panel>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* --------------------------- milestones ------------------ */}

        <Panel
          className="xl:col-span-2"
          title="Milestones"
          subtitle={
            milestones.deliveredLate > 0
              ? `${milestones.achieved} achieved, ${milestones.deliveredLate} of them late`
              : `${milestones.achieved} achieved`
          }
          icon={CalendarClock}
          hue="grape"
          actions={
            <Button size="sm" icon={Plus} onClick={() => setSettingMilestone(true)}>
              Set one
            </Button>
          }
        >
          <DataView
            rows={milestones.items}
            columns={milestoneColumns}
            rowKey={(m) => m.id}
            storageKey="hrm.performance.milestones"
            caption={`Milestones for ${employee.name ?? "this person"}`}
            searchPlaceholder="Search milestones"
            gridCols={2}
            onRowClick={(m) => setMilestoneFor(m)}
            empty={<p className="px-6 py-10 text-center text-sm text-neutral-500">Nothing set.</p>}
            renderCard={(m) => (
              <div className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-grape-700">
                    <Flag size={16} aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">{m.title}</p>
                </div>
                {milestoneStatus(m)}
                <p className="mt-auto text-xs text-neutral-500">
                  Due {formatDate(m.dueOn)}
                  {m.achievedOn ? ` · delivered ${formatDate(m.achievedOn)}` : ""}
                </p>
              </div>
            )}
          />
        </Panel>

        {/* ----------------------------- reviews ------------------- */}

        <Panel
          title="Rating history"
          subtitle="Completed reviews only; a draft is not a verdict"
          icon={Star}
          hue="sun"
        >
          <RatingHistory reviews={reviews} />
        </Panel>
      </div>

      {(settingKpi || editingKpi !== null) && (
        <KpiDialog
          employeeId={employee.id}
          existing={editingKpi ?? undefined}
          onClose={() => {
            setSettingKpi(false);
            setEditingKpi(null);
          }}
          onSaved={() => {
            setSettingKpi(false);
            setEditingKpi(null);
            onChanged();
          }}
        />
      )}

      {readingFor !== null && (
        <RecordReadingDialog
          kpi={readingFor}
          onClose={() => setReadingFor(null)}
          onSaved={() => {
            setReadingFor(null);
            onChanged();
          }}
        />
      )}

      {statusFor !== null && (
        <KpiStatusDialog
          kpi={statusFor}
          onClose={() => setStatusFor(null)}
          onSaved={() => {
            setStatusFor(null);
            onChanged();
          }}
        />
      )}

      {settingMilestone && (
        <MilestoneDialog
          employeeId={employee.id}
          kpis={kpis}
          onClose={() => setSettingMilestone(false)}
          onSaved={() => {
            setSettingMilestone(false);
            onChanged();
          }}
        />
      )}

      {milestoneFor !== null && (
        <MilestoneStatusDialog
          milestone={milestoneFor}
          onClose={() => setMilestoneFor(null)}
          onSaved={() => {
            setMilestoneFor(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-neutral-900 tabular-nums">{value}</dd>
    </div>
  );
}
