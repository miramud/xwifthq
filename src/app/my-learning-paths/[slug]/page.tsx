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
import { ProgressRing } from "@/components/workspace/charts";
import { LEARNER_PANEL, LearnerBody, LearnerHero } from "@/suite/lms/components/learn/LearnerUi";

/**
 * One track, opened.
 *
 * The list page could say a learner was 40% through a path and not which
 * courses those were, so the one question somebody actually has, *what do I
 * do next*, had no answer anywhere in the product. They had to go to the
 * catalogue and work out for themselves which of their courses belonged to it.
 *
 * Two distinctions the page keeps, because collapsing either makes the figure
 * on the list page look wrong:
 *
 * **Required and optional courses are marked apart.** Only required ones count
 * towards completion, the same rule the API uses to decide whether a path is
 * finished, so a learner who has done every required course and skipped an
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
        <p className={`${LEARNER_PANEL} mx-auto max-w-md px-6 py-10 text-sm text-neutral-600`}>
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
      <section className="bg-canvas">
        <div className="section-container flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
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
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-neutral-200/60 motion-reduce:animate-none" />
        <div className="mt-6 h-64 animate-pulse rounded-[1.25rem] bg-neutral-200/60 motion-reduce:animate-none" />
      </section>
    );
  }

  const courses = path.courses ?? [];
  const next = courses.find((course) => course.isRequired && !course.completed);

  return (
    <>
      <LearnerHero
        above={
          <Link
            href="/my-learning-paths"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl pr-2 text-sm font-medium text-neutral-500 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            My paths
          </Link>
        }
        eyebrow={
          <>
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            Learning path
          </>
        }
        title={path.title}
        icons={[Route, CheckCircle2, CalendarClock]}
        intro={
          path.description !== null ? (
            <RichTextView value={path.description} size="sm" inverse className="max-w-2xl text-white/85" />
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200">
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

      <LearnerBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --------------------------- progress ------------------------- */}

        <div className={`${LEARNER_PANEL} p-5 sm:p-6 lg:order-2 lg:self-start`}>
          <h2 className="font-heading text-base font-bold text-neutral-900">Your progress</h2>
          <div className="mt-4 flex flex-col items-center gap-4 text-center">
            <ProgressRing
              value={path.percent}
              hue={path.isComplete ? "mint" : "blue"}
              size={150}
              label="complete"
              caption="Required courses finished on this path"
            />
            <p className="text-sm text-neutral-700">
              <span className="font-heading text-2xl font-bold text-neutral-900">
                {path.completedCount}
              </span>{" "}
              of {path.requiredCount} required{" "}
              {path.requiredCount === 1 ? "course" : "courses"} done
            </p>
          </div>

          {/*
            The question the list page could not answer. Straight to the course
            rather than to its description page: somebody on a path has already
            decided to take it.
          */}
          {next !== undefined && (
            <Link href={`/learn/${next.slug}`} className="btn-primary mt-5 w-full max-w-full">
              <span className="truncate">Carry on with {next.title}</span>
              <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* --------------------------- the courses ---------------------- */}

        <div className={`${LEARNER_PANEL} p-5 sm:p-6 lg:order-1 lg:col-span-2`}>
        <h2 className="font-heading text-base font-bold text-neutral-900">
          What is on this path
        </h2>

        <ol className="mt-4 space-y-1">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/learn/${course.slug}`}
                className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {course.completed ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint-700">
                    <CheckCircle2 size={18} aria-label="Done" />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
                    <Circle size={18} aria-hidden="true" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
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
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                    Optional
                  </span>
                )}
                <ArrowRight size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>

        {courses.length === 0 && (
          <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
            Nothing is on this path yet.
          </p>
        )}
        </div>
        </div>
      </LearnerBody>
    </>
  );
}
