"use client";

import { useCallback, useEffect, useState } from "react";
import { Route, UserPlus, BookOpen, Users } from "lucide-react";
import {
  learningPaths as api,
  assignments as assignApi,
  ApiError,
  type LearningPath,
} from "@/lib/api/saas-client";
import { Button, Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, hueFor } from "@/components/workspace/modules";
import { ErrorNote, IconTile, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import AssignDialog, { type AssignableStudent } from "@/suite/lms/components/console/AssignDialog";
import { richExcerpt } from "@/lib/richText";

/**
 * Learning paths, as an instructor sees them.
 *
 * Read-only: composing a path spans the institution's whole catalog, including
 * courses this instructor does not teach, so authoring is the admin's job. The
 * API only returns *published* paths to an instructor, so there is no draft
 * state to explain here — what is listed is what can be assigned.
 */
export default function InstructorLearningPathsPage() {
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
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load learning paths."),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = async (path: LearningPath) => {
    setAssigning(path);
    setLoadingStudents(true);
    setHeld(new Map());

    try {
      const [res, roster] = await Promise.all([
        fetch("/api/instructor/students", { cache: "no-store" }),
        // A roster that fails to load only costs the badges, not the picker.
        assignApi.pathRoster(path.slug).catch(() => []),
      ]);
      setHeld(new Map(roster.map((a) => [a.userId, a.isComplete ? "Completed" : "Assigned"])));
      const body = await res.json();

      setStudents(
        (body.data ?? []).map(
          (s: { id?: string; studentId?: string; name: string; email: string }) => ({
            id: s.studentId ?? s.id ?? "",
            name: s.name,
            email: s.email,
          }),
        ).filter((s: AssignableStudent) => s.id !== ""),
      );
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const pathCount = paths?.length ?? 0;
  const totalAssigned = (paths ?? []).reduce((n, p) => n + (p.assignedCount ?? 0), 0);
  const totalCourses = (paths ?? []).reduce((n, p) => n + (p.courseCount ?? 0), 0);

  const assignButton = (path: LearningPath) => (
    <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => openAssign(path)}>
      Assign to learners
    </Button>
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
          <IconTile icon={Route} hue={hueFor(p.title)} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">{p.title}</span>
            {p.description && (
              <span className="block max-w-md truncate text-xs text-neutral-500">{richExcerpt(p.description, 160)}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "courses",
      header: "Courses",
      sortable: true,
      align: "right",
      value: (p) => p.courseCount ?? 0,
    },
    {
      key: "assigned",
      header: "Assigned",
      sortable: true,
      align: "right",
      value: (p) => p.assignedCount ?? 0,
    },
    { key: "assign", header: "", align: "right", tableOnly: true, render: assignButton },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning paths"
        subtitle="Tracks your organisation has published. Assign one to put learners on all of its courses at once."
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <StatGrid cols={3}>
        <StatCard featured featuredHue="sky" icon={Route} label="Published paths" value={paths === null ? "-" : pathCount} />
        <StatCard icon={BookOpen} hue="grape" label="Courses across paths" value={paths === null ? "-" : totalCourses} />
        <StatCard icon={Users} hue="sky" label="Learners assigned" value={paths === null ? "-" : totalAssigned} />
      </StatGrid>

      {paths === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true">
          <span className="sr-only">Loading learning paths</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <DataView
          rows={paths}
          columns={columns}
          rowKey={(p) => p.slug}
          storageKey="teach.learning-paths"
          defaultView="grid"
          caption="Published learning paths"
          searchPlaceholder="Search paths"
          empty={
            <Empty
              icon={Route}
              hue="grape"
              title="No published paths yet"
              hint="Your organisation's admin builds these. Once one is published it will show up here for you to assign."
            />
          }
          renderCard={(path) => (
            <div className="flex h-full flex-col">
              <div className={`h-2 rounded-t-[1.125rem] ${HUE[hueFor(path.title)].bar}`} aria-hidden />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <IconTile icon={Route} hue={hueFor(path.title)} size={44} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-neutral-900">{path.title}</h3>
                    {path.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{richExcerpt(path.description, 220)}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip hue="grape" icon={BookOpen}>
                    {path.courseCount ?? 0} course{(path.courseCount ?? 0) === 1 ? "" : "s"}
                  </Chip>
                  <Chip hue="sky" icon={Users}>
                    {path.assignedCount ?? 0} assigned
                  </Chip>
                </div>
                <div className="mt-auto border-t border-neutral-100 pt-3">{assignButton(path)}</div>
              </div>
            </div>
          )}
          renderListItem={(path) => (
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <IconTile icon={Route} hue={hueFor(path.title)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{path.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {path.courseCount ?? 0} course{(path.courseCount ?? 0) === 1 ? "" : "s"} · {path.assignedCount ?? 0} assigned
                </p>
              </div>
              {assignButton(path)}
            </div>
          )}
        />
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
