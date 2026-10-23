"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Play,
  FileText,
  HelpCircle,
  Users,
  Star,
  ExternalLink,
  CheckCircle2,
  GraduationCap,
  Eye,
  MousePointerClick,
  TrendingUp,
  RotateCcw,
  Percent,
  Award,
  Trash2,
  Pencil,
  Loader2,
  UserPlus,
  ChartLine,
  Tag,
  Signal,
  Languages,
  CalendarClock,
  Wallet,
  ListChecks,
  ClipboardList,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import AssignDialog, { type AssignableStudent } from "@/suite/lms/components/console/AssignDialog";
import CourseLearners from "@/suite/lms/components/console/CourseLearners";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { assignments as assignApi } from "@/lib/api/saas-client";
import { adminProgress } from "@/lib/api/progress-client";
import { Stars } from "@/components/dashboard/ui";
import { CourseCover } from "@/components/shared/CourseCover";
import { formatCompact, formatDate } from "@/lib/console-data";
import {
  courses as coursesApi,
  analytics,
  ApiError,
  type CourseDetail,
  type CourseAnalytics,
} from "@/lib/api/admin-client";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  Empty,
  PageHeader,
  Panel,
  PersonAvatar,
  StatGrid,
  cx,
} from "@/components/workspace/kit";
import { AreaLine } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { HUE, type Hue } from "@/components/workspace/modules";
import { BackLink, InfoList, InfoRow, StatCard, StatusChip } from "@/suite/lms/components/ui/ws";
import { RichTextView } from "@/components/workspace/RichTextView";

/* ------------------------------------------------------------------ */
/*  Static maps + helpers                                              */
/* ------------------------------------------------------------------ */

type TabKey = "overview" | "learners" | "curriculum" | "reviews" | "instructor";

const TAB_KEYS: TabKey[] = ["overview", "learners", "curriculum", "reviews", "instructor"];

function isTab(value: unknown): value is TabKey {
  return typeof value === "string" && (TAB_KEYS as string[]).includes(value);
}

const LECTURE_ICON: Record<string, { icon: LucideIcon; hue: Hue }> = {
  video: { icon: Play, hue: "sky" },
  article: { icon: FileText, hue: "grape" },
  quiz: { icon: HelpCircle, hue: "sun" },
};

type Review = NonNullable<CourseDetail["reviews"]>[number];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminCourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { slug } = use(params);
  const { tab: tabParam } = use(searchParams);
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  // The tab lives in the URL (?tab=learners), so a learner's page can link
  // straight back to the roster it was opened from.
  const [tab, setTabState] = useState<TabKey>(isTab(tabParam) ? tabParam : "overview");
  const setTab = useCallback(
    (next: TabKey) => {
      setTabState(next);
      router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
    },
    [router, pathname],
  );
  const [rosterVersion, setRosterVersion] = useState(0);

  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [stats, setStats] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Assignment. The roster is only fetched when the picker opens — on a large
  // institution it is not a cheap request, and it is irrelevant until then.
  const [assignOpen, setAssignOpen] = useState(false);
  const [students, setStudents] = useState<AssignableStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  // Who is on the course already, so the picker can lock them in place.
  const [held, setHeld] = useState<Map<string, string>>(new Map());

  const openAssign = useCallback(async () => {
    setAssignOpen(true);
    setLoadingStudents(true);

    try {
      const [res, roster] = await Promise.all([
        fetch("/api/admin/students?perPage=100", { cache: "no-store" }),
        // A roster that fails to load only costs the badges, not the picker.
        adminProgress.course(slug).catch(() => null),
      ]);
      const body = await res.json();

      setHeld(
        new Map(
          (roster?.learners ?? [])
            .filter((l) => l.status === "active" || l.status === "completed")
            .map((l) => [l.id, l.status === "completed" ? "Completed" : l.source]),
        ),
      );

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
  }, [slug]);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([coursesApi.get(slug), analytics.course(slug)]);
      setDetail(d);
      setStats(a);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublish = useCallback(
    async (current: string) => {
      setBusy(true);
      try {
        await coursesApi.setStatus(slug, current === "Published" ? "draft" : "published");
        await load();
      } catch (e: unknown) {
        setError(e instanceof ApiError ? e.message : "Could not update the course.");
      } finally {
        setBusy(false);
      }
    },
    [slug, load],
  );

  const remove = useCallback(async () => {
    const ok = await confirm({
      title: detail ? `Delete “${detail.title}”?` : "Delete this course?",
      body: "It comes off the catalogue and learners lose access. It moves to the organisation's recycle bin, where an admin can restore it with its enrolments and progress.",
      confirmLabel: "Delete course",
      recoverable: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await coursesApi.remove(slug);
      router.push("/suite/lms/courses");
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Could not delete the course.");
      setBusy(false);
    }
  }, [slug, router, confirm, detail]);

  /* ---- loading ---------------------------------------------------- */
  if (loading) {
    return (
      <div>
        <BackLink href="/suite/lms/courses" label="Back to courses" />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-neutral-500">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Loading course…
        </div>
      </div>
    );
  }

  /* ---- error / not found ------------------------------------------ */
  if (error || !detail || !stats) {
    return (
      <div>
        <BackLink href="/suite/lms/courses" label="Back to courses" />
        <Card>
          <Empty
            icon={BookOpen}
            hue="grape"
            title={error ?? "Course not found"}
            hint="This course may have been removed or the link is incorrect."
            action={<ButtonLink href="/suite/lms/courses">Browse all courses</ButtonLink>}
          />
        </Card>
      </div>
    );
  }

  /* ---- derived ---------------------------------------------------- */
  const isReview = detail.status === "Review";
  const totals = stats.totals;
  const totalLectures = detail.sections.reduce((s, sec) => s + sec.lectures.length, 0);
  const trendData = stats.monthly.map((m) => ({ label: m.month, value: m.enrollments }));
  const reviews = detail.reviews ?? [];
  const instructor = detail.instructor;

  const reviewColumns: Column<Review>[] = [
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-3">
          <PersonAvatar name={r.name} size={32} />
          <span className="font-semibold text-neutral-900">{r.name}</span>
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      value: (r) => r.rating,
      render: (r) => <Stars rating={r.rating} size={13} />,
    },
    {
      key: "comment",
      header: "Review",
      value: (r) => r.comment,
      render: (r) => <span className="line-clamp-2 max-w-md text-neutral-600">{r.comment}</span>,
    },
    { key: "date", header: "Date", sortable: true, value: (r) => r.date, hideOnMobile: true },
  ];

  const engagement: { icon: LucideIcon; label: string; value: string; hue: Hue }[] = [
    { icon: Eye, label: "Views", value: formatCompact(totals.views), hue: "sky" },
    { icon: MousePointerClick, label: "Unique visitors", value: formatCompact(totals.uniqueVisitors), hue: "blue" },
    { icon: TrendingUp, label: "Conversion rate", value: `${totals.conversionRate.toFixed(1)}%`, hue: "mint" },
    { icon: RotateCcw, label: "Withdrawn", value: `${totals.withdrawalRate.toFixed(1)}%`, hue: "coral" },
    { icon: Percent, label: "Avg. completion", value: `${Math.round(totals.avgCompletion)}%`, hue: "grape" },
    {
      icon: Award,
      label: "Avg. quiz score",
      value: totals.avgQuizScore != null ? `${Math.round(totals.avgQuizScore)}%` : "-",
      hue: "sun",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/courses" label="Back to courses" />
        <PageHeader
          eyebrow={[detail.category, detail.level].filter(Boolean).join(" · ")}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {detail.title}
              <StatusChip status={detail.status} />
            </span>
          }
          subtitle={
            <>
              {instructor.name ? `${instructor.name} · ` : ""}
              <span className="tabular-nums">{totalLectures}</span> lectures · Free
              {detail.lastUpdated ? ` · updated ${formatDate(detail.lastUpdated)}` : ""} ·{" "}
              <Link
                href={`/courses/${slug}`}
                className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800"
              >
                View public page
                <ExternalLink size={13} aria-hidden />
              </Link>
            </>
          }
          actions={
            <>
              {/*
                Granting access directly, without a purchase. This is the primary
                action on an institution's course — assigning is how learners get
                onto it, where a marketplace course is bought.
              */}
              <Button variant="primary" icon={UserPlus} onClick={openAssign}>
                Assign
              </Button>
              <ButtonLink href={`/suite/lms/courses/${slug}/edit`} icon={Pencil}>
                Edit
              </ButtonLink>
              {detail.status === "Published" ? (
                <Button icon={Eye} disabled={busy} onClick={() => togglePublish(detail.status)}>
                  Unpublish
                </Button>
              ) : (
                <Button
                  icon={CheckCircle2}
                  disabled={busy}
                  onClick={() => togglePublish(detail.status)}
                  className="!border-mint-500/40 !text-mint-700 hover:!bg-mint-50"
                >
                  Publish
                </Button>
              )}
              <Button
                icon={Trash2}
                disabled={busy}
                onClick={remove}
                className="!border-error-500/30 !text-error-700 hover:!bg-error-500/5"
              >
                Delete
              </Button>
            </>
          }
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "learners", label: "Learners", count: totals.students },
            { key: "curriculum", label: "Curriculum", count: totalLectures },
            { key: "reviews", label: "Reviews", count: reviews.length },
            { key: "instructor", label: "Instructor" },
          ]}
          activeTab={tab}
          onTab={(k) => setTab(k as TabKey)}
        />
      </div>

      {/* ---- review banner ----------------------------------------- */}
      {isReview && (
        <div className="flex items-start gap-3 rounded-2xl border border-sun-500/25 bg-sun-50 px-5 py-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-sun-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-sun-700">This course is awaiting review</p>
            <p className="text-xs text-sun-700">Publish it to make it live in the catalog.</p>
          </div>
        </div>
      )}

      {/* ---- KPIs --------------------------------------------------- */}
      <StatGrid>
        <StatCard featured featuredHue="grape" label="Students" value={formatCompact(totals.students)} icon={Users} />
        <StatCard label="Completed" value={formatCompact(totals.completions)} icon={Award} hue="mint" />
        <StatCard
          label="Completion rate"
          value={totals.completionRate.toFixed(1)}
          unit="%"
          icon={Percent}
          hue="blue"
        />
        <StatCard
          label="Rating"
          value={detail.rating.toFixed(2)}
          unit="/ 5"
          hint={`${formatCompact(detail.reviewCount)} reviews`}
          icon={Star}
          hue="sun"
        />
      </StatGrid>

      {/* ============================ OVERVIEW ===================== */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Panel title="Enrolment trend" subtitle="New enrolments · last 12 months" icon={ChartLine} hue="grape">
              <AreaLine
                data={trendData}
                hue="grape"
                height={220}
                caption="Enrolments over the last 12 months"
                format={(v: number) => `${v.toLocaleString()} students`}
              />
            </Panel>

            {/* engagement metrics (all measured by the backend) */}
            <Panel title="Engagement" subtitle="How the course page and the course itself perform" icon={TrendingUp} hue="mint">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {engagement.map((m) => (
                  <li key={m.label} className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3.5">
                    <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[m.hue].soft)}>
                      <m.icon size={18} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-bold tabular-nums text-neutral-900">{m.value}</span>
                      <span className="block truncate text-xs text-neutral-500">{m.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Description" icon={FileText} hue="slate">
              {detail.description ? (
                <RichTextView value={detail.description} size="sm" className="text-neutral-600" />
              ) : (
                <p className="text-sm text-neutral-600">No description has been provided for this course yet.</p>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-4">
            <Card className="overflow-hidden">
              <div className="p-2 pb-0">
                <CourseCover
                  title={detail.title}
                  gradient={detail.gradient}
                  thumbnailUrl={detail.thumbnailUrl}
                  className="aspect-[16/9] rounded-[0.8rem]"
                />
              </div>
              <div className="px-5 pb-3 pt-2">
                <InfoList>
                  <InfoRow icon={Tag} label="Category" hue="grape">
                    {detail.category ?? "-"}
                  </InfoRow>
                  <InfoRow icon={Signal} label="Level" hue="sky">
                    {detail.level}
                  </InfoRow>
                  <InfoRow icon={Languages} label="Language" hue="mint">
                    {detail.language || "-"}
                  </InfoRow>
                  <InfoRow icon={Wallet} label="Price" hue="sun">
                    Free
                  </InfoRow>
                  <InfoRow icon={CalendarClock} label="Last updated" hue="blue">
                    {detail.lastUpdated ? formatDate(detail.lastUpdated) : "-"}
                  </InfoRow>
                </InfoList>
              </div>
            </Card>

            <Panel title="What students learn" icon={ListChecks} hue="mint">
              {detail.learningOutcomes.length === 0 ? (
                <p className="text-sm text-neutral-500">No learning outcomes listed.</p>
              ) : (
                <ul className="space-y-2.5">
                  {detail.learningOutcomes.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-600" aria-hidden />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Requirements" icon={ClipboardList} hue="coral">
              {detail.requirements.length === 0 ? (
                <p className="text-sm text-neutral-500">No requirements listed.</p>
              ) : (
                <ul className="space-y-2.5">
                  {detail.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-500" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ============================ LEARNERS ===================== */}
      {tab === "learners" && (
        <CourseLearners
          slug={slug}
          courseTitle={detail.title}
          totalLectures={totalLectures}
          refreshKey={rosterVersion}
          onAssign={openAssign}
        />
      )}

      {/* ============================ CURRICULUM =================== */}
      {tab === "curriculum" && (
        <Panel
          title="Course content"
          subtitle={`${detail.sections.length} modules · ${totalLectures} lectures`}
          icon={BookOpen}
          hue="grape"
        >
          {detail.sections.length === 0 ? (
            <Empty icon={BookOpen} hue="grape" title="No curriculum yet" hint="This course has no modules or lectures." />
          ) : (
            <ol className="space-y-4">
              {detail.sections.map((section, sIdx) => (
                <li key={sIdx} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="flex items-center gap-2.5 text-sm font-semibold text-neutral-900">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold tabular-nums text-grape-700 shadow-sm">
                        {sIdx + 1}
                      </span>
                      {section.title}
                    </h4>
                    <Chip hue="slate">{section.lectures.length} lectures</Chip>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {section.lectures.map((lecture, lIdx) => {
                      const meta = LECTURE_ICON[lecture.type] ?? { icon: FileText, hue: "slate" as Hue };
                      const Icon = meta.icon;
                      return (
                        <li key={lecture.id ?? lIdx} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
                          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", HUE[meta.hue].soft)}>
                            <Icon size={14} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{lecture.title}</span>
                          <span className="hidden text-xs capitalize text-neutral-500 sm:inline">{lecture.type}</span>
                          {lecture.duration && (
                            <span className="text-xs tabular-nums text-neutral-500">{lecture.duration}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {/* ============================ REVIEWS ====================== */}
      {tab === "reviews" && (
        <DataView
          rows={reviews}
          columns={reviewColumns}
          rowKey={(r) => `${r.name}-${r.date}-${r.rating}`}
          storageKey="lms.course.reviews"
          defaultView="list"
          caption="Reviews of this course"
          searchPlaceholder="Search reviews"
          renderCard={(r) => (
            <div className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <PersonAvatar name={r.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.date}</p>
                </div>
              </div>
              <Stars rating={r.rating} size={14} />
              <p className="text-sm leading-relaxed text-neutral-600">{r.comment}</p>
            </div>
          )}
          renderListItem={(r) => (
            <div className="flex items-start gap-3 px-5 py-4">
              <PersonAvatar name={r.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{r.name}</span>
                  <Stars rating={r.rating} size={13} />
                  <span className="text-xs text-neutral-500">{r.date}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{r.comment}</p>
              </div>
            </div>
          )}
          empty={<Empty icon={Star} hue="sun" title="No reviews yet" hint="This course has no published reviews." />}
        />
      )}

      {/* ============================ INSTRUCTOR =================== */}
      {tab === "instructor" && (
        <Panel
          title="Instructor"
          icon={GraduationCap}
          hue="sky"
          actions={
            <ButtonLink href="/suite/lms/instructors" size="sm" variant="ghost" icon={GraduationCap}>
              View instructors
            </ButtonLink>
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <PersonAvatar name={instructor.name ?? "?"} size={64} />
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-bold text-neutral-900">{instructor.name ?? "-"}</h4>
              {instructor.title && <p className="text-sm text-neutral-500">{instructor.title}</p>}
              {instructor.bio ? (
                <RichTextView value={instructor.bio} size="sm" className="mt-3 text-neutral-600" />
              ) : (
                <p className="mt-3 text-sm text-neutral-600">No instructor biography is available for this course.</p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {assignOpen && (
        <AssignDialog
          title="Assign this course"
          subtitle={detail.title}
          students={students}
          loading={loadingStudents}
          held={held}
          onAssign={async (recipients) => {
            const result = await assignApi.assignCourse(slug, recipients);
            // The enrollment count and the roster have both just changed.
            void load();
            setRosterVersion((v) => v + 1);
            return result;
          }}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}
