"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  ChartLine,
  Users,
  Star,
  BookOpen,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Award,
  ListTodo,
  Activity,
  PieChart,
  Trophy,
  MessageSquare,
  BarChart3,
  Megaphone,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  ButtonLink,
  Chip,
  Empty,
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
import { AreaLine, Donut, SegmentedGauge } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { CourseThumb } from "@/components/shared/CourseCover";
import { CoverCard, IconTile, Rating, StatCard, Timeline } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
import { useAuth } from "@/lib/auth-store";
import {
  analytics,
  insights,
  type InstructorOverview,
  type TodoItem,
} from "@/lib/api/instructor-client";
import {
  useNotifications,
  timeAgo,
  type NotificationKind,
} from "@/lib/api/notifications-client";

const EMPTY_TOTALS: InstructorOverview["totals"] = {
  learners: 0,
  enrollments: 0,
  completions: 0,
  publishedCourses: 0,
  totalCourses: 0,
  reviews: 0,
  avgRating: 0,
  avgCompletion: 0,
  completionRate: 0,
  enrollmentsDelta: 0,
  completionsDelta: 0,
  ratingDelta: 0,
  completionDelta: 0,
};

const NOTIF_STYLE: Record<NotificationKind, { icon: LucideIcon; hue: Hue }> = {
  enrollment: { icon: UserPlus, hue: "blue" },
  purchase: { icon: Award, hue: "mint" },
  sale: { icon: Wallet, hue: "mint" },
  payment_failed: { icon: AlertCircle, hue: "rose" },
  refund: { icon: Wallet, hue: "sun" },
  info: { icon: CheckCircle2, hue: "slate" },
};

/*
  Shortcuts to the studio's own sections. Every one is in the studio nav, and
  the studio layout already admits only people who teach, so no tile needs a
  gate of its own.
*/
const QUICK_LINKS: QuickAction[] = [
  { label: "My courses", href: "/suite/lms/teach/courses", icon: BookOpen, hue: "blue" },
  { label: "Students", href: "/suite/lms/teach/students", icon: Users, hue: "sky" },
  { label: "Q&A", href: "/suite/lms/teach/messages", icon: MessageSquare, hue: "grape" },
  { label: "Reviews", href: "/suite/lms/teach/reviews", icon: Star, hue: "sun" },
  { label: "Analytics", href: "/suite/lms/teach/analytics", icon: BarChart3, hue: "mint" },
  { label: "Announcements", href: "/suite/lms/teach/announcements", icon: Megaphone, hue: "coral" },
];

type TopCourse = InstructorOverview["topCourses"][number];

export default function InstructorOverviewPage() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<"enrollments" | "completions">("enrollments");
  const [ov, setOv] = useState<InstructorOverview | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // Real in-app notifications double as this dashboard's activity feed, the
  // course ones only. An instructor who is also on a project got "Ada
  // assigned you a task" under "Recent activity across your courses"; those
  // belong to the bell and to Projects › My notifications.
  const { items: allNotifications } = useNotifications();
  const activity = allNotifications.filter((n) => !String(n.kind).startsWith("projects."));

  useEffect(() => {
    let alive = true;
    analytics.overview().then((d) => alive && setOv(d)).catch(() => {});
    insights.todos().then((d) => alive && setTodos(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const instructorTotals = ov?.totals ?? EMPTY_TOTALS;
  const instructorMonthly = ov?.monthly ?? [];
  const topCourses = ov?.topCourses ?? [];

  const chartData = instructorMonthly.map((m) => ({
    label: m.month,
    value: metric === "enrollments" ? m.enrollments : m.completions,
  }));

  // Scaled against the most-taken course, so the longest bar fills the row.
  const maxLearners = topCourses[0]?.learners || 1;

  const columns: Column<TopCourse>[] = [
    {
      key: "title",
      header: "Course",
      primary: true,
      sortable: true,
      value: (c) => c.title,
      render: (c) => (
        <span className="flex items-center gap-3">
          <CourseThumb title={c.title} gradient={c.gradient ?? "from-primary-400 to-primary-600"} size={40} rounded="rounded-xl" />
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
      sortable: true,
      value: (c) => c.learners,
      render: (c) => (
        <span className="flex min-w-[9rem] items-center gap-3">
          <span className="w-20">
            <Meter value={(c.learners / maxLearners) * 100} size="sm" label={`${c.title} share of uptake`} />
          </span>
          <span className="tabular-nums text-neutral-700">{formatCompact(c.learners)}</span>
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      hideOnMobile: true,
      value: (c) => c.rating,
      render: (c) => <Rating value={c.rating} />,
    },
    {
      key: "completionRate",
      header: "Completed",
      align: "right",
      sortable: true,
      value: (c) => c.completionRate,
      render: (c) => (
        <span className="inline-flex rounded-full bg-mint-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-mint-700">
          {c.completionRate}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner
        name={user?.name}
        className="mb-0!"
        eyebrow="Teaching studio"
        subtitle="Here is how your courses are doing this month."
        art="learning"
        figure={{
          label: "Learners on your courses",
          value: formatCompact(instructorTotals.learners),
          hint: `${formatCompact(instructorTotals.enrollments)} enrolments, ${instructorTotals.completionRate}% finish`,
        }}
        actions={
          <>
            <Link href="/suite/lms/teach/courses/new" className={bannerButtonClass("solid")}>
              <Plus size={17} aria-hidden />
              Create course
            </Link>
            {/* Links to the instructor's own best-selling course, not a hardcoded slug.
                Hidden until they have one to show. */}
            {topCourses[0] && (
              <Link href={`/courses/${topCourses[0].slug}`} className={bannerButtonClass("glass")}>
                <ExternalLink size={17} aria-hidden />
                View public page
              </Link>
            )}
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Courses completed"
          value={formatCompact(instructorTotals.completions)}
          delta={instructorTotals.completionsDelta}
          deltaLabel="vs last month"
          icon={Award}
          hue="mint"
        />
        <StatCard
          label="Learners"
          value={formatCompact(instructorTotals.learners)}
          delta={instructorTotals.enrollmentsDelta}
          deltaLabel="new enrolments"
          icon={Users}
          hue="sky"
        />
        <StatCard
          label="Average rating"
          value={instructorTotals.avgRating.toFixed(2)}
          unit="/ 5"
          delta={instructorTotals.ratingDelta}
          hint={`${instructorTotals.reviews.toLocaleString()} reviews`}
          icon={Star}
          hue="sun"
        />
        <StatCard
          label="Published courses"
          value={`${instructorTotals.publishedCourses}`}
          unit={`of ${instructorTotals.totalCourses}`}
          delta={instructorTotals.completionDelta}
          icon={BookOpen}
          hue="grape"
          href="/suite/lms/teach/courses"
        />
      </StatGrid>

      <QuickActions items={QUICK_LINKS} />

      {/* hero chart + progress gauge */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Performance"
          subtitle={`${metric === "enrollments" ? "New enrolments" : "Courses completed"}, last 12 months`}
          icon={ChartLine}
          hue="grape"
          actions={
            <Segmented
              label="Chart metric"
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
            height={250}
            caption={`${metric === "enrollments" ? "Enrolments" : "Completions"} over the last 12 months`}
            format={(v) =>
              metric === "enrollments" ? `${v.toLocaleString()} enrolled` : `${v.toLocaleString()} completed`
            }
          />
        </Panel>

        {/*
          What used to be the payout banner. Courses are free and payouts are
          gone, so the thing worth putting in front of an instructor here is how
          far their learners are actually getting.
        */}
        <Panel
          title="Learner progress"
          subtitle="Average across your courses"
          icon={Activity}
          hue="mint"
          actions={<ViewAllLink href="/suite/lms/teach/analytics">View engagement</ViewAllLink>}
        >
          <div className="flex flex-col items-center">
            <SegmentedGauge
              value={instructorTotals.avgCompletion}
              hue="mint"
              label="Average progress"
              display={`${instructorTotals.avgCompletion}%`}
              size={220}
            />
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-mint-50 p-3">
                <IconTile icon={CheckCircle2} hue="mint" size={36} />
                <div className="min-w-0">
                  <p className="text-xs text-neutral-600">Finish rate</p>
                  <p className="text-lg font-bold tabular-nums text-neutral-900">{instructorTotals.completionRate}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-sky-50 p-3">
                <IconTile icon={UserPlus} hue="sky" size={36} />
                <div className="min-w-0">
                  <p className="text-xs text-neutral-600">Enrolments</p>
                  <p className="text-lg font-bold tabular-nums text-neutral-900">
                    {formatCompact(instructorTotals.enrollments)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* list panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="To-do" subtitle="Keep your courses healthy" icon={ListTodo} hue="coral" bodyClassName="p-3">
          {todos.length === 0 ? (
            <Empty icon={CheckCircle2} hue="mint" title="Nothing needs your attention." />
          ) : (
            <ul className="space-y-1">
              {todos.map((t: TodoItem, i: number) => (
                <li key={i}>
                  <Link
                    href={t.href}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <IconTile icon={t.urgent ? AlertCircle : CheckCircle2} hue={t.urgent ? "rose" : "blue"} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900">{t.label}</span>
                      <span className="block text-xs text-neutral-500">{t.meta}</span>
                    </span>
                    {t.urgent && <Chip hue="rose">Urgent</Chip>}
                    <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" subtitle="Across your courses" icon={Activity} hue="sky">
          {activity.length === 0 ? (
            <Empty
              icon={Activity}
              hue="sky"
              title="No activity yet"
              hint="New enrolments show up here as learners buy your courses."
            />
          ) : (
            <div className="max-h-[22rem] overflow-y-auto pr-1">
              <Timeline
                items={activity.map((n) => {
                  const s = NOTIF_STYLE[n.kind] ?? NOTIF_STYLE.info;
                  return {
                    id: String(n.id),
                    icon: s.icon,
                    hue: s.hue,
                    text: (
                      <>
                        <span className="font-semibold text-neutral-900">{n.title}</span>
                        <span className="block text-xs text-neutral-500">{n.message}</span>
                      </>
                    ),
                    when: timeAgo(n.createdAt),
                  };
                })}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Learners by course"
          subtitle="Share of your enrolments"
          icon={PieChart}
          hue="grape"
          actions={<ViewAllLink href="/suite/lms/teach/students" />}
        >
          {topCourses.length === 0 ? (
            <Empty icon={PieChart} hue="grape" title="No learners yet" hint="Publish a course and learners can start enrolling." />
          ) : (
            <Donut
              legend="below"
              size={170}
              data={topCourses.map((c) => ({
                label: c.title.split(" ").slice(0, 3).join(" "),
                value: c.learners,
                hue: hueFor(c.title),
              }))}
              total={formatCompact(instructorTotals.learners)}
              centerLabel="Learners"
              caption="Learners by course"
            />
          )}
        </Panel>
      </div>

      {/* top courses */}
      <section aria-labelledby="top-courses-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile icon={Trophy} hue="sun" size={40} />
            <div className="min-w-0">
              <h2 id="top-courses-heading" className="text-lg font-bold tracking-tight text-neutral-900">
                Top courses
              </h2>
              <p className="text-xs text-neutral-500">Ranked by uptake</p>
            </div>
          </div>
          <ViewAllLink href="/suite/lms/teach/courses" />
        </div>
        <DataView
          rows={topCourses}
          columns={columns}
          rowKey={(c) => c.slug}
          storageKey="teach.top-courses"
          rowHref={(c) => `/suite/lms/teach/courses/${c.slug}`}
          caption="Your top courses by uptake"
          searchPlaceholder="Search your top courses"
          empty={
            <Empty
              icon={BookOpen}
              title="No courses yet"
              hint="Create your first course and it is ranked here."
              action={
                <ButtonLink href="/suite/lms/teach/courses/new" size="sm" icon={Plus}>
                  Create course
                </ButtonLink>
              }
            />
          }
          renderCard={(c) => (
            <CoverCard
              title={c.title}
              gradient={c.gradient ?? "from-primary-400 to-primary-600"}
              eyebrow={c.category}
              badge={<span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-neutral-900 shadow-sm">#{topCourses.indexOf(c) + 1}</span>}
              chips={
                <>
                  <Chip hue="sky" icon={Users}>
                    {formatCompact(c.learners)} learners
                  </Chip>
                  <Chip hue="sun" icon={Star}>
                    {c.rating.toFixed(1)}
                  </Chip>
                </>
              }
            >
              <Progress value={c.completionRate} hue="mint" label="Completed" showValue />
            </CoverCard>
          )}
        />
      </section>
    </div>
  );
}
