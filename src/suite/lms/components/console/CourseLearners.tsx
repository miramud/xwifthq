"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, UserMinus, UserPlus, Users } from "lucide-react";
import { adminProgress, type CourseCohortProgress } from "@/lib/api/progress-client";
import { assignments as assignApi, ApiError } from "@/lib/api/saas-client";
import { formatDate } from "@/lib/console-data";
import { Button, Card, Chip, Empty, Progress, Segmented } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, FaceAvatar, Skeleton, StatusChip } from "@/suite/lms/components/ui/ws";

/**
 * Everyone on one course: who was assigned it, who enrolled themselves, and how
 * far each of them has got.
 *
 * The roster comes from the progress report rather than the assignment list,
 * because the question an administrator brings here is "who is on this and
 * where are they", and only the progress report answers both halves. Each row
 * opens that person's learning on this course.
 */

type Learner = CourseCohortProgress["learners"][number];
type Stage = "all" | "not_started" | "in_progress" | "completed";

function stageOf(l: Learner): Exclude<Stage, "all"> {
  if (l.status === "completed" || l.percent >= 100) return "completed";
  return l.percent > 0 ? "in_progress" : "not_started";
}

const STAGE_LABEL: Record<Exclude<Stage, "all">, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export default function CourseLearners({
  slug,
  courseTitle,
  totalLectures,
  refreshKey,
  onAssign,
}: {
  slug: string;
  courseTitle: string;
  totalLectures: number;
  /** Bumped by the page after an assignment, so the roster reloads. */
  refreshKey: number;
  onAssign: () => void;
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<CourseCohortProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("all");
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminProgress.course(slug));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "We could not load the learners on this course.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const learners = useMemo(() => data?.learners ?? [], [data]);

  const counts = useMemo(() => {
    const c = { all: learners.length, not_started: 0, in_progress: 0, completed: 0 };
    for (const l of learners) c[stageOf(l)] += 1;
    return c;
  }, [learners]);

  const rows = useMemo(
    () => (stage === "all" ? learners : learners.filter((l) => stageOf(l) === stage)),
    [learners, stage],
  );

  const revoke = useCallback(
    async (l: Learner) => {
      const who = l.name ?? l.email ?? "this learner";
      const ok = await confirm({
        title: `Revoke ${who}'s assignment?`,
        body: (
          <>
            {who} is taken off <strong className="font-semibold text-neutral-800">{courseTitle}</strong> and it
            stops counting towards their required learning. Their progress so far is kept if you assign it again.
            Revoking does not go to the recycle bin.
          </>
        ),
        confirmLabel: "Revoke assignment",
      });
      if (!ok) return;

      setRevoking(l.id);
      try {
        await assignApi.revokeCourse(slug, l.id);
        await load();
      } catch (e: unknown) {
        setError(e instanceof ApiError ? e.message : "We could not revoke that assignment.");
      } finally {
        setRevoking(null);
      }
    },
    [confirm, courseTitle, slug, load],
  );

  const columns: Column<Learner>[] = [
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (l) => l.name ?? l.email ?? "",
      render: (l) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={l.name ?? l.email} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{l.name ?? "Unnamed learner"}</span>
            {l.email && <span className="block truncate text-xs font-normal text-neutral-500">{l.email}</span>}
          </span>
        </span>
      ),
    },
    {
      key: "stage",
      header: "Status",
      sortable: true,
      value: (l) => STAGE_LABEL[stageOf(l)],
      render: (l) =>
        l.status === "cancelled" ? (
          <StatusChip status="cancelled" label="Withdrawn" />
        ) : (
          <StatusChip status={stageOf(l)} label={STAGE_LABEL[stageOf(l)]} />
        ),
    },
    {
      key: "source",
      header: "How they joined",
      sortable: true,
      value: (l) => l.source,
      render: (l) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip hue={l.source === "Self-enrolled" ? "slate" : "sky"}>{l.source}</Chip>
          {l.mandatory && <Chip hue="coral">Required</Chip>}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      value: (l) => l.percent,
      render: (l) => (
        <span className="flex min-w-[9rem] items-center gap-3">
          <span className="flex-1">
            <Progress value={l.percent} hue={stageOf(l) === "completed" ? "mint" : "blue"} size="sm" label={`${l.name ?? "Learner"} progress`} />
          </span>
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-neutral-900">{l.percent}%</span>
        </span>
      ),
    },
    {
      key: "lessons",
      header: "Lessons",
      sortable: true,
      align: "right",
      hideOnMobile: true,
      value: (l) => l.lessonsDone,
      render: (l) => (
        <span className="tabular-nums">
          {l.lessonsDone}
          <span className="text-neutral-400"> / {totalLectures}</span>
        </span>
      ),
    },
    {
      key: "enrolledAt",
      header: "Enrolled",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.enrolledAt ?? "",
      render: (l) => (l.enrolledAt ? formatDate(l.enrolledAt) : "-"),
    },
    {
      key: "completedAt",
      header: "Completed",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.completedAt ?? "",
      render: (l) => (l.completedAt ? formatDate(l.completedAt) : "-"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (l) =>
        l.source === "Assigned" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void revoke(l);
            }}
            disabled={revoking === l.id}
            aria-label={`Revoke ${l.name ?? "this learner"}'s assignment`}
            title="Revoke assignment"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-400 disabled:cursor-wait disabled:opacity-50"
          >
            <UserMinus size={16} aria-hidden />
          </button>
        ) : null,
    },
  ];

  if (loading && !data) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading learners">
        <Skeleton className="h-11 w-full max-w-md" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorNote className="flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <Button size="sm" icon={RefreshCw} onClick={() => void load()}>
          Try again
        </Button>
      </ErrorNote>
    );
  }

  if (learners.length === 0) {
    return (
      <Card>
        <Empty
          icon={Users}
          hue="grape"
          title="Nobody is on this course yet"
          hint="Assign it to learners, or wait for people to enrol from the catalogue themselves."
          action={
            <Button variant="primary" icon={UserPlus} onClick={onAssign}>
              Assign learners
            </Button>
          }
        />
      </Card>
    );
  }

  const stageOptions: { key: Stage; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "not_started", label: `Not started ${counts.not_started}` },
    { key: "in_progress", label: `In progress ${counts.in_progress}` },
    { key: "completed", label: `Completed ${counts.completed}` },
  ];

  return (
    <div className="space-y-3">
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented options={stageOptions} value={stage} onChange={setStage} label="Filter learners by status" />
      </div>
      <DataView
        rows={rows}
        columns={columns}
        rowKey={(l) => l.id}
        rowHref={(l) => `/suite/lms/courses/${encodeURIComponent(slug)}/learners/${encodeURIComponent(l.id)}`}
        storageKey="lms.course.learners"
        caption={`Learners on ${courseTitle}`}
        searchPlaceholder="Search by name or email"
        matches={(l, q) => {
          const needle = q.toLowerCase();
          return (l.name ?? "").toLowerCase().includes(needle) || (l.email ?? "").toLowerCase().includes(needle);
        }}
        renderCard={(l) => (
          <div className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <FaceAvatar name={l.name ?? l.email} size={42} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{l.name ?? "Unnamed learner"}</p>
                <p className="truncate text-xs text-neutral-500">{l.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusChip status={stageOf(l)} label={STAGE_LABEL[stageOf(l)]} />
              <Chip hue={l.source === "Self-enrolled" ? "slate" : "sky"}>{l.source}</Chip>
              {l.mandatory && <Chip hue="coral">Required</Chip>}
            </div>
            <div className="mt-auto">
              <Progress value={l.percent} hue={stageOf(l) === "completed" ? "mint" : "blue"} showValue label={`${l.lessonsDone} of ${totalLectures} lessons`} />
            </div>
          </div>
        )}
        empty={
          stage === "all" ? (
            <Empty icon={Users} hue="grape" title="Nobody matches that search" hint="Search by part of a name or an email address." />
          ) : (
            <Empty
              icon={Users}
              hue="grape"
              title={`No learners are ${STAGE_LABEL[stage].toLowerCase()}`}
              hint="Pick another status, or clear the search."
            />
          )
        }
      />
    </div>
  );
}
