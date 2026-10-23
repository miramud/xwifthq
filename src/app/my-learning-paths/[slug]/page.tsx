"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Sign in
          </Link>{" "}
          to see your learning paths.
        </p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="section-container flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
          <Route size={26} className="text-neutral-400" />
        </div>
        <h1 className="heading-3 text-neutral-900">{error}</h1>
        <Link
          href="/my-learning-paths"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <ArrowLeft size={16} />
          Back to my paths
        </Link>
      </section>
    );
  }

  if (path === null) {
    return (
      <section className="section-container py-10" role="status" aria-busy="true">
        <span className="sr-only">Loading learning path</span>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-neutral-100 motion-reduce:animate-none" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-neutral-100 motion-reduce:animate-none" />
      </section>
    );
  }

  const courses = path.courses ?? [];
  const next = courses.find((course) => course.isRequired && !course.completed);

  return (
    <section className="section-container py-8 sm:py-10">
      <Link
        href="/my-learning-paths"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-800"
      >
        <ArrowLeft size={15} />
        My paths
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="heading-3 text-neutral-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {path.title}
          </h1>
          {path.description !== null && (
            <RichTextView value={path.description} size="sm" className="mt-1 max-w-2xl text-neutral-600" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {path.isComplete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700">
              <CheckCircle2 size={13} />
              Finished
            </span>
          ) : path.isOverdue ? (
            /*
              Only when it has actually passed. A deadline in March is not a
              problem, and a badge that treats it as one makes the real ones
              easy to ignore.
            */
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 px-3 py-1 text-xs font-medium text-error-700">
              <TriangleAlert size={13} />
              Past its date
            </span>
          ) : path.dueAt !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              <CalendarClock size={13} />
              Due {new Date(path.dueAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
      </div>

      {/* --------------------------- progress ------------------------- */}

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700">
            <span className="text-lg font-semibold text-neutral-900">
              {path.completedCount}
            </span>{" "}
            of {path.requiredCount} required{" "}
            {path.requiredCount === 1 ? "course" : "courses"} done
          </p>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums">
            {path.percent}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
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
          <Link
            href={`/learn/${next.slug}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Carry on with {next.title}
          </Link>
        )}
      </div>

      {/* --------------------------- the courses ---------------------- */}

      <h2 className="mt-8 text-sm font-semibold text-neutral-900">
        What is on this path
      </h2>

      <ol className="mt-3 space-y-2">
        {courses.map((course) => (
          <li key={course.slug}>
            <Link
              href={`/learn/${course.slug}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
            >
              {course.completed ? (
                <CheckCircle2 size={18} className="shrink-0 text-success-600" />
              ) : (
                <Circle size={18} className="shrink-0 text-neutral-300" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">
                  {course.title}
                </p>
                <p className="truncate text-xs text-neutral-400">
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
        <p className="mt-3 text-sm text-neutral-500">
          Nothing has been added to this path yet.
        </p>
      )}
    </section>
  );
}
