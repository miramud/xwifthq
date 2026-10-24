"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Award, BookOpen, Users, Star, PlayCircle, ArrowUpRight, Clock } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, PageHeader, Progress, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { CourseThumb } from "@/components/shared/CourseCover";
import { CoverCard, ErrorNote, Rating, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import {
  courses as coursesApi,
  ApiError,
  type InstructorCourse,
} from "@/lib/api/instructor-client";

type StateFilter = "All" | "Published" | "Review" | "Draft";

const href = (c: InstructorCourse) => `/suite/lms/teach/courses/${c.slug}`;
const completion = (c: InstructorCourse) => (c.students > 0 ? Math.round(((c.completions ?? 0) / c.students) * 100) : 0);

export default function InstructorCoursesPage() {
  const [items, setItems] = useState<InstructorCourse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [stateFilter, setStateFilter] = useState<StateFilter>("All");

  useEffect(() => {
    let active = true;
    coursesApi
      .list()
      .then((data) => active && setItems(data))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : "Your courses didn't load. Try again."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      totalCourses: items.length,
      students: items.reduce((s, c) => s + c.students, 0),
      completions: items.reduce((s, c) => s + (c.completions ?? 0), 0),
      avgRating: items.length ? items.reduce((s, c) => s + c.rating, 0) / items.length : 0,
    }),
    [items],
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((c) => c.status === "Published").length,
      review: items.filter((c) => c.status === "Review").length,
      draft: items.filter((c) => c.status === "Draft").length,
    }),
    [items],
  );

  const rows = useMemo(
    () => items.filter((c) => stateFilter === "All" || c.status === stateFilter),
    [items, stateFilter],
  );

  const columns: Column<InstructorCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb
            title={c.title}
            gradient={c.gradient ?? "from-primary-400 to-primary-600"}
            thumbnailUrl={c.thumbnailUrl}
            size={40}
            rounded="rounded-xl"
          />
          <span className="min-w-0">
            <span className="block max-w-[260px] truncate font-medium text-neutral-900">{c.title}</span>
            <span className="block truncate text-xs text-neutral-500">{c.category}</span>
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "State",
      sortable: true,
      value: (c) => c.status,
      render: (c) => <StatusChip status={c.status === "Review" ? "in_review" : c.status} label={c.status} />,
    },
    {
      key: "students",
      header: "Students",
      sortable: true,
      align: "right",
      value: (c) => c.students,
      render: (c) => formatCompact(c.students),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.rating,
      render: (c) => <Rating value={c.rating} count={c.reviews} />,
    },
    {
      key: "completions",
      header: "Completed",
      sortable: true,
      align: "right",
      value: (c) => c.completions ?? 0,
      render: (c) => <span className="font-semibold text-neutral-900">{formatCompact(c.completions ?? 0)}</span>,
    },
    {
      key: "lastUpdated",
      header: "Updated",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.lastUpdated,
      render: (c) => <span className="text-neutral-500">{c.lastUpdated ?? "-"}</span>,
    },
    {
      key: "manage",
      header: "",
      align: "right",
      tableOnly: true,
      render: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
          Manage
          <ArrowUpRight size={14} aria-hidden />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My courses"
        subtitle={`${counts.total} courses · ${counts.published} published · ${counts.review} in review · ${counts.draft} draft`}
        actions={
          <ButtonLink href="/suite/lms/teach/courses/new" variant="primary" icon={Plus}>
            Create course
          </ButtonLink>
        }
        tabs={[
          { key: "All", label: "All", count: counts.total },
          { key: "Published", label: "Published", count: counts.published },
          { key: "Review", label: "In review", count: counts.review },
          { key: "Draft", label: "Draft", count: counts.draft },
        ]}
        activeTab={stateFilter}
        onTab={(k) => setStateFilter(k as StateFilter)}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <StatGrid>
        <StatCard featured featuredHue="grape" icon={BookOpen} label="Courses" value={`${totals.totalCourses}`} hint={`${counts.published} published`} />
        <StatCard icon={Users} hue="sky" label="Students" value={formatCompact(totals.students)} />
        <StatCard icon={Award} hue="mint" label="Completions" value={formatCompact(totals.completions)} />
        <StatCard icon={Star} hue="sun" label="Average rating" value={totals.avgRating.toFixed(2)} unit="/ 5" />
      </StatGrid>

      <DataView
        rows={rows}
        columns={columns}
        rowKey={(c) => c.slug}
        storageKey="teach.courses"
        defaultView="grid"
        rowHref={href}
        caption="Your courses"
        searchPlaceholder="Search your courses…"
        matches={(c, q) => c.title.toLowerCase().includes(q)}
        empty={
          <Empty
            icon={BookOpen}
            title={loading ? "Loading your courses…" : "No courses match these filters"}
            hint={loading ? "This takes a moment." : "Try another search or clear the filters."}
            action={
              !loading && stateFilter !== "All" ? (
                <Button size="sm" onClick={() => setStateFilter("All")}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
        renderCard={(c) => (
          <CoverCard
            title={c.title}
            gradient={c.gradient ?? "from-primary-400 to-primary-600"}
            thumbnailUrl={c.thumbnailUrl}
            eyebrow={c.category}
            subtitle={c.level}
            badge={<StatusChip status={c.status === "Review" ? "in_review" : c.status} label={c.status} />}
            chips={
              <>
                <Chip hue="sky" icon={Users}>
                  {formatCompact(c.students)}
                </Chip>
                <Chip hue="sun" icon={Star}>
                  {c.rating.toFixed(1)}
                </Chip>
                <Chip hue="grape" icon={PlayCircle}>
                  {c.lectures} lectures
                </Chip>
              </>
            }
            footer={
              <>
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} aria-hidden />
                  {c.lastUpdated ?? "Not updated yet"}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary-700">
                  Manage
                  <ArrowUpRight size={14} aria-hidden />
                </span>
              </>
            }
          >
            <Progress value={completion(c)} hue="mint" label="Completion" showValue size="sm" />
          </CoverCard>
        )}
        renderListItem={(c) => (
          <div className="flex items-center gap-4 px-5 py-3.5">
            <CourseThumb
              title={c.title}
              gradient={c.gradient ?? "from-primary-400 to-primary-600"}
              thumbnailUrl={c.thumbnailUrl}
              size={44}
              rounded="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{c.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
                <span>{c.category}</span>
                <span>{formatCompact(c.students)} students</span>
                <Rating value={c.rating} />
              </p>
            </div>
            <div className="hidden w-32 sm:block">
              <Meter value={completion(c)} hue="mint" size="sm" label="Completion" />
            </div>
            <StatusChip status={c.status === "Review" ? "in_review" : c.status} label={c.status} />
          </div>
        )}
      />
    </div>
  );
}
