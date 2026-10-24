"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarRange, CircleCheck, Gauge, ListChecks, PauseCircle, Plus, TimerReset } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { DetailDrawer, DetailList } from "@/components/workspace/DetailDrawer";
import { csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { hueFor, HUE } from "@/components/workspace/modules";
import { addDays } from "@/components/workspace/calendar-lanes";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { maintenance, opsError, type MaintenancePlan, type PlanTarget, type UsageReading, type UsageUnit } from "@/lib/api/operations-maintenance-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { daysBetween, ymdOf } from "./labels";
import { maintenanceTabs } from "./parts";
import { PlanDialog, ReadingDialog } from "./PlanDialogs";

const WEEKS = 12;

/** Monday of the week `ymd` falls in. */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  const back = (d.getDay() + 6) % 7;
  return addDays(ymd, -back);
}

/** How often, in words: "Every 3 months or 250 hours, whichever comes first". */
export function frequencyText(p: Pick<MaintenancePlan, "everyMonths" | "everyUsage" | "usageUnit">): string {
  const parts = [p.everyMonths ? `${p.everyMonths} ${p.everyMonths === 1 ? "month" : "months"}` : null, p.everyUsage ? `${p.everyUsage.toLocaleString("en-GB")} ${p.usageUnit ?? ""}`.trim() : null].filter(Boolean);
  if (parts.length === 0) return "-";
  return `Every ${parts.join(" or ")}${parts.length > 1 ? ", whichever comes first" : ""}`;
}

/** Where a usage plan stands on one asset: used since the last service against the limit. */
export function usageProgress(since: number, every: number): { pct: number; hue: "mint" | "sun" | "rose"; left: number } {
  const pct = every > 0 ? (100 * since) / every : 0;
  return { pct: Math.max(0, pct), hue: pct >= 100 ? "rose" : pct >= 75 ? "sun" : "mint", left: Math.max(0, every - since) };
}

interface Row {
  plan: MaintenancePlan;
  target: PlanTarget;
}

/**
 * Preventive plans: the next twelve weeks of servicing on one timeline (with
 * the lead window before each due date, when its work order is raised), the
 * meters counting toward a usage-based service, and the plans themselves.
 */
export default function PlansDesk() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MaintenancePlan[] | null>(null);
  const [readings, setReadings] = useState<Record<string, UsageReading[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<MaintenancePlan | "new" | null>(null);
  const [viewing, setViewing] = useState<MaintenancePlan | null>(null);
  const [reading, setReading] = useState<{ asset: { id: string; tagNo: string | null; name: string | null }; unit: UsageUnit; last: number | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const today = ymdOf(new Date());

  useEffect(() => {
    let alive = true;
    maintenance.plans().then(
      (p) => {
        if (!alive) return;
        setPlans(p);
        setError(null);
        // The current meter of every asset on a usage plan.
        const ids = [...new Set(p.filter((x) => x.everyUsage).flatMap((x) => x.targets.map((t) => t.assetId).filter((a): a is string => Boolean(a))))].slice(0, 40);
        Promise.all(ids.map((id) => maintenance.readings(id).then((r) => [id, r] as const, () => [id, [] as UsageReading[]] as const))).then((pairs) => {
          if (alive) setReadings(Object.fromEntries(pairs));
        });
      },
      (e: unknown) => alive && setError(`The plans didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const rows: Row[] = useMemo(() => (plans ?? []).filter((p) => p.active).flatMap((plan) => plan.targets.map((target) => ({ plan, target }))), [plans]);

  if (error && !plans) {
    return (
      <div>
        <PageHeader title="Maintenance" tabs={maintenanceTabs()} activeTab="plans" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!plans) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the plans…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[360px]" />
        <Skeleton className="h-[280px]" />
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "maintenance", a);
  const start = mondayOf(today);
  const end = addDays(start, WEEKS * 7);
  const dated = rows.filter((r) => r.target.nextDueOn).sort((a, b) => (a.target.nextDueOn as string).localeCompare(b.target.nextDueOn as string));
  const late = dated.filter((r) => (r.target.nextDueOn as string) < today);
  const inWindow = dated.filter((r) => (r.target.nextDueOn as string) < end);
  const later = dated.length - inWindow.length;
  const usageRows = rows.filter((r) => r.plan.everyUsage && r.target.assetId);
  const current = (assetId: string, unit: UsageUnit | null) => {
    const list = (readings[assetId] ?? []).filter((x) => x.unit === unit);
    return list.length ? Math.max(...list.map((x) => x.reading)) : null;
  };
  const usageDue = usageRows.filter((r) => {
    const now = current(r.target.assetId as string, r.plan.usageUnit);
    return now !== null && usageProgress(now - (r.target.lastDoneUsage ?? 0), r.plan.everyUsage as number).pct >= 100;
  }).length;

  const columns: Column<MaintenancePlan>[] = [
    {
      key: "name",
      header: "Plan",
      primary: true,
      sortable: true,
      value: (p) => p.name,
      render: (p) => (
        <span className="block min-w-0">
          <span className={cx("block truncate font-semibold", p.active ? "text-neutral-900" : "text-neutral-500")}>{p.name}</span>
          <span className="block truncate text-xs text-neutral-500">{frequencyText(p)}</span>
        </span>
      ),
    },
    {
      key: "covers",
      header: "Covers",
      value: (p) => p.asset ?? p.category ?? p.facility ?? "",
      render: (p) =>
        p.asset ? (
          <AssetTag tagNo={p.asset} size="sm" />
        ) : p.category ? (
          <Chip hue={hueFor(p.category)} dot>
            {p.category} · {p.targets.length}
          </Chip>
        ) : (
          <span className="text-sm text-neutral-700">{p.facility ?? "-"}</span>
        ),
    },
    { key: "lead", header: "Raised ahead", hideOnMobile: true, value: (p) => p.leadDays, render: (p) => <span className="text-sm tabular-nums text-neutral-700">{p.leadDays} days</span> },
    { key: "who", header: "Assigned to", hideOnMobile: true, value: (p) => p.assignee ?? "", render: (p) => <span className="text-sm text-neutral-700">{p.assignee ?? "-"}</span> },
    {
      key: "next",
      header: "Next due",
      sortable: true,
      value: (p) => p.targets.map((t) => t.nextDueOn).filter(Boolean).sort()[0] ?? "9999",
      render: (p) => {
        const next = p.targets.map((t) => t.nextDueOn).filter((d): d is string => Boolean(d)).sort()[0];
        return next ? <span className={cx("text-sm tabular-nums", next < today ? "font-semibold text-rose-700" : "text-neutral-700")}>{day(next)}</span> : <span className="text-sm text-neutral-500">By usage</span>;
      },
    },
    {
      key: "active",
      header: "State",
      value: (p) => (p.active ? 1 : 0),
      render: (p) =>
        p.active ? (
          <Chip hue="mint" icon={CircleCheck}>
            Active
          </Chip>
        ) : (
          <Chip icon={PauseCircle}>Paused</Chip>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Planned servicing: by the calendar, by the meter, or whichever comes first."
        actions={
          can("create_plan") ? (
            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
              Add a plan
            </Button>
          ) : undefined
        }
        tabs={maintenanceTabs()}
        activeTab="plans"
      />

      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Active plans" value={plans.filter((p) => p.active).length} icon={ListChecks} hint={`${rows.length} assets and sites covered`} />
          <StatCard label="Due in 12 weeks" value={inWindow.length - late.length} icon={CalendarClock} hue="sky" hint={later ? `${later} more after that` : "Nothing further out"} />
          <StatCard label="Past due" value={late.length} icon={TimerReset} hue={late.length ? "rose" : "mint"} hint={late.length ? "Service date gone by" : "Nothing late"} />
          <StatCard label="Meters at their limit" value={usageDue} icon={Gauge} hue={usageDue ? "sun" : "mint"} hint="Hours or km reached" />
        </StatGrid>

        <Panel title="The next 12 weeks" subtitle="Each service on its due date; the shaded run before it is when its work order is raised" icon={CalendarRange} hue="blue">
          {inWindow.length === 0 ? (
            <Empty
              icon={CalendarRange}
              hue="blue"
              title="Nothing falls due in the next 12 weeks"
              hint={plans.length === 0 ? "Add a plan to schedule servicing." : "Plans that run by usage alone show under Meters below."}
            />
          ) : (
            <Timeline rows={inWindow} start={start} today={today} />
          )}
        </Panel>

        <Panel title="Meters" subtitle="Running hours and km since the last service, against each plan's limit" icon={Gauge} hue="sun">
          {usageRows.length === 0 ? (
            <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">No plan counts hours or km yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {usageRows.map(({ plan, target }) => {
                const now = current(target.assetId as string, plan.usageUnit);
                const since = now === null ? null : now - (target.lastDoneUsage ?? 0);
                const g = since === null ? null : usageProgress(since, plan.everyUsage as number);
                const unit = plan.usageUnit ?? "hours";
                return (
                  <li key={target.id} className="grid gap-3 py-3.5 sm:grid-cols-[15rem_minmax(0,1fr)_auto] sm:items-center">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{plan.name}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <AssetTag tagNo={target.tagNo} size="sm" />
                        <span className="truncate text-xs text-neutral-500">{target.name}</span>
                      </span>
                    </span>
                    <span className="block">
                      {g === null || since === null ? (
                        <span className="ws-hatch block rounded-full px-3 py-1 text-xs text-neutral-600">No reading yet</span>
                      ) : (
                        <>
                          <span className="ws-hatch block h-2.5 overflow-hidden rounded-full" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, g.pct))} aria-label={`${plan.name} on ${target.tagNo ?? target.name}: ${since} of ${plan.everyUsage} ${unit} since the last service`}>
                            <span className={cx("block h-full rounded-full", HUE[g.hue].bar)} style={{ width: `${Math.min(100, g.pct)}%` }} />
                          </span>
                          <span className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
                            <span className="tabular-nums text-neutral-600">
                              {since.toLocaleString("en-GB")} of {(plan.everyUsage as number).toLocaleString("en-GB")} {unit} since the last service
                            </span>
                            <span className={cx("font-semibold", HUE[g.hue].text)}>{g.pct >= 100 ? "Service due now" : `${g.left.toLocaleString("en-GB")} ${unit} to go`}</span>
                          </span>
                        </>
                      )}
                    </span>
                    {can("reading") && (
                      <Button size="sm" icon={Gauge} onClick={() => setReading({ asset: { id: target.assetId as string, tagNo: target.tagNo, name: target.name }, unit, last: now })}>
                        Record reading
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <section aria-labelledby="plans-heading">
          <div className="mb-3">
            <h2 id="plans-heading" className="text-base font-bold tracking-tight text-neutral-900">
              Plans
            </h2>
            <p className="text-xs text-neutral-500">
              {plans.length} {plans.length === 1 ? "plan" : "plans"}
              {can("update_plan") ? ". Open one to read it, change it or pause it." : ". Open one to read it."}
            </p>
          </div>
          <DataView
            rows={plans}
            columns={columns}
            rowKey={(p) => p.id}
            onRowClick={(p) => setViewing(p)}
            onDownload={(list) =>
              downloadCsv(csvName("maintenance-plans", today), [
                ["Plan", "Covers", "Asset", "Category", "Site", "Every (months)", "Every (usage)", "Usage unit", "Raised ahead (days)", "Assigned to", "Targets", "Next due", "Active", "Checklist"],
                ...list.map((p) => [
                  p.name,
                  p.asset ? "Asset" : p.category ? "Category" : "Site",
                  p.asset ?? "",
                  p.category ?? "",
                  p.facility ?? "",
                  p.everyMonths ?? "",
                  p.everyUsage ?? "",
                  p.usageUnit ?? "",
                  p.leadDays,
                  p.assignee ?? "",
                  p.targets.length,
                  csvDate(p.targets.map((t) => t.nextDueOn).filter((d): d is string => Boolean(d)).sort()[0]),
                  p.active ? "Yes" : "No",
                  p.checklist ?? "",
                ]),
              ])
            }
            storageKey="ops-maintenance-plans"
            views={["table", "list"]}
            searchPlaceholder="Search plans"
            caption="Maintenance plans"
            empty={<Empty icon={ListChecks} hue="blue" title="No plans yet" hint="Add one for anything that needs regular servicing." />}
          />
        </section>
      </div>

      {viewing && <PlanDrawer plan={viewing} today={today} onClose={() => setViewing(null)} onEdit={can("update_plan") ? () => setEditing(viewing) : undefined} />}
      {editing && (
        <PlanDialog
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            setEditing(null);
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
      {reading && (
        <ReadingDialog
          asset={reading.asset}
          unit={reading.unit}
          last={reading.last}
          onClose={() => setReading(null)}
          onDone={(m) => {
            setReading(null);
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/**
 * Twelve weeks across, one row per plan target. A dot on the due date (red
 * when it has gone by, pinned to the left edge), the lead window before it
 * shaded, today drawn as a line through every row.
 */
function Timeline({ rows, start, today }: { rows: Row[]; start: string; today: string }) {
  const span = WEEKS * 7;
  const at = (ymd: string) => Math.max(0, Math.min(100, (100 * daysBetween(start, ymd)) / span));
  const todayAt = at(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(start, i * 7));
  return (
    <figure>
      <div className="hidden grid-cols-[14rem_minmax(0,1fr)] gap-4 sm:grid" aria-hidden>
        <span />
        <div className="grid grid-cols-12 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {weeks.map((w) => (
            <span key={w} className="truncate border-l border-neutral-200 pl-1.5 tabular-nums">
              {day(w).split(" ").slice(0, 2).join(" ")}
            </span>
          ))}
        </div>
      </div>
      <ul className="mt-2 space-y-2">
        {rows.map(({ plan, target }) => {
          const due = target.nextDueOn as string;
          const isLate = due < today;
          const hue = isLate ? "rose" : hueFor(plan.name);
          const leadFrom = at(addDays(due, -plan.leadDays));
          const dueAt = at(due);
          const left = daysBetween(today, due);
          const say = `${plan.name}, ${target.tagNo ?? target.name ?? "site"}: due ${day(due)}${isLate ? `, ${-left} days late` : left === 0 ? ", today" : `, in ${left} days`}`;
          return (
            <li key={target.id} className="grid gap-1.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center sm:gap-4">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-neutral-900">{plan.name}</span>
                <span className="block truncate text-xs text-neutral-500">{[target.tagNo, target.name ?? plan.facility].filter(Boolean).join(" · ")}</span>
              </span>
              <div role="img" aria-label={say} className="relative h-8 rounded-xl bg-neutral-50">
                <div className="pointer-events-none absolute inset-0 grid grid-cols-12" aria-hidden>
                  {weeks.map((w) => (
                    <span key={w} className="border-l border-neutral-200/70" />
                  ))}
                </div>
                {!isLate && <span className={cx("absolute inset-y-1.5 rounded-md opacity-70", HUE[hue].soft)} style={{ left: `${leadFrom}%`, width: `${Math.max(1, dueAt - leadFrom)}%` }} aria-hidden />}
                <span className="absolute top-1/2 h-full w-0.5 -translate-y-1/2 bg-primary-500/60" style={{ left: `${todayAt}%` }} aria-hidden />
                <span className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center" style={{ left: `${isLate ? 1.5 : dueAt}%` }} aria-hidden>
                  <span className={cx("h-3.5 w-3.5 rounded-full ring-2 ring-white", HUE[hue].dot)} />
                </span>
                <span
                  className={cx("absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums", isLate ? "text-rose-700" : "text-neutral-700")}
                  style={dueAt > 70 && !isLate ? { right: `${100 - dueAt + 2}%` } : { left: `${(isLate ? 1.5 : dueAt) + 2}%` }}
                  aria-hidden
                >
                  {isLate ? `${-left} days late` : day(due).split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-primary-500/60" aria-hidden />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded bg-sky-50 ring-1 ring-sky-100" aria-hidden />
          Work order raised
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden />
          Past due
        </span>
      </figcaption>
    </figure>
  );
}

/** A plan read in full: how often, what it covers, who does it, and where each asset or site it covers stands. */
function PlanDrawer({ plan, today, onClose, onEdit }: { plan: MaintenancePlan; today: string; onClose: () => void; onEdit?: () => void }) {
  return (
    <DetailDrawer
      title={plan.name}
      subtitle={frequencyText(plan)}
      icon={ListChecks}
      hue="blue"
      onClose={onClose}
      onEdit={onEdit}
      editLabel="Edit the plan"
      status={
        plan.active ? (
          <Chip hue="mint" icon={CircleCheck}>
            Active
          </Chip>
        ) : (
          <Chip icon={PauseCircle}>Paused</Chip>
        )
      }
      facts={[
        { label: "How often", value: frequencyText(plan) },
        { label: "Raised ahead", value: `${plan.leadDays} days` },
        { label: "Asset", value: plan.asset },
        { label: "Category", value: plan.category },
        { label: "Site", value: plan.facility },
        { label: "Assigned to", value: plan.assignee },
        { label: "Vendor", value: plan.vendorId ? "On record" : null },
        { label: "Service contract", value: plan.contractId ? "Linked" : null },
        { label: "Checklist", value: plan.checklist ? <span className="whitespace-pre-line font-normal">{plan.checklist}</span> : null, wide: true },
      ]}
      sections={[
        {
          title: "What it covers",
          empty: "Nothing is covered yet.",
          children:
            plan.targets.length > 0 ? (
              <DetailList
                rows={plan.targets.map((t) => ({
                  key: t.id,
                  main: [t.tagNo, t.name ?? plan.facility].filter(Boolean).join(" · ") || "Site",
                  sub: [t.lastDoneOn ? `Last done ${day(t.lastDoneOn)}` : "Not done yet", t.lastDoneUsage !== null ? `at ${t.lastDoneUsage.toLocaleString("en-GB")} ${plan.usageUnit ?? ""}`.trim() : null].filter(Boolean).join(" · "),
                  aside: t.nextDueOn ? <span className={cx(t.nextDueOn < today ? "font-semibold text-rose-700" : "text-neutral-700")}>Due {day(t.nextDueOn)}</span> : <span className="text-neutral-500">By usage</span>,
                }))}
              />
            ) : null,
        },
      ]}
    />
  );
}
