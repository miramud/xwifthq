"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
import {
  BookOpen,
  Users,
  Wallet,
  Star,
  CheckCircle2,
  ExternalLink,
  Pencil,
  Target,
  RotateCcw,
  Clock,
  Eye,
  UserCheck,
  ListChecks,
  MessageSquare,
  AlertTriangle,
  Trash2,
  Save,
  Loader2,
  Award,
  ChartLine,
  GraduationCap,
  ClipboardList,
  Layers,
  Settings2,
  BarChart3,
} from "lucide-react";
import { Button, ButtonLink, CalloutStrip, Card, Chip, Empty, Panel, Progress, StatGrid, UnderlineTabs } from "@/components/workspace/kit";
import { AreaLine } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import type { Hue } from "@/components/workspace/modules";
import { Stars } from "@/components/dashboard/ui";
import { CourseThumb } from "@/components/shared/CourseCover";
import { BackLink, FaceAvatar, IconTile, InfoList, InfoRow, inputClass, labelClass, PersonCard, StatCard, StatusChip, textareaClass } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import {
  formatCompactNaira,
  formatCompact,
  type CourseState,
} from "@/suite/lms/lib/instructor-data";
import { timeAgo } from "@/lib/console-data";
import { assignments as assignmentsApi } from "@/lib/api/saas-client";
import { useCategoryNames } from "@/lib/api/categories-client";
import {
  courses as coursesApi,
  insights,
  students as studentsApi,
  certificateTemplates as certTemplatesApi,
  ApiError,
  type CourseAnalytics,
  type Learner,
  type LearnerStatus,
  type InstructorCourse,
  type PickerCertificateTemplate,
} from "@/lib/api/instructor-client";
import CurriculumEditor from "@/suite/lms/components/instructor/CurriculumEditor";
import QuizBreakdown from "@/suite/lms/components/console/QuizBreakdown";
import EngagementBoard from "@/suite/lms/components/console/EngagementBoard";
import {
  apiSectionsToCurriculum,
  serializeSections,
  type Section as CurriculumSection,
} from "@/suite/lms/lib/curriculum";

/* ------------------------------------------------------------------ */
/*  Static maps & helpers                                              */
/* ------------------------------------------------------------------ */

type TabKey =
  | "overview"
  | "curriculum"
  | "students"
  | "quizzes"
  | "engagement"
  | "reviews"
  | "settings";

const STATE_HUE: Record<CourseState, Hue> = {
  Published: "mint",
  "In Review": "sun",
  Draft: "slate",
  Scheduled: "sky",
};

const LEARNER_HUE: Record<LearnerStatus, Hue> = {
  Active: "sky",
  Completed: "mint",
  "At risk": "sun",
  Refunded: "rose",
  Cancelled: "slate",
};

const GENERIC_OUTCOMES = [
  "Build real-world, production-ready projects from scratch",
  "Master the core concepts through hands-on practice",
  "Apply industry best practices and modern tooling",
  "Deploy and ship your work with confidence",
];

const GENERIC_REQUIREMENTS = [
  "A computer with a stable internet connection",
  "Basic familiarity with the fundamentals of the topic",
  "Eagerness to learn and build alongside the lessons",
];

/** Shape returned by GET /api/instructor/courses/{slug} (CourseResource). */
interface ApiCourseDetail {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string | null;
  categorySlug: string | null;
  level: InstructorCourse["level"];
  status: "draft" | "review" | "published";
  rating: number;
  reviewCount: number;
  studentsEnrolled: number;
  duration: string;
  durationMonths: number;
  language: string;
  lastUpdated: string | null;
  totalLectures: number;
  totalHours: number;
  gradient: string | null;
  thumbnailUrl?: string | null;
  hasCertificate?: boolean;
  certificateTemplateId?: string | null;
  /** Months the certificate stays good for. Null means it never expires. */
  certificateValidMonths?: number | null;
  // These come from `whenLoaded`/nullable columns on the API, so any of them
  // may be absent depending on what the endpoint eager-loads.
  learningOutcomes?: string[] | null;
  requirements?: string[] | null;
  sections?: CurriculumSection[] | null;
  reviews?: { name: string; rating: number; date: string; comment: string; avatar: string }[] | null;
}

const STATE_FROM_STATUS: Record<ApiCourseDetail["status"], CourseState> = {
  published: "Published",
  review: "In Review",
  draft: "Draft",
};

const inputCls = inputClass;
const labelCls = labelClass;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InstructorCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  // Category taxonomy comes from the database, same as the create wizard and admin editor.
  const categoryNames = useCategoryNames();

  const [active, setActive] = useState<TabKey>("overview");
  const [apiCourse, setApiCourse] = useState<ApiCourseDetail | null>(null);
  const [courseAnalytics, setCourseAnalytics] = useState<CourseAnalytics | null>(null);
  const [roster, setRoster] = useState<Learner[]>([]);
  const [busyLearner, setBusyLearner] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    category: "Web Development",
    level: "Intermediate" as InstructorCourse["level"],
    visibility: "Draft" as "Published" | "Draft",
    hasCertificate: false,
    certificateTemplateId: "" as string,
    /** Kept as a string so "" can mean "never expires" rather than 0 months. */
    certificateValidMonths: "" as string,
  });
  const [certTemplates, setCertTemplates] = useState<PickerCertificateTemplate[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumSection[]>([]);
  const [savingCurriculum, setSavingCurriculum] = useState(false);
  const [curriculumMsg, setCurriculumMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let activeReq = true;
    setLoadState("loading");
    coursesApi
      .get(slug)
      .then((d) => {
        if (!activeReq) return;
        const c = d as ApiCourseDetail;
        setApiCourse(c);
        setForm({
          title: c.title,
          subtitle: c.shortDescription,
          category: c.category ?? "Web Development",
          level: c.level,
          visibility: c.status === "published" ? "Published" : "Draft",
          hasCertificate: c.hasCertificate ?? false,
          certificateTemplateId: c.certificateTemplateId ?? "",
          // Empty string is "never expires". A 0 would be a term of zero
          // months, which is a different and nonsensical thing.
          certificateValidMonths:
            c.certificateValidMonths != null ? String(c.certificateValidMonths) : "",
        });
        setCurriculum(apiSectionsToCurriculum(c.sections));
        setLoadState("ready");
      })
      .catch((e) => {
        if (!activeReq) return;
        if (e instanceof ApiError && e.status === 404) {
          setLoadState("notfound");
        } else {
          setErrMsg(e instanceof ApiError ? e.message : "This course didn't load. Try again.");
          setLoadState("error");
        }
      });
    // Analytics and roster are auxiliary: a 404/failure on either must not
    // blank the page, so each has its own catch and leaves defaults in place.
    insights
      .course(slug)
      .then((d) => activeReq && setCourseAnalytics(d))
      .catch(() => {});
    studentsApi
      .list(slug)
      .then((d) => activeReq && setRoster(d))
      .catch(() => {});
    certTemplatesApi
      .list()
      .then((d) => activeReq && setCertTemplates(d))
      .catch(() => {});
    return () => {
      activeReq = false;
    };
  }, [slug]);

  if (loadState === "loading") {
    return (
      <div className="space-y-6">
        <BackLink href="/suite/lms/teach/courses" label="Back to courses" />
        <Card>
          <Empty icon={BookOpen} title="Loading the course…" hint="This takes a moment." />
        </Card>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="space-y-6">
        <BackLink href="/suite/lms/teach/courses" label="Back to courses" />
        <Card>
          <Empty
            icon={BookOpen}
            hue="rose"
            title="This course didn't load"
            hint={errMsg}
            action={
              <ButtonLink href="/suite/lms/teach/courses" variant="primary">
                Back to courses
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  if (loadState === "notfound" || !apiCourse) {
    return (
      <div className="space-y-6">
        <BackLink href="/suite/lms/teach/courses" label="Back to courses" />
        <Card>
          <Empty
            icon={BookOpen}
            title="Course not found"
            hint="It doesn't exist, or it was removed from your catalogue."
            action={
              <ButtonLink href="/suite/lms/teach/courses" variant="primary">
                View all courses
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  // Studio view-model built from the real course record. Per-course analytics
  // (enrolment curve, completion / conversion / refund, views) come from the
  // `insights.course(slug)` payload below, never fabricated.
  const course = {
    slug: apiCourse.slug,
    title: apiCourse.title,
    subtitle: apiCourse.shortDescription,
    category: apiCourse.category ?? "-",
    level: apiCourse.level,
    state: STATE_FROM_STATUS[apiCourse.status] ?? "Draft",
    students: apiCourse.studentsEnrolled,
    rating: apiCourse.rating,
    reviews: apiCourse.reviewCount,
    lectures: apiCourse.totalLectures,
    hours: apiCourse.totalHours,
    lastUpdated: apiCourse.lastUpdated ?? "-",
    gradient: apiCourse.gradient ?? "from-primary-400 to-primary-600",
  };

  const courseThumbnail = apiCourse.thumbnailUrl ?? null;

  const monthly = courseAnalytics?.monthly ?? [];
  const totals = courseAnalytics?.totals ?? null;

  const apiOutcomes = apiCourse.learningOutcomes ?? [];
  const outcomes = apiOutcomes.length > 0 ? apiOutcomes : GENERIC_OUTCOMES;
  const apiRequirements = apiCourse.requirements ?? [];
  const requirements = apiRequirements.length > 0 ? apiRequirements : GENERIC_REQUIREMENTS;

  const courseReviews = (apiCourse.reviews ?? []).map((rv, i) => ({
    id: String(i),
    student: rv.name,
    initials: rv.avatar,
    rating: rv.rating,
    title: "",
    body: rv.comment,
    date: rv.date,
    reply: null as string | null,
    replyDate: null as string | null,
  }));

  const netRevenue = monthly.reduce((s, m) => s + m.net, 0);

  const chartData = monthly.map((m) => ({
    label: m.month,
    value: m.enrollments,
  }));

  const totalLectures = curriculum.reduce((s, sec) => s + sec.lectures.length, 0);

  async function saveCurriculum() {
    setSavingCurriculum(true);
    setCurriculumMsg(null);
    try {
      const updated = (await coursesApi.update(slug, {
        sections: serializeSections(curriculum),
      })) as ApiCourseDetail;
      setApiCourse(updated);
      setCurriculum(apiSectionsToCurriculum(updated.sections));
      setCurriculumMsg({ ok: true, text: "Curriculum saved." });
    } catch (e) {
      setCurriculumMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "The curriculum wasn't saved. Try again.",
      });
    } finally {
      setSavingCurriculum(false);
    }
  }

  /* Persist the Settings tab (course details + visibility). */
  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const updated = (await coursesApi.update(slug, {
        title: form.title,
        shortDescription: form.subtitle,
        categorySlug: slugify(form.category),
        level: form.level,
        status: form.visibility === "Published" ? "published" : "draft",
        hasCertificate: form.hasCertificate,
        certificateTemplateId: form.hasCertificate
          ? form.certificateTemplateId || null
          : null,
        /*
          Null rather than omitted, so clearing the box genuinely makes future
          certificates permanent instead of silently leaving the old term in
          place. A course that stops issuing certificates loses its term too:
          there is nothing left for it to govern.
        */
        certificateValidMonths:
          form.hasCertificate && form.certificateValidMonths !== ""
            ? Number(form.certificateValidMonths)
            : null,
      })) as ApiCourseDetail;
      setApiCourse(updated);
      setSettingsMsg({ ok: true, text: "Course details saved." });
    } catch (e) {
      setSettingsMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Your changes weren't saved. Try again.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  /**
   * Take the course off somebody.
   *
   * Addressed by course and learner rather than by enrollment, because that
   * is the route instructors share with admins, and an instructor may do this
   * for their own courses and nothing else.
   */
  async function unassign(learner: Learner) {
    const who = learner.name ?? "this learner";
    const ok = await confirm({
      title: `Un-assign ${who}?`,
      body: `${who} loses access to this course. Their progress is kept, so assigning it again picks up where they left off. Un-assigning doesn't go to the recycle bin.`,
      confirmLabel: "Un-assign",
    });
    if (!ok) return;

    setBusyLearner(learner.userId);

    try {
      await assignmentsApi.revokeCourse(slug, learner.userId);
      setRoster((rows) => rows.filter((row) => row.userId !== learner.userId));
    } catch {
      /* The learner stays listed, which is the safe reading of a failure. */
    } finally {
      setBusyLearner(null);
    }
  }

  /* Reset the form back to the last-saved course record. */
  function discardSettings() {
    if (!apiCourse) return;
    setForm({
      title: apiCourse.title,
      subtitle: apiCourse.shortDescription,
      category: apiCourse.category ?? "Web Development",
      level: apiCourse.level,
      visibility: apiCourse.status === "published" ? "Published" : "Draft",
      hasCertificate: apiCourse.hasCertificate ?? false,
      certificateTemplateId: apiCourse.certificateTemplateId ?? "",
      certificateValidMonths:
        apiCourse.certificateValidMonths != null
          ? String(apiCourse.certificateValidMonths)
          : "",
    });
    setSettingsMsg(null);
  }

  async function unpublishCourse() {
    setSettingsMsg(null);
    try {
      const updated = (await coursesApi.setStatus(slug, "draft")) as ApiCourseDetail;
      setApiCourse(updated);
      setForm((f) => ({ ...f, visibility: "Draft" }));
      setSettingsMsg({ ok: true, text: "Course unpublished." });
    } catch (e) {
      setSettingsMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "The course wasn't unpublished. Try again.",
      });
    }
  }

  async function deleteCourse() {
    const ok = await confirm({
      title: form.title ? `Delete “${form.title}”?` : "Delete this course?",
      body: "Learners lose access straight away. It moves to your organisation's recycle bin, where an admin can restore it with its enrolments and progress.",
      confirmLabel: "Delete course",
      recoverable: true,
    });
    if (!ok) return;
    setDeleting(true);
    setSettingsMsg(null);
    try {
      await coursesApi.remove(slug);
      router.push("/suite/lms/teach/courses");
    } catch (e) {
      setSettingsMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "The course wasn't deleted. Try again.",
      });
      setDeleting(false);
    }
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "curriculum", label: "Curriculum", count: curriculum.length },
    { key: "students", label: "Students", count: roster.length },
    /*
      Its own tab rather than a panel under Overview. What somebody does with
      this is rewrite a question, which is an authoring session rather than a
      number they glance at on the way past.
    */
    { key: "quizzes", label: "Questions" },
    /*
      Separate from Overview, which reports on the course. This reports on the
      *material* (which lesson loses people and how long it really takes),
      and what somebody does with it is re-record a passage.
    */
    { key: "engagement", label: "Engagement" },
    { key: "reviews", label: "Reviews", count: courseReviews.length },
    { key: "settings", label: "Settings" },
  ];

  // Confirmed in the shared dialog, which names the learner: the row is the
  // only thing telling them apart from the one above.
  const unassignControl = (l: Learner) => (
    <Button
      size="sm"
      disabled={busyLearner === l.userId}
      onClick={() => void unassign(l)}
      aria-label={`Un-assign ${l.name ?? "this learner"}`}
    >
      Un-assign
    </Button>
  );

  const learnerHref = (l: Learner) => `/suite/lms/teach/students/${l.id}`;

  const rosterColumns: Column<Learner>[] = [
    {
      key: "name",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (l) => l.name ?? "Unnamed learner",
      render: (l) => (
        <Link
          href={learnerHref(l)}
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <FaceAvatar name={l.name ?? l.initials} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-neutral-900 hover:text-primary-700">
              {l.name ?? "Unnamed learner"}
            </span>
            <span className="block truncate text-xs text-neutral-500">{l.email ?? "-"}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      value: (l) => l.progress,
      render: (l) => (
        <span className="flex min-w-[8rem] items-center gap-2">
          <span className="w-24">
            <Meter value={l.progress} size="sm" hue={l.progress >= 75 ? "mint" : l.progress >= 40 ? "blue" : "sun"} label={`${l.name ?? "Learner"} progress`} />
          </span>
          <span className="text-xs tabular-nums text-neutral-600">{l.progress}%</span>
        </span>
      ),
    },
    {
      key: "lessons",
      header: "Lessons",
      sortable: true,
      value: (l) => l.lessonsDone,
      render: (l) => (
        <span className="tabular-nums">
          {l.lessonsDone}/{l.totalLessons}
        </span>
      ),
    },
    {
      key: "quizAvg",
      header: "Quiz average",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.quizAvg,
      render: (l) => <span className="tabular-nums">{l.quizAvg == null ? "-" : `${l.quizAvg}%`}</span>,
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      hideOnMobile: true,
      value: (l) => l.lastActive,
      render: (l) => <span className="text-neutral-500">{timeAgo(l.lastActive)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (l) => l.status,
      render: (l) => <StatusChip status={l.status} label={l.status} hue={LEARNER_HUE[l.status]} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      tableOnly: true,
      render: unassignControl,
    },
  ];

  type CourseReview = (typeof courseReviews)[number];
  const reviewColumns: Column<CourseReview>[] = [
    {
      key: "student",
      header: "Learner",
      primary: true,
      sortable: true,
      value: (r) => r.student,
      render: (r) => (
        <span className="flex items-center gap-3">
          <FaceAvatar name={r.student} size={32} />
          <span className="font-medium text-neutral-900">{r.student}</span>
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
      key: "body",
      header: "Review",
      value: (r) => r.body,
      render: (r) => <span className="line-clamp-2 max-w-md text-neutral-600">{r.body}</span>,
    },
    { key: "date", header: "Date", sortable: true, value: (r) => r.date, hideOnMobile: true },
  ];

  const reviewBody = (r: CourseReview) => (
    <div className="flex items-start gap-3 p-5">
      <FaceAvatar name={r.student} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-neutral-900">{r.student}</p>
          <Stars rating={r.rating} size={13} />
          <span className="text-xs text-neutral-500">{r.date}</span>
        </div>
        {r.title && <p className="mt-1 text-sm font-medium text-neutral-700">{r.title}</p>}
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">{r.body}</p>

        {r.reply ? (
          <div className="mt-3 rounded-2xl bg-primary-50 px-4 py-3">
            <p className="text-xs font-semibold text-primary-700">Your reply · {r.replyDate}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{r.reply}</p>
          </div>
        ) : (
          <Button size="sm" variant="ghost" icon={MessageSquare} className="mt-2 -ml-3">
            Reply
          </Button>
        )}
      </div>
    </div>
  );

  // Rating distribution from the written reviews, for the summary bars.
  const ratingBuckets = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: courseReviews.filter((r) => Math.round(r.rating) === stars).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/teach/courses" label="Back to courses" />

        {/* ---------- hero ---------- */}
        <Card className="overflow-hidden">
          <div className={`h-24 bg-gradient-to-br ${course.gradient} opacity-90`} aria-hidden />
          <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <span className="-mt-12 inline-block rounded-[1.25rem] bg-white p-1 shadow-md">
                <CourseThumb
                  title={course.title}
                  gradient={course.gradient}
                  thumbnailUrl={courseThumbnail}
                  size={80}
                  rounded="rounded-2xl"
                />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[26px]">
                    {course.title}
                  </h1>
                  <Chip hue={STATE_HUE[course.state]} dot>
                    {course.state}
                  </Chip>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-neutral-500">{course.subtitle}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip hue="blue" icon={GraduationCap}>
                    {course.category}
                  </Chip>
                  <Chip hue="sky">{course.level}</Chip>
                  <Chip hue="grape" icon={ListChecks}>
                    {course.lectures} lectures
                  </Chip>
                  <Chip hue="sun" icon={Clock}>
                    {course.hours}h
                  </Chip>
                  <span className="text-xs text-neutral-500">Updated {course.lastUpdated}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button onClick={() => setActive("settings")} icon={Pencil}>
                Edit course
              </Button>
              <ButtonLink href={`/courses/${slug}`} variant="primary" icon={ExternalLink}>
                View public page
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------- KPI row ---------- */}
      <StatGrid>
        <StatCard featured featuredHue="sky" label="Students" value={formatCompact(course.students)} icon={Users} hint="Enrolled" />
        <StatCard label="Net revenue" value={Number.isFinite(netRevenue) ? formatCompactNaira(netRevenue) : "-"} icon={Wallet} hue="mint" hint="Last 12 months" />
        <StatCard
          label="Rating"
          value={course.rating.toFixed(2)}
          unit="/ 5"
          icon={Star}
          hue="sun"
          hint={`${course.reviews.toLocaleString()} ratings`}
        />
        <StatCard
          label="Completion"
          value={totals ? `${totals.avgCompletion}%` : "-"}
          icon={CheckCircle2}
          hue="grape"
          hint="Average progress"
        />
      </StatGrid>

      {/* ---------- tabs ---------- */}
      <div>
        <UnderlineTabs tabs={tabs} active={active} onChange={(k) => setActive(k as TabKey)} />
      </div>

      {/* ============================================================ */}
      {/*  OVERVIEW                                                     */}
      {/* ============================================================ */}
      {active === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Enrolments"
              subtitle="New learners · last 12 months"
              icon={ChartLine}
            >
              <AreaLine
                data={chartData}
                hue="blue"
                height={250}
                caption="Monthly enrolments over the last 12 months"
                format={(v) => `${v.toLocaleString()} learners`}
              />
            </Panel>

            <Panel title="Reach" subtitle="How people find and join" icon={Target} hue="sky" bodyClassName="px-5 pb-3 pt-1">
              <InfoList>
                <InfoRow icon={Target} hue="sky" label="Conversion rate · visitors who enrol">
                  {totals && totals.conversionRate != null ? `${totals.conversionRate}%` : "-"}
                </InfoRow>
                <InfoRow icon={RotateCcw} hue="coral" label="Refund rate · of all enrolments">
                  {totals && totals.refundRate != null ? `${totals.refundRate}%` : "-"}
                </InfoRow>
                <InfoRow icon={Eye} hue="grape" label="Views · course page visits">
                  {totals ? formatCompact(totals.views) : "-"}
                </InfoRow>
                <InfoRow icon={UserCheck} hue="mint" label="Unique visitors · distinct people">
                  {totals ? formatCompact(totals.uniqueVisitors) : "-"}
                </InfoRow>
                <InfoRow icon={ListChecks} hue="blue" label="Lectures">
                  {course.lectures}
                </InfoRow>
                <InfoRow icon={Clock} hue="sun" label="Total length">
                  {course.hours}h
                </InfoRow>
              </InfoList>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="What you'll learn" icon={CheckCircle2} hue="mint">
              <ul className="space-y-3">
                {outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-600">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-mint-500" aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Requirements" icon={ClipboardList} hue="coral">
              <ul className="space-y-3">
                {requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-500" aria-hidden />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  CURRICULUM                                                   */}
      {/* ============================================================ */}
      {active === "curriculum" && (
        <div className="space-y-4">
          <Panel
            title="Course curriculum"
            subtitle={`${curriculum.length} sections · ${totalLectures} lectures`}
            icon={Layers}
            hue="grape"
            bodyClassName="space-y-4 p-5"
            actions={
              <Button variant="primary" size="sm" onClick={saveCurriculum} disabled={savingCurriculum}>
                {savingCurriculum ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Save size={14} aria-hidden />
                )}
                {savingCurriculum ? "Saving…" : "Save curriculum"}
              </Button>
            }
          >
            <CalloutStrip icon={Layers} hue="grape" title="Edit sections and lectures, then save">
              Choose <span className="font-semibold">Content</span> on a lecture to add a video (link or
              upload), a rich-text article or a quiz. Nothing changes until you choose{" "}
              <span className="font-semibold">Save curriculum</span>.
            </CalloutStrip>
            <CurriculumEditor sections={curriculum} onChange={setCurriculum} />
            {curriculumMsg && (
              <p
                role="status"
                className={`text-xs font-medium ${curriculumMsg.ok ? "text-mint-700" : "text-error-700"}`}
              >
                {curriculumMsg.text}
              </p>
            )}
          </Panel>
        </div>
      )}

      {/* ============================================================ */}
      {/*  STUDENTS                                                     */}
      {/* ============================================================ */}
      {active === "students" && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <IconTile icon={Users} hue="sky" />
            <div>
              <h2 className="text-base font-bold tracking-tight text-neutral-900">Enrolled learners</h2>
              <p className="text-xs text-neutral-500">{roster.length} learners on this course</p>
            </div>
          </div>
          <DataView
            rows={roster}
            columns={rosterColumns}
            rowKey={(l) => l.id}
            storageKey="teach.course-roster"
            caption="Students enrolled in this course"
            searchPlaceholder="Search learners"
            empty={
              <Empty
                icon={Users}
                hue="sky"
                title="No learners yet"
                hint="Learners show here once people enrol on this course."
              />
            }
            renderCard={(l) => (
              <PersonCard
                name={l.name ?? "Unnamed learner"}
                subtitle={l.email ?? "-"}
                trailing={<StatusChip status={l.status} label={l.status} hue={LEARNER_HUE[l.status]} />}
                chips={
                  <>
                    <Chip hue="grape" icon={ListChecks}>
                      {l.lessonsDone}/{l.totalLessons} lessons
                    </Chip>
                    <Chip hue="sun" icon={BarChart3}>
                      Quiz {l.quizAvg == null ? "-" : `${l.quizAvg}%`}
                    </Chip>
                  </>
                }
                footer={
                  <>
                    <Link href={learnerHref(l)} className="font-semibold text-primary-700 hover:text-primary-800">
                      Open profile
                    </Link>
                    {unassignControl(l)}
                  </>
                }
              >
                <Progress
                  value={l.progress}
                  hue={l.progress >= 75 ? "mint" : l.progress >= 40 ? "blue" : "sun"}
                  label={`Progress · active ${timeAgo(l.lastActive)}`}
                  showValue
                />
              </PersonCard>
            )}
            renderListItem={(l) => (
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <FaceAvatar name={l.name ?? l.initials} size={36} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={learnerHref(l)}
                    className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary-700"
                  >
                    {l.name ?? "Unnamed learner"}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">
                    {l.lessonsDone}/{l.totalLessons} lessons · active {timeAgo(l.lastActive)}
                  </p>
                </div>
                <div className="hidden w-32 sm:block">
                  <Meter value={l.progress} size="sm" label={`${l.name ?? "Learner"} progress`} />
                </div>
                <StatusChip status={l.status} label={l.status} hue={LEARNER_HUE[l.status]} />
                {unassignControl(l)}
              </div>
            )}
          />

          {/*
            Said once under the table. Revoking withdraws access and keeps
            what they did, so granting the course again later picks up where
            they left off rather than starting them at nothing.
          */}
          {roster.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Un-assigning removes access and keeps their progress. Assign the
              course again and they carry on where they stopped.
            </p>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  QUESTIONS                                                    */}
      {/* ============================================================ */}
      {active === "quizzes" && <QuizBreakdown courseSlug={slug} />}

      {/* ============================================================ */}
      {/*  ENGAGEMENT                                                   */}
      {/* ============================================================ */}
      {active === "engagement" && <EngagementBoard courseSlug={slug} />}

      {/* ============================================================ */}
      {/*  REVIEWS                                                      */}
      {/* ============================================================ */}
      {active === "reviews" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Rating summary" icon={Star} hue="sun" className="lg:sticky lg:top-6 lg:self-start">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-5xl font-bold tracking-tight text-neutral-900 tabular-nums">
                {course.rating.toFixed(1)}
              </p>
              <Stars rating={course.rating} size={18} />
              <p className="text-xs text-neutral-500">
                {course.reviews.toLocaleString()} ratings · {courseReviews.length} written
              </p>
            </div>
            {courseReviews.length > 0 && (
              <div className="mt-4 space-y-2">
                {ratingBuckets.map((b) => (
                  <div key={b.stars} className="flex items-center gap-3 text-xs">
                    <span className="w-10 text-neutral-600">{b.stars} star</span>
                    <span className="flex-1">
                      <Meter
                        value={(b.count / courseReviews.length) * 100}
                        hue="sun"
                        size="sm"
                        label={`${b.stars} star reviews`}
                      />
                    </span>
                    <span className="w-6 text-right font-semibold tabular-nums text-neutral-900">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="lg:col-span-2">
            <DataView
              rows={courseReviews}
              columns={reviewColumns}
              rowKey={(r) => r.id}
              storageKey="teach.course-reviews"
              defaultView="list"
              gridCols={2}
              caption="Learner reviews on this course"
              searchPlaceholder="Search reviews"
              empty={
                <Empty icon={Star} hue="sun" title="No reviews yet" hint="Reviews from your learners show here." />
              }
              renderCard={reviewBody}
              renderListItem={reviewBody}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SETTINGS                                                     */}
      {/* ============================================================ */}
      {active === "settings" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title="Course details"
            subtitle="How your course appears in the catalogue"
            icon={Settings2}
          >
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label htmlFor="title" className={labelCls}>
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="subtitle" className={labelCls}>
                  Subtitle
                </label>
                <textarea
                  id="subtitle"
                  rows={2}
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className={labelCls}>
                    Category
                  </label>
                  {/* Live taxonomy, plus the course's current category so the
                      dropdown is never blank before categories finish loading. */}
                  <SearchableSelect
                    id="category"
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    placeholder="Choose a category"
                    options={(categoryNames.includes(form.category) || !form.category
                      ? categoryNames
                      : [form.category, ...categoryNames]
                    ).map((c) => ({ value: c, label: c }))}
                  />
                </div>

                <div>
                  <label htmlFor="level" className={labelCls}>
                    Level
                  </label>
                  <SearchableSelect
                    id="level"
                    value={form.level}
                    onChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        level: v as typeof f.level,
                      }))
                    }
                    options={["Beginner", "Intermediate", "Advanced"].map((lv) => ({ value: lv, label: lv }))}
                  />
                </div>
              </div>

              <div>
                <span className={labelCls}>Visibility</span>
                <div className="flex flex-wrap gap-3">
                  {(["Published", "Draft"] as const).map((v) => (
                    <label
                      key={v}
                      className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-4 text-sm font-medium transition-colors ${
                        form.visibility === v
                          ? "border-primary-300 bg-primary-50 text-primary-700"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={v}
                        checked={form.visibility === v}
                        onChange={() => setForm((f) => ({ ...f, visibility: v }))}
                        className="accent-primary-600"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              {/* Completion certificate */}
              <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
                <label className="flex items-start justify-between gap-4">
                  <span className="flex items-start gap-3">
                    <IconTile icon={Award} hue="mint" size={36} />
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">
                        Award a completion certificate
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        Learners who finish every lecture get a certificate anyone
                        can verify.
                      </span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.hasCertificate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hasCertificate: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
                  />
                </label>

                {form.hasCertificate && (
                  <div className="mt-4 grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="cert-template" className={labelCls}>
                        Certificate template
                      </label>
                      <SearchableSelect
                        id="cert-template"
                        value={form.certificateTemplateId}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            certificateTemplateId: v,
                          }))
                        }
                        searchPlaceholder="Search templates"
                        options={[
                          {
                            value: "",
                            label: `Platform default${
                              certTemplates.find((t) => t.isDefault)
                                ? ` (${certTemplates.find((t) => t.isDefault)!.name})`
                                : ""
                            }`,
                          },
                          ...certTemplates.map((t) => ({ value: String(t.id), label: t.name, hint: t.orgName })),
                        ]}
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        The XwiftHQ admin team manages templates.
                      </p>
                    </div>

                    {/*
                      The field that makes recurring training possible at all.
                      Blank is the default and means the certificate never
                      lapses, which is right for a qualification and wrong for
                      almost all mandatory training, so the hint names the
                      consequence rather than describing the input.
                    */}
                    <div>
                      <label htmlFor="cert-valid-months" className={labelCls}>
                        Valid for
                      </label>
                      <SearchableSelect
                        id="cert-valid-months"
                        value={form.certificateValidMonths}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            certificateValidMonths: v,
                          }))
                        }
                        options={[
                          { value: "", label: "Never expires" },
                          { value: "6", label: "6 months" },
                          { value: "12", label: "1 year" },
                          { value: "24", label: "2 years" },
                          { value: "36", label: "3 years" },
                          { value: "60", label: "5 years" },
                        ]}
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        Set a term and the course becomes recurring training.
                        When a learner&rsquo;s certificate lapses they show as
                        outstanding on the compliance report again, and
                        assigning the course again takes them through it afresh.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-5">
                <Button variant="primary" onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings && <Loader2 size={14} className="animate-spin" aria-hidden />}
                  {savingSettings ? "Saving…" : "Save changes"}
                </Button>
                <Button onClick={discardSettings} disabled={savingSettings}>
                  Discard
                </Button>
                {settingsMsg && (
                  <span
                    role="status"
                    className={`text-sm font-medium ${settingsMsg.ok ? "text-mint-700" : "text-error-700"}`}
                  >
                    {settingsMsg.text}
                  </span>
                )}
              </div>
            </div>
          </Panel>

          {/* danger zone */}
          <Panel
            title="Danger zone"
            subtitle="Unpublish or delete this course"
            icon={AlertTriangle}
            hue="rose"
            className="lg:self-start"
          >
            <p className="text-sm text-neutral-600">
              Unpublishing hides the course from the catalogue. Deleting removes access for
              every learner straight away.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={unpublishCourse} disabled={form.visibility !== "Published"}>
                Unpublish
              </Button>
              <Button variant="danger" onClick={deleteCourse} disabled={deleting}>
                {deleting ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <Trash2 size={15} aria-hidden />
                )}
                {deleting ? "Deleting…" : "Delete course"}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
