"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Activity,
  CheckCircle2,
  GraduationCap,
  Layers,
  Lock,
  Star,
  Presentation,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { SPINE_FACILITIES } from "@/lib/products";
import { formatCompact, timeAgo } from "@/lib/console-data";
import { analytics as adminAnalytics, type ActivityItem, type AdminOverview } from "@/lib/api/admin-client";
import { analytics as teachAnalytics, type InstructorOverview } from "@/lib/api/instructor-client";
import {
  Chip,
  Panel,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  cx,
} from "@/components/workspace/kit";
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
import { IconTile, StatCard, Timeline, type TimelineItem } from "@/suite/lms/components/ui/ws";

/**
 * The suite home: the first screen a signed-in person sees.
 *
 * A greeting first, then, where they are cheap to read, a few live figures
 * from the modules this person runs. Then one colourful card per module: the
 * ones they can open (the same `availability` the switcher uses, so nobody is
 * offered a door onto a 403) and the ones their organisation has only as a
 * preview, labelled as previews.
 */

const ACTIVITY_ICON: Record<ActivityItem["kind"], { icon: LucideIcon; hue: Hue }> = {
  enrollment: { icon: UserPlus, hue: "blue" },
  completion: { icon: Award, hue: "mint" },
  review: { icon: Star, hue: "sun" },
  course: { icon: BookOpen, hue: "grape" },
};

const noSubscription = () => () => {};

export function SuiteLauncher({ firstName }: { firstName?: string | null }) {
  const { user } = useAuth();
  // The date is read after mount: the server's clock and timezone are not the
  // reader's, and a mismatch would be a hydration error.
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

  // The full name when the session has it, so the banner can drop a title ("Dr").
  const name = user?.name ?? firstName ?? null;
  const dateLine = now
    ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "XwiftHQ suite";

  const timeline: TimelineItem[] = activity.slice(0, 6).map((a, i) => ({
    id: `${a.at}-${i}`,
    icon: ACTIVITY_ICON[a.kind]?.icon ?? Activity,
    hue: ACTIVITY_ICON[a.kind]?.hue ?? "blue",
    text: a.title,
    when: `${a.meta} · ${timeAgo(a.at)}`,
  }));

  return (
    <div className="space-y-6">
      {/* ---------- greeting ---------- */}
      <section aria-label="Your suite">
        <WelcomeBanner
          name={name}
          eyebrow={dateLine}
          art="organisation"
          className="mb-0"
          subtitle="Every module you can open, on one login: one identity, one organisation tree, one audit trail. Pick up where you left off."
          figure={{
            label: "Open to you",
            value: modules.length === 1 ? "1 module" : `${modules.length} modules`,
            hint:
              previews.length > 0
                ? `${previews.length} more to preview`
                : "A person is created once and every module knows them.",
          }}
          actions={
            modules.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Open a module">
                {modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <li key={m.key}>
                      <Link href={m.href} className={bannerButtonClass("glass")}>
                        <Icon size={16} aria-hidden />
                        {m.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : undefined
          }
        />
      </section>

      {/* ---------- live facts ---------- */}
      {runsLms && lms && (
        <section aria-labelledby="suite-facts">
          <h2 id="suite-facts" className="mb-4 text-lg font-bold tracking-tight text-neutral-900">
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
              hue="sky"
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
          <h2 id="suite-facts" className="mb-4 text-lg font-bold tracking-tight text-neutral-900">
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
              hue="grape"
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

      {/* ---------- module cards ---------- */}
      <section aria-labelledby="suite-modules">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="suite-modules" className="text-lg font-bold tracking-tight text-neutral-900">
              Your modules
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Switched on for your organisation and open to your role
              {previews.length > 0 ? ", plus previews of the rest." : "."}
            </p>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <Chip hue="mint" icon={CheckCircle2}>
              {modules.length} switched on
            </Chip>
            {previews.length > 0 && (
              <Chip hue="slate" icon={Lock}>
                {previews.length} in preview
              </Chip>
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <ModuleCard key={m.key} module={m} state="open" />
          ))}
          {previews.map((p) => (
            <ModuleCard key={p.key} module={p} state="preview" />
          ))}
        </div>
      </section>

      {(timeline.length > 0 || previews.length > 0) && (
        <div className={cx("grid grid-cols-1 gap-6", timeline.length > 0 && previews.length > 0 && "lg:grid-cols-3")}>
          {timeline.length > 0 && (
            <Panel
              title="Recent learning activity"
              subtitle="Live from the Learning console"
              icon={Activity}
              hue="grape"
              className={previews.length > 0 ? "lg:col-span-2" : undefined}
              actions={<ViewAllLink href="/suite/lms">Open dashboard</ViewAllLink>}
            >
              <Timeline items={timeline} />
            </Panel>
          )}

          {/* ---------- what every module shares ---------- */}
          {previews.length > 0 && (
            <Panel
              title="Shared by every module"
              subtitle="Switch on a preview and it joins the same spine. The platform owner activates modules."
              icon={Layers}
              hue="sky"
            >
              <ul className="grid grid-cols-2 gap-2.5">
                {SPINE_FACILITIES.map((f) => (
                  <li key={f.label} className="flex items-center gap-2.5 rounded-xl bg-neutral-50 px-2.5 py-2">
                    <IconTile icon={f.icon} hue="blue" size={32} />
                    <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-800">{f.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Module card                                                        */
/* ------------------------------------------------------------------ */

function ModuleCard({ module: m, state }: { module: WorkspaceModule; state: "open" | "preview" }) {
  const Icon = m.icon;
  const hue = HUE[m.hue];
  const open = state === "open";
  const href = hrefFor(m, state);
  return (
    <article
      className={cx(
        "ws-card group relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0",
        !open && "border-dashed",
      )}
    >
      <div className={cx("relative overflow-hidden px-5 pb-5 pt-5", hue.soft)}>
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/40" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md", hue.tile)}>
            <Icon size={22} aria-hidden />
          </span>
          {open ? (
            <Chip hue="mint" icon={CheckCircle2}>
              Switched on
            </Chip>
          ) : (
            <Chip hue="slate" icon={Lock}>
              Preview
            </Chip>
          )}
        </div>
        <h3 className="relative mt-4 text-base font-bold tracking-tight text-neutral-900">
          <Link
            href={href}
            className="rounded outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
          >
            {m.name}
          </Link>
        </h3>
        <p className="relative mt-1 text-sm text-neutral-600">{m.blurb}</p>
      </div>
      {open && m.links.length > 0 && (
        <ul className="relative z-[1] flex flex-wrap gap-2 px-5 pt-4" aria-label={`${m.name} pages`}>
          {m.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex h-9 items-center rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 outline-none transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex items-center justify-between px-5 pb-5 pt-4">
        <span className={cx("inline-flex items-center gap-1.5 text-sm font-semibold", open ? hue.text : "text-neutral-600")}>
          {open ? `Open ${m.name}` : "See what it does"}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        {!open && <span className="text-xs text-neutral-500">Not switched on yet</span>}
      </div>
    </article>
  );
}
