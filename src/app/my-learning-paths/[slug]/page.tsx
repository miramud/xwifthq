"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Route,
  TriangleAlert,
} from "lucide-react";
import {
  myLearningPaths as api,
  ApiError,
  type LearnerPath,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { RichTextView } from "@/components/workspace/RichTextView";
import { LEARNER_CARD, LearnerHeader } from "@/components/learner/LearnerHeader";

/**
 * One track, opened.
 *
 * The list page could say a learner was 40% through a path and not which
 * courses those were — so the one question somebody actually has, *what do I
 * do next*, had no answer anywhere in the product. They had to go to the
 * catalogue and work out for themselves which of their courses belonged to it.
 *
 * Two distinctions the page keeps, because collapsing either makes the figure
 * on the list page look wrong:
 *
 * **Required and optional courses are marked apart.** Only required ones count
 * towards completion — the same rule the API uses to decide whether a path is
 * finished — so a learner who has done every required course and skipped an
 * optional one is at 100% and should not be hunting for a missing course.
 *
 * **Overdue is not incomplete.** A path with a deadline in March is ordinary;
 * one whose date has passed is something to raise. The badge only appears for
 * the second, and a path finished after its date is finished, not late.
 */
export default function LearningPathDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user, loading: authLoading } = useAuth();

  const [path, setPath] = useState<LearnerPath | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let alive = true;

    api
      .get(slug)
      .then((data) => {
        if (alive) setPath(data);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? "You are not on this learning path."
            : "Couldn't load this learning path.",
        );
      });

    return () => {
      alive = false;
    };
  }, [slug, user]);

  if (!authLoading && !user) {
    return (
      <section className="section-container py-16 text-center">
        <p className="text-sm text-neutral-600">
          <Link
            href="/login"
            className="rounded font-semibold text-primary-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Log in
          </Link>{" "}
          to see your learning paths.
        </p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="xw-sky">
        <div className="section-container flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary-600 shadow-[0_10px_30px_-18px_rgb(150_56_205/0.6)]">
            <Route size={26} aria-hidden="true" />
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-[-0.02em] text-neutral-900 sm:text-3xl">{error}</h1>
          <Link href="/my-learning-paths" className="btn-primary mt-6">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to my paths
          </Link>
        </div>
      </section>
    );
  }

  if (path === null) {
    return (
      <section className="section-container py-10" role="status" aria-busy="true">
        <span className="sr-only">Loading learning path</span>
        <div className="h-8 w-64 animate-pulse rounded-full bg-neutral-100 motion-reduce:animate-none" />
        <div className="mt-6 h-64 animate-pulse rounded-[1.25rem] bg-neutral-100 motion-reduce:animate-none" />
      </section>
    );
  }

  const courses = path.courses ?? [];
  const next = courses.find((course) => course.isRequired && !course.completed);

  return (
    <>
      <LearnerHeader
        above={
          <Link
            href="/my-learning-paths"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-[0_1px_2px_rgb(16_18_31/0.06)] transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            My paths
          </Link>
        }
        title={path.title}
        intro={
          path.description !== null ? (
            <RichTextView value={path.description} size="sm" className="max-w-2xl text-neutral-600" />
          ) : undefined
        }
        actions={
          path.isComplete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-xs font-semibold text-success-700 ring-1 ring-inset ring-success-200">
              <CheckCircle2 size={13} aria-hidden="true" />
              Finished
            </span>
          ) : path.isOverdue ? (
            /*
              Only when it has actually passed. A deadline in March is not a
              problem, and a badge that treats it as one makes the real ones
              easy to ignore.
            */
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-700 ring-1 ring-inset ring-error-200">
              <TriangleAlert size={13} aria-hidden="true" />
              Past its date
            </span>
          ) : path.dueAt !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 ring-1 ring-inset ring-neutral-200">
              <CalendarClock size={13} aria-hidden="true" />
              Due {new Date(path.dueAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : undefined
        }
      />

      <section className="section-container pb-16 pt-2 sm:pb-20">
        {/* --------------------------- progress ------------------------- */}

        <div className="xw-glow-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-700">
              <span className="font-heading text-2xl font-bold text-neutral-900">
                {path.completedCount}
              </span>{" "}
              of {path.requiredCount} required{" "}
              {path.requiredCount === 1 ? "course" : "courses"} done
            </p>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {path.percent}%
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-[width]"
              style={{ width: `${path.percent}%` }}
            />
          </div>

          {/*
            The question the list page could not answer. Straight to the course
            rather than to its description page: somebody on a path has already
            decided to take it.
          */}
          {next !== undefined && (
            <Link href={`/learn/${next.slug}`} className="btn-primary mt-5 max-w-full">
              <span className="truncate">Carry on with {next.title}</span>
              <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* --------------------------- the courses ---------------------- */}

        <h2 className="mt-10 font-heading text-lg font-semibold text-neutral-900">
          What is on this path
        </h2>

        <ol className="mt-4 space-y-2.5">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/learn/${course.slug}`}
                className={`${LEARNER_CARD} flex items-center gap-3 px-4 py-3.5 transition-colors hover:border-primary-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
              >
                {course.completed ? (
                  <CheckCircle2 size={18} className="shrink-0 text-success-600" aria-label="Done" />
                ) : (
                  <Circle size={18} className="shrink-0 text-neutral-300" aria-hidden="true" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-800">
                    {course.title}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {course.totalLectures} lessons
                    {course.duration !== null && ` · ${course.duration}`}
                  </p>
                </div>

                {/*
                  Said out loud, because only required courses count towards the
                  percentage above. A learner at 100% with an optional course
                  unticked is finished, and without this they go looking for
                  what they missed.
                */}
                {!course.isRequired && (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                    Optional
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>

        {courses.length === 0 && (
          <p className="xw-tile mt-4 px-4 py-8 text-center text-sm text-neutral-500">
            Nothing has been added to this path yet.
          </p>
        )}
      </section>
    </>
  );
}
