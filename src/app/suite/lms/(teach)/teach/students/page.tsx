"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  PieChart,
  BookOpen,
  ListChecks,
  CalendarDays,
} from "lucide-react";
import { Card, Chip, Empty, PageHeader, Panel, Progress, StatGrid } from "@/components/workspace/kit";
import { ColumnChart, Donut } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { FaceAvatar, PersonCard, Skeleton, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import { formatDate, timeAgo } from "@/lib/console-data";
import {
  students as studentsApi,
  courses as coursesApi,
  analytics,
  ApiError,
  type Learner,
  type LearnerStatus,
  type InstructorCourse,
  type InstructorOverview,
} from "@/lib/api/instructor-client";

const STATUS_FILTERS = [
  "All",
  "Active",
  "Completed",
  "At risk",
  "Refunded",
  "Cancelled",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_HUE: Record<LearnerStatus, Hue> = {
  Active: "sky",
  Completed: "mint",
  "At risk": "sun",
  Refunded: "rose",
  Cancelled: "slate",
};

const progressHue = (v: number): Hue => (v >= 75 ? "mint" : v >= 40 ? "blue" : "sun");

export default function InstructorStudentsPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [courseList, setCourseList] = useState<InstructorCourse[]>([]);
  const [ov, setOv] = useState<InstructorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>("All");
  const [courseFilter, setCourseFilter] = useState("All");

  useEffect(() => {
    let alive = true;
    Promise.all([studentsApi.list(), coursesApi.list(), analytics.overview()])
      .then(
        ([l, c, o]: [Learner[], InstructorCourse[], InstructorOverview]) => {
          if (alive) {
            setLearners(l);
            setCourseList(c);
            setOv(o);
          }
        },
      )
      .catch((e: unknown) => {
        if (alive) setErr(e instanceof ApiError ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeCount = learners.filter((l) => l.status === "Active").length;
  const completedCount = learners.filter((l) => l.status === "Completed").length;
  const atRiskCount = learners.filter((l) => l.status === "At risk").length;

  const byCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of learners) {
      const key = l.courseTitle ?? "Unknown course";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, value]) => ({
      label: label.split(" ").slice(0, 3).join(" "),
      value,
      hue: hueFor(label),
    }));
  }, [learners]);

  const rows = learners.filter((l) => {
    const matchesStatus = status === "All" || l.status === status;
    const matchesCourse =
      courseFilter === "All" || l.courseSlug === courseFilter;
    return matchesStatus && matchesCourse;
  });

  const monthly = ov?.monthly ?? [];

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading students…</span>
        <Skeleton className="h-16 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (err) {
    return (
      <Card>
        <Empty icon={Users} hue="rose" title="Couldn't load students" hint={err} />
      </Card>
    );
  }

  const studentHref = (l: Learner) => `/suite/lms/teach/students/${l.id}`;
  const statusCount = (s: StatusFilter) =>
    s === "All" ? learners.length : learners.filter((l) => l.status === s).length;

  const columns: Column<Learner>[] = [
    {
      key: "name",
      header: "Student",
      primary: true,
      sortable: true,
      value: (l) => l.name ?? "Unnamed learner",
      render: (l) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={l.name ?? l.initials} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">{l.name ?? "Unnamed learner"}</span>
            <span className="block truncate text-xs text-neutral-500">{l.email ?? "—"}</span>
          </span>
        </span>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      value: (l) => l.courseTitle ?? l.courseSlug,
      render: (l) =>
        l.courseSlug ? (
          <Link
            href={`/suite/lms/teach/courses/${l.courseSlug}`}
            onClick={(e) => e.stopPropagation()}
            className="block max-w-[200px] truncate text-neutral-700 transition-colors hover:text-primary-700"
          >
            {l.courseTitle ?? l.courseSlug}
          </Link>
        ) : (
          <span className="block max-w-[200px] truncate text-neutral-500">{l.courseTitle ?? "—"}</span>
        ),
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      value: (l) => l.progress,
      render: (l) => (
        <span className="flex min-w-[7rem] items-center gap-2">
          <span className="w-20">
            <Meter value={l.progress} size="sm" hue={progressHue(l.progress)} label={`${l.name ?? "Learner"} progress`} />
          </span>
          <span className="text-xs tabular-nums text-neutral-600">{l.progress}%</span>
        </span>
      ),
    },
    {
      key: "lessons",
      header: "Lessons",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.lessonsDone,
      render: (l) => (
        <span className="tabular-nums">
          {l.lessonsDone}/{l.totalLessons}
        </span>
      ),
    },
    {
      key: "quizAvg",
      header: "Quiz avg",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.quizAvg,
      render: (l) => <span className="tabular-nums">{l.quizAvg == null ? "—" : `${l.quizAvg}%`}</span>,
    },
    {
      key: "enrolledOn",
      header: "Enrolled",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.enrolledOn,
      render: (l) => <span className="whitespace-nowrap tabular-nums text-neutral-500">{formatDate(l.enrolledOn)}</span>,
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.lastActive,
      render: (l) => <span className="whitespace-nowrap text-neutral-500">{timeAgo(l.lastActive)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (l) => l.status,
      render: (l) => <StatusChip status={l.status} label={l.status} hue={STATUS_HUE[l.status]} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle="Everyone learning across your courses."
        tabs={STATUS_FILTERS.map((s) => ({ key: s, label: s, count: statusCount(s) }))}
        activeTab={status}
        onTab={(k) => setStatus(k as StatusFilter)}
      />

      <StatGrid>
        <StatCard featured featuredHue="sky" icon={Users} label="Total students" value={formatCompact(learners.length)} />
        <StatCard icon={UserCheck} hue="sky" label="Active learners" value={activeCount.toLocaleString()} />
        <StatCard icon={GraduationCap} hue="mint" label="Completed" value={completedCount.toLocaleString()} />
        <StatCard icon={AlertTriangle} hue="sun" label="At risk" value={atRiskCount.toLocaleString()} hint="need a nudge" />
      </StatGrid>

      {/* charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="New enrollments"
          subtitle="Monthly · last 12 months"
          icon={BarChart3}
          className="lg:col-span-2"
        >
          <ColumnChart
            data={monthly.map((m) => ({ label: m.month, value: m.enrollments }))}
            height={230}
            highlight="last"
            caption="New enrollments per month"
            format={(v: number) => `${v.toLocaleString()} students`}
          />
        </Panel>

        <Panel title="Students by course" subtitle="Share of enrollments" icon={PieChart} hue="grape">
          {byCourse.length === 0 ? (
            <Empty icon={Users} hue="grape" title="No enrollments yet" />
          ) : (
            <Donut
              data={byCourse}
              legend="below"
              size={170}
              total={formatCompact(learners.length)}
              centerLabel="Total students"
              caption="Students by course"
            />
          )}
        </Panel>
      </div>

      <DataView
        rows={rows}
        columns={columns}
        rowKey={(l) => l.id}
        storageKey="teach.students"
        rowHref={studentHref}
        caption="All students across your courses"
        searchPlaceholder="Search name or email…"
        matches={(l, q) =>
          (l.name?.toLowerCase().includes(q) ?? false) || (l.email?.toLowerCase().includes(q) ?? false)
        }
        toolbar={
          <SearchableSelect
            size="sm"
            className="w-56"
            aria-label="Filter by course"
            value={courseFilter}
            onChange={setCourseFilter}
            searchPlaceholder="Search courses"
            options={[
              { value: "All", label: "All courses" },
              ...courseList.map((c) => ({ value: c.slug, label: c.title })),
            ]}
          />
        }
        empty={
          learners.length === 0 ? (
            <Empty
              icon={Users}
              title="No students yet."
              hint="Learners will appear here as they enroll in your courses."
            />
          ) : (
            <Empty
              icon={Users}
              title="No students found"
              hint="Try adjusting your search, status or course filter."
            />
          )
        }
        renderCard={(l) => (
          <PersonCard
            name={l.name ?? "Unnamed learner"}
            subtitle={l.email ?? "—"}
            trailing={<StatusChip status={l.status} label={l.status} hue={STATUS_HUE[l.status]} />}
            chips={
              <>
                {l.courseTitle && (
                  <Chip hue={hueFor(l.courseTitle)} icon={BookOpen} className="max-w-full truncate">
                    {l.courseTitle}
                  </Chip>
                )}
                <Chip hue="grape" icon={ListChecks}>
                  {l.lessonsDone}/{l.totalLessons}
                </Chip>
              </>
            }
            footer={
              <>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} aria-hidden />
                  Enrolled {formatDate(l.enrolledOn)}
                </span>
                <span>Active {timeAgo(l.lastActive)}</span>
              </>
            }
          >
            <Progress value={l.progress} hue={progressHue(l.progress)} label="Progress" showValue />
          </PersonCard>
        )}
        renderListItem={(l) => (
          <div className="flex items-center gap-4 px-5 py-3.5">
            <FaceAvatar name={l.name ?? l.initials} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{l.name ?? "Unnamed learner"}</p>
              <p className="truncate text-xs text-neutral-500">
                {l.courseTitle ?? "—"} · active {timeAgo(l.lastActive)}
              </p>
            </div>
            <div className="hidden w-36 sm:block">
              <Meter value={l.progress} size="sm" hue={progressHue(l.progress)} label={`${l.name ?? "Learner"} progress`} />
            </div>
            <StatusChip status={l.status} label={l.status} hue={STATUS_HUE[l.status]} />
          </div>
        )}
      />
    </div>
  );
}
