"use client";

import { useState, useEffect, useCallback, use } from "react";
import {
  Users,
  Award,
  ChartLine,
  Percent,
  BookOpen,
  Mail,
  Calendar,
  CheckCircle2,
  Ban,
  RotateCcw,
  Star as StarIcon,
  Pencil,
  Loader2,
  Phone,
  MapPin,
  Tag,
  UserRound,
} from "lucide-react";
import { CourseThumb } from "@/components/shared/CourseCover";
import { Button, ButtonLink, Card, Chip, Empty, Panel, StatGrid, UnderlineTabs } from "@/components/workspace/kit";
import { AreaLine, Legend, SegmentedGauge } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import {
  BackLink,
  CoverCard,
  FaceAvatar,
  InfoList,
  InfoRow,
  Rating,
  StatCard,
  StatusChip,
} from "@/suite/lms/components/ui/ws";
import { formatCompact, formatDate } from "@/lib/console-data";
import {
  analytics,
  instructors as instructorsApi,
  ApiError,
  type AdminInstructorDetail,
} from "@/lib/api/admin-client";
import { RichTextView } from "@/components/workspace/RichTextView";

type TabKey = "courses" | "performance" | "about";

/* ------------------------------------------------------------------ */

export default function AdminInstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>("courses");

  const [data, setData] = useState<AdminInstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await analytics.instructor(id));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(
    async (next: "active" | "suspended") => {
      setBusy(true);
      try {
        await instructorsApi.update(id, { status: next });
        await load();
      } catch (e: unknown) {
        setError(
          e instanceof ApiError ? e.message : "Could not update the instructor.",
        );
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );

  /* ---------- loading ------------------------------------------- */
  if (loading) {
    return (
      <div>
        <BackLink href="/suite/lms/instructors" label="Back to instructors" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-neutral-500">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Loading instructor…
        </div>
      </div>
    );
  }

  /* ---------- error / not found --------------------------------- */
  if (error || !data) {
    return (
      <div>
        <BackLink href="/suite/lms/instructors" label="Back to instructors" />
        <Card>
          <Empty
            icon={Users}
            hue="grape"
            title={error ?? "Instructor not found"}
            hint="This instructor account does not exist or may have been removed."
            action={<ButtonLink href="/suite/lms/instructors">Browse all instructors</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  /* ---------- derived data -------------------------------------- */
  const t = data.totals;

  const enrollmentChart = data.monthly.map((m) => ({ label: m.month, value: m.enrollments }));
  const completionChart = data.monthly.map((m) => ({ label: m.month, value: m.completions }));

  type InstructorCourse = AdminInstructorDetail["courses"][number];

  const courseColumns: Column<InstructorCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={40} rounded="rounded-xl" />
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate font-semibold text-neutral-900">{c.title}</span>
            <span className="block truncate text-xs text-neutral-500">{c.category ?? "—"}</span>
          </span>
        </span>
      ),
    },
    { key: "level", header: "Level", sortable: true, hideOnMobile: true, value: (c) => c.level },
    {
      key: "students",
      header: "Students",
      align: "right",
      sortable: true,
      value: (c) => c.students,
      render: (c) => formatCompact(c.students),
    },
    {
      key: "completions",
      header: "Completed",
      align: "right",
      sortable: true,
      value: (c) => c.completions,
      render: (c) => <span className="font-semibold text-neutral-900">{formatCompact(c.completions)}</span>,
    },
    { key: "rating", header: "Rating", sortable: true, value: (c) => c.rating, render: (c) => <Rating value={c.rating} /> },
    { key: "lectures", header: "Lectures", align: "right", sortable: true, hideOnMobile: true, value: (c) => c.lectures },
    { key: "status", header: "Status", sortable: true, value: (c) => c.status, render: (c) => <StatusChip status={c.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/instructors" label="Back to instructors" />

        {/* ---------- profile header ---------- */}
        <Card className="mb-6 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-grape-500 via-primary-500 to-sky-500" aria-hidden />
          <div className="flex flex-col gap-5 px-5 pb-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <span className="-mt-10 rounded-full ring-4 ring-white">
                <FaceAvatar name={data.name} size={84} />
              </span>
              <div className="min-w-0 sm:pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{data.name}</h1>
                  <StatusChip status={data.status} />
                </div>
                <p className="mt-0.5 text-sm text-neutral-500">{data.title ?? "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-500">
                  {data.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={14} className="text-neutral-400" aria-hidden />
                      {data.email}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} className="text-neutral-400" aria-hidden />
                    Joined {formatDate(data.joined)}
                    {data.category ? ` · ${data.category}` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* admin actions */}
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href={`/suite/lms/instructors/${id}/edit`} icon={Pencil}>
                Edit
              </ButtonLink>
              {data.status === "Pending" && (
                <Button variant="primary" icon={CheckCircle2} disabled={busy} onClick={() => changeStatus("active")}>
                  Approve
                </Button>
              )}
              {data.status === "Active" && (
                <Button
                  icon={Ban}
                  disabled={busy}
                  onClick={() => changeStatus("suspended")}
                  className="!border-error-500/30 !text-error-700 hover:!bg-error-500/5"
                >
                  Suspend
                </Button>
              )}
              {data.status === "Suspended" && (
                <Button variant="primary" icon={RotateCcw} disabled={busy} onClick={() => changeStatus("active")}>
                  Reinstate
                </Button>
              )}
              <Button variant="ghost" icon={ChartLine} onClick={() => setTab("performance")}>
                View performance
              </Button>
            </div>
          </div>
        </Card>

        <UnderlineTabs
          tabs={[
            { key: "courses", label: "Courses", count: data.courses.length },
            { key: "performance", label: "Performance" },
            { key: "about", label: "About" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as TabKey)}
        />
      </div>

      {/* ---------- KPI cards ---------- */}
      <StatGrid>
        <StatCard featured featuredHue="grape" label="Courses" value={`${t.courses}`} icon={BookOpen} hint={`${t.publishedCourses} published`} />
        <StatCard label="Students taught" value={formatCompact(t.students)} icon={Users} hue="sky" />
        <StatCard label="Courses completed" value={formatCompact(t.completions)} icon={Award} hue="mint" />
        <StatCard label="Completion rate" value={t.completionRate.toFixed(1)} unit="%" icon={Percent} hue="blue" />
      </StatGrid>

      {/* ============ COURSES ============ */}
      {tab === "courses" &&
        (data.courses.length === 0 ? (
          <Card>
            <Empty icon={BookOpen} hue="grape" title="No courses yet" hint="This instructor has not published any courses." />
          </Card>
        ) : (
          <DataView
            rows={data.courses}
            columns={courseColumns}
            rowKey={(c) => c.slug}
            rowHref={(c) => `/suite/lms/courses/${c.slug}`}
            storageKey="lms.instructor.courses"
            defaultView="grid"
            caption={`Courses by ${data.name}`}
            searchPlaceholder="Search courses"
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
                    <Chip hue="slate">{c.level}</Chip>
                    <Chip hue="slate">{c.lectures} lectures</Chip>
                  </>
                }
                footer={
                  <>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users size={13} aria-hidden />
                      {formatCompact(c.students)} students
                    </span>
                    <Rating value={c.rating} />
                  </>
                }
              />
            )}
            renderListItem={(c) => (
              <div className="flex items-center gap-4 px-5 py-3.5">
                <CourseThumb title={c.title} gradient={c.gradient} thumbnailUrl={c.thumbnailUrl} size={44} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{c.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {c.level} · {formatCompact(c.students)} students · {c.lectures} lectures
                  </p>
                </div>
                <Rating value={c.rating} />
                <StatusChip status={c.status} />
              </div>
            )}
          />
        ))}

      {/* ============ PERFORMANCE ============ */}
      {tab === "performance" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title="Enrollments"
            subtitle="New enrollments against completions · last 12 months"
            icon={ChartLine}
            hue="grape"
            className="lg:col-span-2"
            actions={
              <Legend
                items={[
                  { label: "Enrolments", hue: "grape" },
                  { label: "Completions", hue: "slate", dashed: true },
                ]}
              />
            }
          >
            <AreaLine
              data={enrollmentChart}
              compare={completionChart}
              hue="grape"
              height={240}
              caption="Enrollments over the last 12 months"
              format={(v: number) => `${v.toLocaleString()} students`}
            />
          </Panel>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard icon={StarIcon} label="Average rating" value={t.avgRating.toFixed(2)} unit="/ 5" hue="sun" />
            <StatCard icon={Users} label="Total reviews" value={formatCompact(t.reviews)} hue="sky" />
            <Panel title="Completion" icon={Percent} hue="mint">
              <div className="flex justify-center">
                <SegmentedGauge value={t.completionRate} hue="mint" label="Completion rate" size={200} />
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* ============ ABOUT ============ */}
      {tab === "about" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Profile" icon={UserRound} hue="grape" className="lg:col-span-2">
            {data.headline && <p className="text-sm font-semibold text-neutral-900">{data.headline}</p>}
            {data.bio ? <RichTextView value={data.bio} size="sm" className="mt-2 text-neutral-600" /> : <p className="mt-2 text-sm text-neutral-600">—</p>}
          </Panel>

          <Panel title="Details" icon={Tag} hue="sky">
            <InfoList>
              <InfoRow icon={Tag} label="Category" hue="grape">
                {data.category ?? "—"}
              </InfoRow>
              <InfoRow icon={Calendar} label="Joined" hue="mint">
                {formatDate(data.joined)}
              </InfoRow>
              <InfoRow icon={Mail} label="Contact email" hue="blue">
                {data.email ?? "—"}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone" hue="sky">
                {data.phone ?? "—"}
              </InfoRow>
              <InfoRow icon={MapPin} label="Location" hue="coral">
                {data.location ?? "—"}
              </InfoRow>
              <InfoRow icon={CheckCircle2} label="Account status" hue="mint">
                <StatusChip status={data.status} />
              </InfoRow>
            </InfoList>
          </Panel>
        </div>
      )}
    </div>
  );
}
