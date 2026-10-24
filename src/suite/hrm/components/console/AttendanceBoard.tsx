"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  PieChart,
  Settings2,
  Timer,
  TrendingUp,
  UserCheck,
  UserX,
  Zap,
} from "lucide-react";
import {
  ApiError,
  hrm,
  type AttendanceDay,
  type AttendanceGroup,
  type AttendanceReport,
  type AttendanceState,
  type OvertimeRule,
} from "@/lib/api/hrm-client";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, Donut, SegmentedGauge, StatusBars } from "@/components/workspace/charts";
import type { Hue } from "@/components/workspace/modules";
import {
  DateLeaf,
  LoadFailed,
  ModalFrame,
  Notice,
  PageSkeleton,
  PersonCell,
  Skeleton,
  ToneChip,
  inputCls,
} from "../ui2/kit";
import { CheckField, FormButtons, FormField, SectionHead } from "../ui2/leave-form";
import {
  attendanceTone,
  formatDate,
  formatDayMonth,
  formatMinutes,
  formatVariance,
} from "@/suite/hrm/lib/format";

/**
 * Who turned up, and what the difference cost.
 *
 * The exception list is the screen that gets read, and the reason it is worth
 * reading is that authorised absence has already been taken out of it. Every
 * row is genuinely unaccounted for, which is what makes it reasonable to pick
 * up the phone about.
 *
 * The attendance rate deliberately excludes leave and closures from its
 * denominator rather than counting them as successes. A week with two public
 * holidays would otherwise flatter everybody, and a rate that rewards the
 * calendar is a rate nobody should act on.
 */

type Tab = "summary" | "exceptions" | "overtime";

const TABS: { key: Tab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "exceptions", label: "Unexplained" },
  { key: "overtime", label: "Overtime rules" },
];

/** A fortnight back, which is the window most of these questions are asked in. */
function defaultWindow(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/* Only `absent` is red: authorised absence must never look like a problem. */
const STATE_META: Record<AttendanceState, { label: string; hue: Hue }> = {
  worked: { label: "Worked", hue: "mint" },
  late: { label: "Late", hue: "sun" },
  on_leave: { label: "On leave", hue: "sky" },
  holiday: { label: "Holiday", hue: "grape" },
  absent: { label: "Absent", hue: "rose" },
  scheduled: { label: "Scheduled", hue: "slate" },
  open: { label: "Still open", hue: "blue" },
};

function rateHue(rate: number | null): Hue {
  if (rate === null) return "slate";
  return rate >= 95 ? "mint" : rate >= 85 ? "sun" : "rose";
}

export default function AttendanceBoard() {
  const [tab, setTab] = useState<Tab>("summary");
  const [range] = useState(defaultWindow);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Attendance"
        subtitle={`The last two weeks, ${formatDate(range.from)} to ${formatDate(range.to)}. Leave and closures are already reconciled.`}
        tabs={TABS}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {tab === "summary" && <Summary range={range} />}
      {tab === "exceptions" && <Exceptions range={range} />}
      {tab === "overtime" && <Rules />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Summary({ range }: { range: { from: string; to: string } }) {
  const [groupBy, setGroupBy] = useState<"department" | "location">("department");
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.attendance
      .report({ ...range, groupBy })
      .then((res) => {
        if (cancelled) return;
        setReport(res);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [range, groupBy]);

  if (error !== null) {
    return <LoadFailed icon={UserCheck} title="That did not load" message={error} />;
  }

  if (report === null) {
    return <PageSkeleton />;
  }

  const { totals } = report;

  const donut = (Object.keys(STATE_META) as AttendanceState[])
    .map((state) => ({ label: STATE_META[state].label, value: totals.counts[state] ?? 0, hue: STATE_META[state].hue }))
    .filter((d) => d.value > 0);

  const groupToggle = (
    <Segmented
      label="Group by"
      options={[
        { key: "department", label: "Department" },
        { key: "location", label: "Location" },
      ]}
      value={groupBy}
      onChange={setGroupBy}
    />
  );

  const columns: Column<AttendanceGroup>[] = [
    {
      key: "label",
      header: groupBy === "department" ? "Department" : "Location",
      primary: true,
      sortable: true,
      value: (g) => g.label,
      render: (g) => <span className="font-semibold text-neutral-900">{g.label}</span>,
    },
    { key: "people", header: "People", align: "right", sortable: true, value: (g) => g.people },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sortable: true,
      value: (g) => g.attendanceRate,
      render: (g) => (g.attendanceRate === null ? "-" : `${g.attendanceRate}%`),
    },
    { key: "late", header: "Late", align: "right", sortable: true, value: (g) => g.lateDays },
    {
      key: "unexplained",
      header: "Unexplained",
      align: "right",
      sortable: true,
      value: (g) => g.unexplainedDays,
      render: (g) =>
        g.unexplainedDays === 0 ? (
          <span className="text-neutral-400">-</span>
        ) : (
          <span className="font-semibold text-error-700">{g.unexplainedDays}</span>
        ),
    },
    {
      key: "variance",
      header: "vs plan",
      align: "right",
      sortable: true,
      value: (g) => g.varianceMinutes,
      render: (g) => formatVariance(g.varianceMinutes),
    },
  ];

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard
          featured
          icon={UserCheck}
          label="Attendance"
          value={totals.attendanceRate === null ? "-" : `${totals.attendanceRate}%`}
          hint="Leave and closures excluded"
        />
        <StatCard
          icon={AlertTriangle}
          label="Unexplained days"
          value={String(totals.unexplainedDays)}
          hue="rose"
          hint={totals.unexplainedDays === 0 ? "Nothing to chase" : "Needs following up"}
        />
        <StatCard
          icon={Timer}
          label="Late arrivals"
          value={String(totals.lateDays)}
          hue="sun"
          hint={formatMinutes(totals.lateMinutes) + " in total"}
        />
        <StatCard
          icon={TrendingUp}
          label="Hours against plan"
          value={formatVariance(totals.varianceMinutes)}
          hue="grape"
          hint={`${formatMinutes(totals.workedMinutes)} worked`}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Attendance by group"
          subtitle={`${formatDate(report.from)} to ${formatDate(report.to)}`}
          icon={BarChart3}
          actions={groupToggle}
        >
          {report.groups.length === 0 ? (
            <Empty icon={UserCheck} title="Nothing in this window" hint="No expected days fall in the range." />
          ) : (
            <ColumnChart
              data={report.groups.map((g) => ({
                label: g.label,
                value: g.attendanceRate ?? 0,
                max: 100,
                hue: rateHue(g.attendanceRate),
              }))}
              format={(v) => `${v}%`}
              height={220}
              caption={`Attendance rate by ${groupBy}`}
            />
          )}
        </Panel>

        <Panel title="Overall rate" subtitle="Worked days over expected days" icon={Gauge} hue="mint">
          <div className="flex h-full flex-col items-center justify-center gap-4 pt-2">
            <SegmentedGauge
              value={totals.attendanceRate ?? 0}
              hue={rateHue(totals.attendanceRate)}
              label="Attendance"
              display={totals.attendanceRate === null ? "-" : `${totals.attendanceRate}%`}
              caption={`${totals.days} expected days in the window`}
            />
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="rounded-xl bg-mint-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-mint-700">Worked</p>
                <p className="text-lg font-bold text-neutral-900 tabular-nums">{formatMinutes(totals.workedMinutes)}</p>
              </div>
              <div className="rounded-xl bg-neutral-100 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-neutral-600">Expected</p>
                <p className="text-lg font-bold text-neutral-900 tabular-nums">{formatMinutes(totals.expectedMinutes)}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="How the days went" subtitle="Every expected day, by what happened" icon={PieChart} hue="sky">
          {donut.length === 0 ? (
            <Empty icon={PieChart} title="No days to count yet" />
          ) : (
            <Donut data={donut} centerLabel="days" caption="Expected days by outcome" />
          )}
        </Panel>

        <Panel title="Overtime" subtitle="Payable time by kind" icon={Zap} hue="coral">
          {totals.overtime.length === 0 ? (
            <Empty icon={Zap} hue="coral" title="No overtime in this window" />
          ) : (
            <div className="space-y-5">
              <StatusBars
                data={totals.overtime.map((row, i) => ({
                  label: `${row.label} · ${row.multiplier}×`,
                  value: row.payableMinutes,
                  hue: (["coral", "grape", "sky", "sun"] as Hue[])[i % 4],
                }))}
                format={(v) => `${formatMinutes(v)} payable`}
                caption="Payable overtime by kind"
              />
              {/*
                Hours worked outside a cap. Shown rather than dropped,
                somebody regularly working time nobody pays for is a finding,
                not a rounding error.
              */}
              {totals.overtime.some((r) => r.uncappedMinutes > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {totals.overtime
                    .filter((r) => r.uncappedMinutes > 0)
                    .map((r) => (
                      <ToneChip key={r.kind} tone="warning">
                        {r.label}: {formatMinutes(r.uncappedMinutes)} unpaid
                      </ToneChip>
                    ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <section>
        <SectionHead
          title="By group"
          subtitle="The figures behind the charts"
          icon={UserCheck}
          hue="slate"
        />
        <DataView
          rows={report.groups}
          columns={columns}
          rowKey={(g) => g.label}
          storageKey="hrm.attendance.groups"
          caption={`Attendance by ${groupBy}`}
          searchPlaceholder={`Search ${groupBy === "department" ? "departments" : "locations"}`}
          toolbar={groupToggle}
          empty={<Empty icon={UserCheck} title="Nothing in this window" hint="No expected days fall in the range." />}
          renderCard={(g) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{g.label}</p>
                  <p className="text-xs text-neutral-500">
                    {g.people} {g.people === 1 ? "person" : "people"}
                  </p>
                </div>
                <p className="text-[26px] font-bold leading-none text-neutral-900 tabular-nums">
                  {g.attendanceRate === null ? "-" : `${g.attendanceRate}%`}
                </p>
              </div>
              <Progress value={g.attendanceRate ?? 0} hue={rateHue(g.attendanceRate)} />
              <div className="flex flex-wrap gap-1.5">
                <Chip hue="sun" icon={Timer}>
                  {g.lateDays} late
                </Chip>
                {g.unexplainedDays > 0 ? (
                  <ToneChip tone="error" icon={UserX}>
                    {g.unexplainedDays} unexplained
                  </ToneChip>
                ) : (
                  <Chip hue="mint">All explained</Chip>
                )}
                <Chip hue="slate">{formatVariance(g.varianceMinutes)}</Chip>
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Exceptions({ range }: { range: { from: string; to: string } }) {
  const [rows, setRows] = useState<AttendanceDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.attendance
      .exceptions(range)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setError(null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const byDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, n]) => ({ label: formatDayMonth(d), value: n, hue: "rose" as Hue }));
  }, [rows]);

  const people = useMemo(() => new Set((rows ?? []).map((r) => r.employeeId)).size, [rows]);

  const columns: Column<AttendanceDay>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      sortable: true,
      value: (r) => r.employeeName ?? "Unnamed",
      render: (r) => (
        <PersonCell
          name={r.employeeName ?? "Unnamed"}
          sub={`${r.department ?? "No department"}${r.location ? ` · ${r.location}` : ""}`}
        />
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (r) => r.date,
      render: (r) => <span className="tabular-nums">{formatDate(r.date)}</span>,
    },
    { key: "shift", header: "Shift", hideOnMobile: true, value: (r) => r.shift?.name ?? "" },
    {
      key: "expected",
      header: "Expected",
      align: "right",
      value: (r) => r.expectedMinutes,
      render: (r) => formatMinutes(r.expectedMinutes),
    },
    {
      key: "state",
      header: "State",
      sortable: true,
      value: (r) => r.stateLabel,
      render: (r) => (
        <ToneChip tone={attendanceTone(r.state)} dot>
          {r.stateLabel}
        </ToneChip>
      ),
    },
  ];

  if (error !== null) {
    return <LoadFailed icon={AlertTriangle} title="That did not load" message={error} />;
  }

  if (rows === null) {
    return <PageSkeleton stats={0} />;
  }

  return (
    <div className="space-y-6">
      {rows.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard featured label="Unexplained days" value={rows.length} icon={UserX} hint="Worth a phone call each" />
            <StatCard label="People involved" value={people} icon={UserCheck} hue="coral" />
          </div>
          <Panel className="xl:col-span-2" title="Unexplained, day by day" icon={BarChart3} hue="rose">
            <ColumnChart data={byDay} hue="rose" height={170} caption="Unexplained days by date" />
          </Panel>
        </div>
      )}

      <section>
        <SectionHead
          title="Unexplained absence"
          subtitle="Approved and pending leave, and days your organisation was closed, are already excluded."
          icon={AlertTriangle}
          hue="rose"
        />
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.employeeId}|${r.date}`}
          rowHref={(r) => `/suite/hrm/people/${r.employeeId}`}
          storageKey="hrm.attendance.exceptions"
          caption="Unexplained absence"
          searchPlaceholder="Search people, departments"
          empty={
            <Empty
              icon={UserCheck}
              hue="mint"
              title="Everything is accounted for"
              hint="Every expected day in this window was worked, covered by leave, or a closure."
            />
          }
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <PersonCell name={r.employeeName ?? "Unnamed"} sub={r.department ?? "No department"} />
                <ToneChip tone={attendanceTone(r.state)} dot>
                  {r.stateLabel}
                </ToneChip>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3">
                <DateLeaf date={r.date} hue="rose" />
                <div className="min-w-0 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-900">{formatDate(r.date)}</p>
                  <p className="truncate">
                    {r.shift?.name ? `${r.shift.name} · ` : ""}
                    {formatMinutes(r.expectedMinutes)} expected
                  </p>
                  {r.location && <p className="truncate">{r.location}</p>}
                </div>
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Rules() {
  const [rows, setRows] = useState<OvertimeRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OvertimeRule | null>(null);

  const load = useCallback(
    () =>
      hrm.attendance
        .rules()
        .then((res) => {
          setRows(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const caps = (rule: OvertimeRule) =>
    `${rule.dailyCapMinutes === null ? "no daily cap" : `${formatMinutes(rule.dailyCapMinutes)} a day`} · ${
      rule.weeklyCapMinutes === null ? "no weekly cap" : `${formatMinutes(rule.weeklyCapMinutes)} a week`
    }${rule.thresholdMinutes > 0 ? ` · ignored under ${rule.thresholdMinutes}m` : ""}`;

  const change = (rule: OvertimeRule) => (
    <Button size="sm" onClick={() => setEditing(rule)}>
      Change
    </Button>
  );

  const columns: Column<OvertimeRule>[] = [
    {
      key: "kind",
      header: "Kind",
      primary: true,
      sortable: true,
      value: (r) => r.kindLabel,
      render: (r) => <span className="font-semibold text-neutral-900">{r.kindLabel}</span>,
    },
    {
      key: "multiplier",
      header: "Premium",
      align: "right",
      sortable: true,
      value: (r) => r.multiplier,
      render: (r) => <span className="font-semibold text-neutral-900">{r.multiplier}×</span>,
    },
    {
      key: "daily",
      header: "Daily cap",
      align: "right",
      value: (r) => r.dailyCapMinutes,
      render: (r) => (r.dailyCapMinutes === null ? "Uncapped" : formatMinutes(r.dailyCapMinutes)),
    },
    {
      key: "weekly",
      header: "Weekly cap",
      align: "right",
      value: (r) => r.weeklyCapMinutes,
      render: (r) => (r.weeklyCapMinutes === null ? "Uncapped" : formatMinutes(r.weeklyCapMinutes)),
    },
    {
      key: "threshold",
      header: "Ignored under",
      align: "right",
      hideOnMobile: true,
      value: (r) => r.thresholdMinutes,
      render: (r) => (r.thresholdMinutes > 0 ? `${r.thresholdMinutes}m` : "-"),
    },
    {
      key: "active",
      header: "Status",
      value: (r) => (r.isActive ? "On" : "Off"),
      render: (r) => (r.isActive ? <Chip hue="mint" dot>Paid</Chip> : <ToneChip tone="neutral">Off</ToneChip>),
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: change },
  ];

  return (
    <div className="space-y-6">
      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <section>
        <SectionHead
          title="What overtime is worth"
          subtitle="Overtime is paid at more than one rate. Time past a cap is still reported as worked."
          icon={Settings2}
          hue="coral"
        />
        {rows === null ? (
          <Skeleton className="h-40" />
        ) : (
          <DataView
            rows={rows}
            columns={columns}
            rowKey={(r) => r.kind}
            storageKey="hrm.attendance.rules"
            defaultView="grid"
            searchable={false}
            caption="Overtime rules"
            renderCard={(rule) => (
              <div className={cx("flex h-full flex-col gap-4 p-5", !rule.isActive && "opacity-80")}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-neutral-900">{rule.kindLabel}</p>
                  {rule.isActive ? <Chip hue="mint" dot>Paid</Chip> : <ToneChip tone="neutral">Off</ToneChip>}
                </div>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[32px] font-bold leading-none tracking-tight text-neutral-900 tabular-nums">
                    {rule.multiplier}×
                  </span>
                  <span className="text-sm text-neutral-500">per hour</span>
                </p>
                <p className="text-xs text-neutral-600">{caps(rule)}</p>
                <div className="mt-auto border-t border-neutral-100 pt-3">{change(rule)}</div>
              </div>
            )}
            renderListItem={(rule) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{rule.kindLabel}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {rule.multiplier}× · {caps(rule)}
                  </p>
                </div>
                {!rule.isActive && <ToneChip tone="neutral">Off</ToneChip>}
                {change(rule)}
              </div>
            )}
          />
        )}
      </section>

      {editing !== null && (
        <RuleDialog
          rule={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RuleDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: OvertimeRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [multiplier, setMultiplier] = useState(String(rule.multiplier));
  const [dailyCap, setDailyCap] = useState(rule.dailyCapMinutes === null ? "" : String(rule.dailyCapMinutes));
  const [weeklyCap, setWeeklyCap] = useState(rule.weeklyCapMinutes === null ? "" : String(rule.weeklyCapMinutes));
  const [threshold, setThreshold] = useState(String(rule.thresholdMinutes));
  const [isActive, setIsActive] = useState(rule.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      await hrm.attendance.updateRule(rule.kind, {
        multiplier: Number(multiplier),
        // Empty means uncapped, which is a real setting and not the same as
        // zero, a zero cap would mean no overtime is ever payable.
        dailyCapMinutes: dailyCap === "" ? null : Number(dailyCap),
        weeklyCapMinutes: weeklyCap === "" ? null : Number(weeklyCap),
        thresholdMinutes: Number(threshold || 0),
        isActive,
      });

      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFrame
      title={`Change ${rule.kindLabel}`}
      subtitle="Applies to overtime worked from now on"
      icon={Zap}
      hue="coral"
      onClose={onClose}
      onSubmit={submit}
      footer={<FormButtons onCancel={onClose} busy={busy} submitLabel="Save" />}
    >
      <FormField id="ot-mult" label="Premium" hint="1.5 means an hour is paid as an hour and a half.">
        <input
          id="ot-mult"
          type="number"
          aria-describedby="ot-mult-hint"
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          min={1}
          max={10}
          step={0.05}
          required
          className={inputCls}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ot-daily" label="Daily cap (minutes)">
          <input
            id="ot-daily"
            type="number"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            min={0}
            max={1440}
            placeholder="Uncapped"
            className={inputCls}
          />
        </FormField>
        <FormField id="ot-weekly" label="Weekly cap (minutes)">
          <input
            id="ot-weekly"
            type="number"
            value={weeklyCap}
            onChange={(e) => setWeeklyCap(e.target.value)}
            min={0}
            max={10080}
            placeholder="Uncapped"
            className={inputCls}
          />
        </FormField>
      </div>

      <FormField id="ot-threshold" label="Ignore anything under (minutes)" hint="Stops a four-minute overrun becoming a payroll line.">
        <input
          id="ot-threshold"
          type="number"
          aria-describedby="ot-threshold-hint"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          min={0}
          max={480}
          className={inputCls}
        />
      </FormField>

      <CheckField label="Pay this kind of overtime" checked={isActive} onChange={setIsActive} />

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}

