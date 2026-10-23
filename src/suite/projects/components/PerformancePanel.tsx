"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleHelp,
  FileSpreadsheet,
  Gauge,
  HeartPulse,
  Info,
  Repeat2,
  Rows3,
  TrendingDown,
  TriangleAlert,
  Waves,
} from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  Panel,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { ColumnChart, Donut, Legend, hueHex } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, type Hue } from "@/components/workspace/modules";
import {
  ApiError,
  performance as performanceApi,
  type Burndown,
  type HealthSignal,
  type Performance,
  type Project,
  type Sprint,
  type VelocityPoint,
} from "@/lib/api/projects-client";
import { hours } from "./money";
import MyProjectPerformance from "./MyProjectPerformance";
import { MiniStat, Notice, SectionHeading, TabSkeleton, fmtRange } from "./ui/pkit";

const VERDICT: Record<HealthSignal["verdict"], { hue: Hue; Icon: typeof CheckCircle2; legend: string }> = {
  good: { hue: "mint", Icon: CheckCircle2, legend: "Good" },
  watch: { hue: "sun", Icon: TriangleAlert, legend: "Watch" },
  bad: { hue: "coral", Icon: AlertTriangle, legend: "Needs action" },
  unknown: { hue: "slate", Icon: CircleHelp, legend: "Too early to tell" },
};

const CONFIDENCE: Record<string, { label: string; hue: Hue }> = {
  high: { label: "High confidence", hue: "mint" },
  medium: { label: "Medium confidence", hue: "sun" },
  low: { label: "Low confidence", hue: "coral" },
};

type VelocityUnit = "hours" | "items";

/**
 * How this project is actually going — and, below it, how you are.
 *
 * **Every number on this screen can refuse to exist**, and that is the design
 * rather than a limitation. A forecast needs two closed sprints and an
 * estimated backlog; without them it says which of the two is missing and what
 * to do about it. A velocity below the minimum is **absent, not zero** — a
 * zero is a claim about a team, and the two must never render the same way.
 *
 * **Health is named signals, never a score.** A single percentage is what
 * every tool of this sort ships and the thing nobody can act on: it tells a
 * project manager to worry without saying what about, and it averages a
 * blocked ticket against an unestimated backlog as though they were the same
 * problem.
 *
 * **The forecast is a range**, drawn from the team's own best and worst
 * sprints rather than a confidence interval invented over three points. A team
 * that varies by a factor of two gets a range a factor of two wide — which is
 * the honest picture, and is usually the argument for estimating better made
 * in weeks.
 *
 * The team figures and the personal ones load separately. Either can fail
 * without taking the other with it: somebody whose team report errors can
 * still read their own counts, and the reverse.
 */
export default function PerformancePanel({
  project,
  sprints,
}: {
  project: Project;
  sprints: Sprint[];
}) {
  const [data, setData] = useState<Performance | null>(null);
  const [burndown, setBurndown] = useState<Burndown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<VelocityUnit>("hours");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportCaptionId = useId();

  const downloadWorkbook = async () => {
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
      /* After the click has been handled, so the download has what it needs. */
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : "The performance workbook could not be downloaded.");
    } finally {
      setExporting(false);
    }
  };

  /* The running sprint, or the last one closed — the curve worth drawing. */
  const focusSprint = useMemo(
    () =>
      sprints.find((s) => s.status === "active") ??
      [...sprints].reverse().find((s) => s.status === "closed") ??
      null,
    [sprints],
  );

  useEffect(() => {
    let cancelled = false;

    performanceApi
      .forProject(project.slug)
      .then((res) => {
        if (cancelled) return;

        setData(res.data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug]);

  useEffect(() => {
    if (focusSprint === null) return;

    let cancelled = false;

    performanceApi
      .burndown(focusSprint.id)
      .then((res) => {
        if (!cancelled) setBurndown(res);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [focusSprint]);

  /*
    Matched rather than cleared. Clearing the old curve in the effect is a
    setState the React 19 rule rightly objects to, and deriving it is also more
    correct: it never renders last sprint's curve under this sprint's heading
    while the new one is in flight.
  */
  const shownBurndown =
    burndown !== null && burndown.sprintId === focusSprint?.id ? burndown : null;

  const mine = <MyProjectPerformance project={project} />;

  /*
    The workbook is a manager's export: it is the one place per-member figures
    appear (PROJECTS_MODULE § 3.7), so it is offered only where the API would
    hand it over — hidden rather than refused, per the `can` rule.
  */
  const exportControl = (project.can?.exportPerformance ?? project.can?.manageBoard) ? (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        icon={FileSpreadsheet}
        size="sm"
        onClick={() => void downloadWorkbook()}
        disabled={exporting}
        aria-describedby={exportCaptionId}
      >
        {exporting ? "Preparing workbook…" : "Export to Excel"}
      </Button>
      <p id={exportCaptionId} className="text-xs text-neutral-500">
        Sprints, members, bugs and stories, with charts.
      </p>
    </div>
  ) : null;

  const exportNotice =
    exportError !== null ? (
      <Notice tone="error" title="The workbook did not download">
        {exportError}
      </Notice>
    ) : null;

  if (data === null) {
    return (
      <div className="space-y-8">
        {error !== null ? <Notice tone="error">{error}</Notice> : <TabSkeleton />}
        {mine}
      </div>
    );
  }

  const { velocity, forecast, health } = data;
  const summary = velocity.summary;

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <SectionHeading
          title="Team performance"
          hint="Velocity, forecast and health for the whole project: the team's own numbers, read per project."
          actions={exportControl}
        />
        {exportNotice}

        {/* ----------------------------- stat row ---------------------------- */}

        <StatGrid>
          <StatCard
            featured
            icon={CalendarRange}
            label="Sprints to go"
            value={forecast.available && forecast.sprintsRemaining ? forecast.sprintsRemaining.expected : "-"}
            hint={
              forecast.available && forecast.sprintsRemaining
                ? `${forecast.sprintsRemaining.optimistic} to ${forecast.sprintsRemaining.pessimistic} across the range`
                : "No forecast yet"
            }
          />
          <StatCard
            icon={Activity}
            hue="blue"
            label="Average velocity"
            value={summary === null ? "-" : hours(summary.averageHours)}
            hint={summary === null ? "Absent, not zero" : `Last ${summary.window} closed sprints`}
          />
          <StatCard
            icon={Waves}
            hue="grape"
            label="Variability"
            value={summary === null || summary.variability === null ? "-" : `${Math.round(summary.variability * 100)}%`}
            hint="Lower is more predictable"
          />
          <StatCard
            icon={Repeat2}
            hue="sun"
            label="Rework"
            value={summary === null ? "-" : String(summary.bounceBacks)}
            /* The rule, restated where somebody reads the number. */
            hint="Per project, never per person"
          />
        </StatGrid>

        {/* ---------------------- velocity hero + forecast ------------------- */}

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Velocity"
            subtitle={`Finished work inside what was committed, per closed sprint. Averaged over the last ${velocity.window}.`}
            icon={BarChart3}
            actions={
              summary !== null ? (
                <Segmented<VelocityUnit>
                  label="Measure velocity in"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { key: "hours", label: "Hours" },
                    { key: "items", label: "Items" },
                  ]}
                />
              ) : undefined
            }
          >
            {summary === null ? (
              <Empty
                icon={Gauge}
                title="Not measured yet"
                hint={`Velocity needs ${velocity.minimumSprints} closed sprints. ${
                  velocity.series.length === 0
                    ? "None has closed."
                    : `${velocity.series.length} has.`
                } It is absent rather than zero, because zero would be a claim about the team.`}
              />
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  {/*
                    Committed is the hatched column, completed grows inside it —
                    so the hatch left showing *is* the carry-over, the shape a
                    retrospective is actually looking for.
                  */}
                  <Legend
                    items={[
                      { label: "Completed", hue: "blue" },
                      { label: "Committed (hatched)", hue: "slate" },
                    ]}
                  />
                  <span className="text-xs text-neutral-500">
                    Range <span className="font-semibold text-neutral-800">{`${hours(summary.lowHours)} to ${hours(summary.highHours)}`}</span>
                  </span>
                </div>
                <div className="pt-6">
                  <ColumnChart
                    height={200}
                    highlight="last"
                    caption={unit === "hours" ? "Hours completed per closed sprint" : "Items completed per closed sprint"}
                    format={unit === "hours" ? hours : (v) => String(v)}
                    data={velocity.series.map((p) => ({
                      label: `S${p.sequence}`,
                      value: unit === "hours" ? p.completedHours : p.completedCount,
                      max:
                        unit === "hours"
                          ? Math.max(p.committedHours, p.completedHours)
                          : Math.max(p.committedCount, p.completedCount),
                      hue: attainmentHue(p.attainment),
                    }))}
                  />
                </div>
              </>
            )}
          </Panel>

          <ForecastPanel forecast={forecast} />
        </div>

        {/* ---------------------------- health ---------------------------- */}

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Health"
            subtitle="Named findings rather than a score. A percentage tells you to worry without saying what about."
            icon={HeartPulse}
            hue="rose"
            bodyClassName="px-2 pb-3 pt-3"
          >
            <ul className="divide-y divide-neutral-100">
              {health.map((signal) => {
                const { hue, Icon } = VERDICT[signal.verdict];

                return (
                  <li key={signal.key} className="flex items-start gap-3 px-3 py-3">
                    <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}>
                      <Icon size={17} aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{signal.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-neutral-600">{signal.detail}</p>
                    </div>

                    <Chip hue={hue} dot className="capitalize">
                      {signal.verdict === "unknown" ? "Not yet" : signal.verdict}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Findings at a glance" subtitle="How many signals sit in each state" icon={Activity} hue="mint">
            <div className="flex h-full items-center">
              <Donut
                size={160}
                legend="below"
                centerLabel="signals"
                caption="Health findings by state"
                data={(["good", "watch", "bad", "unknown"] as const).map((v) => ({
                  label: VERDICT[v].legend,
                  value: health.filter((s) => s.verdict === v).length,
                  hue: VERDICT[v].hue,
                }))}
              />
            </div>
          </Panel>
        </div>

        {/* --------------------------- burndown --------------------------- */}

        {shownBurndown !== null && (
          <Panel
            title={`Sprint ${shownBurndown.sequence} burndown`}
            subtitle="What is left, against the straight line even progress would have followed."
            icon={TrendingDown}
            hue="sky"
          >
            {shownBurndown.estimated === 0 ? (
              <p className="flex items-start gap-2 text-sm text-neutral-500">
                <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
                {/* A burndown over unestimated work is a flat line at zero. */}
                Nothing in this sprint is estimated, so there is no curve to draw.
              </p>
            ) : (
              <>
                <BurndownChart burndown={shownBurndown} />

                {shownBurndown.estimated < shownBurndown.total && (
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Drawn from the {shownBurndown.estimated} of {shownBurndown.total} items
                    that carry an estimate.
                  </p>
                )}
              </>
            )}
          </Panel>
        )}

        {/* ------------------------- the figures -------------------------- */}

        {velocity.series.length > 0 && <SprintFigures series={velocity.series} />}
      </div>

      {mine}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Met the commitment, nearly, or short — and "no measurement" as its own thing. */
function attainmentHue(attainment: number | null): Hue {
  if (attainment === null) return "slate";
  if (attainment >= 0.9) return "blue";
  if (attainment >= 0.7) return "sun";
  return "coral";
}

/**
 * The forecast, as best case, expected and worst case side by side.
 *
 * Three dates on one strip rather than a single date with a footnote: the
 * range is the honest picture, so it is not a footnote.
 */
function ForecastPanel({ forecast }: { forecast: Performance["forecast"] }) {
  return (
    <Panel
      title="Forecast"
      subtitle="Computed from observed velocity. Never stored, and never stated more confidently than the data allows."
      icon={CalendarRange}
      hue="grape"
    >
      {forecast.available ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-neutral-500">
              Expected, after {forecast.sprintsRemaining?.expected} more{" "}
              {forecast.sprintsRemaining?.expected === 1 ? "sprint" : "sprints"}
            </p>
            {forecast.confidence !== null && (
              <Chip hue={CONFIDENCE[forecast.confidence].hue} dot>
                {CONFIDENCE[forecast.confidence].label}
              </Chip>
            )}
          </div>

          <p className="text-[28px] font-bold leading-none tracking-tight text-neutral-900 tabular-nums">
            {forecast.dates?.expected}
          </p>

          <div>
            <div className="relative h-3">
              <div className="ws-hatch absolute inset-0 rounded-full" />
              <div className="absolute inset-y-0 left-[12%] right-[12%] rounded-full bg-grape-100" />
              <span className="absolute left-[12%] top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-mint-500 shadow" aria-hidden />
              <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-grape-500 shadow" aria-hidden />
              <span className="absolute left-[88%] top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-coral-500 shadow" aria-hidden />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-neutral-500">At best</p>
                <p className="font-semibold tabular-nums text-neutral-800">{forecast.dates?.optimistic}</p>
              </div>
              <div className="text-right">
                <p className="text-neutral-500">At worst</p>
                <p className="font-semibold tabular-nums text-neutral-800">{forecast.dates?.pessimistic}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              From this team&apos;s own best and worst sprints, not a
              statistical interval.
            </p>
          </div>

          {forecast.slipsPastTarget !== null && (
            <Notice tone="warn">
              {forecast.slipsPastTarget} days past the {forecast.targetEndsOn}{" "}
              target. That target is what was promised; this is what the
              measured velocity says.
            </Notice>
          )}

          {forecast.coverage !== null && forecast.coverage < 0.9 && (
            <p className="text-xs text-neutral-600">
              {/* The caveat that stops a range being read as covering everything. */}
              Covers the {Math.round(forecast.coverage * 100)}% of remaining
              work that is estimated ({forecast.estimated} of {forecast.total}{" "}
              items, {hours(forecast.estimatedHours)}).
            </p>
          )}

          <p className="text-[11px] text-neutral-500">
            From {forecast.basis?.sprintsMeasured} closed sprints averaging{" "}
            {hours(forecast.basis?.averageHours ?? 0)} each.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE.sky.soft)}>
            <Info size={17} aria-hidden />
          </span>
          <div>
            {/*
              Named refusals. "We cannot tell you yet" and "something broke"
              look identical without this.
            */}
            <p className="text-sm text-neutral-700">{forecast.explanation}</p>
            {forecast.total > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {forecast.estimated} of {forecast.total} open items are
                estimated.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Every closed sprint's figures: the accessible version of the chart above. */
function SprintFigures({ series }: { series: VelocityPoint[] }) {
  const columns: Column<VelocityPoint>[] = [
    {
      key: "sprint",
      header: "Sprint",
      primary: true,
      sortable: true,
      value: (p) => p.sequence,
      render: (p) => (
        <span className="flex flex-col">
          <span className="font-semibold text-neutral-900">{p.name}</span>
          <span className="text-xs text-neutral-500">{fmtRange(p.startsOn, p.endsOn)}</span>
        </span>
      ),
    },
    { key: "committed", header: "Committed", align: "right", sortable: true, value: (p) => p.committedHours, render: (p) => hours(p.committedHours) },
    { key: "completed", header: "Completed", align: "right", sortable: true, value: (p) => p.completedHours, render: (p) => hours(p.completedHours) },
    {
      key: "items",
      header: "Items",
      align: "right",
      hideOnMobile: true,
      value: (p) => p.completedCount,
      render: (p) => `${p.completedCount} of ${p.committedCount}`,
    },
    {
      key: "attainment",
      header: "Attainment",
      align: "right",
      sortable: true,
      value: (p) => p.attainment,
      render: (p) =>
        p.attainment === null ? (
          <span className="text-xs text-neutral-500">Not measured</span>
        ) : (
          <Chip hue={attainmentHue(p.attainment)}>{Math.round(p.attainment * 100)}%</Chip>
        ),
    },
    { key: "carried", header: "Carried", align: "right", hideOnMobile: true, value: (p) => p.carriedHours, render: (p) => hours(p.carriedHours) },
    { key: "added", header: "Added mid-sprint", align: "right", hideOnMobile: true, value: (p) => p.addedHours, render: (p) => hours(p.addedHours) },
    { key: "rework", header: "Moves back", align: "right", sortable: true, hideOnMobile: true, value: (p) => p.bounceBacks },
  ];

  return (
    <Panel title="Sprint by sprint" subtitle="The figures behind the velocity chart" icon={Rows3} hue="sky" bodyClassName="p-5 pt-4">
      <DataView
        rows={series}
        columns={columns}
        rowKey={(p) => p.sprintId}
        storageKey="projects.performance.sprints"
        caption="Committed and completed work per closed sprint"
        searchable={false}
        renderCard={(p) => (
          <div className="flex h-full flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-neutral-900">{p.name}</p>
                <p className="text-xs text-neutral-500">{fmtRange(p.startsOn, p.endsOn)}</p>
              </div>
              {p.attainment !== null && (
                <Chip hue={attainmentHue(p.attainment)}>{Math.round(p.attainment * 100)}%</Chip>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Completed" value={hours(p.completedHours)} hue="blue" />
              <MiniStat label="Committed" value={hours(p.committedHours)} />
            </div>
            <p className="text-xs text-neutral-600">
              {p.completedCount} of {p.committedCount} items · {hours(p.carriedHours)} carried
            </p>
          </div>
        )}
      />
    </Panel>
  );
}

/**
 * The burndown, as an SVG.
 *
 * Two series told apart three ways — colour, dash pattern and a named legend —
 * because colour alone fails for the eight per cent of men who cannot
 * distinguish these two hues, and a chart with one unreadable series is a
 * chart with no comparison in it.
 */
function BurndownChart({ burndown }: { burndown: Burndown }) {
  const gradient = `bd-${useId().replace(/:/g, "")}`;
  const width = 640;
  const height = 200;
  const padding = 10;

  const peak = Math.max(1, burndown.totalHours);
  const last = burndown.points.length - 1;

  const x = (index: number) =>
    padding + (index / Math.max(1, last)) * (width - padding * 2);
  const y = (value: number) =>
    height - padding - (value / peak) * (height - padding * 2);

  const ideal = burndown.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.idealHours)}`)
    .join(" ");

  /* Stops at today rather than running flat. */
  const drawn = burndown.points.filter((point) => point.remainingHours !== null);

  const actual = drawn
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.remainingHours ?? 0)}`)
    .join(" ");

  const area =
    drawn.length > 0
      ? `${actual} L${x(drawn.length - 1)},${height - padding} L${x(0)},${height - padding} Z`
      : "";

  const blue = hueHex("blue");
  const slate = hueHex("slate");

  /* A handful of dates along the bottom, never all fourteen. */
  const step = Math.max(1, Math.ceil(burndown.points.length / 6));
  const ticks = burndown.points.filter((_, i) => i % step === 0 || i === last);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Burndown for sprint ${burndown.sequence}: ${burndown.totalHours} hours committed, ${
          drawn[drawn.length - 1]?.remainingHours ?? burndown.totalHours
        } remaining.`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={blue} stopOpacity="0.2" />
            <stop offset="100%" stopColor={blue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + (height - padding * 2) * f}
            y2={padding + (height - padding * 2) * f}
            stroke={slate}
            strokeOpacity="0.12"
          />
        ))}
        {area && <path d={area} fill={`url(#${gradient})`} />}
        <path d={ideal} fill="none" stroke={slate} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="5 5" />
        <path d={actual} fill="none" stroke={blue} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
        {drawn.length > 0 && (
          <circle
            cx={x(drawn.length - 1)}
            cy={y(drawn[drawn.length - 1].remainingHours ?? 0)}
            r="5"
            fill={blue}
            stroke="white"
            strokeWidth="2"
          />
        )}
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-neutral-500" aria-hidden>
        {ticks.map((p) => (
          <span key={p.date}>{p.date.slice(5)}</span>
        ))}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-2 border-dashed border-neutral-400" aria-hidden />
          Even progress
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t-[3px] border-primary-600" aria-hidden />
          Actually left
        </span>
        <span className="ml-auto font-semibold tabular-nums text-neutral-800">
          {burndown.totalHours}h committed
        </span>
      </figcaption>
    </figure>
  );
}
