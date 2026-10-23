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
    document.title = "My Courses | Elevate";
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
      <section className="section-container section-padding text-center">
        <div className="max-w-md mx-auto animate-fade-in">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary-50">
            <GraduationCap size={48} className="text-primary-400" />
          </div>
          <h1
            className="heading-3 text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            No courses yet
          </h1>
          <p className="text-neutral-500 mb-8">
            You haven&apos;t enrolled in any courses yet. Start your learning
            journey today by exploring our catalog.
          </p>
          <Link href="/courses" className="btn-primary gap-2">
            Browse Courses
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-neutral-50 min-h-screen">
      <div className="section-container py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6" data-tour="page-header">
          <div>
            <h1
              className="heading-3 text-neutral-900 mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              My Courses
            </h1>
            <p className="text-neutral-500 text-sm">
              {stats.total} {stats.total === 1 ? "course" : "courses"} enrolled
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto" data-tour="page-actions">
            <TourHelpButton variant="inline" />
            <Link href="/achievements" className="btn-outline py-2 px-4 text-sm gap-1.5">
              <Award size={14} />
              Achievements
            </Link>
            <Link href="/courses" className="btn-outline py-2 px-4 text-sm gap-1.5">
              Browse More
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/*
          Required training, called out above everything else. It is the one
          thing on this page somebody else is waiting on, and burying it among
          the courses they chose for themselves is how it gets missed.
        */}
        {requiredOutstanding > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning-500/30 bg-warning-500/5 p-4">
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
              still outstanding — these were assigned to you.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("required")}
              className="shrink-0 rounded-lg bg-warning-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-warning-700"
            >
              Show them
            </button>
          </div>
        )}

        {reportFailed && (
          <p className="mb-6 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
            Showing progress saved on this device — we could not reach the
            server. It may be behind what you have actually completed.
          </p>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" data-tour="stats">
          {[
            {
              icon: BookOpen,
              label: "Total Courses",
              value: String(stats.total),
              color: "text-primary-600",
              bg: "bg-primary-50",
            },
            {
              icon: TrendingUp,
              label: "In Progress",
              value: String(stats.inProgress),
              color: "text-accent-600",
              bg: "bg-accent-500/10",
            },
            {
              icon: CheckCircle2,
              label: "Completed",
              value: String(stats.completed),
              color: "text-success-600",
              bg: "bg-success-500/10",
            },
            /*
              Average completion rather than total hours. Hours enrolled is a
              number about the catalogue; how far through you are is a number
              about you, and it is the one the report can answer honestly.
            */
            {
              icon: BarChart3,
              label: "Average Completion",
              value: stats.authoritative ? `${stats.averagePercent}%` : "—",
              color: "text-info-600",
              bg: "bg-info-500/10",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg} shrink-0`}
                >
                  <Icon size={20} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-lg font-bold text-neutral-900 tnum"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity */}
        {report !== null && report.series.length > 0 && (
          <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5" data-tour="learning-activity">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
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
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-lg border border-neutral-200 p-1 w-fit" data-tour="course-filters">
          {TABS.filter((tab) => tab.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50"
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
          <div className="text-center py-16">
            <BarChart3 size={40} className="text-neutral-300 mx-auto mb-3" />
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
                  className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Gradient image */}
                  <Link href={`/learn/${course.slug}`} className="block">
                    <div
                      className={`h-36 bg-gradient-to-br ${course.gradient} relative flex items-center justify-center`}
                    >
                      <PlayCircle size={40} className="text-white/30" />

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
                  <div className="p-4 flex flex-col flex-1">
                    <Link href={`/learn/${course.slug}`}>
                      <h3 className="text-sm font-semibold text-neutral-800 hover:text-primary-700 transition-colors line-clamp-2 leading-snug mb-1">
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
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
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
                          className="flex-1 text-center text-xs font-semibold text-primary-600 border border-primary-200 hover:bg-primary-50 rounded-lg py-2.5 transition-colors"
                        >
                          Review Course
                        </Link>
                        {course.certificateSerial && (
                          <Link
                            href={`/verify/${course.certificateSerial}`}
                            className="flex items-center justify-center gap-1 text-xs font-semibold text-accent-600 border border-accent-500/30 hover:bg-accent-500/10 rounded-lg py-2.5 px-3 transition-colors"
                          >
                            <Award size={12} />
                            Certificate
                          </Link>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={`/learn/${course.slug}`}
                        className="btn-primary w-full py-2.5 text-sm gap-1.5"
                      >
                        {progress.completed > 0 ? "Continue Learning" : "Start Course"}
                        <ArrowRight size={14} />
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
  );
}
