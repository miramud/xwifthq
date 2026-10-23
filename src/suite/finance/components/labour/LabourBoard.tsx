"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { BookCheck, CalendarDays, Clock, Gauge, HardHat, Settings2, TimerReset, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, labour, type LabourConfig, type LabourMethod, type LabourOverview, type LabourRunRow } from "@/lib/api/finance-labour-client";
import { Button, Card, Chip, Empty, PageHeader, Panel, Progress, Segmented, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SegmentedGauge, StackedColumns } from "@/components/workspace/charts";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { FieldError, LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { LabourSplit } from "./LabourParts";
import { LabourMonthCalendar } from "./MonthCalendar";
import { METHOD, RUN_KIND, RUN_STATUS, bpText, hoursText, todayIso } from "./meta";

/**
 * Labour costing (Finance PRD §9): each month the payroll's loaded cost is
 * spread over the projects people logged hours to, and what no project
 * carries stays in overhead as bench. This page is the year at a glance -
 * which months are allocated - the last six months' utilisation, who was on
 * the bench (for those who may see individual pay), the costing settings,
 * and every run with its journal.
 */

export default function LabourBoard() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [data, setData] = useState<LabourOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);
  const [chart, setChart] = useState<"cost" | "hours">("cost");

  useEffect(() => {
    let alive = true;
    labour.overview().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(`Labour costing didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const canProvisional = mayDo(user, "labour", "provisional");
  const canConfigure = mayDo(user, "labour", "configure");

  const chargeProvisional = async () => {
    const ok = await confirm({
      title: "Charge provisional labour now?",
      body: "Hours logged so far this month are charged to their projects at the latest payroll rates, replacing this month's previous provisional charge. Once the month's allocation is posted, it takes over.",
      confirmLabel: "Charge provisional labour",
      tone: "primary",
    });
    if (!ok) return;
    setCharging(true);
    setActionError(null);
    try {
      const r = await labour.provisional(todayIso());
      setNotice(
        r
          ? `Provisional labour of ${amount(r.allocated)} charged to projects, to ${day(r.asOf)}.`
          : "Nothing to charge: this month's allocation is already posted, there is no payroll to take rates from, or no hours are logged yet.",
      );
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setCharging(false);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Projects"
      title="Labour costing"
      subtitle="Each month's payroll cost, charged to the projects people logged hours to. What no project carries stays in overhead as bench."
      actions={
        canProvisional && (
          <Button icon={TimerReset} onClick={() => void chargeProvisional()} disabled={charging || data === null}>
            {charging ? "Charging…" : "Charge provisional labour now"}
          </Button>
        )
      }
    />
  );

  if (loadError)
    return (
      <div>
        {header}
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading labour costing…</p>
        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );

  const months = data.utilisation.months;
  const latest = months[months.length - 1] ?? null;

  return (
    <div>
      {header}
      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Utilisation"
          subtitle={months.length ? `The last ${months.length === 1 ? "allocated month" : `${months.length} allocated months`}` : "Shows once a month is allocated"}
          icon={Gauge}
          actions={
            months.length > 0 && (
              <Segmented
                label="Show utilisation as"
                value={chart}
                onChange={setChart}
                options={[
                  { key: "cost", label: "Cost" },
                  { key: "hours", label: "Hours" },
                ]}
              />
            )
          }
        >
          {months.length === 0 ? (
            <Empty icon={HardHat} title="No month allocated yet" hint="Open last month in the calendar, check the preview and post the allocation. Utilisation builds up from there." />
          ) : chart === "cost" ? (
            <StackedColumns
              data={months.map((m) => ({ label: monthLabel(m.month, true), values: { projects: m.allocated, bench: m.bench } }))}
              series={[
                { key: "projects", label: "To projects", hue: "blue" },
                { key: "bench", label: "Bench (overhead)", hue: "sun" },
              ]}
              format={(v) => compact(v)}
              caption="Loaded payroll cost by month, split between projects and the bench"
              showTotals
              height={240}
            />
          ) : (
            <StackedColumns
              data={months.map((m) => ({ label: monthLabel(m.month, true), values: { logged: m.hoursLogged, unlogged: Math.max(0, m.hoursStandard - m.hoursLogged) } }))}
              series={[
                { key: "logged", label: "Hours logged to projects", hue: "mint" },
                { key: "unlogged", label: "Standard hours not logged", hue: "slate", dashed: true },
              ]}
              format={(v) => `${Math.round(v).toLocaleString("en-NG")} h`}
              caption="Hours logged to projects against the standard hours of everyone on the payroll, by month"
              height={240}
            />
          )}
        </Panel>

        <Panel title={latest ? monthLabel(latest.month) : "Latest month"} subtitle="The latest allocated month" icon={CalendarDays} hue="mint">
          {latest ? (
            <div className="space-y-5">
              <SegmentedGauge
                value={latest.utilisationBp / 100}
                hue={latest.utilisationBp >= 7000 ? "mint" : latest.utilisationBp >= 5000 ? "sun" : "coral"}
                label="Utilised"
                display={bpText(latest.utilisationBp)}
                caption={`${hoursText(latest.hoursLogged)} of ${hoursText(latest.hoursStandard)} · ${latest.people} people`}
                size={200}
              />
              <LabourSplit loaded={latest.loaded} allocated={latest.allocated} bench={latest.bench} size="md" />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Nothing allocated yet.</p>
          )}
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Open a month" subtitle="Preview where its payroll cost goes, then post it" icon={CalendarDays} hue="sky">
          <LabourMonthCalendar runs={data.runs} />
        </Panel>
        <SettingsCard config={data.config} canConfigure={canConfigure} onSaved={(c, msg) => {
          setData((d) => (d ? { ...d, config: c } : d));
          setNotice(msg);
        }} />
      </div>

      {data.seesPeople && data.utilisation.people && data.utilisation.people.length > 0 && latest && (
        <div className="mb-5">
          <PeopleUtilisation people={data.utilisation.people} month={latest.month} />
        </div>
      )}

      <RunsTable runs={data.runs} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

function SettingsCard({ config, canConfigure, onSaved }: { config: LabourConfig; canConfigure: boolean; onSaved: (c: LabourConfig, message: string) => void }) {
  const uid = useId();
  const [method, setMethod] = useState<LabourMethod>(config.method);
  const [hours, setHours] = useState(String(config.standardHours));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(hours);
  const dirty = method !== config.method || n !== config.standardHours;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isInteger(n) || n < 40 || n > 300) {
      setError("Standard hours must be a whole number from 40 to 300.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const patch: Partial<LabourConfig> = {};
      if (method !== config.method) patch.method = method;
      if (n !== config.standardHours) patch.standardHours = n;
      const c = await labour.configure(patch);
      onSaved(c, "Labour costing settings saved. They apply to the next preview and allocation.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="How labour is costed" subtitle={canConfigure ? "Applies to every month you allocate from now on" : "Set by Finance"} icon={Settings2} hue="slate">
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!canConfigure}>
          <legend className="mb-1.5 block text-sm font-medium text-neutral-700">Method</legend>
          <div className="space-y-2">
            {(Object.keys(METHOD) as LabourMethod[]).map((k) => (
              <label
                key={k}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-300",
                  method === k ? "border-primary-300 bg-primary-50/60" : "border-neutral-200 hover:border-neutral-300",
                  !canConfigure && "cursor-default",
                )}
              >
                <input type="radio" name={`${uid}-method`} value={k} checked={method === k} onChange={() => setMethod(k)} className="mt-1 h-4 w-4 accent-primary-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900">{METHOD[k].label}</span>
                  <span className="mt-0.5 block text-xs text-neutral-600">{METHOD[k].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${uid}-hours`} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Standard hours a month
          </label>
          <input
            id={`${uid}-hours`}
            type="number"
            inputMode="numeric"
            min={40}
            max={300}
            step={1}
            value={hours}
            disabled={!canConfigure}
            onChange={(e) => setHours(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={`${uid}-hours-hint`}
            className={cx(inputClass, "w-32 text-right tabular-nums")}
          />
          {error ? (
            <FieldError message={error} />
          ) : (
            <p id={`${uid}-hours-hint`} className="mt-1.5 text-xs text-neutral-500">
              A person&apos;s hourly rate is their loaded monthly cost over these hours. 176 is 22 days of 8 hours.
            </p>
          )}
        </div>
        {canConfigure && (
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !dirty}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  People (individual pay: only for those allowed)                    */
/* ------------------------------------------------------------------ */

function PeopleUtilisation({ people, month }: { people: NonNullable<LabourOverview["utilisation"]["people"]>; month: string }) {
  return (
    <Panel title="Who carried the hours" subtitle={`${monthLabel(month)}, person by person: hours logged to projects against the standard month, and the cost left on the bench`} icon={Users} hue="grape">
      <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {people.map((p) => (
          <li key={p.userId} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-neutral-900">{p.name ?? "Someone"}</span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                {hoursText(p.hoursLogged)} · <span className="font-semibold text-neutral-900">{bpText(p.utilisationBp)}</span>
              </span>
            </div>
            <Progress value={p.utilisationBp / 100} hue={p.utilisationBp >= 7000 ? "mint" : p.utilisationBp >= 5000 ? "sun" : "coral"} size="sm" />
            <p className="mt-1 text-xs tabular-nums text-neutral-500">{p.bench > 0 ? `${compact(p.bench)} on the bench` : "Nothing on the bench"}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Runs                                                               */
/* ------------------------------------------------------------------ */

function RunsTable({ runs }: { runs: LabourRunRow[] }) {
  const columns: Column<LabourRunRow>[] = [
    {
      key: "month",
      header: "Month",
      primary: true,
      sortable: true,
      value: (r) => `${r.month}-${r.asOf ?? ""}`,
      render: (r) => (
        <span className="block">
          <span className="block font-semibold text-neutral-900">{monthLabel(r.month)}</span>
          <span className="block text-xs text-neutral-500">
            {r.kind === "provisional" ? `Hours to ${day(r.asOf)}` : METHOD[r.method]?.short ?? r.method}
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "Run",
      sortable: true,
      value: (r) => r.kind,
      render: (r) => {
        const k = RUN_KIND[r.kind] ?? { label: r.kind, hue: "slate" as const };
        const s = RUN_STATUS[r.status] ?? { label: r.status, hue: "slate" as const };
        return (
          <span className="flex flex-wrap gap-1.5">
            <Chip hue={k.hue}>{k.label}</Chip>
            <Chip hue={s.hue} dot>
              {s.label}
            </Chip>
          </span>
        );
      },
    },
    { key: "loaded", header: "Loaded cost", align: "right", sortable: true, value: (r) => r.loaded, hideOnMobile: true, render: (r) => <span className="tabular-nums">{amount(r.loaded)}</span> },
    { key: "allocated", header: "To projects", align: "right", sortable: true, value: (r) => r.allocated, render: (r) => <span className="font-semibold tabular-nums text-neutral-900">{amount(r.allocated)}</span> },
    { key: "bench", header: "Bench", align: "right", sortable: true, value: (r) => r.bench, hideOnMobile: true, render: (r) => <span className="tabular-nums">{amount(r.bench)}</span> },
    {
      key: "exceptions",
      header: "Exceptions",
      align: "right",
      sortable: true,
      value: (r) => r.exceptions,
      render: (r) => (r.exceptions > 0 ? <Chip hue="sun">{r.exceptions}</Chip> : <span className="text-neutral-500">None</span>),
    },
    {
      key: "posted",
      header: "Posted",
      sortable: true,
      value: (r) => r.postedAt ?? "",
      hideOnMobile: true,
      render: (r) => (
        <span className="block text-xs">
          <span className="block text-neutral-800">{r.postedBy ?? "Scheduled run"}</span>
          <span className="block text-neutral-500">{day(r.postedAt)}</span>
        </span>
      ),
    },
    {
      key: "journal",
      header: "Journal",
      render: (r) =>
        r.journalId ? (
          <Link
            href={`/suite/finance/journals/${r.journalId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <BookCheck size={14} aria-hidden />
            Open journal
          </Link>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
  ];

  return (
    <section aria-labelledby="labour-runs">
      <h2 id="labour-runs" className="mb-3 text-[15px] font-semibold text-neutral-900">
        Every run
      </h2>
      {runs.length === 0 ? (
        <Card>
          <Empty icon={Clock} title="No labour charged yet" hint="Allocations and provisional charges appear here once posted, each with its journal." />
        </Card>
      ) : (
        <DataView
          rows={runs}
          columns={columns}
          rowKey={(r) => r.id}
          rowHref={(r) => `/suite/finance/labour/runs/${r.id}`}
          views={["table", "list"]}
          storageKey="finance.labour.runs"
          caption="Labour runs"
          searchPlaceholder="Search runs"
        />
      )}
    </section>
  );
}
