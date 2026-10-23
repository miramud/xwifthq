"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, RefreshCw, Trophy } from "lucide-react";
import {
  gamification as api,
  myLearningPaths as pathsApi,
  ApiError,
  type Badge,
  type BadgeShelf,
  type Leaderboard,
  type LearnerPath,
} from "@/lib/api/saas-client";
import { useAuth } from "@/lib/auth-store";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { LEARNER_CARD, LearnerHeader, PILL_OUTLINE } from "@/components/learner/LearnerHeader";

/**
 * A learner's badges and where they stand.
 *
 * Badges here are **quarters**, so the page draws them as quarters. A course
 * with two of its four badges is one rail with two segments filled and the
 * next one outlined and named — which says "Home Straight is next" in the same
 * glance that a shuffled grid of medallions would spend saying "you have six
 * badges" and nothing else. The order is the point; a trophy cabinet throws it
 * away.
 *
 * Milestones are a count rather than a fraction, so they get a different shape:
 * one ladder across the whole account, with the next rung labelled by how many
 * courses are left.
 *
 * Everything else is deliberately quiet. The rails carry the page.
 */

const QUARTERS = [25, 50, 75, 100] as const;

/* ------------------------------------------------------------------ */
/*  The quarter rail — one subject, four segments                      */
/* ------------------------------------------------------------------ */

function QuarterRail({
  title,
  earned,
  href,
}: {
  title: string;
  /** Tiers held, e.g. [25, 50]. */
  earned: number[];
  href?: string;
}) {
  const highest = earned.length > 0 ? Math.max(...earned) : 0;
  const next = QUARTERS.find((q) => q > highest) ?? null;

  return (
    <li className={`${LEARNER_CARD} p-5`}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="min-w-0 truncate font-heading text-base font-semibold text-neutral-800">
          {href ? (
            <Link
              href={href}
              className="rounded hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-400">
          {highest}%
        </span>
      </div>

      <ol
        className="mt-3 flex gap-1.5"
        aria-label={`${title}: ${earned.length} of 4 quarter badges earned`}
      >
        {QUARTERS.map((quarter) => {
          const held = earned.includes(quarter);
          const isNext = quarter === next;

          return (
            <li
              key={quarter}
              className={`h-2 flex-1 rounded-full transition-colors ${
                held
                  ? "bg-primary-600"
                  : isNext
                    ? "bg-primary-100 ring-1 ring-inset ring-primary-300"
                    : "bg-neutral-100"
              }`}
            >
              <span className="sr-only">
                {quarter}%: {held ? "earned" : isNext ? "next" : "not yet"}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-2.5 text-xs text-neutral-500">
        {next === null
          ? "Every badge on this one is yours."
          : `Next: ${next}% of the way through.`}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Milestone ladder — a count, not a fraction                         */
/* ------------------------------------------------------------------ */

function MilestoneLadder({ shelf }: { shelf: BadgeShelf }) {
  const held = shelf.badges.filter((b) => b.type === "milestone");
  const next = shelf.nextMilestone;

  if (held.length === 0 && next === null) return null;

  return (
    <section aria-labelledby="milestones-heading" className="xw-glow-card p-5 sm:p-6">
      <h2 id="milestones-heading" className="font-heading text-lg font-semibold text-neutral-800">
        Milestones
      </h2>
      <p className="mt-1 text-sm text-neutral-500">Courses you have finished, all together.</p>

      <ol className="mt-4 flex flex-wrap gap-2">
        {held.map((badge) => (
          <li
            key={badge.key}
            className="rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white"
            title={badge.description}
          >
            {badge.name}
          </li>
        ))}

        {next && (
          <li className="rounded-full border border-dashed border-primary-300 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600">
            {next.name}: {next.coursesToGo} more{" "}
            {next.coursesToGo === 1 ? "course" : "courses"}
          </li>
        )}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

function BoardRow({ row, unit }: { row: Leaderboard["rows"][number]; unit?: string }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
        row.isYou ? "bg-primary-50 ring-1 ring-inset ring-primary-200" : ""
      }`}
    >
      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-400">
        {row.rank}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600">
        {row.initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
        {row.name}
        {row.isYou && <span className="ml-1.5 text-xs font-medium text-primary-700">You</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-800">
        {unit === "courses" ? row.score : `${row.score}%`}
      </span>
    </li>
  );
}

function Board({ board, loading }: { board: Leaderboard | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-busy="true">
        <span className="sr-only">Loading the leaderboard</span>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-xl bg-neutral-100 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  // Defensive: a board that failed on the way through the proxy arrives without
  // its rows, and an empty board and a broken one should read the same here.
  const rows = board?.rows ?? [];

  if (rows.length === 0) {
    return (
      <p className="xw-tile px-4 py-8 text-center text-sm text-neutral-500">
        Nobody has made progress here yet. Be the first.
      </p>
    );
  }

  // Only when the cut above removed them — otherwise their row is already in
  // the list and pinning it again would double them up.
  const pinned = board?.you != null && !rows.some((row) => row.isYou) ? board.you : null;

  return (
    <>
      <ol className="space-y-1">
        {rows.map((row) => (
          <BoardRow key={`${row.rank}-${row.name}`} row={row} unit={board?.unit} />
        ))}
      </ol>

      {pinned && (
        <>
          <p className="my-2 border-t border-dashed border-neutral-200 pt-2 text-center text-xs text-neutral-400">
            {pinned.rank - rows.length - 1} others between
          </p>
          <ol>
            <BoardRow row={pinned} unit={board?.unit} />
          </ol>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type BoardChoice = { key: string; label: string; group: string };

export default function AchievementsPage() {
  const { user, loading: authLoading } = useAuth();

  const [shelf, setShelf] = useState<BadgeShelf | null>(null);
  const [paths, setPaths] = useState<LearnerPath[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [choice, setChoice] = useState("usage");
  /**
   * The board is stored with the choice it answers, so "still loading" is a
   * derived fact rather than a second piece of state — writing a loading flag
   * synchronously inside the effect would cost a cascading render.
   */
  const [boardState, setBoardState] = useState<{ key: string; data: Leaderboard | null } | null>(
    null,
  );

  const boardLoading = boardState?.key !== choice;
  const board = boardState?.key === choice ? boardState.data : null;

  const load = useCallback(() => {
    Promise.all([api.badges(), pathsApi.list().catch(() => [])])
      .then(([shelfData, pathData]) => {
        setShelf(shelfData);
        setPaths(pathData);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load your achievements."),
      );
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  /**
   * Boards a learner can actually open: everyone, plus any course or path they
   * hold a badge on. Deriving the courses from the shelf rather than from
   * `/me/courses` keeps this to one request and matches the rest of the page —
   * a course with no progress has an empty board anyway.
   */
  const choices = useMemo<BoardChoice[]>(() => {
    const options: BoardChoice[] = [{ key: "usage", label: "Everyone", group: "Institution" }];

    const seen = new Set<string>();

    for (const badge of shelf?.badges ?? []) {
      if (badge.type !== "course" || badge.subjectTitle === null) continue;
      if (seen.has(badge.subjectTitle)) continue;
      seen.add(badge.subjectTitle);
      options.push({
        key: `course:${badge.subjectTitle}`,
        label: badge.subjectTitle,
        group: "Courses",
      });
    }

    for (const path of paths) {
      options.push({ key: `path:${path.slug}`, label: path.title, group: "Learning paths" });
    }

    return options;
  }, [shelf, paths]);

  /**
   * Course boards are keyed by slug, but a badge only carries the title — so
   * the shelf's course options are resolved against `/me/courses` on demand.
   * Paths carry their slug already.
   */
  useEffect(() => {
    if (!user) return;

    let alive = true;

    const fetchBoard = async (): Promise<Leaderboard | null> => {
      if (choice === "usage") return api.usageBoard();

      const [kind, value] = [choice.slice(0, choice.indexOf(":")), choice.slice(choice.indexOf(":") + 1)];

      if (kind === "path") return api.pathBoard(value);

      const res = await fetch("/api/me/courses", { cache: "no-store" });
      const body = (await res.json()) as { courses?: { slug: string; title: string }[] };
      const match = (body.courses ?? []).find((c) => c.title === value);

      return match ? api.courseBoard(match.slug) : null;
    };

    fetchBoard()
      .then((data) => {
        if (alive) setBoardState({ key: choice, data });
      })
      .catch(() => {
        if (alive) setBoardState({ key: choice, data: null });
      });

    return () => {
      alive = false;
    };
  }, [choice, user]);

  const courseRails = useMemo(() => railsFor(shelf, "course"), [shelf]);
  const pathRails = useMemo(() => railsFor(shelf, "learning_path"), [shelf]);

  if (!authLoading && !user) {
    return (
      <Frame>
        <div className={`${LEARNER_CARD} p-10 text-center`}>
          <p className="text-neutral-600">Log in to see your badges and where you stand.</p>
          <Link href="/login?redirect=/achievements" className="btn-primary mt-5">
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

      {shelf === null && !error && (
        <div className="space-y-4" role="status" aria-busy="true">
          <span className="sr-only">Loading your achievements</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-[1.25rem] bg-neutral-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      )}

      {shelf && (
        <div className="space-y-10">
          {shelf.counts?.total === 0 ? (
            <div className="xw-tile p-10 text-center sm:p-12">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-[0_1px_2px_rgb(16_18_31/0.06)]">
                <Award className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="font-heading text-lg font-semibold text-neutral-800">
                No badges yet
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
                Finish a quarter of any course and the first one is yours.
              </p>
              <Link href="/my-courses" className="btn-outline mt-6">
                Go to my courses
              </Link>
            </div>
          ) : (
            <MilestoneLadder shelf={shelf} />
          )}

          {courseRails.length > 0 && (
            <section aria-labelledby="courses-heading">
              <h2
                id="courses-heading"
                className="font-heading text-lg font-semibold text-neutral-800"
              >
                Courses
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                A badge at every quarter. Filled is earned; outlined is next.
              </p>
              <ul className="mt-4 space-y-3">
                {courseRails.map((rail) => (
                  <QuarterRail key={rail.title} title={rail.title} earned={rail.earned} />
                ))}
              </ul>
            </section>
          )}

          {pathRails.length > 0 && (
            <section aria-labelledby="paths-heading">
              <h2
                id="paths-heading"
                className="font-heading text-lg font-semibold text-neutral-800"
              >
                Learning paths
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Measured over the courses the path requires.
              </p>
              <ul className="mt-4 space-y-3">
                {pathRails.map((rail) => (
                  <QuarterRail
                    key={rail.title}
                    title={rail.title}
                    earned={rail.earned}
                    href="/my-learning-paths"
                  />
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="leaderboard-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="leaderboard-heading"
                  className="flex items-center gap-2 font-heading text-lg font-semibold text-neutral-800"
                >
                  <Trophy className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                  Leaderboard
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  People at your institution. Nobody outside it appears here, and nobody outside
                  it sees you.
                </p>
              </div>

              <SearchableSelect
                value={choice}
                onChange={setChoice}
                aria-label="Which leaderboard"
                searchPlaceholder="Search courses and paths"
                className="w-full shrink-0 sm:w-64"
                options={choices.map((option) => ({
                  value: option.key,
                  label: option.label,
                  group: option.group,
                }))}
              />
            </div>

            <div className={`${LEARNER_CARD} mt-4 p-2 sm:p-3`}>
              <Board board={board} loading={boardLoading} />
            </div>
          </section>
        </div>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */

/** Badges of one type, folded into one rail per subject. */
function railsFor(
  shelf: BadgeShelf | null,
  type: Badge["type"],
): { title: string; earned: number[] }[] {
  const bySubject = new Map<string, number[]>();

  for (const badge of shelf?.badges ?? []) {
    if (badge.type !== type) continue;

    const title = badge.subjectTitle ?? "Removed";
    bySubject.set(title, [...(bySubject.get(title) ?? []), badge.tier]);
  }

  return [...bySubject.entries()]
    .map(([title, earned]) => ({ title, earned: earned.sort((a, b) => a - b) }))
    .sort((a, b) => Math.max(...b.earned) - Math.max(...a.earned));
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LearnerHeader
        narrow
        eyebrow={
          <>
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            Learning
          </>
        }
        title="Achievements"
        intro={
          <>
            <p>What you have earned so far, and what is next.</p>
            {/*
              Badges are encouragement; a certificate is evidence. Somebody who
              came here looking for the second wants pointing at it rather than
              left to conclude the platform does not keep one.
            */}
            <p className="mt-2 text-sm text-neutral-500">
              Looking for a certificate to show somebody?{" "}
              <Link
                href="/my-certificates"
                className="rounded font-semibold text-primary-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Your certificates
              </Link>
            </p>
          </>
        }
      />
      <div className="section-container pb-16 pt-2 sm:pb-20">
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </>
  );
}
