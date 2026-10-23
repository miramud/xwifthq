"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Layers,
  RefreshCw,
  Trophy,
  UserX,
} from "lucide-react";
import {
  adminProgress,
  isEnrolled,
  type LearnerCourseProgress,
  type LearnerCourseProgressResult,
} from "@/lib/api/progress-client";
import { gamification, type Leaderboard, type LeaderboardRow } from "@/lib/api/saas-client";
import { formatDate, timeAgo } from "@/lib/console-data";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel, Progress, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { AreaLine, SegmentedGauge } from "@/components/workspace/charts";
import {
  BackLink,
  ErrorNote,
  FaceAvatar,
  InfoList,
  InfoRow,
  Skeleton,
  StatCard,
  StatusChip,
} from "@/suite/lms/components/ui/ws";

/**
 * One learner, one course: how far they have got, how they are doing on the
 * quizzes, and where that puts them among everybody else on the course.
 *
 * Opened from the course's Learners tab, and linked back to it. The progress
 * figures are the same ones the learner sees on their own page, deliberately:
 * a conversation about overdue training goes better when both people are
 * looking at the same numbers.
 */

type Span = "30" | "90" | "365";

const WINDOWS: { key: Span; label: string }[] = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "365", label: "12 months" },
];

export default function CourseLearnerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const backHref = `/suite/lms/courses/${encodeURIComponent(slug)}?tab=learners`;

  const [range, setRange] = useState<Span>("90");
  const [result, setResult] = useState<LearnerCourseProgressResult | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await adminProgress.learnerInCourse(slug, id, Number(range)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load this learner's progress.");
    } finally {
      setLoading(false);
    }
  }, [slug, id, range]);

  // The board does not depend on the window, so it is fetched once, and a
  // failure there should not take the whole page down with it.
  const loadBoard = useCallback(async () => {
    setBoardError(false);
    try {
      setBoard(await gamification.adminCourseBoard(slug));
    } catch {
      setBoardError(true);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  /* ---- first load ------------------------------------------------- */
  if (loading && !result) {
    return (
      <div aria-busy="true" aria-label="Loading learner">
        <BackLink href={backHref} label="Back to learners" />
        <Skeleton className="mb-6 h-16 w-full max-w-lg" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div>
        <BackLink href={backHref} label="Back to learners" />
        <ErrorNote className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" icon={RefreshCw} onClick={() => void load()}>
            Try again
          </Button>
        </ErrorNote>
      </div>
    );
  }

  if (!result || !isEnrolled(result)) {
    return (
      <div>
        <BackLink href={backHref} label="Back to learners" />
        <Card>
          <Empty
            icon={UserX}
            hue="slate"
            title="This person isn't on the course"
            hint="They may have been unassigned, or the link is out of date. The Learners tab shows everyone on the course now."
            action={<ButtonLink href={backHref}>See who is on the course</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  return (
    <LearnerView
      data={result}
      backHref={backHref}
      range={range}
      onRange={setRange}
      refreshing={loading}
      error={error}
      board={board}
      boardError={boardError}
      onRetryBoard={() => void loadBoard()}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  The page, once there is a learner to show                          */
/* ------------------------------------------------------------------ */

function LearnerView({
  data,
  backHref,
  range,
  onRange,
  refreshing,
  error,
  board,
  boardError,
  onRetryBoard,
}: {
  data: LearnerCourseProgress;
  backHref: string;
  range: Span;
  onRange: (w: Span) => void;
  refreshing: boolean;
  error: string | null;
  board: Leaderboard | null;
  boardError: boolean;
  onRetryBoard: () => void;
}) {
  const completed = data.status === "completed" || data.percent >= 100;
  const stage = completed ? "completed" : data.percent > 0 ? "in_progress" : "not_started";
  const stageLabel = completed ? "Completed" : data.percent > 0 ? "In progress" : "Not started";

  const series = useMemo(
    () => data.series.map((p) => ({ label: p.label, value: p.percent ?? 0 })),
    [data.series],
  );
  const backfilled = data.series.some((p) => p.backfilled > 0);
  const quizAverage = data.quiz.average === null ? null : Math.round(data.quiz.average);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={backHref} label="Back to learners" />
        <PageHeader
          eyebrow={data.course.title}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <FaceAvatar name={data.learner.name} size={40} />
              {data.learner.name}
              {data.status === "cancelled" ? (
                <StatusChip status="cancelled" label="Withdrawn" />
              ) : (
                <StatusChip status={stage} label={stageLabel} />
              )}
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{data.learner.email}</span>
              <span aria-hidden className="text-neutral-300">·</span>
              <Chip hue={data.source === "Self-enrolled" ? "slate" : "sky"}>{data.source}</Chip>
              {data.mandatory && <Chip hue="coral">Required</Chip>}
            </span>
          }
          actions={
            <Segmented options={WINDOWS} value={range} onChange={onRange} label="Activity window" />
          }
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* ---- the four numbers ------------------------------------- */}
      <StatGrid>
        <StatCard
          featured
          featuredHue={completed ? "mint" : "blue"}
          label="Course progress"
          value={data.percent}
          unit="%"
          icon={Activity}
          hint={completed && data.completedAt ? `Finished ${formatDate(data.completedAt)}` : `${stageLabel}`}
        />
        <StatCard
          label="Lessons done"
          value={data.lessonsDone}
          unit={`of ${data.course.totalLectures}`}
          icon={BookOpen}
          hue="grape"
        />
        <StatCard
          label="Active days"
          value={data.activeDays}
          icon={Flame}
          hue="sun"
          hint="Days they finished at least one lesson"
        />
        <StatCard
          label="Last activity"
          value={data.lastActivityAt ? timeAgo(data.lastActivityAt) : "Never"}
          icon={Clock}
          hue={data.daysSinceActivity !== null && data.daysSinceActivity > 14 ? "coral" : "sky"}
          hint={
            completed
              ? "Course finished"
              : data.daysSinceActivity === null
                ? "Hasn't started yet"
                : `${data.daysSinceActivity} ${data.daysSinceActivity === 1 ? "day" : "days"} without progress`
          }
        />
      </StatGrid>

      {/* ---- progress over time + key dates ----------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel
            title="Progress over time"
            subtitle={`Share of the course finished · last ${WINDOWS.find((w) => w.key === range)?.label}`}
            icon={Activity}
            hue="blue"
          >
            <div className={cx("transition-opacity", refreshing && "opacity-60")}>
              {series.length === 0 ? (
                <Empty icon={Activity} title="No activity in this window" hint="Try a longer window." />
              ) : (
                <AreaLine
                  data={series}
                  hue={completed ? "mint" : "blue"}
                  height={220}
                  caption={`${data.learner.name}'s progress on ${data.course.title}`}
                  format={(v: number) => `${Math.round(v)}% done`}
                />
              )}
            </div>
            {backfilled && (
              <p className="mt-3 text-xs text-neutral-500">
                Lessons finished before progress was timestamped are counted on the day tracking started, so an early
                jump is a cutover, not a burst of work.
              </p>
            )}
          </Panel>
        </div>

        <Panel title="Key dates" icon={CalendarClock} hue="grape">
          <InfoList>
            <InfoRow icon={CalendarPlus} label="Enrolled" hue="sky">
              {formatDate(data.enrolledAt)}
            </InfoRow>
            <InfoRow icon={Activity} label="First lesson finished" hue="blue">
              {formatDate(data.firstActivityAt)}
            </InfoRow>
            <InfoRow icon={Clock} label="Most recent lesson" hue="sun">
              {formatDate(data.lastActivityAt)}
            </InfoRow>
            <InfoRow icon={CalendarCheck} label="Completed" hue="mint">
              {data.completedAt ? formatDate(data.completedAt) : "Not yet"}
            </InfoRow>
          </InfoList>
        </Panel>
      </div>

      {/* ---- sections + quiz performance -------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel title="Progress by section" subtitle="Lessons finished in each part of the course" icon={Layers} hue="grape">
            {data.sections.length === 0 ? (
              <Empty icon={Layers} hue="grape" title="This course has no sections yet" />
            ) : (
              <ol className="space-y-4">
                {data.sections.map((section, i) => (
                  <li key={`${section.title}-${i}`} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-grape-50 text-xs font-bold tabular-nums text-grape-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-neutral-900">{section.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                          {section.completed} / {section.lectures}
                        </span>
                      </div>
                      <Progress
                        value={section.percent}
                        hue={section.percent >= 100 ? "mint" : "grape"}
                        size="sm"
                        label={`${section.title}: ${section.percent}% done`}
                      />
                    </div>
                    {section.percent >= 100 && (
                      <CheckCircle2 size={18} className="shrink-0 text-mint-600" aria-label="Section finished" />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel title="Quiz performance" icon={HelpCircle} hue="sun">
          {data.quiz.attempts === 0 ? (
            <Empty icon={HelpCircle} hue="sun" title="No quiz attempts yet" hint="Scores appear here after their first quiz." />
          ) : (
            <div className="flex flex-col items-center">
              <SegmentedGauge
                value={quizAverage ?? 0}
                hue={quizAverage !== null && quizAverage >= 70 ? "mint" : "sun"}
                label="Average quiz score"
                display={quizAverage === null ? "—" : `${quizAverage}%`}
                caption="Average score"
                size={200}
              />
              <dl className="mt-4 grid w-full grid-cols-2 gap-3">
                <div className="rounded-2xl bg-neutral-50 p-3.5 text-center">
                  <dt className="text-xs text-neutral-500">Attempts</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">{data.quiz.attempts}</dd>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3.5 text-center">
                  <dt className="text-xs text-neutral-500">Passed</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
                    {data.quiz.passed}
                    <span className="text-sm font-medium text-neutral-400"> / {data.quiz.attempts}</span>
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- leaderboard ------------------------------------------ */}
      <CourseStanding
        learner={data}
        board={board}
        failed={boardError}
        onRetry={onRetryBoard}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Where they stand on the course board                               */
/* ------------------------------------------------------------------ */

/**
 * Board rows carry a name and a score but no user id, so this learner is
 * found by name, preferring the row whose score also matches their progress —
 * two people on one course can share a name.
 */
function findLearner(board: Leaderboard, learner: LearnerCourseProgress): LeaderboardRow | null {
  const named = board.rows.filter((r) => r.name === learner.learner.name);
  return named.find((r) => r.score === learner.percent) ?? named[0] ?? null;
}

function CourseStanding({
  learner,
  board,
  failed,
  onRetry,
}: {
  learner: LearnerCourseProgress;
  board: Leaderboard | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const TOP = 10;

  if (failed) {
    return (
      <Panel title="Course leaderboard" icon={Trophy} hue="sun">
        <ErrorNote className="flex flex-wrap items-center justify-between gap-3">
          <span>The leaderboard didn&rsquo;t load.</span>
          <Button size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </ErrorNote>
      </Panel>
    );
  }

  if (!board) {
    return <Skeleton className="h-64" />;
  }

  const mine = findLearner(board, learner);
  const top = board.rows.slice(0, TOP);
  const shownMine = mine !== null && mine.rank > TOP ? mine : null;

  return (
    <Panel
      title="Course leaderboard"
      subtitle={`Ranked by how much of the course each learner has finished · ${board.total} on the board`}
      icon={Trophy}
      hue="sun"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,15rem)_1fr]">
        {/* their standing */}
        <div className="flex flex-col justify-center rounded-2xl bg-sun-50 p-5">
          {mine ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-sun-700">Their rank</p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-neutral-900">
                #{mine.rank}
                <span className="ml-1 text-base font-medium text-neutral-500">of {board.total}</span>
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                {mine.rank === 1
                  ? "Top of the course."
                  : `${mine.rank - 1} ${mine.rank === 2 ? "learner is" : "learners are"} further ahead.`}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-sun-700">Not ranked yet</p>
              <p className="mt-2 text-sm text-neutral-600">
                {learner.percent === 0
                  ? "The board lists learners once they finish their first lesson."
                  : "They're outside the top 50 learners the board shows."}
              </p>
            </>
          )}
        </div>

        {/* the top of the board */}
        {top.length === 0 ? (
          <Empty icon={Award} hue="sun" title="Nobody has made progress yet" hint="The board fills up as learners finish lessons." />
        ) : (
          <ol className="divide-y divide-neutral-100" aria-label={`Top ${top.length} on ${board.title ?? "this course"}`}>
            {[...top, ...(shownMine ? [shownMine] : [])].map((row, i) => {
              const isThem = mine !== null && row.rank === mine.rank && row.name === mine.name;
              return (
                <li
                  key={`${row.rank}-${row.name}-${i}`}
                  aria-current={isThem ? "true" : undefined}
                  className={cx(
                    "flex items-center gap-3 px-3 py-2.5",
                    isThem && "rounded-xl bg-primary-50 ring-1 ring-primary-200",
                    shownMine === row && "mt-2 border-t-0",
                  )}
                >
                  <span
                    className={cx(
                      "w-8 shrink-0 text-center text-sm font-bold tabular-nums",
                      row.rank <= 3 ? "text-sun-700" : "text-neutral-500",
                    )}
                  >
                    {row.rank}
                  </span>
                  <FaceAvatar name={row.name} src={row.avatarUrl} size={30} />
                  <span className={cx("min-w-0 flex-1 truncate text-sm", isThem ? "font-semibold text-primary-800" : "text-neutral-800")}>
                    {row.name}
                    {isThem && <span className="sr-only"> (this learner)</span>}
                  </span>
                  <span className="hidden w-28 sm:block">
                    <Progress value={row.score} hue={isThem ? "blue" : "sun"} size="sm" label={`${row.name}: ${row.score}%`} />
                  </span>
                  <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-900">
                    {row.score}%
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}
