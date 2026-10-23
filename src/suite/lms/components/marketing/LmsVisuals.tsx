import {
  ArrowDown,
  BadgeCheck,
  Check,
  CircleCheck,
  FileText,
  ListChecks,
  MonitorPlay,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * The four drawn figures on the XwiftHQ LMS product page.
 *
 * Every one of them depicts behaviour that exists in the app: three lecture
 * types, four question types, the inline reason a quiz question would be
 * dropped, a serial that resolves at a public URL, quarter badges and an
 * organisation-scoped board. Nothing here illustrates a feature the product
 * does not have.
 *
 * Purple carries the chrome: white frames on a soft purple glow, round
 * icon badges and purple check circles. Gold is kept for two small accents
 * (the step in progress and the earned badges), because gold means the
 * moment of mastery and spending it anywhere else dilutes it.
 */

/** Small caption text, in place of the old mono uppercase labels. */
const META = "text-[11px] font-medium text-neutral-500";

/* ------------------------------------------------------------------ */
/*  1. The pathway ladder                                              */
/* ------------------------------------------------------------------ */

type RungState = "done" | "now" | "next";

const PATHWAY: { title: string; height: number; state: RungState }[] = [
  { title: "Induction and conduct", height: 34, state: "done" },
  { title: "Health and safety at work", height: 48, state: "done" },
  { title: "Data protection basics", height: 60, state: "done" },
  { title: "Revenue analytics", height: 74, state: "now" },
  { title: "Field data quality", height: 82, state: "next" },
  { title: "Budget monitoring", height: 92, state: "next" },
  { title: "Reporting standards", height: 100, state: "next" },
];

/*
  `bg-accent-500` here is a bar, not a label: nothing is written on it, so the
  gold rule about white text does not arise. The "In progress" pill beside it
  uses accent-700 text, the only gold value that clears 4.5:1 as text.
*/
const RUNG_FILL: Record<RungState, string> = {
  done: "bg-gradient-to-t from-primary-700 to-primary-500",
  now: "bg-accent-500",
  next: "bg-primary-100",
};

const RUNG_WORD: Record<RungState, string> = {
  done: "Complete",
  now: "In progress",
  next: "Not started",
};

const RUNG_WORD_STYLE: Record<RungState, string> = {
  done: "bg-primary-50 text-primary-700",
  now: "bg-accent-500/15 text-accent-700",
  next: "bg-neutral-100 text-neutral-500",
};

export function PathwayLadderFigure() {
  return (
    <div className="xw-frame p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-sm font-bold text-neutral-900">
          Field Operations pathway
        </p>
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[10px] font-semibold text-primary-700">
          Example
        </span>
      </div>
      <p className={`mt-1 ${META}`}>
        Assigned to the operations team, 7 steps
      </p>

      <div
        className="mt-6 flex h-28 items-end gap-1.5 sm:gap-2.5"
        role="img"
        aria-label="A seven-step pathway rising left to right: three steps complete, the fourth in progress, three still to go"
      >
        {PATHWAY.map((rung) => (
          <div
            key={rung.title}
            className={`flex-1 rounded-full ${RUNG_FILL[rung.state]}`}
            style={{ height: `${rung.height}%` }}
          />
        ))}
      </div>

      <ol className="mt-6 space-y-2 border-t border-neutral-100 pt-5">
        {PATHWAY.map((rung, index) => (
          <li key={rung.title} className="flex items-center gap-2.5">
            <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[9px] font-semibold text-neutral-600">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">
              {rung.title}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RUNG_WORD_STYLE[rung.state]}`}
            >
              {RUNG_WORD[rung.state]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. The curriculum builder                                          */
/* ------------------------------------------------------------------ */

const LECTURE_GLYPH = {
  Video: MonitorPlay,
  Article: FileText,
  Quiz: ListChecks,
} as const;

type LectureKind = keyof typeof LECTURE_GLYPH;

interface BuilderSection {
  title: string;
  lectures: { kind: LectureKind; title: string; meta: string }[];
  collapsed?: number;
}

const SECTIONS: BuilderSection[] = [
  {
    title: "1. Getting started",
    lectures: [
      { kind: "Video", title: "Welcome and scope", meta: "4:12" },
      { kind: "Article", title: "How approval works", meta: "3 min read" },
      { kind: "Quiz", title: "Check your understanding", meta: "4 questions" },
    ],
  },
  { title: "2. The revenue model", lectures: [], collapsed: 4 },
  { title: "3. Reporting standards", lectures: [], collapsed: 2 },
];

const QUESTION_TYPES = [
  "Multiple choice",
  "Fill the blank",
  "Short answer",
  "Matching",
];

export function CourseBuilderFigure() {
  return (
    <MockFrame label="lms / courses / curriculum" hue="primary">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-heading text-sm font-bold text-neutral-900">
          Revenue analytics: curriculum
        </p>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-600">
          Draft
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1.05fr_1fr]">
        {/* Left: the section tree */}
        <div className="space-y-2">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="min-w-0 rounded-xl border border-neutral-200 bg-white"
            >
              <p className="border-b border-neutral-100 px-2.5 py-2 text-[11px] font-semibold text-neutral-900">
                {section.title}
                {section.collapsed !== undefined && (
                  <span className="ml-2 font-medium text-neutral-500">
                    {section.collapsed} lessons
                  </span>
                )}
              </p>
              {section.lectures.length > 0 && (
                <ul className="divide-y divide-neutral-50">
                  {section.lectures.map((lecture) => {
                    const Glyph = LECTURE_GLYPH[lecture.kind];
                    return (
                      <li
                        key={lecture.title}
                        className="flex items-center gap-2 px-2.5 py-1.5"
                      >
                        <Glyph
                          className="h-3.5 w-3.5 shrink-0 text-primary-600"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-700">
                          {lecture.title}
                        </span>
                        <span className="tnum shrink-0 text-[10px] text-neutral-500">
                          {lecture.meta}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Right: the lesson being edited */}
        <div className="xw-tile min-w-0 rounded-xl p-3">
          <p className={META}>Lesson</p>
          <p className="mt-1 text-[11px] font-semibold text-neutral-900">
            Check your understanding
          </p>

          <div className="mt-3 flex gap-1" aria-hidden="true">
            {(Object.keys(LECTURE_GLYPH) as LectureKind[]).map((kind) => (
              <span
                key={kind}
                className={`flex-1 rounded-full px-1 py-1 text-center text-[9px] font-semibold ${
                  kind === "Quiz"
                    ? "bg-primary-600 text-white"
                    : "bg-white text-neutral-500"
                }`}
              >
                {kind}
              </span>
            ))}
          </div>

          <dl className="mt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <dt className="text-neutral-500">Questions</dt>
              <dd className="tnum font-semibold text-neutral-900">4</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <dt className="text-neutral-500">Pass mark</dt>
              <dd className="tnum font-semibold text-neutral-900">70%</dd>
            </div>
          </dl>

          <p className={`mt-3 ${META}`}>Question types</p>
          <ul className="mt-1.5 space-y-1">
            {QUESTION_TYPES.map((type) => (
              <li
                key={type}
                className="flex items-center gap-1.5 text-[10px] text-neutral-600"
              >
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                  aria-hidden="true"
                >
                  <Check className="h-2.5 w-2.5 text-primary-700" />
                </span>
                {type}
              </li>
            ))}
          </ul>

          {/*
            The real editor prints this sentence against the question as the
            author types, which is the detail worth drawing: an unanswerable
            quiz is caught while it is being written rather than by the learner
            who reaches it.
          */}
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning-500/40 bg-warning-500/10 px-2 py-1.5 text-[10px] leading-snug text-neutral-700">
            <TriangleAlert
              className="mt-px h-3 w-3 shrink-0 text-warning-600"
              aria-hidden="true"
            />
            Q3: every blank needs at least one accepted answer
          </p>
        </div>
      </div>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  3. The certificate and its public lookup                           */
/* ------------------------------------------------------------------ */

const VERIFIED_ROWS: { label: string; value: string }[] = [
  { label: "Holder", value: "A. Okafor" },
  { label: "Course", value: "Revenue analytics" },
  { label: "Issued by", value: "Example Ltd" },
  { label: "Issue date", value: "12 March 2026" },
];

export function CertificateFigure() {
  return (
    <div>
      <div className="xw-frame overflow-hidden">
        {/*
          The certificate band is the brand's purple gradient with white text,
          the same treatment as every other purple block on the site.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 px-5 py-3 text-white">
          <span className="text-xs font-semibold">Certificate of completion</span>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold">
              Example
            </span>
            <BadgeCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="p-5">
          <p className={META}>Awarded to</p>
          <p className="mt-1 font-heading text-xl font-semibold text-neutral-900">
            A. Okafor
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            for completing{" "}
            <span className="font-semibold text-neutral-900">
              Revenue analytics
            </span>{" "}
            at Example Ltd.
          </p>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-neutral-100 pt-4">
            <span className={META}>Serial</span>
            <span className="tnum font-mono text-sm text-neutral-900">
              TT-2026-AB12CD
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center py-3" aria-hidden="true">
        <span className="h-4 w-px bg-primary-300" />
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]">
          <ArrowDown className="h-4 w-4 text-primary-600" />
        </span>
        <span className="h-4 w-px bg-primary-300" />
      </div>

      <MockFrame label="/verify/TT-2026-AB12CD" hue="primary">
        <p className="flex items-center gap-2.5">
          <CircleCheck
            className="h-5 w-5 shrink-0 text-success-600"
            aria-hidden="true"
          />
          <span className="font-heading text-sm font-semibold text-neutral-900">
            Certificate verified
          </span>
        </p>

        <dl className="mt-4 space-y-2">
          {VERIFIED_ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-neutral-500">{row.label}</dt>
              <dd className="text-xs font-medium text-neutral-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className={`mt-4 ${META}`}>
          Public page, no account required
        </p>
      </MockFrame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Badges and the company board                                    */
/* ------------------------------------------------------------------ */

const BOARD: { rank: number; who: string; finished: number; you?: boolean }[] = [
  { rank: 1, who: "K. A.", finished: 14 },
  { rank: 2, who: "T. O.", finished: 12 },
  { rank: 3, who: "You", finished: 11, you: true },
  { rank: 4, who: "M. E.", finished: 9 },
];

const QUARTERS: { tier: string; earned: boolean }[] = [
  { tier: "25%", earned: true },
  { tier: "50%", earned: true },
  { tier: "75%", earned: true },
  { tier: "100%", earned: false },
];

export function GamificationFigure() {
  return (
    <MockFrame label="lms / achievements" hue="primary">
      <p className="font-heading text-sm font-semibold text-neutral-900">
        Your organisation: courses finished
      </p>

      <ol className="mt-3 space-y-1">
        {BOARD.map((row) => (
          <li
            key={row.rank}
            className={`flex items-center gap-3 rounded-full px-2 py-1.5 ${
              row.you ? "bg-primary-50 ring-1 ring-primary-500/25" : ""
            }`}
          >
            <span
              className={`tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                row.you
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {row.rank}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-xs ${
                row.you
                  ? "font-semibold text-primary-700"
                  : "text-neutral-700"
              }`}
            >
              {row.who}
            </span>
            <span className="tnum shrink-0 pr-1 text-xs font-semibold text-neutral-900">
              {row.finished}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Scoped to your organisation. Nobody outside it shows up here, and
        nobody outside it can see you.
      </p>

      <p className={`mt-5 border-t border-neutral-100 pt-4 ${META}`}>
        Course badges
      </p>

      {/*
        Gold as a tint rather than a fill: these are achievements, which is
        exactly what gold means here, but accent-500 cannot carry text. So the
        pill is gold at 15% and the label is accent-700.
      */}
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {QUARTERS.map((badge) => (
          <li
            key={badge.tier}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
              badge.earned
                ? "bg-accent-500/15 text-accent-700"
                : "border border-dashed border-neutral-300 text-neutral-500"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tnum">{badge.tier}</span>
            <span className="sr-only">
              {badge.earned ? " badge earned" : " badge not yet earned"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-neutral-500">
        <BadgeCheck
          className="mt-px h-3.5 w-3.5 shrink-0 text-primary-600"
          aria-hidden="true"
        />
        Once earned, a badge is never taken back.
      </p>
    </MockFrame>
  );
}
