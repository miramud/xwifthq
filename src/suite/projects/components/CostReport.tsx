"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Clock,
  Coins,
  Layers,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Card,
  Chip,
  Empty,
  Panel,
  Segmented,
  StatCard,
  StatGrid,
  cx,
  initialsOf,
} from "@/components/workspace/kit";
import { ColumnChart, Donut } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { HUE, hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  cost as costApi,
  type Project,
  type ProjectCost,
  type Sprint,
} from "@/lib/api/projects-client";
import ProjectRates from "./ProjectRates";
import RepriceHours from "./RepriceHours";
import { hours, money, moneyRounded } from "./money";
import { MiniStat, Notice, SectionHeading, TabSkeleton } from "./ui/pkit";

type PersonRow = {
  userId: string;
  name: string | null;
  hours: number;
  billableHours: number;
  costMinor: number;
};

type DisciplineRow = {
  disciplineId: string | null;
  label: string;
  hours: number;
  costMinor: number;
};

/**
 * What a project has cost, and what it is forecast to cost.
 *
 * **Every caveat is on the screen, not in a tooltip.** Three of them, and each
 * is a number that would otherwise be quoted as if it were solid:
 *
 *  - **estimate coverage.** The real backlog this module was designed against
 *    had 118 tasks and not one estimate. A forecast over twelve estimated
 *    items out of a hundred is the cost of twelve items wearing the name of a
 *    project, so the forecast says what fraction of the remaining work it
 *    actually covers, and when that fraction is zero it is not shown as a
 *    number at all.
 *  - **unrated hours.** Time logged before a rate was set costs zero. A total
 *    that quietly includes eighteen free hours is wrong by however much they
 *    should have been.
 *  - **the exchange rate and its date.** A converted figure whose rate nobody
 *    can see is one somebody will quote as if it were today's.
 *
 * Reaching this screen at all needs `can.viewCost`, which is narrower than
 * seeing the board, a rate card says what each colleague is charged out at.
 */
export default function CostReport({
  project,
  sprints = [],
}: {
  project: Project;
  /** For the per-sprint spend. Empty is fine; the section hides itself. */
  sprints?: Sprint[];
}) {
  const [report, setReport] = useState<ProjectCost | null>(null);
  const [meta, setMeta] = useState<{
    byPerson: PersonRow[];
    byDiscipline: DisciplineRow[];
    canManageRates: boolean;
    convertibleTo: string[];
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [showIn, setShowIn] = useState("");
  /* Bumped after zero-cost hours are repriced (D21), the one write here. */
  const [reloads, setReloads] = useState(0);
  /*
    Re-read when the display currency changes, and after a reprice - the only
    two things on this screen that change the figures.
  */
  useEffect(() => {
    /*
      Guarded inside the effect, not only in the render body below - a return
      further down runs *after* this has already fired. Without it, a reader
      who may not see cost sends a request the server refuses, on every visit
      to the tab. The same mistake as the stakeholder map's first version.
    */
    if (!project.can.viewCost) return;

    let cancelled = false;

    costApi
      .forProject(project.slug, showIn === "" ? {} : { in: showIn })
      .then((res) => {
        if (cancelled) return;

        setReport(res.data);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        setError(e instanceof ApiError ? e.message : "That did not load.");
      });

    return () => {
      cancelled = true;
    };
  }, [project.slug, project.can.viewCost, showIn, reloads]);

  if (!project.can.viewCost) {
    return (
      <Card>
        <Empty
          icon={Wallet}
          hue="mint"
          title="You cannot see this project's cost"
          hint="A rate card says what each person is charged out at, and a cost report gives the margin on the client's work. It is the project manager's and the delivery lead's to read."
        />
      </Card>
    );
  }

  if (report === null || meta === null) {
    if (error !== null) return <Notice tone="error">{error}</Notice>;

    return <TabSkeleton />;
  }

  const nothingLogged = report.time.minutes === 0;
  const totalCost = Math.max(1, report.spent.minor);

  const personColumns: Column<PersonRow>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (row) => row.name ?? "Somebody who has left",
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          {/* Initials only: the name beside it is what a screen reader reads. */}
          <span
            aria-hidden
            className={cx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              HUE[hueFor(row.name)].soft,
            )}
          >
            {initialsOf(row.name)}
          </span>
          <span className="truncate font-semibold text-neutral-900">{row.name ?? "Somebody who has left"}</span>
        </span>
      ),
    },
    { key: "hours", header: "Hours", align: "right", sortable: true, value: (row) => row.hours, render: (row) => hours(row.hours) },
    {
      key: "billable",
      header: "Billable",
      align: "right",
      hideOnMobile: true,
      value: (row) => row.billableHours,
      render: (row) => hours(row.billableHours),
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      sortable: true,
      value: (row) => row.costMinor,
      render: (row) => <span className="font-semibold text-neutral-900">{money(row.costMinor, report.currency)}</span>,
    },
    {
      key: "share",
      header: "Share of spend",
      hideOnMobile: true,
      className: "min-w-[140px]",
      render: (row) => <ShareBar minor={row.costMinor} of={totalCost} hue={hueFor(row.name)} />,
    },
  ];
  /* "Billable" is a figure on an internal project with no price: leave it out. */
  const peopleColumns = report.isBillable ? personColumns : personColumns.filter((c) => c.key !== "billable");

  const disciplineColumns: Column<DisciplineRow>[] = [
    {
      key: "discipline",
      header: "Job title",
      primary: true,
      sortable: true,
      value: (row) => row.label,
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[disciplineHue(row)].dot)} aria-hidden />
          <span className="truncate font-semibold text-neutral-900">
            {row.label}
            {row.disciplineId === null && (
              /* Stand-ups and client calls belong to no job title. */
              <span className="ml-1.5 text-[11px] font-normal text-neutral-500">(project time)</span>
            )}
          </span>
        </span>
      ),
    },
    { key: "hours", header: "Hours", align: "right", sortable: true, value: (row) => row.hours, render: (row) => hours(row.hours) },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      sortable: true,
      value: (row) => row.costMinor,
      render: (row) => <span className="font-semibold text-neutral-900">{money(row.costMinor, report.currency)}</span>,
    },
    {
      key: "share",
      header: "Share of spend",
      hideOnMobile: true,
      className: "min-w-[140px]",
      render: (row) => <ShareBar minor={row.costMinor} of={totalCost} hue={disciplineHue(row)} />,
    },
  ];

  const nonBillable = Math.max(0, report.time.hours - report.time.billableHours);

  return (
    <div className="space-y-6">
      {/* ------------------------ heading + FX control ----------------------- */}

      <div>
        <SectionHeading
          title="Cost"
          hint="Built from hours actually worked, at the rate that applied when they were logged."
          actions={
            meta.convertibleTo.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="cost-in" className="text-[13px] font-semibold text-neutral-700">
                  Also show in
                </label>
                <SearchableSelect
                  id="cost-in"
                  value={showIn}
                  onChange={setShowIn}
                  size="sm"
                  className="w-40"
                  searchPlaceholder="Search currencies"
                  options={[
                    { value: "", label: `${report.currency} only` },
                    ...meta.convertibleTo.map((currency) => ({ value: currency, label: currency })),
                  ]}
                />
              </div>
            )
          }
        />

        {report.spent.converted !== undefined && (
          <p className="-mt-1 text-xs text-neutral-500">
            Converted at {report.spent.converted.rate} as of{" "}
            {report.spent.converted.asOf}
            {report.spent.converted.isStale && (
              <span className="ml-1 font-semibold text-sun-700">
                ({report.spent.converted.daysOld} days old, worth checking)
              </span>
            )}
          </p>
        )}
      </div>

      {error !== null && <Notice tone="error">{error}</Notice>}

      {/* ------------------------- the caveats ------------------------- */}

      {report.time.unratedHours > 0 && (
        <Notice tone="warn">
          {hours(report.time.unratedHours)} were logged before a rate was set and
          cost nothing here, so every figure below is short by whatever they were
          worth.{" "}
          {meta.canManageRates && (
            <>
              <span className="font-semibold">Set the rates, then reprice them.</span>
              <span className="mt-2 block">
                <RepriceHours slug={project.slug} onRepriced={() => setReloads((n) => n + 1)} />
              </span>
            </>
          )}
        </Notice>
      )}

      {!report.forecastIsMeaningful && (
        <Notice tone="info">
          None of the remaining work is estimated, so there is no forecast, only
          what has been spent. Estimate the backlog and this becomes a number.
        </Notice>
      )}

      {/* ------------------------- the figures ------------------------- */}

      <StatGrid>
        <Figure
          featured
          icon={Wallet}
          label="Spent"
          minor={report.spent.minor}
          currency={report.spent.currency}
          converted={report.spent.converted}
          unavailable={report.spent.conversionUnavailable}
          hint={`${hours(report.time.hours)} by ${report.time.people} ${
            report.time.people === 1 ? "person" : "people"
          }`}
        />

        {report.isBillable ? (
          <Figure
            icon={Receipt}
            hue="mint"
            label="Billable"
            minor={report.billableSpent.minor}
            currency={report.billableSpent.currency}
            converted={report.billableSpent.converted}
            unavailable={report.billableSpent.conversionUnavailable}
            hint={`${hours(report.time.billableHours)} of ${hours(report.time.hours)}`}
          />
        ) : (
          /*
            An internal project has a cost and no price. A margin on it would
            be a loss presented as one, and that is not what running your own
            roadmap means.
          */
          <StatCard
            icon={Building2}
            hue="slate"
            label="Internal project"
            value={<span className="text-neutral-400">-</span>}
            hint="A cost and no price, so no billable figure and no margin."
          />
        )}

        <Figure
          icon={Layers}
          hue="sky"
          label="Committed"
          minor={report.committed.minor}
          currency={report.committed.currency}
          converted={report.committed.converted}
          unavailable={report.committed.conversionUnavailable}
          hint={
            report.committed.total === 0
              ? "Nothing open"
              : `${hours(report.committed.hours)} across ${report.committed.estimated} of ${
                  report.committed.total
                } open items`
          }
          /*
            The number that stops a committed figure being read as the cost of
            the remaining work when it is the cost of a third of it.
          */
          coverage={report.committed.coverage}
        />

        <Figure
          icon={TrendingUp}
          hue="grape"
          label="Forecast"
          minor={report.forecast.minor}
          currency={report.forecast.currency}
          converted={report.forecast.converted}
          unavailable={report.forecast.conversionUnavailable}
          hint="Spent plus committed"
          muted={!report.forecastIsMeaningful}
        />
      </StatGrid>

      {/* ---------------------- sprint hero + hours ---------------------- */}

      {(sprints.length > 0 || !nothingLogged) && (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Cost per sprint, which is the delivery-performance question. */}
          {sprints.length > 0 && (
            <div className="xl:col-span-2">
              <SprintCosts project={project} sprints={sprints} />
            </div>
          )}

          {!nothingLogged && (
            <Panel
              className={sprints.length > 0 ? undefined : "xl:col-span-3"}
              title="The hours behind it"
              subtitle="Time logged on this project"
              icon={Clock}
              hue="grape"
            >
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Logged" value={hours(report.time.hours)} hue="grape" />
                <MiniStat label="People" value={report.time.people} hue="sky" />
              </div>
              {report.isBillable && (
                <div className="mt-5 flex justify-center">
                  <Donut
                    size={150}
                    legend="below"
                    centerLabel="logged"
                    total={hours(report.time.hours)}
                    caption="Billable and other hours logged"
                    data={[
                      { label: "Billable hours", value: report.time.billableHours, hue: "mint" },
                      { label: "Other hours", value: nonBillable, hue: "slate" },
                    ]}
                  />
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* ------------------------ where it went ------------------------ */}

      {nothingLogged ? (
        <Card>
          <Empty
            icon={Wallet}
            hue="mint"
            title="No time logged yet"
            hint="Cost is built from hours actually worked, so this stays empty until somebody logs some."
          />
        </Card>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-2">
          <Panel
            title="By person"
            subtitle="Ordered by cost: the answer to “where did the money go” is the top row."
            icon={Users}
            hue="coral"
            bodyClassName="p-5 pt-4"
          >
            <DataView
              rows={meta.byPerson}
              columns={peopleColumns}
              rowKey={(row) => row.userId}
              storageKey="projects.cost.people"
              caption="Cost by person"
              searchPlaceholder="Search people"
              searchable={meta.byPerson.length > 6}
              gridCols={2}
            />
          </Panel>

          <Panel title="By job title" icon={Coins} hue="sun" bodyClassName="p-5 pt-4">
            <DataView
              rows={meta.byDiscipline}
              columns={disciplineColumns}
              rowKey={(row) => row.disciplineId ?? "none"}
              storageKey="projects.cost.disciplines"
              caption="Cost by job title"
              searchable={false}
              gridCols={2}
            />
          </Panel>
        </div>
      )}

      {/* --------------------------- the rates ------------------------- */}

      {/*
        The editable panel rather than a read-only list. The API had always
        accepted a project override and the resolver had always preferred one,
        and nothing could set it - so an agency whose client pays above the card
        had no way to say so, and every figure on that engagement was wrong by
        the difference.
      */}
      <ProjectRates project={project} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Project time, the row with no job title, is drawn plainly rather than given a colour. */
function disciplineHue(row: DisciplineRow) {
  return row.disciplineId === null ? "slate" : hueFor(row.label);
}

/** A row's share of the spend, as a hatched bar with the share beside it. */
function ShareBar({ minor, of, hue }: { minor: number; of: number; hue: ReturnType<typeof hueFor> }) {
  const pct = Math.max(0, Math.min(100, Math.round((minor / of) * 100)));
  return (
    <span className="flex items-center gap-2.5">
      <span className="ws-hatch h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
        <span className={cx("block h-full rounded-full", HUE[hue].bar)} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-neutral-600">{pct}%</span>
    </span>
  );
}

function Figure({
  label,
  minor,
  currency,
  converted,
  unavailable,
  hint,
  coverage,
  muted = false,
  featured = false,
  icon,
  hue,
}: {
  label: string;
  minor: number;
  currency: string;
  converted?: { minor: number; currency: string; rate: number; asOf: string; isStale: boolean };
  unavailable?: string;
  hint?: string;
  coverage?: number | null;
  muted?: boolean;
  featured?: boolean;
  icon: typeof Wallet;
  hue?: "mint" | "sky" | "grape" | "blue";
}) {
  const sub = featured ? "text-white/85" : "text-neutral-500";
  return (
    /* The exact figure on hover; the rounded one is what gets read. */
    <div title={money(minor, currency)} className="h-full">
      <StatCard
        featured={featured}
        icon={icon}
        hue={hue}
        label={label}
        value={muted ? <span className="text-neutral-400">{moneyRounded(minor, currency)}</span> : moneyRounded(minor, currency)}
        hint={
          <span className="flex flex-col gap-1">
            {hint !== undefined && <span>{hint}</span>}

            {coverage !== undefined && coverage !== null && coverage < 1 && (
              <span className={cx("font-semibold", featured ? "text-white" : "text-sun-700")}>
                Covers {Math.round(coverage * 100)}% of the open work
              </span>
            )}

            {converted !== undefined && (
              <span className={sub}>
                ≈ {moneyRounded(converted.minor, converted.currency)}
                {converted.isStale && (
                  <span className={cx("ml-1 font-semibold", featured ? "text-white" : "text-sun-700")}>(stale rate)</span>
                )}
              </span>
            )}

            {unavailable !== undefined && (
              /* Named rather than omitted: a missing conversion with no explanation
                 reads as a bug; with one, it reads as a rate somebody must enter. */
              <span className={sub}>No {unavailable} rate set, so it is not converted.</span>
            )}
          </span>
        }
      />
    </div>
  );
}

type SprintCostRow = { spentMinor: number; hours: number; unratedHours: number; people: number };

/**
 * What each sprint cost.
 *
 * `GET /sprints/{id}/cost` existed and nothing called it. The figure is the one
 * a delivery lead asks for by name, "what are we spending a fortnight", and
 * it is not derivable from the project total, because a sprint's spend includes
 * the project-level time inside its dates as well as the hours on its tickets.
 *
 * Fetched per sprint rather than in one call. A project has eight of them, not
 * eight hundred, and a batch endpoint for eight rows is an endpoint to keep in
 * step with this one for no gain.
 */
function SprintCosts({
  project,
  sprints,
}: {
  project: Project;
  sprints: Sprint[];
}) {
  const [rows, setRows] = useState<Record<string, SprintCostRow>>({});
  const [measure, setMeasure] = useState<"cost" | "hours">("cost");

  useEffect(() => {
    let cancelled = false;

    /*
      Started, closed and planned alike: a planned sprint costs nothing yet and
      showing a zero beside it is more honest than leaving it out, which reads
      as though the sprint did not exist.
    */
    void Promise.all(
      sprints.map(async (sprint) => {
        try {
          const res = await costApi.forSprint(sprint.id);

          return [sprint.id, {
            spentMinor: res.spent.minor,
            hours: res.hours,
            unratedHours: res.unratedHours,
            people: res.people,
          }] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;

      setRows(
        Object.fromEntries(results.filter((r): r is NonNullable<typeof r> => r !== null)),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [sprints]);

  const loaded = sprints.filter((s) => rows[s.id] !== undefined);

  const columns: Column<Sprint>[] = [
    {
      key: "sprint",
      header: "Sprint",
      primary: true,
      sortable: true,
      value: (s) => s.sequence,
      render: (s) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">Sprint {s.sequence}</span>
          <Chip hue={s.status === "active" ? "blue" : s.status === "closed" ? "mint" : "slate"} className="!px-2 !py-0.5 text-[11px]">
            {s.statusLabel}
          </Chip>
        </span>
      ),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      sortable: true,
      value: (s) => rows[s.id]?.hours ?? null,
      render: (s) => {
        const row = rows[s.id];
        if (row === undefined) return "…";
        return (
          <span className="flex flex-col items-end">
            {hours(row.hours)}
            {row.unratedHours > 0 && (
              /* Hours that cost nothing, so this sprint's figure is short. */
              <span className="text-[11px] font-semibold text-sun-700">{hours(row.unratedHours)} unrated</span>
            )}
          </span>
        );
      },
    },
    {
      key: "spent",
      header: "Spent",
      align: "right",
      sortable: true,
      value: (s) => rows[s.id]?.spentMinor ?? null,
      render: (s) => {
        const row = rows[s.id];
        return (
          <span className="font-semibold text-neutral-900">
            {row === undefined ? "-" : money(row.spentMinor, project.currency)}
          </span>
        );
      },
    },
  ];

  return (
    <Panel
      title="By sprint"
      subtitle="Hours on the sprint's tickets, plus the project time inside its dates."
      icon={BarChart3}
      actions={
        <Segmented<"cost" | "hours">
          label="Chart sprints by"
          value={measure}
          onChange={setMeasure}
          options={[
            { key: "cost", label: "Cost" },
            { key: "hours", label: "Hours" },
          ]}
        />
      }
    >
      {loaded.length > 0 && (
        <div className="mb-6 pt-8">
          <ColumnChart
            height={180}
            highlight="max"
            hue={measure === "cost" ? "blue" : "grape"}
            caption={measure === "cost" ? "Spend per sprint" : "Hours logged per sprint"}
            format={measure === "cost" ? (v) => moneyRounded(v, project.currency) : hours}
            data={loaded.map((s) => ({
              label: `S${s.sequence}`,
              value: measure === "cost" ? rows[s.id].spentMinor : rows[s.id].hours,
            }))}
          />
        </div>
      )}

      <DataView
        rows={sprints}
        columns={columns}
        rowKey={(s) => s.id}
        storageKey="projects.cost.sprints"
        caption="Spend per sprint"
        searchable={false}
      />
    </Panel>
  );
}
