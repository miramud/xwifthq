"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  BookOpen,
  ChartLine,
  ClipboardCheck,
  GraduationCap,
  MessageSquare,
  PieChart,
  Plus,
  Route,
  ShieldCheck,
  Star,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { formatCompact, timeAgo, type ActivityKind } from "@/lib/console-data";
import { analytics, type AdminOverview, type ActivityItem } from "@/lib/api/admin-client";
import { CourseThumb } from "@/components/shared/CourseCover";
import {
  CalloutStrip,
  Chip,
  Panel,
  Progress,
  QuickActions,
  Segmented,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  type QuickAction,
} from "@/components/workspace/kit";
import { AreaLine, Donut, SegmentedGauge, StatusBars } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { CoverCard, IconTile, ListRow, Rating, StatCard, Timeline } from "@/suite/lms/components/ui/ws";

const EMPTY_TOTALS: AdminOverview["totals"] = {
  learners: 0,
  enrollments: 0,
  completions: 0,
  courses: 0,
  instructors: 0,
  reviews: 0,
  avgRating: 0,
  avgCompletion: 0,
  completionRate: 0,
  mandatory: {
    assigned: 0,
    selfEnrolled: 0,
    assignedCompletion: 0,
    selfEnrolledCompletion: 0,
  },
  enrollmentsDelta: 0,
  completionsDelta: 0,
  coursesDelta: 0,
  ratingDelta: 0,
};

/* ------------------------------------------------------------------ */
/*  Activity icon mapping                                              */
/* ------------------------------------------------------------------ */

const ACTIVITY_STYLE: Record<ActivityKind, { icon: LucideIcon; hue: Hue }> = {
  enrollment: { icon: UserPlus, hue: "blue" },
  completion: { icon: Award, hue: "mint" },
  review: { icon: Star, hue: "sun" },
  payout: { icon: Activity, hue: "sky" },
  course: { icon: BookOpen, hue: "grape" },
};

type TopCourse = AdminOverview["topCourses"][number];

/*
  Shortcuts to the console's own sections. Every one is in the console nav,
  and the console layout already admits only people who run learning, so no
  tile needs a gate of its own.
*/
const QUICK_LINKS: QuickAction[] = [
  { label: "Courses", href: "/suite/lms/courses", icon: BookOpen, hue: "blue" },
  { label: "Learning paths", href: "/suite/lms/learning-paths", icon: Route, hue: "grape" },
  { label: "Progress", href: "/suite/lms/progress", icon: ChartLine, hue: "mint" },
  { label: "Compliance", href: "/suite/lms/compliance", icon: ShieldCheck, hue: "coral" },
  { label: "Certificates", href: "/suite/lms/certificates", icon: Award, hue: "sun" },
  { label: "Leaderboards", href: "/suite/lms/leaderboards", icon: Trophy, hue: "sky" },
];

/* ------------------------------------------------------------------ */

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<"enrollments" | "completions">("enrollments");
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let alive = true;
    analytics
      .overview()
      .then((data) => alive && setOv(data))
      .catch(() => {});
    analytics
      .activity()
      .then((data) => alive && setActivity(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const totals = ov?.totals ?? EMPTY_TOTALS;
  const monthlySeries = ov?.monthly ?? [];
  // Only the categories somebody is actually in: a legend of fifteen zeros
  // says nothing. The rest of the catalogue is on the categories page.
  const studentsByCategory = (ov?.categories ?? [])
    .filter((c) => c.learners > 0)
    .sort((a, b) => b.learners - a.learners)
    .slice(0, 6);
  const topCourses = ov?.topCourses ?? [];

  const chartData = monthlySeries.map((m) => ({
    label: m.month,
    value: metric === "enrollments" ? m.enrollments : m.completions,
  }));

  const topColumns: Column<TopCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb title={c.title} gradient={c.gradient} size={40} rounded="rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-neutral-900">{c.title}</span>
            {c.category && <span className="block truncate text-xs text-neutral-500">{c.category}</span>}
          </span>
        </span>
      ),
    },
    {
      key: "learners",
      header: "Learners",
      align: "right",
      sortable: true,
      value: (c) => c.learners,
      render: (c) => (
        <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary-700">
          {formatCompact(c.learners)}
        </span>
      ),
    },
    {
      key: "completionRate",
      header: "Completed",
      sortable: true,
      value: (c) => c.completionRate,
      render: (c) => (
        <span className="flex min-w-[140px] items-center gap-2.5">
          <Progress value={c.completionRate} hue="mint" size="sm" label={`${c.title} completion`} />
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-900">
            {c.completionRate}%
          </span>
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.rating,
      render: (c) => <Rating value={c.rating || null} />,
    },
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner
        name={user?.name}
        eyebrow="Learning console"
        subtitle="Here is what is happening across your courses and learners today."
        art="learning"
        figure={{
          label: "Enrolments",
          value: formatCompact(totals.enrollments),
          hint: `${totals.completionRate}% of enrolments reach the end`,
        }}
        actions={
          <>
            <Link href="/suite/lms/courses/new" className={bannerButtonClass("solid")}>
              <Plus size={17} aria-hidden />
              New course
            </Link>
            <Link href="/suite/lms/progress" className={bannerButtonClass("glass")}>
              <ChartLine size={17} aria-hidden />
              Learner progress
            </Link>
          </>
        }
      />

      {/* KPI cards */}
      <StatGrid>
        <StatCard
          label="Learners"
          value={formatCompact(totals.learners)}
          delta={totals.enrollmentsDelta || null}
          deltaLabel="enrolments vs last month"
          icon={Users}
          hue="grape"
        />
        <StatCard
          label="Courses completed"
          value={formatCompact(totals.completions)}
          delta={totals.completionsDelta || null}
          deltaLabel="vs last month"
          icon={Award}
          hue="mint"
        />
        <StatCard
          label="Published courses"
          value={totals.courses}
          delta={totals.coursesDelta || null}
          deltaLabel="vs last month"
          icon={BookOpen}
          hue="blue"
          href="/suite/lms/courses"
        />
        <StatCard
          label="Average rating"
          value={totals.avgRating.toFixed(2)}
          unit="/ 5"
          delta={totals.ratingDelta || null}
          hint={`${totals.reviews.toLocaleString()} reviews`}
          icon={Star}
          hue="sun"
          href="/suite/lms/reviews"
        />
      </StatGrid>

      <QuickActions items={QUICK_LINKS} />

      {/* charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Performance"
          subtitle={`${metric === "enrollments" ? "New enrolments" : "Courses completed"}, last 12 months`}
          icon={ChartLine}
          hue="grape"
          actions={
            <Segmented
              label="Metric"
              value={metric}
              onChange={setMetric}
              options={[
                { key: "enrollments", label: "Enrolments" },
                { key: "completions", label: "Completions" },
              ]}
            />
          }
        >
          <AreaLine
            key={metric}
            data={chartData}
            hue={metric === "enrollments" ? "grape" : "mint"}
            height={240}
            caption={`${metric === "enrollments" ? "Enrolments" : "Completions"} over the last 12 months`}
            format={(v) =>
              metric === "enrollments" ? `${v.toLocaleString()} enrolled` : `${v.toLocaleString()} completed`
            }
          />
        </Panel>

        <Panel
          title="Learners by category"
          subtitle="Share of live enrolments"
          icon={PieChart}
          hue="sky"
          actions={<ViewAllLink href="/suite/lms/categories" />}
        >
          {studentsByCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Nobody is enrolled yet.</p>
          ) : (
            <Donut
              legend="below"
              size={180}
              data={studentsByCategory.map((c) => ({ label: c.label, value: c.learners, hue: hueFor(c.label) }))}
              total={formatCompact(totals.enrollments)}
              centerLabel="Enrolments"
              caption="Live enrolments by course category"
            />
          )}
        </Panel>
      </div>

      {/* health row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          title="How far people get"
          subtitle="Average share of a course finished"
          icon={GraduationCap}
          hue="mint"
          actions={<ViewAllLink href="/suite/lms/progress" />}
        >
          <div className="flex justify-center pt-2">
            <SegmentedGauge
              value={totals.avgCompletion}
              hue="mint"
              label="Average completion"
              caption={`${totals.completionRate}% of enrolments reach the end`}
            />
          </div>
        </Panel>

        {/*
          Required training against training people chose. Optional courses
          almost always complete better (nobody starts one who did not want
          to), so a single blended rate would hide whether the mandatory
          programme is actually landing.
        */}
        <Panel title="Assigned vs chosen" subtitle="Completion by how people enrolled" icon={ClipboardCheck} hue="coral">
          <div className="space-y-5">
            <StatusBars
              caption="Completion rate, assigned against self-enrolled"
              format={(v) => `${v}%`}
              data={[
                {
                  label: "Assigned completed",
                  value: totals.mandatory.assignedCompletion,
                  hue: "coral",
                  note: `${formatCompact(totals.mandatory.assigned)} assigned`,
                },
                {
                  label: "Self-enrolled completed",
                  value: totals.mandatory.selfEnrolledCompletion,
                  hue: "blue",
                  note: `${formatCompact(totals.mandatory.selfEnrolled)} chose`,
                },
              ]}
            />
            <CalloutStrip icon={ShieldCheck} hue="coral" title="Required training" href="/suite/lms/compliance">
              See who is due or overdue, person by person
            </CalloutStrip>
          </div>
        </Panel>

        <Panel
          title="Community"
          subtitle="The people behind your catalogue"
          icon={Trophy}
          hue="sun"
          className="md:col-span-2 xl:col-span-1"
          bodyClassName="px-3 pb-3 pt-3"
        >
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { icon: GraduationCap, hue: "grape" as Hue, label: "Instructors", value: totals.instructors, href: "/suite/lms/instructors" },
              { icon: MessageSquare, hue: "sky" as Hue, label: "Reviews", value: totals.reviews, href: "/suite/lms/reviews" },
              { icon: UserPlus, hue: "blue" as Hue, label: "Enrolments", value: totals.enrollments, href: "/suite/lms/progress" },
            ].map((s) => (
              <ListRow
                key={s.label}
                href={s.href}
                leading={<IconTile icon={s.icon} hue={s.hue} size={40} />}
                title={<span className="text-xl font-bold tabular-nums">{s.value.toLocaleString()}</span>}
                meta={s.label}
              />
            ))}
          </ul>
        </Panel>
      </div>

      {/* courses + activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section aria-labelledby="top-courses" className="min-w-0 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={Trophy} hue="sun" size={40} />
              <div className="min-w-0">
                <h2 id="top-courses" className="text-lg font-bold tracking-tight text-neutral-900">
                  Top performing courses
                </h2>
                <p className="text-xs text-neutral-500">Ranked by learners</p>
              </div>
            </div>
            <ViewAllLink href="/suite/lms/courses" />
          </div>
          <DataView
            rows={topCourses}
            columns={topColumns}
            rowKey={(c) => c.slug}
            rowHref={(c) => `/suite/lms/courses/${c.slug}`}
            storageKey="lms.overview.top-courses"
            searchable={false}
            caption="Top performing courses"
            gridCols={2}
            renderCard={(c) => (
              <CoverCard
                title={c.title}
                gradient={c.gradient}
                eyebrow={c.category}
                chips={
                  <>
                    <Chip hue="blue" icon={Users}>
                      {formatCompact(c.learners)} learners
                    </Chip>
                    {c.rating > 0 && (
                      <Chip hue="sun" icon={Star}>
                        {c.rating.toFixed(1)}
                      </Chip>
                    )}
                  </>
                }
              >
                <Progress value={c.completionRate} hue="mint" label="Completed" showValue />
              </CoverCard>
            )}
            renderListItem={(c) => (
              <div className="flex items-center gap-4 px-5 py-3.5">
                <CourseThumb title={c.title} gradient={c.gradient} size={44} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{c.title}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {c.category ?? "Uncategorised"}, {formatCompact(c.learners)} learners
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <Progress value={c.completionRate} hue="mint" size="sm" showValue label="Completed" />
                </div>
              </div>
            )}
            empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">No course has learners yet.</p>}
          />
        </section>

        <Panel title="Recent activity" subtitle="As it happens across your learning" icon={Activity} hue="blue">
          {activity.length === 0 ? (
            <p className="py-6 text-sm text-neutral-500">Nothing has happened yet.</p>
          ) : (
            <Timeline
              items={activity.map((a, i) => ({
                id: `${a.at}-${i}`,
                icon: ACTIVITY_STYLE[a.kind]?.icon ?? Activity,
                hue: ACTIVITY_STYLE[a.kind]?.hue ?? "blue",
                text: a.title,
                when: `${a.meta}, ${timeAgo(a.at)}`,
              }))}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
