"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Clock,
  Download,
  Network,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { Chip, Empty, Panel, StatGrid, buttonClass, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { FaceAvatar, StatCard } from "@/suite/lms/components/ui/ws";
import { compliance, type ComplianceReport } from "@/lib/api/admin-client";

type OverdueRow = ComplianceReport["overdueList"][number];

/**
 * Who has not done the training they were told to do.
 *
 * The report a regulated institution is actually asked for. Course analytics
 * answer "how many people finished this"; an inspector asks "show me the named
 * people who were required to and have not", and this is that.
 *
 * Two things the screen refuses to do.
 *
 * It does not report one number for outstanding and overdue. A course with a
 * deadline in June is outstanding and entirely fine; one whose date has passed
 * is a finding. Merging them makes the dashboard permanently red and therefore
 * permanently ignored.
 *
 * And it does not stop at percentages. The overdue list names people, because
 * what somebody does with a compliance report is work through it person by
 * person — and it downloads, because they will do that in a spreadsheet
 * whether or not we offer one.
 */
export default function ComplianceBoard() {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    compliance
      .get()
      .then((result) => {
        if (!cancelled) setReport(result.data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return (
      <Panel title="Compliance" icon={AlertTriangle} hue="coral">
        <Empty icon={AlertTriangle} hue="coral" title="That did not load" hint={error} />
      </Panel>
    );
  }

  if (report === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-[1.125rem] bg-neutral-200/60" />
        ))}
      </div>
    );
  }

  const { totals } = report;

  const titleLine = (row: OverdueRow) => (
    <p className="truncate text-xs text-neutral-500">
      {row.title}
      {row.kind === "path" ? " · learning path" : ""}
      {/*
        A renewal and a no-show are both overdue and need different handling:
        one person has done this training before and needs booking onto a
        refresher, the other never started. Saying which stops the list
        reading as if everybody on it ignored you.
      */}
      {row.isRenewal ? " · certificate lapsed" : ""}
    </p>
  );

  const dueLine = (row: OverdueRow) => (
    <span className="whitespace-nowrap text-xs text-neutral-500">
      {row.isRenewal ? "expired" : "due"} {row.dueAt}
    </span>
  );

  const lateChip = (row: OverdueRow) =>
    row.daysOverdue === null ? null : (
      <Chip hue={row.daysOverdue > 30 ? "rose" : "coral"}>{row.daysOverdue}d late</Chip>
    );

  const columns: Column<OverdueRow>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.name ?? "",
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <FaceAvatar name={r.name ?? "Unnamed"} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</span>
            {titleLine(r)}
          </span>
        </span>
      ),
    },
    { key: "due", header: "Date", sortable: true, value: (r) => r.dueAt, render: dueLine },
    {
      key: "late",
      header: "Late by",
      align: "right",
      sortable: true,
      value: (r) => r.daysOverdue,
      render: lateChip,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-neutral-600">
          <CalendarClock size={15} className="text-neutral-400" aria-hidden />
          Mandatory training only, as at {report.asAt}.
        </p>
        <a href={compliance.csvUrl()} className={buttonClass("secondary", "sm")}>
          <Download size={15} aria-hidden />
          Overdue list
        </a>
      </div>

      <StatGrid>
        <StatCard
          featured
          featuredHue="grape"
          icon={ShieldCheck}
          label="Fully compliant"
          value={`${totals.compliancePercent}%`}
          hint={`${totals.peopleFullyCompliant} of ${totals.people} people`}
        />
        {/*
          Kept apart from overdue. Outstanding with a future deadline is the
          normal state of a healthy institution, not a problem.
        */}
        <StatCard icon={Clock} hue="sky" label="Outstanding" value={String(totals.outstanding)} hint="Assigned and not yet done" />
        <StatCard
          icon={Siren}
          hue={totals.overdue > 0 ? "rose" : "slate"}
          label="Overdue"
          value={String(totals.overdue)}
          hint="Past its date"
        />
        <StatCard
          icon={CalendarClock}
          hue={totals.dueSoon > 0 ? "sun" : "slate"}
          label="Due within a month"
          value={String(totals.dueSoon)}
          hint="Worth chasing now"
        />
      </StatGrid>

      {/* --------------------------- the list ------------------------ */}

      <section aria-labelledby="overdue-heading">
        <div className="mb-3">
          <h2 id="overdue-heading" className="text-lg font-semibold text-neutral-900">
            Overdue
          </h2>
          <p className="text-sm text-neutral-500">Named, because this is a list of people to chase.</p>
        </div>
        <DataView
          rows={report.overdueList}
          columns={columns}
          rowKey={(r) => `${r.userId}-${r.title}-${r.dueAt}`}
          storageKey="lms.compliance.overdue"
          caption="Overdue mandatory training"
          searchPlaceholder="Search people or courses"
          matches={(r, q) => (r.name ?? "").toLowerCase().includes(q) || r.title.toLowerCase().includes(q)}
          empty={
            report.overdueList.length === 0 ? (
              <Empty
                icon={ShieldCheck}
                hue="mint"
                title="Nobody is overdue"
                hint="Everything mandatory is either done or still within its deadline."
              />
            ) : undefined
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <FaceAvatar name={r.name ?? "Unnamed"} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                  {titleLine(r)}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                {dueLine(r)}
                {lateChip(r)}
              </div>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3">
              <FaceAvatar name={r.name ?? "Unnamed"} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{r.name ?? "Unnamed"}</p>
                {titleLine(r)}
              </div>
              {dueLine(r)}
              {lateChip(r)}
            </div>
          )}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown
          title="By course"
          subtitle="Worst first."
          icon={BookOpen}
          rows={report.byCourse.map((r) => ({
            label: r.title,
            assigned: r.assigned,
            overdue: r.overdue,
            percent: r.completePercent,
          }))}
        />

        <Breakdown
          title="By department"
          subtitle="Somebody with no employment record shows as no department."
          icon={Network}
          rows={report.byDepartment.map((r) => ({
            label: r.department,
            assigned: r.assigned,
            overdue: r.overdue,
            percent: r.completePercent,
          }))}
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  subtitle,
  icon,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: typeof BookOpen;
  rows: { label: string; assigned: number; overdue: number; percent: number }[];
}) {
  return (
    <Panel title={title} subtitle={subtitle} icon={icon} hue={title === "By course" ? "grape" : "sky"}>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing mandatory has been assigned yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-neutral-800">{row.label}</span>
                <span className="flex items-center gap-2">
                  {row.overdue > 0 && <Chip hue="rose">{row.overdue} late</Chip>}
                  <span className="text-sm font-semibold tabular-nums text-neutral-900">{row.percent}%</span>
                </span>
              </div>
              <div className="ws-hatch h-2.5 overflow-hidden rounded-full" aria-hidden>
                <div
                  className={cx("h-full rounded-full", row.overdue > 0 ? "bg-sun-400" : "bg-mint-500")}
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
