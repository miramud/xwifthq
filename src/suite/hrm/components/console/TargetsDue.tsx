"use client";

import { useEffect, useState } from "react";
import { AlarmClock, CalendarClock, Flag, HelpCircle, Target } from "lucide-react";
import { hrm, type Kpi, type Milestone } from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import { Chip, Empty, Panel, Progress, StatCard, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { DateLeaf, LoadFailed, Notice, PageSkeleton, PersonCell } from "../ui2/kit";

/** Anything falling due inside this window is worth chasing now. */
const HORIZON_DAYS = 60;

/**
 * Targets and milestones across everybody, rather than one person at a time.
 *
 * The rest of the performance board is built around opening a person and
 * looking at their record, which answers "how is she doing" and cannot answer
 * "what is about to be missed". Those are different jobs: the first is an
 * appraisal conversation and the second is the reason to have it before the
 * date rather than after.
 *
 * Two things it keeps apart.
 *
 * **A target with no readings is not a target at 0%.** It is a target nobody
 * has measured, which is a different failure and belongs to whoever set it
 * rather than to the person it was set for.
 *
 * **Overdue and due soon are separate lists.** A milestone three weeks out is
 * ordinary; one whose date has passed is a conversation that should already
 * have happened. Merging them is how the second gets lost among the first.
 */

function attainmentHue(value: number | null): Hue {
  if (value === null) return "sun";
  if (value >= 100) return "mint";
  if (value >= 80) return "sky";
  return "sun";
}

export default function TargetsDue() {
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [overdue, setOverdue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      hrm.performance.kpis({ status: "active" }),
      hrm.performance.milestones({ days: HORIZON_DAYS }),
    ])
      .then(([targets, due]) => {
        if (cancelled) return;
        setKpis(targets);
        setMilestones(due.data);
        setOverdue(due.meta.overdue);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return <LoadFailed message={error} />;
  }

  if (kpis === null || milestones === null) {
    return <PageSkeleton />;
  }

  /*
    Never measured is its own state. A target sitting at "no readings" three
    weeks from its end date is a management failure rather than a performance
    one, and scoring it as zero would put that on the wrong person.
  */
  const unmeasured = kpis.filter(
    (kpi) => kpi.attainment === null && kpi.daysRemaining <= HORIZON_DAYS,
  );

  const late = milestones.filter((m) => m.isOverdue);
  const soon = milestones.filter((m) => !m.isOverdue && m.isOpen);

  const milestoneColumns: Column<Milestone>[] = [
    {
      key: "title",
      header: "Milestone",
      primary: true,
      sortable: true,
      value: (m) => m.title,
      render: (m) => <span className="font-semibold text-neutral-900">{m.title}</span>,
    },
    {
      key: "person",
      header: "Person",
      sortable: true,
      value: (m) => m.employee?.name ?? "",
      render: (m) =>
        m.employee ? (
          <PersonCell
            size={30}
            name={m.employee.name ?? "Unnamed"}
            sub={m.employee.jobTitle}
            href={`/suite/hrm/people/${m.employeeId}`}
          />
        ) : (
          "Unnamed"
        ),
    },
    { key: "due", header: "Due", sortable: true, value: (m) => m.dueOn, render: (m) => formatDate(m.dueOn) },
    {
      key: "status",
      header: "Status",
      value: (m) => m.statusLabel,
      render: (m) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {m.isOverdue && <Chip hue="rose">{m.daysLate}d over</Chip>}
          <Chip>{m.statusLabel}</Chip>
        </span>
      ),
    },
  ];

  const milestoneCard = (m: Milestone) => (
    <div className="flex h-full gap-4 p-5">
      <DateLeaf date={m.dueOn} hue={m.isOverdue ? "rose" : "grape"} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-neutral-900">{m.title}</p>
        <p className="truncate text-xs text-neutral-500">{m.employee?.name ?? "Unnamed"}</p>
        <span className="mt-auto flex flex-wrap items-center gap-1.5">
          {m.isOverdue && <Chip hue="rose">{m.daysLate}d over</Chip>}
          <Chip>{m.statusLabel}</Chip>
        </span>
      </div>
    </div>
  );

  const kpiColumns: Column<Kpi>[] = [
    {
      key: "title",
      header: "Target",
      primary: true,
      sortable: true,
      value: (k) => k.title,
      render: (k) => (
        <span className="min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{k.title}</span>
          <span className="block truncate text-xs text-neutral-500">{k.directionLabel.toLowerCase()}</span>
        </span>
      ),
    },
    {
      key: "person",
      header: "Person",
      sortable: true,
      value: (k) => k.employee?.name ?? "",
      render: (k) => <PersonCell size={30} name={k.employee?.name ?? "Unnamed"} sub={k.employee?.jobTitle} />,
    },
    {
      key: "left",
      header: "Time left",
      sortable: true,
      value: (k) => k.daysRemaining,
      render: (k) =>
        k.daysRemaining < 0 ? (
          <span className="font-semibold text-coral-700">{Math.abs(k.daysRemaining)} days over</span>
        ) : (
          `${k.daysRemaining} days left`
        ),
      hideOnMobile: true,
    },
    {
      key: "attainment",
      header: "Attainment",
      sortable: true,
      value: (k) => k.attainment,
      render: (k) =>
        k.attainment === null ? (
          <Chip hue="sun" icon={HelpCircle}>
            Never measured
          </Chip>
        ) : (
          <Chip hue={attainmentHue(k.attainment)}>{k.attainment}%</Chip>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard featured icon={AlarmClock} label="Milestones overdue" value={String(overdue)} hint="Past their date" />
        <StatCard icon={CalendarClock} hue="grape" label="Due soon" value={String(soon.length)} hint={`In the next ${HORIZON_DAYS} days`} />
        <StatCard icon={Target} hue="sky" label="Active targets" value={String(kpis.length)} hint="Being measured now" />
        <StatCard icon={HelpCircle} hue="sun" label="Never measured" value={String(unmeasured.length)} hint="Ending with no readings" />
      </StatGrid>

      {unmeasured.length > 0 && (
        <Notice tone="warning">
          <h2 className="font-semibold text-neutral-900">
            {unmeasured.length}{" "}
            {unmeasured.length === 1 ? "target has" : "targets have"} never been
            measured
          </h2>
          <p className="mt-0.5 text-neutral-700">
            Each is inside {HORIZON_DAYS} days of its end date with no readings
            at all. A target nobody measured cannot be scored, and that is not
            the fault of the person it was set for.
          </p>
        </Notice>
      )}

      <Panel
        title="Milestones overdue"
        subtitle={
          overdue === 0
            ? "Nothing is past its date."
            : `${overdue} past their date across your organisation.`
        }
        icon={AlarmClock}
        hue="rose"
      >
        <DataView
          rows={late}
          columns={milestoneColumns}
          rowKey={(m) => m.id}
          storageKey="hrm.performance.overdue"
          caption="Milestones past their date"
          searchPlaceholder="Search milestones"
          renderCard={milestoneCard}
          empty={
            <Empty
              icon={Flag}
              hue="mint"
              title="Nothing overdue"
              hint="Milestones with a date in the future appear below."
            />
          }
        />
      </Panel>

      <Panel title={`Due in the next ${HORIZON_DAYS} days`} icon={CalendarClock} hue="grape">
        <DataView
          rows={soon}
          columns={milestoneColumns}
          rowKey={(m) => m.id}
          storageKey="hrm.performance.dueSoon"
          caption={`Milestones due in the next ${HORIZON_DAYS} days`}
          searchPlaceholder="Search milestones"
          renderCard={milestoneCard}
          empty={<p className="px-6 py-10 text-center text-sm text-neutral-500">Nothing falling due.</p>}
        />
      </Panel>

      <Panel
        title="Active targets"
        subtitle="Everything currently being measured, across everybody."
        icon={Target}
        hue="sky"
      >
        <DataView
          rows={kpis}
          columns={kpiColumns}
          rowKey={(k) => k.id}
          storageKey="hrm.performance.targets"
          caption="Active targets across everybody"
          searchPlaceholder="Search targets or people"
          empty={
            <Empty
              icon={Target}
              title="No active targets"
              hint="Targets are set on somebody's performance record."
            />
          }
          renderCard={(k) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{k.title}</p>
                  <p className="text-xs text-neutral-500">{k.directionLabel}</p>
                </div>
                {k.attainment === null ? (
                  <Chip hue="sun">Never measured</Chip>
                ) : (
                  <Chip hue={attainmentHue(k.attainment)}>{k.attainment}%</Chip>
                )}
              </div>
              <Progress value={Math.min(100, k.attainment ?? 0)} hue={attainmentHue(k.attainment)} />
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                <PersonCell size={28} name={k.employee?.name ?? "Unnamed"} />
                <span className="shrink-0 text-xs text-neutral-500">
                  {k.daysRemaining < 0 ? `${Math.abs(k.daysRemaining)} days over` : `${k.daysRemaining} days left`}
                </span>
              </div>
            </div>
          )}
        />
      </Panel>
    </div>
  );
}
