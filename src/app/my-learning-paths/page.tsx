"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Route, CalendarClock, CheckCircle2, TriangleAlert, RefreshCw } from "lucide-react";
import { myLearningPaths as api, ApiError, type LearnerPath } from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { richExcerpt } from "@/lib/richText";
import { LEARNER_CARD, LearnerHeader, PILL_OUTLINE } from "@/components/learner/LearnerHeader";

/**
 * The learner's tracks.
 *
 * A path is a commitment with a deadline, so the two things a learner needs at
 * a glance are how far through they are and whether they are late. Progress is
 * a ring rather than a bar: it reads as a single completion figure, which is
 * what a track is, where a bar reads as position within a list.
 */
export default function MyLearningPathsPage() {
  const { user, loading: authLoading } = useAuth();

  const [paths, setPaths] = useState<LearnerPath[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Both state writes happen in the promise callbacks rather than synchronously
   * in the effect body — a setState during an effect is a cascading render that
   * React has to redo.
   */
  const load = useCallback(() => {
    api
      .list()
      .then((data) => {
        setPaths(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load your learning paths."),
      );
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!authLoading && !user) {
    return (
      <Frame>
        <div className={`${LEARNER_CARD} p-10 text-center`}>
          <p className="text-neutral-600">Log in to see the tracks assigned to you.</p>
          <Link href="/login?redirect=/my-learning-paths" className="btn-primary mt-5">
            Log in
          </Link>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {error && (
        <div className={`${LEARNER_CARD} p-8 text-center`}>
          <p className="text-sm text-neutral-600">{error}</p>
          <button type="button" onClick={load} className={`${PILL_OUTLINE} mt-4`}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {paths === null && !error && (
        <div className="space-y-4" role="status" aria-busy="true">
          <span className="sr-only">Loading your learning paths</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[1.25rem] bg-neutral-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {paths?.length === 0 && (
        <div className="xw-tile p-10 text-center sm:p-12">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
            <Route className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="font-heading text-lg font-semibold text-neutral-800">
            No learning paths yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
            When your organisation puts you on a track, it will show up here with everything it
            includes.
          </p>
          <Link href="/my-courses" className="btn-outline mt-6">
            Go to my courses
          </Link>
        </div>
      )}

      {paths && paths.length > 0 && (
        <ul className="space-y-4">
          {paths.map((path) => (
            <li key={path.slug}>
              <PathCard path={path} />
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LearnerHeader
        narrow
        eyebrow={
          <>
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            Learning
          </>
        }
        title="My learning paths"
        intro="Tracks your organisation has put you on, and how far through you are."
      />
      <div className="section-container pb-16 pt-2 sm:pb-20">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </>
  );
}

function PathCard({ path }: { path: LearnerPath }) {
  const due = path.dueAt ? new Date(path.dueAt) : null;

  return (
    <article className={`${LEARNER_CARD} p-5 sm:p-6`}>
      <div className="flex items-start gap-4 sm:gap-5">
        <ProgressRing percent={path.percent} complete={path.isComplete} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold text-neutral-800">{path.title}</h2>

            {path.isComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-600">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Complete
              </span>
            )}

            {/* Overdue is stated in words as well as colour. */}
            {path.isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2.5 py-1 text-xs font-medium text-error-600">
                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                Overdue
              </span>
            )}
          </div>

          {path.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-600">
              {richExcerpt(path.description, 220)}
            </p>
          )}

          <p className="mt-3 text-sm text-neutral-500">
            <span className="font-medium tabular-nums text-neutral-700">
              {path.completedCount} of {path.requiredCount}
            </span>{" "}
            required course{path.requiredCount === 1 ? "" : "s"} finished
          </p>

          {due && !path.isComplete && (
            <p
              className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${
                path.isOverdue ? "text-error-600" : "text-neutral-500"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Due{" "}
              <time dateTime={path.dueAt ?? undefined}>
                {due.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </p>
          )}

          {/*
            The path, not the course list. Sending somebody to My Courses made
            them work out for themselves which of their courses belonged to
            this track — which is the one question a path is supposed to
            answer.
          */}
          <Link href={`/my-learning-paths/${path.slug}`} className={`${PILL_OUTLINE} mt-4`}>
            {path.isComplete ? "See what you did" : "See what is left"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * A single completion figure, drawn as a ring.
 *
 * The percentage is printed in the middle rather than left to the arc, so the
 * value is readable without interpreting the geometry — and the whole thing
 * carries an accessible label for anyone who cannot see it at all.
 */
function ProgressRing({ percent, complete }: { percent: number; complete: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div
      className="relative h-16 w-16 shrink-0"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% complete`}
    >
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-neutral-200"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          className={`transition-all duration-500 motion-reduce:transition-none ${
            complete ? "text-success-500" : "text-primary-500"
          }`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-neutral-700">
        {percent}%
      </span>
    </div>
  );
}
