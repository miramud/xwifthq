"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  MessageSquare,
  Award,
  HelpCircle,
  UserPlus,
  TrendingUp,
  CheckCircle2,
  Wallet,
  BookOpen,
  Activity,
  CalendarDays,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, Panel, Progress, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import type { Hue } from "@/components/workspace/modules";
import { CourseThumb } from "@/components/shared/CourseCover";
import { BackLink, FaceAvatar, IconTile, Skeleton, StatCard, StatusChip, Timeline } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompactNaira } from "@/suite/lms/lib/instructor-data";
import { formatDate, timeAgo } from "@/lib/console-data";
import {
  students as studentsApi,
  ApiError,
  type LearnerDetail,
  type LearnerActivity,
  type LearnerStatus,
} from "@/lib/api/instructor-client";

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const STATUS_HUE: Record<LearnerStatus, Hue> = {
  Active: "sky",
  Completed: "mint",
  "At risk": "sun",
  Refunded: "rose",
  Cancelled: "slate",
};

const ACTIVITY_STYLE: Record<LearnerActivity["kind"], { icon: LucideIcon; hue: Hue }> = {
  enroll: { icon: UserPlus, hue: "mint" },
  quiz: { icon: HelpCircle, hue: "sky" },
  message: { icon: MessageSquare, hue: "slate" },
  certificate: { icon: Award, hue: "sun" },
};

const progressHue = (v: number): Hue => (v >= 75 ? "mint" : v >= 40 ? "blue" : "sun");

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [learner, setLearner] = useState<LearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    studentsApi
      .get(id)
      .then((d: LearnerDetail) => {
        if (alive) setLearner(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setErr(e instanceof ApiError ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading student…</span>
        <Skeleton className="h-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (notFound || !learner) {
    return (
      <div className="space-y-4">
        <BackLink href="/suite/lms/teach/students" label="Back to students" />
        <Card>
          <Empty
            icon={Users}
            hue={err ? "rose" : "blue"}
            title={err ? "Couldn't load student" : "Student not found"}
            hint={err ?? "This enrollment may have been removed or the link is incorrect."}
            action={
              <ButtonLink href="/suite/lms/teach/students" size="sm">
                Back to students
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  const {
    name,
    email,
    initials,
    courseSlug,
    courseTitle,
    courseGradient,
    courseThumbnailUrl,
    enrolledOn,
    lastActive,
    progress,
    status,
    amountPaid,
    lessonsDone,
    totalLessons,
    quizAvg,
    sections,
    quizzes,
    activity,
  } = learner;

  const certEnabled = progress >= 100;

  type Quiz = (typeof quizzes)[number];
  const quizRows = quizzes.map((qz, i) => ({ ...qz, _key: String(i) }));
  const quizColumns: Column<Quiz & { _key: string }>[] = [
    {
      key: "lecture",
      header: "Assessment",
      primary: true,
      sortable: true,
      value: (q) => q.lecture ?? "Assessment",
      render: (q) => (
        <span className="flex items-center gap-3">
          <IconTile icon={HelpCircle} hue="sky" size={32} />
          <span className="font-medium text-neutral-900">{q.lecture ?? "Assessment"}</span>
        </span>
      ),
    },
    {
      key: "takenAt",
      header: "Taken",
      sortable: true,
      value: (q) => q.takenAt,
      render: (q) => <span className="text-neutral-500">{formatDate(q.takenAt)}</span>,
    },
    {
      key: "percentage",
      header: "Score",
      sortable: true,
      align: "right",
      value: (q) => q.percentage,
      render: (q) => <span className="font-semibold text-neutral-900">{q.percentage}%</span>,
    },
    {
      key: "passed",
      header: "Result",
      value: (q) => (q.passed ? "Passed" : "Not passed"),
      render: (q) => (
        <StatusChip status={q.passed ? "passed" : "failed"} hue={q.passed ? "mint" : "rose"} label={q.passed ? "Passed" : "Not passed"} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/teach/students" label="Back to students" />

        {/* ---------- profile header ---------- */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-sky-500 via-primary-500 to-grape-500 opacity-90" aria-hidden />
          <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <span className="-mt-10 inline-block w-fit rounded-full bg-white p-1 shadow-sm">
                <FaceAvatar name={name ?? initials} size={80} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900">
                    {name ?? "Unnamed learner"}
                  </h1>
                  <StatusChip status={status} label={status} hue={STATUS_HUE[status]} />
                </div>
                <p className="mt-0.5 truncate text-sm text-neutral-500">{email ?? "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip hue="blue" icon={CalendarDays}>
                    Enrolled {formatDate(enrolledOn)}
                  </Chip>
                  <Chip hue="mint" icon={Clock}>
                    Active {timeAgo(lastActive)}
                  </Chip>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!certEnabled}
                title={certEnabled ? undefined : "Available once the student reaches 100%"}
                icon={Award}
              >
                Issue certificate
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------- KPI row ---------- */}
      <StatGrid>
        <StatCard featured featuredHue="sky" icon={TrendingUp} label="Course progress" value={`${progress}%`} />
        <StatCard icon={CheckCircle2} hue="mint" label="Lessons completed" value={`${lessonsDone} / ${totalLessons}`} />
        <StatCard icon={HelpCircle} hue="sky" label="Quiz average" value={quizAvg == null ? "—" : `${quizAvg}%`} />
        <StatCard icon={Wallet} hue="sun" label="Amount paid" value={Number.isFinite(amountPaid) ? formatCompactNaira(amountPaid) : "—"} />
      </StatGrid>

      {/* ---------- two-column layout ---------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Course progress" subtitle="Enrolled course & module breakdown" icon={BookOpen} hue="grape">
            {/* enrolled course */}
            <div className="flex items-center gap-4 rounded-xl bg-neutral-50 p-3">
              <CourseThumb
                title={courseTitle ?? "Course"}
                gradient={courseGradient}
                thumbnailUrl={courseThumbnailUrl}
                size={56}
                rounded="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                {courseSlug ? (
                  <Link
                    href={`/suite/lms/teach/courses/${courseSlug}`}
                    className="block truncate text-sm font-semibold text-neutral-900 transition-colors hover:text-primary-700"
                  >
                    {courseTitle ?? courseSlug}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    {courseTitle ?? "Course"}
                  </span>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <Meter value={progress} hue={progressHue(progress)} label={`${courseTitle ?? "Course"} progress`} />
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{progress}%</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  <span className="tabular-nums">{lessonsDone}</span> of{" "}
                  <span className="tabular-nums">{totalLessons}</span> lessons completed
                </p>
              </div>
            </div>

            {/* module progress */}
            <div className="mt-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Module progress
              </h4>
              {sections.length === 0 ? (
                <p className="text-sm text-neutral-500">This course has no modules yet.</p>
              ) : (
                <ul className="space-y-3.5">
                  {sections.map((m, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                          m.percent >= 100 ? "bg-mint-50 text-mint-700" : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {m.percent >= 100 ? <CheckCircle2 size={14} aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{m.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-neutral-500">
                        {m.completed}/{m.lessons}
                      </span>
                      <span className="w-24 sm:w-36">
                        <Meter value={m.percent} size="sm" hue={progressHue(m.percent)} label={`${m.title} progress`} />
                      </span>
                      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700">
                        {m.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <section aria-labelledby="quiz-heading">
            <div className="mb-3 flex items-center gap-3">
              <IconTile icon={HelpCircle} hue="sky" />
              <div>
                <h2 id="quiz-heading" className="text-[15px] font-semibold text-neutral-900">
                  Quiz scores
                </h2>
                <p className="text-xs text-neutral-500">Performance across assessments</p>
              </div>
            </div>
            <DataView
              rows={quizRows}
              columns={quizColumns}
              rowKey={(q) => q._key}
              storageKey="teach.student-quizzes"
              searchable={false}
              gridCols={2}
              caption="Quiz scores for this learner"
              empty={
                <Empty
                  icon={HelpCircle}
                  hue="sky"
                  title="No quizzes taken yet"
                  hint="Scores appear here once the learner completes an assessment."
                />
              }
              renderCard={(q) => (
                <div className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <IconTile icon={HelpCircle} hue={q.passed ? "mint" : "rose"} />
                    <StatusChip status={q.passed ? "passed" : "failed"} hue={q.passed ? "mint" : "rose"} label={q.passed ? "Passed" : "Not passed"} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{q.lecture ?? "Assessment"}</p>
                    <p className="text-xs text-neutral-500">{formatDate(q.takenAt)}</p>
                  </div>
                  <Progress value={q.percentage} hue={q.passed ? "mint" : "coral"} label="Score" showValue />
                </div>
              )}
            />
          </section>
        </div>

        {/* right column */}
        <div className="lg:col-span-1">
          <Panel title="Activity timeline" subtitle="Recent learning activity" icon={Activity} hue="sky">
            {activity.length === 0 ? (
              <Empty icon={Activity} hue="sky" title="No activity recorded yet." />
            ) : (
              <Timeline
                items={activity.map((a: LearnerActivity, i: number) => {
                  const s = ACTIVITY_STYLE[a.kind];
                  return {
                    id: String(i),
                    icon: s.icon,
                    hue: s.hue,
                    text: (
                      <>
                        <span className="font-semibold text-neutral-900">{a.label}</span>
                        <span className="block truncate text-xs text-neutral-500">{a.detail}</span>
                      </>
                    ),
                    when: timeAgo(a.at),
                  };
                })}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
