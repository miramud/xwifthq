"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  ChartLine,
  CircleCheck,
  ClipboardCheck,
  Hourglass,
  Percent,
  TrendingDown,
  Users,
  X,
} from "lucide-react";
import { CourseThumb } from "@/components/shared/CourseCover";
import { Button, Chip, Empty, PageHeader, Panel, Progress, Segmented, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { FaceAvatar, Skeleton as WsSkeleton, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import ErrorState from "@/components/feedback/ErrorState";
import { courses as coursesApi, type AdminCourse } from "@/lib/api/admin-client";
import {
  adminProgress,
  type CohortProgress,
  type CourseCohortProgress,
} from "@/lib/api/progress-client";
import { formatCompact } from "@/lib/console-data";
import {
  LectureFunnel,
  ProgressDistribution,
  ProgressSeriesChart,
} from "@/suite/lms/components/progress/ProgressCharts";

/**
 * Course progress across the institution, and inside one course.
 *
 * Two levels on one screen, because the second question always follows the
 * first: the programme is at 40%, so which course is dragging it? Picking a
 * course swaps the lower half for that course's cohort, its distribution and
 * its lecture funnel.
 *
 * Every figure is measured from the completion log. Nothing here is modelled,
 * and a quiet window reports zeroes rather than a curve.
 */

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

function statusHue(status: string): Hue {
  if (status === "completed") return "mint";
  if (status === "cancelled") return "rose";
  return "sky";
}

export default function ProgressPage() {
  const [days, setDays] = useState<number>(30);

  const [cohort, setCohort] = useState<CohortProgress | null>(null);
  const [cohortError, setCohortError] = useState<string | null>(null);

  const [courses, setCourses] = useState<AdminCourse[]>([]);

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourseCohortProgress | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  /*
    The error is cleared on success rather than before the request. Clearing
    it synchronously inside the effect is what React 19 flags: it is a state
    write in the effect body, and it cascades a render before the fetch has
    even started.
  */
  const loadCohort = useCallback(() => {
    adminProgress
      .cohort(days)
      .then((data) => {
        setCohort(data);
        setCohortError(null);
      })
      .catch((e: Error) => setCohortError(e.message));
  }, [days]);

  useEffect(() => {
    loadCohort();
  }, [loadCohort]);

  useEffect(() => {
    coursesApi
      .list()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (selected === null) {
      return;
    }

    // `ignore` rather than clearing state up front: switching course twice
    // quickly must not let the first response land after the second.
    let ignore = false;

    adminProgress
      .course(selected, days)
      .then((data) => {
        if (ignore) return;
        setDetail(data);
        setDetailError(null);
      })
      .catch((e: Error) => {
        if (!ignore) setDetailError(e.message);
      });

    return () => {
      ignore = true;
    };
  }, [selected, days]);

  /*
    Both derived rather than stored.

    Writing `detail = null` or `loading = true` from inside the effect is a
    synchronous state write in an effect body, which React 19 flags because it
    cascades a render. Neither needs to be state: what is on screen is
    whatever has loaded *for the current selection*, and "loading" is simply
    the gap between choosing a course and that arriving.
  */
  const shownDetail =
    selected !== null && detail?.course.slug === selected ? detail : null;

  const detailLoading = selected !== null && shownDetail === null && detailError === null;

  type Learner = CourseCohortProgress["learners"][number];

  const courseColumns: Column<AdminCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={36} rounded="rounded-xl" />
          <span className="min-w-0">
            <span className="block max-w-[260px] truncate font-semibold text-neutral-900">{c.title}</span>
            {c.category && <span className="block truncate text-xs text-neutral-500">{c.category}</span>}
          </span>
          {selected === c.slug && <Chip hue="blue">Selected</Chip>}
        </span>
      ),
    },
    {
      key: "students",
      header: "Learners",
      align: "right",
      sortable: true,
      value: (c) => c.students,
      render: (c) => formatCompact(c.students),
    },
    {
      key: "completions",
      header: "Finished",
      align: "right",
      sortable: true,
      value: (c) => c.completions,
      render: (c) => formatCompact(c.completions),
    },
  ];

  const learnerColumns: Column<Learner>[] = [
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (l) => l.name ?? l.email ?? "",
      render: (l) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={l.name ?? l.email} size={32} />
          <span className="min-w-0">
            {/* DataView makes this first cell the row's link (rowHref below). */}
            <span className="block truncate font-semibold text-neutral-900">{l.name ?? l.email ?? "Unnamed learner"}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
              {l.mandatory ? <ClipboardCheck size={11} aria-hidden="true" /> : <ChartLine size={11} aria-hidden="true" />}
              {l.source}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "percent",
      header: "Progress",
      sortable: true,
      value: (l) => l.percent,
      render: (l) => (
        <span className="flex min-w-[160px] items-center gap-3">
          <Progress value={l.percent} hue={l.percent >= 100 ? "mint" : "blue"} size="sm" label={`${l.name ?? "Learner"} progress`} />
          <span className="shrink-0 text-xs tabular-nums text-neutral-600">
            {l.percent}% · {l.lessonsDone}/{shownDetail?.course.totalLectures ?? 0}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (l) => l.status,
      render: (l) => <StatusChip status={l.status} hue={statusHue(l.status)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course progress"
        subtitle="Measured from every lecture your learners finish. Nothing is estimated."
        actions={
          <Segmented
            label="Reporting window"
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={WINDOWS.map((w) => ({ key: String(w.days), label: w.label }))}
          />
        }
      />

      {/* ---------------- The whole institution ---------------- */}

      {cohortError !== null ? (
        <ErrorState
          icon={ChartLine}
          title="Could not load progress"
          body="The progress report did not come back. Nothing is lost: the figures are worked out each time you ask."
          route="/api/admin/progress"
          reference={cohortError}
          primaryAction={{ label: "Try again", onClick: loadCohort }}
        />
      ) : cohort === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading progress">
          {[0, 1, 2, 3].map((i) => (
            <WsSkeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <StatGrid>
            <StatCard
              featured
              featuredHue="grape"
              icon={Users}
              label="Learners"
              value={formatCompact(cohort.totals.learners)}
              hint={`${formatCompact(cohort.totals.enrollments)} enrolments`}
            />
            <StatCard
              icon={Activity}
              label={`Active in ${days} days`}
              value={formatCompact(cohort.totals.activeLearners)}
              hint={`${formatCompact(cohort.totals.lessonsDone)} lectures finished`}
              hue="sky"
            />
            <StatCard icon={CircleCheck} label="Courses completed" value={formatCompact(cohort.totals.completed)} hue="mint" />
            <StatCard
              icon={Hourglass}
              label="Not started"
              value={formatCompact(cohort.totals.notStarted)}
              hint="Enrolled, but nothing opened"
              hue="sun"
            />
          </StatGrid>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title="Lectures finished"
              subtitle={`Last ${days} days, across every course`}
              icon={ChartLine}
              hue="grape"
              className="lg:col-span-2"
            >
              <ProgressSeriesChart
                data={cohort.series}
                ariaLabel={`Lectures finished across every course over the last ${days} days`}
              />
            </Panel>

            <Panel
              title="How far people are"
              subtitle={`${formatCompact(cohort.totals.enrollments)} enrolments`}
              icon={Percent}
              hue="mint"
            >
              <ProgressDistribution data={cohort.distribution} total={cohort.totals.enrollments} />

              {/*
                The mean and the median together. They disagree, and the
                disagreement is the point: one finisher among three who did
                nothing is a mean of 25% and a median of 0%.
              */}
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm">
                <div className="rounded-2xl bg-primary-50/70 p-3">
                  <dt className="text-xs font-medium text-primary-700">Average</dt>
                  <dd className="text-xl font-bold tabular-nums text-neutral-900">{cohort.totals.averagePercent}%</dd>
                </div>
                <div className="rounded-2xl bg-mint-50 p-3">
                  <dt className="text-xs font-medium text-mint-700">Typical learner</dt>
                  <dd className="text-xl font-bold tabular-nums text-neutral-900">{cohort.totals.medianPercent}%</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </>
      )}

      {/* ---------------- One course ---------------- */}

      <section aria-labelledby="by-course" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="by-course" className="text-lg font-bold tracking-tight text-neutral-900">
              By course
            </h2>
            <p className="text-sm text-neutral-500">Pick a course to see who is on it, how far they are and where they stop.</p>
          </div>
          {selected !== null && (
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSelected(null)}>
              Clear selection
            </Button>
          )}
        </div>

        <DataView
          rows={courses}
          columns={courseColumns}
          rowKey={(c) => c.slug}
          onRowClick={(c) => setSelected(c.slug)}
          storageKey="lms.progress.courses"
          defaultView="grid"
          gridCols={4}
          caption="Courses: choose one to see its progress"
          searchPlaceholder="Find a course"
          matches={(c, q) => c.title.toLowerCase().includes(q)}
          renderCard={(c) => (
            <div
              className={`flex h-full items-center gap-3 rounded-[1.25rem] p-4 ${
                selected === c.slug ? "bg-primary-50/70 ring-2 ring-primary-400" : ""
              }`}
            >
              <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={44} rounded="rounded-xl" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-neutral-900">{c.title}</span>
                <span className="text-xs tabular-nums text-neutral-500">{formatCompact(c.students)} learners</span>
                {selected === c.slug && <span className="sr-only"> (selected)</span>}
              </span>
            </div>
          )}
          renderListItem={(c) => (
            <div className={`flex items-center gap-3 px-5 py-3 ${selected === c.slug ? "bg-primary-50/70" : ""}`}>
              <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={36} rounded="rounded-xl" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{c.title}</span>
              <span className="text-xs tabular-nums text-neutral-500">{formatCompact(c.students)} learners</span>
              {selected === c.slug && <Chip hue="blue">Selected</Chip>}
            </div>
          )}
          empty={<Empty icon={BookOpen} hue="grape" title="No courses match" hint="Try another search." />}
        />
      </section>

      {detailError !== null && (
        <ErrorState
          icon={BookOpen}
          title="Could not load this course"
          body="The progress report for that course did not come back. The figures for your institution above are not affected."
          route={`/api/admin/progress/courses/${selected ?? ""}`}
          reference={detailError}
          primaryAction={{ label: "Try again", onClick: () => setSelected(selected) }}
        />
      )}

      {detailLoading && <WsSkeleton className="h-64" />}

      {shownDetail !== null && !detailLoading && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard icon={Users} label="On this course" value={formatCompact(shownDetail.totals.learners)} hue="grape" />
            <StatCard
              icon={Percent}
              label="Average progress"
              value={`${shownDetail.totals.averagePercent}%`}
              hint={`Typical learner ${shownDetail.totals.medianPercent}%`}
              hue="sky"
            />
            <StatCard icon={CircleCheck} label="Finished" value={formatCompact(shownDetail.totals.completed)} hue="mint" />
            <StatCard icon={Hourglass} label="Not started" value={formatCompact(shownDetail.totals.notStarted)} hue="sun" />
          </StatGrid>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              title={shownDetail.course.title}
              subtitle={`Lectures finished in the last ${days} days`}
              icon={ChartLine}
              hue="grape"
              className="lg:col-span-2"
            >
              <ProgressSeriesChart
                data={shownDetail.series}
                ariaLabel={`Lectures finished on ${shownDetail.course.title} over the last ${days} days`}
              />
            </Panel>

            <Panel title="How far people are" icon={Percent} hue="mint">
              <ProgressDistribution data={shownDetail.distribution} total={shownDetail.totals.learners} />
            </Panel>
          </div>

          <Panel
            title="Where people stop"
            subtitle="Completions per lecture, and the drop from the one before it"
            icon={TrendingDown}
            hue="coral"
          >
            <LectureFunnel rows={shownDetail.lectures} />
          </Panel>

          <section aria-labelledby="course-learners" className="space-y-3">
            <div>
              <h3 id="course-learners" className="text-base font-bold tracking-tight text-neutral-900">
                Learners
              </h3>
              <p className="text-xs text-neutral-500">{shownDetail.learners.length} on this course</p>
            </div>
            <DataView
              rows={shownDetail.learners}
              columns={learnerColumns}
              rowKey={(l) => l.id}
              rowHref={(l) => `/suite/org/users/${l.id}`}
              storageKey="lms.progress.learners"
              caption={`Learners on ${shownDetail.course.title}`}
              searchPlaceholder="Find a learner"
              renderCard={(l) => (
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <FaceAvatar name={l.name ?? l.email} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {l.name ?? l.email ?? "Unnamed learner"}
                      </p>
                      <p className="truncate text-xs text-neutral-500">{l.source}</p>
                    </div>
                  </div>
                  <StatusChip status={l.status} hue={statusHue(l.status)} />
                  <div className="mt-auto">
                    <Progress value={l.percent} hue={l.percent >= 100 ? "mint" : "blue"} label="Progress" showValue />
                  </div>
                </div>
              )}
              renderListItem={(l) => (
                <div className="flex items-center gap-3 px-5 py-3">
                  <FaceAvatar name={l.name ?? l.email} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {l.name ?? l.email ?? "Unnamed learner"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {l.source} · {l.lessonsDone}/{shownDetail.course.totalLectures} lectures
                    </p>
                  </div>
                  <div className="hidden w-40 sm:block">
                    <Progress value={l.percent} hue={l.percent >= 100 ? "mint" : "blue"} size="sm" showValue label="Progress" />
                  </div>
                  <StatusChip status={l.status} hue={statusHue(l.status)} />
                </div>
              )}
              empty={<Empty icon={Users} title="Nobody is on this course yet" hint="Assign it from the course page." />}
            />
          </section>
        </div>
      )}
    </div>
  );
}
