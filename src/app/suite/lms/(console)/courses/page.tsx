"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Star,
  BookOpen,
  Eye,
  Pencil,
  ExternalLink,
  Trash2,
  Users,
  Award,
  FileEdit,
  PlayCircle,
} from "lucide-react";
import { formatCompact } from "@/lib/console-data";
import { ActionMenu } from "@/components/dashboard/ui";
import { useCategoryNames } from "@/lib/api/categories-client";
import { courses as coursesApi, ApiError, type AdminCourse } from "@/lib/api/admin-client";
import { CourseThumb } from "@/components/shared/CourseCover";
import { Button, ButtonLink, Chip, Empty, PageHeader, PersonAvatar, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type { Hue } from "@/components/workspace/modules";
import { CoverCard, ErrorNote, Rating, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

const STATUS_FILTERS: string[] = ["All", "Published", "Review", "Draft"];

const LEVEL_HUE: Record<string, Hue> = {
  Beginner: "mint",
  Intermediate: "sky",
  Advanced: "grape",
};

export default function AdminCoursesPage() {
  const confirm = useConfirm();
  // Category taxonomy comes from the database, not a hardcoded list.
  const categoryNames = useCategoryNames();
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState<string>("All");

  const [items, setItems] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await coursesApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load courses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublish = useCallback(
    async (c: AdminCourse) => {
      const next = c.status === "Published" ? "draft" : "published";
      try {
        await coursesApi.setStatus(c.slug, next);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not update the course.");
      }
    },
    [load],
  );

  const remove = useCallback(
    async (slug: string) => {
      const course = items.find((c) => c.slug === slug);
      const ok = await confirm({
        title: course ? `Delete “${course.title}”?` : "Delete this course?",
        body: "",
        confirmLabel: "Delete course",
        recoverable: true,
      });
      if (!ok) return;
      try {
        await coursesApi.remove(slug);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not delete the course.");
      }
    },
    [load, confirm, items],
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter((c) => c.status === "Published").length,
      review: items.filter((c) => c.status === "Review").length,
      draft: items.filter((c) => c.status === "Draft").length,
      students: items.reduce((s, c) => s + (c.students ?? 0), 0),
      completions: items.reduce((s, c) => s + (c.completions ?? 0), 0),
    }),
    [items],
  );

  // Uptake first: the question an administrator opens this list with is which
  // courses people are actually on. Column headers re-sort from there.
  const rows = useMemo(
    () =>
      items
        .filter((c) => (category === "All" || c.category === category) && (status === "All" || c.status === status))
        .sort((a, b) => (b.students ?? 0) - (a.students ?? 0)),
    [items, category, status],
  );

  const actions = (c: AdminCourse) => (
    <ActionMenu
      label={`Actions for ${c.title}`}
      items={[
        { label: "View details", href: `/suite/lms/courses/${c.slug}`, icon: Eye },
        { label: "Edit course", href: `/suite/lms/courses/${c.slug}/edit`, icon: Pencil },
        { label: "View public page", href: `/courses/${c.slug}`, icon: ExternalLink },
        {
          label: c.status === "Published" ? "Unpublish" : "Publish",
          icon: c.status === "Published" ? Eye : Star,
          onClick: () => togglePublish(c),
        },
        { label: "Delete", icon: Trash2, danger: true, onClick: () => remove(c.slug) },
      ]}
    />
  );

  const columns: Column<AdminCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={42} rounded="rounded-xl" />
          <span className="min-w-0">
            <span className="block max-w-[260px] truncate font-semibold text-neutral-900">{c.title}</span>
            <span className="block max-w-[260px] truncate text-xs text-neutral-500">
              {[c.category, c.instructor].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "level",
      header: "Level",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.level,
      render: (c) => <Chip hue={LEVEL_HUE[c.level] ?? "slate"}>{c.level}</Chip>,
    },
    {
      key: "students",
      header: "Students",
      align: "right",
      sortable: true,
      value: (c) => c.students,
      render: (c) => <span className="tabular-nums">{formatCompact(c.students)}</span>,
    },
    {
      key: "completions",
      header: "Completed",
      align: "right",
      sortable: true,
      value: (c) => c.completions,
      render: (c) => <span className="font-semibold tabular-nums text-neutral-900">{formatCompact(c.completions)}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      value: (c) => c.rating,
      render: (c) => <Rating value={c.rating} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (c) => c.status,
      render: (c) => <StatusChip status={c.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: (c) => actions(c),
    },
  ];

  const clearFilters = () => {
    setCategory("All");
    setStatus("All");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle={`${counts.total} courses · ${counts.published} published · ${counts.review} in review · ${counts.draft} drafts`}
        actions={
          <ButtonLink href="/suite/lms/courses/new" variant="primary" icon={Plus}>
            New course
          </ButtonLink>
        }
        tabs={STATUS_FILTERS.map((s) => ({
          key: s,
          label: s === "Review" ? "In review" : s,
          count:
            s === "All" ? counts.total : s === "Published" ? counts.published : s === "Review" ? counts.review : counts.draft,
        }))}
        activeTab={status}
        onTab={setStatus}
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <StatGrid>
        <StatCard featured featuredHue="grape" label="Courses" value={counts.total} icon={BookOpen} hint={`${counts.published} live`} />
        <StatCard label="Enrolled students" value={formatCompact(counts.students)} icon={Users} hue="blue" />
        <StatCard label="Completions" value={formatCompact(counts.completions)} icon={Award} hue="mint" />
        <StatCard label="Awaiting review" value={counts.review} icon={FileEdit} hue="sun" hint={`${counts.draft} drafts`} />
      </StatGrid>

      <DataView
        rows={rows}
        columns={columns}
        rowKey={(c) => c.slug}
        rowHref={(c) => `/suite/lms/courses/${c.slug}`}
        storageKey="lms.courses"
        defaultView="grid"
        caption="Courses"
        searchPlaceholder="Search course or instructor…"
        matches={(c, q) => c.title.toLowerCase().includes(q) || (c.instructor ?? "").toLowerCase().includes(q)}
        toolbar={
          <SearchableSelect
            value={category}
            onChange={setCategory}
            size="sm"
            className="w-48"
            aria-label="Filter by category"
            options={[
              { value: "All", label: "All categories" },
              ...categoryNames.map((c) => ({ value: c, label: c })),
            ]}
          />
        }
        renderCard={(c) => (
          <CoverCard
            title={c.title}
            gradient={c.gradient}
            thumbnailUrl={c.thumbnailUrl}
            eyebrow={c.category}
            badge={
              <span className="rounded-full bg-white/95 shadow-sm">
                <StatusChip status={c.status} />
              </span>
            }
            chips={
              <>
                <Chip hue={LEVEL_HUE[c.level] ?? "slate"}>{c.level}</Chip>
                <Chip hue="slate" icon={PlayCircle}>
                  {c.lectures} lectures
                </Chip>
              </>
            }
            footer={
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <PersonAvatar name={c.instructor ?? "Unassigned"} src={c.instructorAvatar} size={24} />
                  <span className="truncate">{c.instructor ?? "No instructor"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users size={13} aria-hidden />
                    {formatCompact(c.students)}
                  </span>
                  <Rating value={c.rating} />
                </span>
              </>
            }
          />
        )}
        renderListItem={(c) => (
          <div className="flex items-center gap-4 px-5 py-3.5">
            <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={48} rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{c.title}</p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {[c.category, c.instructor, `${formatCompact(c.students)} students`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="hidden sm:block">
              <Rating value={c.rating} />
            </span>
            <StatusChip status={c.status} />
          </div>
        )}
        empty={
          <Empty
            icon={BookOpen}
            hue="grape"
            title={loading ? "Loading courses…" : "No courses match your filters"}
            hint={loading ? undefined : "Try another status or category, or clear the filters."}
            action={
              !loading && (
                <Button size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        }
      />
    </div>
  );
}
