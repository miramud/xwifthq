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
import { PILL_OUTLINE } from "@/components/learner/LearnerHeader";
import { firstNameOf, orbClass, useGreeting } from "@/components/workspace/kit";
import {
  LEARNER_PANEL,
  LearnerBody,
  LearnerHero,
  LearnerStat,
  heroButtonClass,
} from "@/suite/lms/components/learn/LearnerUi";

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
 * somewhere else, a lecture added to the curriculum, a completion recorded on
 * a phone, a seat assigned by an administrator, and it drifts silently, which
 * is the worst way for a progress bar to be wrong.
 *
 * `/api/me/progress` is the same report an administrator reads about this
 * learner. That is deliberate: somebody being chased about mandatory training
 * should see the number they are being chased on, not a second one computed
 * from a different source.
 *
 * The local store is kept as a fallback, because it holds card metadata the
 * progress report has no business carrying, the instructor's name, the
 * duration, the certificate serial, and because a signed-out visitor with
 * seats in localStorage should still see something.
 */
export default function MyCoursesPage() {
  const { enrolledCourses, getProgress, setEnrollments } = useStore();
  const { isAuthenticated, user } = useAuth();
  const greeting = useGreeting();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [report, setReport] = useState<LearnerProgress | null>(null);
  const [reportFailed, setReportFailed] = useState(false);

  useEffect(() => {
    document.title = "My courses | XwiftHQ";
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
        /* How far through everything, not how many were finished, a cohort
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
    { id: "in-progress", label: "In progress", count: stats.inProgress, show: true },
    { id: "completed", label: "Completed", count: stats.completed, show: true },
  ];

  /* ---- Empty state ---- */
  if (enrolledCourses.length === 0) {
    return (
      <section className="bg-canvas">
        <div className="section-container section-padding">
          <div className={`${LEARNER_PANEL} mx-auto max-w-lg animate-fade-in px-6 py-12 text-center sm:px-10`}>
            <div
              className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${orbClass("blue")}`}
            >
              <GraduationCap size={34} aria-hidden="true" />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-[-0.03em] text-neutral-900">
              No courses yet
            </h1>
            <p className="mb-8 mt-3 text-neutral-600">
              You are not on any courses yet. Find one in the catalogue and
              start when it suits you.
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

  const first = firstNameOf(user?.name);

  return (
    <>
      <LearnerHero
        eyebrow={
          <>
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            My courses
          </>
        }
        title={first ? `${greeting}, ${first}` : "My courses"}
        intro={`You are on ${stats.total} ${stats.total === 1 ? "course" : "courses"}. Pick up where you left off.`}
        tour={{ header: "page-header", actions: "page-actions" }}
        actions={
          <>
            <Link href="/courses" className={heroButtonClass("solid")}>
              Browse courses
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/achievements" className={heroButtonClass("glass")}>
              <Award size={16} aria-hidden="true" />
              Achievements
            </Link>
            <TourHelpButton variant="inline" />
          </>
        }
      >
        {/*
          Required training, called out above everything else. It is the one
          thing on this page somebody else is waiting on, and burying it among
          the courses they chose for themselves is how it gets missed.
        */}
        {requiredOutstanding > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-warning-600 shadow-sm">
              <CalendarCheck size={18} aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">
                {requiredOutstanding} required{" "}
                {requiredOutstanding === 1 ? "course" : "courses"}
              </span>{" "}
              still to finish. These were assigned to you.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab("required")}
              className="min-h-11 shrink-0 rounded-xl bg-warning-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-warning-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-600 focus-visible:ring-offset-2"
            >
              Show required courses
            </button>
          </div>
        )}

        {reportFailed && (
          <p className="mb-6 rounded-xl border border-neutral-200/70 bg-white px-4 py-3 text-xs text-neutral-600">
            Showing progress saved on this device because we could not reach the
            server. It may be behind what you have completed.
          </p>
        )}

        {/* The figures, as a row of stat cards. */}
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4" data-tour="stats">
          <LearnerStat icon={BookOpen} hue="blue" label="Total courses" value={String(stats.total)} />
          <LearnerStat icon={TrendingUp} hue="sky" label="In progress" value={String(stats.inProgress)} />
          <LearnerStat icon={CheckCircle2} hue="mint" label="Completed" value={String(stats.completed)} />
          {/*
            Average completion rather than total hours. Hours enrolled is a
            number about the catalogue; how far through you are is a number
            about you, and it is the one the report can answer honestly.
          */}
          <LearnerStat
            icon={BarChart3}
            hue="sun"
            label="Average completion"
            value={stats.authoritative ? `${stats.averagePercent}%` : "-"}
          />
        </div>
      </LearnerHero>

      <LearnerBody>
        {/* Activity */}
        {report !== null && report.series.length > 0 && (
          <div className={`${LEARNER_PANEL} mb-6 p-5 sm:p-6`} data-tour="learning-activity">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <BarChart3 size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-bold text-neutral-900">
                    Your activity
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Lessons you finished in the last 90 days
                  </p>
                </div>
              </div>
              {report.totals.activeDays > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-50 px-3 py-1 text-xs text-neutral-700">
                  <Flame size={13} className="text-accent-600" aria-hidden="true" />
                  {/* Days you studied, not consecutive days, a weekend break
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
        <div className="mb-6 flex w-fit max-w-full flex-wrap gap-1 rounded-2xl border border-neutral-200/70 bg-white p-1 shadow-sm" data-tour="course-filters">
          {TABS.filter((tab) => tab.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-600/25"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
              aria-pressed={activeTab === tab.id}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-xs opacity-75 tnum">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Course grid */}
        {filteredCourses.length === 0 ? (
          <div className={`${LEARNER_PANEL} py-16 text-center`}>
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <BarChart3 size={24} aria-hidden="true" />
            </span>
            <p className="text-sm text-neutral-500">
              No courses match this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" data-tour="course-grid">
            {filteredCourses.map((course) => {
              const progress = progressFor(course.slug);
              const isCompleted = progress.completedAt !== null;
              const enrolled = new Date(course.enrolledAt).toLocaleDateString(
                "en-NG",
                { day: "numeric", month: "short", year: "numeric" },
              );

              return (
                <article
                  key={course.slug}
                  className={`${LEARNER_PANEL} flex flex-col overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_rgb(150_56_205/0.45)] motion-reduce:hover:translate-y-0`}
                >
                  {/* Gradient cover */}
                  <Link
                    href={`/learn/${course.slug}`}
                    className="block rounded-[1.25rem] p-2 pb-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <div
                      className={`relative flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br ${course.gradient}`}
                    >
                      <PlayCircle size={40} className="text-white/50" />

                      {/* Assigned, not chosen. Worth saying on the card so a
                          learner knows which of these somebody is waiting on. */}
                      {progress.mandatory && !isCompleted && (
                        <span className="absolute left-3 top-3 rounded-full bg-warning-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                          Required
                        </span>
                      )}

                      {isCompleted && (
                        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-success-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                          <CheckCircle2 size={12} />
                          Completed
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <Link
                      href={`/learn/${course.slug}`}
                      className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <h3 className="mb-1 line-clamp-2 font-heading text-base font-semibold leading-snug text-neutral-900 transition-colors hover:text-primary-700">
                        {course.title}
                      </h3>
                    </Link>
                    <p className="mb-4 text-xs text-neutral-500">
                      {course.instructor.name}
                    </p>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-700 tnum">
                          {progress.percent}% complete
                        </span>
                        <span className="text-xs text-neutral-500 tnum">
                          {progress.completed}/{progress.total} lessons
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-primary-50">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                            isCompleted ? "from-mint-500 to-mint-400" : "from-primary-500 to-primary-400"
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
                    <div className="mb-4 mt-auto flex items-center justify-between text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} aria-hidden="true" />
                        {course.duration}
                      </span>
                      <span>Enrolled {enrolled}</span>
                    </div>

                    {/* CTA */}
                    {isCompleted ? (
                      <div className="flex gap-2">
                        <Link
                          href={`/learn/${course.slug}`}
                          className={`${PILL_OUTLINE} min-h-11 flex-1`}
                        >
                          Review course
                        </Link>
                        {course.certificateSerial && (
                          <Link
                            href={`/verify/${course.certificateSerial}`}
                            className={`${PILL_OUTLINE} min-h-11`}
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
                </article>
              );
            })}
          </div>
        )}
      </LearnerBody>
    </>
  );
}
