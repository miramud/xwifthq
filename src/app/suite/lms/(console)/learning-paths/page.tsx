"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Route, Plus, UserPlus, Trash2, BookOpen, Users, Pencil, CheckCircle2 } from "lucide-react";
import {
  learningPaths as api,
  assignments as assignApi,
  ApiError,
  type LearningPath,
} from "@/lib/api/saas-client";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ErrorNote, Skeleton, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { CourseCover } from "@/components/shared/CourseCover";
import AssignDialog, { type AssignableStudent } from "@/suite/lms/components/console/AssignDialog";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { richExcerpt } from "@/lib/richText";

/**
 * The institution's learning paths.
 *
 * A path is a track, not a course, so the two figures that define it are how
 * many courses it contains and how many learners are on it — those lead each
 * row. Assigning is the primary action here rather than editing, because a
 * path is authored once and assigned many times.
 */
export default function LearningPathsPage() {
  const confirm = useConfirm();
  const [paths, setPaths] = useState<LearningPath[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<LearningPath | null>(null);
  const [students, setStudents] = useState<AssignableStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  // Who is on the path already, so the picker can lock them in place.
  const [held, setHeld] = useState<Map<string, string>>(new Map());

  const load = useCallback(() => {
    api
      .list()
      .then((data) => {
        setPaths(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Couldn't load learning paths."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only fetched when a picker actually opens — the roster is irrelevant until
  // then, and on a large institution it is not a cheap request.
  const openAssign = async (path: LearningPath) => {
    setAssigning(path);
    setLoadingStudents(true);
    setHeld(new Map());

    try {
      const [res, roster] = await Promise.all([
        fetch("/api/admin/students?perPage=100", { cache: "no-store" }),
        // A roster that fails to load only costs the badges, not the picker.
        assignApi.pathRoster(path.slug).catch(() => []),
      ]);
      setHeld(new Map(roster.map((a) => [a.userId, a.isComplete ? "Completed" : "Assigned"])));
      const body = await res.json();

      setStudents(
        (body.data ?? []).map((s: { id: string; name: string; email: string; initials?: string }) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          initials: s.initials,
        })),
      );
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  async function remove(path: LearningPath) {
    const ok = await confirm({
      title: `Delete the “${path.title}” learning path?`,
      body: "Learners keep the courses it already granted; it just can't be assigned again. It moves to the organisation's recycle bin, where an admin can restore it.",
      confirmLabel: "Delete path",
      recoverable: true,
    });
    if (!ok) return;

    try {
      await api.remove(path.slug);
      setPaths((prev) => (prev ?? []).filter((p) => p.slug !== path.slug));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't retire that path.");
    }
  }

  const stats = useMemo(() => {
    const list = paths ?? [];
    return {
      total: list.length,
      published: list.filter((p) => p.status === "published").length,
      courses: list.reduce((s, p) => s + (p.courseCount ?? 0), 0),
      assigned: list.reduce((s, p) => s + (p.assignedCount ?? 0), 0),
    };
  }, [paths]);

  const actions = (path: LearningPath) => {
    const empty = (path.courseCount ?? 0) === 0;
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          icon={UserPlus}
          onClick={() => void openAssign(path)}
          disabled={empty}
          title={empty ? "Add at least one course before assigning" : undefined}
        >
          Assign
        </Button>
        <ButtonLink href={`/suite/lms/learning-paths/${path.slug}`} size="sm" icon={Pencil}>
          Edit
        </ButtonLink>
        <button
          type="button"
          onClick={() => void remove(path)}
          aria-label={`Retire ${path.title}`}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-error-500/10 hover:text-error-700 focus-visible:ring-2 focus-visible:ring-error-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  };

  const counts = (path: LearningPath) => (
    <>
      <Chip hue="grape" icon={BookOpen}>
        {path.courseCount ?? 0} course{(path.courseCount ?? 0) === 1 ? "" : "s"}
      </Chip>
      <Chip hue="blue" icon={Users}>
        {path.assignedCount ?? 0} assigned
      </Chip>
    </>
  );

  const columns: Column<LearningPath>[] = [
    {
      key: "title",
      header: "Path",
      primary: true,
      sortable: true,
      value: (p) => p.title,
      render: (p) => (
        <span className="flex items-center gap-3">
          <CourseCover title={p.title} gradient={p.gradient} className="h-10 w-10 shrink-0 rounded-xl">
            <span className="flex h-full items-center justify-center text-white">
              <Route size={18} aria-hidden />
            </span>
          </CourseCover>
          <span className="min-w-0">
            <Link
              href={`/suite/lms/learning-paths/${p.slug}`}
              className="block max-w-[280px] truncate font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
            >
              {p.title}
            </Link>
            {p.description && (
              <span className="block max-w-[280px] truncate text-xs text-neutral-500">{richExcerpt(p.description, 160)}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "courses",
      header: "Courses",
      align: "right",
      sortable: true,
      value: (p) => p.courseCount ?? 0,
    },
    {
      key: "assigned",
      header: "Assigned",
      align: "right",
      sortable: true,
      value: (p) => p.assignedCount ?? 0,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (p) => p.status,
      render: (p) => <StatusChip status={p.status} />,
    },
    { key: "actions", header: "", align: "right", tableOnly: true, render: (p) => actions(p) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning paths"
        subtitle="Ordered sets of courses you assign as one unit — onboarding, compliance, a term's syllabus."
        actions={
          <ButtonLink href="/suite/lms/learning-paths/new" variant="primary" icon={Plus}>
            New path
          </ButtonLink>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {paths === null ? (
        <div className="space-y-4" role="status" aria-busy="true">
          <span className="sr-only">Loading learning paths</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : paths.length === 0 ? (
        <Card>
          <Empty
            icon={Route}
            hue="grape"
            title="No learning paths yet"
            hint="Bundle a few courses into a track, then assign the whole thing to a cohort in one go."
            action={
              <ButtonLink href="/suite/lms/learning-paths/new" variant="primary" icon={Plus}>
                Build your first path
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <StatGrid>
            <StatCard featured featuredHue="grape" label="Learning paths" value={stats.total} icon={Route} />
            <StatCard label="Published" value={stats.published} icon={CheckCircle2} hue="mint" hint={`${stats.total - stats.published} drafts`} />
            <StatCard label="Courses in paths" value={stats.courses} icon={BookOpen} hue="blue" />
            <StatCard label="Assignments" value={stats.assigned} icon={Users} hue="sun" />
          </StatGrid>

          <DataView
            rows={paths}
            columns={columns}
            rowKey={(p) => p.slug}
            /*
              No rowHref: every view carries Assign / Edit / Retire, and a card
              that is itself a link cannot contain buttons. The title is the
              link instead, stretched over the card so the whole card opens it.
            */
            storageKey="lms.learning-paths"
            defaultView="grid"
            caption="Learning paths"
            searchPlaceholder="Search paths…"
            matches={(p, q) => p.title.toLowerCase().includes(q)}
            renderCard={(p) => (
              <div className="relative flex h-full flex-col">
                <div className="p-2 pb-0">
                  <CourseCover title={p.title} gradient={p.gradient} className="h-28 rounded-[0.8rem]">
                    <div className="flex h-full items-start justify-between p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur">
                        <Route size={20} aria-hidden />
                      </span>
                      <span className="rounded-full bg-white/95 shadow-sm">
                        <StatusChip status={p.status} />
                      </span>
                    </div>
                  </CourseCover>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/suite/lms/learning-paths/${p.slug}`}
                      className="line-clamp-1 text-[15px] font-semibold text-neutral-900 outline-none after:absolute after:inset-0 after:rounded-[1.125rem] after:content-[''] hover:text-primary-700 focus-visible:after:ring-2 focus-visible:after:ring-primary-300"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-neutral-500">
                      {p.description ? richExcerpt(p.description, 220) : "No description yet."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">{counts(p)}</div>
                  <div className="relative z-[1] mt-auto border-t border-neutral-100 pt-3">{actions(p)}</div>
                </div>
              </div>
            )}
            renderListItem={(p) => (
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CourseCover title={p.title} gradient={p.gradient} className="h-11 w-11 shrink-0 rounded-xl">
                    <span className="flex h-full items-center justify-center text-white">
                      <Route size={18} aria-hidden />
                    </span>
                  </CourseCover>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/suite/lms/learning-paths/${p.slug}`}
                        className="truncate text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
                      >
                        {p.title}
                      </Link>
                      <StatusChip status={p.status} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{counts(p)}</div>
                  </div>
                </div>
                {actions(p)}
              </div>
            )}
          />
        </>
      )}

      {assigning && (
        <AssignDialog
          title="Assign learning path"
          subtitle={assigning.title}
          students={students}
          loading={loadingStudents}
          held={held}
          onAssign={async (recipients) => {
            const result = await assignApi.assignPath(assigning.slug, recipients);
            load();
            return result;
          }}
          subject="learning path"
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}
