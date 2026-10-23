"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  PlayCircle,
  Award,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  BarChart3,
  CalendarCheck,
  Flame,
} from "lucide-react";
import { useStore, type EnrolledCourse } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { myProgress, type LearnerProgress } from "@/lib/api/progress-client";
import { ProgressSeriesChart } from "@/suite/lms/components/progress/ProgressCharts";
import { TourHelpButton } from "@/components/tour/TourHelpButton";
import { Clouds } from "@/components/site/Sky";
import { LEARNER_CARD, LearnerHeader, PILL_OUTLINE } from "@/components/learner/LearnerHeader";

/* ------------------------------------------------------------------ */
/*  Filter tabs                                                        */
/* ------------------------------------------------------------------ */

type FilterTab = "all" | "required" | "in-progress" | "completed";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

/**
 * The learner's own courses, and how far through them they are.
 *
 * **The figures come from the API, not from the browser.** They used to be
 * derived locally: count the lesson ids in localStorage, divide by the lecture
 * count on the cached course. That number drifts the moment anything happens
 * somewhere else — a lecture added to the curriculum, a completion recorded on
 * a phone, a seat assigned by an administrator — and it drifts silently, which
 * is the worst way for a progress bar to be wrong.
 *
 * `/api/me/progress` is the same report an administrator reads about this
 * learner. That is deliberate: somebody being chased about mandatory training
 * should see the number they are being chased on, not a second one computed
 * from a different source.
 *
 * The local store is kept as a fallback, because it holds card metadata the
 * progress report has no business carrying — the instructor's name, the
 * duration, the certificate serial — and because a signed-out visitor with
 * seats in localStorage should still see something.
 */
export default function MyCoursesPage() {
  const { enrolledCourses, getProgress, setEnrollments } = useStore();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [report, setReport] = useState<LearnerProgress | null>(null);
  const [reportFailed, setReportFailed] = useState(false);

  useEffect(() => {
    document.title = "My Courses | XwiftHQ";
  }, []);

  /*
    Both calls in one effect, because they answer two halves of one screen and
    a card rendered from one without the other is a card with a title and no
    progress bar, or the reverse.
  */
  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;

    void (async () => {
      const [courses, progress] = await Promise.allSettled([
        fetch("/api/me/courses", { cache: "no-store" }).then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("failed")),
        ),
        myProgress.all(),
      ]);

      if (!active) return;

      if (courses.status === "fulfilled" && Array.isArray(courses.value?.courses)) {
        setEnrollments(courses.value.courses as EnrolledCourse[]);
      }

      if (progress.status === "fulfilled") {
        setReport(progress.value);
        setReportFailed(false);
      } else {
        /*
          Fall back to the local derivation rather than showing nothing. A
          progress bar computed from stale local data is worse than one from
          the API and better than a blank card, and the banner below says which
          is being shown.
        */
        setReportFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated, setEnrollments]);

  /** Server-side progress by slug, when the report arrived. */
  const byCourse = useMemo(() => {
    const map = new Map<string, LearnerProgress["courses"][number]>();

    for (const course of report?.courses ?? []) {
      if (course.slug !== null) map.set(course.slug, course);
    }

    return map;
  }, [report]);

  /**
   * One course's figures, preferring the API and falling back to the local
   * count. Derived rather than stored, so the two can never disagree about
   * which source a given card used.
   */
  const progressFor = useCallback(
    (slug: string) => {
      const live = byCourse.get(slug);

      if (live !== undefined) {
        return {
          completed: live.lessonsDone,
          total: live.totalLectures,
          percent: live.percent,
          mandatory: live.mandatory,
          completedAt: live.completedAt,
          authoritative: true,
        };
      }

      const local = getProgress(slug);
      const course = enrolledCourses.find((c) => c.slug === slug);

      return {
        ...local,
        mandatory: false,
        completedAt: course?.progress.completedAt ?? null,
        authoritative: false,
      };
    },
    [byCourse, getProgress, enrolledCourses],
  );

  /* ---- Stats ---- */

  const stats = useMemo(() => {
    if (report !== null) {
      return {
        total: report.totals.courses,
        completed: report.totals.completed,
        inProgress: report.totals.courses - report.totals.completed,
        /* How far through everything, not how many were finished — a cohort
           that all stall at 90% has a high average and no completions. */
        averagePercent: report.totals.averagePercent,
        activeDays: report.totals.activeDays,
        mandatory: report.totals.mandatoryCourses,
        mandatoryCompleted: report.totals.mandatoryCompleted,
        authoritative: true,
      };
    }

    let completed = 0;

    for (const course of enrolledCourses) {
      if (course.progress.completedAt) completed++;
    }

    return {
      total: enrolledCourses.length,
      completed,
      inProgress: enrolledCourses.length - completed,
      averagePercent: 0,
      activeDays: 0,
      mandatory: 0,
      mandatoryCompleted: 0,
      authoritative: false,
    };
  }, [report, enrolledCourses]);

  /* ---- Filtering ---- */

  const filteredCourses = useMemo(() => {
    switch (activeTab) {
      case "required":
        return enrolledCourses.filter((c) => progressFor(c.slug).mandatory);
      case "in-progress":
        return enrolledCourses.filter((c) => progressFor(c.slug).completedAt === null);
      case "completed":
        return enrolledCourses.filter((c) => progressFor(c.slug).completedAt !== null);
      default:
        return enrolledCourses;
    }
  }, [enrolledCourses, activeTab, progressFor]);

  const requiredOutstanding = stats.mandatory - stats.mandatoryCompleted;

  const TABS: { id: FilterTab; label: string; count: number; show: boolean }[] = [
    { id: "all", label: "All", count: stats.total, show: true },
    // Only when there is required training to show. A tab that is always empty
    // teaches people to stop reading the tabs.
    { id: "required", label: "Required", count: stats.mandatory, show: stats.mandatory > 0 },
    { id: "in-progress", label: "In Progress", count: stats.inProgress, show: true },
    { id: "completed", label: "Completed", count: stats.completed, show: true },
  ];

  /* ---- Empty state ---- */
  if (enrolledCourses.length === 0) {
    return (
      <section className="xw-sky relative isolate overflow-hidden">
        <Clouds className="-z-10" />
        <div className="section-container section-padding text-center">
          <div className="mx-auto max-w-md animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_20px_40px_-24px_rgb(150_56_205/0.6)]">
              <GraduationCap size={40} className="text-primary-600" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-neutral-900 sm:text-4xl">
              No courses yet
            </h1>
            <p className="mb-8 mt-3 text-neutral-600">
              You haven&apos;t enrolled in any courses yet. Find one in the
              catalogue and start whenever suits you.
            </p>
            <Link href="/courses" className="btn-primary">
              Browse courses
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <LearnerHeader
        eyebrow={
          <>
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Learning
          </>
        }
        title="My courses"
        intro={`${stats.total} ${stats.total === 1 ? "course" : "courses"} enrolled`}
        tour={{ header: "page-header", actions: "page-actions" }}
        actions={
          <>
            <TourHelpButton variant="inline" />
            <Link href="/achievements" className={PILL_OUTLINE}>
              <Award size={14} aria-hidden="true" />
              Achievements
            </Link>
            <Link href="/courses" className={PILL_OUTLINE}>
              Browse more
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        }
      >
        {/*
          Required training, called out above everything else. It is the one
          thing on this page somebody else is waiting on, and burying it among
          the courses they chose for themselves is how it gets missed.
        */}
        {requiredOutstanding > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-warning-500/30 bg-white/90 p-4">
            <CalendarCheck
              size={18}
              className="shrink-0 text-warning-600"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 text-sm text-neutral-700">
              <span className="font-semibold">
                {requiredOutstanding} required{" "}
                {requiredOutstanding === 1 ? "course" : "courses"}
              </span>{" "}
              still outstanding. These were assigned to you.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("required")}
              className="shrink-0 rounded-full bg-warning-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-warning-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-600 focus-visible:ring-offset-2"
            >
              Show them
            </button>
          </div>
        )}

        {reportFailed && (
          <p className="mb-6 rounded-xl bg-white/80 px-3 py-2 text-xs text-neutral-600">
            Showing progress saved on this device because we could not reach the
            server. It may be behind what you have actually completed.
          </p>
        )}

        {/* Stats, on the sky like the home page's figures. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-tour="stats">
          {[
            {
              icon: BookOpen,
              label: "Total Courses",
              value: String(stats.total),
            },
            {
              icon: TrendingUp,
              label: "In Progress",
              value: String(stats.inProgress),
            },
            {
              icon: CheckCircle2,
              label: "Completed",
              value: String(stats.completed),
            },
            /*
              Average completion rather than total hours. Hours enrolled is a
              number about the catalogue; how far through you are is a number
              about you, and it is the one the report can answer honestly.
            */
            {
              icon: BarChart3,
              label: "Average Completion",
              value: stats.authoritative ? `${stats.averagePercent}%` : "-",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="xw-glow-card flex min-h-28 flex-col justify-between p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="tnum font-heading text-3xl font-bold tracking-[-0.04em] text-neutral-900">
                    {stat.value}
                  </p>
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
                    aria-hidden="true"
                  >
                    <Icon size={14} />
                  </span>
                </div>
                <p className="mt-3 truncate text-xs font-medium text-neutral-600">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </LearnerHeader>

    <section className="min-h-[50vh] bg-white">
      <div className="section-container pb-16 pt-2 sm:pb-20">
        {/* Activity */}
        {report !== null && report.series.length > 0 && (
          <div className={`${LEARNER_CARD} mb-8 p-4 sm:p-6`} data-tour="learning-activity">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-heading text-base font-semibold text-neutral-900">
                  Your activity
                </h2>
                <p className="text-xs text-neutral-500">
                  Lessons finished over the last 90 days
                </p>
              </div>
              {report.totals.activeDays > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                  <Flame size={13} className="text-accent-600" aria-hidden="true" />
                  {/* Days you studied, not consecutive days — a weekend break
                      is not a failure of consistency. */}
                  <span className="font-semibold tnum">{report.totals.activeDays}</span>
                  {report.totals.activeDays === 1 ? " day studied" : " days studied"}
                </span>
              )}
            </div>

            <ProgressSeriesChart
              data={report.series}
              height={180}
              ariaLabel="Lessons you finished, day by day, with a running total"
            />
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-6 flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1" data-tour="course-filters">
          {TABS.filter((tab) => tab.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
                activeTab === tab.id
                  ? "bg-primary-600 text-white"
                  : "text-neutral-600 hover:bg-white hover:text-neutral-900"
              }`}
              aria-pressed={activeTab === tab.id}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-xs opacity-70 tnum">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Course grid */}
        {filteredCourses.length === 0 ? (
          <div className="xw-tile py-16 text-center">
            <BarChart3 size={36} className="mx-auto mb-3 text-primary-300" aria-hidden="true" />
            <p className="text-neutral-500 text-sm">
              No courses match this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-tour="course-grid">
            {filteredCourses.map((course) => {
              const progress = progressFor(course.slug);
              const isCompleted = progress.completedAt !== null;
              const enrolled = new Date(course.enrolledAt).toLocaleDateString(
                "en-NG",
                { day: "numeric", month: "short", year: "numeric" },
              );

              return (
                <div
                  key={course.slug}
                  className="flex flex-col overflow-hidden rounded-[1.25rem] border border-neutral-200/80 bg-white shadow-sm transition-shadow hover:shadow-[0_24px_48px_-28px_rgb(150_56_205/0.45)]"
                >
                  {/* Gradient image */}
                  <Link
                    href={`/learn/${course.slug}`}
                    className="block rounded-[1.25rem] p-2 pb-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <div
                      className={`relative flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br ${course.gradient}`}
                    >
                      <PlayCircle size={40} className="text-white/40" />

                      {/* Assigned, not chosen. Worth saying on the card so a
                          learner knows which of these somebody is waiting on. */}
                      {progress.mandatory && !isCompleted && (
                        <span className="absolute top-3 left-3 rounded-full bg-warning-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                          Required
                        </span>
                      )}

                      {isCompleted && (
                        <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-success-500 text-white text-xs font-bold rounded-full shadow-sm">
                          <CheckCircle2 size={12} />
                          Completed
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1 sm:p-5">
                    <Link
                      href={`/learn/${course.slug}`}
                      className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <h3 className="mb-1 line-clamp-2 font-heading text-base font-semibold leading-snug text-neutral-900 transition-colors hover:text-primary-700">
                        {course.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-neutral-500 mb-3">
                      {course.instructor.name}
                    </p>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-neutral-600 tnum">
                          {progress.percent}% complete
                        </span>
                        <span className="text-xs text-neutral-400 tnum">
                          {progress.completed}/{progress.total} lessons
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-primary-50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? "bg-success-500" : "bg-primary-500"
                          }`}
                          style={{ width: `${progress.percent}%` }}
                          role="progressbar"
                          aria-valuenow={progress.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${progress.percent}% complete`}
                        />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 mt-auto">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {course.duration}
                      </span>
                      <span>Enrolled {enrolled}</span>
                    </div>

                    {/* CTA */}
                    {isCompleted ? (
                      <div className="flex gap-2">
                        <Link
                          href={`/learn/${course.slug}`}
                          className={`${PILL_OUTLINE} flex-1`}
                        >
                          Review course
                        </Link>
                        {course.certificateSerial && (
                          <Link
                            href={`/verify/${course.certificateSerial}`}
                            className={PILL_OUTLINE}
                          >
                            <Award size={12} aria-hidden="true" />
                            Certificate
                          </Link>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/learn/${course.slug}`}
                        className="btn-primary w-full py-2.5"
                      >
                        {progress.completed > 0 ? "Continue learning" : "Start course"}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
    </>
  );
}
