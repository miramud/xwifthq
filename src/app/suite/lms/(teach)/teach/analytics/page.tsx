"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Percent,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Eye,
  BarChart3,
  GraduationCap,
  ChartLine,
  Activity,
  PieChart,
  Filter,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Progress, Segmented, StatGrid } from "@/components/workspace/kit";
import { AreaLine, Donut, Legend, SegmentedGauge } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { IconTile, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import {
  insights,
  analytics,
  ApiError,
  type Engagement,
  type InstructorOverview,
} from "@/lib/api/instructor-client";

function completionHue(rate: number): Hue {
  return rate >= 60 ? "mint" : rate >= 30 ? "sun" : "coral";
}

const FUNNEL_HUES: Hue[] = ["sky", "blue", "grape", "mint"];

export default function InstructorAnalyticsPage() {
  const [eng, setEng] = useState<Engagement | null>(null);
  const [ov, setOv] = useState<InstructorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState<"3" | "6" | "12">("12");

  useEffect(() => {
    let alive = true;
    Promise.all([insights.engagement(), analytics.overview()])
      .then(([e, o]: [Engagement, InstructorOverview]) => {
        if (alive) {
          setEng(e);
          setOv(o);
        }
      })
      .catch((e: unknown) => {
        if (alive) setErr(e instanceof ApiError ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading analytics…</span>
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (err || !eng || !ov) {
    return (
      <Card>
        <Empty
          icon={BarChart3}
          hue="rose"
          title="Couldn't load analytics"
          hint={err ?? "Please try again in a moment."}
        />
      </Card>
    );
  }

  const { totals, trafficSources, funnel, topLessons, dropOffPoints } = eng;
  const tracking = totals.trackingSince != null;
  const funnelTop = funnel[0]?.value || 1;
  const monthly = ov.monthly;
  const windowed = monthly.slice(-Number(period));

  const noTrackingNote = (
    <Empty
      icon={Eye}
      hue="slate"
      title="No page views recorded yet"
      hint="Traffic data starts accumulating from the first visit."
    />
  );

  type Month = (typeof monthly)[number];
  const monthColumns: Column<Month>[] = [
    { key: "month", header: "Month", primary: true, value: (m) => m.fullMonth || m.month },
    { key: "enrollments", header: "Enrollments", align: "right", sortable: true, value: (m) => m.enrollments },
    { key: "completions", header: "Completions", align: "right", sortable: true, value: (m) => m.completions },
    {
      key: "ratio",
      header: "Completed per enrolment",
      align: "right",
      sortable: true,
      value: (m) => (m.enrollments > 0 ? Math.round((m.completions / m.enrollments) * 100) : 0),
      render: (m) => (
        <span className="font-semibold text-neutral-900">
          {m.enrollments > 0 ? `${Math.round((m.completions / m.enrollments) * 100)}%` : "—"}
        </span>
      ),
    },
  ];

  type Lesson = (typeof topLessons)[number];
  const lessonColumns: Column<Lesson>[] = [
    {
      key: "title",
      header: "Lesson",
      primary: true,
      sortable: true,
      value: (l) => l.title,
      render: (l) => (
        <span className="min-w-0">
          <span className="block max-w-[260px] truncate font-medium text-neutral-900">{l.title}</span>
          <span className="block max-w-[260px] truncate text-xs text-neutral-500">{l.course}</span>
        </span>
      ),
    },
    { key: "type", header: "Type", hideOnMobile: true, value: (l) => l.type, render: (l) => <Chip hue={hueFor(l.type)}>{l.type}</Chip> },
    { key: "enrolled", header: "Enrolled", align: "right", sortable: true, hideOnMobile: true, value: (l) => l.enrolled },
    { key: "completions", header: "Completions", align: "right", sortable: true, value: (l) => l.completions },
    {
      key: "completionRate",
      header: "Completion",
      sortable: true,
      value: (l) => l.completionRate,
      render: (l) => (
        <span className="flex min-w-[9rem] items-center gap-2">
          <span className="w-20">
            <Meter value={l.completionRate} size="sm" hue={completionHue(l.completionRate)} label={`${l.title} completion`} />
          </span>
          <Chip hue={completionHue(l.completionRate)}>{l.completionRate}% complete</Chip>
        </span>
      ),
    },
  ];

  type Drop = (typeof dropOffPoints)[number];
  const dropColumns: Column<Drop>[] = [
    {
      key: "lesson",
      header: "Lesson",
      primary: true,
      sortable: true,
      value: (d) => d.lesson,
      render: (d) => (
        <span className="flex items-center gap-3">
          <IconTile icon={AlertTriangle} hue="coral" size={32} />
          <span className="min-w-0">
            <span className="block max-w-[240px] truncate font-medium text-neutral-900">{d.lesson}</span>
            <span className="block max-w-[240px] truncate text-xs text-neutral-500">{d.course}</span>
          </span>
        </span>
      ),
    },
    { key: "lost", header: "Learners lost", align: "right", sortable: true, value: (d) => d.lostLearners },
    {
      key: "dropOff",
      header: "Drop-off",
      align: "right",
      sortable: true,
      value: (d) => d.dropOff,
      render: (d) => <span className="font-bold text-coral-700">{d.dropOff}%</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Engagement, traffic and conversion across your courses."
      />

      {/* stat row */}
      <StatGrid cols={5}>
        <StatCard featured featuredHue="sky" label="Total views" value={formatCompact(totals.views)} icon={Eye} />
        <StatCard label="Unique visitors" value={formatCompact(totals.uniqueVisitors)} icon={Users} hue="blue" />
        <StatCard label="Conversion rate" value={`${totals.conversionRate.toFixed(1)}%`} icon={Percent} hue="grape" hint="visitors who enrol" />
        <StatCard
          label="Avg. quiz score"
          value={totals.avgQuizScore == null ? "—" : `${Math.round(totals.avgQuizScore)}%`}
          icon={GraduationCap}
          hue="sun"
        />
        <StatCard
          label="Avg. completion"
          value={`${ov.totals.avgCompletion}%`}
          delta={ov.totals.completionDelta}
          icon={CheckCircle2}
          hue="mint"
        />
      </StatGrid>

      {/* hero chart + gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Enrollments over time"
          subtitle={`New enrollments against completions · last ${period} months`}
          icon={ChartLine}
          className="lg:col-span-2"
          actions={
            <Segmented
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { key: "3", label: "3M" },
                { key: "6", label: "6M" },
                { key: "12", label: "12M" },
              ]}
            />
          }
        >
          <AreaLine
            data={windowed.map((m) => ({ label: m.month, value: m.enrollments }))}
            compare={windowed.map((m) => ({ label: m.month, value: m.completions }))}
            hue="sky"
            height={250}
            caption={`Enrollments and completions over the last ${period} months`}
            format={(v: number) => v.toLocaleString()}
          />
          <div className="mt-3">
            <Legend
              items={[
                { label: "Enrollments", hue: "sky" },
                { label: "Completions", hue: "slate", dashed: true },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Completion health" subtitle="Average progress across your courses" icon={Activity} hue="mint">
          <div className="flex flex-col items-center">
            <SegmentedGauge
              value={ov.totals.avgCompletion}
              hue="mint"
              label="Average completion"
              display={`${ov.totals.avgCompletion}%`}
            />
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Finish rate</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{ov.totals.completionRate}%</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Completions</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">
                  {formatCompact(ov.totals.completions)}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* supporting: traffic + funnel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Traffic sources" subtitle="Where visitors come from" icon={PieChart} hue="grape">
          {tracking && trafficSources.length > 0 ? (
            <Donut
              legend="below"
              size={170}
              data={trafficSources.map((t) => ({
                label: t.label,
                value: t.visitors,
                hue: hueFor(t.label),
              }))}
              total={formatCompact(totals.uniqueVisitors)}
              centerLabel="Visitors"
              caption="Visitors by traffic source"
            />
          ) : (
            noTrackingNote
          )}
        </Panel>

        <Panel
          title="Enrollment funnel"
          subtitle="From course page view to paid enrollment"
          icon={Filter}
          hue="blue"
          className="lg:col-span-2"
        >
          {tracking && funnel.length > 0 ? (
            <div className="space-y-4">
              {funnel.map((step, i) => {
                const widthPct = (step.value / funnelTop) * 100;
                const prev = i === 0 ? null : funnel[i - 1];
                const stepConv = prev != null && prev.value > 0 ? (step.value / prev.value) * 100 : 100;
                const hue = FUNNEL_HUES[i % FUNNEL_HUES.length];
                return (
                  <div key={step.label}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${HUE[hue].soft}`}>
                          {i + 1}
                        </span>
                        {step.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-neutral-900">
                          {step.value.toLocaleString()}
                        </span>
                        {prev != null && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs tabular-nums text-neutral-600">
                            {Math.round(stepConv)}%
                            <ArrowRight size={11} aria-hidden />
                          </span>
                        )}
                      </span>
                    </div>
                    <Meter value={widthPct} size="md" hue={hue} label={`${step.label}: ${step.value.toLocaleString()}`} />
                  </div>
                );
              })}
            </div>
          ) : (
            noTrackingNote
          )}
        </Panel>
      </div>

      {/* underlying figures */}
      <section aria-labelledby="monthly-heading">
        <SectionTitle id="monthly-heading" icon={BarChart3} hue="sky" title="Monthly figures" subtitle="The numbers behind the chart" />
        <DataView
          rows={monthly}
          columns={monthColumns}
          rowKey={(m) => m.month + m.fullMonth}
          storageKey="teach.analytics-months"
          searchable={false}
          gridCols={4}
          caption="Enrollments and completions per month"
          empty={<Empty icon={BarChart3} title="No monthly figures yet" />}
          renderCard={(m) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <p className="text-sm font-semibold text-neutral-900">{m.fullMonth || m.month}</p>
              <div className="flex gap-2">
                <Chip hue="sky" icon={Users}>
                  {m.enrollments} enrolled
                </Chip>
                <Chip hue="mint" icon={CheckCircle2}>
                  {m.completions} done
                </Chip>
              </div>
              <Progress
                value={m.enrollments > 0 ? (m.completions / m.enrollments) * 100 : 0}
                hue="mint"
                size="sm"
                label="Completed per enrolment"
                showValue
              />
            </div>
          )}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-labelledby="lessons-heading">
          <SectionTitle id="lessons-heading" icon={Trophy} hue="mint" title="Top lessons by engagement" subtitle="Ranked by completions" />
          <DataView
            rows={topLessons}
            columns={lessonColumns}
            rowKey={(l) => l.lectureId}
            storageKey="teach.analytics-lessons"
            defaultView="list"
            gridCols={2}
            caption="Top lessons by completions"
            searchPlaceholder="Search lessons"
            rowHref={(l) => (l.courseSlug ? `/suite/lms/teach/courses/${l.courseSlug}` : null)}
            empty={
              <Empty
                icon={Eye}
                title="No lesson activity yet"
                hint="Completion data appears once learners start your lessons."
              />
            }
            renderListItem={(l) => (
              <div className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{l.title}</p>
                    <p className="truncate text-xs text-neutral-500">{l.course}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-neutral-500">
                    <CheckCircle2 size={13} aria-hidden />
                    {l.completions.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <span className="flex-1">
                    <Meter value={l.completionRate} size="sm" hue={completionHue(l.completionRate)} label={`${l.title} completion`} />
                  </span>
                  <Chip hue={completionHue(l.completionRate)}>{l.completionRate}% complete</Chip>
                </div>
              </div>
            )}
            renderCard={(l) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <Chip hue={hueFor(l.type)}>{l.type}</Chip>
                  <Chip hue={completionHue(l.completionRate)}>{l.completionRate}%</Chip>
                </div>
                <div>
                  <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{l.title}</p>
                  <p className="truncate text-xs text-neutral-500">{l.course}</p>
                </div>
                <Meter value={l.completionRate} size="sm" hue={completionHue(l.completionRate)} label={`${l.completions} of ${l.enrolled} completed`} />
              </div>
            )}
          />
        </section>

        <section aria-labelledby="drop-heading">
          <SectionTitle id="drop-heading" icon={AlertTriangle} hue="coral" title="Biggest drop-off points" subtitle="Lessons losing the most learners" />
          <DataView
            rows={dropOffPoints}
            columns={dropColumns}
            rowKey={(d) => `${d.course}-${d.lesson}`}
            storageKey="teach.analytics-dropoff"
            defaultView="list"
            gridCols={2}
            caption="Lessons with the biggest drop-off"
            searchPlaceholder="Search lessons"
            empty={
              <Empty
                icon={AlertTriangle}
                hue="coral"
                title="No drop-off data yet"
                hint="This appears once learners begin progressing through lessons."
              />
            }
            renderListItem={(d) => (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <IconTile icon={AlertTriangle} hue="coral" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{d.lesson}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {d.course} · {d.lostLearners.toLocaleString()} lost
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-coral-700">{d.dropOff}%</span>
              </div>
            )}
            renderCard={(d) => (
              <div className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <IconTile icon={AlertTriangle} hue="coral" />
                  <span className="text-xl font-bold tabular-nums text-coral-700">{d.dropOff}%</span>
                </div>
                <div>
                  <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{d.lesson}</p>
                  <p className="truncate text-xs text-neutral-500">{d.course}</p>
                </div>
                <p className="mt-auto text-xs text-neutral-500">{d.lostLearners.toLocaleString()} learners lost</p>
              </div>
            )}
          />
          {dropOffPoints.length > 0 && (
            <p className="mt-1 flex items-start gap-2 rounded-xl bg-sun-50 px-4 py-3 text-xs text-sun-700">
              <Lightbulb size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span>Tip: consider re-recording or splitting these lessons.</span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  icon,
  hue,
  title,
  subtitle,
}: {
  id: string;
  icon: LucideIcon;
  hue: Hue;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <IconTile icon={icon} hue={hue} />
      <div>
        <h2 id={id} className="text-[15px] font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}
