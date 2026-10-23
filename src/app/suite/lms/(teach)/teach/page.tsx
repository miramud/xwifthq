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
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Award,
  ListTodo,
  Activity,
  PieChart,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { ButtonLink, Chip, Empty, PageHeader, Panel, Progress, Segmented, StatGrid } from "@/components/workspace/kit";
import { AreaLine, Donut, SegmentedGauge } from "@/components/workspace/charts";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { CourseThumb } from "@/components/shared/CourseCover";
import { CoverCard, IconTile, Rating, StatCard, Timeline } from "@/suite/lms/components/ui/ws";
import { Meter } from "@/suite/lms/components/ui/teach";
import { formatCompact } from "@/suite/lms/lib/instructor-data";
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

type TopCourse = InstructorOverview["topCourses"][number];

export default function InstructorOverviewPage() {
  const [metric, setMetric] = useState<"enrollments" | "completions">("enrollments");
  const [ov, setOv] = useState<InstructorOverview | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // Real in-app notifications double as this dashboard's activity feed —
  // the course ones only. An instructor who is also on a project got "Ada
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
          <CourseThumb title={c.title} gradient={c.gradient ?? "from-primary-600 to-primary-800"} size={40} rounded="rounded-xl" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900">{c.title}</span>
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
      render: (c) => <span className="font-semibold text-neutral-900">{c.completionRate}%</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teaching studio"
        title="Welcome back"
        subtitle="Here's how your courses are performing this month."
        actions={
          <>
            {/* Links to the instructor's own best-selling course, not a hardcoded slug.
                Hidden until they have one to show. */}
            {topCourses[0] && (
              <ButtonLink href={`/courses/${topCourses[0].slug}`} icon={ExternalLink}>
                View public page
              </ButtonLink>
            )}
            <ButtonLink href="/suite/lms/teach/courses/new" variant="primary" icon={Plus}>
              Create course
            </ButtonLink>
          </>
        }
      />

      <StatGrid>
        <StatCard
          featured
          featuredHue="sky"
          label="Courses completed"
          value={formatCompact(instructorTotals.completions)}
          delta={instructorTotals.completionsDelta}
          deltaLabel="vs last month"
          icon={Award}
        />
        <StatCard
          label="Learners"
          value={formatCompact(instructorTotals.learners)}
          delta={instructorTotals.enrollmentsDelta}
          deltaLabel="new enrollments"
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

      {/* hero chart + progress gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Performance"
          subtitle={`${metric === "enrollments" ? "New enrollments" : "Courses completed"} · last 12 months`}
          icon={ChartLine}
          actions={
            <Segmented
              label="Chart metric"
              value={metric}
              onChange={setMetric}
              options={[
                { key: "enrollments", label: "Enrollments" },
                { key: "completions", label: "Completions" },
              ]}
            />
          }
        >
          <AreaLine
            key={metric}
            data={chartData}
            hue={metric === "enrollments" ? "sky" : "blue"}
            height={250}
            caption={`${metric === "enrollments" ? "Enrollments" : "Completions"} over the last 12 months`}
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
        <Panel title="Learner progress" subtitle="Average across your courses" icon={Activity} hue="mint">
          <div className="flex flex-col items-center">
            <SegmentedGauge
              value={instructorTotals.avgCompletion}
              hue="mint"
              label="Average progress"
              display={`${instructorTotals.avgCompletion}%`}
              size={220}
            />
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Finish rate</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{instructorTotals.completionRate}%</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">Enrollments</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">
                  {formatCompact(instructorTotals.enrollments)}
                </p>
              </div>
            </div>
            <ButtonLink href="/suite/lms/teach/analytics" size="sm" variant="ghost" className="mt-3" icon={ArrowUpRight}>
              View engagement
            </ButtonLink>
          </div>
        </Panel>
      </div>

      {/* list panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="To-do" subtitle="Keep your courses healthy" icon={ListTodo} hue="coral" bodyClassName="p-3">
          {todos.length === 0 ? (
            <Empty icon={CheckCircle2} hue="mint" title="Nothing needs your attention." />
          ) : (
            <ul className="space-y-1">
              {todos.map((t: TodoItem, i: number) => (
                <li key={i}>
                  <Link
                    href={t.href}
                    className="flex items-start gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <IconTile icon={t.urgent ? AlertCircle : CheckCircle2} hue={t.urgent ? "rose" : "blue"} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">{t.label}</span>
                      <span className="block text-xs text-neutral-500">{t.meta}</span>
                    </span>
                    {t.urgent && <Chip hue="rose">Urgent</Chip>}
                    <ArrowUpRight size={15} className="mt-1 shrink-0 text-neutral-400" aria-hidden />
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
              hint="Enrollments will appear here as learners buy your courses."
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

        <Panel title="Learners by course" subtitle="Share of your enrollments" icon={PieChart} hue="grape">
          {topCourses.length === 0 ? (
            <Empty icon={PieChart} hue="grape" title="No learners yet" hint="Publish a course to start enrolling learners." />
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
          <div className="flex items-center gap-3">
            <IconTile icon={Trophy} hue="sun" />
            <div>
              <h2 id="top-courses-heading" className="text-[15px] font-semibold text-neutral-900">
                Top courses
              </h2>
              <p className="text-xs text-neutral-500">Ranked by uptake</p>
            </div>
          </div>
          <Link
            href="/suite/lms/teach/courses"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            View all <ArrowUpRight size={14} aria-hidden />
          </Link>
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
              hint="Create your first course and it will be ranked here."
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
              gradient={c.gradient ?? "from-primary-600 to-primary-800"}
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
