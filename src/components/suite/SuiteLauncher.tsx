"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Activity,
  GraduationCap,
  Star,
  Presentation,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { SPINE_FACILITIES } from "@/lib/products";
import { formatCompact, timeAgo } from "@/lib/console-data";
import { analytics as adminAnalytics, type ActivityItem, type AdminOverview } from "@/lib/api/admin-client";
import { analytics as teachAnalytics, type InstructorOverview } from "@/lib/api/instructor-client";
import { Chip, Panel, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import {
  HUE,
  WORKSPACE_MODULES,
  availability,
  canAdministerLms,
  hrefFor,
  type Hue,
  type WorkspaceModule,
} from "@/components/workspace/modules";
import { teaches as teachesLms } from "@/lib/roles";
import { isModuleActive } from "@/lib/module-access";
import { StatCard, Timeline, type TimelineItem } from "@/suite/lms/components/ui/ws";

/**
 * The suite home — the first screen a signed-in person sees.
 *
 * A launcher first: one colourful tile per module this person can open (the
 * same `canOpen` the switcher uses, so nobody is offered a door onto a 403),
 * each with the pages worth jumping straight to. Then, where they are cheap to
 * read, a few live figures from the modules this person runs — and the two
 * modules that exist only as previews, labelled as previews.
 */

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: LucideIcon; hue: Hue }> = {
  enrollment: { icon: UserPlus, hue: "blue" },
  completion: { icon: Award, hue: "mint" },
  review: { icon: Star, hue: "sun" },
  course: { icon: BookOpen, hue: "grape" },
};

const noSubscription = () => () => {};

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function SuiteLauncher({ firstName }: { firstName?: string | null }) {
  const { user } = useAuth();
  // The greeting and date are read after mount: the server's clock and
  // timezone are not the reader's, and a mismatch would be a hydration error.
  const minute = useSyncExternalStore(
    noSubscription,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  const now = minute == null ? null : new Date(minute * 60_000);

  const listed = useMemo(
    () =>
      WORKSPACE_MODULES.filter((m) => m.key !== "home" && m.listed !== false).map((m) => ({
        m,
        state: availability(m, user),
      })),
    [user],
  );
  const modules = useMemo(() => listed.filter((x) => x.state === "open").map((x) => x.m), [listed]);
  const previews = useMemo(() => listed.filter((x) => x.state === "preview").map((x) => x.m), [listed]);

  // Live LMS figures only where the LMS is switched on: a preview module's
  // endpoints answer 403, and a failed tile is worse than no tile.
  const lmsOn = isModuleActive(user, "lms");
  const runsLms = lmsOn && canAdministerLms(user);
  const teaches = lmsOn && !canAdministerLms(user) && teachesLms(user);

  const [lms, setLms] = useState<AdminOverview | null>(null);
  const [studio, setStudio] = useState<InstructorOverview | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let alive = true;
    if (runsLms) {
      adminAnalytics
        .overview()
        .then((d) => alive && setLms(d))
        .catch(() => {});
      adminAnalytics
        .activity()
        .then((d) => alive && setActivity(d))
        .catch(() => {});
    } else if (teaches) {
      teachAnalytics
        .overview()
        .then((d) => alive && setStudio(d))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [runsLms, teaches]);

  const name = firstName ?? user?.name?.split(" ")[0] ?? null;
  const greeting = now ? greetingFor(now.getHours()) : "Welcome back";
  const dateLine = now
    ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "Elevate suite";

  const timeline: TimelineItem[] = activity.slice(0, 6).map((a, i) => ({
    id: `${a.at}-${i}`,
    icon: ACTIVITY_ICON[a.kind]?.icon ?? Activity,
    hue: ACTIVITY_ICON[a.kind]?.hue ?? "blue",
    text: a.title,
    when: `${a.meta} · ${timeAgo(a.at)}`,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={dateLine}
        title={name ? `${greeting}, ${name}` : greeting}
        subtitle="Every module you can open, on one spine: one identity, one organisation tree, one audit trail."
      />

      {/* ---------- hero ---------- */}
      <section
        aria-label="Your suite"
        className="relative overflow-hidden rounded-[1.375rem] bg-gradient-to-br from-primary-600 via-primary-600 to-grape-500 p-6 text-white shadow-lg shadow-primary-600/20 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Sparkles size={13} aria-hidden />
              Your workspace
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight sm:text-[26px]">
              {modules.length === 1
                ? "One module is open to you"
                : `${modules.length} modules are open to you`}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">
              A person is created once and every module inherits them. Pick up where you left off, or
              jump straight to the page you need.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Open a module">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <li key={m.key}>
                  <Link
                    href={m.href}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-3.5 text-sm font-semibold text-white outline-none backdrop-blur transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Icon size={16} aria-hidden />
                    {m.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- live facts ---------- */}
      {runsLms && lms && (
        <section aria-labelledby="suite-facts">
          <h2 id="suite-facts" className="mb-4 text-lg font-semibold text-neutral-900">
            Learning at a glance
          </h2>
          <StatGrid>
            <StatCard
              featured
              featuredHue="grape"
              label="Learners"
              value={formatCompact(lms.totals.learners)}
              icon={Users}
              delta={lms.totals.enrollmentsDelta || null}
              deltaLabel="enrolments vs last month"
              href="/suite/lms/progress"
            />
            <StatCard
              label="Completion rate"
              value={lms.totals.completionRate}
              unit="%"
              icon={Award}
              hue="mint"
              hint={`${formatCompact(lms.totals.completions)} completions`}
              href="/suite/lms/progress"
            />
            <StatCard
              label="Published courses"
              value={lms.totals.courses}
              icon={BookOpen}
              hue="grape"
              hint={`${lms.totals.instructors} ${lms.totals.instructors === 1 ? "instructor" : "instructors"}`}
              href="/suite/lms/courses"
            />
            <StatCard
              label="Average rating"
              value={lms.totals.avgRating.toFixed(1)}
              unit="/ 5"
              icon={Star}
              hue="sun"
              hint={`${formatCompact(lms.totals.reviews)} reviews`}
              href="/suite/lms/reviews"
            />
          </StatGrid>
        </section>
      )}
      {!runsLms && teaches && studio && (
        <section aria-labelledby="suite-facts">
          <h2 id="suite-facts" className="mb-4 text-lg font-semibold text-neutral-900">
            Your teaching at a glance
          </h2>
          <StatGrid>
            <StatCard
              featured
              featuredHue="sky"
              label="Your learners"
              value={formatCompact(studio.totals.learners)}
              icon={Users}
              delta={studio.totals.enrollmentsDelta || null}
              deltaLabel="vs last month"
              href="/suite/lms/teach/students"
            />
            <StatCard
              label="Published courses"
              value={studio.totals.publishedCourses}
              unit={`of ${studio.totals.totalCourses}`}
              icon={Presentation}
              hue="sky"
              href="/suite/lms/teach/courses"
            />
            <StatCard
              label="Completion rate"
              value={studio.totals.completionRate}
              unit="%"
              icon={GraduationCap}
              hue="mint"
              href="/suite/lms/teach/analytics"
            />
            <StatCard
              label="Average rating"
              value={studio.totals.avgRating.toFixed(1)}
              unit="/ 5"
              icon={Star}
              hue="sun"
              hint={`${studio.totals.reviews} reviews`}
              href="/suite/lms/teach/reviews"
            />
          </StatGrid>
        </section>
      )}

      {/* ---------- module tiles ---------- */}
      <section aria-labelledby="suite-modules">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="suite-modules" className="text-lg font-semibold text-neutral-900">
            Your modules
          </h2>
          <p className="text-xs text-neutral-500">The modules switched on for your organisation that your role opens.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <ModuleTile key={m.key} module={m} />
          ))}
        </div>
      </section>

      <div className={cx("grid grid-cols-1 gap-4", timeline.length > 0 && "lg:grid-cols-3")}>
        {timeline.length > 0 && (
          <Panel
            title="Recent learning activity"
            subtitle="Live from the Learning console"
            icon={Activity}
            hue="grape"
            className="lg:col-span-2"
            actions={
              <Link
                href="/suite/lms"
                className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
              >
                Open dashboard
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            }
          >
            <Timeline items={timeline} />
          </Panel>
        )}

        {/* ---------- previews ---------- */}
        {previews.length > 0 && (
        <Panel
          title="Preview modules"
          subtitle="Not switched on for your organisation. The platform owner activates modules."
          icon={Sparkles}
          hue="sky"
        >
          <ul className={cx("grid gap-3", timeline.length === 0 && "sm:grid-cols-2")}>
            {previews.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.key} className="min-w-0">
                  <Link
                    href={hrefFor(p, "preview")}
                    className="group flex items-center gap-3 rounded-2xl border border-dashed border-neutral-200 p-3.5 outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", HUE[p.hue].tile)}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">{p.name}</span>
                        <Chip hue="slate">Preview</Chip>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">{p.blurb}</span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 border-t border-neutral-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Shared by every module</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SPINE_FACILITIES.map((f) => {
                const Glyph = f.icon;
                return (
                  <li
                    key={f.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
                  >
                    <Glyph size={13} className="text-primary-600" aria-hidden />
                    {f.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tile                                                               */
/* ------------------------------------------------------------------ */

function ModuleTile({ module: m }: { module: WorkspaceModule }) {
  const Icon = m.icon;
  const hue = HUE[m.hue];
  return (
    <article className="ws-card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className={cx("flex items-start justify-between gap-3 px-5 pb-5 pt-5", hue.soft)}>
        <div className="flex min-w-0 items-center gap-3.5">
          <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm", hue.tile)}>
            <Icon size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-neutral-900">
              <Link
                href={m.href}
                className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
              >
                {m.name}
              </Link>
            </h3>
            <p className="mt-0.5 text-sm text-neutral-600">{m.blurb}</p>
          </div>
        </div>
      </div>
      {m.links.length > 0 && (
        <ul className="relative z-[1] flex flex-wrap gap-2 px-5 pt-4" aria-label={`${m.name} pages`}>
          {m.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 outline-none transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center justify-between px-5 pb-5 pt-4">
        <span className={cx("inline-flex items-center gap-1.5 text-sm font-semibold", hue.text)}>
          Open {m.name}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </article>
  );
}
